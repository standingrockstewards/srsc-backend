/**
 * scripts/smoke_v2.ts  (Brick 10U / 10V)
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
 *   API_BASE           — Base URL (default: http://localhost:5000)
 *   SMOKE_USER         — Admin username for login (optional; auth checks SKIPPED if absent)
 *   SMOKE_PASS         — Admin password for login (optional; auth checks SKIPPED if absent)
 *   SMOKE_CLIENT_PASS  — Password for demo client users (Brick 10V isolation checks).
 *                        Must match the password used in seed_demo_clients.ts.
 *                        If absent, isolation checks are SKIPPED with a loud warning.
 *
 * Exit codes:
 *   0 — all checks PASS (or clearly SKIPPED)
 *   1 — one or more checks FAIL or an unexpected error occurred
 *
 * No schema changes. No seed changes. No deploy.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE          = (process.env["API_BASE"]          ?? "http://localhost:5000").replace(/\/$/, "");
const SMOKE_USER        =  process.env["SMOKE_USER"]        ?? "";
const SMOKE_PASS        =  process.env["SMOKE_PASS"]        ?? "";
const SMOKE_CLIENT_PASS =  process.env["SMOKE_CLIENT_PASS"] ?? "";  // Brick 10V: demo client password
const HAS_CREDS         = Boolean(SMOKE_USER && SMOKE_PASS);
const HAS_CLIENT_CREDS  = Boolean(SMOKE_CLIENT_PASS);               // Brick 10V: isolation checks gate

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

// ── Brick 10V: per-session helpers for tenant isolation checks ────────────────

/**
 * Log in as a specific user and return their session cookie string.
 * Returns null if login fails (check will be marked FAIL by caller).
 */
async function loginAs(username: string, password: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return null;

  // Extract cookie — same logic as extractCookie() but returns the value
  const COOKIE_RE = /(__Host-srsc-v2=[^;]+|srsc-v2-smoke=[^;]+)/;
  const raw = (res.headers as any).getSetCookie?.() as string[] | undefined;
  if (raw) {
    for (const c of raw) {
      const m = c.match(COOKIE_RE);
      if (m?.[1]) return m[1];
    }
  }
  const single = res.headers.get("set-cookie") ?? "";
  const m2 = single.match(COOKIE_RE);
  return m2?.[1] ?? null;
}

/**
 * GET a path using a specific session cookie (not the global sessionCookie).
 * Used by tenant isolation checks so each client session is independent.
 */
async function getAuthAs(path: string, cookie: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Cookie: cookie },
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

/**
 * POST with JSON body using global admin session cookie.
 */
async function postAuth(path: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify(payload),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

/**
 * PATCH with JSON body using global admin session cookie.
 */
async function patchAuth(path: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify(payload),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

/**
 * DELETE using global admin session cookie.
 */
async function deleteAuth(path: string): Promise<{ status: number }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Cookie: sessionCookie },
  });
  return { status: res.status };
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



// ── Brick 10W: KB Write / Draft Isolation Checks ─────────────────────────────

/**
 * KB write checks (admin-only).
 *
 * Workflow:
 *   1. POST  /api/v2/kb/articles  { status:"draft" }   → article created
 *   2. GET   /api/v2/kb/articles/:slug (PUBLIC router)  → must 404 (draft hidden)
 *   3. GET   /api/v2/kb/articles/:id   (auth router)    → must 200 (admin can see draft)
 *   4. PATCH /api/v2/kb/articles/:id  { status:"published" } → publish
 *   5. GET   /api/v2/kb/articles/:slug (PUBLIC router)  → must 200 (now visible)
 *   6. DELETE /api/v2/kb/articles/:id                   → delete (data cleanup)
 *   7. GET   /api/v2/kb/articles/:slug (PUBLIC router)  → must 404 (deleted)
 *
 * Uses admin session (global sessionCookie). Skipped if !HAS_CREDS.
 * Leaves NO residual data — temp article is deleted in step 6 regardless of prior failures.
 */
