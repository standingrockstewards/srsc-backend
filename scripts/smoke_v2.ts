/**
 * scripts/smoke_v2.ts  (Brick 10Q)
 *
 * Read-only smoke test for the v2 API against known seeded data.
 * Uses Node 18+ native fetch — zero new dependencies.
 *
 * Usage:
 *   npx tsx scripts/smoke_v2.ts
 *   API_BASE=https://srsc-backend.onrender.com SMOKE_USER=admin SMOKE_PASS=admin123 npx tsx scripts/smoke_v2.ts
 *
 * Local smoke test (HTTP — requires server started with SMOKE_TEST=1):
 *   SMOKE_TEST=1 PORT=5000 NODE_ENV=development npx tsx server/index.ts &
 *   API_BASE=http://localhost:5000 SMOKE_USER=admin SMOKE_PASS=admin123 npx tsx scripts/smoke_v2.ts
 *
 * Env vars:
 *   API_BASE    — Base URL (default: http://localhost:5000)
 *   SMOKE_USER  — Username for login (optional; auth checks SKIPPED if absent)
 *   SMOKE_PASS  — Password for login (optional; auth checks SKIPPED if absent)
 *
 * Exit codes:
 *   0 — all checks PASS (or clearly SKIPPED)
 *   1 — one or more checks FAIL or an unexpected error occurred
 *
 * No schema changes. No seed changes. No deploy.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE   = (process.env["API_BASE"]   ?? "http://localhost:5000").replace(/\/$/, "");
const SMOKE_USER =  process.env["SMOKE_USER"] ?? "";
const SMOKE_PASS =  process.env["SMOKE_PASS"] ?? "";
const HAS_CREDS  = Boolean(SMOKE_USER && SMOKE_PASS);

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "PASS" | "FAIL" | "SKIPPED" | "ERROR";

interface Row {
  endpoint: string;
  expected: string;
  actual:   string;
  status:   Status;
}

const results: Row[] = [];
let   anyFail = false;

// ── Cookie jar (manual, no external deps) ─────────────────────────────────────
// The v2 session cookie is named __Host-srsc-v2 and is set by POST /auth/login.
// We capture it from the Set-Cookie header and replay it on subsequent requests.

let sessionCookie = "";

function extractCookie(res: Response): void {
  // Session cookie name depends on NODE_ENV:
  //   production  → __Host-srsc-v2  (Secure, HTTPS only)
  //   development → srsc-v2-dev     (plain, HTTP ok)
  // Cookie name varies by mode:
  //   __Host-srsc-v2  — production (HTTPS only)
  //   srsc-v2-smoke   — SMOKE_TEST=1 (HTTP-safe, local testing)
  const COOKIE_RE = /(__Host-srsc-v2=[^;]+|srsc-v2-smoke=[^;]+)/;

  // Headers.getSetCookie() is Node 18+; fall back to the raw header string.
  const raw = (res.headers as any).getSetCookie?.() as string[] | undefined;
  if (raw) {
    for (const c of raw) {
      const m = c.match(COOKIE_RE);
      if (m?.[1]) { sessionCookie = m[1]; return; }
    }
  }
  // Fallback: single 'set-cookie' header string
  const single = res.headers.get("set-cookie") ?? "";
  const m2 = single.match(COOKIE_RE);
  if (m2?.[1]) sessionCookie = m2[1];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPublic(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`);
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function getAuth(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Cookie: sessionCookie },
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

function record(endpoint: string, expected: string, actual: string, pass: boolean | "skip"): void {
  const status: Status = pass === "skip" ? "SKIPPED" : pass ? "PASS" : "FAIL";
  results.push({ endpoint, expected, actual, status });
  if (status === "FAIL") anyFail = true;
}

function printTable(): void {
  const colW = [55, 30, 30, 10];
  const pad  = (s: string, w: number) => s.length >= w ? s.slice(0, w - 1) + "…" : s.padEnd(w);
  const sep  = colW.map((w) => "─".repeat(w)).join("─┼─");

  console.log("");
  console.log(["Endpoint", "Expected", "Actual", "Status"].map((h, i) => pad(h, colW[i]!)).join(" │ "));
  console.log(sep);

  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : r.status === "SKIPPED" ? "·" : r.status === "FAIL" ? "✗" : "!";
    console.log(
      [r.endpoint, r.expected, r.actual, `${icon} ${r.status}`]
        .map((v, i) => pad(v, colW[i]!))
        .join(" │ "),
    );
  }

  console.log(sep);
  const pass    = results.filter((r) => r.status === "PASS").length;
  const fail    = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;
  const errors  = results.filter((r) => r.status === "ERROR").length;
  console.log(`\n${pass} PASS  ${fail} FAIL  ${skipped} SKIPPED  ${errors} ERROR\n`);
}

// ── Public KB checks ──────────────────────────────────────────────────────────

async function runPublicChecks(): Promise<void> {
  console.log(`\n── Public KB checks (no auth) ─────────────────────────────────────`);
  console.log(`   API_BASE: ${API_BASE}\n`);

  // 1. GET /api/v2/kb/categories → 9
  {
    const { status, body } = await getPublic("/api/v2/kb/categories");
    const arr = Array.isArray(body) ? body : [];
    record(
      "GET /api/v2/kb/categories",
      "HTTP 200, 9 categories",
      `HTTP ${status}, ${arr.length} items`,
      status === 200 && arr.length === 9,
    );
  }

  // 2. GET /api/v2/kb/articles → 18 published
  {
    const { status, body } = await getPublic("/api/v2/kb/articles");
    const arr = Array.isArray(body) ? body : [];
    record(
      "GET /api/v2/kb/articles",
      "HTTP 200, 18 articles",
      `HTTP ${status}, ${arr.length} items`,
      status === 200 && arr.length === 18,
    );
  }

  // 3. GET /api/v2/kb/articles?category=fishing → 2
  {
    const { status, body } = await getPublic("/api/v2/kb/articles?category=fishing");
    const arr = Array.isArray(body) ? body : [];
    record(
      "GET /api/v2/kb/articles?category=fishing",
      "HTTP 200, 2 articles",
      `HTTP ${status}, ${arr.length} items`,
      status === 200 && arr.length === 2,
    );
  }

  // 4. GET /api/v2/kb/articles/<valid-slug> → 200
  {
    const slug = "dock-maintenance-checklist";
    const { status } = await getPublic(`/api/v2/kb/articles/${slug}`);
    record(
      `GET /api/v2/kb/articles/dock-maintenance-checklist`,
      "HTTP 200",
      `HTTP ${status}`,
      status === 200,
    );
  }

  // 5. GET /api/v2/kb/articles/<bad-slug> → 404
  {
    const { status } = await getPublic("/api/v2/kb/articles/no-such-slug-xyz-99");
    record(
      "GET /api/v2/kb/articles/<bad-slug>",
      "HTTP 404",
      `HTTP ${status}`,
      status === 404,
    );
  }
}

// ── Auth-gated checks ─────────────────────────────────────────────────────────

const PROP_IDS = ["prop_01", "prop_02", "prop_03", "prop_04", "prop_05"] as const;

async function runAuthChecks(): Promise<void> {
  console.log(`\n── Auth-gated checks ───────────────────────────────────────────────`);

  if (!HAS_CREDS) {
    console.log(`   SMOKE_USER/SMOKE_PASS not set — all auth checks SKIPPED.\n`);
    const toSkip = [
      "POST /api/v2/auth/login",
      "GET  /api/v2/properties (5 demo props)",
      "GET  /api/v2/jobs (10 demo jobs)",
      "GET  /api/v2/properties/*/events (12 demo events)",
      "GET  /api/v2/properties/*/retainer ledger (14 demo entries)",
      "GET  /api/v2/properties/*/billing_state (all 'current')",
    ];
    for (const ep of toSkip) record(ep, "—", "SKIPPED (no creds)", "skip");
    return;
  }

  console.log(`   SMOKE_USER: ${SMOKE_USER}\n`);

  // 6. Login
  {
    const res = await fetch(`${API_BASE}/api/v2/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username: SMOKE_USER, password: SMOKE_PASS }),
    });
    let body: Record<string, unknown> = {};
    try { body = (await res.json()) as Record<string, unknown>; } catch { /* empty */ }

    if (!res.ok) {
      record(
        "POST /api/v2/auth/login",
        "HTTP 200, session set",
        `HTTP ${res.status}: ${JSON.stringify(body)}`,
        false,
      );
      // Remaining auth checks can't proceed
      const remaining = [
        "GET  /api/v2/properties (5 demo props)",
        "GET  /api/v2/jobs (10 demo jobs)",
        "GET  /api/v2/properties/*/events (12 demo events)",
        "GET  /api/v2/properties/*/retainer ledger (14 demo entries)",
        "GET  /api/v2/properties/*/billing_state (all 'current')",
      ];
      for (const ep of remaining) {
        results.push({ endpoint: ep, expected: "—", actual: "Login failed", status: "ERROR" });
        anyFail = true;
      }
      return;
    }

    if ((body as any).requiresTwoFactor) {
      record(
        "POST /api/v2/auth/login",
        "HTTP 200, session set",
        "2FA required — cannot proceed",
        false,
      );
      anyFail = true;
      return;
    }

    extractCookie(res);
    const role     = (body as any).role ?? "?";
    const username = (body as any).user?.username ?? SMOKE_USER;
    record(
      "POST /api/v2/auth/login",
      "HTTP 200, session set",
      `HTTP 200, logged in as ${username} (${role})`,
      !!sessionCookie,
    );

    if (!sessionCookie) {
      console.error("   WARNING: No session cookie captured — auth checks will likely 401.");
    }
  }

  // 7. GET /api/v2/properties → all 5 demo properties present
  //    NOTE: As of Brick 10Q, the live DB properties table is missing columns
  //    (nickname, city, state, zip, service_tier, active, updated_at) that the
  //    Drizzle propertiesV2 schema selects. This causes a 500 on this endpoint.
  //    This is a PRE-EXISTING schema-drift issue, not introduced by any seed brick.
  //    The test records the actual result; a 500 is expected until schema is aligned.
  {
    const { status, body } = await getAuth("/api/v2/properties");
    const arr       = Array.isArray(body) ? body : [];
    const demoCount = arr.filter((p: any) => PROP_IDS.includes(p.id)).length;
    const actual = status === 500
      ? `HTTP 500 (known schema-drift: DB missing nickname/city/state/zip/service_tier/active/updated_at)`
      : `HTTP ${status}, ${arr.length} total, ${demoCount} demo (prop_*)`;
    record(
      "GET  /api/v2/properties (5 demo props)",
      "≥5 rows, all 5 demo IDs present",
      actual,
      status === 200 && demoCount === 5,
    );
  }

  // 8. GET /api/v2/jobs → all 10 demo jobs present
  {
    const { status, body } = await getAuth("/api/v2/jobs");
    const arr       = Array.isArray(body) ? body : [];
    const demoCount = arr.filter((j: any) => /^job_\d+$/.test(j.id ?? "")).length;
    record(
      "GET  /api/v2/jobs (10 demo jobs)",
      "≥10 rows, 10 demo IDs (job_*)",
      `HTTP ${status}, ${arr.length} total, ${demoCount} demo (job_*)`,
      status === 200 && demoCount === 10,
    );
  }

  // 9. Monitoring events — aggregate per-property (no top-level list route)
  {
    let totalDemo = 0;
    let fetchErr  = false;
    const detail: string[] = [];

    for (const propId of PROP_IDS) {
      const { status, body } = await getAuth(`/api/v2/properties/${propId}/events`);
      if (status !== 200) { fetchErr = true; detail.push(`${propId}: HTTP ${status}`); continue; }
      const arr  = Array.isArray(body) ? body : [];
      const demo = arr.filter((e: any) => /^mevt_\d+$/.test(e.id ?? "")).length;
      totalDemo += demo;
    }

    record(
      "GET  /api/v2/properties/*/events (12 demo events)",
      "12 demo events across 5 props",
      fetchErr
        ? `FETCH ERROR: ${detail.join(", ")}`
        : `${totalDemo} demo (mevt_*) across 5 props`,
      !fetchErr && totalDemo === 12,
    );
  }

  // 10. Retainer ledger — aggregate per-property (no top-level list route)
  //     NOTE: GET /properties/:id/retainer calls propertiesRepo.getById internally
  //     which fails with HTTP 500 due to schema-drift (missing columns in live DB).
  //     This is a pre-existing issue — the seed data IS correct in the DB.
  {
    let totalDemo = 0;
    let fetchErr  = false;
    const detail: string[] = [];

    for (const propId of PROP_IDS) {
      const { status, body } = await getAuth(`/api/v2/properties/${propId}/retainer`);
      if (status !== 200) {
        fetchErr = true;
        const note = status === 500 ? `HTTP 500 (blocked by schema-drift — missing columns in DB)` : `HTTP ${status}`;
        detail.push(`${propId}: ${note}`);
        continue;
      }
      const ledger  = (body as any)?.ledger;
      if (!Array.isArray(ledger)) { fetchErr = true; detail.push(`${propId}: no ledger array`); continue; }
      const demo = ledger.filter((e: any) => /^rl_\d+$/.test(e.id ?? "")).length;
      totalDemo += demo;
    }

    record(
      "GET  /api/v2/properties/*/retainer ledger (14)",
      "14 demo ledger entries across 5 props",
      fetchErr
        ? (detail[0] ?? "FETCH ERROR")
        : `${totalDemo} demo (rl_*) across 5 props`,
      !fetchErr && totalDemo === 14,
    );
  }

  // 11. Billing state — verify per-property via GET /properties/:id
  //     (no /billing-state-log list route in v2 API)
  //     All 5 demo properties should have billing_state = 'current' per 10M/10O seed.
  //     NOTE: Same schema-drift as check #7 causes HTTP 500 on this endpoint.
  //     Pre-existing issue; seed data is correct in the DB.
  {
    let allMatch = true;
    let fetchErr = false;
    const mismatches: string[] = [];
    const detail: string[] = [];

    for (const propId of PROP_IDS) {
      const { status, body } = await getAuth(`/api/v2/properties/${propId}`);
      if (status !== 200) {
        fetchErr = true;
        const note = status === 500 ? `HTTP 500 (blocked by schema-drift)` : `HTTP ${status}`;
        detail.push(`${propId}: ${note}`);
        continue;
      }
      // Drizzle camelCases columns; raw pg may return snake_case
      const state = (body as any)?.billingState ?? (body as any)?.billing_state;
      if (state !== "current") {
        allMatch = false;
        mismatches.push(`${propId}='${state}'`);
      }
    }

    record(
      "GET  /api/v2/properties/*/billing_state (all 'current')",
      "All 5 props billing_state='current'",
      fetchErr
        ? (detail[0] ?? "FETCH ERROR")
        : allMatch
          ? "All 5 props = 'current'"
          : `Mismatch: ${mismatches.join("; ")}`,
      !fetchErr && allMatch,
    );
  }

  // 12. Account-level events list — GET /api/v2/events (Brick 10U)
  //     Expects 12 demo events (mevt_01..12) across all 5 properties, newest-first.
  {
    const { status, body } = await getAuth("/api/v2/events?limit=500");
    const arr  = status === 200 && Array.isArray(body) ? body : [];
    const demo = arr.filter((e: any) => /^mevt_\d+$/.test(e.id ?? "")).length;

    // Verify newest-first ordering
    let ordered = true;
    for (let i = 1; i < arr.length; i++) {
      const a = new Date(arr[i - 1].createdAt ?? 0).getTime();
      const b = new Date(arr[i].createdAt     ?? 0).getTime();
      if (a < b) { ordered = false; break; }
    }

    record(
      "GET  /api/v2/events (account-level list — 12 demo events)",
      "HTTP 200, 12 mevt_* events, newest-first",
      status !== 200
        ? `HTTP ${status}`
        : `HTTP 200, ${demo} mevt_* events, ordered=${ordered}`,
      status === 200 && demo === 12 && ordered,
    );
  }

  // 13. Account-level events — severity filter (?severity=critical → 1 event)
  //     mevt_08 is the only critical event across all seeded properties.
  {
    const { status, body } = await getAuth("/api/v2/events?severity=critical");
    const arr    = status === 200 && Array.isArray(body) ? body : [];
    const count  = arr.length;
    const first  = arr[0]?.id ?? "(none)";
    const allCrit = arr.every((e: any) => e.severity === "critical");

    record(
      "GET  /api/v2/events?severity=critical (1 critical event — mevt_08)",
      "HTTP 200, count=1, id=mevt_08",
      status !== 200
        ? `HTTP ${status}`
        : `HTTP 200, count=${count}, first=${first}, allCritical=${allCrit}`,
      status === 200 && count === 1 && first === "mevt_08" && allCrit,
    );
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║        SRSC v2 API Smoke Test  —  Brick 10U                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  try {
    await runPublicChecks();
    await runAuthChecks();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nUnhandled error: ${msg}`);
    results.push({ endpoint: "<runner>", expected: "no error", actual: msg, status: "ERROR" });
    anyFail = true;
  }

  printTable();

  if (anyFail) {
    console.error("Smoke test FAILED — see rows marked ✗ above.");
    process.exit(1);
  } else {
    console.log("Smoke test PASSED.");
    process.exit(0);
  }
}

main();
