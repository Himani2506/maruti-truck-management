const express = require('express');
const router = express.Router();
const { pool } = require('../db/setup');

// GET all trucks
router.get('/trucks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trucks ORDER BY truck_number');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all sources
router.get('/sources', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sources ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all customers
router.get('/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create customer
router.post('/customers', async (req, res) => {
  try {
    const { name, destination_address, freight_actual } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });

    const existing = await pool.query(
      'SELECT id FROM customers WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: "Customer with this name already exists" });

    const result = await pool.query(
      `INSERT INTO customers (name, destination_address, freight_actual)
       VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), destination_address?.trim() || null, parseFloat(freight_actual) || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all backloads
router.get('/backloads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM backloads ORDER BY description');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create backload supplier
router.post('/backloads', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: "Description is required" });

    const existing = await pool.query(
      'SELECT id FROM backloads WHERE LOWER(description) = LOWER($1)',
      [description.trim()]
    );
    if (existing.rows.length)
      return res.status(409).json({ error: "Supplier already exists" });

    const result = await pool.query(
      `INSERT INTO backloads (description) VALUES ($1) RETURNING *`,
      [description.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE driver name for a truck
router.patch('/trucks/:id', async (req, res) => {
  const { driver_name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE trucks SET driver_name = $1 WHERE id = $2 RETURNING *',
      [driver_name, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE customer destination (for the 6 blanks)
router.patch('/customers/:id', async (req, res) => {
  const { destination_address, destination_lat, destination_lng } = req.body;
  try {
    const result = await pool.query(
      `UPDATE customers 
       SET destination_address = $1, destination_lat = $2, destination_lng = $3 
       WHERE id = $4 RETURNING *`,
      [destination_address, destination_lat, destination_lng, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/customers/rates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.destination_address,
        c.freight_actual, c.avg_rate_multiplier,
        c.rate_trip_count, c.last_rate_updated,
        c.avg_rate_per_piece, c.piece_trip_count,
        ROUND(c.freight_actual * COALESCE(c.avg_rate_multiplier, 1.3), 2) AS avg_freight_charged
      FROM customers c
      WHERE c.freight_actual IS NOT NULL
      ORDER BY c.rate_trip_count DESC NULLS LAST, c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const obj = {};
    result.rows.forEach(r => { obj[r.key] = parseFloat(r.value); });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  const { diesel_rate, fooding_rate, bhatta_rate, freight_multiplier } = req.body;
  try {
    const updates = { diesel_rate, fooding_rate, bhatta_rate, freight_multiplier };
    for (const [key, value] of Object.entries(updates)) {
      if (value != null) {
        await pool.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2`,
          [key, value]
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
