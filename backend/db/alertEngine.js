/**
 * Maruti Alert Engine
 * Runs after every trip POST or PATCH.
 * Writes rows to the `alerts` table.
 */

const CASH_DEVIATION_THRESHOLD = 0.40; // 40% above route avg → critical
const DURATION_MULTIPLIER      = 2.0;  // 2x route avg days → warning
const DIESEL_NEG_STREAK        = 3;    // 3 consecutive over-usage → critical
const ROKHAR_STREAK            = 3;    // 3 consecutive maintenance_rokhar → warning
const ENTRY_DELAY_DAYS         = 5;    // entered 5+ days after end_date → warning
const IDLE_DAYS_THRESHOLD      = 5;    // truck idle 5+ days → info

async function runAlerts(pool, tripId) {
  try {
    // Load the just-saved trip with joins
    const { rows } = await pool.query(`
      SELECT t.*,
        tr.truck_number, tr.driver_name,
        s.name  AS source_name,
        c.name  AS customer_name
      FROM trips t
      LEFT JOIN trucks    tr ON t.truck_id   = tr.id
      LEFT JOIN sources   s  ON t.source_id  = s.id
      LEFT JOIN customers c  ON t.customer_id = c.id
      WHERE t.id = $1
    `, [tripId]);

    if (!rows.length) return;
    const trip = rows[0];

    const alerts = [];

    // ── helpers ────────────────────────────────────────────────
    const add = (severity, type, message) =>
      alerts.push({ trip_id: tripId, truck_id: trip.truck_id,
        driver_name: trip.driver_name, severity, type, message });

    // ── 1. OVERLAPPING DATES — same driver, another active trip ─
    if (trip.start_date) {
      const overlap = await pool.query(`
        SELECT id, start_date, end_date FROM trips
        WHERE truck_id = $1
          AND id != $2
          AND start_date <= $3
          AND (end_date >= $4 OR end_date IS NULL)
      `, [trip.truck_id, tripId, trip.end_date || trip.start_date, trip.start_date]);

      if (overlap.rows.length > 0) {
        add('critical', 'overlapping_dates',
          `Driver ${trip.driver_name} (${trip.truck_number}) has overlapping trip dates with Trip #${overlap.rows[0].id}. Possible double entry or fraud.`);
      }
    }

    // ── 2. CASH EXPENSE vs ROUTE AVERAGE ───────────────────────
    if (trip.total_cash_expense && trip.source_id && trip.customer_id) {
      const routeAvg = await pool.query(`
        SELECT AVG(total_cash_expense) AS avg_cash,
               COUNT(*)               AS trip_count
        FROM trips
        WHERE source_id   = $1
          AND customer_id = $2
          AND id          != $3
          AND total_cash_expense IS NOT NULL
          AND total_cash_expense > 0
      `, [trip.source_id, trip.customer_id, tripId]);

      const avg   = parseFloat(routeAvg.rows[0].avg_cash);
      const count = parseInt(routeAvg.rows[0].trip_count);

      if (count >= 3 && avg > 0) {
        const pct = (trip.total_cash_expense - avg) / avg;
        if (pct > CASH_DEVIATION_THRESHOLD) {
          add('critical', 'cash_expense_high',
            `Trip #${tripId} cash expense NPR ${Math.round(trip.total_cash_expense).toLocaleString()} is ${Math.round(pct * 100)}% above route average (NPR ${Math.round(avg).toLocaleString()}) for ${trip.source_name} → ${trip.customer_name}. Driver: ${trip.driver_name}.`);
        }
      }
    }

    // ── 3. TRIP DURATION vs ROUTE AVERAGE ──────────────────────
    if (trip.num_days && trip.source_id && trip.customer_id) {
      const durationAvg = await pool.query(`
        SELECT AVG(num_days) AS avg_days, COUNT(*) AS trip_count
        FROM trips
        WHERE source_id   = $1
          AND customer_id = $2
          AND id          != $3
          AND num_days    IS NOT NULL
          AND num_days     > 0
      `, [trip.source_id, trip.customer_id, tripId]);

      const avgDays = parseFloat(durationAvg.rows[0].avg_days);
      const count   = parseInt(durationAvg.rows[0].trip_count);

      if (count >= 3 && avgDays > 0 && trip.num_days > avgDays * DURATION_MULTIPLIER) {
        add('warning', 'duration_high',
          `Trip #${tripId} lasted ${trip.num_days} days on ${trip.source_name} → ${trip.customer_name} (route avg: ${avgDays.toFixed(1)} days). Inflated fooding likely. Driver: ${trip.driver_name}.`);
      }
    }

    // ── 4. DIESEL DEVIATION STREAK (consecutive over-usage) ────
    if (trip.truck_id) {
      const recent = await pool.query(`
        SELECT diesel_deviation FROM trips
        WHERE truck_id        = $1
          AND id             != $2
          AND diesel_deviation IS NOT NULL
        ORDER BY start_date DESC, id DESC
        LIMIT $3
      `, [trip.truck_id, tripId, DIESEL_NEG_STREAK - 1]);

      const prevNeg = recent.rows.every(r => parseFloat(r.diesel_deviation) < 0);
      const thisNeg = trip.diesel_deviation != null && parseFloat(trip.diesel_deviation) < 0;

      if (thisNeg && recent.rows.length >= DIESEL_NEG_STREAK - 1 && prevNeg) {
        add('critical', 'diesel_streak',
          `Driver ${trip.driver_name} (${trip.truck_number}) has used MORE diesel than needed for ${DIESEL_NEG_STREAK} consecutive trips. Possible siphoning pattern.`);
      }
    }

    // ── 5. MAINTENANCE ROKHAR STREAK ───────────────────────────
    if (trip.maintenance_rokhar && parseFloat(trip.maintenance_rokhar) > 0 && trip.truck_id) {
      const recent = await pool.query(`
        SELECT maintenance_rokhar FROM trips
        WHERE truck_id = $1
          AND id      != $2
        ORDER BY start_date DESC, id DESC
        LIMIT $3
      `, [trip.truck_id, tripId, ROKHAR_STREAK - 1]);

      const allHaveRokhar = recent.rows.length >= ROKHAR_STREAK - 1 &&
        recent.rows.every(r => parseFloat(r.maintenance_rokhar) > 0);

      if (allHaveRokhar) {
        add('warning', 'rokhar_streak',
          `Truck ${trip.truck_number} (Driver: ${trip.driver_name}) has claimed unplanned maintenance (Cashbook) on ${ROKHAR_STREAK} consecutive trips. Verify receipts.`);
      }
    }

    // ── 6. ENTRY DELAY ─────────────────────────────────────────
    if (trip.end_date && trip.created_at) {
      const endDate     = new Date(trip.end_date);
      const createdAt   = new Date(trip.created_at);
      const delayDays   = Math.floor((createdAt - endDate) / (1000 * 60 * 60 * 24));
      if (delayDays >= ENTRY_DELAY_DAYS) {
        add('warning', 'entry_delay',
          `Trip #${tripId} (${trip.truck_number}, ${trip.driver_name}) was entered ${delayDays} days after trip end date. Late entries should be reviewed.`);
      }
    }

    // ── 7. BHATTA WITH NO DATES ────────────────────────────────
    if (trip.trip_bhatta && parseFloat(trip.trip_bhatta) > 0 && !trip.start_date) {
      add('warning', 'bhatta_no_date',
        `Trip #${tripId} claims bhatta but has no start date logged. Driver: ${trip.driver_name}.`);
    }

    // ── 8. DUPLICATE BILL NUMBER (police/road tax proxy via mpp_bill_no) ──
    // Flag duplicate MPP bill numbers across trips
    if (trip.mpp_bill_no) {
      const dupBill = await pool.query(`
        SELECT id FROM trips
        WHERE mpp_bill_no = $1
          AND id         != $2
        LIMIT 1
      `, [trip.mpp_bill_no, tripId]);

      if (dupBill.rows.length > 0) {
        add('critical', 'duplicate_bill',
          `MPP Bill No. "${trip.mpp_bill_no}" on Trip #${tripId} already exists on Trip #${dupBill.rows[0].id}. Possible duplicate or reused receipt. Driver: ${trip.driver_name}.`);
      }
    }

    // ── 9. TRUCK IDLE DAYS ─────────────────────────────────────
    if (trip.truck_id && trip.start_date) {
      const lastTrip = await pool.query(`
        SELECT end_date FROM trips
        WHERE truck_id = $1
          AND id      != $2
          AND end_date IS NOT NULL
        ORDER BY end_date DESC
        LIMIT 1
      `, [trip.truck_id, tripId]);

      if (lastTrip.rows.length) {
        const lastEnd  = new Date(lastTrip.rows[0].end_date);
        const thisStart = new Date(trip.start_date);
        const idleDays  = Math.floor((thisStart - lastEnd) / (1000 * 60 * 60 * 24));
        if (idleDays >= IDLE_DAYS_THRESHOLD) {
          add('info', 'truck_idle',
            `Truck ${trip.truck_number} was idle for ${idleDays} days before Trip #${tripId}. Previous trip ended ${lastTrip.rows[0].end_date}.`);
        }
      }
    }

    // ── 10. NEW EXPENSE HEAD (first time a driver claims something) ─
    const expenseHeads = [
      { field: 'police_tax',    label: 'Police Tax'    },
      { field: 'phone_expense', label: 'Phone Expense' },
      { field: 'grease_expense',label: 'Grease'        },
      { field: 'tyre_expense',  label: 'Tyre'          },
    ];

    for (const { field, label } of expenseHeads) {
      if (trip[field] && parseFloat(trip[field]) > 0) {
        const prev = await pool.query(`
          SELECT id FROM trips
          WHERE truck_id = $1
            AND id      != $2
            AND ${field} > 0
          LIMIT 1
        `, [trip.truck_id, tripId]);

        if (prev.rows.length === 0) {
          add('info', 'new_expense_head',
            `Driver ${trip.driver_name} (${trip.truck_number}) claimed "${label}" for the first time on Trip #${tripId}. NPR ${parseFloat(trip[field]).toLocaleString()}.`);
        }
      }
    }

    // ── Write all alerts ────────────────────────────────────────
    if (alerts.length === 0) return;

    for (const a of alerts) {
      await pool.query(`
        INSERT INTO alerts (trip_id, truck_id, driver_name, severity, type, message)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [a.trip_id, a.truck_id, a.driver_name, a.severity, a.type, a.message]);
    }

    console.log(`[AlertEngine] Trip #${tripId} → ${alerts.length} alert(s) generated.`);
  } catch (err) {
    // Never crash the main trip save because of alert failure
    console.error('[AlertEngine] Error:', err.message);
  }
}
async function updateCustomerRate(pool, tripId) {
  try {
    const { rows } = await pool.query(`
      SELECT t.customer_id, t.freight_amount, c.freight_actual, c.name
      FROM trips t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.id = $1
        AND t.freight_amount IS NOT NULL
        AND t.freight_amount > 0
        AND c.freight_actual IS NOT NULL
        AND c.freight_actual > 0
    `, [tripId]);

    if (!rows.length) return;
    const { customer_id, freight_amount, freight_actual, name } = rows[0];

    const thisMultiplier = parseFloat(freight_amount) / parseFloat(freight_actual);

    // Recalculate avg from all trips for this customer
    const allRates = await pool.query(`
      SELECT freight_amount, c.freight_actual
      FROM trips t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.customer_id = $1
        AND t.freight_amount IS NOT NULL AND t.freight_amount > 0
        AND c.freight_actual IS NOT NULL AND c.freight_actual > 0
    `, [customer_id]);

    const multipliers = allRates.rows.map(r =>
      parseFloat(r.freight_amount) / parseFloat(r.freight_actual)
    );
    const avg = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;

    await pool.query(`
      UPDATE customers
      SET avg_rate_multiplier = $1,
          rate_trip_count     = $2,
          last_rate_updated   = NOW()
      WHERE id = $3
    `, [parseFloat(avg.toFixed(4)), multipliers.length, customer_id]);

    console.log(`[RateEngine] ${name} → avg multiplier: ${avg.toFixed(3)}x (${multipliers.length} trips)`);
  } catch (err) {
    console.error('[RateEngine] Error:', err.message);
  }
}

async function updateCustomerRatePerPiece(pool, tripId) {
  try {
    // Primary customer
    const { rows } = await pool.query(`
      SELECT t.customer_id, t.freight_amount, t.pieces, c.name
      FROM trips t JOIN customers c ON t.customer_id = c.id
      WHERE t.id = $1 AND t.pieces > 0 AND t.freight_amount > 0
    `, [tripId]);

    const toUpdate = [...rows];

    // Extra customers
    const extras = await pool.query(`
      SELECT tc.customer_id, tc.freight_amount, tc.pieces, c.name
      FROM trip_customers tc JOIN customers c ON tc.customer_id = c.id
      WHERE tc.trip_id = $1 AND tc.pieces > 0 AND tc.freight_amount > 0
    `, [tripId]);

    toUpdate.push(...extras.rows);

    for (const r of toUpdate) {
      const allTrips = await pool.query(`
        SELECT t.freight_amount, t.pieces
        FROM trips t
        WHERE t.customer_id = $1 AND t.pieces > 0 AND t.freight_amount > 0
        UNION ALL
        SELECT tc.freight_amount, tc.pieces
        FROM trip_customers tc
        WHERE tc.customer_id = $1 AND tc.pieces > 0 AND tc.freight_amount > 0
      `, [r.customer_id]);

      if (!allTrips.rows.length) continue;

      const rates = allTrips.rows.map(x =>
        parseFloat(x.freight_amount) / parseFloat(x.pieces)
      );
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;

      await pool.query(`
        UPDATE customers
        SET avg_rate_per_piece = $1,
            piece_trip_count   = $2,
            last_rate_updated  = NOW()
        WHERE id = $3
      `, [parseFloat(avg.toFixed(2)), rates.length, r.customer_id]);

      console.log(`[PieceRate] ${r.name} → NPR ${avg.toFixed(2)}/piece (${rates.length} trips)`);
    }
  } catch (err) {
    console.error('[PieceRate] Error:', err.message);
  }
}
module.exports = { runAlerts, updateCustomerRate, updateCustomerRatePerPiece };