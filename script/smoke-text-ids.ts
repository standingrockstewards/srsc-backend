/**
 * smoke-text-ids.ts
 *
 * Verifies that all v2 IDs are text in the live Postgres DB.
 * 1. Inserts a test customer (text id)
 * 2. Inserts a test property (text id, FK to customer)
 * 3. Inserts a billing_state_log row (text id, text property_id FK)
 * 4. Joins billing_state_log → properties to prove text FKs work
 * 5. Cleans up all inserted rows
 *
 * Run: DATABASE_URL=<url> npx tsx script/smoke-text-ids.ts
 */

import { Pool } from "pg";
import { nanoid } from "nanoid";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  const custId = nanoid();
  const propId = nanoid();
  const logId  = nanoid();

  try {
    console.log("=== Insert customer (text id) ===");
    await client.query(
      `INSERT INTO customers (id, name, email, credit_balance, active_property_count)
       VALUES ($1, 'Smoke Test Customer', $2, '0', 0)`,
      [custId, `smoke-${custId}@test.invalid`],
    );
    console.log("  customer id:", custId);

    console.log("=== Insert property (text id, FK to customer) ===");
    await client.query(
      `INSERT INTO properties (id, customer_id, nickname, address, target_retainer_amount)
       VALUES ($1, $2, 'Smoke Property', '123 Test Ln', '500.00')`,
      [propId, custId],
    );
    console.log("  property id:", propId);

    console.log("=== Insert billing_state_log (text id, text property_id FK) ===");
    await client.query(
      `INSERT INTO billing_state_log (id, property_id, from_state, to_state, reason)
       VALUES ($1, $2, 'current', 'grace', 'smoke test')`,
      [logId, propId],
    );
    console.log("  log id:", logId);

    console.log("=== JOIN billing_state_log → properties on text FK ===");
    const joinResult = await client.query(
      `SELECT bsl.id AS log_id,
              bsl.property_id,
              bsl.from_state,
              bsl.to_state,
              p.id AS prop_id,
              p.nickname
       FROM billing_state_log bsl
       INNER JOIN properties p ON p.id = bsl.property_id
       WHERE bsl.id = $1`,
      [logId],
    );

    if (joinResult.rows.length === 0) {
      throw new Error("JOIN returned no rows — FK not working");
    }
    const row = joinResult.rows[0];
    if (row.property_id !== propId || row.prop_id !== propId) {
      throw new Error(`ID mismatch: bsl.property_id=${row.property_id}, p.id=${row.prop_id}, expected=${propId}`);
    }
    console.log("  JOIN result:");
    console.log("    log_id      :", row.log_id);
    console.log("    property_id :", row.property_id);
    console.log("    from_state  :", row.from_state);
    console.log("    to_state    :", row.to_state);
    console.log("    prop_id     :", row.prop_id);
    console.log("    nickname    :", row.nickname);
    console.log("  ✓ JOIN on text IDs works correctly");

    console.log("=== Confirm id columns are text in pg catalog ===");
    const typeCheck = await client.query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name = 'id'
         AND table_name IN ('customers','properties','billing_state_log','retainer_ledger',
                            'account_credits','legal_documents','customer_signatures',
                            'monitoring_events','referrals','vendors','vendor_reviews','vendor_payments')
       ORDER BY table_name`,
    );
    for (const r of typeCheck.rows) {
      const ok = r.data_type === "text";
      console.log(`  ${ok ? "✓" : "✗"} ${r.table_name}.${r.column_name} = ${r.data_type}`);
      if (!ok) throw new Error(`${r.table_name}.id is ${r.data_type}, expected text`);
    }

    console.log("=== Confirm billing_state_log.property_id is text ===");
    const fkTypeCheck = await client.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='billing_state_log' AND column_name='property_id'`,
    );
    const fkType = fkTypeCheck.rows[0]?.data_type;
    if (fkType !== "text") throw new Error(`billing_state_log.property_id is ${fkType}, expected text`);
    console.log("  ✓ billing_state_log.property_id = text");

    console.log("\n✅  All checks passed — text IDs work end-to-end.");
  } finally {
    // cleanup
    await client.query(`DELETE FROM billing_state_log WHERE id = $1`, [logId]);
    await client.query(`DELETE FROM properties WHERE id = $1`, [propId]);
    await client.query(`DELETE FROM customers WHERE id = $1`, [custId]);
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("✗ SMOKE TEST FAILED:", err.message);
  process.exit(1);
});
