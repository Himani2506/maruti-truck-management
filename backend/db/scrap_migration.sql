-- Scrap Management Table
CREATE TABLE IF NOT EXISTS scrap_entries (
  id SERIAL PRIMARY KEY,

  -- Dates
  unloading_date_ad DATE NOT NULL,
  unloading_date_bs VARCHAR(20) NOT NULL,

  -- Reference numbers
  gen VARCHAR(50),
  grn VARCHAR(50),

  -- Party & Vehicle
  source VARCHAR(255) NOT NULL,
  vehicle_no VARCHAR(50),
  party_bill_no VARCHAR(50),

  -- Bill financials
  bill_weight NUMERIC(12, 2),
  bill_rate NUMERIC(10, 4),
  amount NUMERIC(14, 2) GENERATED ALWAYS AS (bill_weight * bill_rate) STORED,
  vat NUMERIC(14, 2) GENERATED ALWAYS AS (bill_weight * bill_rate * 0.13) STORED,
  total NUMERIC(14, 2) GENERATED ALWAYS AS (bill_weight * bill_rate * 1.13) STORED,

  -- Our weight & shortage
  our_weight NUMERIC(12, 2),
  shortage NUMERIC(12, 2) GENERATED ALWAYS AS (bill_weight - our_weight) STORED,

  -- Lab report
  moisture NUMERIC(8, 4),
  rejection NUMERIC(8, 4),
  total_lab_report NUMERIC(8, 4) GENERATED ALWAYS AS (moisture + rejection) STORED,

  -- Taxes & expenses
  scrap_tax_birgunj NUMERIC(12, 2) DEFAULT 0,
  scrap_tax_simra NUMERIC(12, 2) DEFAULT 0,
  scrap_tax_hetauda NUMERIC(12, 2) DEFAULT 0,
  other_expenses NUMERIC(12, 2) DEFAULT 0,
  freight NUMERIC(12, 2) DEFAULT 0,

  -- Admin overrides (set by admin after entry)
  superseded_rate NUMERIC(10, 4),
  superseded_rejection NUMERIC(8, 4),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_scrap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

  
DROP TRIGGER IF EXISTS scrap_entries_updated_at ON scrap_entries;
CREATE TRIGGER scrap_entries_updated_at
BEFORE UPDATE ON scrap_entries
FOR EACH ROW EXECUTE FUNCTION update_scrap_updated_at();

DROP TRIGGER IF EXISTS scrap_party_opening_updated_at ON scrap_party_opening;
CREATE TRIGGER scrap_party_opening_updated_at
BEFORE UPDATE ON scrap_party_opening
FOR EACH ROW EXECUTE FUNCTION update_scrap_party_opening_updated_at();
-- Lab breakdown columns
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS duplex NUMERIC(8,4);
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS plastic NUMERIC(8,4);
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS pin NUMERIC(8,4);
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS raining_water NUMERIC(8,4);
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS dust NUMERIC(8,4);
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS millboard NUMERIC(8,4);
ALTER TABLE scrap_entries ADD COLUMN IF NOT EXISTS extra NUMERIC(8,4);

CREATE TABLE IF NOT EXISTS scrap_cleared_accounts (
  id SERIAL PRIMARY KEY,
  party_name VARCHAR(255) NOT NULL,
  cleared_amount NUMERIC(14,2),
  note TEXT,
  cleared_date TIMESTAMP DEFAULT NOW(),
  entry_ids INTEGER[]
);
