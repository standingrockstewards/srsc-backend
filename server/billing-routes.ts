/**
 * SRSC — Consolidated Billing & Payments
 * All billing API routes in one module; mounted in routes.ts
 *
 * Architecture:
 *  - Stripe (test mode) for client subscriptions + invoice issuance
 *  - SQLite local tables for quotes, invoices, line items, transactions,
 *    vendor payouts, disputes, and client_billing_accounts
 *  - NEVER store raw card/bank numbers — Stripe tokens/IDs only
 *  - Stripe secret key read from STRIPE_SECRET_KEY env var
 *  - Webhook signature verified with STRIPE_WEBHOOK_SECRET env var
 */

import { Router, Request, Response } from "express";
import Stripe from "stripe";

// ─── SQLite ──────────────────────────────────────────────────────────────────
import sqlite3 from "better-sqlite3";
const DB_PATH = process.env.DB_PATH ?? "data.db";
const sqlite = new (sqlite3 as any)(DB_PATH);

// ─── Stripe init (gracefully degrade if key not set) ─────────────────────────
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" as any });
}

// ─── Auth helpers (mirror pattern from routes.ts) ─────────────────────────────
function getUserId(req: Request): number {
  return parseInt(req.headers["x-user-id"] as string, 10) || 0;
}
function getRole(req: Request): string {
  return (req.headers["x-user-role"] as string) || "";
}
function can(req: Request, perm: string): boolean {
  // Check user_permissions override table, fallback to role defaults
  const userId = getUserId(req);
  const role = getRole(req);
  if (!userId || !role) return false;

  const override: any = sqlite.prepare(
    "SELECT granted FROM user_permissions WHERE user_id = ? AND permission_key = ? LIMIT 1"
  ).get(userId, perm);
  if (override !== undefined && override !== null) return !!override.granted;

  // Role defaults hard-coded per permissions.ts logic
  const ADMIN_PERMS = ["manage_billing", "view_billing", "manage_users"];
  if (role === "admin") return true; // admin has everything
  if (role === "supervisor" && perm === "view_billing") return false; // off by default
  if (role === "supervisor" && perm === "manage_billing") return false; // off by default, grantable
  if (role === "client" && ["view_billing"].includes(perm)) return true;
  return false;
}
function requireManageBilling(req: Request, res: Response): boolean {
  const role = getRole(req);
  if (role === "admin") return true;
  // Check via override table
  const userId = getUserId(req);
  const override: any = sqlite.prepare(
    "SELECT granted FROM user_permissions WHERE user_id = ? AND permission_key = 'manage_billing' LIMIT 1"
  ).get(userId);
  if (override && override.granted) return true;
  res.status(403).json({ error: "manage_billing required" });
  return false;
}
function requireViewBilling(req: Request, res: Response): boolean {
  const role = getRole(req);
  if (role === "admin" || role === "client" || role === "supervisor") return true;
  const userId = getUserId(req);
  const override: any = sqlite.prepare(
    "SELECT granted FROM user_permissions WHERE user_id = ? AND permission_key IN ('view_billing','manage_billing') LIMIT 1"
  ).get(userId);
  if (override && override.granted) return true;
  res.status(403).json({ error: "view_billing required" });
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const fmt = (amount: number) => Math.round(amount * 100) / 100;

/** Ensure a client billing account row exists; create if not */
function ensureBillingAccount(clientId: number): any {
  let acct: any = sqlite.prepare("SELECT * FROM client_billing_accounts WHERE client_id = ?").get(clientId);
  if (!acct) {
    const ts = now();
    sqlite.prepare(
      "INSERT INTO client_billing_accounts (client_id, subscription_tier, billing_day, status, created_at, updated_at) VALUES (?,?,?,?,?,?)"
    ).run(clientId, "standard", 1, "active", ts, ts);
    acct = sqlite.prepare("SELECT * FROM client_billing_accounts WHERE client_id = ?").get(clientId);
  }
  return acct;
}

/** Get or create current open invoice for a client for this calendar month */
function getOrCreateOpenInvoice(clientId: number, propertyId?: number): any {
  const d = new Date();
  const periodStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];

  let inv: any = sqlite.prepare(
    "SELECT * FROM invoices WHERE client_id = ? AND period_start = ? AND status = 'Open' LIMIT 1"
  ).get(clientId, periodStart);

  if (!inv) {
    const ts = now();
    const due = new Date(d.getFullYear(), d.getMonth() + 1, 15).toISOString().split("T")[0];
    const result = sqlite.prepare(
      `INSERT INTO invoices (client_id, property_id, period_start, period_end, status, subtotal, tax, total, due_at, created_at, updated_at)
       VALUES (?,?,?,?,'Open',0,0,0,?,?,?) RETURNING id`
    ).get(clientId, propertyId ?? null, periodStart, periodEnd, due, ts, ts) as any;
    inv = sqlite.prepare("SELECT * FROM invoices WHERE id = ?").get(result.id);
  }
  return inv;
}

/** Recalculate invoice totals from line items */
function recalcInvoice(invoiceId: number) {
  const items: any[] = sqlite.prepare("SELECT * FROM invoice_line_items WHERE invoice_id = ?").all(invoiceId) as any[];
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const tax = 0; // no sales tax by default
  const total = fmt(subtotal + tax);
  sqlite.prepare(
    "UPDATE invoices SET subtotal = ?, tax = ?, total = ?, updated_at = ? WHERE id = ?"
  ).run(fmt(subtotal), tax, total, now(), invoiceId);
}

