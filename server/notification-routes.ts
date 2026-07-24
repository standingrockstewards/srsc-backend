/**
 * Notification Center Routes
 *
 * Uses existing `in_app_notifications` table + new `notification_preferences` table.
 * Dispatching hooks: signal_flare, quote, billing, storm_events, service_requests, messages, onboarding.
 *
 * GET  /api/notifications               — paginated inbox for current user
 * PATCH /api/notifications/:id          — mark read/unread
 * POST /api/notifications/read-all      — mark all read for current user
 * GET  /api/notification-preferences    — per-user channel prefs
 * PATCH /api/notification-preferences   — update prefs
 * POST /api/notifications/dispatch      — internal helper (also exported function)
 */

import { Router } from "express";
import { sqlite } from "./storage";

export const notificationRouter = Router();

// ─── Bootstrap: ensure notification_preferences table exists ─────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    in_app INTEGER NOT NULL DEFAULT 1,
    email INTEGER NOT NULL DEFAULT 0,
    sms INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, event_type)
  )
`);

// Add severity column to in_app_notifications if not present
try {
  sqlite.exec(`ALTER TABLE in_app_notifications ADD COLUMN severity TEXT DEFAULT 'info'`);
} catch { /* already exists */ }

// ─── Auth helper ─────────────────────────────────────────────────────────────
function authUser(req: any): { userId: number; role: string } | null {
  const userId = Number(req.headers["x-user-id"]);
  const role   = (req.headers["x-user-role"] as string) || "";
  if (!userId || !role) return null;
  return { userId, role };
}

// ─── Default event types + labels ────────────────────────────────────────────
export const EVENT_TYPES = [
  { key: "signal_flare",    label: "Signal Flares",       default_email: false },
  { key: "quote",           label: "Quotes",              default_email: false },
  { key: "billing",         label: "Billing & Invoices",  default_email: false },
  { key: "storm_event",     label: "Storm Events",        default_email: false },
  { key: "service_request", label: "Service Requests",    default_email: false },
  { key: "message",         label: "Messages",            default_email: false },
  { key: "onboarding",      label: "Onboarding",          default_email: false },
  { key: "system",          label: "System Notices",      default_email: false },
];

// ─── Dispatch helper (can be called from other route files) ─────────────────
export function dispatchNotification(opts: {
  userIds: number[];
  type: string;
  severity?: string;
  title: string;
  body: string;
  link?: string;
}) {
  const { userIds, type, severity = "info", title, body, link } = opts;
  const insert = sqlite.prepare(`
    INSERT INTO in_app_notifications (user_id, title, body, type, severity, read, link, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `);
  const now = new Date().toISOString();
  for (const uid of userIds) {
    // Check in-app preference (default: on)
    const pref = sqlite
      .prepare(`SELECT in_app FROM notification_preferences WHERE user_id = ? AND event_type = ?`)
      .get(uid, type) as { in_app: number } | undefined;
    if (pref && pref.in_app === 0) continue;
    insert.run(uid, title, body, type, severity, link ?? null, now);
  }
}

// ─── GET /api/notifications ───────────────────────────────────────────────────
notificationRouter.get("/notifications", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const limit  = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const type   = req.query.type as string | undefined;
  const unread = req.query.unread === "true";

  let where = "WHERE user_id = ?";
  const params: any[] = [auth.userId];

  if (type) { where += " AND type = ?"; params.push(type); }
  if (unread) { where += " AND read = 0"; }

  const total = (sqlite
    .prepare(`SELECT COUNT(*) as c FROM in_app_notifications ${where}`)
    .get(...params) as any).c ?? 0;

  const rows = sqlite
    .prepare(`SELECT * FROM in_app_notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  const unreadCount = (sqlite
    .prepare(`SELECT COUNT(*) as c FROM in_app_notifications WHERE user_id = ? AND read = 0`)
    .get(auth.userId) as any).c ?? 0;

  res.json({ notifications: rows, total, unread_count: unreadCount, limit, offset });
});

