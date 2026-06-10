const express = require('express');
const router = express.Router();
const { pool } = require('../db/setup');

// ─── Helper: compute net_payable ───────────────────────────────────────────
function computeNetPayable({ bill_weight, bill_rate, our_weight, moisture, rejection,
  superseded_rate, superseded_rejection }) {
  const bw = parseFloat(bill_weight) || 0;
  const br = parseFloat(bill_rate) || 0;
  const ow = parseFloat(our_weight) || 0;
  const mo = parseFloat(moisture) || 0;
  const rej = parseFloat(rejection) || 0;
  const sr = superseded_rate != null ? parseFloat(superseded_rate) : null;
  const srej = superseded_rejection != null ? parseFloat(superseded_rejection) : null;

  const shortage = bw - ow;
  const vat = bw * br * 0.13;
  const effectiveRate = sr !== null ? sr : br;

  const effectiveTotalLab = srej !== null ? srej : (mo + rej);


  const labDeductionRupees = bw * effectiveRate * effectiveTotalLab / 100;

  // net_payable = our_weight * effective_rate + vat - lab_deduction_in_rupees
  const netPayable = (bw - shortage) * effectiveRate + vat - labDeductionRupees;
  return parseFloat(netPayable.toFixed(2));
}

// ─── GET all entries (daily view) ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        -- net payable with overrides applied
        CASE
          WHEN superseded_rate IS NOT NULL OR superseded_rejection IS NOT NULL THEN
            (bill_weight - shortage) * COALESCE(superseded_rate, bill_rate)
            + (bill_weight * bill_rate * 0.13)
            - (bill_weight * bill_rate * COALESCE(superseded_rejection, moisture + rejection) / 100)
          ELSE
            (bill_weight - shortage) * bill_rate
            + (bill_weight * bill_rate * 0.13)
            - (bill_weight * bill_rate * (moisture + rejection) / 100)
        END AS net_payable,
        -- flag for override
        (superseded_rate IS NOT NULL OR superseded_rejection IS NOT NULL) AS is_overridden
      FROM scrap_entries
      ORDER BY unloading_date_ad DESC, id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /scrap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET party-wise summary (new full version) ─────────────────────────────