/** Add a line item to the client's current open invoice */
export function addLineItemToCurrentInvoice(
  clientId: number,
  propertyId: number,
  sourceType: string,
  sourceId: number | null,
  description: string,
  amount: number
) {
  const inv = getOrCreateOpenInvoice(clientId, propertyId);
  const ts = now();
  sqlite.prepare(
    `INSERT INTO invoice_line_items (invoice_id, source_type, source_id, description, quantity, unit_price, amount, created_at)
     VALUES (?,?,?,?,1,?,?,?)`
  ).run(inv.id, sourceType, sourceId, description, fmt(amount), fmt(amount), ts);
  recalcInvoice(inv.id);
  return inv.id;
}

// ─── Seed billing accounts for existing clients ───────────────────────────────
try {
  const clients: any[] = sqlite.prepare("SELECT id FROM users WHERE role = 'client'").all() as any[];
  for (const c of clients) ensureBillingAccount(c.id);
} catch {}

// ─── Seed a subscription line item on each client's current invoice if none ──
try {
  const SUBSCRIPTION_AMOUNTS: Record<string, number> = {
    standard: 149.00,
    premium:  249.00,
    essential: 99.00,
  };

  const clients: any[] = sqlite.prepare("SELECT id FROM users WHERE role = 'client'").all() as any[];
  const d = new Date();
  const periodStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];

  for (const c of clients) {
    const acct: any = sqlite.prepare("SELECT * FROM client_billing_accounts WHERE client_id = ?").get(c.id);
    const inv: any = sqlite.prepare(
      "SELECT * FROM invoices WHERE client_id = ? AND period_start = ? LIMIT 1"
    ).get(c.id, periodStart);

    if (!inv) {
      // Create invoice + subscription line item
      const invId = addLineItemToCurrentInvoice(
        c.id, 0,
        "subscription", null,
        `Monthly Stewardship Subscription (${acct?.subscription_tier ?? "standard"}) — ${d.toLocaleString("default", { month: "long", year: "numeric" })}`,
        SUBSCRIPTION_AMOUNTS[acct?.subscription_tier ?? "standard"] ?? 149
      );
    } else {
      // Check if subscription item already exists
      const existing: any = sqlite.prepare(
        "SELECT id FROM invoice_line_items WHERE invoice_id = ? AND source_type = 'subscription' LIMIT 1"
      ).get(inv.id);
      if (!existing) {
        const ts = now();
        sqlite.prepare(
          `INSERT INTO invoice_line_items (invoice_id, source_type, source_id, description, quantity, unit_price, amount, created_at)
           VALUES (?,?,?,?,1,?,?,?)`
        ).run(
          inv.id, "subscription", null,
          `Monthly Stewardship Subscription (${acct?.subscription_tier ?? "standard"}) — ${d.toLocaleString("default", { month: "long", year: "numeric" })}`,
          SUBSCRIPTION_AMOUNTS[acct?.subscription_tier ?? "standard"] ?? 149,
          SUBSCRIPTION_AMOUNTS[acct?.subscription_tier ?? "standard"] ?? 149,
          ts
        );
        recalcInvoice(inv.id);
      }
    }
  }
} catch {}

