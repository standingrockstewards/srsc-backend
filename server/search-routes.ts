/**
 * Global Search — GET /api/search?q=<query>
 *
 * Permission-scoped: results never leak cross-tenant.
 *   Admin/Supervisor: broad search across everything
 *   Field Tech: only their assigned properties/visits
 *   Client: only their own properties, quotes, invoices, requests
 *   Vendor: only their own work orders, quotes, payouts
 *
 * Returns grouped results: { clients, properties, vendors, quotes,
 *   invoices, service_requests, visits, signal_flares, faq }
 */

import { Router } from "express";
import { sqlite } from "./storage";

export const searchRouter = Router();

function authUser(req: any): { userId: number; role: string } | null {
  const userId = Number(req.headers["x-user-id"]);
  const role   = (req.headers["x-user-role"] as string) || "";
  if (!userId || !role) return null;
  return { userId, role };
}

function safeLike(q: string): string {
  return `%${q.replace(/[%_]/g, "\\$&")}%`;
}

// ─── GET /api/search ──────────────────────────────────────────────────────────
searchRouter.get("/search", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) return res.json({ results: {}, query: q });

  const { userId, role } = auth;
  const like = safeLike(q);
  const LIMIT = 8;

  const results: Record<string, any[]> = {};

  try {
    // ── Clients (admin/supervisor only) ──────────────────────────────────────
    if (role === "admin" || role === "supervisor") {
      results.clients = sqlite
        .prepare(`SELECT id, name, email, phone, role, status, active
                  FROM users WHERE role = 'client'
                  AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
                  LIMIT ?`)
        .all(like, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "client", _link: `#/clients/${r.id}` }));
    }

    // ── Properties ───────────────────────────────────────────────────────────
    let propQuery = "";
    let propParams: any[] = [];
    if (role === "admin" || role === "supervisor") {
      propQuery = `SELECT id, nickname, owner_name, address, city, service_tier, active
                   FROM properties WHERE active = 1
                   AND (nickname LIKE ? OR owner_name LIKE ? OR address LIKE ? OR city LIKE ?)
                   LIMIT ?`;
      propParams = [like, like, like, like, LIMIT];
    } else if (role === "field_tech") {
      propQuery = `SELECT id, nickname, owner_name, address, city, service_tier, active
                   FROM properties WHERE active = 1 AND assigned_tech_id = ?
                   AND (nickname LIKE ? OR address LIKE ? OR city LIKE ?)
                   LIMIT ?`;
      propParams = [userId, like, like, like, LIMIT];
    } else if (role === "client") {
      propQuery = `SELECT id, nickname, owner_name, address, city, service_tier, active
                   FROM properties WHERE active = 1 AND client_user_id = ?
                   AND (nickname LIKE ? OR address LIKE ? OR city LIKE ?)
                   LIMIT ?`;
      propParams = [userId, like, like, like, LIMIT];
    }
    if (propQuery) {
      results.properties = sqlite
        .prepare(propQuery)
        .all(...propParams)
        .map((r: any) => ({ ...r, _type: "property", _link: `#/properties/${r.id}` }));
    }

    // ── Vendors (admin/supervisor only) ──────────────────────────────────────
    if (role === "admin" || role === "supervisor") {
      results.vendors = sqlite
        .prepare(`SELECT id, name, email, phone, role, status, active
                  FROM users WHERE role = 'vendor'
                  AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
                  LIMIT ?`)
        .all(like, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "vendor", _link: `#/vendors/${r.id}` }));
    }

    // ── Quotes ────────────────────────────────────────────────────────────────
    let quotesQuery = "";
    let quotesParams: any[] = [];
    if (role === "admin" || role === "supervisor") {
      quotesQuery = `SELECT q.id, q.title, q.status, q.total, q.created_at,
                            p.nickname as property_name
                     FROM quote_requests q LEFT JOIN properties p ON p.id = q.property_id
                     WHERE q.title LIKE ? OR q.description LIKE ?
                     ORDER BY q.created_at DESC LIMIT ?`;
      quotesParams = [like, like, LIMIT];
    } else if (role === "client") {
      quotesQuery = `SELECT q.id, q.title, q.status, q.total, q.created_at,
                            p.nickname as property_name
                     FROM quote_requests q LEFT JOIN properties p ON p.id = q.property_id
                     WHERE q.client_id = ? AND q.status IN ('released','approved','declined')
                     AND (q.title LIKE ? OR q.description LIKE ?)
                     ORDER BY q.created_at DESC LIMIT ?`;
      quotesParams = [userId, like, like, LIMIT];
    } else if (role === "vendor") {
      quotesQuery = `SELECT q.id, q.title, q.status, q.total, q.created_at,
                            p.nickname as property_name
                     FROM quote_requests q LEFT JOIN properties p ON p.id = q.property_id
                     WHERE q.vendor_id = ?
                     AND (q.title LIKE ? OR q.description LIKE ?)
                     ORDER BY q.created_at DESC LIMIT ?`;
      quotesParams = [userId, like, like, LIMIT];
    }
    if (quotesQuery) {
      results.quotes = sqlite
        .prepare(quotesQuery)
        .all(...quotesParams)
        .map((r: any) => ({ ...r, _type: "quote", _link: `#/quotes/${r.id}` }));
    }

    // ── Invoices ─────────────────────────────────────────────────────────────
    if (role === "admin" || role === "supervisor") {
      results.invoices = sqlite
        .prepare(`SELECT i.id, i.status, i.total, i.due_at, i.period_start, i.period_end,
                         u.name as client_name
                  FROM invoices i LEFT JOIN users u ON u.id = i.client_id
                  WHERE u.name LIKE ? OR i.notes LIKE ? OR CAST(i.id AS TEXT) LIKE ?
                  ORDER BY i.created_at DESC LIMIT ?`)
        .all(like, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "invoice", _link: `#/billing` }));
    } else if (role === "client") {
      results.invoices = sqlite
        .prepare(`SELECT id, status, total, due_at, period_start, period_end
                  FROM invoices WHERE client_id = ? AND notes LIKE ?
                  ORDER BY created_at DESC LIMIT ?`)
        .all(userId, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "invoice", _link: `#/billing` }));
    }

    // ── Service Requests ─────────────────────────────────────────────────────
    let srQuery = "";
    let srParams: any[] = [];
    if (role === "admin" || role === "supervisor") {
      srQuery = `SELECT sr.id, sr.category, sr.description, sr.status, sr.created_at,
                        p.nickname as property_name
                 FROM service_requests sr LEFT JOIN properties p ON p.id = sr.property_id
                 WHERE sr.description LIKE ? OR sr.category LIKE ?
                 ORDER BY sr.created_at DESC LIMIT ?`;
      srParams = [like, like, LIMIT];
    } else if (role === "client") {
      srQuery = `SELECT sr.id, sr.category, sr.description, sr.status, sr.created_at,
                        p.nickname as property_name
                 FROM service_requests sr LEFT JOIN properties p ON p.id = sr.property_id
                 WHERE sr.client_id = ? AND (sr.description LIKE ? OR sr.category LIKE ?)
                 ORDER BY sr.created_at DESC LIMIT ?`;
      srParams = [userId, like, like, LIMIT];
    }
    if (srQuery) {
      results.service_requests = sqlite
        .prepare(srQuery)
        .all(...srParams)
        .map((r: any) => ({ ...r, _type: "service_request", _link: `#/service-requests` }));
    }

    // ── Visit Reports ─────────────────────────────────────────────────────────
    if (role === "admin" || role === "supervisor") {
      results.visits = sqlite
        .prepare(`SELECT vr.id, vr.overall_status, vr.completed_at,
                         p.nickname as property_name, u.name as tech_name, vr.note
                  FROM visit_reports vr
                  LEFT JOIN properties p ON p.id = vr.property_id
                  LEFT JOIN users u ON u.id = vr.tech_id
                  WHERE vr.note LIKE ? OR p.nickname LIKE ? OR u.name LIKE ?
                  ORDER BY vr.completed_at DESC LIMIT ?`)
        .all(like, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "visit", _link: `#/visits` }));
    } else if (role === "field_tech") {
      results.visits = sqlite
        .prepare(`SELECT vr.id, vr.overall_status, vr.completed_at,
                         p.nickname as property_name, vr.note
                  FROM visit_reports vr LEFT JOIN properties p ON p.id = vr.property_id
                  WHERE vr.tech_id = ? AND (vr.note LIKE ? OR p.nickname LIKE ?)
                  ORDER BY vr.completed_at DESC LIMIT ?`)
        .all(userId, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "visit", _link: `#/visits` }));
    }

    // ── Signal Flares (admin/supervisor/field_tech assigned) ──────────────────
    if (role === "admin" || role === "supervisor") {
      results.signal_flares = sqlite
        .prepare(`SELECT sf.id, sf.description, sf.severity, sf.status, sf.created_at,
                         p.nickname as property_name, sf.category
                  FROM signal_flares sf LEFT JOIN properties p ON p.id = sf.property_id
                  WHERE sf.description LIKE ? OR sf.category LIKE ? OR p.nickname LIKE ?
                  ORDER BY sf.created_at DESC LIMIT ?`)
        .all(like, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "signal_flare", _link: `#/signal-flares/${r.id}` }));
    } else if (role === "field_tech") {
      results.signal_flares = sqlite
        .prepare(`SELECT sf.id, sf.description, sf.severity, sf.status, sf.created_at,
                         p.nickname as property_name, sf.category
                  FROM signal_flares sf LEFT JOIN properties p ON p.id = sf.property_id
                  WHERE p.assigned_tech_id = ?
                  AND (sf.description LIKE ? OR sf.category LIKE ?)
                  ORDER BY sf.created_at DESC LIMIT ?`)
        .all(userId, like, like, LIMIT)
        .map((r: any) => ({ ...r, _type: "signal_flare", _link: `#/signal-flares/${r.id}` }));
    }

    // ── FAQ Articles ──────────────────────────────────────────────────────────
    // All logged-in roles can search published articles
    results.faq = sqlite
      .prepare(`SELECT id, title, slug, tags FROM faq_articles
                WHERE status = 'published'
                AND (title LIKE ? OR tags LIKE ? OR body LIKE ?)
                LIMIT ?`)
      .all(like, like, like, LIMIT)
      .map((r: any) => ({ ...r, _type: "faq", _link: `#/knowledge-base/${r.slug}` }));

    // Strip empty groups
    for (const key of Object.keys(results)) {
      if (!results[key] || results[key].length === 0) delete results[key];
    }

    res.json({ results, query: q });
  } catch (err: any) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message });
  }
});
