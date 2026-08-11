// migrate-tiers.cjs — Phase 3: add subscription tier + overage tracking. Idempotent.
const ALTERS = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_started_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_visit_limit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS overage_rate_cents INTEGER NOT NULL DEFAULT 0;
`;
const OVERAGE = `
CREATE TABLE IF NOT EXISTS overage_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  period TEXT NOT NULL,
  visits_used INTEGER NOT NULL DEFAULT 0,
  overage_visits INTEGER NOT NULL DEFAULT 0,
  overage_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period)
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
  await pool.query(ALTERS);
  await pool.query(OVERAGE);
  console.log('[migrate-tiers] tier columns + overage_usage table ensured');
  if (owns) await pool.end();
}
module.exports = { run };
if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