// ─── Seed demo quotes ─────────────────────────────────────────────────────────
try {
  const count = (sqlite.prepare("SELECT COUNT(*) as c FROM quotes").get() as any).c;
  if (count === 0) {
    const ts = now();
    const lineItems1 = JSON.stringify([
      { description: "HVAC Filter Replacement — MERV-13 (4 units)", qty: 1, unit_price: 48.00, amount: 48.00 },
      { description: "Coil Cleaning & Inspection", qty: 1, unit_price: 125.00, amount: 125.00 },
      { description: "Labor — HVAC Technician (2 hrs)", qty: 2, unit_price: 75.00, amount: 150.00 },
    ]);
    sqlite.prepare(
      `INSERT INTO quotes (property_id, client_id, created_by, title, description, line_items, subtotal, total, status, sent_at, service_request_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(1, 4, 1, "HVAC Service — Smith Lake House",
      "Annual HVAC maintenance and filter replacement per service request SR-001.",
      lineItems1, 323.00, 323.00, "Sent", ts, null, ts, ts);

    const lineItems2 = JSON.stringify([
      { description: "Dock Board Replacement (12 boards)", qty: 12, unit_price: 28.00, amount: 336.00 },
      { description: "Post Repair & Waterproofing", qty: 1, unit_price: 195.00, amount: 195.00 },
      { description: "Labor — Marine Carpenter (4 hrs)", qty: 4, unit_price: 85.00, amount: 340.00 },
    ]);
    sqlite.prepare(
      `INSERT INTO quotes (property_id, client_id, created_by, title, description, line_items, subtotal, total, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(3, 6, 1, "Dock Repair — Patel Cove Cabin",
      "Safety-critical deck board replacement and post waterproofing following inspection findings.",
      lineItems2, 871.00, 871.00, "Draft", ts, ts);
  }
} catch {}

// ─── Seed a demo approved quote auto-billed line item ────────────────────────
try {
  const existing: any = sqlite.prepare(
    "SELECT id FROM invoice_line_items WHERE source_type = 'quote' LIMIT 1"
  ).get();
  if (!existing) {
    // Simulate an approved-quote completion for jsmith (client_id=4, property_id=1)
    const invId = addLineItemToCurrentInvoice(
      4, 1, "quote", 1,
      "HVAC Service — Smith Lake House (Approved Quote #1)",
      323.00
    );
  }
} catch {}

// ─── Seed demo vendor payouts ─────────────────────────────────────────────────
try {
  const count = (sqlite.prepare("SELECT COUNT(*) as c FROM vendor_payouts").get() as any).c;
  if (count === 0) {
    const ts = now();
    sqlite.prepare(
      "INSERT INTO vendor_payouts (vendor_id, amount, method, status, note, recorded_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
    ).run(8, 280.00, "check", "Pending", "Check #1042 — HVAC filter labor", 1, ts, ts);
    sqlite.prepare(
      "INSERT INTO vendor_payouts (vendor_id, amount, method, status, paid_at, note, recorded_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(8, 150.00, "cash", "Paid", ts, "Cash payment for emergency call-out", 1, ts, ts);
  }
} catch {}

// ─── Router ───────────────────────────────────────────────────────────────────
const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// QUOTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/quotes — create quote (manage_billing)
router.post("/quotes", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const { property_id, client_id, title, description, line_items = [], service_request_id } = req.body;
  if (!property_id || !client_id || !title) return res.status(400).json({ error: "property_id, client_id, title required" });
  const userId = getUserId(req);
  const ts = now();
  const items = Array.isArray(line_items) ? line_items : JSON.parse(line_items);
  const subtotal = fmt(items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0));
  const result: any = sqlite.prepare(
    `INSERT INTO quotes (property_id, client_id, created_by, title, description, line_items, subtotal, total, status, service_request_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,'Draft',?,?,?) RETURNING id`
  ).get(property_id, client_id, userId, title, description ?? null, JSON.stringify(items), subtotal, subtotal, service_request_id ?? null, ts, ts);
  res.json(sqlite.prepare("SELECT * FROM quotes WHERE id = ?").get(result.id));
});

// GET /api/quotes — list (manage_billing: all; client: own)
router.get("/quotes", (req: Request, res: Response) => {
  if (!requireViewBilling(req, res)) return;
  const role = getRole(req);
  const userId = getUserId(req);
  let rows: any[];
  if (role === "client") {
    rows = sqlite.prepare(
      "SELECT q.*, u.name as client_name, p.nickname as property_name FROM quotes q LEFT JOIN users u ON u.id=q.client_id LEFT JOIN properties p ON p.id=q.property_id WHERE q.client_id=? ORDER BY q.created_at DESC"
    ).all(userId) as any[];
  } else {
    rows = sqlite.prepare(
      "SELECT q.*, u.name as client_name, p.nickname as property_name FROM quotes q LEFT JOIN users u ON u.id=q.client_id LEFT JOIN properties p ON p.id=q.property_id ORDER BY q.created_at DESC"
    ).all() as any[];
  }
  rows = rows.map(r => ({ ...r, line_items: JSON.parse(r.line_items || "[]") }));
  res.json(rows);
});

// GET /api/quotes/:id
router.get("/quotes/:id", (req: Request, res: Response) => {
  if (!requireViewBilling(req, res)) return;
  const role = getRole(req);
  const userId = getUserId(req);
  const q: any = sqlite.prepare(
    "SELECT q.*, u.name as client_name, p.nickname as property_name FROM quotes q LEFT JOIN users u ON u.id=q.client_id LEFT JOIN properties p ON p.id=q.property_id WHERE q.id=?"
  ).get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: "Not found" });
  if (role === "client" && q.client_id !== userId) return res.status(403).json({ error: "Access denied" });
  res.json({ ...q, line_items: JSON.parse(q.line_items || "[]") });
});

