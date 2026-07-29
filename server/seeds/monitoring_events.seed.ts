/**
 * server/seeds/monitoring_events.seed.ts  (Brick 10N)
 *
 * Seeds 12 demo monitoring events spread across prop_01..prop_05.
 *
 * ── Safety guarantees ────────────────────────────────────────────────────────
 * • Deterministic IDs: mevt_01..mevt_12 — no randomness on re-run.
 * • INSERT … ON CONFLICT (id) DO UPDATE — idempotent, re-run = 0 new rows.
 * • All property_id values are the seeded demo properties (prop_01..prop_05).
 * • Timestamps are computed relative to now() inside this script — never
 *   hardcoded stale ISO strings.  Each event gets a unique offset in days
 *   so they span the last 30 days naturally.
 * • severity values are restricted to: info | warning | critical
 *   (from monitoringService.SEVERITIES — no DB CHECK, but TS-enforced).
 * • visit_type values are restricted to the VISIT_TYPES const array or null.
 * • source and category are free-text plain text — no DB enum constraint.
 * • Descriptions are clearly labeled "Demo:" — no real PII.
 *
 * ── Live DB column map (verified psql \d, Brick 10N STEP 0) ─────────────────
 * id TEXT NOT NULL
 * property_id TEXT NOT NULL FK→properties(id)
 * source TEXT NOT NULL
 * severity TEXT NOT NULL  (info | warning | critical)
 * category TEXT NOT NULL
 * payload TEXT NULL
 * acknowledged_at TIMESTAMPTZ NULL
 * created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * visit_type TEXT NULL
 * note TEXT NULL
 * latitude NUMERIC(10,6) NULL
 * longitude NUMERIC(10,6) NULL
 * visit_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *
 * Run: npx tsx server/seeds/monitoring_events.seed.ts
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://srsc_db_user:dorn07GvLwOz3JPwz9mHFpdmSnfcW6pn@dpg-d9keftm1egvs738988jg-a.oregon-postgres.render.com/srsc_db?sslmode=require";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity  = "info" | "warning" | "critical";
type VisitType =
  | "routine_check"
  | "storm_assessment"
  | "maintenance"
  | "emergency_response"
  | "dock_inspection"
  | "shoreline_walk"
  | "water_sample"
  | "neighbor_contact"
  | "other"
  | null;

interface EventSeed {
  id:              string;
  property_id:     string;
  source:          string;
  severity:        Severity;
  category:        string;
  payload:         string | null;
  acknowledged_at: Date | null;  // resolved as Date at seed-time
  visit_type:      VisitType;
  note:            string | null;
  latitude:        string | null;   // numeric(10,6) → string
  longitude:       string | null;
  days_ago:        number;          // used to compute visit_at + created_at
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an ISO timestamp for N days ago from when the seed runs. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Event definitions ─────────────────────────────────────────────────────────
// 12 events spread across prop_01..prop_05, spanning 1–30 days ago.
// Descriptions start with "Demo:" — no real owner PII.

const EVENTS: EventSeed[] = [
  // ── prop_01 — Demo Lakefront Cabin (North Cove) ───────────────────────────
  {
    id:              "mevt_01",
    property_id:     "prop_01",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "routine_check",
    note:            "Demo: routine dock inspection — no issues observed. Dock hardware secure, boards in good condition.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.301200",
    longitude:       "-95.933400",
    days_ago:        2,
  },
  {
    id:              "mevt_02",
    property_id:     "prop_01",
    source:          "anchor_watch",
    severity:        "warning",
    category:        "alert",
    visit_type:      null,
    note:            "Demo: motion detected at boat house entry — 02:14 AM. No follow-up contact required; reviewed camera logs.",
    payload:         JSON.stringify({ trigger: "motion", zone: "boat_house", timestamp_offset_min: -45 }),
    acknowledged_at: daysAgo(7),
    latitude:        null,
    longitude:       null,
    days_ago:        7,
  },
  {
    id:              "mevt_03",
    property_id:     "prop_01",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "shoreline_walk",
    note:            "Demo: shoreline walk completed — minor erosion noted near north cove inlet. No immediate action required.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.301800",
    longitude:       "-95.933900",
    days_ago:        14,
  },

  // ── prop_02 — Demo Dock House (South Shore) ───────────────────────────────
  {
    id:              "mevt_04",
    property_id:     "prop_02",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "maintenance",
    note:            "Demo: replaced dock bumpers (4 units). Applied rust inhibitor to cleats. Property secure.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.264800",
    longitude:       "-95.874600",
    days_ago:        5,
  },
  {
    id:              "mevt_05",
    property_id:     "prop_02",
    source:          "system",
    severity:        "warning",
    category:        "weather",
    visit_type:      null,
    note:            "Demo: NWS severe thunderstorm watch issued for McIntosh County. Pre-storm checklist triggered.",
    payload:         JSON.stringify({ watch_type: "severe_thunderstorm", county: "McIntosh", source: "NWS" }),
    acknowledged_at: daysAgo(10),
    latitude:        null,
    longitude:       null,
    days_ago:        10,
  },
  {
    id:              "mevt_06",
    property_id:     "prop_02",
    source:          "steward",
    severity:        "warning",
    category:        "visit",
    visit_type:      "storm_assessment",
    note:            "Demo: post-storm assessment — one dock section shifted approx. 6 inches. Temporary tie-off applied; full repair scheduled.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.264500",
    longitude:       "-95.874200",
    days_ago:        9,
  },

  // ── prop_03 — Demo Waterfront Retreat (East Arm) ──────────────────────────
  {
    id:              "mevt_07",
    property_id:     "prop_03",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "water_sample",
    note:            "Demo: water sample collected at east arm dock — sent to lab. No visible algae bloom or turbidity concern.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.237600",
    longitude:       "-95.806200",
    days_ago:        3,
  },
  {
    id:              "mevt_08",
    property_id:     "prop_03",
    source:          "anchor_watch",
    severity:        "critical",
    category:        "security",
    visit_type:      null,
    note:            "Demo: door sensor triggered — back entrance. Responded within 25 minutes; false alarm confirmed (sensor battery low).",
    payload:         JSON.stringify({ sensor: "back_door", battery_pct: 8, false_alarm: true }),
    acknowledged_at: daysAgo(20),
    latitude:        null,
    longitude:       null,
    days_ago:        20,
  },
  {
    id:              "mevt_09",
    property_id:     "prop_03",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "routine_check",
    note:            "Demo: routine check — exterior lighting functional, HVAC filter checked, no water intrusion. All clear.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.237200",
    longitude:       "-95.805800",
    days_ago:        17,
  },

  // ── prop_04 — Demo Cove Cottage (Brushy Creek) ────────────────────────────
  {
    id:              "mevt_10",
    property_id:     "prop_04",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "dock_inspection",
    note:            "Demo: dock inspection — boards and hardware in good shape. Cove water level ~2 ft below summer pool.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.325100",
    longitude:       "-95.987300",
    days_ago:        1,
  },
  {
    id:              "mevt_11",
    property_id:     "prop_04",
    source:          "steward",
    severity:        "warning",
    category:        "structural",
    visit_type:      "maintenance",
    note:            "Demo: retaining wall on north face showing surface cracking — approx. 3 ft section. Monitoring; owner notified. No structural failure risk at this time.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.325400",
    longitude:       "-95.987700",
    days_ago:        25,
  },

  // ── prop_05 — Demo Hilltop Lake Home (Dam Area) ───────────────────────────
  {
    id:              "mevt_12",
    property_id:     "prop_05",
    source:          "steward",
    severity:        "info",
    category:        "visit",
    visit_type:      "neighbor_contact",
    note:            "Demo: met with neighboring property caretaker — no concerns shared. Confirmed shared fence line in good repair.",
    payload:         null,
    acknowledged_at: null,
    latitude:        "35.175400",
    longitude:       "-95.899800",
    days_ago:        30,
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function runSeed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Upserting demo monitoring events…");

    for (const e of EVENTS) {
      const visitAt   = daysAgo(e.days_ago);
      const createdAt = daysAgo(e.days_ago);

      const result = await pool.query(
        `INSERT INTO monitoring_events (
           id, property_id, source, severity, category,
           payload, acknowledged_at, created_at,
           visit_type, note, latitude, longitude, visit_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           property_id     = EXCLUDED.property_id,
           source          = EXCLUDED.source,
           severity        = EXCLUDED.severity,
           category        = EXCLUDED.category,
           payload         = EXCLUDED.payload,
           acknowledged_at = EXCLUDED.acknowledged_at,
           visit_type      = EXCLUDED.visit_type,
           note            = EXCLUDED.note,
           latitude        = EXCLUDED.latitude,
           longitude       = EXCLUDED.longitude,
           visit_at        = EXCLUDED.visit_at
         RETURNING (xmax = 0) AS inserted`,
        [
          e.id, e.property_id, e.source, e.severity, e.category,
          e.payload, e.acknowledged_at, createdAt,
          e.visit_type, e.note, e.latitude, e.longitude, visitAt,
        ],
      );

      const inserted = result.rows[0].inserted;
      console.log(
        `  ${inserted ? "INSERT" : "UPDATE"} ${e.id} — prop:${e.property_id} [${e.severity}/${e.category}] ${e.days_ago}d ago`,
      );
    }

    // ── Self-validate ──────────────────────────────────────────────────────
    console.log("\nValidating…");

    const countRes = await pool.query(
      "SELECT count(*) FROM monitoring_events WHERE id = ANY($1::text[])",
      [EVENTS.map((e) => e.id)],
    );
    const count = parseInt(countRes.rows[0].count, 10);
    if (count !== EVENTS.length) {
      throw new Error(`Count mismatch: expected ${EVENTS.length}, got ${count}`);
    }

    // FK check — all property_ids must exist
    const fkRes = await pool.query(
      `SELECT me.id
       FROM monitoring_events me
       LEFT JOIN properties p ON p.id = me.property_id
       WHERE me.id = ANY($1::text[]) AND p.id IS NULL`,
      [EVENTS.map((e) => e.id)],
    );
    if (fkRes.rows.length > 0) {
      throw new Error(`FK violation — orphaned events: ${fkRes.rows.map((r) => r.id).join(", ")}`);
    }

    // Severity check — only info/warning/critical
    const sevRes = await pool.query(
      `SELECT id, severity FROM monitoring_events
       WHERE id = ANY($1::text[])
         AND severity NOT IN ('info', 'warning', 'critical')`,
      [EVENTS.map((e) => e.id)],
    );
    if (sevRes.rows.length > 0) {
      throw new Error(`Invalid severity on: ${sevRes.rows.map((r) => r.id).join(", ")}`);
    }

    // Timestamp range — all visit_at within last 31 days
    const tsRes = await pool.query(
      `SELECT id, visit_at FROM monitoring_events
       WHERE id = ANY($1::text[])
         AND (visit_at < now() - interval '31 days'
              OR visit_at > now() + interval '1 minute')`,
      [EVENTS.map((e) => e.id)],
    );
    if (tsRes.rows.length > 0) {
      throw new Error(`Timestamps out of 30-day window: ${tsRes.rows.map((r) => r.id).join(", ")}`);
    }

    console.log(`  ✓ ${count} events verified`);
    console.log("  ✓ FK integrity passed");
    console.log("  ✓ severity values valid");
    console.log("  ✓ timestamps within 30-day window");
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
