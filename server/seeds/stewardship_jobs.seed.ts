/**
 * server/seeds/stewardship_jobs.seed.ts  (Brick 10P)
 *
 * Seeds 10 demo stewardship jobs spread across prop_01..prop_05.
 *
 * ── Safety guarantees ────────────────────────────────────────────────────────
 * • Deterministic IDs: job_01..job_10 — no randomness on re-run.
 * • INSERT … ON CONFLICT (id) DO UPDATE — idempotent, re-run = 0 new rows.
 * • All property_id values reference seeded demo properties (prop_01..prop_05).
 * • source_event_id values reference seeded monitoring events (mevt_*) or NULL.
 * • assigned_to is a soft text reference — no hard FK, no vendor table required.
 * • All enum-like columns restricted to TS-defined const arrays (no DB CHECK):
 *     trigger_type : anchor_watch | shipshape | signal_flare | weather | manual
 *     job_type     : visit | inspection | response
 *     status       : pending | scheduled | dispatched | in_progress | completed | cancelled
 *     priority     : low | normal | urgent
 *     assigned_to_type: vendor | field_tech | internal | null
 * • Timestamps computed relative to now() at seed-time — no hardcoded dates.
 *   Completed/dispatched jobs have past timestamps; scheduled jobs have future.
 * • metadata defaults to '{}' — explicitly provided for clarity.
 *
 * ── Job mix ───────────────────────────────────────────────────────────────────
 * job_01 prop_01  completed  manual/visit       — routine monthly check, done
 * job_02 prop_01  scheduled  anchor_watch/resp  — follow-up to mevt_02 (alert)
 * job_03 prop_02  completed  weather/inspection — post-storm assessment, done
 * job_04 prop_02  in_progress manual/visit      — dock repair follow-up
 * job_05 prop_02  scheduled  manual/visit       — future scheduled check
 * job_06 prop_03  completed  manual/visit       — routine check, done
 * job_07 prop_03  completed  signal_flare/resp  — security response to mevt_08
 * job_08 prop_04  pending    manual/inspection  — retaining wall monitoring
 * job_09 prop_04  scheduled  shipshape/visit    — upcoming routine check
 * job_10 prop_05  completed  manual/visit       — neighbor contact visit, done
 *
 * ── Live DB column map (verified psql \d, Brick 10P STEP 0) ─────────────────
 * id TEXT NOT NULL
 * property_id TEXT NOT NULL FK→properties(id)
 * source_event_id TEXT NULL FK→monitoring_events(id)
 * trigger_type TEXT NOT NULL  (anchor_watch|shipshape|signal_flare|weather|manual)
 * job_type TEXT NOT NULL       (visit|inspection|response)
 * status TEXT NOT NULL DEFAULT 'pending'  (pending|scheduled|dispatched|in_progress|completed|cancelled)
 * priority TEXT NOT NULL DEFAULT 'normal' (low|normal|urgent)
 * assigned_to TEXT NULL        (soft ref — no hard FK)
 * assigned_to_type TEXT NULL   (vendor|field_tech|internal)
 * scheduled_for TIMESTAMPTZ NULL
 * due_by TIMESTAMPTZ NULL
 * notes TEXT NULL
 * metadata JSONB NOT NULL DEFAULT '{}'
 * dispatched_at TIMESTAMPTZ NULL
 * completed_at TIMESTAMPTZ NULL
 * created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 * updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *
 * Run: npx tsx server/seeds/stewardship_jobs.seed.ts
 */

import { Pool } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://srsc_db_user:dorn07GvLwOz3JPwz9mHFpdmSnfcW6pn@dpg-d9keftm1egvs738988jg-a.oregon-postgres.render.com/srsc_db?sslmode=require";

type TriggerType    = "anchor_watch" | "shipshape" | "signal_flare" | "weather" | "manual";
type JobType        = "visit" | "inspection" | "response";
type JobStatus      = "pending" | "scheduled" | "dispatched" | "in_progress" | "completed" | "cancelled";
type JobPriority    = "low" | "normal" | "urgent";
type AssignedToType = "vendor" | "field_tech" | "internal" | null;

interface JobSeed {
  id:               string;
  property_id:      string;
  source_event_id:  string | null;   // FK→monitoring_events(id) or null
  trigger_type:     TriggerType;
  job_type:         JobType;
  status:           JobStatus;
  priority:         JobPriority;
  assigned_to:      string | null;   // soft ref — demo label, no hard FK
  assigned_to_type: AssignedToType;
  notes:            string | null;
  metadata:         Record<string, unknown>;
  // Time offsets (positive = days in past, negative = days in future)
  created_days_ago:    number;
  dispatched_days_ago: number | null;
  completed_days_ago:  number | null;
  scheduled_days_from_now: number | null;  // positive = future days
  due_days_from_now:       number | null;  // positive = future days
}

