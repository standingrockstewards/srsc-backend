/**
 * SRSC — Onboarding, ToS, Document Vault, Lifecycle, Referral
 *
 * Covers:
 *   POST   /api/signup                           — public self sign-up (Pending client)
 *   GET    /api/onboarding/queue                 — Admin: list pending accounts
 *   PATCH  /api/onboarding/:id/activate          — Admin: activate + link property + tier
 *   GET    /api/tos/current                      — current ToS version (authed)
 *   POST   /api/tos/accept                       — log acceptance (authed client)
 *   GET    /api/tos/versions                     — list all versions (manage_users)
 *   POST   /api/tos/versions                     — publish new version (manage_users)
 *   GET    /api/properties/:id/documents         — doc vault (scoped by role+visibility)
 *   POST   /api/properties/:id/documents         — upload doc (staff or own client)
 *   PATCH  /api/properties/:pid/documents/:did   — update visibility/type (manage_users)
 *   DELETE /api/properties/:pid/documents/:did   — delete (manage_users)
 *   GET    /api/vendors/:id/compliance           — vendor doc gate status
 *   POST   /api/vendors/:id/documents            — vendor uploads required doc
 *   PATCH  /api/vendors/:id/documents/:did/verify— Admin verifies vendor doc
 *   GET    /api/properties/:id/export            — staff export property records
 *   GET    /api/me/export                        — client exports own records
 *   PATCH  /api/clients/:id/deactivate           — soft-delete / offboard client
 *   DELETE /api/clients/:id                      — hard-delete (Admin, post-retention)
 *   GET    /api/offboarding/:id/checklist        — offboarding checklist state
 *   GET    /api/referrals                        — Admin: all referrals
 *   GET    /api/me/referral                      — client: own referral code + stats
 *   POST   /api/referrals/use                    — record a referred sign-up
 */

import { Router, type Request, type Response } from "express";
import { sqlite } from "./storage";
import { requirePermission, PERMISSIONS } from "./permissions";

function getUserId(req: Request): number { return Number(req.headers["x-user-id"]); }
function getUserRole(req: Request): string { return (req.headers["x-user-role"] as string) || ""; }

export const onboardingRouter = Router();

// ─── Schema migrations ─────────────────────────────────────────────��──────────
try {
  sqlite.exec(`
    -- ToS versioning
    CREATE TABLE IF NOT EXISTS tos_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_label TEXT NOT NULL,
      body TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 0
    );

    -- ToS acceptances (immutable audit log)
    CREATE TABLE IF NOT EXISTS tos_acceptances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tos_version_id INTEGER NOT NULL,
      accepted_at TEXT NOT NULL,
      ip_address TEXT
    );

    -- Property document vault
    CREATE TABLE IF NOT EXISTS property_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      file_data TEXT,
      file_name TEXT,
      file_mime TEXT,
      visibility TEXT NOT NULL DEFAULT 'staff_only',
      uploaded_by INTEGER,
      source_type TEXT,
      source_id INTEGER,
      created_at TEXT NOT NULL
    );

    -- Referrals
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_client_id INTEGER NOT NULL,
      referral_code TEXT NOT NULL,
      referred_email TEXT,
      referred_user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      reward_note TEXT,
      created_at TEXT NOT NULL,
      converted_at TEXT
    );
  `);
} catch {}

