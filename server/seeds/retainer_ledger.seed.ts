/**
 * server/seeds/retainer_ledger.seed.ts  (Brick 10O)
 *
 * Seeds demo retainer ledger history for all 5 demo properties.
 *
 * ── Safety guarantees ────────────────────────────────────────────────────────
 * • Deterministic IDs: rl_01..rl_12 — no randomness on re-run.
 * • INSERT … ON CONFLICT (id) DO UPDATE — idempotent, re-run = 0 new rows.
 * • All property_id values are the seeded demo properties (prop_01..prop_05).
 * • type values restricted to RETAINER_ENTRY_TYPES: topup | charge | credit_applied | adjustment
 * • balance_after is pre-computed and consistent with running balance per property.
 * • Amounts are positive numeric(10,2) strings — type determines the direction.
 * • Timestamps computed relative to now() — no hardcoded stale dates.
 *   Entries within each property are ordered oldest→newest by days_ago.
 *
 * ── Balance plan (amounts consistent with 10M target_retainer_amount) ────────
 * prop_01 ($2,400 target):  topup $2,400 → charge $450 → topup $500      final: $2,450
 * prop_02 ($1,800 target):  topup $1,800 → charge $320 → charge $280     final: $1,200
 * prop_03 ($3,000 target):  topup $3,000 → charge $600 → credit_applied $150  final: $2,550
 * prop_04 ($1,500 target):  topup $1,500 → charge $275                   final: $1,225
 * prop_05 ($2,000 target):  topup $2,000 → charge $380 → topup $400      final: $2,020
 *
 * ── Live DB column map (verified psql \d, Brick 10O STEP 0) ─────────────────
 * id TEXT NOT NULL
 * property_id TEXT NOT NULL FK→properties(id)
 * type TEXT NOT NULL  (topup | charge | credit_applied | adjustment)
 * amount NUMERIC(10,2) NOT NULL
 * balance_after NUMERIC(10,2) NOT NULL
 * note TEXT NULL
 * created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *
 * Run: npx tsx server/seeds/retainer_ledger.seed.ts
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://srsc_db_user:dorn07GvLwOz3JPwz9mHFpdmSnfcW6pn@dpg-d9keftm1egvs738988jg-a.oregon-postgres.render.com/srsc_db?sslmode=require";

type EntryType = "topup" | "charge" | "credit_applied" | "adjustment";

interface LedgerSeed {
  id:            string;
  property_id:   string;
  type:          EntryType;
  amount:        string;   // numeric(10,2) as string
  balance_after: string;   // running balance as string
  note:          string | null;
  days_ago:      number;   // used to compute created_at
}

/** Returns a Date for N days before now, at a stable intra-day hour offset. */
function daysAgo(n: number, hourOffset = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOffset, 0, 0, 0);
  return d;
}

// ── Ledger entries ────────────────────────────────────────────────────────────
// Entries per property ordered oldest first (highest days_ago first).
// balance_after is pre-computed running balance.