/** Returns a Date N days before now at a stable hour. */
function daysAgo(n: number, hour = 8): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Returns a Date N days in the future at a stable hour. */
function daysFuture(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ── Job definitions ───────────────────────────────────────────────────────────

const JOBS: JobSeed[] = [

  // ── prop_01 — Demo Lakefront Cabin ────────────────────────────────────────

  {
    id:               "job_01",
    property_id:      "prop_01",
    source_event_id:  "mevt_01",   // routine_check visit event
    trigger_type:     "manual",
    job_type:         "visit",
    status:           "completed",
    priority:         "normal",
    assigned_to:      "demo_tech_01",
    assigned_to_type: "field_tech",
    notes:            "Demo: monthly routine check — dock hardware secure, no issues. Completed on schedule.",
    metadata:         { demo: true, checklist_items: 8, passed: 8 },
    created_days_ago:    30,
    dispatched_days_ago: 30,
    completed_days_ago:  29,
    scheduled_days_from_now: null,
    due_days_from_now:       null,
  },
  {
    id:               "job_02",
    property_id:      "prop_01",
    source_event_id:  "mevt_02",   // warning/alert event — motion at boat house
    trigger_type:     "anchor_watch",
    job_type:         "response",
    status:           "scheduled",
    priority:         "normal",
    assigned_to:      "demo_tech_01",
    assigned_to_type: "field_tech",
    notes:            "Demo: follow-up site visit to verify motion alert resolved — camera battery replacement.",
    metadata:         { demo: true, triggered_by: "mevt_02" },
    created_days_ago:    7,
    dispatched_days_ago: null,
    completed_days_ago:  null,
    scheduled_days_from_now: 3,
    due_days_from_now:       5,
  },

  // ── prop_02 — Demo Dock House ─────────────────────────────────────────────

  {
    id:               "job_03",
    property_id:      "prop_02",
    source_event_id:  "mevt_05",   // weather warning event
    trigger_type:     "weather",
    job_type:         "inspection",
    status:           "completed",
    priority:         "urgent",
    assigned_to:      "demo_tech_02",
    assigned_to_type: "field_tech",
    notes:            "Demo: post-storm assessment — dock section shifted. Documented and temporary tie-off applied.",
    metadata:         { demo: true, storm_watch: "severe_thunderstorm", items_inspected: 12 },
    created_days_ago:    10,
    dispatched_days_ago: 9,
    completed_days_ago:  9,
    scheduled_days_from_now: null,
    due_days_from_now:       null,
  },
  {
    id:               "job_04",
    property_id:      "prop_02",
    source_event_id:  "mevt_06",   // warning/visit — storm assessment
    trigger_type:     "manual",
    job_type:         "visit",
    status:           "in_progress",
    priority:         "normal",
    assigned_to:      "demo_vendor_01",
    assigned_to_type: "vendor",
    notes:            "Demo: dock repair in progress — shifted section realignment. Parts sourced, work underway.",
    metadata:         { demo: true, repair_estimate_usd: 620, vendor_ref: "demo_vendor_01" },
    created_days_ago:    8,
    dispatched_days_ago: 6,
    completed_days_ago:  null,
    scheduled_days_from_now: null,
    due_days_from_now:       2,
  },
  {
    id:               "job_05",
    property_id:      "prop_02",
    source_event_id:  null,
    trigger_type:     "shipshape",
    job_type:         "visit",
    status:           "scheduled",
    priority:         "low",
    assigned_to:      "demo_tech_02",
    assigned_to_type: "field_tech",
    notes:            "Demo: scheduled routine check — next monthly visit.",
    metadata:         { demo: true },
    created_days_ago:    3,
    dispatched_days_ago: null,
    completed_days_ago:  null,
    scheduled_days_from_now: 10,
    due_days_from_now:       14,
  },

  // ── prop_03 — Demo Waterfront Retreat ─────────────────────────────────────

  {
    id:               "job_06",
    property_id:      "prop_03",
    source_event_id:  "mevt_09",   // routine check visit
    trigger_type:     "manual",
    job_type:         "visit",
    status:           "completed",
    priority:         "normal",
    assigned_to:      "demo_tech_01",
    assigned_to_type: "field_tech",
    notes:            "Demo: full-service routine check — exterior, dock, HVAC filter, water quality noted. All clear.",
    metadata:         { demo: true, checklist_items: 14, passed: 14 },
    created_days_ago:    17,
    dispatched_days_ago: 17,
    completed_days_ago:  16,
    scheduled_days_from_now: null,
    due_days_from_now:       null,
  },
  {
    id:               "job_07",
    property_id:      "prop_03",
    source_event_id:  "mevt_08",   // critical/security event
    trigger_type:     "signal_flare",
    job_type:         "response",
    status:           "completed",
    priority:         "urgent",
    assigned_to:      "demo_tech_02",
    assigned_to_type: "field_tech",
    notes:            "Demo: security response to door sensor alert — confirmed false alarm. Replaced back-door sensor battery.",
    metadata:         { demo: true, false_alarm: true, battery_replaced: true, triggered_by: "mevt_08" },
    created_days_ago:    20,
    dispatched_days_ago: 20,
    completed_days_ago:  19,
    scheduled_days_from_now: null,
    due_days_from_now:       null,
  },

  // ── prop_04 — Demo Cove Cottage ───────────────────────────────────────────

  {
    id:               "job_08",
    property_id:      "prop_04",
    source_event_id:  "mevt_11",   // warning/structural event
    trigger_type:     "manual",
    job_type:         "inspection",
    status:           "pending",
    priority:         "normal",
    assigned_to:      null,
    assigned_to_type: null,
    notes:            "Demo: retaining wall inspection — surface cracking noted (mevt_11). Structural assessment needed before scheduling repair.",
    metadata:         { demo: true, triggered_by: "mevt_11", wall_section_ft: 3 },
    created_days_ago:    25,
    dispatched_days_ago: null,
    completed_days_ago:  null,
    scheduled_days_from_now: null,
    due_days_from_now:       7,
  },
  {
    id:               "job_09",
    property_id:      "prop_04",
    source_event_id:  null,
    trigger_type:     "shipshape",
    job_type:         "visit",
    status:           "scheduled",
    priority:         "normal",
    assigned_to:      "demo_tech_01",
    assigned_to_type: "field_tech",
    notes:            "Demo: upcoming routine visit — dock inspection + general check.",
    metadata:         { demo: true },
    created_days_ago:    2,
    dispatched_days_ago: null,
    completed_days_ago:  null,
    scheduled_days_from_now: 7,
    due_days_from_now:       10,
  },

  // ── prop_05 — Demo Hilltop Lake Home ──────────────────────────────────────

  {
    id:               "job_10",
    property_id:      "prop_05",
    source_event_id:  "mevt_12",   // routine visit event
    trigger_type:     "manual",
    job_type:         "visit",
    status:           "completed",
    priority:         "normal",
    assigned_to:      "demo_tech_02",
    assigned_to_type: "field_tech",
    notes:            "Demo: routine visit near dam area — met neighboring caretaker, property perimeter checked, all secure.",
    metadata:         { demo: true, checklist_items: 9, passed: 9 },
    created_days_ago:    30,
    dispatched_days_ago: 30,
    completed_days_ago:  30,
    scheduled_days_from_now: null,
    due_days_from_now:       null,
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function runSeed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log("Upserting demo stewardship jobs…");

    for (const j of JOBS) {
      const createdAt    = daysAgo(j.created_days_ago);
      const updatedAt    = daysAgo(j.created_days_ago);   // same as created for seeds
      const dispatchedAt = j.dispatched_days_ago !== null ? daysAgo(j.dispatched_days_ago) : null;
      const completedAt  = j.completed_days_ago  !== null ? daysAgo(j.completed_days_ago)  : null;
      const scheduledFor = j.scheduled_days_from_now !== null ? daysFuture(j.scheduled_days_from_now) : null;
      const dueBy        = j.due_days_from_now        !== null ? daysFuture(j.due_days_from_now)        : null;

      const result = await pool.query(
        `INSERT INTO stewardship_jobs (
           id, property_id, source_event_id,
           trigger_type, job_type, status, priority,
           assigned_to, assigned_to_type,
           scheduled_for, due_by, notes, metadata,
           dispatched_at, completed_at, created_at, updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           property_id      = EXCLUDED.property_id,
           source_event_id  = EXCLUDED.source_event_id,
           trigger_type     = EXCLUDED.trigger_type,
           job_type         = EXCLUDED.job_type,
           status           = EXCLUDED.status,
           priority         = EXCLUDED.priority,
           assigned_to      = EXCLUDED.assigned_to,
           assigned_to_type = EXCLUDED.assigned_to_type,
           scheduled_for    = EXCLUDED.scheduled_for,
           due_by           = EXCLUDED.due_by,
           notes            = EXCLUDED.notes,
           metadata         = EXCLUDED.metadata,
           dispatched_at    = EXCLUDED.dispatched_at,
           completed_at     = EXCLUDED.completed_at,
           updated_at       = EXCLUDED.updated_at
         RETURNING (xmax = 0) AS inserted`,
        [
          j.id, j.property_id, j.source_event_id,
          j.trigger_type, j.job_type, j.status, j.priority,
          j.assigned_to, j.assigned_to_type,
          scheduledFor, dueBy, j.notes, JSON.stringify(j.metadata),
          dispatchedAt, completedAt, createdAt, updatedAt,
        ],
      );

      const inserted = result.rows[0].inserted;
      console.log(
        `  ${inserted ? "INSERT" : "UPDATE"} ${j.id} — ${j.property_id} [${j.status}/${j.job_type}/${j.priority}]`,
      );
    }

    // ── Self-validate ──────────────────────────────────────────────────────
    console.log("\nValidating…");

    const countRes = await pool.query(
      "SELECT count(*) FROM stewardship_jobs WHERE id = ANY($1::text[])",
      [JOBS.map((j) => j.id)],
    );
    const count = parseInt(countRes.rows[0].count, 10);
    if (count !== JOBS.length) {
      throw new Error(`Count mismatch: expected ${JOBS.length}, got ${count}`);
    }

    // FK check — property_id
    const propFkRes = await pool.query(
      `SELECT sj.id FROM stewardship_jobs sj
       LEFT JOIN properties p ON p.id = sj.property_id
       WHERE sj.id = ANY($1::text[]) AND p.id IS NULL`,
      [JOBS.map((j) => j.id)],
    );
    if (propFkRes.rows.length > 0) {
      throw new Error(`property_id FK violation: ${propFkRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // FK check — source_event_id (only non-null ones)
    const evtFkRes = await pool.query(
      `SELECT sj.id, sj.source_event_id FROM stewardship_jobs sj
       LEFT JOIN monitoring_events me ON me.id = sj.source_event_id
       WHERE sj.id = ANY($1::text[])
         AND sj.source_event_id IS NOT NULL
         AND me.id IS NULL`,
      [JOBS.map((j) => j.id)],
    );
    if (evtFkRes.rows.length > 0) {
      throw new Error(`source_event_id FK violation: ${evtFkRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // Status check
    const statusRes = await pool.query(
      `SELECT id, status FROM stewardship_jobs
       WHERE id = ANY($1::text[])
         AND status NOT IN ('pending','scheduled','dispatched','in_progress','completed','cancelled')`,
      [JOBS.map((j) => j.id)],
    );
    if (statusRes.rows.length > 0) {
      throw new Error(`Invalid status on: ${statusRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // trigger_type check
    const triggerRes = await pool.query(
      `SELECT id, trigger_type FROM stewardship_jobs
       WHERE id = ANY($1::text[])
         AND trigger_type NOT IN ('anchor_watch','shipshape','signal_flare','weather','manual')`,
      [JOBS.map((j) => j.id)],
    );
    if (triggerRes.rows.length > 0) {
      throw new Error(`Invalid trigger_type on: ${triggerRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // job_type check
    const jobTypeRes = await pool.query(
      `SELECT id, job_type FROM stewardship_jobs
       WHERE id = ANY($1::text[])
         AND job_type NOT IN ('visit','inspection','response')`,
      [JOBS.map((j) => j.id)],
    );
    if (jobTypeRes.rows.length > 0) {
      throw new Error(`Invalid job_type on: ${jobTypeRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // completed jobs must have completed_at set
    const completedMissingRes = await pool.query(
      `SELECT id FROM stewardship_jobs
       WHERE id = ANY($1::text[])
         AND status = 'completed'
         AND completed_at IS NULL`,
      [JOBS.map((j) => j.id)],
    );
    if (completedMissingRes.rows.length > 0) {
      throw new Error(`completed jobs missing completed_at: ${completedMissingRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    // scheduled jobs must have scheduled_for in the future
    const scheduledPastRes = await pool.query(
      `SELECT id, scheduled_for FROM stewardship_jobs
       WHERE id = ANY($1::text[])
         AND status = 'scheduled'
         AND scheduled_for IS NOT NULL
         AND scheduled_for < now()`,
      [JOBS.map((j) => j.id)],
    );
    if (scheduledPastRes.rows.length > 0) {
      throw new Error(`scheduled jobs with past scheduled_for: ${scheduledPastRes.rows.map((r: any) => r.id).join(", ")}`);
    }

    console.log(`  ✓ ${count} stewardship jobs verified`);
    console.log("  ✓ property_id FK integrity passed");
    console.log("  ✓ source_event_id FK integrity passed");
    console.log("  ✓ status values valid");
    console.log("  ✓ trigger_type values valid");
    console.log("  ✓ job_type values valid");
    console.log("  ✓ completed jobs have completed_at");
    console.log("  ✓ scheduled jobs have future scheduled_for");
    console.log("\nSeed complete.");

  } finally {
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