// Add columns to users table for onboarding
try { sqlite.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN onboarding_step TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN tos_accepted_version_id INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN tos_accepted_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN referral_code TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN referred_by_code TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN deactivated_at TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE users ADD COLUMN retention_delete_after TEXT`); } catch {}

// Add compliance columns to vendor_documents
try { sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN doc_category TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN verified_by INTEGER`); } catch {}
try { sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN verified_at TEXT`); } catch {}

// Seed a placeholder ToS if none exists
{
  const existing = sqlite.prepare("SELECT COUNT(*) as c FROM tos_versions").get() as any;
  if (existing.c === 0) {
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO tos_versions (version_label, body, effective_date, created_by, created_at, is_current)
      VALUES (?, ?, ?, NULL, ?, 1)
    `).run(
      "v1.0 — 2026-07-23",
      `# Standing Rock Stewardship Co. — Terms of Service\n\n**Version 1.0 · Effective July 23, 2026**\n\n> ⚠️ PLACEHOLDER — Attorney-approved legal text to be inserted here by Standing Rock Stewardship Co. before go-live. This placeholder must be replaced before accepting real client agreements.\n\n## 1. Services\nStanding Rock Stewardship Co. LLC ("SRSC") provides property stewardship, monitoring, and related services for lake properties as described in your Service Agreement.\n\n## 2. Billing & Retainer\nClients maintain a retainer balance used for task billing. SRSC will provide advance notice of any balance draws above the agreed threshold. Subscriptions auto-bill monthly per the selected tier.\n\n## 3. Storm Grace Period\nDuring active storm advisories, emergency response tasks may begin immediately. Client will be notified via Signal Flare within 24 hours of any emergency action taken.\n\n## 4. Data & Privacy\nSRSC collects property information, visit records, and communications solely to deliver services. Data is retained for a minimum of 3 years following service termination per retention policy.\n\n## 5. Termination\nEither party may terminate with 30 days written notice. Final balances are settled at termination. Property data is retained per Section 4.\n\n_[PLACEHOLDER — Replace with attorney-approved text before launch]_`,
      now,
      now
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateReferralCode(userId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SR";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code + userId;
}

// ─── PUBLIC SIGN-UP ────────────────────────────────────────────────────────────
onboardingRouter.post("/signup", (req: Request, res: Response) => {
  const { name, email, phone, password, username, referralCode } = req.body;
  if (!name || !email || !password || !username) {
    return res.status(400).json({ error: "name, email, username, and password are required" });
  }
  // Check username not taken
  const existing = sqlite.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
  if (existing) return res.status(409).json({ error: "Username already taken" });
  const now = new Date().toISOString();
  try {
    const user = sqlite.prepare(`
      INSERT INTO users (username, password, name, email, phone, role, active, status, onboarding_step, referred_by_code, created_at)
      VALUES (?, ?, ?, ?, ?, 'client', 0, 'pending', 'awaiting_activation', ?, ?)
      RETURNING *
    `).get(username, password, name, email, phone ?? null, referralCode ?? null, now) as any;

    // Track referral if code provided
    if (referralCode) {
      const referral = sqlite.prepare("SELECT * FROM referrals WHERE referral_code = ?").get(referralCode) as any;
      if (referral) {
        sqlite.prepare(`
          UPDATE referrals SET referred_email = ?, referred_user_id = ?, status = 'signed_up' WHERE referral_code = ?
        `).run(email, user.id, referralCode);
      }
    }

    const { password: _pw, ...safeUser } = user;
    res.status(201).json({ user: safeUser, message: "Account created. Pending admin activation." });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ─── ONBOARDING QUEUE ────────────────────────────────────────────────────────
onboardingRouter.get(
  "/onboarding/queue",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (_req: Request, res: Response) => {
    const pending = sqlite.prepare(`
      SELECT id, username, name, email, phone, role, status, onboarding_step, referred_by_code, created_at
      FROM users WHERE status = 'pending' ORDER BY created_at DESC
    `).all();
    res.json({ pending, count: (pending as any[]).length });
  }
);

// PATCH /api/onboarding/:id/activate — activate client, optionally link property/tier
onboardingRouter.patch(
  "/onboarding/:id/activate",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { propertyId, tier, sendWelcome } = req.body;
    const now = new Date().toISOString();

    // Generate referral code
    const code = generateReferralCode(id);
    sqlite.prepare(`
      UPDATE users SET status = 'active', active = 1, onboarding_step = 'first_run', referral_code = ? WHERE id = ?
    `).run(code, id);

    // Create referral record
    const existing = sqlite.prepare("SELECT id FROM referrals WHERE referral_code = ?").get(code) as any;
    if (!existing) {
      sqlite.prepare(`
        INSERT INTO referrals (referrer_client_id, referral_code, status, created_at) VALUES (?, ?, 'active', ?)
      `).run(id, code, now);
    }

    // Link property if provided
    if (propertyId) {
      sqlite.prepare("UPDATE properties SET client_user_id = ?, service_tier = COALESCE(?, service_tier) WHERE id = ?")
        .run(id, tier ?? null, propertyId);
    }

    const user = sqlite.prepare("SELECT id, username, name, email, role, status, onboarding_step, referral_code FROM users WHERE id = ?").get(id) as any;
    res.json({ user, activated: true, referralCode: code });
  }
);

// ─── ToS ENDPOINTS ────────────────────────────────────────────────────────────

// GET /api/tos/current — returns current version (authed)
onboardingRouter.get("/tos/current", (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });
  const version = sqlite.prepare("SELECT * FROM tos_versions WHERE is_current = 1 ORDER BY id DESC LIMIT 1").get() as any;
  if (!version) return res.status(404).json({ error: "No ToS published yet" });

  // Check if this user has accepted this version
  const acceptance = sqlite.prepare(
    "SELECT * FROM tos_acceptances WHERE user_id = ? AND tos_version_id = ? LIMIT 1"
  ).get(userId, version.id) as any;

  res.json({ version, accepted: !!acceptance, acceptance: acceptance ?? null });
});

// POST /api/tos/accept — record acceptance
onboardingRouter.post("/tos/accept", (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });
  const { tosVersionId } = req.body;
  if (!tosVersionId) return res.status(400).json({ error: "tosVersionId required" });

  // Idempotent — if already accepted, return existing
  const existing = sqlite.prepare(
    "SELECT * FROM tos_acceptances WHERE user_id = ? AND tos_version_id = ? LIMIT 1"
  ).get(userId, tosVersionId) as any;
  if (existing) return res.json({ acceptance: existing, alreadyAccepted: true });

  const ip = req.headers["x-forwarded-for"] as string ?? req.socket.remoteAddress ?? null;
  const now = new Date().toISOString();
  const acceptance = sqlite.prepare(`
    INSERT INTO tos_acceptances (user_id, tos_version_id, accepted_at, ip_address)
    VALUES (?, ?, ?, ?) RETURNING *
  `).get(userId, tosVersionId, now, ip) as any;

  // Advance onboarding step if in first-run
  sqlite.prepare(`
    UPDATE users SET tos_accepted_version_id = ?, tos_accepted_at = ?,
    onboarding_step = CASE WHEN onboarding_step = 'tos' THEN 'retainer' ELSE onboarding_step END
    WHERE id = ?
  `).run(tosVersionId, now, userId);

  res.status(201).json({ acceptance });
});