// PATCH /api/quotes/:id — update, send, approve, decline
router.patch("/quotes/:id", (req: Request, res: Response) => {
  const role = getRole(req);
  const userId = getUserId(req);
  const q: any = sqlite.prepare("SELECT * FROM quotes WHERE id = ?").get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: "Not found" });

  const { action, title, description, line_items, declined_reason } = req.body;
  const ts = now();

  if (action === "send") {
    if (!requireManageBilling(req, res)) return;
    sqlite.prepare("UPDATE quotes SET status='Sent', sent_at=?, updated_at=? WHERE id=?").run(ts, ts, q.id);
    return res.json(sqlite.prepare("SELECT * FROM quotes WHERE id=?").get(q.id));
  }

  if (action === "approve") {
    if (role !== "client") return res.status(403).json({ error: "Only clients can approve quotes" });
    if (q.client_id !== userId) return res.status(403).json({ error: "Access denied" });
    if (q.status !== "Sent") return res.status(400).json({ error: "Quote must be in Sent status" });
    sqlite.prepare("UPDATE quotes SET status='Approved', approved_at=?, approved_by=?, updated_at=? WHERE id=?").run(ts, userId, ts, q.id);
    // Auto-bill: add line item to current invoice
    try {
      addLineItemToCurrentInvoice(
        q.client_id, q.property_id,
        "quote", q.id,
        `${q.title} (Approved Quote #${q.id})`,
        q.total
      );
    } catch {}
    return res.json(sqlite.prepare("SELECT * FROM quotes WHERE id=?").get(q.id));
  }

  if (action === "decline") {
    if (role !== "client") return res.status(403).json({ error: "Only clients can decline quotes" });
    if (q.client_id !== userId) return res.status(403).json({ error: "Access denied" });
    sqlite.prepare("UPDATE quotes SET status='Declined', declined_at=?, declined_reason=?, updated_at=? WHERE id=?")
      .run(ts, declined_reason ?? null, ts, q.id);
    return res.json(sqlite.prepare("SELECT * FROM quotes WHERE id=?").get(q.id));
  }

  // Edit (manage_billing only)
  if (!requireManageBilling(req, res)) return;
  const updates: any = {};
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (line_items) {
    const items = Array.isArray(line_items) ? line_items : JSON.parse(line_items);
    updates.line_items = JSON.stringify(items);
    updates.subtotal = fmt(items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0));
    updates.total = updates.subtotal;
  }
  updates.updated_at = ts;
  const setClauses = Object.keys(updates).map(k => `${k}=?`).join(",");
  sqlite.prepare(`UPDATE quotes SET ${setClauses} WHERE id=?`).run(...Object.values(updates), q.id);
  const updated: any = sqlite.prepare("SELECT * FROM quotes WHERE id=?").get(q.id);
  res.json({ ...updated, line_items: JSON.parse(updated.line_items || "[]") });
});

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/invoices — list
router.get("/invoices", (req: Request, res: Response) => {
  if (!requireViewBilling(req, res)) return;
  const role = getRole(req);
  const userId = getUserId(req);
  let rows: any[];
  if (role === "client") {
    rows = sqlite.prepare(
      "SELECT i.*, u.name as client_name FROM invoices i LEFT JOIN users u ON u.id=i.client_id WHERE i.client_id=? ORDER BY i.period_start DESC"
    ).all(userId) as any[];
  } else {
    rows = sqlite.prepare(
      "SELECT i.*, u.name as client_name FROM invoices i LEFT JOIN users u ON u.id=i.client_id ORDER BY i.period_start DESC, i.client_id"
    ).all() as any[];
  }
  res.json(rows);
});

// GET /api/invoices/:id — detail with line items + transactions
router.get("/invoices/:id", (req: Request, res: Response) => {
  if (!requireViewBilling(req, res)) return;
  const role = getRole(req);
  const userId = getUserId(req);
  const inv: any = sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(Number(req.params.id));
  if (!inv) return res.status(404).json({ error: "Not found" });
  if (role === "client" && inv.client_id !== userId) return res.status(403).json({ error: "Access denied" });
  const lineItems = sqlite.prepare("SELECT * FROM invoice_line_items WHERE invoice_id=? ORDER BY created_at").all(inv.id);
  const txns = sqlite.prepare("SELECT * FROM transactions WHERE invoice_id=? ORDER BY created_at DESC").all(inv.id);
  const disputes = sqlite.prepare("SELECT * FROM billing_disputes WHERE invoice_id=? ORDER BY created_at DESC").all(inv.id);
  res.json({ ...inv, line_items: lineItems, transactions: txns, disputes });
});

// POST /api/invoices — manually create (manage_billing)
router.post("/invoices", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const { client_id, property_id, period_start, period_end, notes } = req.body;
  if (!client_id || !period_start || !period_end) return res.status(400).json({ error: "client_id, period_start, period_end required" });
  const ts = now();
  const d = new Date(period_end);
  const due = new Date(d.getFullYear(), d.getMonth() + 1, 15).toISOString().split("T")[0];
  const result: any = sqlite.prepare(
    `INSERT INTO invoices (client_id, property_id, period_start, period_end, status, subtotal, tax, total, due_at, notes, created_at, updated_at)
     VALUES (?,?,?,?,'Open',0,0,0,?,?,?,?) RETURNING id`
  ).get(client_id, property_id ?? null, period_start, period_end, due, notes ?? null, ts, ts);
  res.json(sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(result.id));
});

