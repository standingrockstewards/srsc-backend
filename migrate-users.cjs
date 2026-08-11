// migrate-users.cjs — CREATE TABLE IF NOT EXISTS users in Postgres. Idempotent.
const CREATE = `
CREATE TABLE IF NOT EXISTS users (
  id       SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL,
  phone    TEXT,
  role     TEXT NOT NULL DEFAULT 'field_tech',
  active   BOOLEAN NOT NULL DEFAULT TRUE
);`;

async function run(pool) {
  const owns = !pool;
  if (owns) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  }
  await pool.query(CREATE);
  console.log('[migrate-users] users table ensured');
  if (owns) await pool.end();
}

module.exports = { run };
if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