// GET /api/tos/versions — list all (manage_users)
onboardingRouter.get(
  "/tos/versions",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (_req: Request, res: Response) => {
    const versions = sqlite.prepare("SELECT * FROM tos_versions ORDER BY id DESC").all();
    res.json({ versions });
  }
);

// POST /api/tos/versions — publish new version (manage_users)
onboardingRouter.post(
  "/tos/versions",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { versionLabel, body, effectiveDate, makeCurrent } = req.body;
    if (!versionLabel || !body || !effectiveDate) {
      return res.status(400).json({ error: "versionLabel, body, effectiveDate required" });
    }
    const now = new Date().toISOString();
    const isCurrent = makeCurrent !== false ? 1 : 0;

    if (isCurrent) {
      sqlite.prepare("UPDATE tos_versions SET is_current = 0").run();
    }
    const version = sqlite.prepare(`
      INSERT INTO tos_versions (version_label, body, effective_date, created_by, created_at, is_current)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING *
    `).get(versionLabel, body, effectiveDate, userId, now, isCurrent) as any;

    // If made current, clear tos_accepted_version_id for all clients who accepted an older version
    // so they get prompted at next login
    if (isCurrent) {
      sqlite.prepare(`
        UPDATE users SET tos_accepted_version_id = NULL, tos_accepted_at = NULL
        WHERE role = 'client' AND (tos_accepted_version_id IS NULL OR tos_accepted_version_id != ?)
      `).run(version.id);
    }

    res.status(201).json({ version });
  }
);

// ─── PROPERTY DOCUMENT VAULT ──────────────────────────────────────────────────

// GET /api/properties/:id/documents
onboardingRouter.get("/properties/:id/documents", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const propertyId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  // Client: only their own property, client-visible docs only
  if (role === "client") {
    const prop = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(propertyId) as any;
    if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Forbidden" });
    const docs = sqlite.prepare(`
      SELECT id, property_id, doc_type, title, file_name, file_mime, visibility, uploaded_by, source_type, source_id, created_at
      FROM property_documents WHERE property_id = ? AND visibility = 'client_visible' ORDER BY created_at DESC
    `).all(propertyId);
    return res.json({ documents: docs });
  }

  // Vendor: no access
  if (role === "vendor") return res.status(403).json({ error: "Forbidden" });

  // Staff: all docs
  const docs = sqlite.prepare(`
    SELECT id, property_id, doc_type, title, file_name, file_mime, visibility, uploaded_by, source_type, source_id, created_at
    FROM property_documents WHERE property_id = ? ORDER BY created_at DESC
  `).all(propertyId);
  res.json({ documents: docs });
});

