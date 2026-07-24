/**
 * quote-routes.ts — Quote Management & Approval (Vendor + Launch Crew)
 *
 * Status flows:
 *   Vendor:      Submitted → In Review → Confirmed → Released to Client → Approved | Declined | Returned to Vendor
 *   Launch Crew: Draft → Sent to Client → Approved | Declined
 *
 * Structural rule: NO direct vendor↔client visibility.
 *   - Vendor quotes invisible to client until Admin/Supervisor explicitly releases.
 *   - Backend enforces: client GET of non-released vendor quote → 403.
 *   - Vendor NEVER sees client identity or other vendors' quotes.
 */

import { Router, Request, Response } from "express";
import { sqlite } from "./storage";
import { requirePermission, PERMISSIONS } from "./permissions";
import { sendMail } from "./mailer";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const fmt = (n: number) => Math.round(n * 100) / 100;

function getUserId(req: Request): number {
  return Number(req.headers["x-user-id"]);
}
function getUserRole(req: Request): string {
  return (req.headers["x-user-role"] as string) || "";
}
function isAdminOrSup(req: Request) {
  const role = getUserRole(req);
  return role === "admin" || role === "supervisor";
}
function isClient(req: Request) {
  return getUserRole(req) === "client";
}
function isVendor(req: Request) {
  return getUserRole(req) === "vendor";
}

function parseLineItems(raw: string | null): any[] {
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}

function calcTotal(lineItems: any[]): number {
  return lineItems.reduce((s: number, li: any) => s + fmt(Number(li.amount ?? 0)), 0);
}

// Send in-app notification to all admins + supervisors
function notifyStaff(title: string, body: string, link: string) {
  const ts = now();
  const staff: any[] = sqlite.prepare(
    "SELECT id FROM users WHERE (role='admin' OR role='supervisor') AND active=1"
  ).all() as any[];
  const stmt = sqlite.prepare(
    "INSERT INTO in_app_notifications (user_id,title,body,type,link,created_at) VALUES (?,?,?,?,?,?)"
  );
  for (const u of staff) {
    stmt.run(u.id, title, body, "quote", link, ts);
  }
}

// Send in-app notification to a specific user
function notifyUser(userId: number, title: string, body: string, link: string) {
  const ts = now();
  sqlite.prepare(
    "INSERT INTO in_app_notifications (user_id,title,body,type,link,created_at) VALUES (?,?,?,?,?,?)"
  ).run(userId, title, body, "quote", link, ts);
}