// ─── PATCH /api/notifications/:id ────────────────────────────────────────────
notificationRouter.patch("/notifications/:id", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const id = Number(req.params.id);
  const { read } = req.body as { read: boolean };

  const row = sqlite
    .prepare(`SELECT id FROM in_app_notifications WHERE id = ? AND user_id = ?`)
    .get(id, auth.userId);
  if (!row) return res.status(404).json({ error: "Not found" });

  sqlite
    .prepare(`UPDATE in_app_notifications SET read = ? WHERE id = ? AND user_id = ?`)
    .run(read ? 1 : 0, id, auth.userId);

  res.json({ ok: true });
});

// ─── POST /api/notifications/read-all ────────────────────────────────────────
notificationRouter.post("/notifications/read-all", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const type = req.body?.type as string | undefined;
  if (type) {
    sqlite
      .prepare(`UPDATE in_app_notifications SET read = 1 WHERE user_id = ? AND type = ?`)
      .run(auth.userId, type);
  } else {
    sqlite
      .prepare(`UPDATE in_app_notifications SET read = 1 WHERE user_id = ?`)
      .run(auth.userId);
  }

  res.json({ ok: true });
});

// ─── GET /api/notification-preferences ───────────────────────────────────────
notificationRouter.get("/notification-preferences", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const rows = sqlite
    .prepare(`SELECT event_type, in_app, email, sms FROM notification_preferences WHERE user_id = ?`)
    .all(auth.userId) as { event_type: string; in_app: number; email: number; sms: number }[];

  const prefsMap: Record<string, { in_app: boolean; email: boolean; sms: boolean }> = {};
  for (const r of rows) {
    prefsMap[r.event_type] = { in_app: r.in_app === 1, email: r.email === 1, sms: r.sms === 1 };
  }

  // Fill in defaults for event types not yet in DB
  const result = EVENT_TYPES.map(et => ({
    event_type: et.key,
    label: et.label,
    in_app: prefsMap[et.key]?.in_app ?? true,
    email:  prefsMap[et.key]?.email  ?? et.default_email,
    sms:    prefsMap[et.key]?.sms    ?? false,
  }));

  res.json({ preferences: result });
});

// ─── PATCH /api/notification-preferences ─────────────────────────────────────
notificationRouter.patch("/notification-preferences", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const updates = req.body as { event_type: string; in_app?: boolean; email?: boolean; sms?: boolean }[];
  if (!Array.isArray(updates)) return res.status(400).json({ error: "Expected array of updates" });

  const upsert = sqlite.prepare(`
    INSERT INTO notification_preferences (user_id, event_type, in_app, email, sms, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, event_type) DO UPDATE SET
      in_app = excluded.in_app,
      email  = excluded.email,
      sms    = excluded.sms,
      updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  const txn = sqlite.transaction(() => {
    for (const u of updates) {
      const existing = sqlite
        .prepare(`SELECT in_app, email, sms FROM notification_preferences WHERE user_id = ? AND event_type = ?`)
        .get(auth.userId, u.event_type) as any;
      const inApp = u.in_app  ?? existing?.in_app ?? 1;
      const email  = u.email  ?? existing?.email  ?? 0;
      const sms    = u.sms    ?? existing?.sms    ?? 0;
      upsert.run(auth.userId, u.event_type, inApp ? 1 : 0, email ? 1 : 0, sms ? 1 : 0, now);
    }
  });
  txn();

  res.json({ ok: true });
});

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
notificationRouter.get("/notifications/unread-count", (req, res) => {
  const auth = authUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthenticated" });

  const count = (sqlite
    .prepare(`SELECT COUNT(*) as c FROM in_app_notifications WHERE user_id = ? AND read = 0`)
    .get(auth.userId) as any).c ?? 0;

  res.json({ count });
});