// POST /api/properties/:id/documents — upload doc
onboardingRouter.post("/properties/:id/documents", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const propertyId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });
  if (role === "vendor") return res.status(403).json({ error: "Forbidden" });

  // Client can only upload to their own property and only client_visible docs
  if (role === "client") {
    const prop = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(propertyId) as any;
    if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Forbidden" });
  }

  const { docType, title, fileData, fileName, fileMime, visibility, sourceType, sourceId } = req.body;
  if (!docType || !title) return res.status(400).json({ error: "docType and title required" });

  // Clients can only set client_visible
  const vis = role === "client" ? "client_visible" : (visibility ?? "staff_only");
  const now = new Date().toISOString();
  const doc = sqlite.prepare(`
    INSERT INTO property_documents
      (property_id, doc_type, title, file_data, file_name, file_mime, visibility, uploaded_by, source_type, source_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `).get(propertyId, docType, title, fileData ?? null, fileName ?? null, fileMime ?? null, vis, userId, sourceType ?? null, sourceId ?? null, now) as any;

  // Strip file_data from response
  const { file_data: _fd, ...safeDoc } = doc;
  res.status(201).json({ document: safeDoc });
});

// GET /api/properties/:pid/documents/:did/download — serve file (scoped)
onboardingRouter.get("/properties/:pid/documents/:did/download", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const propertyId = Number(req.params.pid);
  const docId = Number(req.params.did);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  const doc = sqlite.prepare("SELECT * FROM property_documents WHERE id = ? AND property_id = ?").get(docId, propertyId) as any;
  if (!doc) return res.status(404).json({ error: "Not found" });

  // Client: only client_visible, own property
  if (role === "client") {
    const prop = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(propertyId) as any;
    if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Forbidden" });
    if (doc.visibility !== "client_visible") return res.status(403).json({ error: "Forbidden" });
  }
  if (role === "vendor") return res.status(403).json({ error: "Forbidden" });

  if (!doc.file_data) return res.status(404).json({ error: "No file data" });

  // Return base64 data url or raw
  res.json({ fileData: doc.file_data, fileName: doc.file_name, fileMime: doc.file_mime });
});

// PATCH /api/properties/:pid/documents/:did — update visibility/type
onboardingRouter.patch(
  "/properties/:pid/documents/:did",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const docId = Number(req.params.did);
    const propertyId = Number(req.params.pid);
    const { visibility, docType, title } = req.body;
    const fields: string[] = [];
    const vals: any[] = [];
    if (visibility !== undefined) { fields.push("visibility = ?"); vals.push(visibility); }
    if (docType !== undefined) { fields.push("doc_type = ?"); vals.push(docType); }
    if (title !== undefined) { fields.push("title = ?"); vals.push(title); }
    if (!fields.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(docId, propertyId);
    const doc = sqlite.prepare(`UPDATE property_documents SET ${fields.join(", ")} WHERE id = ? AND property_id = ? RETURNING *`).get(...vals) as any;
    if (!doc) return res.status(404).json({ error: "Not found" });
    const { file_data: _fd, ...safeDoc } = doc;
    res.json({ document: safeDoc });
  }
);

// DELETE /api/properties/:pid/documents/:did
onboardingRouter.delete(
  "/properties/:pid/documents/:did",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const docId = Number(req.params.did);
    const propertyId = Number(req.params.pid);
    sqlite.prepare("DELETE FROM property_documents WHERE id = ? AND property_id = ?").run(docId, propertyId);
    res.json({ deleted: true });
  }
);

// ─── VENDOR COMPLIANCE GATE ───────────────────────────────────────────────────