const ENTRIES: LedgerSeed[] = [

  // ── prop_01 — Demo Lakefront Cabin: $2,400 target ─────────────────────────
  {
    id:            "rl_01",
    property_id:   "prop_01",
    type:          "topup",
    amount:        "2400.00",
    balance_after: "2400.00",
    note:          "Demo: initial retainer deposit — account setup",
    days_ago:      58,
  },
  {
    id:            "rl_02",
    property_id:   "prop_01",
    type:          "charge",
    amount:        "450.00",
    balance_after: "1950.00",
    note:          "Demo: monthly service charge — routine checks + dock inspection",
    days_ago:      30,
  },
  {
    id:            "rl_03",
    property_id:   "prop_01",
    type:          "topup",
    amount:        "500.00",
    balance_after: "2450.00",
    note:          "Demo: retainer top-up",
    days_ago:      14,
  },

  // ── prop_02 — Demo Dock House: $1,800 target ──────────────────────────────
  {
    id:            "rl_04",
    property_id:   "prop_02",
    type:          "topup",
    amount:        "1800.00",
    balance_after: "1800.00",
    note:          "Demo: initial retainer deposit — account setup",
    days_ago:      56,
  },
  {
    id:            "rl_05",
    property_id:   "prop_02",
    type:          "charge",
    amount:        "320.00",
    balance_after: "1480.00",
    note:          "Demo: monthly service charge — routine checks + storm assessment",
    days_ago:      35,
  },
  {
    id:            "rl_06",
    property_id:   "prop_02",
    type:          "charge",
    amount:        "280.00",
    balance_after: "1200.00",
    note:          "Demo: dock repair labor charge",
    days_ago:      8,
  },

  // ── prop_03 — Demo Waterfront Retreat: $3,000 target ──────────────────────
  {
    id:            "rl_07",
    property_id:   "prop_03",
    type:          "topup",
    amount:        "3000.00",
    balance_after: "3000.00",
    note:          "Demo: initial retainer deposit — account setup",
    days_ago:      60,
  },
  {
    id:            "rl_08",
    property_id:   "prop_03",
    type:          "charge",
    amount:        "600.00",
    balance_after: "2400.00",
    note:          "Demo: monthly service charge — full-service tier",
    days_ago:      32,
  },
  {
    id:            "rl_09",
    property_id:   "prop_03",
    type:          "credit_applied",
    amount:        "150.00",
    balance_after: "2550.00",
    note:          "Demo: referral credit applied to account",
    days_ago:      10,
  },

  // ── prop_04 — Demo Cove Cottage: $1,500 target ────────────────────────────
  {
    id:            "rl_10",
    property_id:   "prop_04",
    type:          "topup",
    amount:        "1500.00",
    balance_after: "1500.00",
    note:          "Demo: initial retainer deposit — account setup",
    days_ago:      55,
  },
  {
    id:            "rl_11",
    property_id:   "prop_04",
    type:          "charge",
    amount:        "275.00",
    balance_after: "1225.00",
    note:          "Demo: monthly service charge — dock inspection + routine checks",
    days_ago:      28,
  },

  // ── prop_05 — Demo Hilltop Lake Home: $2,000 target ───────────────────────
  {
    id:            "rl_12",
    property_id:   "prop_05",
    type:          "topup",
    amount:        "2000.00",
    balance_after: "2000.00",
    note:          "Demo: initial retainer deposit — account setup",
    days_ago:      57,
  },
  {
    id:            "rl_13",
    property_id:   "prop_05",
    type:          "charge",
    amount:        "380.00",
    balance_after: "1620.00",
    note:          "Demo: monthly service charge — shoreline walk + neighbor contact",
    days_ago:      29,
  },
  {
    id:            "rl_14",
    property_id:   "prop_05",
    type:          "topup",
    amount:        "400.00",
    balance_after: "2020.00",
    note:          "Demo: retainer top-up",
    days_ago:      12,
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function runSeed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Upserting demo retainer ledger entries…");

    for (const e of ENTRIES) {
      const createdAt = daysAgo(e.days_ago);

      const result = await pool.query(
        `INSERT INTO retainer_ledger (id, property_id, type, amount, balance_after, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           property_id   = EXCLUDED.property_id,
           type          = EXCLUDED.type,
           amount        = EXCLUDED.amount,
           balance_after = EXCLUDED.balance_after,
           note          = EXCLUDED.note
         RETURNING (xmax = 0) AS inserted`,
        [e.id, e.property_id, e.type, e.amount, e.balance_after, e.note, createdAt],
      );

      const inserted = result.rows[0].inserted;
      console.log(
        `  ${inserted ? "INSERT" : "UPDATE"} ${e.id} — ${e.property_id} [${e.type}] $${e.amount} → bal $${e.balance_after}`,
      );
    }

    // ── Self-validate ──────────────────────────────────────────────────────
    console.log("\nValidating…");

    const countRes = await pool.query(
      "SELECT count(*) FROM retainer_ledger WHERE id = ANY($1::text[])",
      [ENTRIES.map((e) => e.id)],
    );
    const count = parseInt(countRes.rows[0].count, 10);
    if (count !== ENTRIES.length) {
      throw new Error(`Count mismatch: expected ${ENTRIES.length}, got ${count}`);
    }

    // FK check
    const fkRes = await pool.query(
      `SELECT rl.id FROM retainer_ledger rl
       LEFT JOIN properties p ON p.id = rl.property_id
       WHERE rl.id = ANY($1::text[]) AND p.id IS NULL`,
      [ENTRIES.map((e) => e.id)],
    );
    if (fkRes.rows.length > 0) {
      throw new Error(`FK violation: ${fkRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // Type check
    const typeRes = await pool.query(
      `SELECT id, type FROM retainer_ledger
       WHERE id = ANY($1::text[])
         AND type NOT IN ('topup', 'charge', 'credit_applied', 'adjustment')`,
      [ENTRIES.map((e) => e.id)],
    );
    if (typeRes.rows.length > 0) {
      throw new Error(`Invalid type on: ${typeRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // Balance consistency: balance_after should never be negative
    const negRes = await pool.query(
      `SELECT id, balance_after FROM retainer_ledger
       WHERE id = ANY($1::text[]) AND balance_after < 0`,
      [ENTRIES.map((e) => e.id)],
    );
    if (negRes.rows.length > 0) {
      throw new Error(`Negative balance_after on: ${negRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    console.log(`  ✓ ${count} ledger entries verified`);
    console.log("  ✓ FK integrity passed");
    console.log("  ✓ entry types valid");
    console.log("  ✓ all balances non-negative");
    console.log("\nSeed complete.");

  } finally {
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