// PATCH /api/invoices/:id — issue/void + Stripe (manage_billing)
router.patch("/invoices/:id", async (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const inv: any = sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(Number(req.params.id));
  if (!inv) return res.status(404).json({ error: "Not found" });

  const { action, notes } = req.body;
  const ts = now();

  if (action === "issue") {
    if (inv.status !== "Open") return res.status(400).json({ error: "Only Open invoices can be issued" });

    // Attempt Stripe invoice issuance if configured
    let stripeInvoiceId: string | null = null;
    let stripeHostedUrl: string | null = null;
    let stripePdfUrl: string | null = null;

    if (stripe) {
      try {
        // Ensure Stripe customer exists
        const acct: any = sqlite.prepare("SELECT * FROM client_billing_accounts WHERE client_id=?").get(inv.client_id);
        const client: any = sqlite.prepare("SELECT * FROM users WHERE id=?").get(inv.client_id);
        let customerId = acct?.stripe_customer_id;

        if (!customerId) {
          const customer = await stripe.customers.create({
            name: client?.name ?? "SRSC Client",
            email: client?.email ?? undefined,
            metadata: { srsc_client_id: String(inv.client_id) },
          });
          customerId = customer.id;
          sqlite.prepare("UPDATE client_billing_accounts SET stripe_customer_id=?, updated_at=? WHERE client_id=?").run(customerId, ts, inv.client_id);
        }

        // Create Stripe invoice
        const lineItems: any[] = sqlite.prepare("SELECT * FROM invoice_line_items WHERE invoice_id=?").all(inv.id) as any[];
        const stripeInv = await stripe.invoices.create({
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: 15,
          description: `Standing Rock Stewardship Co. — ${inv.period_start} to ${inv.period_end}`,
          metadata: { srsc_invoice_id: String(inv.id) },
        });

        // Add line items to Stripe invoice
        for (const item of lineItems) {
          await stripe.invoiceItems.create({
            customer: customerId,
            invoice: stripeInv.id,
            amount: Math.round(item.amount * 100),
            currency: "usd",
            description: item.description,
          });
        }

        // Finalize and send
        const finalized = await stripe.invoices.finalizeInvoice(stripeInv.id);
        await stripe.invoices.sendInvoice(finalized.id);

        stripeInvoiceId = finalized.id;
        stripeHostedUrl = finalized.hosted_invoice_url ?? null;
        stripePdfUrl = finalized.invoice_pdf ?? null;
      } catch (e: any) {
        console.error("Stripe invoice error:", e.message);
      }
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    sqlite.prepare(
      "UPDATE invoices SET status='Issued', issued_at=?, due_at=?, stripe_invoice_id=?, stripe_hosted_url=?, stripe_pdf_url=?, notes=?, updated_at=? WHERE id=?"
    ).run(ts, dueDate.toISOString().split("T")[0], stripeInvoiceId, stripeHostedUrl, stripePdfUrl, notes ?? inv.notes, ts, inv.id);

    // Record transaction
    sqlite.prepare(
      "INSERT INTO transactions (client_id, invoice_id, type, amount, description, created_at) VALUES (?,?,?,?,?,?)"
    ).run(inv.client_id, inv.id, "invoice_issued", inv.total, `Invoice #${inv.id} issued`, ts);

    // Send email via existing mailer pattern (fire-and-forget)
    sendInvoiceEmail(inv).catch(() => {});

    return res.json(sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id));
  }

  if (action === "mark_paid") {
    sqlite.prepare("UPDATE invoices SET status='Paid', paid_at=?, updated_at=? WHERE id=?").run(ts, ts, inv.id);
    sqlite.prepare(
      "INSERT INTO transactions (client_id, invoice_id, type, amount, description, created_at) VALUES (?,?,?,?,?,?)"
    ).run(inv.client_id, inv.id, "charge", inv.total, `Payment received for Invoice #${inv.id}`, ts);
    return res.json(sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id));
  }

  if (action === "void") {
    sqlite.prepare("UPDATE invoices SET status='Void', updated_at=? WHERE id=?").run(ts, inv.id);
    if (stripe && inv.stripe_invoice_id) {
      stripe.invoices.voidInvoice(inv.stripe_invoice_id).catch(() => {});
    }
    return res.json(sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id));
  }

  if (notes !== undefined) {
    sqlite.prepare("UPDATE invoices SET notes=?, updated_at=? WHERE id=?").run(notes, ts, inv.id);
    return res.json(sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id));
  }

  res.status(400).json({ error: "Unknown action" });
});

// POST /api/invoices/:id/line-items — add line item (manage_billing)
router.post("/invoices/:id/line-items", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const inv: any = sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(Number(req.params.id));
  if (!inv) return res.status(404).json({ error: "Not found" });
  const { source_type = "manual", source_id, description, quantity = 1, unit_price, amount } = req.body;
  if (!description || (!unit_price && !amount)) return res.status(400).json({ error: "description + amount required" });
  const amt = fmt(amount ?? (quantity * unit_price));
  sqlite.prepare(
    "INSERT INTO invoice_line_items (invoice_id, source_type, source_id, description, quantity, unit_price, amount, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(inv.id, source_type, source_id ?? null, description, quantity, unit_price ?? amt, amt, now());
  recalcInvoice(inv.id);
  res.json(sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id));
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

router.get("/transactions", (req: Request, res: Response) => {
  if (!requireViewBilling(req, res)) return;
  const role = getRole(req);
  const userId = getUserId(req);
  let rows: any[];
  if (role === "client") {
    rows = sqlite.prepare("SELECT * FROM transactions WHERE client_id=? ORDER BY created_at DESC LIMIT 100").all(userId) as any[];
  } else {
    rows = sqlite.prepare(
      "SELECT t.*, u.name as client_name FROM transactions t LEFT JOIN users u ON u.id=t.client_id ORDER BY t.created_at DESC LIMIT 200"
    ).all() as any[];
  }
  res.json(rows);
});

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT BILLING ACCOUNTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/billing/accounts — list (manage_billing)
router.get("/billing/accounts", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const rows = sqlite.prepare(
    "SELECT a.*, u.name as client_name, u.email FROM client_billing_accounts a LEFT JOIN users u ON u.id=a.client_id"
  ).all();
  res.json(rows);
});

// PATCH /api/billing/accounts/:clientId
router.patch("/billing/accounts/:clientId", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const { subscription_tier, billing_day, status } = req.body;
  const ts = now();
  ensureBillingAccount(Number(req.params.clientId));
  const updates: any = { updated_at: ts };
  if (subscription_tier) updates.subscription_tier = subscription_tier;
  if (billing_day) updates.billing_day = billing_day;
  if (status) updates.status = status;
  const setClauses = Object.keys(updates).map(k => `${k}=?`).join(",");
  sqlite.prepare(`UPDATE client_billing_accounts SET ${setClauses} WHERE client_id=?`).run(...Object.values(updates), Number(req.params.clientId));
  res.json(sqlite.prepare("SELECT * FROM client_billing_accounts WHERE client_id=?").get(Number(req.params.clientId)));
});