// GET /api/vendors/:id/compliance
onboardingRouter.get("/vendors/:id/compliance", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const vendorId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  // Vendor can only see their own
  if (role === "vendor" && userId !== vendorId) return res.status(403).json({ error: "Forbidden" });

  const docs = sqlite.prepare(`
    SELECT id, title, doc_category, status, file_name, review_notes, verified_at, created_at
    FROM vendor_documents WHERE vendor_id = ? AND doc_category IN ('coi','w9','vendor_agreement')
    ORDER BY doc_category
  `).all(vendorId) as any[];

  const required = ["coi", "w9", "vendor_agreement"];
  const byCategory: Record<string, any> = {};
  for (const d of docs) {
    if (!byCategory[d.doc_category] || d.id > byCategory[d.doc_category].id) {
      byCategory[d.doc_category] = d;
    }
  }

  const gates = required.map(cat => ({
    category: cat,
    label: cat === "coi" ? "Certificate of Insurance" : cat === "w9" ? "W-9" : "Vendor Agreement",
    doc: byCategory[cat] ?? null,
    verified: byCategory[cat]?.status === "verified",
  }));

  const allVerified = gates.every(g => g.verified);
  res.json({ gates, payoutAllowed: allVerified, vendorId });
});

// POST /api/vendors/:id/documents — vendor uploads required doc
onboardingRouter.post("/vendors/:id/documents", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  const vendorId = Number(req.params.id);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  // Vendor uploads own docs; admin/supervisor can upload for any vendor
  if (role === "vendor" && userId !== vendorId) return res.status(403).json({ error: "Forbidden" });

  const { title, docCategory, fileData, fileName, fileMime } = req.body;
  if (!title || !docCategory) return res.status(400).json({ error: "title and docCategory required" });

  const now = new Date().toISOString();
  const doc = sqlite.prepare(`
    INSERT INTO vendor_documents (title, file_url, file_type, vendor_id, doc_category, uploaded_by, status, file_data, uploaded_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?) RETURNING *
  `).get(fileName ?? title, fileName ?? null, fileMime ?? null, vendorId, docCategory, userId, fileData ?? null, now, now) as any;

  const { file_data: _fd, ...safeDoc } = doc;
  res.status(201).json({ document: safeDoc });
});

// PATCH /api/vendors/:id/documents/:did/verify — admin verifies
onboardingRouter.patch(
  "/vendors/:id/documents/:did/verify",
  requirePermission(PERMISSIONS.MANAGE_VENDORS),
  (req: Request, res: Response) => {
    const userId = getUserId(req);
    const docId = Number(req.params.did);
    const vendorId = Number(req.params.id);
    const { status, reviewNotes } = req.body; // 'verified' | 'rejected'
    if (!status) return res.status(400).json({ error: "status required" });
    const now = new Date().toISOString();
    const doc = sqlite.prepare(`
      UPDATE vendor_documents SET status = ?, review_notes = ?, verified_by = ?, verified_at = ?
      WHERE id = ? AND vendor_id = ? RETURNING *
    `).get(status, reviewNotes ?? null, userId, now, docId, vendorId) as any;
    if (!doc) return res.status(404).json({ error: "Not found" });
    const { file_data: _fd, ...safeDoc } = doc;
    res.json({ document: safeDoc });
  }
);

// ─── EXPORT ───────────────────────────────────────────────────────────────────

function buildPropertyExport(propertyId: number): any {
  const prop = sqlite.prepare("SELECT * FROM properties WHERE id = ?").get(propertyId) as any;
  if (!prop) return null;

  const visits = sqlite.prepare("SELECT * FROM scheduled_visits WHERE property_id = ? ORDER BY date DESC").all(propertyId) as any[];
  const reports = sqlite.prepare("SELECT id, scheduled_visit_id, overall_status, note, completed_at FROM visit_reports WHERE property_id = ? ORDER BY completed_at DESC").all(propertyId) as any[];
  const ledger = sqlite.prepare("SELECT * FROM retainer_ledger WHERE property_id = ? ORDER BY created_at ASC").all(propertyId) as any[];
  const quotes = sqlite.prepare("SELECT id, title, status, total_amount, created_at FROM quotes WHERE property_id = ? ORDER BY created_at DESC").all(propertyId) as any[];
  const flares = sqlite.prepare("SELECT id, title, severity, status, created_at, resolved_at FROM signal_flares WHERE property_id = ? ORDER BY created_at DESC").all(propertyId) as any[];

  return { property: prop, visits, reports, ledger, quotes, signal_flares: flares };
}

