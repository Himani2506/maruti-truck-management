-- ============================================================
-- MARUTI TRUCK HISAB — DATABASE SCHEMA
-- ============================================================

-- TRUCKS
CREATE TABLE IF NOT EXISTS trucks (
  id SERIAL PRIMARY KEY,
  truck_number VARCHAR(10) UNIQUE NOT NULL,
  driver_name VARCHAR(100)
);

-- SOURCES (fixed 3)
CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  address VARCHAR(300),
  lat DECIMAL(10,6),
  lng DECIMAL(10,6)
);

-- CUSTOMERS (48 from freight details)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(300) UNIQUE NOT NULL,
  destination_address VARCHAR(300),
  destination_lat DECIMAL(10,6),
  destination_lng DECIMAL(10,6),
  freight_actual DECIMAL(10,2),
  freight_dhuwwani DECIMAL(10,2)
);

-- BACKLOAD OPTIONS
CREATE TABLE IF NOT EXISTS backloads (
  id SERIAL PRIMARY KEY,
  description VARCHAR(300) UNIQUE NOT NULL
);

-- TRIPS (main entry table)
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER REFERENCES trucks(id),
  source_id INTEGER REFERENCES sources(id),
  customer_id INTEGER REFERENCES customers(id),

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,

  -- Bill
  mpp_bill_no VARCHAR(100),

  -- Distance
  distance_km DECIMAL(10,2),

  -- Diesel
  diesel_needed DECIMAL(10,2),
  diesel_used DECIMAL(10,2),
  diesel_deviation DECIMAL(10,2) GENERATED ALWAYS AS (diesel_needed - diesel_used) STORED,
  diesel_cost DECIMAL(10,2),

  -- Allowances (auto-calculated on insert/update via app logic)
  num_days INTEGER,
  fooding DECIMAL(10,2),
  trip_bhatta DECIMAL(10,2),

  -- Loading/Unloading
  loading_unloading DECIMAL(10,2),

  -- Freight
  freight_amount DECIMAL(10,2),

  -- Totals
  total_expenses DECIMAL(10,2),
  total_cash_expense DECIMAL(10,2),
  surplus DECIMAL(10,2),

  -- Backload (return trip)
  backload_id INTEGER REFERENCES backloads(id),
  backload_weight_kg DECIMAL(10,2),
  backload_bill_no VARCHAR(100),
  is_return_filled BOOLEAN DEFAULT FALSE,

  -- Meta
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'completed', 'verified')),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- INDEX for fast retrieval
CREATE INDEX IF NOT EXISTS idx_trips_truck ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_start_date ON trips(start_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- Add avg_kmpl to trucks if not exists
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS avg_kmpl DECIMAL(10,2);

-- trips table missing columns
ALTER TABLE trips ADD COLUMN IF NOT EXISTS loading_amount numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS unloading_amount numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS maintenance_hisab_phanna numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS maintenance_rokhar numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS grease_expense numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS road_tax numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS scrap_tax numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS tyre_expense numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS police_tax numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS phone_expense numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_supplier_id integer REFERENCES backloads(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_freight_amount numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_loading_amount numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_unloading_amount numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_start_date date;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_end_date date;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_fooding numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS backload_bhatta numeric(10,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS customer_ids integer[];
ALTER TABLE trips ADD COLUMN IF NOT EXISTS customer_pieces jsonb;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS customer_freight jsonb;

-- trip_customers missing columns (already done but just in case)
ALTER TABLE trip_customers ADD COLUMN IF NOT EXISTS pieces integer;
ALTER TABLE trip_customers ADD COLUMN IF NOT EXISTS freight_amount numeric(10,2);

-- customers missing columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_rate_multiplier numeric(10,4);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rate_trip_count integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_rate_updated timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_rate_per_piece numeric(10,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS piece_trip_count integer DEFAULT 0;

-- Add to schema.sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMP DEFAULT NOW()
);


ALTER TABLE customers ADD COLUMN IF NOT EXISTS freight_actual DECIMAL(10,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS freight_dhuwwani DECIMAL(10,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_rate_multiplier numeric(10,4);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rate_trip_count integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_rate_updated timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_rate_per_piece numeric(10,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS piece_trip_count integer DEFAULT 0;
