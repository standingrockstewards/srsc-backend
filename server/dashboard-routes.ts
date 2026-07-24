/**
 * Dashboard KPI Routes — /api/dashboard/kpis
 * Admin + Supervisor only (view_dashboard permission).
 * Aggregates over existing tables — no source data duplication.
 *
 * Tier → MRR mapping (matches existing tier names in billing_accounts):
 *   signal_flare  = $500/mo
 *   anchor_watch  = $149/mo
 *   shipshape     = $149/mo  (same base, differentiated by add-ons)
 *   standard      = $149/mo  (legacy / generic)
 */

import { Router } from "express";
import { requirePermission } from "./permissions";
import { sqlite } from "./storage";

export const dashboardRouter = Router();

const TIER_MRR: Record<string, number> = {
  signal_flare: 500,
  anchor_watch:  149,
  shipshape:     149,
  standard:      149,
};

function tierMrr(tier: string | null | undefined): number {
  return TIER_MRR[(tier ?? "").toLowerCase()] ?? 149;
}

// ─── GET /api/dashboard/kpis?from=YYYY-MM-DD&to=YYYY-MM-DD ──────────────────
dashboardRouter.get(
  "/dashboard/kpis",
  requirePermission("view_dashboard"),
  (req, res) => {
    try {
      const now = new Date();
      const fromDefault = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const toDefault   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().slice(0, 10);
      const from = (req.query.from as string) || fromDefault;
      const to   = (req.query.to   as string) || toDefault;

      // ── Revenue ───────────────────────────────────────────────────────────
      // MRR: sum tier MRR across active billing accounts
      const billingAccounts = sqlite
        .prepare(`SELECT cba.client_id, p.service_tier
                   FROM client_billing_accounts cba
                   LEFT JOIN properties p ON p.client_user_id = cba.client_id
                   WHERE cba.status = 'active'`)
        .all() as { client_id: number; service_tier: string | null }[];

      // Deduplicate by client_id (each client has one billing account)
      const seenClients = new Set<number>();
      let mrr = 0;
      for (const row of billingAccounts) {
        if (!seenClients.has(row.client_id)) {
          seenClients.add(row.client_id);
          mrr += tierMrr(row.service_tier);
        }
      }

      // Month-to-date billed (invoices issued in range)
      const mtdBilled = (sqlite
        .prepare(`SELECT COALESCE(SUM(total),0) as total FROM invoices
                  WHERE (issued_at >= ? AND issued_at <= ? || 'T23:59:59Z')
                     OR (created_at >= ? AND created_at <= ? || 'T23:59:59Z' AND status != 'Open')`)
        .get(from, to, from, to) as any).total ?? 0;

      // Vendor payouts (paid in range)
      const vendorPayoutsTotal = (sqlite
        .prepare(`SELECT COALESCE(SUM(amount),0) as total FROM vendor_payouts
                  WHERE status = 'Paid' AND paid_at >= ? AND paid_at <= ? || 'T23:59:59Z'`)
        .get(from, to) as any).total ?? 0;

      const margin = mtdBilled - vendorPayoutsTotal;

      // Outstanding balances (unpaid invoices)
      const outstanding = (sqlite
        .prepare(`SELECT COALESCE(SUM(total),0) as total FROM invoices
                  WHERE status IN ('Issued','Open','Overdue') AND paid_at IS NULL`)
        .get() as any).total ?? 0;

      // Trend: last 6 months billed (monthly)
      const revTrend: { month: string; billed: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const val = (sqlite
          .prepare(`SELECT COALESCE(SUM(total),0) as t FROM invoices
                    WHERE (issued_at LIKE ? OR created_at LIKE ?) AND status != 'Open'`)
          .get(`${mo}%`, `${mo}%`) as any).t ?? 0;
        revTrend.push({ month: mo, billed: val });
      }

      // ── Clients ───────────────────────────────────────────────────────────
      const allClients = sqlite
        .prepare(`SELECT u.id, u.status, u.active, u.deactivated_at,
                         cba.status as billing_status
                  FROM users u
                  LEFT JOIN client_billing_accounts cba ON cba.client_id = u.id
                  WHERE u.role = 'client'`)
        .all() as any[];

      const activeClients  = allClients.filter(c => c.active === 1 && c.status === 'active').length;
      const pendingClients = allClients.filter(c => c.status === 'pending' || c.status === 'onboarding').length;
      const haltedClients  = allClients.filter(c => c.billing_status === 'halted').length;

      // New signups: clients whose ToS was accepted in the date range (proxy for account activation)
      const newSignups = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM tos_acceptances ta
                  JOIN users u ON u.id = ta.user_id
                  WHERE u.role = 'client' AND ta.accepted_at >= ? AND ta.accepted_at <= ? || 'T23:59:59Z'`)
        .get(from, to) as any).c ?? 0;

      const deactivations = allClients.filter(c =>
        c.deactivated_at && c.deactivated_at >= from && c.deactivated_at <= to + "T23:59:59Z"
      ).length;

      // ── Operations ────────────────────────────────────────────────────────
      const visitsCompleted = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM visits
                  WHERE status = 'completed' AND visit_date >= ? AND visit_date <= ?`)
        .get(from, to) as any).c ?? 0;

      const visitsScheduled = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM scheduled_visits
                  WHERE scheduled_date >= ? AND scheduled_date <= ?`)
        .get(from, to) as any).c ?? 0;

      const stormResponses = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM storm_events
                  WHERE created_at >= ? AND created_at <= ? || 'T23:59:59Z'`)
        .get(from, to) as any).c ?? 0;

      const openFlares = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM signal_flares WHERE status IN ('open','acknowledged','in_progress')`)
        .get() as any).c ?? 0;

      const jobsInProgress = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM vendor_work_orders WHERE status IN ('assigned','in_progress')`)
        .get() as any).c ?? 0;

      // ── Exposure ──────────────────────────────────────────────────────────
      // Total retainer balance (sum of latest balance per property)
      const totalRetainerBalance = (sqlite
        .prepare(`SELECT COALESCE(SUM(last_balance),0) as total FROM (
                    SELECT property_id, balance_after as last_balance
                    FROM retainer_ledger
                    WHERE id IN (
                      SELECT MAX(id) FROM retainer_ledger GROUP BY property_id
                    )
                  )`)
        .get() as any).total ?? 0;

      const gracePastDue = (sqlite
        .prepare(`SELECT COUNT(*) as c FROM client_billing_accounts
                  WHERE status IN ('grace','past_due','collections')`)
        .get() as any).c ?? 0;

      const exposureAccounts = sqlite
        .prepare(`SELECT cba.status, COUNT(*) as cnt
                  FROM client_billing_accounts cba
                  GROUP BY cba.status`)
        .all() as { status: string; cnt: number }[];

      // Total current exposure (sum of pending/overdue invoices + open quotes)
      const totalExposure = (sqlite
        .prepare(`SELECT COALESCE(SUM(total),0) as t FROM invoices
                  WHERE status IN ('Issued','Open','Overdue') AND paid_at IS NULL`)
        .get() as any).t ?? 0;

      // ── Vendors ───────────────────────────────────────────────────────────
      const allVendors = sqlite
        .prepare(`SELECT u.id, u.active FROM users u WHERE u.role = 'vendor'`)
        .all() as any[];
      const activeVendors = allVendors.filter(v => v.active === 1).length;

      // Docs incomplete: vendors without all required doc categories
      const docsIncomplete = (sqlite
        .prepare(`SELECT COUNT(DISTINCT u.id) as c FROM users u
                  WHERE u.role = 'vendor' AND u.active = 1
                  AND u.id NOT IN (
                    SELECT DISTINCT vendor_id FROM vendor_documents
                    WHERE status = 'approved' AND doc_category IN ('insurance','license','w9')
                    GROUP BY vendor_id HAVING COUNT(DISTINCT doc_category) >= 3
                  )`)
        .get() as any).c ?? 0;

      const pendingPayouts = (sqlite
        .prepare(`SELECT COALESCE(SUM(amount),0) as t, COUNT(*) as c FROM vendor_payouts WHERE status = 'Pending'`)
        .get() as any);

      // Payout trend (last 6 months)
      const payoutTrend: { month: string; payouts: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const val = (sqlite
          .prepare(`SELECT COALESCE(SUM(amount),0) as t FROM vendor_payouts
                    WHERE status='Paid' AND paid_at LIKE ?`)
          .get(`${mo}%`) as any).t ?? 0;
        payoutTrend.push({ month: mo, payouts: val });
      }

      // ── Assemble ──────────────────────────────────────────────────────────
      res.json({
        period: { from, to },
        revenue: {
          mrr,
          mtd_billed: mtdBilled,
          vendor_payouts: vendorPayoutsTotal,
          margin,
          outstanding,
          trend: revTrend,
        },
        clients: {
          active: activeClients,
          pending: pendingClients,
          halted: haltedClients,
          new_signups: newSignups,
          deactivations,
          total: allClients.length,
        },
        operations: {
          visits_completed: visitsCompleted,
          visits_scheduled: visitsScheduled,
          storm_responses: stormResponses,
          open_flares: openFlares,
          jobs_in_progress: jobsInProgress,
        },
        exposure: {
          total_exposure: totalExposure,
          retainer_balance: totalRetainerBalance,
          grace_past_due: gracePastDue,
          accounts_by_status: exposureAccounts,
        },
        vendors: {
          active: activeVendors,
          docs_incomplete: docsIncomplete,
          pending_payout_count: pendingPayouts.c ?? 0,
          pending_payout_total: pendingPayouts.t ?? 0,
          payout_trend: payoutTrend,
        },
      });
    } catch (err: any) {
      console.error("[dashboard]", err);
      res.status(500).json({ error: err.message });
    }
  }
);
