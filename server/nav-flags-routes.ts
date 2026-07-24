/**
 * GET /api/nav-flags
 *
 * Returns a role-scoped map of attention counts for sidebar badges.
 * Each key maps to { count, severity } where severity is:
 *   "critical"   — red:    open Signal Flare, halted billing
 *   "attention"  — orange: pending review, past-due, unverified docs
 *   "info"       — sage:   unread message, new statement, minor items
 *
 * Security: counts are strictly scoped server-side by role and ownership.
 * No cross-tenant leakage.
 */
import { Router } from "express";
import Database from "better-sqlite3";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "data.db"));

export const navFlagsRouter = Router();

type Severity = "critical" | "attention" | "info";
interface FlagEntry { count: number; severity: Severity }
type FlagsMap = Record<string, FlagEntry>;

function flag(map: FlagsMap, key: string, count: number, severity: Severity) {
  if (count <= 0) return;
  if (map[key]) {
    map[key].count += count;
    // Escalate severity if higher
    const rank = { critical: 2, attention: 1, info: 0 };
    if (rank[severity] > rank[map[key].severity]) map[key].severity = severity;
  } else {
    map[key] = { count, severity };
  }
}

function count(sql: string, ...params: any[]): number {
  try {
    const row = sqlite.prepare(sql).get(...params) as any;
    return row?.c ?? row?.count ?? 0;
  } catch { return 0; }
}

