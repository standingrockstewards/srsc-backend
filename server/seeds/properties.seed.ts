/**
 * server/seeds/properties.seed.ts  (Brick 10M)
 *
 * Seeds 3 demo customers + 5 demo properties on Lake Eufaula, OK.
 *
 * ── Safety guarantees ────────────────────────────────────────────────────────
 * • Deterministic IDs — pcust_01..03, prop_01..05 — no randomness on re-run.
 * • INSERT … ON CONFLICT (id) DO UPDATE — idempotent, re-run = 0 new rows.
 * • No real PII: owner names are "Demo Owner 1" etc.; emails use @demo.invalid
 *   (RFC 2606 reserved — cannot route to a real inbox); addresses are generic
 *   lake-community labels (no real street addresses).
 * • Coordinates are real plausible Lake Eufaula, OK lat/lon from USACE charts.
 * • billing_state = 'current' (only allowed value without a balance event).
 * • All NOT NULL columns without DB defaults are explicitly provided.
 *
 * Run: npx tsx server/seeds/properties.seed.ts
 *
 * ── Live DB column map (verified psql \d, Brick 10M STEP 0) ─────────────────
 * customers:  id, email, name, role, credit_balance, active_property_count, created_at
 * properties: id, customer_id, name, address, target_retainer_amount,
 *             low_balance_alert_pct, discount_tier_pct, created_at,
 *             latitude, longitude, nearest_shoreline_marker, billing_state,
 *             alarm_code_enc, gate_code_enc, access_notes_enc, key_location_enc,
 *             address_enc, sensitive_updated_at
 *
 * NOTE: schema-v2.ts has additional columns (nickname, city, state, zip,
 *       service_tier, updated_at) that do NOT exist in the live DB as of
 *       Brick 10M — those are intentionally omitted from this seed.
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://srsc_db_user:dorn07GvLwOz3JPwz9mHFpdmSnfcW6pn@dpg-d9keftm1egvs738988jg-a.oregon-postgres.render.com/srsc_db?sslmode=require";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerSeed {
  id:                   string;
  email:                string;
  name:                 string;
  role:                 string;
  credit_balance:       string;   // numeric → string
  active_property_count: number;
}

interface PropertySeed {
  id:                     string;
  customer_id:            string;
  name:                   string;
  address:                string;
  target_retainer_amount: string;  // numeric → string
  low_balance_alert_pct:  number;
  discount_tier_pct:      number;
  latitude:               string;  // numeric(9,6) → string
  longitude:              string;
  billing_state:          "current" | "grace" | "delinquent";
}

// ── Demo customers ────────────────────────────────────────────────────────────
// Emails use @demo.invalid (RFC 2606 — cannot route to a real inbox).
// Names are clearly synthetic labels, not real people.

const CUSTOMERS: CustomerSeed[] = [
  {
    id:                    "pcust_01",
    email:                 "demo.owner.1@demo.invalid",
    name:                  "Demo Owner 1",
    role:                  "client",
    credit_balance:        "0.00",
    active_property_count: 2,
  },
  {
    id:                    "pcust_02",
    email:                 "demo.owner.2@demo.invalid",
    name:                  "Demo Owner 2",
    role:                  "client",
    credit_balance:        "0.00",
    active_property_count: 2,
  },
  {
    id:                    "pcust_03",
    email:                 "demo.owner.3@demo.invalid",
    name:                  "Demo Owner 3",
    role:                  "client",
    credit_balance:        "0.00",
    active_property_count: 1,
  },
];

// ── Demo properties ───────────────────────────────────────────────────────────
// Coordinates are plausible Lake Eufaula, OK positions (35.17–35.35°N, 95.8–96.1°W).
// Addresses are clearly labeled "Demo Property" — no real street addresses.

const PROPERTIES: PropertySeed[] = [
  {
    id:                     "prop_01",
    customer_id:            "pcust_01",
    name:                   "Demo Lakefront Cabin — North Cove",
    address:                "Demo Property 01, Lake Eufaula, OK 74432",
    target_retainer_amount: "2400.00",
    low_balance_alert_pct:  25,
    discount_tier_pct:      0,
    latitude:               "35.301200",
    longitude:              "-95.933400",
    billing_state:          "current",
  },
  {
    id:                     "prop_02",
    customer_id:            "pcust_01",
    name:                   "Demo Dock House — South Shore",
    address:                "Demo Property 02, Lake Eufaula, OK 74432",
    target_retainer_amount: "1800.00",
    low_balance_alert_pct:  25,
    discount_tier_pct:      0,
    latitude:               "35.264800",
    longitude:              "-95.874600",
    billing_state:          "current",
  },
  {
    id:                     "prop_03",
    customer_id:            "pcust_02",
    name:                   "Demo Waterfront Retreat — East Arm",
    address:                "Demo Property 03, Lake Eufaula, OK 74432",
    target_retainer_amount: "3000.00",
    low_balance_alert_pct:  20,
    discount_tier_pct:      5,
    latitude:               "35.237600",
    longitude:              "-95.806200",
    billing_state:          "current",
  },
  {
    id:                     "prop_04",
    customer_id:            "pcust_02",
    name:                   "Demo Cove Cottage — Brushy Creek",
    address:                "Demo Property 04, Lake Eufaula, OK 74432",
    target_retainer_amount: "1500.00",
    low_balance_alert_pct:  30,
    discount_tier_pct:      0,
    latitude:               "35.325100",
    longitude:              "-95.987300",
    billing_state:          "current",
  },
  {
    id:                     "prop_05",
    customer_id:            "pcust_03",
    name:                   "Demo Hilltop Lake Home — Dam Area",
    address:                "Demo Property 05, Lake Eufaula, OK 74521",
    target_retainer_amount: "2000.00",
    low_balance_alert_pct:  25,
    discount_tier_pct:      0,
    latitude:               "35.175400",
    longitude:              "-95.899800",
    billing_state:          "current",
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function runSeed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // ── 1. Upsert customers ────────────────────────────────────────────────
    console.log("Upserting demo customers…");
    for (const c of CUSTOMERS) {
      const result = await pool.query(
        `INSERT INTO customers (id, email, name, role, credit_balance, active_property_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           email                 = EXCLUDED.email,
           name                  = EXCLUDED.name,
           role                  = EXCLUDED.role,
           credit_balance        = EXCLUDED.credit_balance,
           active_property_count = EXCLUDED.active_property_count
         RETURNING (xmax = 0) AS inserted`,
        [c.id, c.email, c.name, c.role, c.credit_balance, c.active_property_count],
      );
      const inserted = result.rows[0].inserted;
      console.log(`  ${inserted ? "INSERT" : "UPDATE"} customers ${c.id} (${c.name})`);
    }

    // ── 2. Upsert properties ───────────────────────────────────────────────
    console.log("Upserting demo properties…");
    for (const p of PROPERTIES) {
      const result = await pool.query(
        `INSERT INTO properties (
           id, customer_id, name, address,
           target_retainer_amount, low_balance_alert_pct, discount_tier_pct,
           latitude, longitude, billing_state
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           customer_id             = EXCLUDED.customer_id,
           name                    = EXCLUDED.name,
           address                 = EXCLUDED.address,
           target_retainer_amount  = EXCLUDED.target_retainer_amount,
           low_balance_alert_pct   = EXCLUDED.low_balance_alert_pct,
           discount_tier_pct       = EXCLUDED.discount_tier_pct,
           latitude                = EXCLUDED.latitude,
           longitude               = EXCLUDED.longitude,
           billing_state           = EXCLUDED.billing_state
         RETURNING (xmax = 0) AS inserted`,
        [
          p.id, p.customer_id, p.name, p.address,
          p.target_retainer_amount, p.low_balance_alert_pct, p.discount_tier_pct,
          p.latitude, p.longitude, p.billing_state,
        ],
      );
      const inserted = result.rows[0].inserted;
      console.log(`  ${inserted ? "INSERT" : "UPDATE"} properties ${p.id} (${p.name})`);
    }

    // ── 3. Self-validate ───────────────────────────────────────────────────
    console.log("\nValidating…");

    const custCount = await pool.query(
      "SELECT count(*) FROM customers WHERE id = ANY($1::text[])",
      [CUSTOMERS.map((c) => c.id)],
    );
    const propCount = await pool.query(
      "SELECT count(*) FROM properties WHERE id = ANY($1::text[])",
      [PROPERTIES.map((p) => p.id)],
    );

    const custRows = parseInt(custCount.rows[0].count, 10);
    const propRows = parseInt(propCount.rows[0].count, 10);

    if (custRows !== CUSTOMERS.length) {
      throw new Error(`Customer count mismatch: expected ${CUSTOMERS.length}, got ${custRows}`);
    }
    if (propRows !== PROPERTIES.length) {
      throw new Error(`Property count mismatch: expected ${PROPERTIES.length}, got ${propRows}`);
    }

    // FK integrity check — all properties must reference a seeded customer
    const fkCheck = await pool.query(
      `SELECT p.id
       FROM properties p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.id = ANY($1::text[])
         AND c.id IS NULL`,
      [PROPERTIES.map((p) => p.id)],
    );
    if (fkCheck.rows.length > 0) {
      const bad = fkCheck.rows.map((r) => r.id).join(", ");
      throw new Error(`FK validation failed — orphaned property ids: ${bad}`);
    }

    // billing_state check
    const stateCheck = await pool.query(
      `SELECT id, billing_state FROM properties
       WHERE id = ANY($1::text[])
         AND billing_state NOT IN ('current', 'grace', 'delinquent')`,
      [PROPERTIES.map((p) => p.id)],
    );
    if (stateCheck.rows.length > 0) {
      throw new Error(`billing_state constraint violation on: ${stateCheck.rows.map((r) => r.id).join(", ")}`);
    }

    console.log(`  ✓ ${custRows} customers verified`);
    console.log(`  ✓ ${propRows} properties verified`);
    console.log("  ✓ FK integrity passed");
    console.log("  ✓ billing_state constraint passed");
    console.log("\nSeed complete.");

  } finally {
    await pool.end();
  }
}

// Standalone entry point
runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
