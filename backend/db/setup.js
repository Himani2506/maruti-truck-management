const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

const SCHEMAS = [
  'schema.sql',
  'scrap_migration.sql',
  'scrap_party_opening_migration.sql',
  'alerts_migration.sql',
];

const SEEDS = [
  'seed.sql',
  'scrap_parties_seed.sql',
];

async function runFile(client, filename) {
  const filepath = path.join(__dirname, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  SKIP ${filename} (not found)`);
    return;
  }
  const sql = fs.readFileSync(filepath, 'utf8');
  await client.query(sql);
  console.log(`  OK   ${filename}`);
}

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Running schemas...');
    for (const file of SCHEMAS) await runFile(client, file);

    console.log('Running seeds...');
    for (const file of SEEDS) await runFile(client, file);

    console.log('Database ready.');
  } catch (err) {
    console.error('DB setup error:', err.message);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  setupDatabase().then(() => process.exit(0));
}

module.exports = { pool, setupDatabase };