// users-store.cjs — single access layer for users. Postgres when DATABASE_URL is set,
// otherwise falls back to the existing better-sqlite3 ./data.db (dev / no-op path).
const USE_PG = !!process.env.DATABASE_URL;

let pgPool = null;
let sqlite = null;

if (USE_PG) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
} else {
  const Database = require('better-sqlite3');
  sqlite = new Database('./data.db');
}

// ---- helpers ----------------------------------------------------------------
async function pg(q, params) { const r = await pgPool.query(q, params); return r.rows; }

// ---- reads ------------------------------------------------------------------
async function getByUsername(username) {
  if (USE_PG) return (await pg('SELECT * FROM users WHERE username=$1 AND active=true', [username]))[0] || null;
  return sqlite.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username) || null;
}

async function getById(id) {
  if (USE_PG) return (await pg('SELECT * FROM users WHERE id=$1', [id]))[0] || null;
  return sqlite.prepare('SELECT * FROM users WHERE id=?').get(id) || null;
}

async function getAllUsers() {
  if (USE_PG) return await pg('SELECT id,username,name,email,phone,role,active FROM users ORDER BY id', []);
  return sqlite.prepare('SELECT id,username,name,email,phone,role,active FROM users ORDER BY id').all();
}

async function getTechs() {
  if (USE_PG) return await pg("SELECT id,username,name,email,phone,role FROM users WHERE role='field_tech' AND active=true ORDER BY name", []);
  return sqlite.prepare("SELECT id,username,name,email,phone,role FROM users WHERE role='field_tech' AND active=1 ORDER BY name").all();
}

// ---- writes -----------------------------------------------------------------
async function createUser({ username, password, name, email, phone = null, role = 'field_tech', active = true }) {
  if (USE_PG) {
    return (await pg(
      `INSERT INTO users (username,password,name,email,phone,role,active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [username, password, name, email, phone, role, active]))[0];
  }
  const info = sqlite.prepare(
    'INSERT INTO users (username,password,name,email,phone,role,active) VALUES (?,?,?,?,?,?,?)'
  ).run(username, password, name, email, phone, role, active ? 1 : 0);
  return getById(info.lastInsertRowid);
}

async function updateUser(id, fields) {
  const allowed = ['username', 'name', 'email', 'phone', 'role', 'active'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (!keys.length) return getById(id);
  if (USE_PG) {
    const set = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    return (await pg(`UPDATE users SET ${set} WHERE id=$${keys.length + 1} RETURNING *`,
      [...keys.map(k => fields[k]), id]))[0];
  }
  const set = keys.map(k => `${k}=?`).join(', ');
  sqlite.prepare(`UPDATE users SET ${set} WHERE id=?`)
    .run(...keys.map(k => (k === 'active' ? (fields[k] ? 1 : 0) : fields[k])), id);
  return getById(id);
}

async function updatePassword(id, hashedPassword) {
  if (USE_PG) return void (await pg('UPDATE users SET password=$1 WHERE id=$2', [hashedPassword, id]));
  sqlite.prepare('UPDATE users SET password=? WHERE id=?').run(hashedPassword, id);
}

// ---- schema / seed hooks (pg only; sqlite already has schema+seed in index.cjs) ----
async function ensureSchema() {
  if (!USE_PG) return;
  await require('./migrate-users.cjs').run(pgPool);
}
async function seedIfEmpty() {
  if (!USE_PG) return;
  await require('./seed-users.cjs').run(pgPool);
}

module.exports = {
  USE_PG, getByUsername, getById, getAllUsers, getTechs,
  createUser, updateUser, updatePassword, ensureSchema, seedIfEmpty, pgPool,
};
