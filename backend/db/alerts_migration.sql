-- ============================================================
-- MARUTI ALERTS TABLE MIGRATION
-- Run this once against your PostgreSQL database
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
  id          SERIAL PRIMARY KEY,
  trip_id     INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  truck_id    INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
  driver_name VARCHAR(100),
  severity    VARCHAR(10) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  type        VARCHAR(50) NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_trip_id   ON alerts(trip_id);
CREATE INDEX IF NOT EXISTS idx_alerts_truck_id  ON alerts(truck_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read   ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created   ON alerts(created_at DESC);

-- Also add missing columns to trips table that the alert engine needs
ALTER TABLE trips ADD COLUMN IF NOT EXISTS police_tax      DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS phone_expense   DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS loading_amount  DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS unloading_amount DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_supplier_id INTEGER REFERENCES backloads(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_fooding DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_bhatta  DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_loading_amount   DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_unloading_amount DECIMAL(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_freight_amount   DECIMAL(10,2);