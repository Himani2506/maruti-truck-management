const express = require("express");
const router = express.Router();
const { pool } = require("../db/setup");

// ─── Reusable lab total expression ─────────────────────────────────────────
// Use this everywhere instead of (moisture + rejection)
const LAB_TOTAL = `(
  COALESCE(moisture,0) + COALESCE(duplex,0) + COALESCE(plastic,0) +
  COALESCE(pin,0) + COALESCE(raining_water,0) + COALESCE(dust,0) +
  COALESCE(millboard,0) + COALESCE(extra,0)
)`;

const E_LAB_TOTAL = `(
  COALESCE(e.moisture,0) + COALESCE(e.duplex,0) + COALESCE(e.plastic,0) +
  COALESCE(e.pin,0) + COALESCE(e.raining_water,0) + COALESCE(e.dust,0) +
  COALESCE(e.millboard,0) + COALESCE(e.extra,0)
)`;

// ─── Helper: compute net_payable (JS, used nowhere currently but kept) ──────
function computeNetPayable({
  bill_weight,
  bill_rate,
  our_weight,
  moisture,
  duplex,
  plastic,
  pin,
  raining_water,
  dust,
  millboard,
  extra,
  superseded_rate,
  superseded_rejection,
}) {
  const bw = parseFloat(bill_weight) || 0;
  const br = parseFloat(bill_rate) || 0;
  const ow = parseFloat(our_weight) || 0;
  const labTotal =
    (parseFloat(moisture) || 0) +
    (parseFloat(duplex) || 0) +
    (parseFloat(plastic) || 0) +
    (parseFloat(pin) || 0) +
    (parseFloat(raining_water) || 0) +
    (parseFloat(dust) || 0) +
    (parseFloat(millboard) || 0) +
    (parseFloat(extra) || 0);
  const sr = superseded_rate != null ? parseFloat(superseded_rate) : null;
  const srej =
    superseded_rejection != null ? parseFloat(superseded_rejection) : null;

  const shortage = bw - ow;
  const vat = bw * br * 0.13;
  const effectiveRate = sr !== null ? sr : br;
  const effectiveLab = srej !== null ? srej : labTotal;
  const labDeduction = (bw * effectiveRate * effectiveLab) / 100;
  const netPayable = (bw - shortage) * effectiveRate + vat - labDeduction;
  return parseFloat(netPayable.toFixed(2));
}

// ─── NET PAYABLE SQL block (no table prefix) ────────────────────────────────
const NET_PAYABLE_SQL = `
  CASE
    WHEN superseded_rate IS NOT NULL OR superseded_rejection IS NOT NULL THEN
      (bill_weight - shortage) * COALESCE(superseded_rate, bill_rate)
      + (bill_weight * bill_rate * 0.13)
      - (bill_weight * bill_rate * COALESCE(superseded_rejection, ${LAB_TOTAL}) / 100)
    ELSE
      (bill_weight - shortage) * bill_rate
      + (bill_weight * bill_rate * 0.13)
      - (bill_weight * bill_rate * ${LAB_TOTAL} / 100)
  END
`;

// ─── NET PAYABLE SQL block (e. prefix for JOINs) ────────────────────────────
const E_NET_PAYABLE_SQL = `
  CASE
    WHEN e.superseded_rate IS NOT NULL OR e.superseded_rejection IS NOT NULL THEN
      (e.bill_weight - e.shortage) * COALESCE(e.superseded_rate, e.bill_rate)
      + (e.bill_weight * e.bill_rate * 0.13)
      - (e.bill_weight * e.bill_rate * COALESCE(e.superseded_rejection, ${E_LAB_TOTAL}) / 100)
    ELSE
      (e.bill_weight - e.shortage) * e.bill_rate
      + (e.bill_weight * e.bill_rate * 0.13)
      - (e.bill_weight * e.bill_rate * ${E_LAB_TOTAL} / 100)
  END
`;

// ─── GET all entries (daily view) ──────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        ${NET_PAYABLE_SQL} AS net_payable,
        (superseded_rate IS NOT NULL OR superseded_rejection IS NOT NULL) AS is_overridden
      FROM scrap_entries
      ORDER BY unloading_date_ad DESC, id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /scrap error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET party-wise summary ─────────────────────────────────────────────────
