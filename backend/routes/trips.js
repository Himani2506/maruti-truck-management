const express = require("express");
const router = express.Router();
const { pool } = require("../db/setup");
const ExcelJS = require("exceljs");
require("dotenv").config();

const FOODING_RATE = parseInt(process.env.FOODING_RATE) || 1000;
const BHATTA_RATE = parseInt(process.env.BHATTA_RATE) || 1500;
const DIESEL_PRICE = parseFloat(process.env.DIESEL_PRICE) || 222.5;

function calcTotals(fields) {
  const {
    diesel_cost, fooding, trip_bhatta,
    loading_amount, unloading_amount,
    maintenance_hisab_phanna, maintenance_rokhar,
    grease_expense, road_tax, scrap_tax, tyre_expense,
  } = fields;

  const total_expenses =
    (parseFloat(diesel_cost) || 0) +
    (parseFloat(fooding) || 0) +
    (parseFloat(trip_bhatta) || 0) +
    (parseFloat(loading_amount) || 0) +
    (parseFloat(unloading_amount) || 0) +
    (parseFloat(maintenance_hisab_phanna) || 0) +
    (parseFloat(maintenance_rokhar) || 0) +
    (parseFloat(grease_expense) || 0) +
    (parseFloat(road_tax) || 0) +
    (parseFloat(scrap_tax) || 0) +
    (parseFloat(tyre_expense) || 0);

  const total_cash_expense = total_expenses - ((parseFloat(diesel_cost) || 0) + (parseFloat(maintenance_rokhar) || 0));
  return { total_expenses, total_cash_expense };
}

