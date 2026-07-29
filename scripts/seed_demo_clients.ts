/**
 * scripts/seed_demo_clients.ts  (Brick 10V)
 *
 * Idempotently seeds three demo client users into the v1 SQLite `users` table.
 * These users exist ONLY for smoke / CI testing — they are NOT real people.
 *
 * Email join rule (authV2.ts):
 *   users.email === customers.email  (Postgres `customers` table)
 *
 * Mapping:
 *   demo.client.1@demo.invalid  →  pcust_01  (prop_01, prop_02 — 6 events)
 *   demo.client.2@demo.invalid  →  pcust_02  (prop_03, prop_04 — 5 events)
 *   demo.client.3@demo.invalid  →  pcust_03  (prop_05 — 1 event)
 *
 * Password: read from env SMOKE_CLIENT_PASS (required).
 *           Never hardcoded. Stored plaintext (v1 legacy — server accepts both
 *           plaintext and bcrypt; demo accounts use plaintext consistent with
 *           all other seed users in storage.ts).
 *
 * Run:
 *   SMOKE_CLIENT_PASS=demo-client-pass npx tsx scripts/seed_demo_clients.ts
 *
 * Idempotent:
 *   Uses INSERT OR IGNORE (SQLite) so re-running is always safe.
 *
 * Exit codes:
 *   0 — success (seeded or already present)
 *   1 — SMOKE_CLIENT_PASS not set, or DB error
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "data.db");
const PASS    = process.env["SMOKE_CLIENT_PASS"] ?? "";

if (!PASS) {
  console.error("ERROR: SMOKE_CLIENT_PASS env var is required but not set.");
  console.error("  Set it to any demo-safe value, e.g.:");
  console.error("  SMOKE_CLIENT_PASS=demo-client-pass npx tsx scripts/seed_demo_clients.ts");
  process.exit(1);
}

/**
 * Demo client users to seed.
 * Emails MUST match the `email` column in the Postgres `customers` table.
 * All @demo.invalid — RFC 2606 reserved; can never belong to a real person.
 */
const DEMO_CLIENTS = [
  {
    username: "demo_client_1",
    email:    "demo.owner.1@demo.invalid",   // matches pcust_01 in customers
    name:     "Demo Client One",
    phone:    "0000000001",
    role:     "client",
    active:   1,
  },
  {
    username: "demo_client_2",
    email:    "demo.owner.2@demo.invalid",   // matches pcust_02 in customers
    name:     "Demo Client Two",
    phone:    "0000000002",
    role:     "client",
    active:   1,
  },
  {
    username: "demo_client_3",
    email:    "demo.owner.3@demo.invalid",   // matches pcust_03 in customers
    name:     "Demo Client Three",
    phone:    "0000000003",
    role:     "client",
    active:   1,
  },
] as const;

try {
  const sqlite = new Database(DB_PATH);

  // Ensure the table exists (mirrors storage.ts — safe to call multiple times)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT    NOT NULL UNIQUE,
      password TEXT    NOT NULL,
      name     TEXT    NOT NULL,
      email    TEXT    NOT NULL,
      phone    TEXT,
      role     TEXT    NOT NULL DEFAULT 'field_tech',
      active   INTEGER NOT NULL DEFAULT 1
    );
  `);

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO users (username, password, name, email, phone, role, active)
    VALUES (@username, @password, @name, @email, @phone, @role, @active)
  `);

  const checkExists = sqlite.prepare(
    "SELECT id, username, email FROM users WHERE username = ?"
  );

  console.log("Seeding demo client users into SQLite data.db …\n");

  for (const client of DEMO_CLIENTS) {
    const existing = checkExists.get(client.username) as { id: number; username: string; email: string } | undefined;

    if (existing) {
      console.log(`  SKIP  ${client.username}  (id=${existing.id}) — already exists, email=${existing.email}`);
    } else {
      const result = insert.run({ ...client, password: PASS });
      console.log(`  SEED  ${client.username}  (id=${result.lastInsertRowid}) — email=${client.email}, role=${client.role}`);
    }
  }

  console.log("\nAll demo client users present in SQLite. ✓");
  sqlite.close();
  process.exit(0);
} catch (err: unknown) {
  console.error("DB error:", err);
  process.exit(1);
}