router.get("/party-summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.source AS party_name,
        COALESCE(o.opening, 0) AS opening,
        SUM(${E_NET_PAYABLE_SQL}) AS purchase_8283,
        SUM(e.bill_weight * e.bill_rate * ${E_LAB_TOTAL} / 100) AS deduction,
        SUM(e.shortage) AS weight_loss,
        SUM(CASE WHEN e.superseded_rate IS NOT NULL THEN e.superseded_rate - e.bill_rate ELSE 0 END) AS rate_diff,
        SUM(${E_LAB_TOTAL}) AS rejection_rate,
        SUM(COALESCE(e.superseded_rejection, 0)) AS superseded_rejection_rate
      FROM scrap_entries e
      LEFT JOIN scrap_party_opening o ON o.party_name = e.source
      GROUP BY e.source, o.opening
      ORDER BY e.source
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /scrap/party-summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET party sheet ────────────────────────────────────────────────────────
router.get("/party-sheet/:partyName", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id, source AS party_name, grn, bill_weight, our_weight, freight,
        scrap_tax_hetauda, scrap_tax_simra, scrap_tax_birgunj, other_expenses,
        (scrap_tax_hetauda + scrap_tax_simra + scrap_tax_birgunj + other_expenses + freight) AS total_expenses,
        CASE
          WHEN bill_weight > 0 THEN
            (scrap_tax_hetauda + scrap_tax_simra + scrap_tax_birgunj + other_expenses + freight) / bill_weight
          ELSE 0
        END AS per_kg_cost,
        ${NET_PAYABLE_SQL} AS net_payable,
        ${LAB_TOTAL} AS total_lab_report
      FROM scrap_entries
      WHERE source = $1
      ORDER BY unloading_date_ad DESC, id DESC
    `,
      [decodeURIComponent(req.params.partyName)],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /scrap/party-sheet error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET / UPSERT party opening ─────────────────────────────────────────────
router.get("/opening/:partyName", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM scrap_party_opening WHERE party_name = $1",
      [decodeURIComponent(req.params.partyName)],
    );
    res.json(
      result.rows[0] || { party_name: req.params.partyName, opening: 0 },
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/opening/:partyName", async (req, res) => {
  const { opening } = req.body;
  const partyName = decodeURIComponent(req.params.partyName);
  try {
    const result = await pool.query(
      `
      INSERT INTO scrap_party_opening (party_name, opening)
      VALUES ($1, $2)
      ON CONFLICT (party_name) DO UPDATE SET opening = $2
      RETURNING *
    `,
      [partyName, opening],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET all parties ────────────────────────────────────────────────────────
router.get("/parties", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM scrap_parties ORDER BY party_name ASC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create party ──────────────────────────────────────────────────────
router.post("/parties", async (req, res) => {
  const { party_name, address, freight, opening } = req.body;
  if (!party_name)
    return res.status(400).json({ error: "party_name is required" });
  try {
    const result = await pool.query(
      `
      INSERT INTO scrap_parties (party_name, address, freight, opening)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (party_name) DO NOTHING
      RETURNING *
    `,
      [
        party_name,
        address || "",
        parseFloat(freight) || 0,
        parseFloat(opening) || 0,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single entry ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM scrap_entries WHERE id = $1",
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create entry ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    unloading_date_ad,
    unloading_date_bs,
    gen,
    grn,
    source,
    vehicle_no,
    party_bill_no,
    bill_weight,
    bill_rate,
    our_weight,
    moisture,
    duplex,
    plastic,
    pin,
    raining_water,
    dust,
    millboard,
    extra,
    scrap_tax_birgunj,
    scrap_tax_simra,
    scrap_tax_hetauda,
    other_expenses,
    freight,
  } = req.body;

  if (!unloading_date_ad || !unloading_date_bs || !source) {
    return res
      .status(400)
      .json({
        error: "unloading_date_ad, unloading_date_bs, and source are required",
      });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO scrap_entries (
        unloading_date_ad, unloading_date_bs,
        gen, grn,
        source, vehicle_no, party_bill_no,
        bill_weight, bill_rate, our_weight,
        moisture, duplex, plastic, pin, raining_water, dust, millboard, extra,
        scrap_tax_birgunj, scrap_tax_simra, scrap_tax_hetauda,
        other_expenses, freight
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23
      ) RETURNING *
    `,
      [
        unloading_date_ad,
        unloading_date_bs,
        gen || null,
        grn || null,
        source,
        vehicle_no || null,
        party_bill_no || null,
        bill_weight || null,
        bill_rate || null,
        our_weight || null,
        moisture || null,
        duplex || null,
        plastic || null,
        pin || null,
        raining_water || null,
        dust || null,
        millboard || null,
        extra || null,
        scrap_tax_birgunj || 0,
        scrap_tax_simra || 0,
        scrap_tax_hetauda || 0,
        other_expenses || 0,
        freight || 0,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /scrap error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT update admin overrides only ───────────────────────────────────────
router.put("/:id/override", async (req, res) => {
  const { superseded_rate, superseded_rejection } = req.body;
  try {
    const result = await pool.query(
      `
      UPDATE scrap_entries
      SET superseded_rate = $1, superseded_rejection = $2
      WHERE id = $3
      RETURNING *
    `,
      [
        superseded_rate !== undefined ? superseded_rate : null,
        superseded_rejection !== undefined ? superseded_rejection : null,
        req.params.id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /scrap/:id/override error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT full update (edit entry) ──────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const {
    unloading_date_ad,
    unloading_date_bs,
    gen,
    grn,
    source,
    vehicle_no,
    party_bill_no,
    bill_weight,
    bill_rate,
    our_weight,
    moisture,
    duplex,
    plastic,
    pin,
    raining_water,
    dust,
    millboard,
    extra,
    scrap_tax_birgunj,
    scrap_tax_simra,
    scrap_tax_hetauda,
    other_expenses,
    freight,
  } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE scrap_entries SET
        unloading_date_ad = $1, unloading_date_bs = $2,
        gen = $3, grn = $4,
        source = $5, vehicle_no = $6, party_bill_no = $7,
        bill_weight = $8, bill_rate = $9, our_weight = $10,
        moisture = $11, duplex = $12, plastic = $13, pin = $14,
        raining_water = $15, dust = $16, millboard = $17, extra = $18,
        scrap_tax_birgunj = $19, scrap_tax_simra = $20, scrap_tax_hetauda = $21,
        other_expenses = $22, freight = $23
      WHERE id = $24
      RETURNING *
    `,
      [
        unloading_date_ad,
        unloading_date_bs,
        gen || null,
        grn || null,
        source,
        vehicle_no || null,
        party_bill_no || null,
        bill_weight || null,
        bill_rate || null,
        our_weight || null,
        moisture || null,
        duplex || null,
        plastic || null,
        pin || null,
        raining_water || null,
        dust || null,
        millboard || null,
        extra || null,
        scrap_tax_birgunj || 0,
        scrap_tax_simra || 0,
        scrap_tax_hetauda || 0,
        other_expenses || 0,
        freight || 0,
        req.params.id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /scrap/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE entry ───────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM scrap_entries WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