// Staff export
onboardingRouter.get("/properties/:id/export", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });
  if (role === "client" || role === "vendor") return res.status(403).json({ error: "Forbidden" });

  const propertyId = Number(req.params.id);
  const fmt = (req.query.format as string) ?? "json";
  const data = buildPropertyExport(propertyId);
  if (!data) return res.status(404).json({ error: "Property not found" });

  if (fmt === "csv") {
    // Ledger CSV
    const header = "date,type,amount,balance_after,note\n";
    const rows = (data.ledger as any[]).map((r: any) =>
      `${r.created_at},${r.entry_type},${r.amount},${r.balance_after},"${(r.note ?? "").replace(/"/g, '""')}"`
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="property-${propertyId}-ledger.csv"`);
    return res.send(header + rows);
  }

  res.json(data);
});

// Client self-export
onboardingRouter.get("/me/export", (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });
  if (role !== "client") return res.status(403).json({ error: "Clients only" });

  const prop = sqlite.prepare("SELECT id FROM properties WHERE client_user_id = ? LIMIT 1").get(userId) as any;
  if (!prop) return res.status(404).json({ error: "No property found" });

  const fmt = (req.query.format as string) ?? "json";
  const data = buildPropertyExport(prop.id);
  if (!data) return res.status(404).json({ error: "Not found" });

  // Strip sensitive fields from client export
  const { alarm_code: _ac, access_notes: _an, alarm_panel_location: _apl, ...safeProp } = data.property;
  const safeData = { ...data, property: safeProp };

  if (fmt === "csv") {
    const header = "date,type,amount,balance_after,note\n";
    const rows = (data.ledger as any[]).map((r: any) =>
      `${r.created_at},${r.entry_type},${r.amount},${r.balance_after},"${(r.note ?? "").replace(/"/g, '""')}"`
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="my-property-export.csv"`);
    return res.send(header + rows);
  }
  res.json(safeData);
});

// ─── LIFECYCLE: SOFT-DELETE / OFFBOARDING ────────────────────────────────────

// GET /api/offboarding/:id/checklist
onboardingRouter.get(
  "/offboarding/:id/checklist",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const clientId = Number(req.params.id);
    const user = sqlite.prepare("SELECT id, name, email, status FROM users WHERE id = ?").get(clientId) as any;
    if (!user) return res.status(404).json({ error: "Not found" });

    const props = sqlite.prepare("SELECT id, nickname FROM properties WHERE client_user_id = ?").all(clientId) as any[];
    const propIds = (props as any[]).map((p: any) => p.id);

    const openQuotes = propIds.length ? sqlite.prepare(
      `SELECT COUNT(*) as c FROM quotes WHERE property_id IN (${propIds.map(() => "?").join(",")}) AND status NOT IN ('approved','rejected','expired')`
    ).get(...propIds) as any : { c: 0 };

    const openFlares = propIds.length ? sqlite.prepare(
      `SELECT COUNT(*) as c FROM signal_flares WHERE property_id IN (${propIds.map(() => "?").join(",")}) AND status = 'open'`
    ).get(...propIds) as any : { c: 0 };

    const balance = propIds.length ? sqlite.prepare(
      `SELECT COALESCE(SUM(rl.balance_after),0) as total FROM retainer_ledger rl
       WHERE rl.property_id IN (${propIds.map(() => "?").join(",")})
       AND rl.id IN (SELECT MAX(id) FROM retainer_ledger GROUP BY property_id)`
    ).get(...propIds) as any : { total: 0 };

    const checklist = [
      { key: "settle_balance", label: "Settle final retainer balance", done: Number(balance.total) <= 0, detail: `Current balance: $${Number(balance.total).toFixed(2)}` },
      { key: "close_quotes", label: "Close all open quotes/work orders", done: openQuotes.c === 0, detail: `${openQuotes.c} open` },
      { key: "close_flares", label: "Resolve open Signal Flares", done: openFlares.c === 0, detail: `${openFlares.c} open` },
      { key: "archive_docs", label: "Archive property documents", done: false, detail: "Manual step — verify docs archived" },
      { key: "confirm_retention", label: "Confirm 3-year data retention policy applied", done: false, detail: "Data retained until retention window expires" },
    ];

    const allDone = checklist.every(c => c.done);
    res.json({ user, properties: props, checklist, readyToDeactivate: allDone });
  }
);

// PATCH /api/clients/:id/deactivate — soft-delete
onboardingRouter.patch(
  "/clients/:id/deactivate",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const clientId = Number(req.params.id);
    const { retentionYears } = req.body;
    const now = new Date().toISOString();
    const retYears = Number(retentionYears ?? 3);
    const deleteAfter = new Date();
    deleteAfter.setFullYear(deleteAfter.getFullYear() + retYears);

    sqlite.prepare(`
      UPDATE users SET status = 'inactive', active = 0, deactivated_at = ?, retention_delete_after = ?
      WHERE id = ?
    `).run(now, deleteAfter.toISOString(), clientId);

    // Deactivate their properties
    sqlite.prepare("UPDATE properties SET active = 0 WHERE client_user_id = ?").run(clientId);

    const user = sqlite.prepare("SELECT id, name, email, status, deactivated_at, retention_delete_after FROM users WHERE id = ?").get(clientId) as any;
    res.json({ user, deactivated: true, retainUntil: deleteAfter.toISOString() });
  }
);

// DELETE /api/clients/:id — hard-delete (Admin only, post-retention)
onboardingRouter.delete("/clients/:id", requirePermission(PERMISSIONS.MANAGE_USERS), (req: Request, res: Response) => {
  const userId = getUserId(req);
  const role = getUserRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Admin only" });

  const clientId = Number(req.params.id);
  const user = sqlite.prepare("SELECT * FROM users WHERE id = ?").get(clientId) as any;
  if (!user) return res.status(404).json({ error: "Not found" });

  // Enforce retention window
  if (user.retention_delete_after) {
    const retDate = new Date(user.retention_delete_after);
    if (new Date() < retDate) {
      return res.status(403).json({
        error: "Retention window has not expired",
        retainUntil: user.retention_delete_after,
      });
    }
  }

  // Soft-check: must be inactive
  if (user.status !== "inactive") {
    return res.status(400).json({ error: "Client must be deactivated before hard-delete" });
  }

  sqlite.prepare("DELETE FROM users WHERE id = ?").run(clientId);
  res.json({ deleted: true, clientId });
});

// ─── REFERRALS ────────────────────────────────────────────────────────────────

// GET /api/referrals — Admin view all
onboardingRouter.get(
  "/referrals",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (_req: Request, res: Response) => {
    const refs = sqlite.prepare(`
      SELECT r.*, u.name as referrer_name, u.email as referrer_email
      FROM referrals r
      LEFT JOIN users u ON u.id = r.referrer_client_id
      ORDER BY r.created_at DESC
    `).all();
    res.json({ referrals: refs });
  }
);

// GET /api/me/referral — client's own referral code + stats
onboardingRouter.get("/me/referral", (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  const user = sqlite.prepare("SELECT referral_code FROM users WHERE id = ?").get(userId) as any;
  if (!user?.referral_code) {
    // Generate one on-demand
    const code = generateReferralCode(userId);
    sqlite.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, userId);
    const now = new Date().toISOString();
    const existing = sqlite.prepare("SELECT id FROM referrals WHERE referral_code = ?").get(code) as any;
    if (!existing) {
      sqlite.prepare("INSERT INTO referrals (referrer_client_id, referral_code, status, created_at) VALUES (?,?,?,?)").run(userId, code, "active", now);
    }
    user.referral_code = code;
  }

  const refs = sqlite.prepare("SELECT id, referred_email, status, created_at, converted_at FROM referrals WHERE referrer_client_id = ? AND referral_code = ?").all(userId, user.referral_code) as any[];
  const converted = (refs as any[]).filter((r: any) => r.status === "converted").length;
  const pending = (refs as any[]).filter((r: any) => r.status === "signed_up").length;

  res.json({
    referralCode: user.referral_code,
    referralLink: `https://standingrockstewards.com/#/signup?ref=${user.referral_code}`,
    stats: { total: refs.length, pending, converted },
    referrals: refs,
  });
});

// PATCH /api/referrals/:id — admin update reward/status
onboardingRouter.patch(
  "/referrals/:id",
  requirePermission(PERMISSIONS.MANAGE_USERS),
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { status, rewardNote } = req.body;
    const now = new Date().toISOString();
    const ref = sqlite.prepare(`
      UPDATE referrals SET status = COALESCE(?, status), reward_note = COALESCE(?, reward_note),
      converted_at = CASE WHEN ? = 'converted' THEN ? ELSE converted_at END
      WHERE id = ? RETURNING *
    `).get(status ?? null, rewardNote ?? null, status ?? "", now, id) as any;
    if (!ref) return res.status(404).json({ error: "Not found" });
    res.json({ referral: ref });
  }
);