// GET all trips
router.get("/", async (req, res) => {
  try {
    const { truck_id, customer_id, source_id, status, from_date, to_date } = req.query;
    const conditions = []; const values = []; let idx = 1;
    if (truck_id)    { conditions.push(`t.truck_id    = $${idx++}`); values.push(truck_id); }
    if (customer_id) { conditions.push(`t.customer_id = $${idx++}`); values.push(customer_id); }
    if (source_id)   { conditions.push(`t.source_id   = $${idx++}`); values.push(source_id); }
    if (status)      { conditions.push(`t.status      = $${idx++}`); values.push(status); }
    if (from_date)   { conditions.push(`t.start_date >= $${idx++}`); values.push(from_date); }
    if (to_date)     { conditions.push(`t.start_date <= $${idx++}`); values.push(to_date); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT t.*,
        tr.truck_number, tr.driver_name, tr.avg_kmpl AS truck_avg_kmpl,
        s.name  AS source_name,
        c.name  AS customer_name, c.destination_address,
        b.description AS backload_description
      FROM trips t
      LEFT JOIN trucks    tr ON t.truck_id    = tr.id
      LEFT JOIN sources   s  ON t.source_id   = s.id
      LEFT JOIN customers c  ON t.customer_id = c.id
      LEFT JOIN backloads b  ON t.backload_supplier_id = b.id
      ${where}
      ORDER BY t.start_date DESC, t.id DESC
    `, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single trip
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, tr.truck_number, tr.driver_name, tr.avg_kmpl AS truck_avg_kmpl,
             s.name AS source_name,
             c.name AS customer_name, c.destination_address,
             b.description AS backload_description
      FROM trips t
      LEFT JOIN trucks    tr ON t.truck_id    = tr.id
      LEFT JOIN sources   s  ON t.source_id   = s.id
      LEFT JOIN customers c  ON t.customer_id = c.id
      LEFT JOIN backloads b  ON t.backload_supplier_id = b.id
      WHERE t.id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Trip not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create trip
router.post("/", async (req, res) => {
  try {
    const {
      truck_id, source_id, customer_id,
      start_date, end_date, mpp_bill_no,
      meter_start, meter_end,
      diesel_used,
      loading_amount, unloading_amount,
      maintenance_hisab_phanna, maintenance_rokhar,
      grease_expense, road_tax, scrap_tax, tyre_expense,
      freight_amount, backload_freight_amount,
      backload_supplier_id, backload_bill_no, backload_weight_kg,
      backload_loading_amount, backload_unloading_amount,
      remarks,
    } = req.body;

    const ms_val = parseFloat(meter_start) || null;
    const me_val = parseFloat(meter_end) || null;
    const distance_km = ms_val && me_val && me_val > ms_val
      ? parseFloat((me_val - ms_val).toFixed(2)) : null;

    let truck_avg = null;
    if (truck_id) {
      const tr = await pool.query("SELECT avg_kmpl FROM trucks WHERE id=$1", [truck_id]);
      if (tr.rows.length) truck_avg = parseFloat(tr.rows[0].avg_kmpl) || null;
    }
    const diesel_needed = distance_km && truck_avg
      ? parseFloat((distance_km / truck_avg).toFixed(2)) : null;

    const diesel_cost = diesel_used
      ? parseFloat((parseFloat(diesel_used) * DIESEL_PRICE).toFixed(2)) : null;

    let num_days = null, fooding = null, trip_bhatta = null;
    if (start_date && end_date) {
      const ms = new Date(end_date) - new Date(start_date);
      num_days = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
      fooding = num_days * FOODING_RATE;
      trip_bhatta = BHATTA_RATE;
    }

    const { total_expenses, total_cash_expense } = calcTotals({
      diesel_cost, fooding, trip_bhatta,
      loading_amount, unloading_amount,
      maintenance_hisab_phanna, maintenance_rokhar,
      grease_expense, road_tax, scrap_tax, tyre_expense,
    });

    const totalFreight = (parseFloat(freight_amount) || 0) + (parseFloat(backload_freight_amount) || 0);
    const surplus = freight_amount
      ? parseFloat((totalFreight - total_expenses).toFixed(2)) : null;

    const status = end_date ? "completed" : "open";
    const loading_unloading = (parseFloat(loading_amount) || 0) + (parseFloat(unloading_amount) || 0) || null;

    const result = await pool.query(`
      INSERT INTO trips (
        truck_id, source_id, customer_id,
        start_date, end_date, mpp_bill_no,
        meter_start, meter_end, distance_km,
        diesel_needed, diesel_used, diesel_cost,
        num_days, fooding, trip_bhatta,
        loading_unloading, loading_amount, unloading_amount,
        maintenance_hisab_phanna, maintenance_rokhar,
        grease_expense, road_tax, scrap_tax, tyre_expense,
        freight_amount, backload_freight_amount,
        total_expenses, total_cash_expense, surplus,
        backload_supplier_id, backload_bill_no, backload_weight_kg,
        backload_loading_amount, backload_unloading_amount,
        status, remarks
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36
      ) RETURNING *`,
      [
        truck_id, source_id, customer_id,
        start_date, end_date || null, mpp_bill_no || null,
        ms_val, me_val, distance_km,
        diesel_needed, diesel_used || null, diesel_cost,
        num_days, fooding, trip_bhatta,
        loading_unloading,
        parseFloat(loading_amount) || null,
        parseFloat(unloading_amount) || null,
        parseFloat(maintenance_hisab_phanna) || null,
        parseFloat(maintenance_rokhar) || null,
        parseFloat(grease_expense) || null,
        parseFloat(road_tax) || null,
        parseFloat(scrap_tax) || null,
        parseFloat(tyre_expense) || null,
        freight_amount || null,
        backload_freight_amount || null,
        total_expenses, total_cash_expense, surplus,
        backload_supplier_id || null,
        backload_bill_no || null,
        parseFloat(backload_weight_kg) || null,
        parseFloat(backload_loading_amount) || null,
        parseFloat(backload_unloading_amount) || null,
        status, remarks || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update trip
router.patch("/:id", async (req, res) => {
  try {
    const ex = await pool.query("SELECT * FROM trips WHERE id=$1", [req.params.id]);
    if (!ex.rows.length) return res.status(404).json({ error: "Trip not found" });

    const trip = ex.rows[0];
    const u = { ...trip, ...req.body };

    const ms_val = parseFloat(u.meter_start) || null;
    const me_val = parseFloat(u.meter_end) || null;
    const distance_km = ms_val && me_val && me_val > ms_val
      ? parseFloat((me_val - ms_val).toFixed(2)) : trip.distance_km;

    let truck_avg = null;
    if (u.truck_id) {
      const tr = await pool.query("SELECT avg_kmpl FROM trucks WHERE id=$1", [u.truck_id]);
      if (tr.rows.length) truck_avg = parseFloat(tr.rows[0].avg_kmpl) || null;
    }
    const diesel_needed = distance_km && truck_avg
      ? parseFloat((distance_km / truck_avg).toFixed(2)) : u.diesel_needed;

    const diesel_cost = u.diesel_used
      ? parseFloat((parseFloat(u.diesel_used) * DIESEL_PRICE).toFixed(2)) : null;

    let num_days = trip.num_days, fooding = trip.fooding, trip_bhatta = trip.trip_bhatta;
    if (u.start_date && u.end_date) {
      const ms = new Date(u.end_date) - new Date(u.start_date);
      num_days = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
      fooding = num_days * FOODING_RATE;
      trip_bhatta = BHATTA_RATE;
    }

    const { total_expenses, total_cash_expense } = calcTotals({
      diesel_cost, fooding, trip_bhatta,
      loading_amount:           u.loading_amount,
      unloading_amount:         u.unloading_amount,
      maintenance_hisab_phanna: u.maintenance_hisab_phanna,
      maintenance_rokhar:       u.maintenance_rokhar,
      grease_expense:           u.grease_expense,
      road_tax:                 u.road_tax,
      scrap_tax:                u.scrap_tax,
      tyre_expense:             u.tyre_expense,
    });

    const totalFreight = (parseFloat(u.freight_amount) || 0) + (parseFloat(u.backload_freight_amount) || 0);
    const surplus = u.freight_amount
      ? parseFloat((totalFreight - total_expenses).toFixed(2)) : null;

    const status = u.end_date ? "completed" : "open";
    const loading_unloading = (parseFloat(u.loading_amount) || 0) + (parseFloat(u.unloading_amount) || 0) || null;

    const result = await pool.query(`
      UPDATE trips SET
        end_date=$1, mpp_bill_no=$2,
        meter_start=$3, meter_end=$4, distance_km=$5,
        diesel_needed=$6, diesel_used=$7, diesel_cost=$8,
        num_days=$9, fooding=$10, trip_bhatta=$11,
        loading_unloading=$12, loading_amount=$13, unloading_amount=$14,
        maintenance_hisab_phanna=$15, maintenance_rokhar=$16,
        grease_expense=$17, road_tax=$18, scrap_tax=$19, tyre_expense=$20,
        freight_amount=$21, backload_freight_amount=$22,
        total_expenses=$23, total_cash_expense=$24, surplus=$25,
        backload_supplier_id=$26, backload_bill_no=$27, backload_weight_kg=$28,
        backload_loading_amount=$29, backload_unloading_amount=$30,
        is_return_filled=$31, status=$32, remarks=$33,
        updated_at=NOW()
      WHERE id=$34 RETURNING *`,
      [
        u.end_date || null, u.mpp_bill_no || null,
        ms_val, me_val, distance_km,
        diesel_needed, u.diesel_used || null, diesel_cost,
        num_days, fooding, trip_bhatta,
        loading_unloading,
        parseFloat(u.loading_amount) || null,
        parseFloat(u.unloading_amount) || null,
        parseFloat(u.maintenance_hisab_phanna) || null,
        parseFloat(u.maintenance_rokhar) || null,
        parseFloat(u.grease_expense) || null,
        parseFloat(u.road_tax) || null,
        parseFloat(u.scrap_tax) || null,
        parseFloat(u.tyre_expense) || null,
        u.freight_amount || null,
        u.backload_freight_amount || null,
        total_expenses, total_cash_expense, surplus,
        u.backload_supplier_id || null,
        u.backload_bill_no || null,
        parseFloat(u.backload_weight_kg) || null,
        parseFloat(u.backload_loading_amount) || null,
        parseFloat(u.backload_unloading_amount) || null,
        u.is_return_filled || false, status, u.remarks || null,
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH verify
router.patch("/:id/verify", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE trips SET status='verified', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET export to Excel
router.get("/export/excel", async (req, res) => {
  try {
    const { truck_id, customer_id, source_id, from_date, to_date } = req.query;
    const conditions = []; const values = []; let idx = 1;
    if (truck_id)    { conditions.push(`t.truck_id    = $${idx++}`); values.push(truck_id); }
    if (customer_id) { conditions.push(`t.customer_id = $${idx++}`); values.push(customer_id); }
    if (source_id)   { conditions.push(`t.source_id   = $${idx++}`); values.push(source_id); }
    if (from_date)   { conditions.push(`t.start_date >= $${idx++}`); values.push(from_date); }
    if (to_date)     { conditions.push(`t.start_date <= $${idx++}`); values.push(to_date); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT t.*, tr.truck_number, tr.driver_name,
             s.name AS source_name, c.name AS customer_name,
             c.destination_address, b.description AS backload_description
      FROM trips t
      LEFT JOIN trucks    tr ON t.truck_id    = tr.id
      LEFT JOIN sources   s  ON t.source_id   = s.id
      LEFT JOIN customers c  ON t.customer_id = c.id
      LEFT JOIN backloads b  ON t.backload_supplier_id = b.id
      ${where}
      ORDER BY tr.truck_number, t.start_date`, values);

    const wb = new ExcelJS.Workbook();

    const truckGroups = {};
    result.rows.forEach((row) => {
      const key = row.truck_number || "Unknown";
      if (!truckGroups[key]) truckGroups[key] = [];
      truckGroups[key].push(row);
    });

    const columns = [
      { header: "#",                  key: "id",                       width: 6  },
      { header: "Driver",             key: "driver_name",              width: 18 },
      { header: "Source",             key: "source_name",              width: 22 },
      { header: "Customer",           key: "customer_name",            width: 32 },
      { header: "Start",              key: "start_date",               width: 12 },
      { header: "End",                key: "end_date",                 width: 12 },
      { header: "Days",               key: "num_days",                 width: 6  },
      { header: "Meter Start",        key: "meter_start",              width: 11 },
      { header: "Meter End",          key: "meter_end",                width: 11 },
      { header: "KM",                 key: "distance_km",              width: 9  },
      { header: "D.Needed",           key: "diesel_needed",            width: 10 },
      { header: "D.Used",             key: "diesel_used",              width: 9  },
      { header: "D.Dev",              key: "diesel_deviation",         width: 9  },
      { header: "Diesel Cost",        key: "diesel_cost",              width: 12 },
      { header: "Fooding",            key: "fooding",                  width: 11 },
      { header: "Bhatta",             key: "trip_bhatta",              width: 10 },
      { header: "Loading",            key: "loading_amount",           width: 10 },
      { header: "Unloading",          key: "unloading_amount",         width: 11 },
      { header: "Maint. Hisab",       key: "maintenance_hisab_phanna", width: 13 },
      { header: "Maint. Rokhar",      key: "maintenance_rokhar",       width: 13 },
      { header: "Grease",             key: "grease_expense",           width: 10 },
      { header: "Road Tax",           key: "road_tax",                 width: 10 },
      { header: "Scrap Tax",          key: "scrap_tax",                width: 10 },
      { header: "Tyre",               key: "tyre_expense",             width: 10 },
      { header: "Total Expenses",     key: "total_expenses",           width: 14 },
      { header: "Cash Expense",       key: "total_cash_expense",       width: 14 },
      { header: "Outward Freight",    key: "freight_amount",           width: 14 },
      { header: "Backload Freight",   key: "backload_freight_amount",  width: 14 },
      { header: "Surplus",            key: "surplus",                  width: 12 },
      { header: "Backload Supplier",  key: "backload_description",     width: 28 },
      { header: "Backload Bill",      key: "backload_bill_no",         width: 13 },
      { header: "Backload Wt (KG)",   key: "backload_weight_kg",       width: 13 },
      { header: "BL Loading",         key: "backload_loading_amount",  width: 12 },
      { header: "BL Unloading",       key: "backload_unloading_amount",width: 12 },
      { header: "MPP Bill",           key: "mpp_bill_no",              width: 11 },
      { header: "Status",             key: "status",                   width: 11 },
      { header: "Remarks",            key: "remarks",                  width: 24 },
    ];

    Object.keys(truckGroups).sort().forEach((truckNumber) => {
      const ws = wb.addWorksheet(`Truck ${truckNumber}`);
      ws.columns = columns;

      const hr = ws.getRow(1);
      hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
      hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };

      truckGroups[truckNumber].forEach((row, i) => {
        const r = ws.addRow(row);
        if (i % 2 === 0) r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9F0FA" } };
        if (row.status === "open")     r.getCell("status").font = { color: { argb: "FFCC0000" } };
        if (row.status === "verified") r.getCell("status").font = { color: { argb: "FF006600" } };
        if (row.surplus < 0) r.getCell("surplus").font = { color: { argb: "FFCC0000" } };
      });

      const totalsRow = ws.addRow({
        id:                 "TOTAL",
        total_expenses:     truckGroups[truckNumber].reduce((s, r) => s + (parseFloat(r.total_expenses) || 0), 0),
        total_cash_expense: truckGroups[truckNumber].reduce((s, r) => s + (parseFloat(r.total_cash_expense) || 0), 0),
        freight_amount:     truckGroups[truckNumber].reduce((s, r) => s + (parseFloat(r.freight_amount) || 0), 0),
        backload_freight_amount: truckGroups[truckNumber].reduce((s, r) => s + (parseFloat(r.backload_freight_amount) || 0), 0),
        surplus:            truckGroups[truckNumber].reduce((s, r) => s + (parseFloat(r.surplus) || 0), 0),
        diesel_cost:        truckGroups[truckNumber].reduce((s, r) => s + (parseFloat(r.diesel_cost) || 0), 0),
      });
      totalsRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=maruti_trips.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;