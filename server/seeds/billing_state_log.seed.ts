/**
 * server/seeds/billing_state_log.seed.ts  (Brick 10O)
 *
 * Seeds demo billing state transition history for a subset of demo properties.
 *
 * ── Safety guarantees ────────────────────────────────────────────────────────
 * • Deterministic IDs: bsl_01..bsl_05 — no randomness on re-run.
 * • INSERT … ON CONFLICT (id) DO UPDATE — idempotent, re-run = 0 new rows.
 * • All property_id values are the seeded demo properties (prop_01..prop_05).
 * • from_state and to_state restricted to: current | grace | delinquent
 *   (consistent with properties_billing_state_chk CHECK constraint).
 * • The last (most-recent) log entry for each property ends in 'current'
 *   to match the properties.billing_state = 'current' seeded in 10M.
 * • Timestamps computed relative to now() — no hardcoded stale dates.
 *
 * ── Transition plan ──────────────────────────────────────────────────────────
 * prop_02: current → grace (40d ago) → current (35d ago)
 *   Simulates: balance dipped below threshold after a charge; owner topped up.
 * prop_03: current → grace (50d ago) → delinquent (45d ago) → current (38d ago)
 *   Simulates: slower recovery; required manual adjustment to restore balance.
 * prop_01, prop_04, prop_05: no state transitions — always current (no log rows).
 *
 * ── Live DB column map (verified psql \d, Brick 10O STEP 0) ─────────────────
 * id TEXT NOT NULL
 * property_id TEXT NOT NULL FK→properties(id)
 * from_state TEXT NOT NULL  (current | grace | delinquent)
 * to_state TEXT NOT NULL    (current | grace | delinquent)
 * reason TEXT NULL
 * created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *
 * Run: npx tsx server/seeds/billing_state_log.seed.ts
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://srsc_db_user:dorn07GvLwOz3JPwz9mHFpdmSnfcW6pn@dpg-d9keftm1egvs738988jg-a.oregon-postgres.render.com/srsc_db?sslmode=require";

type BillingState = "current" | "grace" | "delinquent";

interface BillingStateLogSeed {
  id:          string;
  property_id: string;
  from_state:  BillingState;
  to_state:    BillingState;
  reason:      string | null;
  days_ago:    number;
}

/** Returns a Date for N days before now at a stable intra-day hour. */
function daysAgo(n: number, hourOffset = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOffset, 0, 0, 0);
  return d;
}

// ── Log entries ───────────────────────────────────────────────────────────────
// Entries are ordered by days_ago descending (oldest first within each property).
// The last entry for each property resolves to 'current' — consistent with
// the properties.billing_state seeded in 10M.

const LOG_ENTRIES: BillingStateLogSeed[] = [

  // ── prop_02 — two-step recovery (grace → current) ─────────────────────────
  {
    id:          "bsl_01",
    property_id: "prop_02",
    from_state:  "current",
    to_state:    "grace",
    reason:      "Demo: retainer balance fell below 25% threshold after service charge",
    days_ago:    40,
  },
  {
    id:          "bsl_02",
    property_id: "prop_02",
    from_state:  "grace",
    to_state:    "current",
    reason:      "Demo: owner top-up received — balance restored above threshold",
    days_ago:    35,
  },

  // ── prop_03 — three-step recovery (grace → delinquent → current) ──────────
  {
    id:          "bsl_03",
    property_id: "prop_03",
    from_state:  "current",
    to_state:    "grace",
    reason:      "Demo: balance dropped below alert threshold after monthly charge",
    days_ago:    50,
  },
  {
    id:          "bsl_04",
    property_id: "prop_03",
    from_state:  "grace",
    to_state:    "delinquent",
    reason:      "Demo: grace period expired without top-up — escalated to delinquent",
    days_ago:    45,
  },
  {
    id:          "bsl_05",
    property_id: "prop_03",
    from_state:  "delinquent",
    to_state:    "current",
    reason:      "Demo: manual adjustment applied — balance restored; account reinstated",
    days_ago:    38,
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function runSeed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Upserting demo billing state log entries…");

    for (const e of LOG_ENTRIES) {
      const createdAt = daysAgo(e.days_ago);

      const result = await pool.query(
        `INSERT INTO billing_state_log (id, property_id, from_state, to_state, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           property_id = EXCLUDED.property_id,
           from_state  = EXCLUDED.from_state,
           to_state    = EXCLUDED.to_state,
           reason      = EXCLUDED.reason
         RETURNING (xmax = 0) AS inserted`,
        [e.id, e.property_id, e.from_state, e.to_state, e.reason, createdAt],
      );

      const inserted = result.rows[0].inserted;
      console.log(
        `  ${inserted ? "INSERT" : "UPDATE"} ${e.id} — ${e.property_id} [${e.from_state} → ${e.to_state}] ${e.days_ago}d ago`,
      );
    }

    // ── Self-validate ──────────────────────────────────────────────────────
    console.log("\nValidating…");

    const countRes = await pool.query(
      "SELECT count(*) FROM billing_state_log WHERE id = ANY($1::text[])",
      [LOG_ENTRIES.map((e) => e.id)],
    );
    const count = parseInt(countRes.rows[0].count, 10);
    if (count !== LOG_ENTRIES.length) {
      throw new Error(`Count mismatch: expected ${LOG_ENTRIES.length}, got ${count}`);
    }

    // FK check
    const fkRes = await pool.query(
      `SELECT bsl.id FROM billing_state_log bsl
       LEFT JOIN properties p ON p.id = bsl.property_id
       WHERE bsl.id = ANY($1::text[]) AND p.id IS NULL`,
      [LOG_ENTRIES.map((e) => e.id)],
    );
    if (fkRes.rows.length > 0) {
      throw new Error(`FK violation: ${fkRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // State value check — both from_state and to_state must be valid
    const VALID_STATES = ["current", "grace", "delinquent"];
    const stateRes = await pool.query(
      `SELECT id, from_state, to_state FROM billing_state_log
       WHERE id = ANY($1::text[])
         AND (from_state NOT IN ('current', 'grace', 'delinquent')
              OR to_state NOT IN ('current', 'grace', 'delinquent'))`,
      [LOG_ENTRIES.map((e) => e.id)],
    );
    if (stateRes.rows.length > 0) {
      throw new Error(`Invalid state value on: ${stateRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // Consistency check: the most-recent log row per property must end in the
    // same state as properties.billing_state (which is 'current' for all seeded props).
    const latestStateRes = await pool.query(
      `SELECT DISTINCT ON (bsl.property_id)
         bsl.property_id, bsl.to_state, p.billing_state
       FROM billing_state_log bsl
       JOIN properties p ON p.id = bsl.property_id
       WHERE bsl.id = ANY($1::text[])
       ORDER BY bsl.property_id, bsl.created_at DESC`,
      [LOG_ENTRIES.map((e) => e.id)],
    );
    for (const row of latestStateRes.rows) {
      if (row.to_state !== row.billing_state) {
        throw new Error(
          `State mismatch for ${row.property_id}: last log to_state='${row.to_state}' but properties.billing_state='${row.billing_state}'`,
        );
      }
    }

    // Suppress unused variable warning
    void VALID_STATES;

    console.log(`  ✓ ${count} billing state log entries verified`);
    console.log("  ✓ FK integrity passed");
    console.log("  ✓ state values valid (current | grace | delinquent)");
    console.log("  ✓ last log entry per property consistent with properties.billing_state");
    console.log("\nSeed complete.");

  } finally {
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
