// seed-users.cjs — seed the hardcoded accounts into Postgres. Preserves existing rows
// (and their bcrypt hashes) via ON CONFLICT (username) DO NOTHING.
const bcrypt = require('bcryptjs');

// Mirrors the _seed array in index.cjs (source of truth = code, not data.db).
const SEED = [
  { u: 'admin',      p: 'admin123',     n: 'SRSC Admin',     e: 'admin@standingrockstewards.com',      r: 'admin' },
  { u: 'supervisor', p: 'super123',     n: 'Test Supervisor',e: 'supervisor@standingrockstewards.com', r: 'admin' },
  { u: 'tech',       p: 'tech123',      n: 'Test Tech',      e: 'tech@standingrockstewards.com',       r: 'field_tech' },
  { u: 'vendor',     p: 'vendor123',    n: 'Test Vendor',    e: 'vendor@standingrockstewards.com',     r: 'vendor' }, // client->vendor
  { u: 'customer',   p: 'customer123',  n: 'Test Customer',  e: 'customer@standingrockstewards.com',   r: 'client' },
  { u: 'testtech',   p: 'TestPass123!', n: 'Test Technician',e: 'testtech@standingrockstewards.com',   r: 'field_tech' },
];

async function run(pool) {
  const owns = !pool;
  if (owns) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  }
  for (const s of SEED) {
    const hash = bcrypt.hashSync(s.p, 12);
    const res = await pool.query(
      `INSERT INTO users (username,password,name,email,role,active)
       VALUES ($1,$2,$3,$4,$5,TRUE)
       ON CONFLICT (username) DO NOTHING`,
      [s.u, hash, s.n, s.e, s.r]);
    console.log(`[seed-users] ${s.u}: ${res.rowCount ? 'inserted' : 'exists (skipped)'}`);
  }
  if (owns) await pool.end();
}

module.exports = { run };
if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
