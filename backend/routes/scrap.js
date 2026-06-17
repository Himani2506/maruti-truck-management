const express = require("express");
const router = express.Router();
const { pool } = require("../db/setup");

const TOTAL_REJECTION_SQL = `COALESCE(
  rejection,
  COALESCE(duplex,0) + COALESCE(plastic,0) + COALESCE(pin,0) +
  COALESCE(raining_water,0) + COALESCE(dust,0) + COALESCE(millboard,0) +
  COALESCE(extra,0)
)`;

const E_TOTAL_REJECTION_SQL = `COALESCE(
  e.rejection,
  COALESCE(e.duplex,0) + COALESCE(e.plastic,0) + COALESCE(e.pin,0) +
  COALESCE(e.raining_water,0) + COALESCE(e.dust,0) + COALESCE(e.millboard,0) +
  COALESCE(e.extra,0)
)`;

// TOTAL_LAB_REPORT_SQL — now = moisture + rejection (no superseded here, that's handled in NET_PAYABLE)
const TOTAL_LAB_REPORT_SQL = `COALESCE(moisture,0) + ${TOTAL_REJECTION_SQL}`;

const E_TOTAL_LAB_REPORT_SQL = `COALESCE(e.moisture,0) + ${E_TOTAL_REJECTION_SQL}`;


// ─── Helper: compute net_payable (JS, used nowhere currently but kept) ──────
function computeNetPayable({
  bill_weight, bill_rate, our_weight,
  moisture, duplex, plastic, pin,
  raining_water, dust, millboard, extra,
  superseded_rate, superseded_rejection,
}) {
  const bw = parseFloat(bill_weight) || 0;
  const br = parseFloat(bill_rate) || 0;
  const ow = parseFloat(our_weight) || bw;

  const totalLabReport =
    (parseFloat(moisture) || 0) +
    (parseFloat(duplex) || 0) +
    (parseFloat(plastic) || 0) +
    (parseFloat(pin) || 0) +
    (parseFloat(raining_water) || 0) +
    (parseFloat(dust) || 0) +
    (parseFloat(millboard) || 0) +
    (parseFloat(extra) || 0);

  const effectiveRate = superseded_rate != null ? parseFloat(superseded_rate) : br;
  const effectiveLab = superseded_rejection != null ? parseFloat(superseded_rejection) : totalLabReport;

  const vat = bw * br * 0.13;
  const labDeduction = bw * effectiveRate * effectiveLab / 100;
  const netPayable = (bw - ow) * effectiveRate + vat - labDeduction;

  return parseFloat(netPayable.toFixed(2));
}

// ─── NET PAYABLE SQL block (no table prefix) ────────────────────────────────
c// ─── NET PAYABLE SQL block (no table prefix) ────────────────────────────────
const NET_PAYABLE_SQL = `
  (bill_weight - COALESCE(our_weight, bill_weight))
  * COALESCE(superseded_rate, bill_rate)
  + (bill_weight * bill_rate * 0.13)
  - (bill_weight
     * COALESCE(superseded_rate, bill_rate)
     * COALESCE(superseded_rejection, ${TOTAL_LAB_REPORT_SQL})
     / 100)
`;

const E_NET_PAYABLE_SQL = `
  (e.bill_weight - COALESCE(e.our_weight, e.bill_weight))
  * COALESCE(e.superseded_rate, e.bill_rate)
  + (e.bill_weight * e.bill_rate * 0.13)
  - (e.bill_weight
     * COALESCE(e.superseded_rate, e.bill_rate)
     * COALESCE(e.superseded_rejection, ${E_TOTAL_LAB_REPORT_SQL})
     / 100)
`;