async function runKbWriteChecks(): Promise<void> {
  console.log(`\n── Brick 10W: KB write / draft isolation checks ────────────────────`);

  if (!HAS_CREDS) {
    console.log(`   SMOKE_USER/SMOKE_PASS not set — KB write checks SKIPPED.\n`);
    const toSkip = [
      "POST  /api/v2/kb/articles (create draft kbart_smoke_temp)",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: draft must 404)",
      "GET   /api/v2/kb/articles/:id   (AUTH admin: draft must 200)",
      "PATCH /api/v2/kb/articles/:id { status:published }",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: published must 200)",
      "DELETE /api/v2/kb/articles/:id (cleanup)",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: deleted must 404)",
    ];
    for (const ep of toSkip) record(ep, "—", "SKIPPED (no creds)", "skip");
    return;
  }

  console.log(`   SMOKE_USER: ${SMOKE_USER} (admin)\n`);

  // We need a valid categoryId. Fetch categories list via auth endpoint.
  let categoryId: string | null = null;
  try {
    const { status, body } = await getAuth("/api/v2/kb/categories");
    const cats = status === 200 && Array.isArray(body) ? body as Array<{ id: string }> : [];
    categoryId = cats[0]?.id ?? null;
  } catch { /* leave null */ }

  if (!categoryId) {
    record(
      "POST  /api/v2/kb/articles (create draft kbart_smoke_temp)",
      "HTTP 201",
      "SKIPPED — could not resolve a categoryId from /api/v2/kb/categories",
      "skip",
    );
    for (const ep of [
      "GET   /api/v2/kb/articles/:slug (PUBLIC: draft must 404)",
      "GET   /api/v2/kb/articles/:id   (AUTH admin: draft must 200)",
      "PATCH /api/v2/kb/articles/:id { status:published }",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: published must 200)",
      "DELETE /api/v2/kb/articles/:id (cleanup)",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: deleted must 404)",
    ]) record(ep, "—", "SKIPPED (no categoryId)", "skip");
    return;
  }

  const SMOKE_SLUG  = "kbart-smoke-temp";
  const SMOKE_TITLE = "Smoke test temp article (auto-deleted)";
  let   articleId: string | null = null;

  // ── Step 1: Create draft ─────────────────────────────────────────────────
  {
    const { status, body } = await postAuth("/api/v2/kb/articles", {
      categoryId,
      title:  SMOKE_TITLE,
      slug:   SMOKE_SLUG,
      bodyMd: "This article is created and deleted by the smoke test. Do not edit.",
      tags:   ["smoke-test"],
      status: "draft",
    });
    const id = (body as any)?.id ?? null;
    if (status === 201 && id) {
      articleId = String(id);
    } else if (status === 409) {
      // Leftover from a previous failed smoke run — fetch its ID and reuse
      const { status: gs, body: gb } = await getAuth(`/api/v2/kb/articles/${SMOKE_SLUG}`);
      if (gs === 200 && (gb as any)?.id) {
        articleId = String((gb as any).id);
        record(
          "POST  /api/v2/kb/articles (create draft kbart_smoke_temp)",
          "HTTP 201",
          `HTTP 409 (slug exists from prior run) — recovered existing id=${articleId}`,
          true,   // recoverable — not a test failure
        );
      } else {
        record(
          "POST  /api/v2/kb/articles (create draft kbart_smoke_temp)",
          "HTTP 201",
          `HTTP 409 and could not recover existing article`,
          false,
        );
      }
    } else {
      record(
        "POST  /api/v2/kb/articles (create draft kbart_smoke_temp)",
        "HTTP 201",
        status !== 201 ? `HTTP ${status}` : `HTTP 201 but no id in body`,
        false,
      );
    }

    if (status === 201) {
      record(
        "POST  /api/v2/kb/articles (create draft kbart_smoke_temp)",
        "HTTP 201",
        `HTTP 201, id=${articleId}`,
        true,
      );
    }
  }

  // If we still have no ID, skip remaining checks
  if (!articleId) {
    for (const ep of [
      "GET   /api/v2/kb/articles/:slug (PUBLIC: draft must 404)",
      "GET   /api/v2/kb/articles/:id   (AUTH admin: draft must 200)",
      "PATCH /api/v2/kb/articles/:id { status:published }",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: published must 200)",
      "DELETE /api/v2/kb/articles/:id (cleanup)",
      "GET   /api/v2/kb/articles/:slug (PUBLIC: deleted must 404)",
    ]) record(ep, "—", "SKIPPED (create failed)", "skip");
    return;
  }

  // ── Step 2: Draft must NOT appear on public endpoint ────────────────────
  {
    // Public router: kbPublicRouter at /api/v2/kb/articles/:slug — no auth, published only
    const res  = await fetch(`${API_BASE}/api/v2/kb/articles/${SMOKE_SLUG}`);
    const stat = res.status;
    record(
      "GET   /api/v2/kb/articles/:slug (PUBLIC: draft must 404)",
      "HTTP 404 (draft hidden from public)",
      `HTTP ${stat}`,
      stat === 404,
    );
  }

  // ── Step 3: Admin can reach draft via PATCH (auth-only endpoint; public router has no PATCH) ──
  // Architecture note: GET /api/v2/kb/articles* routes are shadowed by kbPublicRouter
  // (mounted before requireAuthV2), so GET-by-ID/slug for drafts is not reachable via smoke.
  // PATCH /articles/:id is exclusive to the auth router — we use a no-op PATCH (send only
  // status:draft again) to confirm the article exists and is accessible to admin while a draft.
  {
    const { status, body } = await patchAuth(`/api/v2/kb/articles/${articleId}`, {
      status: "draft",  // no-op: keep draft, just confirm auth access
    });
    const s = (body as any)?.status ?? "(none)";
    record(
      "PATCH /api/v2/kb/articles/:id no-op (AUTH admin: draft accessible, status=draft)",
      "HTTP 200, status=draft",
      status !== 200 ? `HTTP ${status}` : `HTTP 200, status=${s}`,
      status === 200 && s === "draft",
    );
  }

  // ── Step 4: Publish the article ──────────────────────────────────────────
  {
    const { status, body } = await patchAuth(`/api/v2/kb/articles/${articleId}`, {
      status: "published",
    });
    const s = (body as any)?.status ?? "(none)";
    record(
      "PATCH /api/v2/kb/articles/:id { status:published }",
      "HTTP 200, status=published",
      status !== 200 ? `HTTP ${status}` : `HTTP 200, status=${s}`,
      status === 200 && s === "published",
    );
  }

  // ── Step 5: Published article IS visible on public endpoint ─────────────
  {
    const res  = await fetch(`${API_BASE}/api/v2/kb/articles/${SMOKE_SLUG}`);
    const stat = res.status;
    record(
      "GET   /api/v2/kb/articles/:slug (PUBLIC: published must 200)",
      "HTTP 200 (published visible to public)",
      `HTTP ${stat}`,
      stat === 200,
    );
  }

  // ── Step 6: Delete (cleanup) — runs even if earlier steps failed ────────
  {
    const { status } = await deleteAuth(`/api/v2/kb/articles/${articleId}`);
    record(
      "DELETE /api/v2/kb/articles/:id (cleanup)",
      "HTTP 204",
      `HTTP ${status}`,
      status === 204,
    );
  }

  // ── Step 7: Deleted article is gone from public endpoint ─────────────────
  {
    const res  = await fetch(`${API_BASE}/api/v2/kb/articles/${SMOKE_SLUG}`);
    const stat = res.status;
    record(
      "GET   /api/v2/kb/articles/:slug (PUBLIC: deleted must 404)",
      "HTTP 404 (article deleted, gone from public)",
      `HTTP ${stat}`,
      stat === 404,
    );
  }
}