// GET /api/me/billing — client billing summary
router.get("/me/billing", (req: Request, res: Response) => {
  const role = getRole(req);
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const acct: any = ensureBillingAccount(userId);
  const client: any = sqlite.prepare("SELECT name, email FROM users WHERE id=?").get(userId);

  const d = new Date();
  const periodStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];

  // Current open invoice
  const currentInvoice: any = sqlite.prepare(
    "SELECT * FROM invoices WHERE client_id=? AND period_start=? LIMIT 1"
  ).get(userId, periodStart);

  let currentLineItems: any[] = [];
  if (currentInvoice) {
    currentLineItems = sqlite.prepare("SELECT * FROM invoice_line_items WHERE invoice_id=? ORDER BY created_at").all(currentInvoice.id) as any[];
  }

  // All past invoices (not current period Open)
  const pastInvoices: any[] = sqlite.prepare(
    "SELECT * FROM invoices WHERE client_id=? AND (status!='Open' OR period_start!=?) ORDER BY period_start DESC"
  ).all(userId, periodStart) as any[];

  // Outstanding balance = sum of Issued unpaid + current total
  const outstanding = sqlite.prepare(
    "SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE client_id=? AND status IN ('Open','Issued')"
  ).get(userId) as any;

  // Recent transactions
  const recentTxns: any[] = sqlite.prepare(
    "SELECT * FROM transactions WHERE client_id=? ORDER BY created_at DESC LIMIT 10"
  ).all(userId) as any[];

  // Pending quotes
  const pendingQuotes: any[] = sqlite.prepare(
    "SELECT q.*, p.nickname as property_name FROM quotes q LEFT JOIN properties p ON p.id=q.property_id WHERE q.client_id=? AND q.status='Sent' ORDER BY q.sent_at DESC"
  ).all(userId) as any[];

  const nextBillDate = new Date(d.getFullYear(), d.getMonth() + 1, acct.billing_day);

  res.json({
    account: acct,
    client,
    balance_due: fmt(outstanding?.total ?? 0),
    next_bill_date: nextBillDate.toISOString().split("T")[0],
    current_invoice: currentInvoice ? { ...currentInvoice, line_items: currentLineItems } : null,
    past_invoices: pastInvoices,
    recent_transactions: recentTxns,
    pending_quotes: pendingQuotes.map((q: any) => ({ ...q, line_items: JSON.parse(q.line_items || "[]") })),
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// VENDOR PAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/vendor-payouts
router.get("/vendor-payouts", (req: Request, res: Response) => {
  const role = getRole(req);
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let rows: any[];
  if (role === "vendor") {
    // Vendors see only their own payouts (amount/method/status — never client billing)
    rows = sqlite.prepare(
      "SELECT id, amount, method, status, paid_at, note, created_at FROM vendor_payouts WHERE vendor_id=? ORDER BY created_at DESC"
    ).all(userId) as any[];
  } else {
    if (!requireManageBilling(req, res)) return;
    rows = sqlite.prepare(
      "SELECT vp.*, u.name as vendor_name FROM vendor_payouts vp LEFT JOIN users u ON u.id=vp.vendor_id ORDER BY vp.created_at DESC"
    ).all() as any[];
  }
  res.json(rows);
});

// POST /api/vendor-payouts — record payout (manage_billing)
router.post("/vendor-payouts", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const { vendor_id, work_order_id, amount, method = "check", note } = req.body;
  if (!vendor_id || !amount) return res.status(400).json({ error: "vendor_id and amount required" });
  const userId = getUserId(req);
  const ts = now();
  const result: any = sqlite.prepare(
    "INSERT INTO vendor_payouts (vendor_id, work_order_id, amount, method, status, note, recorded_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id"
  ).get(vendor_id, work_order_id ?? null, fmt(amount), method, "Pending", note ?? null, userId, ts, ts);
  res.json(sqlite.prepare("SELECT vp.*, u.name as vendor_name FROM vendor_payouts vp LEFT JOIN users u ON u.id=vp.vendor_id WHERE vp.id=?").get(result.id));
});

// PATCH /api/vendor-payouts/:id — mark paid (manage_billing)
router.patch("/vendor-payouts/:id", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const payout: any = sqlite.prepare("SELECT * FROM vendor_payouts WHERE id=?").get(Number(req.params.id));
  if (!payout) return res.status(404).json({ error: "Not found" });
  const { action, note, method, amount } = req.body;
  const ts = now();
  if (action === "mark_paid") {
    sqlite.prepare("UPDATE vendor_payouts SET status='Paid', paid_at=?, updated_at=? WHERE id=?").run(ts, ts, payout.id);
  } else {
    const updates: any = { updated_at: ts };
    if (note !== undefined) updates.note = note;
    if (method) updates.method = method;
    if (amount) updates.amount = fmt(amount);
    const setClauses = Object.keys(updates).map(k => `${k}=?`).join(",");
    sqlite.prepare(`UPDATE vendor_payouts SET ${setClauses} WHERE id=?`).run(...Object.values(updates), payout.id);
  }
  res.json(sqlite.prepare("SELECT vp.*, u.name as vendor_name FROM vendor_payouts vp LEFT JOIN users u ON u.id=vp.vendor_id WHERE vp.id=?").get(payout.id));
});

// ══════════════════════════════════════════════════════════════════════════════
// DISPUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/disputes — client files dispute
router.post("/disputes", (req: Request, res: Response) => {
  const role = getRole(req);
  if (role !== "client" && !can(req, "manage_billing")) return res.status(403).json({ error: "Clients only" });
  const userId = getUserId(req);
  const { invoice_id, line_item_id, reason } = req.body;
  if (!reason) return res.status(400).json({ error: "reason required" });

  // Verify ownership
  if (invoice_id) {
    const inv: any = sqlite.prepare("SELECT * FROM invoices WHERE id=?").get(Number(invoice_id));
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    if (role === "client" && inv.client_id !== userId) return res.status(403).json({ error: "Access denied" });
  }

  const ts = now();
  const result: any = sqlite.prepare(
    "INSERT INTO billing_disputes (invoice_id, line_item_id, client_id, reason, status, created_at, updated_at) VALUES (?,?,?,?,'Open',?,?) RETURNING id"
  ).get(invoice_id ?? null, line_item_id ?? null, userId, reason, ts, ts);
  res.json(sqlite.prepare("SELECT * FROM billing_disputes WHERE id=?").get(result.id));
});

// GET /api/disputes
router.get("/disputes", (req: Request, res: Response) => {
  const role = getRole(req);
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  let rows: any[];
  if (role === "client") {
    rows = sqlite.prepare("SELECT d.*, i.period_start, i.period_end FROM billing_disputes d LEFT JOIN invoices i ON i.id=d.invoice_id WHERE d.client_id=? ORDER BY d.created_at DESC").all(userId) as any[];
  } else {
    if (!requireManageBilling(req, res)) return;
    rows = sqlite.prepare(
      "SELECT d.*, u.name as client_name, i.period_start, i.period_end FROM billing_disputes d LEFT JOIN users u ON u.id=d.client_id LEFT JOIN invoices i ON i.id=d.invoice_id ORDER BY d.created_at DESC"
    ).all() as any[];
  }
  res.json(rows);
});

// PATCH /api/disputes/:id — admin resolves
router.patch("/disputes/:id", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const dispute: any = sqlite.prepare("SELECT * FROM billing_disputes WHERE id=?").get(Number(req.params.id));
  if (!dispute) return res.status(404).json({ error: "Not found" });
  const { action, staff_notes, credit_amount } = req.body;
  const ts = now();
  const userId = getUserId(req);

  if (action === "uphold") {
    sqlite.prepare("UPDATE billing_disputes SET status='Resolved-Upheld', staff_notes=?, resolution='upheld', resolved_by=?, resolved_at=?, updated_at=? WHERE id=?")
      .run(staff_notes ?? null, userId, ts, ts, dispute.id);
  } else if (action === "credit") {
    sqlite.prepare("UPDATE billing_disputes SET status='Resolved-Credited', staff_notes=?, resolution='credited', resolved_by=?, resolved_at=?, updated_at=? WHERE id=?")
      .run(staff_notes ?? null, userId, ts, ts, dispute.id);
    // Apply a credit transaction and adjustment line item on the invoice
    if (dispute.invoice_id && credit_amount) {
      const amt = fmt(Number(credit_amount));
      sqlite.prepare(
        "INSERT INTO transactions (client_id, invoice_id, type, amount, description, created_at) VALUES (?,?,?,?,?,?)"
      ).run(dispute.client_id, dispute.invoice_id, "refund", -amt, `Credit applied for disputed charge (Dispute #${dispute.id})`, ts);
      sqlite.prepare(
        "INSERT INTO invoice_line_items (invoice_id, source_type, source_id, description, quantity, unit_price, amount, created_at) VALUES (?,?,?,?,1,?,?,?)"
      ).run(dispute.invoice_id, "adjustment", dispute.id, `Credit adjustment — Dispute #${dispute.id} resolved`, -amt, -amt, ts);
      recalcInvoice(dispute.invoice_id);
    }
  } else if (action === "review") {
    sqlite.prepare("UPDATE billing_disputes SET status='Reviewing', staff_notes=?, updated_at=? WHERE id=?").run(staff_notes ?? null, ts, dispute.id);
  } else {
    if (staff_notes !== undefined) sqlite.prepare("UPDATE billing_disputes SET staff_notes=?, updated_at=? WHERE id=?").run(staff_notes, ts, dispute.id);
  }
  res.json(sqlite.prepare("SELECT * FROM billing_disputes WHERE id=?").get(dispute.id));
});

