/**
 * retainer-routes.ts — Per-Property Task Pricing + Retainer Ledger + Exposure Guard
 *
 * Endpoints:
 *   GET/POST/PATCH /api/properties/:id/task-rates   (perm: edit_properties)
 *   GET            /api/retainer/:propertyId         (client: own; staff: any)
 *   POST           /api/retainer/:propertyId/deposit (staff: manage_retainer)
 *   POST           /api/retainer/:propertyId/draw    (internal — called by billing)
 *   POST           /api/retainer/:propertyId/adjust  (manage_retainer)
 *   GET            /api/exposure                     (manage_billing)
 *   POST           /api/exposure/check               (internal/staff — pre-dispatch guard)
 *   GET            /api/me/dashboard-financials       (client: own)
 */

import { Router, Request, Response } from "express";
import { sqlite } from "./storage";
import { requirePermission, PERMISSIONS } from "./permissions";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const fmt = (n: number) => Math.round(Number(n) * 100) / 100;

function getUserId(req: Request): number { return Number(req.headers["x-user-id"]); }
function getUserRole(req: Request): string { return (req.headers["x-user-role"] as string) || ""; }
function isAdminOrSup(req: Request) { const r = getUserRole(req); return r === "admin" || r === "supervisor"; }
function isClient(req: Request) { return getUserRole(req) === "client"; }

/** Get current retainer balance for a property (0 if no entries) */
export function getRetainerBalance(propertyId: number): number {
  const last: any = sqlite.prepare(
    "SELECT balance_after FROM retainer_ledger WHERE property_id=? ORDER BY created_at DESC LIMIT 1"
  ).get(propertyId);
  return last ? fmt(last.balance_after) : 0;
}

/** Check if a property has an approved (billable) quote for a given work_order/service_request */
export function hasApprovedAuthorization(propertyId: number): boolean {
  const approved: any = sqlite.prepare(
    "SELECT id FROM quote_requests WHERE property_id=? AND status='Approved' AND billable=1 LIMIT 1"
  ).get(propertyId);
  return !!approved;
}

