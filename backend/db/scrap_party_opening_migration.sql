-- Party opening balances
CREATE TABLE IF NOT EXISTS scrap_party_opening (
  id SERIAL PRIMARY KEY,
  party_name VARCHAR(255) UNIQUE NOT NULL,
  opening NUMERIC(14, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_scrap_party_opening_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scrap_party_opening_updated_at
  BEFORE UPDATE ON scrap_party_opening
  FOR EACH ROW EXECUTE FUNCTION update_scrap_party_opening_updated_at();