navFlagsRouter.get("/nav-flags", (req, res) => {
  const userId = Number(req.headers["x-user-id"]);
  const role   = (req.headers["x-user-role"] as string) ?? "";

  if (!userId || !role) return res.status(401).json({ error: "Unauthenticated" });

  const flags: FlagsMap = {};

  try {
    // ─── ADMIN / SUPERVISOR ────────────────────────────────────────────────
    if (role === "admin" || role === "supervisor") {

      // Signal Flares — open/unacknowledged
      const openFlares = count("SELECT COUNT(*) as c FROM signal_flares WHERE status NOT IN ('Resolved','Closed','Acknowledged')");
      flag(flags, "signal-flares", openFlares, "critical");

      // Acknowledged but not resolved (lower severity)
      const ackedFlares = count("SELECT COUNT(*) as c FROM signal_flares WHERE status = 'Acknowledged'");
      flag(flags, "signal-flares", ackedFlares, "attention");

      // Quotes — vendor quote_requests awaiting staff review (In Review)
      const pendingQuotes = count("SELECT COUNT(*) as c FROM quote_requests WHERE status = 'In Review'");
      flag(flags, "quotes", pendingQuotes, "attention");

      // Vendor Management — vendors with submitted (unverified) docs
      const unverifiedVendorDocs = count("SELECT COUNT(DISTINCT vendor_id) as c FROM vendor_documents WHERE status = 'submitted' AND (verified_at IS NULL OR verified_at = '')");
      flag(flags, "vendors", unverifiedVendorDocs, "attention");

      // Service Requests — new/open requests
      const newSR = count("SELECT COUNT(*) as c FROM service_requests WHERE status = '' OR status IS NULL OR status = 'New' OR status = 'Open'");
      flag(flags, "service-requests", newSR, "attention");

      // Onboarding — pending sign-ups awaiting activation
      const pendingUsers = count("SELECT COUNT(*) as c FROM users WHERE status = 'pending'");
      flag(flags, "onboarding-queue", pendingUsers, "attention");

      // Billing — open disputes
      const openDisputes = count("SELECT COUNT(*) as c FROM billing_disputes WHERE status NOT IN ('Resolved','Resolved-Credited','Closed') AND status != 'Resolved-Credited'");
      flag(flags, "billing", openDisputes, "critical");

      // Billing — billing accounts in grace/past-due/halted
      const badBilling = count("SELECT COUNT(*) as c FROM client_billing_accounts WHERE status IN ('grace','past_due','halted','suspended')");
      flag(flags, "billing", badBilling, "critical");

      // Weather/Storm Events — unassigned new events
      const newStorm = count("SELECT COUNT(*) as c FROM storm_events WHERE status = 'new' AND (assigned_tech_id IS NULL OR assigned_tech_id = 0)");
      flag(flags, "storm-events", newStorm, "attention");

      // Messages — unread property messages sent by clients (not from admin/staff)
      const unreadMsgs = count(`
        SELECT COUNT(*) as c FROM property_messages pm
        JOIN users u ON u.id = pm.from_user_id
        WHERE pm.read_at IS NULL AND u.role = 'client'
      `);
      flag(flags, "messages", unreadMsgs, "info");

      // Unread vendor messages to admin
      const unreadVendorMsgs = count(`
        SELECT COUNT(*) as c FROM vendor_messages
        WHERE read_at IS NULL AND to_user_id = ?
      `, userId);
      flag(flags, "messages", unreadVendorMsgs, "info");

      // Retainer exposure — properties where latest retainer balance < one month's subscription cost
      // Use retainer_ledger: find most recent balance_after per property; flag if below threshold
      const lowRetainer = count(`
        SELECT COUNT(*) as c FROM (
          SELECT rl.property_id, rl.balance_after
          FROM retainer_ledger rl
          INNER JOIN (
            SELECT property_id, MAX(id) as max_id FROM retainer_ledger GROUP BY property_id
          ) latest ON rl.id = latest.max_id
          WHERE rl.balance_after < 150
        )
      `);
      flag(flags, "retainer", lowRetainer, "attention");
    }

    // ─── FIELD TECH ────────────────────────────────────────────────────────
    else if (role === "field_tech") {

      // Assigned visits today not completed
      const today = new Date().toISOString().split("T")[0];
      const todayVisits = count(`
        SELECT COUNT(*) as c FROM scheduled_visits sv
        JOIN properties p ON p.id = sv.property_id
        WHERE p.assigned_tech_id = ?
          AND sv.scheduled_date = ?
          AND sv.status NOT IN ('completed','cancelled')
      `, userId, today);
      flag(flags, "visits", todayVisits, "attention");

      // Signal flares assigned to this tech or on their properties
      const techFlares = count(`
        SELECT COUNT(*) as c FROM signal_flares sf
        JOIN properties p ON p.id = sf.property_id
        WHERE (sf.assigned_to = ? OR p.assigned_tech_id = ?)
          AND sf.status NOT IN ('Resolved','Closed')
      `, userId, userId);
      flag(flags, "signal-flares", techFlares, "critical");

      // Unread messages (property messages on their assigned properties)
      const techProps = sqlite.prepare("SELECT id FROM properties WHERE assigned_tech_id = ?").all(userId).map((r: any) => r.id);
      if (techProps.length > 0) {
        const placeholders = techProps.map(() => "?").join(",");
        const unreadTechMsgs = count(
          `SELECT COUNT(*) as c FROM property_messages WHERE read_at IS NULL AND property_id IN (${placeholders}) AND from_user_id != ?`,
          ...techProps, userId
        );
        flag(flags, "messages", unreadTechMsgs, "info");
      }
    }

    // ─── VENDOR ────────────────────────────────────────────────────────────
    else if (role === "vendor") {

      // Work orders — new/assigned orders needing action
      const pendingWO = count(`
        SELECT COUNT(*) as c FROM vendor_work_orders
        WHERE vendor_id = ? AND status IN ('assigned','new','pending')
      `, userId);
      flag(flags, "dashboard", pendingWO, "attention");

      // Documents — requested docs not yet uploaded
      const pendingDocs = count(`
        SELECT COUNT(*) as c FROM vendor_documents
        WHERE vendor_id = ? AND (status = 'pending' OR status = '' OR status IS NULL OR status = 'requested')
      `, userId);
      flag(flags, "dashboard", pendingDocs, "attention");

      // Unread messages from Standing Rock to this vendor
      const unreadVendor = count(`
        SELECT COUNT(*) as c FROM vendor_messages
        WHERE to_user_id = ? AND read_at IS NULL
      `, userId);
      flag(flags, "dashboard", unreadVendor, "info");
    }

    // ─── CLIENT ────────────────────────────────────────────────────────────
    else if (role === "client") {

      // Find this client's properties
      const clientProps = sqlite.prepare("SELECT id FROM properties WHERE client_user_id = ?").all(userId).map((r: any) => r.id);

      // Quotes — released/sent quotes awaiting client approval
      const pendingClientQuotes = count(`
        SELECT COUNT(*) as c FROM quotes
        WHERE client_id = ? AND status IN ('Sent','Released')
      `, userId);
      flag(flags, "quotes", pendingClientQuotes, "attention");

      // Quote requests sent to client
      const sentQR = count(`
        SELECT COUNT(*) as c FROM quote_requests
        WHERE client_id = ? AND status = 'Sent to Client'
      `, userId);
      flag(flags, "quotes", sentQR, "attention");

      // Billing — new issued invoices
      const newInvoices = count(`
        SELECT COUNT(*) as c FROM invoices
        WHERE client_id = ? AND status IN ('Issued','Open')
      `, userId);
      flag(flags, "billing", newInvoices, "info");

      // Billing — open disputes (client's own)
      const openClientDisputes = count(`
        SELECT COUNT(*) as c FROM billing_disputes
        WHERE client_id = ? AND status NOT IN ('Resolved','Resolved-Credited','Closed')
      `, userId);
      flag(flags, "billing", openClientDisputes, "attention");

      // Messages — unread replies from staff on this client's properties
      if (clientProps.length > 0) {
        const ph = clientProps.map(() => "?").join(",");
        const unreadClient = count(
          `SELECT COUNT(*) as c FROM property_messages pm
           JOIN users u ON u.id = pm.from_user_id
           WHERE pm.read_at IS NULL AND pm.property_id IN (${ph}) AND u.role != 'client'`,
          ...clientProps
        );
        flag(flags, "messages", unreadClient, "info");
      }

      // Service requests — status changes (requests that have been updated since created)
      const updatedSR = count(`
        SELECT COUNT(*) as c FROM service_requests
        WHERE client_id = ? AND updated_at != created_at
          AND status NOT IN ('Closed','Resolved','Completed')
      `, userId);
      flag(flags, "service-requests", updatedSR, "info");
    }

    res.json({ flags, ts: new Date().toISOString() });
  } catch (e: any) {
    console.error("[nav-flags]", e.message);
    res.status(500).json({ error: e.message });
  }
});