router.get('/party-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.source AS party_name,
        COALESCE(o.opening, 0) AS opening,
        -- 82-83 purchase = sum of net_payable
        SUM(
          CASE
            WHEN e.superseded_rate IS NOT NULL OR e.superseded_rejection IS NOT NULL THEN
              (e.bill_weight - e.shortage) * COALESCE(e.superseded_rate, e.bill_rate)
              + (e.bill_weight * e.bill_rate * 0.13)
              - (e.bill_weight * e.bill_rate * COALESCE(e.superseded_rejection, e.moisture + e.rejection) / 100)
            ELSE
              (e.bill_weight - e.shortage) * e.bill_rate
              + (e.bill_weight * e.bill_rate * 0.13)
              - (e.bill_weight * e.bill_rate * (e.moisture + e.rejection) / 100)
          END
        ) AS purchase_8283,
        -- deduction = sum of bill_weight * bill_rate * total_lab_report / 100
        SUM(e.bill_weight * e.bill_rate * (e.moisture + e.rejection) / 100) AS deduction,
        -- weight_loss = sum of shortage
        SUM(e.shortage) AS weight_loss,
        -- rate_diff = sum of (superseded_rate - bill_rate) for overridden entries only
        SUM(CASE WHEN e.superseded_rate IS NOT NULL THEN e.superseded_rate - e.bill_rate ELSE 0 END) AS rate_diff,
        -- rejection_rate = sum of rejection
        SUM(e.rejection) AS rejection_rate,
        -- superseded_rejection_rate = sum of superseded_rejection
        SUM(COALESCE(e.superseded_rejection, 0)) AS superseded_rejection_rate
      FROM scrap_entries e
      LEFT JOIN scrap_party_opening o ON o.party_name = e.source
      GROUP BY e.source, o.opening
      ORDER BY e.source
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /scrap/party-summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET party sheet (per-entry detail for one party) ──────────────────────
router.get('/party-sheet/:partyName', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, source AS party_name, grn, bill_weight, freight,
        scrap_tax_hetauda, scrap_tax_simra, scrap_tax_birgunj,
        other_expenses,
        (scrap_tax_hetauda + scrap_tax_simra + scrap_tax_birgunj + other_expenses + freight) AS total_expenses,
        CASE
          WHEN bill_weight > 0 THEN
            (scrap_tax_hetauda + scrap_tax_simra + scrap_tax_birgunj + other_expenses + freight) / bill_weight
          ELSE 0
        END AS per_kg_cost,
        CASE
          WHEN superseded_rate IS NOT NULL OR superseded_rejection IS NOT NULL THEN
            (bill_weight - shortage) * COALESCE(superseded_rate, bill_rate)
            + (bill_weight * bill_rate * 0.13)
            - (bill_weight * bill_rate * COALESCE(superseded_rejection, moisture + rejection) / 100)
          ELSE
            (bill_weight - shortage) * bill_rate
            + (bill_weight * bill_rate * 0.13)
            - (bill_weight * bill_rate * (moisture + rejection) / 100)
        END AS net_payable
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
router.get('/opening/:partyName', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM scrap_party_opening WHERE party_name = $1',
      [decodeURIComponent(req.params.partyName)]
    );
    res.json(result.rows[0] || { party_name: req.params.partyName, opening: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/opening/:partyName', async (req, res) => {
  const { opening } = req.body;
  const partyName = decodeURIComponent(req.params.partyName);
  try {
    const result = await pool.query(`
      INSERT INTO scrap_party_opening (party_name, opening)
      VALUES ($1, $2)
      ON CONFLICT (party_name) DO UPDATE SET opening = $2
      RETURNING *
    `, [partyName, opening]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single entry ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scrap_entries WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create entry ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    unloading_date_ad, unloading_date_bs,
    gen, grn,
    source, vehicle_no, party_bill_no,
    bill_weight, bill_rate,
    our_weight,
    moisture, rejection,
    scrap_tax_birgunj, scrap_tax_simra, scrap_tax_hetauda,
    other_expenses, freight
  } = req.body;

  // Basic validation
  if (!unloading_date_ad || !unloading_date_bs || !source) {
    return res.status(400).json({ error: 'unloading_date_ad, unloading_date_bs, and source are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO scrap_entries (
        unloading_date_ad, unloading_date_bs,
        gen, grn,
        source, vehicle_no, party_bill_no,
        bill_weight, bill_rate,
        our_weight,
        moisture, rejection,
        scrap_tax_birgunj, scrap_tax_simra, scrap_tax_hetauda,
        other_expenses, freight
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17
      ) RETURNING *
    `, [
      unloading_date_ad, unloading_date_bs,
      gen || null, grn || null,
      source, vehicle_no || null, party_bill_no || null,
      bill_weight || null, bill_rate || null,
      our_weight || null,
      moisture || null, rejection || null,
      scrap_tax_birgunj || 0, scrap_tax_simra || 0, scrap_tax_hetauda || 0,
      other_expenses || 0, freight || 0
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /scrap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT update admin overrides only ───────────────────────────────────────
router.put('/:id/override', async (req, res) => {
  const { superseded_rate, superseded_rejection } = req.body;
  try {
    const result = await pool.query(`
      UPDATE scrap_entries
      SET superseded_rate = $1, superseded_rejection = $2
      WHERE id = $3
      RETURNING *
    `, [
      superseded_rate !== undefined ? superseded_rate : null,
      superseded_rejection !== undefined ? superseded_rejection : null,
      req.params.id
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /scrap/:id/override error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT full update (edit entry) ──────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    unloading_date_ad, unloading_date_bs,
    gen, grn,
    source, vehicle_no, party_bill_no,
    bill_weight, bill_rate,
    our_weight,
    moisture, rejection,
    scrap_tax_birgunj, scrap_tax_simra, scrap_tax_hetauda,
    other_expenses, freight
  } = req.body;

  try {
    const result = await pool.query(`
      UPDATE scrap_entries SET
        unloading_date_ad = $1, unloading_date_bs = $2,
        gen = $3, grn = $4,
        source = $5, vehicle_no = $6, party_bill_no = $7,
        bill_weight = $8, bill_rate = $9,
        our_weight = $10,
        moisture = $11, rejection = $12,
        scrap_tax_birgunj = $13, scrap_tax_simra = $14, scrap_tax_hetauda = $15,
        other_expenses = $16, freight = $17
      WHERE id = $18
      RETURNING *
    `, [
      unloading_date_ad, unloading_date_bs,
      gen || null, grn || null,
      source, vehicle_no || null, party_bill_no || null,
      bill_weight || null, bill_rate || null,
      our_weight || null,
      moisture || null, rejection || null,
      scrap_tax_birgunj || 0, scrap_tax_simra || 0, scrap_tax_hetauda || 0,
      other_expenses || 0, freight || 0,
      req.params.id
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /scrap/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE entry ───────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM scrap_entries WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;