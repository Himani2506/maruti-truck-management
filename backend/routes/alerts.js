const express = require("express");
const router  = express.Router();
const { pool } = require("../db/setup");

// GET /api/alerts — all alerts, newest first, with optional filters
router.get("/", async (req, res) => {
  try {
    const { severity, truck_id, is_read, limit = 100 } = req.query;
    const conditions = []; const values = []; let idx = 1;

    if (severity)  { conditions.push(`a.severity  = $${idx++}`); values.push(severity); }
    if (truck_id)  { conditions.push(`a.truck_id  = $${idx++}`); values.push(truck_id); }
    if (is_read !== undefined && is_read !== "") {
      conditions.push(`a.is_read = $${idx++}`);
      values.push(is_read === "true");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(parseInt(limit));

    const result = await pool.query(`
      SELECT a.*,
        t.start_date, t.end_date, t.source_id,
        tr.truck_number,
        s.name AS source_name,
        c.name AS customer_name
      FROM alerts a
      LEFT JOIN trips    t  ON a.trip_id  = t.id
      LEFT JOIN trucks   tr ON a.truck_id = tr.id
      LEFT JOIN sources  s  ON t.source_id  = s.id
      LEFT JOIN customers c ON t.customer_id = c.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${idx}
    `, values);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/unread-count — for the bell badge
router.get("/unread-count", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE severity = 'critical' AND is_read = false) AS critical,
        COUNT(*) FILTER (WHERE severity = 'warning'  AND is_read = false) AS warning,
        COUNT(*) FILTER (WHERE severity = 'info'     AND is_read = false) AS info,
        COUNT(*) FILTER (WHERE is_read = false)                           AS total
      FROM alerts
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id/read — mark one alert as read
router.patch("/:id/read", async (req, res) => {
  try {
    const { reviewed_by } = req.body;
    const result = await pool.query(`
      UPDATE alerts
      SET is_read = true, reviewed_by = $1, reviewed_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [reviewed_by || "supervisor", req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/read-all — mark all as read
router.patch("/read-all", async (req, res) => {
  try {
    const { severity } = req.body;
    let query = `UPDATE alerts SET is_read = true, reviewed_at = NOW() WHERE is_read = false`;
    const values = [];
    if (severity) { query += ` AND severity = $1`; values.push(severity); }
    await pool.query(query, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;