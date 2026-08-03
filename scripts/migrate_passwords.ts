/**
 * scripts/migrate_passwords.ts
 *
 * One-time migration: re-hash any legacy/plaintext user passwords with bcrypt.
 * SAFE TO RE-RUN (idempotent): rows already storing a bcrypt hash are skipped.
 *
 * Usage (dev/staging ONLY):
 *   npx tsx scripts/migrate_passwords.ts
 *
 * NOTE: This script never logs or writes any plaintext or generated passwords.
 */

import { storage, sqlite } from "../server/storage";
import { hashPassword } from "../server/lib/password";

// bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 chars long.
function isBcryptHash(value: unknown): boolean {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

async function main() {
  const rows: Array<{ id: number; password: string | null }> =
    sqlite.prepare("SELECT id, password FROM users").all() as any;

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.password) {
      skipped++;
      continue;
    }
    if (isBcryptHash(row.password)) {
      skipped++;
      continue;
    }
    const hashed = await hashPassword(row.password);
    sqlite.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashed, row.id);
    migrated++;
    // Log id only — never the password value.
    console.log(`Migrated user id=${row.id}`);
  }

  console.log(`Done. migrated=${migrated} skipped=${skipped} total=${rows.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