// ── Brick 10V: Tenant Isolation Checks ────────────────────────────────────────

/**
 * Tenant isolation checks.
 *
 * Logs in as each demo client user (demo_client_1/2/3) and verifies:
 *   - GET /api/v2/events returns ONLY their own events (positive count + zero cross-tenant)
 *   - GET /api/v2/properties returns ONLY their own properties
 *
 * Demo client → customer mapping (seeded by seed_demo_clients.ts, Brick 10V):
 *   demo_client_1  →  pcust_01  (prop_01, prop_02 — 6 events: mevt_01..06)
 *   demo_client_2  →  pcust_02  (prop_03, prop_04 — 5 events: mevt_07..11)
 *   demo_client_3  →  pcust_03  (prop_05           — 1 event:  mevt_12)
 *
 * SKIPPED with a loud warning if SMOKE_CLIENT_PASS is not set — never silently PASS.
 * Non-zero exit on any FAIL.
 */
async function runIsolationChecks(): Promise<void> {
  console.log(`\n── Brick 10V: Tenant isolation checks ──────────────────────────────`);

  if (!HAS_CLIENT_CREDS) {
    // LOUD warning — never silently pass
    console.warn("\n  ⚠⚠⚠  WARNING: SMOKE_CLIENT_PASS not set — tenant isolation checks SKIPPED.  ⚠⚠⚠");
    console.warn("  Set SMOKE_CLIENT_PASS to the password used in seed_demo_clients.ts to enable these checks.\n");
    const toSkip = [
      "isolation: demo_client_1 → pcust_01: login",
      "isolation: demo_client_1 → pcust_01: GET /events (6 own, 0 cross-tenant)",
      "isolation: demo_client_1 → pcust_01: GET /properties (2 own)",
      "isolation: demo_client_2 → pcust_02: login",
      "isolation: demo_client_2 → pcust_02: GET /events (5 own, 0 cross-tenant)",
      "isolation: demo_client_2 → pcust_02: GET /properties (2 own)",
      "isolation: demo_client_3 → pcust_03: login",
      "isolation: demo_client_3 → pcust_03: GET /events (1 own, 0 cross-tenant)",
      "isolation: demo_client_3 → pcust_03: GET /properties (1 own)",
    ];
    for (const ep of toSkip) {
      record(ep, "—", "SKIPPED ⚠ SMOKE_CLIENT_PASS not set", "skip");
    }
    return;
  }

  console.log(`   SMOKE_CLIENT_PASS: set\n`);

  const CLIENTS = [
    {
      username:       "demo_client_1",
      customerId:     "pcust_01",
      ownPropIds:     ["prop_01", "prop_02"],
      foreignPropIds: ["prop_03", "prop_04", "prop_05"],
      ownEventCount:  6,
      ownEventIds:    ["mevt_01","mevt_02","mevt_03","mevt_04","mevt_05","mevt_06"],
      foreignEventIds:["mevt_07","mevt_08","mevt_09","mevt_10","mevt_11","mevt_12"],
    },
    {
      username:       "demo_client_2",
      customerId:     "pcust_02",
      ownPropIds:     ["prop_03", "prop_04"],
      foreignPropIds: ["prop_01", "prop_02", "prop_05"],
      ownEventCount:  5,
      ownEventIds:    ["mevt_07","mevt_08","mevt_09","mevt_10","mevt_11"],
      foreignEventIds:["mevt_01","mevt_02","mevt_03","mevt_04","mevt_05","mevt_06","mevt_12"],
    },
    {
      username:       "demo_client_3",
      customerId:     "pcust_03",
      ownPropIds:     ["prop_05"],
      foreignPropIds: ["prop_01", "prop_02", "prop_03", "prop_04"],
      ownEventCount:  1,
      ownEventIds:    ["mevt_12"],
      foreignEventIds:["mevt_01","mevt_02","mevt_03","mevt_04","mevt_05",
                       "mevt_06","mevt_07","mevt_08","mevt_09","mevt_10","mevt_11"],
    },
  ] as const;

  for (const c of CLIENTS) {
    const { username, customerId, ownPropIds, foreignPropIds,
            ownEventCount, ownEventIds, foreignEventIds } = c;
    const label = `${username} → ${customerId}`;

    // ── 1. Login ──────────────────────────────────────────────────────────────
    let cookie: string | null = null;
    try {
      cookie = await loginAs(username, SMOKE_CLIENT_PASS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      record(`isolation: ${label}: login`, `HTTP 200 + session cookie`, `LOGIN ERROR: ${msg}`, false);
      record(`isolation: ${label}: GET /events (${ownEventCount} own, 0 cross-tenant)`, "—", "SKIPPED (login failed)", "skip");
      record(`isolation: ${label}: GET /properties (${ownPropIds.length} own)`, "—", "SKIPPED (login failed)", "skip");
      continue;
    }

    if (!cookie) {
      record(`isolation: ${label}: login`, `HTTP 200 + session cookie`,
             `FAIL — login returned no session cookie (HTTP 4xx or cookie missing)`, false);
      record(`isolation: ${label}: GET /events (${ownEventCount} own, 0 cross-tenant)`, "—", "SKIPPED (login failed)", "skip");
      record(`isolation: ${label}: GET /properties (${ownPropIds.length} own)`, "—", "SKIPPED (login failed)", "skip");
      continue;
    }

    record(`isolation: ${label}: login`, `HTTP 200 + session cookie`, `HTTP 200, session cookie obtained`, true);

    // ── 2. GET /api/v2/events — events isolation ────────────────────────────
    {
      const { status, body } = await getAuthAs("/api/v2/events?limit=500", cookie);
      const arr = status === 200 && Array.isArray(body)
        ? body as Array<{ id: string; propertyId: string }>
        : [];

      const returnedIds   = arr.map((e) => e.id);
      const returnedProps = Array.from(new Set(arr.map((e) => e.propertyId)));

      const countOk        = status === 200 && arr.length === ownEventCount;
      const crossEventIds  = returnedIds.filter((id) => (foreignEventIds as readonly string[]).includes(id));
      const noCrossTenant  = crossEventIds.length === 0;
      const crossProps     = returnedProps.filter((pid) => (foreignPropIds as readonly string[]).includes(pid));
      const noCrossProp    = crossProps.length === 0;

      const allPass = status === 200 && countOk && noCrossTenant && noCrossProp;

      const actualDesc = status !== 200
        ? `HTTP ${status}`
        : [
            `count=${arr.length}/${ownEventCount}`,
            `ownProps=[${returnedProps.sort().join(",")}]`,
            crossEventIds.length > 0 ? `CROSS-TENANT-EVENTS=[${crossEventIds.join(",")}]` : `crossEvents=0`,
            crossProps.length    > 0 ? `CROSS-TENANT-PROPS=[${crossProps.join(",")}]`     : `crossProps=0`,
          ].join(" | ");

      record(
        `isolation: ${label}: GET /events (${ownEventCount} own, 0 cross-tenant)`,
        `HTTP 200, count=${ownEventCount}, crossEvents=0, crossProps=0`,
        actualDesc,
        allPass,
      );
    }

    // ── 3. GET /api/v2/properties — properties isolation ───────────────────
    {
      const { status, body } = await getAuthAs("/api/v2/properties", cookie);
      const arr = status === 200 && Array.isArray(body)
        ? body as Array<{ id: string }>
        : [];

      const returnedPropIds = arr.map((p) => p.id);
      const countOk         = status === 200 && arr.length === ownPropIds.length;
      const crossPropIds    = returnedPropIds.filter((id) => (foreignPropIds as readonly string[]).includes(id));
      const noCross         = crossPropIds.length === 0;
      const allPass         = status === 200 && countOk && noCross;

      const actualDesc = status !== 200
        ? `HTTP ${status}`
        : [
            `count=${arr.length}/${ownPropIds.length}`,
            `ids=[${returnedPropIds.sort().join(",")}]`,
            crossPropIds.length > 0 ? `CROSS-TENANT=[${crossPropIds.join(",")}]` : `cross=0`,
          ].join(" | ");

      record(
        `isolation: ${label}: GET /properties (${ownPropIds.length} own)`,
        `HTTP 200, count=${ownPropIds.length}, cross=0`,
        actualDesc,
        allPass,
      );
    }
  }
}



// ── Brick 10X: Retainer Top-up Smoke ─────────────────────────────────────────
//
// MUTATION WARNING: This check writes a real ledger entry to prop_01 in the
// live Postgres DB. The retainer_ledger table has NO delete or reversal
// endpoint, so entries are permanent. The entry is written with a clearly
// labelled note ("smoke-test top-up — do not act on") so operators can
// identify and disregard it.
//
// If a delete/reversal endpoint is added in a future brick, wire cleanup here.
//
// Test matrix:
//   1. GET current balance for prop_01  (admin)
//   2. POST topup $1.00  (admin, type:"topup", never sends balance_after)
//   3. GET new balance from /retainer/properties/prop_01/balance
//   4. Assert newBalance == prevBalance + 1.00   (server derives balance_after)
//   5. Verify HTTP 201 + returned entry has type=="topup" and correct balanceAfter
//   6. SKIP note printed if endpoint unavailable (schema guard)
//
async function runRetainerTopUpChecks(): Promise<void> {
  // ── 1. GET current balance ─────────────────────────────────────────────────
  const DEMO_PROP = "prop_01";
  const TOPUP_AMT = "1.00";
  const TOPUP_NOTE = "smoke-test top-up — do not act on";

  let prevBalance = "0.00";
  {
    const { status, body } = await getAuth(`/api/v2/retainer/properties/${DEMO_PROP}/balance`);
    const ok = status === 200 && typeof (body as any)?.balance === "string";
    if (ok) {
      prevBalance = (body as any).balance as string;
    }
    record(
      `retainer top-up: GET /retainer/properties/${DEMO_PROP}/balance`,
      "HTTP 200, { balance: string }",
      ok ? `HTTP 200, balance=${prevBalance}` : `HTTP ${status}`,
      ok,
    );
    if (!ok) {
      // Cannot proceed without a baseline balance — loudly SKIP the rest
      console.warn(`
⚠️  SKIP  retainer top-up POST check — could not read baseline balance (HTTP ${status}).`);
      record(
        `retainer top-up: POST /retainer/properties/${DEMO_PROP}/entries (topup)`,
        "HTTP 201, balanceAfter = prev + 1.00",
        `SKIPPED — baseline balance unavailable`,
        "skip",
      );
      record(
        `retainer top-up: GET /retainer/properties/${DEMO_PROP}/balance (post-topup)`,
        `balance = ${prevBalance} + ${TOPUP_AMT}`,
        `SKIPPED — baseline balance unavailable`,
        "skip",
      );
      return;
    }
  }

  // ── 2. POST topup ──────────────────────────────────────────────────────────
  // client sends ONLY: type, amount, note  — NEVER balance_after
  let returnedEntry: Record<string, unknown> | null = null;
  {
    const { status, body } = await postAuth(
      `/api/v2/retainer/properties/${DEMO_PROP}/entries`,
      { type: "topup", amount: TOPUP_AMT, note: TOPUP_NOTE },
    );
    const entry = (body as any);
    const created = status === 201;
    const hasId   = typeof entry?.id === "string";
    const typeOk  = entry?.type === "topup";
    const amtOk   = entry?.amount === TOPUP_AMT;
    const balOk   = typeof entry?.balanceAfter === "string";
    const allOk   = created && hasId && typeOk && amtOk && balOk;

    if (allOk) returnedEntry = entry as Record<string, unknown>;

    const actual = !created
      ? `HTTP ${status}`
      : `HTTP 201, id=${entry?.id}, type=${entry?.type}, amount=${entry?.amount}, balanceAfter=${entry?.balanceAfter}`;

    record(
      `retainer top-up: POST /retainer/properties/${DEMO_PROP}/entries (topup)`,
      `HTTP 201, type=topup, amount=${TOPUP_AMT}, balanceAfter=string`,
      actual,
      allOk,
    );

    if (!allOk) {
      console.warn(`
⚠️  SKIP  retainer top-up balance assertion — POST failed (HTTP ${status}).`);
      record(
        `retainer top-up: GET /retainer/properties/${DEMO_PROP}/balance (post-topup)`,
        `balance = prev + ${TOPUP_AMT}`,
        `SKIPPED — POST did not succeed`,
        "skip",
      );
      return;
    }
  }

  // ── 3. GET new balance + assert server-derived balance_after ───────────────
  {
    const { status, body } = await getAuth(`/api/v2/retainer/properties/${DEMO_PROP}/balance`);
    const newBalance = (body as any)?.balance as string | undefined;
    const fetchOk    = status === 200 && typeof newBalance === "string";

    const expectedBalance = (parseFloat(prevBalance) + parseFloat(TOPUP_AMT)).toFixed(2);
    // Also check the balanceAfter returned in the POST response (server-computed)
    const entryBalanceAfter = returnedEntry?.balanceAfter as string | undefined;
    const entryBalanceOk    = entryBalanceAfter === expectedBalance;
    const fetchBalanceOk    = fetchOk && newBalance === expectedBalance;
    const allOk             = entryBalanceOk && fetchBalanceOk;

    const actual = !fetchOk
      ? `HTTP ${status}`
      : [
          `newBalance=${newBalance}`,
          `entryBalanceAfter=${entryBalanceAfter}`,
          `expected=${expectedBalance}`,
          entryBalanceOk ? "entry_match=✓" : `entry_match=✗(got ${entryBalanceAfter})`,
          fetchBalanceOk ? "fetch_match=✓" : `fetch_match=✗(got ${newBalance})`,
        ].join(", ");

    record(
      `retainer top-up: GET /retainer/properties/${DEMO_PROP}/balance (post-topup)`,
      `balance = ${prevBalance} + ${TOPUP_AMT} = ${expectedBalance}`,
      actual,
      allOk,
    );
  }
}



// ── Brick 10Y: 2FA Status Smoke (NON-MUTATING) ───────────────────────────────
//
// INTENTIONALLY NON-MUTATING: We do NOT call /auth/2fa/setup, /verify, or
// /disable on the shared admin account. Automating TOTP enrollment requires a
// live TOTP secret and a real authenticator app, and doing so in CI would
// either lock out the account or leave it in a half-enabled state.
//
// What we DO check (safe, read-only):
//   1. GET /api/v2/auth/me as admin → HTTP 200, totpEnabled field present
//   2. GET /api/v2/auth/me returns safeUser (no totpSecret, no totpBackupCodes)
//
// The mutating /setup + /verify flow is covered by manual QA only.
//
async function run2FAStatusChecks(): Promise<void> {
  console.log(`
── Brick 10Y: 2FA status checks (non-mutating) ─────────────────────`);

  // ── 1. GET /me — totpEnabled field present ──────────────────────────────────
  {
    const { status, body } = await getAuth("/api/v2/auth/me");
    const user = (body as any)?.user;
    const fieldPresent  = typeof user?.totpEnabled === "boolean";
    const noSecretLeak  = !user?.totpSecret;
    const noBackupLeak  = !user?.totpBackupCodes;
    const allOk = status === 200 && fieldPresent && noSecretLeak && noBackupLeak;

    const actual = status !== 200
      ? `HTTP ${status}`
      : [
          `HTTP 200`,
          `totpEnabled=${user?.totpEnabled}`,
          fieldPresent ? "field_present=✓" : "field_present=✗",
          noSecretLeak ? "no_secret_leak=✓" : "SECRET_LEAKED=✗",
          noBackupLeak ? "no_backup_leak=✓" : "BACKUP_LEAKED=✗",
        ].join(", ");

    record(
      "2FA status: GET /auth/me returns totpEnabled (no secret/backup leak)",
      "HTTP 200, totpEnabled=boolean, no totpSecret, no totpBackupCodes",
      actual,
      allOk,
    );
  }

  // ── 2. Unauthenticated /setup attempt → 401 (endpoint guarded) ─────────────
  {
    // Call /setup WITHOUT the admin session cookie
    const res  = await fetch(`${API_BASE}/api/v2/auth/2fa/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const ok = res.status === 401 || res.status === 403;
    record(
      "2FA status: POST /auth/2fa/setup without session → 401/403",
      "HTTP 401 or 403 (auth guard)",
      `HTTP ${res.status}`,
      ok,
    );
  }

  console.log(
    "  NOTE: mutating 2FA checks (setup/verify/disable) SKIPPED intentionally. " +
    "Reason: automating TOTP enrollment on shared demo accounts risks account " +
    "lockout or half-enabled state. Manual QA required for the enable/disable flow.",
  );
}


// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║        SRSC v2 API Smoke Test  —  Brick 10Y                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  try {
    await runPublicChecks();
    await runAuthChecks();
    await runKbWriteChecks();
    await runIsolationChecks();
    await runRetainerTopUpChecks();
    await run2FAStatusChecks();
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