// ─── GET all entries (daily view) ──────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        ${TOTAL_REJECTION_SQL} AS total_rejection,
        ${TOTAL_LAB_REPORT_SQL} AS total_lab_report,
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
        SUM(e.bill_weight * COALESCE(e.superseded_rate, e.bill_rate) * COALESCE(e.superseded_rejection, ${E_TOTAL_LAB_REPORT_SQL}) / 100) AS deduction,
        SUM(e.bill_weight - COALESCE(e.our_weight, e.bill_weight)) AS weight_loss,
        SUM(CASE WHEN e.superseded_rate IS NOT NULL THEN e.superseded_rate - e.bill_rate ELSE 0 END) AS rate_diff,
        SUM(${E_TOTAL_REJECTION_SQL}) AS rejection_rate,
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
router.get('/party-sheet/:partyName', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, source AS party_name, grn,
        bill_weight, our_weight, bill_rate,
        superseded_rate, superseded_rejection,
        freight, scrap_tax_hetauda, scrap_tax_simra, scrap_tax_birgunj, other_expenses,
        (scrap_tax_hetauda + scrap_tax_simra + scrap_tax_birgunj + other_expenses + freight) AS total_expenses,
        CASE
          WHEN bill_weight > 0 THEN
            (scrap_tax_hetauda + scrap_tax_simra + scrap_tax_birgunj + other_expenses + freight) / bill_weight
          ELSE 0
        END AS per_kg_cost,
        ${TOTAL_REJECTION_SQL} AS total_rejection,
        ${TOTAL_LAB_REPORT_SQL} AS total_lab_report,
        ${NET_PAYABLE_SQL} AS net_payable
      FROM scrap_entries
      WHERE source = $1
      ORDER BY unloading_date_ad DESC, id DESC
    `, [decodeURIComponent(req.params.partyName)]);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /scrap/party-sheet error:', err);
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

// ─── GET cleared accounts ───────────────────────────────────────────────────
router.get('/cleared', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM scrap_cleared_accounts ORDER BY cleared_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST clear a party account ─────────────────────────────────────────────
router.post('/clear-party', async (req, res) => {
  const { party_name, cleared_amount, note, entry_ids } = req.body;
  if (!party_name) return res.status(400).json({ error: 'party_name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO scrap_cleared_accounts (party_name, cleared_amount, note, entry_ids)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [party_name, cleared_amount || 0, note || null, entry_ids || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST unclear a party account ───────────────────────────────────────────
router.post('/unclear-party', async (req, res) => {
  const { cleared_id } = req.body;
  try {
    await pool.query('DELETE FROM scrap_cleared_accounts WHERE id = $1', [cleared_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST tally data (persist xlsx upload) ──────────────────────────────────
router.post('/tally', async (req, res) => {
  // req.body is a map of { partyName: { opening, debit, credit, closing } }
  // Store in memory/session or a tally table — for now just acknowledge
  res.json({ success: true, received: Object.keys(req.body).length });
});

// ─── GET single entry ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *,
        ${TOTAL_REJECTION_SQL} AS total_rejection,
        ${TOTAL_LAB_REPORT_SQL} AS total_lab_report,
        ${NET_PAYABLE_SQL} AS net_payable
      FROM scrap_entries WHERE id = $1`,
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
    rejection,
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
        moisture, rejection, duplex, plastic, pin, raining_water, dust, millboard, extra,
        scrap_tax_birgunj, scrap_tax_simra, scrap_tax_hetauda,
        other_expenses, freight
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24
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
        rejection != null
          ? rejection
          : ((parseFloat(duplex) || 0) +
              (parseFloat(plastic) || 0) +
              (parseFloat(pin) || 0) +
              (parseFloat(raining_water) || 0) +
              (parseFloat(dust) || 0) +
              (parseFloat(millboard) || 0) +
              (parseFloat(extra) || 0)),
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
    rejection,
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
        moisture = $11, rejection = $12, duplex = $13, plastic = $14, pin = $15,
        raining_water = $16, dust = $17, millboard = $18, extra = $19,
        scrap_tax_birgunj = $20, scrap_tax_simra = $21, scrap_tax_hetauda = $22,
        other_expenses = $23, freight = $24
      WHERE id = $25
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
        rejection != null
          ? rejection
          : ((parseFloat(duplex) || 0) +
              (parseFloat(plastic) || 0) +
              (parseFloat(pin) || 0) +
              (parseFloat(raining_water) || 0) +
              (parseFloat(dust) || 0) +
              (parseFloat(millboard) || 0) +
              (parseFloat(extra) || 0)),
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