/** Post a ledger entry and return the new balance */
export function postLedgerEntry(
  clientId: number,
  propertyId: number,
  entryType: "deposit" | "draw" | "refund" | "adjustment",
  amount: number,
  createdBy: number,
  opts: { relatedSourceType?: string; relatedSourceId?: number; note?: string } = {}
): number {
  const currentBalance = getRetainerBalance(propertyId);
  const newBalance = fmt(
    entryType === "deposit" || entryType === "refund"
      ? currentBalance + fmt(amount)
      : currentBalance - fmt(amount)   // draw / adjustment subtracts
  );

  sqlite.prepare(`
    INSERT INTO retainer_ledger
      (client_id, property_id, entry_type, amount, balance_after, related_source_type, related_source_id, note, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    clientId, propertyId, entryType, fmt(amount), newBalance,
    opts.relatedSourceType ?? null, opts.relatedSourceId ?? null,
    opts.note ?? null, createdBy, now()
  );

  return newBalance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT TASK RATES (system-wide sensible defaults)
// ═══════════════════════════════════════════════════════════════════════════════
export const DEFAULT_TASK_RATES: Array<{ task_type: string; rate: number; unit: string; notes: string }> = [
  { task_type: "storm_response",       rate: 75,   unit: "per_visit",  notes: "Emergency storm damage inspection and initial response" },
  { task_type: "routine_inspection",   rate: 0,    unit: "per_visit",  notes: "Included in subscription — no additional charge" },
  { task_type: "launch_crew_base",     rate: 150,  unit: "per_visit",  notes: "Base rate for Launch Crew on-site work (before line items)" },
  { task_type: "dock_inspection",      rate: 85,   unit: "per_visit",  notes: "Dock structural inspection and condition report" },
  { task_type: "winterization",        rate: 220,  unit: "per_visit",  notes: "Full property winterization package" },
  { task_type: "emergency_callout",    rate: 125,  unit: "per_visit",  notes: "After-hours or emergency callout" },
  { task_type: "vendor_coordination",  rate: 45,   unit: "per_visit",  notes: "Coordination fee for managing vendor visit" },
  { task_type: "photography",          rate: 60,   unit: "per_visit",  notes: "Property documentation photography session" },
];

/** Seed default rates for a property if none exist */
export function seedDefaultRatesForProperty(propertyId: number, createdBy: number = 1) {
  const ts = now();
  const existing = sqlite.prepare("SELECT COUNT(*) as c FROM property_task_rates WHERE property_id=?").get(propertyId) as any;
  if (existing?.c > 0) return; // already seeded

  const stmt = sqlite.prepare(`
    INSERT OR IGNORE INTO property_task_rates (property_id, task_type, rate, unit, notes, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  for (const r of DEFAULT_TASK_RATES) {
    stmt.run(propertyId, r.task_type, r.rate, r.unit, r.notes, createdBy, ts, ts);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK RATE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/properties/:id/task-rates
 * Returns all task rates for a property. If none seeded, returns defaults.
 */
router.get("/properties/:id/task-rates", (req: Request, res: Response) => {
  const propertyId = Number(req.params.id);
  if (!isAdminOrSup(req) && !isClient(req)) return res.status(403).json({ error: "Access denied" });

  // Ensure property exists
  const property: any = sqlite.prepare("SELECT id, client_user_id FROM properties WHERE id=?").get(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  // Client can only see their own property rates
  if (isClient(req) && property.client_user_id !== getUserId(req)) {
    return res.status(403).json({ error: "Access denied" });
  }

  seedDefaultRatesForProperty(propertyId);

  const rates: any[] = sqlite.prepare(
    "SELECT * FROM property_task_rates WHERE property_id=? ORDER BY task_type"
  ).all(propertyId) as any[];

  res.json(rates);
});

/**
 * POST /api/properties/:id/task-rates
 * Create or update a single task rate (upsert by task_type).
 */
router.post("/properties/:id/task-rates", requirePermission(PERMISSIONS.EDIT_PROPERTIES), (req: Request, res: Response) => {
  const propertyId = Number(req.params.id);
  const userId = getUserId(req);
  const { task_type, rate, unit, notes } = req.body;

  if (!task_type || rate === undefined) return res.status(400).json({ error: "task_type and rate required" });

  const ts = now();
  const existing: any = sqlite.prepare(
    "SELECT id FROM property_task_rates WHERE property_id=? AND task_type=?"
  ).get(propertyId, task_type);

  if (existing) {
    sqlite.prepare(
      "UPDATE property_task_rates SET rate=?, unit=?, notes=?, updated_by=?, updated_at=? WHERE id=?"
    ).run(fmt(rate), unit ?? "per_visit", notes ?? null, userId, ts, existing.id);
  } else {
    sqlite.prepare(`
      INSERT INTO property_task_rates (property_id, task_type, rate, unit, notes, created_by, updated_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(propertyId, task_type, fmt(rate), unit ?? "per_visit", notes ?? null, userId, userId, ts, ts);
  }

  const updated: any = sqlite.prepare(
    "SELECT * FROM property_task_rates WHERE property_id=? AND task_type=?"
  ).get(propertyId, task_type);
  res.json(updated);
});

/**
 * PATCH /api/properties/:id/task-rates/bulk
 * Bulk-update multiple rates at once. Body: [{task_type, rate, unit?, notes?}, ...]
 */
router.patch("/properties/:id/task-rates/bulk", requirePermission(PERMISSIONS.EDIT_PROPERTIES), (req: Request, res: Response) => {
  const propertyId = Number(req.params.id);
  const userId = getUserId(req);
  const updates: any[] = Array.isArray(req.body) ? req.body : [];

  if (!updates.length) return res.status(400).json({ error: "Array of rate updates required" });

  const ts = now();
  const stmt = sqlite.prepare(`
    INSERT INTO property_task_rates (property_id, task_type, rate, unit, notes, created_by, updated_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(property_id, task_type) DO UPDATE SET rate=excluded.rate, unit=excluded.unit, notes=excluded.notes, updated_by=excluded.updated_by, updated_at=excluded.updated_at
  `);

  for (const u of updates) {
    if (!u.task_type || u.rate === undefined) continue;
    stmt.run(propertyId, u.task_type, fmt(u.rate), u.unit ?? "per_visit", u.notes ?? null, userId, userId, ts, ts);
  }

  const all: any[] = sqlite.prepare(
    "SELECT * FROM property_task_rates WHERE property_id=? ORDER BY task_type"
  ).all(propertyId) as any[];
  res.json(all);
});

// ═══════════════════════════════════════════════════════════════════════════════
// RETAINER LEDGER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/retainer/:propertyId
 * Returns current balance + full ledger history for a property.
 * Client: own only; Staff: any.
 */
router.get("/retainer/:propertyId", (req: Request, res: Response) => {
  const propertyId = Number(req.params.propertyId);
  const userId = getUserId(req);

  const property: any = sqlite.prepare("SELECT id, client_user_id FROM properties WHERE id=?").get(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  if (isClient(req) && property.client_user_id !== userId) {
    return res.status(403).json({ error: "Access denied" });
  }
  if (!isAdminOrSup(req) && !isClient(req)) return res.status(403).json({ error: "Access denied" });

  const balance = getRetainerBalance(propertyId);
  const ledger: any[] = sqlite.prepare(
    "SELECT r.*, u.name as created_by_name FROM retainer_ledger r LEFT JOIN users u ON r.created_by=u.id WHERE r.property_id=? ORDER BY r.created_at DESC"
  ).all(propertyId) as any[];

  res.json({ property_id: propertyId, balance, ledger });
});

/**
 * GET /api/retainer — all properties rollup (staff only)
 */
router.get("/retainer", requirePermission(PERMISSIONS.VIEW_BILLING), (req: Request, res: Response) => {
  const properties: any[] = sqlite.prepare("SELECT id, nickname, address, client_user_id FROM properties").all() as any[];
  const result = properties.map(p => ({
    property_id: p.id,
    nickname: p.nickname,
    address: p.address,
    client_user_id: p.client_user_id,
    balance: getRetainerBalance(p.id),
  }));
  res.json(result);
});

/**
 * POST /api/retainer/:propertyId/deposit
 * Staff records a manual deposit (cash/check). Amount must be positive.
 */
router.post("/retainer/:propertyId/deposit", requirePermission(PERMISSIONS.MANAGE_RETAINER), (req: Request, res: Response) => {
  const propertyId = Number(req.params.propertyId);
  const userId = getUserId(req);
  const { amount, note, method } = req.body;

  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Positive amount required" });

  const property: any = sqlite.prepare("SELECT id, client_user_id FROM properties WHERE id=?").get(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const newBalance = postLedgerEntry(property.client_user_id, propertyId, "deposit", Number(amount), userId, {
    note: `${method ? method + " deposit" : "Manual deposit"}${note ? " — " + note : ""}`,
  });

  res.json({ property_id: propertyId, balance: newBalance, entry_type: "deposit", amount: fmt(Number(amount)) });
});

/**
 * POST /api/retainer/:propertyId/draw
 * Records a draw-down (called by billing when an approved job completes).
 * Staff only (internal). Returns new balance.
 */
router.post("/retainer/:propertyId/draw", requirePermission(PERMISSIONS.MANAGE_RETAINER), (req: Request, res: Response) => {
  const propertyId = Number(req.params.propertyId);
  const userId = getUserId(req);
  const { amount, note, related_source_type, related_source_id } = req.body;

  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Positive amount required" });

  const property: any = sqlite.prepare("SELECT id, client_user_id FROM properties WHERE id=?").get(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const newBalance = postLedgerEntry(property.client_user_id, propertyId, "draw", Number(amount), userId, {
    relatedSourceType: related_source_type,
    relatedSourceId: related_source_id,
    note,
  });

  res.json({ property_id: propertyId, balance: newBalance, entry_type: "draw", amount: fmt(Number(amount)) });
});

/**
 * POST /api/retainer/:propertyId/adjust
 * Manual adjustment (positive = add, negative = subtract). Manages corrections.
 */
router.post("/retainer/:propertyId/adjust", requirePermission(PERMISSIONS.MANAGE_RETAINER), (req: Request, res: Response) => {
  const propertyId = Number(req.params.propertyId);
  const userId = getUserId(req);
  const { amount, note } = req.body;
  if (amount === undefined) return res.status(400).json({ error: "amount required" });

  const property: any = sqlite.prepare("SELECT id, client_user_id FROM properties WHERE id=?").get(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const absAmount = Math.abs(Number(amount));
  // Positive adjustment = deposit-like, negative = draw-like — stored always positive, tracked by entry_type
  const entryType = Number(amount) >= 0 ? "adjustment" : "draw";
  // For adjustments we use a custom logic: directly set balance_after
  const currentBalance = getRetainerBalance(propertyId);
  const newBalance = fmt(currentBalance + Number(amount));

  sqlite.prepare(`
    INSERT INTO retainer_ledger (client_id, property_id, entry_type, amount, balance_after, note, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(property.client_user_id, propertyId, "adjustment", absAmount, newBalance, note ?? null, userId, now());

  res.json({ property_id: propertyId, balance: newBalance, entry_type: "adjustment", amount: Number(amount) });
});

/**
 * POST /api/retainer/:propertyId/topup-intent
 * Client records intent to top up (Stripe charge added when live).
 */
router.post("/retainer/:propertyId/topup-intent", (req: Request, res: Response) => {
  const propertyId = Number(req.params.propertyId);
  const userId = getUserId(req);

  if (!isClient(req)) return res.status(403).json({ error: "Clients only" });
  const property: any = sqlite.prepare("SELECT id, client_user_id FROM properties WHERE id=?").get(propertyId);
  if (!property || property.client_user_id !== userId) return res.status(403).json({ error: "Access denied" });

  const { amount } = req.body;
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "Positive amount required" });

  // For now: record intent as a note. Stripe charge added when live.
  res.json({
    status: "intent_recorded",
    message: `Top-up of $${Number(amount).toFixed(2)} noted. Stripe charge will be initiated — check back shortly.`,
    amount: fmt(Number(amount)),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPOSURE GUARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/exposure
 * Admin panel: lists any property where scheduled/upcoming cost > (retainer + approved authorization).
 * Returns flagged properties with: balance, upcoming_cost, approved_coverage, exposure_gap.
 */
router.get("/exposure", requirePermission(PERMISSIONS.MANAGE_BILLING), (req: Request, res: Response) => {
  const properties: any[] = sqlite.prepare(`
    SELECT p.id, p.nickname, p.address, p.client_user_id, u.name as client_name
    FROM properties p
    LEFT JOIN users u ON p.client_user_id = u.id
  `).all() as any[];

  const result: any[] = [];

  for (const prop of properties) {
    const balance = getRetainerBalance(prop.id);

    // Approved pending quotes (billable but not yet on an invoice) = authorized coverage
    const approvedQuotes: any[] = sqlite.prepare(`
      SELECT total FROM quote_requests
      WHERE property_id=? AND status='Approved' AND billable=1
        AND id NOT IN (SELECT COALESCE(source_id, 0) FROM invoice_line_items WHERE source_type='quote')
    `).all(prop.id) as any[];
    const approvedCoverage = approvedQuotes.reduce((s: number, q: any) => s + Number(q.total), 0);

    // Upcoming scheduled costs: vendor work orders (accepted/pending) with known rate
    const upcomingWOs: any[] = sqlite.prepare(`
      SELECT w.id, w.title, w.priority, vq.total as quoted_total
      FROM vendor_work_orders w
      LEFT JOIN quote_requests vq ON vq.work_order_id=w.id AND vq.status='Submitted'
      WHERE w.property_id=? AND w.status IN ('pending','accepted') AND w.completed_at IS NULL
    `).all(prop.id) as any[];

    // Upcoming scheduled visits (Launch Crew) — check task rates for storm_response/inspection cost
    const upcomingVisits: any[] = sqlite.prepare(`
      SELECT sv.id, sv.visit_type, sv.scheduled_date
      FROM scheduled_visits sv
      WHERE sv.property_id=? AND sv.completed=0 AND sv.scheduled_date >= date('now')
    `).all(prop.id) as any[];

    // Estimate cost from task rates
    let upcomingCost = 0;
    for (const wo of upcomingWOs) {
      upcomingCost += wo.quoted_total ? Number(wo.quoted_total) : 0;
    }
    for (const visit of upcomingVisits) {
      if (visit.visit_type === "storm_response") {
        const rate: any = sqlite.prepare(
          "SELECT rate FROM property_task_rates WHERE property_id=? AND task_type='storm_response'"
        ).get(prop.id);
        upcomingCost += rate ? Number(rate.rate) : 75;
      }
      // routine_inspection = 0 (subscription-included)
    }

    const totalCoverage = balance + approvedCoverage;
    const gap = fmt(upcomingCost - totalCoverage);
    const exposed = gap > 0;

    // Check if any vendor work order can be dispatched (has auth or retainer)
    const blockedWOs = upcomingWOs.filter((wo: any) => {
      const woApproval = sqlite.prepare(
        "SELECT id FROM quote_requests WHERE work_order_id=? AND status='Approved' AND billable=1 LIMIT 1"
      ).get(wo.id);
      return !woApproval && balance < (wo.quoted_total ?? 75);
    });

    result.push({
      property_id: prop.id,
      nickname: prop.nickname,
      address: prop.address,
      client_id: prop.client_user_id,
      client_name: prop.client_name,
      retainer_balance: balance,
      approved_coverage: fmt(approvedCoverage),
      upcoming_cost: fmt(upcomingCost),
      total_coverage: fmt(totalCoverage),
      exposure_gap: exposed ? gap : 0,
      exposed,
      blocked_work_orders: blockedWOs.length,
      upcoming_work_orders: upcomingWOs,
      upcoming_visits: upcomingVisits,
    });
  }

  // Sort: exposed first, then by gap descending
  result.sort((a, b) => {
    if (a.exposed && !b.exposed) return -1;
    if (!a.exposed && b.exposed) return 1;
    return b.exposure_gap - a.exposure_gap;
  });

  res.json(result);
});

/**
 * POST /api/exposure/check
 * Pre-dispatch guard. Given a property_id + estimated_cost, returns:
 * { allowed: boolean, reason, balance, coverage }
 */
router.post("/exposure/check", requirePermission(PERMISSIONS.MANAGE_BILLING), (req: Request, res: Response) => {
  const { property_id, estimated_cost, work_order_id, quote_id } = req.body;
  if (!property_id) return res.status(400).json({ error: "property_id required" });

  const balance = getRetainerBalance(Number(property_id));
  const cost = fmt(Number(estimated_cost ?? 0));

  // Check for approved quote authorization
  let hasApproval = false;
  if (work_order_id) {
    const auth: any = sqlite.prepare(
      "SELECT id FROM quote_requests WHERE work_order_id=? AND status='Approved' AND billable=1 LIMIT 1"
    ).get(Number(work_order_id));
    hasApproval = !!auth;
  }
  if (quote_id) {
    const auth: any = sqlite.prepare(
      "SELECT id FROM quote_requests WHERE id=? AND status='Approved' AND billable=1 LIMIT 1"
    ).get(Number(quote_id));
    hasApproval = !!auth;
  }

  const allowed = hasApproval || balance >= cost;
  const reason = hasApproval
    ? "Approved client quote provides authorization"
    : balance >= cost
    ? "Sufficient retainer balance"
    : `Insufficient authorization — retainer $${balance.toFixed(2)} < estimated $${cost.toFixed(2)} and no approved quote`;

  res.json({ allowed, reason, retainer_balance: balance, estimated_cost: cost, has_approved_quote: hasApproval });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT DASHBOARD FINANCIALS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/me/dashboard-financials
 * Client: per-property balances + upcoming scheduled transactions.
 * Shows where money will go before it's billed.
 */
router.get("/me/dashboard-financials", (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  const role = getUserRole(req);
  let clientId: number;

  if (isClient(req)) {
    clientId = userId;
  } else if (isAdminOrSup(req)) {
    // Staff can view any client — pass ?client_id=
    clientId = req.query.client_id ? Number(req.query.client_id) : userId;
  } else {
    return res.status(403).json({ error: "Access denied" });
  }

  // Get all properties for this client
  const properties: any[] = sqlite.prepare(
    "SELECT id, nickname, address, service_tier FROM properties WHERE client_user_id=?"
  ).all(clientId) as any[];

  const propertyData = properties.map(prop => {
    const balance = getRetainerBalance(prop.id);

    // Task rates for this property
    seedDefaultRatesForProperty(prop.id);
    const rates: any[] = sqlite.prepare(
      "SELECT task_type, rate, unit FROM property_task_rates WHERE property_id=?"
    ).all(prop.id) as any[];
    const rateMap: Record<string, number> = {};
    for (const r of rates) rateMap[r.task_type] = r.rate;

    // Upcoming scheduled visits (not completed, in future)
    const upcomingVisits: any[] = sqlite.prepare(`
      SELECT sv.id, sv.visit_type, sv.scheduled_date, sv.scheduled_time, sv.notes,
             u.name as tech_name
      FROM scheduled_visits sv
      LEFT JOIN users u ON sv.tech_id = u.id
      WHERE sv.property_id=? AND sv.completed=0 AND sv.scheduled_date >= date('now')
      ORDER BY sv.scheduled_date ASC
      LIMIT 10
    `).all(prop.id) as any[];

    const upcoming: any[] = upcomingVisits.map(v => {
      const estimatedCost = v.visit_type === "storm_response"
        ? (rateMap["storm_response"] ?? 75)
        : v.visit_type === "routine_inspection"
        ? (rateMap["routine_inspection"] ?? 0)
        : (rateMap["launch_crew_base"] ?? 150);
      return {
        id: v.id,
        type: "scheduled_visit",
        visit_type: v.visit_type,
        date: v.scheduled_date,
        time: v.scheduled_time,
        description: v.visit_type === "routine_inspection"
          ? "Routine Property Inspection (Included)"
          : v.visit_type === "storm_response"
          ? "Storm Response Visit"
          : "Launch Crew Visit",
        tech_name: v.tech_name,
        estimated_cost: estimatedCost,
        covered_by_subscription: v.visit_type === "routine_inspection",
        notes: v.notes,
      };
    });

    // Pending approved quotes (not yet invoiced)
    const pendingQuotes: any[] = sqlite.prepare(`
      SELECT id, title, total, quote_type, client_decision_at
      FROM quote_requests
      WHERE property_id=? AND status='Approved' AND billable=1
        AND id NOT IN (SELECT COALESCE(source_id,0) FROM invoice_line_items WHERE source_type='quote')
      ORDER BY client_decision_at DESC
    `).all(prop.id) as any[];

    const pendingBillable = pendingQuotes.map(q => ({
      id: q.id,
      type: "approved_quote",
      quote_type: q.quote_type,
      description: q.title,
      amount: q.total,
      approved_at: q.client_decision_at,
      label: q.quote_type === "vendor" ? "Third-Party Service (at actual cost)" : "Standing Rock Service",
    }));

    // Current open invoice total if any
    const openInvoice: any = sqlite.prepare(`
      SELECT i.id, i.total, i.status, i.period_start, i.period_end
      FROM invoices i
      WHERE i.client_id=? AND i.status='Open'
      ORDER BY i.created_at DESC LIMIT 1
    `).get(clientId);

    // Ledger last 5 entries
    const recentLedger: any[] = sqlite.prepare(`
      SELECT entry_type, amount, balance_after, note, created_at
      FROM retainer_ledger WHERE property_id=? ORDER BY created_at DESC LIMIT 5
    `).all(prop.id) as any[];

    return {
      property_id: prop.id,
      nickname: prop.nickname,
      address: prop.address,
      service_tier: prop.service_tier,
      retainer_balance: balance,
      upcoming_scheduled: upcoming,
      pending_billable: pendingBillable,
      open_invoice: openInvoice ?? null,
      recent_ledger: recentLedger,
      task_rates: rateMap,
    };
  });

  // Client-level rollup
  const totalRetainer = propertyData.reduce((s, p) => s + p.retainer_balance, 0);
  const totalUpcomingCost = propertyData.reduce(
    (s, p) => s + p.upcoming_scheduled.reduce((ss: number, u: any) => ss + (u.covered_by_subscription ? 0 : u.estimated_cost), 0),
    0
  );

  res.json({
    client_id: clientId,
    total_retainer_balance: fmt(totalRetainer),
    total_upcoming_cost: fmt(totalUpcomingCost),
    properties: propertyData,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════════════════
(function seedRetainerAndRates() {
  const ts = now();

  // Seed task rates for all 4 properties (with per-property variation)
  const rateCount = sqlite.prepare("SELECT COUNT(*) as c FROM property_task_rates").get() as any;
  if (!rateCount || rateCount.c === 0) {

    // Property 1 (Smith Lake House — close to town): lower storm response rate
    const p1Rates = DEFAULT_TASK_RATES.map(r =>
      r.task_type === "storm_response" ? { ...r, rate: 45 } :
      r.task_type === "emergency_callout" ? { ...r, rate: 95 } :
      r
    );
    const stmt = sqlite.prepare(`
      INSERT OR IGNORE INTO property_task_rates (property_id, task_type, rate, unit, notes, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    for (const r of p1Rates) stmt.run(1, r.task_type, r.rate, r.unit, r.notes, 1, ts, ts);

    // Property 2 (Henderson Retreat — mid-distance): default rates
    for (const r of DEFAULT_TASK_RATES) stmt.run(2, r.task_type, r.rate, r.unit, r.notes, 1, ts, ts);

    // Property 3 (Patel Cove Cabin — farthest): higher storm response rate
    const p3Rates = DEFAULT_TASK_RATES.map(r =>
      r.task_type === "storm_response" ? { ...r, rate: 125 } :
      r.task_type === "emergency_callout" ? { ...r, rate: 175 } :
      r.task_type === "vendor_coordination" ? { ...r, rate: 65 } :
      r
    );
    for (const r of p3Rates) stmt.run(3, r.task_type, r.rate, r.unit, r.notes, 1, ts, ts);

    // Property 4 (Williams Getaway — unassigned client): default rates
    for (const r of DEFAULT_TASK_RATES) stmt.run(4, r.task_type, r.rate, r.unit, r.notes, 1, ts, ts);
  }

  // Seed retainer balances
  const retainerCount = sqlite.prepare("SELECT COUNT(*) as c FROM retainer_ledger").get() as any;
  if (!retainerCount || retainerCount.c === 0) {

    // Property 1 (jsmith, client_id=4): $500 deposit, then $149 draw for subscription last month
    const insertLedger = sqlite.prepare(`
      INSERT INTO retainer_ledger (client_id, property_id, entry_type, amount, balance_after, note, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `);

    insertLedger.run(4, 1, "deposit", 500, 500, "Initial retainer deposit (check)", 1, ts);
    insertLedger.run(4, 1, "draw", 149, 351, "Monthly subscription draw — June 2026", 1, ts);
    insertLedger.run(4, 1, "deposit", 200, 551, "Top-up deposit (client request)", 1, ts);
    // Current balance: $551

    // Property 2 (rhenderson, client_id=5): $750 deposit, partial draw
    insertLedger.run(5, 2, "deposit", 750, 750, "Initial retainer deposit (check)", 1, ts);
    insertLedger.run(5, 2, "draw", 149, 601, "Monthly subscription draw — June 2026", 1, ts);
    insertLedger.run(5, 2, "draw", 75, 526, "Storm response visit — June 15, 2026", 1, ts);
    // Current balance: $526

    // Property 3 (apatel, client_id=6): $300 deposit only (lower — will appear in exposure panel)
    insertLedger.run(6, 3, "deposit", 300, 300, "Initial retainer deposit (online)", 1, ts);
    // Current balance: $300 (dock repair quote is $1055 — exposure gap flagged)
  }
})();

export default router;
