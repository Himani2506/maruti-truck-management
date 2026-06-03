const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Run schema + seed on first setup
async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Running schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema OK');

    console.log('Running seed...');
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await client.query(seed);
    console.log('Seed OK');

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