// Enrich a quote row: parse line_items JSON, attach documents (filtered by visibility)
function enrichQuote(q: any, clientVisible: boolean): any {
  if (!q) return null;
  const li = parseLineItems(q.line_items);
  const docsQuery = clientVisible
    ? "SELECT id,quote_id,filename,file_url,visibility,created_at FROM quote_documents WHERE quote_id=? AND visibility='client_visible'"
    : "SELECT id,quote_id,filename,file_url,visibility,created_at FROM quote_documents WHERE quote_id=?";
  const docs = sqlite.prepare(docsQuery).all(q.id) as any[];
  return { ...q, line_items: li, documents: docs };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENDOR ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/vendor-work-orders/mine
 * Vendor sees only their own work orders (used in quote submission form)
 */
router.get("/vendor-work-orders/mine", (req: Request, res: Response) => {
  if (!isVendor(req)) return res.status(403).json({ error: "Vendors only" });
  const userId = getUserId(req);
  const rows: any[] = sqlite.prepare(
    "SELECT id, title, description, property_id, status, priority, due_date FROM vendor_work_orders WHERE vendor_id=? ORDER BY created_at DESC"
  ).all(userId) as any[];
  res.json(rows);
});

/**
 * POST /api/vendor-quotes
 * Vendor submits a quote (with optional document) against a work order or service request.
 * The quote is immediately status=Submitted and visible ONLY to admin/supervisor.
 */
router.post("/vendor-quotes", (req: Request, res: Response) => {
  const role = getUserRole(req);
  if (role !== "vendor") return res.status(403).json({ error: "Vendors only" });

  const userId = getUserId(req);
  const {
    work_order_id, service_request_id, title, description, total, line_items,
    // Document embedded as base64 (optional — can also upload via /quotes/:id/documents)
    document_filename, document_data, document_mime,
  } = req.body;

  if (!title) return res.status(400).json({ error: "title required" });
  if (total === undefined) return res.status(400).json({ error: "total required" });

  // Look up property_id and client_id from the work order or service request
  let property_id: number | null = null;
  let client_id: number | null = null;

  if (work_order_id) {
    const wo: any = sqlite.prepare("SELECT property_id FROM vendor_work_orders WHERE id=? AND vendor_id=?").get(Number(work_order_id), userId);
    if (!wo) return res.status(403).json({ error: "Work order not found or not assigned to you" });
    property_id = wo.property_id;
  } else if (service_request_id) {
    const sr: any = sqlite.prepare("SELECT property_id, client_id FROM service_requests WHERE id=?").get(Number(service_request_id));
    if (!sr) return res.status(404).json({ error: "Service request not found" });
    property_id = sr.property_id;
    client_id = sr.client_id;
  }

  if (!property_id) return res.status(400).json({ error: "work_order_id or service_request_id required" });

  // Look up client_id from property if not set already
  if (!client_id) {
    const prop: any = sqlite.prepare("SELECT client_user_id FROM properties WHERE id=?").get(property_id);
    client_id = prop?.client_user_id ?? null;
  }

  // Parse line_items — vendor may provide simple [{description, amount}] or just a total
  let lineItemsParsed: any[] = [];
  if (line_items) {
    try { lineItemsParsed = typeof line_items === "string" ? JSON.parse(line_items) : line_items; } catch {}
  }
  if (!lineItemsParsed.length && total) {
    lineItemsParsed = [{ description: title, amount: fmt(Number(total)) }];
  }
  const computedTotal = lineItemsParsed.length ? calcTotal(lineItemsParsed) : fmt(Number(total));

  const ts = now();

  // Vendor ID from the user record (vendor user → look up associated vendor record)
  const vendorRecord: any = sqlite.prepare("SELECT id FROM vendor_work_orders WHERE vendor_id=? LIMIT 1").get(userId);
  const vendor_id = userId; // store the user_id; enrich from vendor_documents etc. as needed

  const quote: any = sqlite.prepare(`
    INSERT INTO quote_requests
      (quote_type, property_id, client_id, service_request_id, work_order_id, vendor_id,
       title, description, line_items, total, currency, status, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(
    "vendor", property_id, client_id, service_request_id ?? null, work_order_id ?? null, vendor_id,
    title, description ?? null, JSON.stringify(lineItemsParsed), computedTotal, "USD",
    "Submitted", userId, ts, ts
  ) as any;

  // Attach document if provided
  if (document_filename && document_data) {
    sqlite.prepare(`
      INSERT INTO quote_documents (quote_id, filename, file_data, mime_type, uploaded_by, visibility, created_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(quote.id, document_filename, document_data, document_mime ?? "application/octet-stream", userId, "internal", ts);
  }

  // Notify staff
  const vendorUser: any = sqlite.prepare("SELECT name FROM users WHERE id=?").get(userId);
  notifyStaff(
    "New Vendor Quote Submitted",
    `${vendorUser?.name ?? "A vendor"} submitted a quote: "${title}" — $${computedTotal.toFixed(2)}`,
    `/quotes`
  );

  // Try email notification (non-fatal)
  try {
    const adminEmails: any[] = sqlite.prepare(
      "SELECT email FROM users WHERE role='admin' AND active=1 AND email IS NOT NULL"
    ).all() as any[];
    for (const { email } of adminEmails) {
      sendMail({
        to: email,
        subject: `[SRSC] New Vendor Quote: "${title}"`,
        html: `<p>A vendor has submitted a quote for review.</p>
               <p><strong>Title:</strong> ${title}</p>
               <p><strong>Total:</strong> $${computedTotal.toFixed(2)}</p>
               <p>Log in to Standing Rock Portal to review.</p>`,
      }).catch(() => {});
    }
  } catch {}

  res.status(201).json(enrichQuote(quote, false));
});

/**
 * GET /api/vendor-quotes/mine
 * Vendor sees only their own submitted quotes. NO client identity exposed.
 */
router.get("/vendor-quotes/mine", (req: Request, res: Response) => {
  if (!isVendor(req)) return res.status(403).json({ error: "Vendors only" });
  const userId = getUserId(req);
  const rows: any[] = sqlite.prepare(
    "SELECT * FROM quote_requests WHERE vendor_id=? AND quote_type='vendor' ORDER BY created_at DESC"
  ).all(userId) as any[];
  // Strip client identity
  const safe = rows.map(q => {
    const { client_id, ...rest } = q;
    return enrichQuote(rest, false);
  });
  res.json(safe);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN / SUPERVISOR ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/quote-requests
 * Admin/Supervisor creates a Launch Crew quote.
 */
router.post("/quote-requests", requirePermission(PERMISSIONS.MANAGE_QUOTES), (req: Request, res: Response) => {
  const userId = getUserId(req);
  const {
    property_id, client_id, service_request_id, work_order_id,
    title, description, line_items, total,
  } = req.body;

  if (!property_id || !client_id || !title) {
    return res.status(400).json({ error: "property_id, client_id, and title required" });
  }

  let lineItemsParsed: any[] = [];
  try { lineItemsParsed = typeof line_items === "string" ? JSON.parse(line_items) : (line_items ?? []); } catch {}
  const computedTotal = lineItemsParsed.length ? calcTotal(lineItemsParsed) : fmt(Number(total ?? 0));

  const ts = now();
  const quote: any = sqlite.prepare(`
    INSERT INTO quote_requests
      (quote_type, property_id, client_id, service_request_id, work_order_id, vendor_id,
       title, description, line_items, total, currency, status, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(
    "launch_crew", Number(property_id), Number(client_id),
    service_request_id ?? null, work_order_id ?? null, null,
    title, description ?? null, JSON.stringify(lineItemsParsed), computedTotal, "USD",
    "Draft", userId, ts, ts
  ) as any;

  res.status(201).json(enrichQuote(quote, false));
});

/**
 * GET /api/quote-requests
 * Admin/Supervisor: all quotes (filter by status/type via query params)
 * Client: only Released-to-Client quotes for their own properties
 * Vendor: only their own submitted quotes (use /vendor-quotes/mine instead)
 */
router.get("/quote-requests", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);

  if (!userId || !role) return res.status(401).json({ error: "Unauthenticated" });

  if (isAdminOrSup(req)) {
    const { status, quote_type } = req.query as any;
    let q = "SELECT * FROM quote_requests WHERE 1=1";
    const params: any[] = [];
    if (status) { q += " AND status=?"; params.push(status); }
    if (quote_type) { q += " AND quote_type=?"; params.push(quote_type); }
    q += " ORDER BY created_at DESC";
    const rows = sqlite.prepare(q).all(...params) as any[];
    return res.json(rows.map(r => enrichQuote(r, false)));
  }

  if (isClient(req)) {
    // Client sees ONLY Released to Client quotes for their properties
    const rows: any[] = sqlite.prepare(`
      SELECT * FROM quote_requests
      WHERE client_id=? AND status IN ('Released to Client','Sent to Client','Approved','Declined')
      ORDER BY created_at DESC
    `).all(userId) as any[];
    // Strip vendor identity
    const safe = rows.map(q => {
      const { vendor_id, reviewed_by, return_note, ...rest } = q;
      return enrichQuote(rest, true); // only client_visible documents
    });
    return res.json(safe);
  }

  if (isVendor(req)) {
    // Redirect to mine endpoint logic inline
    const rows: any[] = sqlite.prepare(
      "SELECT * FROM quote_requests WHERE vendor_id=? AND quote_type='vendor' ORDER BY created_at DESC"
    ).all(userId) as any[];
    const safe = rows.map(q => { const { client_id, ...rest } = q; return enrichQuote(rest, false); });
    return res.json(safe);
  }

  return res.status(403).json({ error: "Access denied" });
});

/**
 * GET /api/quote-requests/:id
 * Scoped: admin/sup see all; client sees only their released quotes; vendor sees only their own (no client identity).
 */
router.get("/quote-requests/:id", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const id = Number(req.params.id);

  const quote: any = sqlite.prepare("SELECT * FROM quote_requests WHERE id=?").get(id);
  if (!quote) return res.status(404).json({ error: "Not found" });

  if (isAdminOrSup(req)) {
    return res.json(enrichQuote(quote, false));
  }

  if (isClient(req)) {
    if (quote.client_id !== userId) return res.status(403).json({ error: "Access denied" });
    if (!["Released to Client", "Sent to Client", "Approved", "Declined"].includes(quote.status)) {
      return res.status(403).json({ error: "Quote not yet released" });
    }
    const { vendor_id, reviewed_by, return_note, ...rest } = quote;
    return res.json(enrichQuote(rest, true));
  }

  if (isVendor(req)) {
    if (quote.vendor_id !== userId || quote.quote_type !== "vendor") {
      return res.status(403).json({ error: "Access denied" });
    }
    const { client_id, ...rest } = quote;
    return res.json(enrichQuote(rest, false));
  }

  return res.status(403).json({ error: "Access denied" });
});

/**
 * PATCH /api/quote-requests/:id
 * Admin/Supervisor: review actions (confirm, release, return, decline, send)
 * Action field: "confirm" | "release" | "return" | "decline" | "send"
 */
router.patch("/quote-requests/:id", requirePermission(PERMISSIONS.MANAGE_QUOTES), (req: Request, res: Response) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const quote: any = sqlite.prepare("SELECT * FROM quote_requests WHERE id=?").get(id);
  if (!quote) return res.status(404).json({ error: "Not found" });

  const { action, return_note, title, description, line_items, total } = req.body;
  const ts = now();

  if (action === "confirm") {
    // Mark as Confirmed (internal step after reviewing vendor doc)
    sqlite.prepare("UPDATE quote_requests SET status='Confirmed', reviewed_by=?, reviewed_at=?, updated_at=? WHERE id=?")
      .run(userId, ts, ts, id);

  } else if (action === "release") {
    // Release vendor quote to client — flip document visibility
    if (quote.quote_type !== "vendor") {
      return res.status(400).json({ error: "Only vendor quotes need release. Use 'send' for Launch Crew." });
    }
    sqlite.prepare(`
      UPDATE quote_requests SET status='Released to Client', reviewed_by=?, reviewed_at=?, released_at=?, updated_at=? WHERE id=?
    `).run(userId, ts, ts, ts, id);
    // Flip document visibility
    sqlite.prepare("UPDATE quote_documents SET visibility='client_visible' WHERE quote_id=?").run(id);
    // Notify client
    if (quote.client_id) {
      notifyUser(
        quote.client_id,
        "A Quote is Ready for Your Review",
        `"${quote.title}" — $${Number(quote.total).toFixed(2)}. Please log in to review and approve or decline.`,
        `/quotes`
      );
      // Try email
      const client: any = sqlite.prepare("SELECT email, name FROM users WHERE id=?").get(quote.client_id);
      if (client?.email) {
        sendMail({
          to: client.email,
          subject: `[Standing Rock] Quote Ready: "${quote.title}"`,
          html: `<p>Hi ${client.name ?? "there"},</p>
                 <p>A quote is ready for your review in your Standing Rock client portal.</p>
                 <p><strong>${quote.title}</strong> — $${Number(quote.total).toFixed(2)}</p>
                 <p>Please log in to review the document and approve or decline.</p>
                 <p>Questions? Contact us at <a href="mailto:info@standingrockstewards.com">info@standingrockstewards.com</a></p>`,
        }).catch(() => {});
      }
    }

  } else if (action === "return") {
    // Return to vendor with note
    if (!return_note) return res.status(400).json({ error: "return_note required" });
    sqlite.prepare(`
      UPDATE quote_requests SET status='Returned to Vendor', return_note=?, returned_at=?, updated_at=? WHERE id=?
    `).run(return_note, ts, ts, id);
    // Notify vendor
    if (quote.vendor_id) {
      notifyUser(
        quote.vendor_id,
        "Quote Returned — Corrections Needed",
        `Your quote "${quote.title}" was returned with notes. Please review and resubmit.`,
        `/portal`
      );
    }

  } else if (action === "decline") {
    // Admin declines the quote (vendor or launch crew)
    sqlite.prepare("UPDATE quote_requests SET status='Declined', reviewed_by=?, reviewed_at=?, updated_at=? WHERE id=?")
      .run(userId, ts, ts, id);

  } else if (action === "send") {
    // Send Launch Crew quote to client
    if (quote.quote_type !== "launch_crew") {
      return res.status(400).json({ error: "Use 'release' for vendor quotes" });
    }
    // Flip documents to client_visible
    sqlite.prepare("UPDATE quote_documents SET visibility='client_visible' WHERE quote_id=?").run(id);
    sqlite.prepare(`
      UPDATE quote_requests SET status='Sent to Client', sent_to_client_at=?, updated_at=? WHERE id=?
    `).run(ts, ts, id);
    // Notify client
    if (quote.client_id) {
      notifyUser(
        quote.client_id,
        "A Quote is Ready for Your Review",
        `"${quote.title}" — $${Number(quote.total).toFixed(2)}. Please log in to approve or decline.`,
        `/quotes`
      );
      const client: any = sqlite.prepare("SELECT email, name FROM users WHERE id=?").get(quote.client_id);
      if (client?.email) {
        sendMail({
          to: client.email,
          subject: `[Standing Rock] Quote Ready: "${quote.title}"`,
          html: `<p>Hi ${client.name ?? "there"},</p>
                 <p>A quote from Standing Rock is ready for your review.</p>
                 <p><strong>${quote.title}</strong> — $${Number(quote.total).toFixed(2)}</p>
                 <p>Please log in to review and approve or decline.</p>`,
        }).catch(() => {});
      }
    }

  } else if (!action) {
    // Plain edit (update title/description/line_items for Draft quotes)
    if (!["Draft", "Returned to Vendor", "Submitted"].includes(quote.status)) {
      return res.status(400).json({ error: "Cannot edit quote in status: " + quote.status });
    }
    let lineItemsParsed = parseLineItems(quote.line_items);
    if (line_items !== undefined) {
      try { lineItemsParsed = typeof line_items === "string" ? JSON.parse(line_items) : line_items; } catch {}
    }
    const computedTotal = lineItemsParsed.length ? calcTotal(lineItemsParsed) : fmt(Number(total ?? quote.total));
    sqlite.prepare(`
      UPDATE quote_requests SET title=?, description=?, line_items=?, total=?, updated_at=? WHERE id=?
    `).run(title ?? quote.title, description ?? quote.description, JSON.stringify(lineItemsParsed), computedTotal, ts, id);

  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  const updated: any = sqlite.prepare("SELECT * FROM quote_requests WHERE id=?").get(id);
  res.json(enrichQuote(updated, false));
});

/**
 * PATCH /api/quote-requests/:id/decision
 * Client approves or declines a released quote. Approval marks quote billable.
 */
router.patch("/quote-requests/:id/decision", (req: Request, res: Response) => {
  if (!isClient(req)) return res.status(403).json({ error: "Clients only" });

  const userId = getUserId(req);
  const id = Number(req.params.id);
  const quote: any = sqlite.prepare("SELECT * FROM quote_requests WHERE id=?").get(id);

  if (!quote) return res.status(404).json({ error: "Not found" });
  if (quote.client_id !== userId) return res.status(403).json({ error: "Access denied" });

  const allowedStatuses = ["Released to Client", "Sent to Client"];
  if (!allowedStatuses.includes(quote.status)) {
    return res.status(400).json({ error: "Quote is not pending your decision" });
  }

  const { decision, declined_reason } = req.body; // decision: "approved" | "declined"
  if (!["approved", "declined"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'declined'" });
  }

  const ts = now();
  const newStatus = decision === "approved" ? "Approved" : "Declined";
  const billable = decision === "approved" ? 1 : 0;

  sqlite.prepare(`
    UPDATE quote_requests
    SET status=?, client_decision=?, client_decision_at=?, client_decision_by=?, billable=?, updated_at=?
    WHERE id=?
  `).run(newStatus, decision, ts, userId, billable, ts, id);

  // Notify staff of decision
  notifyStaff(
    `Quote ${newStatus} by Client`,
    `"${quote.title}" was ${decision} by the client — $${Number(quote.total).toFixed(2)}.`,
    `/quotes`
  );

  const updated: any = sqlite.prepare("SELECT * FROM quote_requests WHERE id=?").get(id);
  const { vendor_id: _v, reviewed_by: _r, return_note: _rn, ...safe } = updated;
  res.json(enrichQuote(safe, true));
});

/**
 * POST /api/quote-requests/:id/documents
 * Upload a document to a quote. Vendor uploads go internal; admin can set visibility.
 */
router.post("/quote-requests/:id/documents", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const id = Number(req.params.id);

  const quote: any = sqlite.prepare("SELECT * FROM quote_requests WHERE id=?").get(id);
  if (!quote) return res.status(404).json({ error: "Not found" });

  // Vendor can only upload to their own quote
  if (role === "vendor" && (quote.vendor_id !== userId || quote.quote_type !== "vendor")) {
    return res.status(403).json({ error: "Access denied" });
  }
  // Client cannot upload to quotes
  if (role === "client") return res.status(403).json({ error: "Clients cannot upload quote documents" });

  const { filename, file_data, mime_type, visibility } = req.body;
  if (!filename) return res.status(400).json({ error: "filename required" });

  // Vendors always upload internal; admins can specify
  const resolvedVisibility = role === "vendor" ? "internal" : (visibility ?? "internal");

  const ts = now();
  const doc: any = sqlite.prepare(`
    INSERT INTO quote_documents (quote_id, filename, file_data, mime_type, uploaded_by, visibility, created_at)
    VALUES (?,?,?,?,?,?,?) RETURNING *
  `).get(id, filename, file_data ?? null, mime_type ?? "application/octet-stream", userId, resolvedVisibility, ts);

  // If quote is still Submitted, advance to In Review automatically
  if (quote.status === "Submitted" && isAdminOrSup(req)) {
    sqlite.prepare("UPDATE quote_requests SET status='In Review', updated_at=? WHERE id=?").run(ts, id);
  }

  res.status(201).json(doc);
});

/**
 * GET /api/quote-requests/review-queue
 * Admin/Supervisor: all vendor quotes pending review (Submitted or In Review)
 */
router.get("/quote-requests/review-queue/pending", requirePermission(PERMISSIONS.MANAGE_QUOTES), (req: Request, res: Response) => {
  const rows: any[] = sqlite.prepare(`
    SELECT q.*, u.name as vendor_name, p.address as property_address
    FROM quote_requests q
    LEFT JOIN users u ON q.vendor_id = u.id
    LEFT JOIN properties p ON q.property_id = p.id
    WHERE q.quote_type='vendor' AND q.status IN ('Submitted','In Review')
    ORDER BY q.created_at ASC
  `).all() as any[];
  res.json(rows.map(r => enrichQuote(r, false)));
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════════════════

// Seed demo quote data on startup
const quoteCount = sqlite.prepare("SELECT COUNT(*) as c FROM quote_requests").get() as any;
if (!quoteCount || quoteCount.c === 0) {
  const ts = now();

  // Property 1 = Smith Lake House, client_id=4 (jsmith)
  // Property 2 = Henderson Retreat, client_id=5 (rhenderson)
  // Property 3 = Patel Cove Cabin, client_id=6 (apatel)

  // 1. Vendor quote (Submitted) — HVAC work on property 1 — from vendor1 (id=8)
  const vq1: any = sqlite.prepare(`
    INSERT INTO quote_requests (quote_type,property_id,client_id,vendor_id,work_order_id,title,description,
      line_items,total,currency,status,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(
    "vendor", 1, 4, 8, null,
    "HVAC Filter Replacement & Coil Cleaning",
    "Full system service: replace all filters, clean evaporator coils, check refrigerant levels.",
    JSON.stringify([
      { description: "Filter replacement (4 units)", amount: 180 },
      { description: "Coil cleaning & treatment", amount: 220 },
      { description: "Refrigerant check", amount: 75 },
    ]),
    475, "USD", "Submitted", 8, ts, ts
  );
  // Attach a placeholder document (internal)
  sqlite.prepare(`
    INSERT INTO quote_documents (quote_id,filename,file_data,mime_type,uploaded_by,visibility,created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(vq1.id, "hvac_service_quote_RC.pdf", null, "application/pdf", 8, "internal", ts);

  // 2. Vendor quote (In Review) — dock repair on property 3 — from vendor1 (id=8)
  const vq2: any = sqlite.prepare(`
    INSERT INTO quote_requests (quote_type,property_id,client_id,vendor_id,title,description,
      line_items,total,currency,status,created_by,reviewed_by,reviewed_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(
    "vendor", 3, 6, 8,
    "Dock Section Replacement — Slip 2",
    "Replace two damaged dock sections, resecure pilings, add non-slip coating.",
    JSON.stringify([
      { description: "Dock section material (2 sections)", amount: 640 },
      { description: "Labor — piling inspection & resecure", amount: 320 },
      { description: "Non-slip coating application", amount: 95 },
    ]),
    1055, "USD", "In Review", 8, 1, ts, ts, ts
  );
  sqlite.prepare(`
    INSERT INTO quote_documents (quote_id,filename,file_data,mime_type,uploaded_by,visibility,created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(vq2.id, "dock_repair_quote_RC.pdf", null, "application/pdf", 8, "internal", ts);

  // 3. Launch Crew quote (Released to Client) — property 2 — from admin (id=1)
  const lc1: any = sqlite.prepare(`
    INSERT INTO quote_requests (quote_type,property_id,client_id,title,description,
      line_items,total,currency,status,created_by,reviewed_by,reviewed_at,released_at,
      sent_to_client_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(
    "launch_crew", 2, 5,
    "Annual Property Inspection & Winterization Package",
    "Full property walk-through, winterization of plumbing, exterior prep, dock removal, and written report.",
    JSON.stringify([
      { description: "Full property inspection & report", amount: 350 },
      { description: "Plumbing winterization", amount: 280 },
      { description: "Exterior weatherproofing", amount: 195 },
      { description: "Dock section removal & storage", amount: 225 },
    ]),
    1050, "USD", "Sent to Client", 1, 1, ts, ts, ts, ts, ts
  );
  // Flip documents to client_visible for this one
  sqlite.prepare(`
    INSERT INTO quote_documents (quote_id,filename,file_data,mime_type,uploaded_by,visibility,created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(lc1.id, "winterization_quote_SRSC.pdf", null, "application/pdf", 1, "client_visible", ts);

  // 4. Launch Crew quote (Approved) — property 1 — already approved
  const lc2: any = sqlite.prepare(`
    INSERT INTO quote_requests (quote_type,property_id,client_id,title,description,
      line_items,total,currency,status,billable,created_by,sent_to_client_at,
      client_decision,client_decision_at,client_decision_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(
    "launch_crew", 1, 4,
    "Exterior Pressure Wash & Gutter Cleaning",
    "Full exterior pressure wash, gutter cleaning and flush, minor caulk touch-up.",
    JSON.stringify([
      { description: "Pressure wash (house + driveway)", amount: 280 },
      { description: "Gutter cleaning & flush", amount: 175 },
    ]),
    455, "USD", "Approved", 1, 1, ts, "approved", ts, 4, ts, ts
  );
}

export default router;