// ══════════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK
// ══════════════════════════════════════════════════════════════════════════════

router.post("/stripe/webhook", (req: Request, res: Response) => {
  if (!stripe) return res.status(400).json({ error: "Stripe not configured" });
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret ?? "");
  } catch (e: any) {
    return res.status(400).json({ error: `Webhook signature failed: ${e.message}` });
  }

  const ts = now();
  if (event.type === "invoice.payment_succeeded") {
    const stripeInv = event.data.object as Stripe.Invoice;
    const localInv: any = sqlite.prepare("SELECT * FROM invoices WHERE stripe_invoice_id=?").get(stripeInv.id);
    if (localInv && localInv.status !== "Paid") {
      sqlite.prepare("UPDATE invoices SET status='Paid', paid_at=?, updated_at=? WHERE id=?").run(ts, ts, localInv.id);
      sqlite.prepare(
        "INSERT INTO transactions (client_id, invoice_id, type, amount, method, stripe_payment_intent_id, description, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(localInv.client_id, localInv.id, "charge", localInv.total, "stripe",
        (stripeInv as any).payment_intent ?? null, `Stripe payment for Invoice #${localInv.id}`, ts);
    }
  } else if (event.type === "invoice.payment_failed") {
    const stripeInv = event.data.object as Stripe.Invoice;
    const localInv: any = sqlite.prepare("SELECT * FROM invoices WHERE stripe_invoice_id=?").get(stripeInv.id);
    if (localInv) {
      sqlite.prepare("UPDATE invoices SET status='Issued', notes=?, updated_at=? WHERE id=?")
        .run("Payment failed — retry pending", ts, localInv.id);
    }
  }

  res.json({ received: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// REVENUE SUMMARY (admin dashboard)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/billing/summary", (req: Request, res: Response) => {
  if (!requireManageBilling(req, res)) return;
  const d = new Date();
  const periodStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0];
  const prevEnd = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split("T")[0];

  const thisMonthRevenue: any = sqlite.prepare(
    "SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE period_start=? AND status NOT IN ('Void','Open')"
  ).get(periodStart);

  const outstandingBalance: any = sqlite.prepare(
    "SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status IN ('Issued','Open')"
  ).get();

  const openQuotes: any = sqlite.prepare(
    "SELECT COUNT(*) as c, COALESCE(SUM(total),0) as total FROM quotes WHERE status IN ('Draft','Sent')"
  ).get();

  const pendingPayouts: any = sqlite.prepare(
    "SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as total FROM vendor_payouts WHERE status='Pending'"
  ).get();

  const openDisputes: any = sqlite.prepare(
    "SELECT COUNT(*) as c FROM billing_disputes WHERE status IN ('Open','Reviewing')"
  ).get();

  const activeClients: any = sqlite.prepare(
    "SELECT COUNT(*) as c FROM client_billing_accounts WHERE status='active'"
  ).get();

  res.json({
    this_month_revenue: fmt(thisMonthRevenue?.total ?? 0),
    outstanding_balance: fmt(outstandingBalance?.total ?? 0),
    open_quotes: { count: openQuotes?.c ?? 0, value: fmt(openQuotes?.total ?? 0) },
    pending_payouts: { count: pendingPayouts?.c ?? 0, value: fmt(pendingPayouts?.total ?? 0) },
    open_disputes: openDisputes?.c ?? 0,
    active_clients: activeClients?.c ?? 0,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL helper (fire-and-forget via Zoho/mailer)
// ══════════════════════════════════════════════════════════════════════════════

async function sendInvoiceEmail(inv: any) {
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.zoho.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const client: any = sqlite.prepare("SELECT name, email FROM users WHERE id=?").get(inv.client_id);
    const lineItems: any[] = sqlite.prepare("SELECT * FROM invoice_line_items WHERE invoice_id=?").all(inv.id) as any[];
    const itemRows = lineItems.map(i =>
      `<tr><td style="padding:6px 12px">${i.description}</td><td style="padding:6px 12px;text-align:right">$${fmt(i.amount).toFixed(2)}</td></tr>`
    ).join("");

    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? "info@standingrockstewards.com",
      to: client?.email ?? process.env.MAIL_ADMIN,
      subject: `Standing Rock Stewardship Co. — Invoice #${inv.id} ($${fmt(inv.total).toFixed(2)})`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
          <div style="background:#1C1C1C;padding:24px;text-align:center">
            <h2 style="color:#F5F0EA;margin:0">Standing Rock Stewardship Co.</h2>
            <p style="color:#C05A43;margin:4px 0 0">Invoice Statement</p>
          </div>
          <div style="padding:24px">
            <p>Dear ${client?.name ?? "Valued Client"},</p>
            <p>Your monthly statement for the period <strong>${inv.period_start}</strong> to <strong>${inv.period_end}</strong> is ready.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <thead>
                <tr style="background:#F5F0EA">
                  <th style="padding:8px 12px;text-align:left">Description</th>
                  <th style="padding:8px 12px;text-align:right">Amount</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
              <tfoot>
                <tr style="background:#1C1C1C;color:#F5F0EA">
                  <td style="padding:8px 12px"><strong>Total Due</strong></td>
                  <td style="padding:8px 12px;text-align:right"><strong>$${fmt(inv.total).toFixed(2)}</strong></td>
                </tr>
              </tfoot>
            </table>
            <p style="color:#666;font-size:13px">Due date: ${inv.due_at ?? "Upon receipt"}</p>
            ${inv.stripe_hosted_url ? `<a href="${inv.stripe_hosted_url}" style="display:inline-block;background:#C05A43;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Pay Online</a>` : ""}
          </div>
          <div style="background:#F5F0EA;padding:16px;text-align:center;font-size:12px;color:#666">
            Standing Rock Stewardship Co. LLC · Lake Eufaula, Oklahoma · (918) 707-2228 · standingrockstewards.com
          </div>
        </div>
      `,
    });
  } catch (e: any) {
    console.error("Invoice email error:", e.message);
  }
}

export default router;
