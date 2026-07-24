import type { Express } from "express";
import type { Server } from "http";
import { storage, sqlite } from "./storage";
import { sendAARForReport, buildAARPreviewHtml } from "./aar-job";
import { geocodeAddress } from "./weather-engine";
import {
  requirePermission, getEffectivePermissions, PERMISSION_META, ROLE_DEFAULTS,
  initPermissionsTable, PERMISSIONS, type PermissionKey,
} from "./permissions";
import billingRouter from "./billing-routes";
import quoteRouter from "./quote-routes";
import retainerRouter from "./retainer-routes";
import opsMapRouter from "./ops-map-routes";
import { onboardingRouter } from "./onboarding-routes";
import { navFlagsRouter } from "./nav-flags-routes";
import { dashboardRouter } from "./dashboard-routes";
import { notificationRouter } from "./notification-routes";
import { searchRouter } from "./search-routes";
import { auditRouter } from "./audit-routes";

export function registerRoutes(httpServer: Server, app: Express) {
  // Initialize permissions table
  initPermissionsTable();

  // ─── BILLING (raw body needed for Stripe webhook only) ──────────────────────
  app.use("/api/stripe/webhook", require("express").raw({ type: "application/json" }));
  app.use("/api", billingRouter);
  // ─── QUOTE MANAGEMENT ───────────────────────────────────────────────────────
  app.use("/api", quoteRouter);
  // ─── RETAINER + TASK PRICING + EXPOSURE GUARD ────────────────────────────
  app.use("/api", retainerRouter);
  // ─── CONFIDENTIAL OPERATIONS MAP ─────────────────────────────────────────────
  app.use("/api", opsMapRouter);
  // ─── ONBOARDING, ToS, DOCUMENT VAULT, LIFECYCLE, REFERRALS ─────────────────
  app.use("/api", onboardingRouter);
  // ─── SIDEBAR NAV FLAGS ───────────────────────────────────────────────────────
  app.use("/api", navFlagsRouter);
  // ─── BUSINESS OPS LAYER ──────────────────────────────────────────────────────
  app.use("/api", dashboardRouter);
  app.use("/api", notificationRouter);
  app.use("/api", searchRouter);
  app.use("/api", auditRouter);
  // ─── HEALTH ─────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "srsc-backend", ts: new Date().toISOString() });
  });

  // ─── AUTH ───────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing credentials" });
    const user = storage.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    const { password: _pw, ...safeUser } = user;
    // Include effective permissions in login response so frontend can gate immediately
    const effectivePerms = getEffectivePermissions(user.id, user.role);
    res.json({ user: safeUser, permissions: effectivePerms });
  });

  app.get("/api/auth/me/:id", (req, res) => {
    const user = storage.getUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  });

  // ─── ME/PERMISSIONS ─────────────────────────────────────────────────────────
  // Any authenticated user can call this to get their current effective permissions
  app.get("/api/me/permissions", (req, res) => {
    const userId = Number(req.headers["x-user-id"]);
    const role   = req.headers["x-user-role"] as string;
    if (!userId || !role) return res.status(401).json({ error: "Unauthenticated" });
    const user = storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const effectivePerms = getEffectivePermissions(userId, user.role);
    res.json({ permissions: effectivePerms, role: user.role });
  });

  // ─── USERS ──────────────────────────────────────────────────────────────────
  // GET /api/users — requires manage_users
  app.get("/api/users", requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const allUsers = storage.getAllUsers().map(({ password: _pw, ...u }) => u);
    res.json(allUsers);
  });

  app.get("/api/users/techs", (req, res) => {
    // open to admin/supervisor for assignment dropdowns — gated by view_all_properties in practice
    const techs = storage.getAllUsers()
      .filter(u => u.role === "field_tech" && u.active)
      .map(({ password: _pw, ...u }) => u);
    res.json(techs);
  });

  // POST /api/users — create user (manage_users)
  app.post("/api/users", requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    try {
      const user = storage.createUser(req.body);
      const { password: _pw, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // PATCH /api/users/:id — update role/status (manage_users)
  app.patch("/api/users/:id", requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const user = storage.updateUser(Number(req.params.id), req.body);
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  });

  // GET /api/users/:id/permissions — get user's effective perms + overrides (edit_permissions)
  app.get("/api/users/:id/permissions", requirePermission(PERMISSIONS.EDIT_PERMISSIONS), (req, res) => {
    try {
      const user = storage.getUserById(Number(req.params.id));
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _pw, ...safeUser } = user;
      const roleDefaults = ROLE_DEFAULTS[user.role] ?? {};
      const overrides = sqlite
        .prepare("SELECT permission_key, granted FROM user_permissions WHERE user_id = ?")
        .all(user.id) as { permission_key: string; granted: number }[];
      const overrideMap: Record<string, boolean> = {};
      for (const row of overrides) overrideMap[row.permission_key] = row.granted === 1;
      const effective = getEffectivePermissions(user.id, user.role);
      res.json({ user: safeUser, roleDefaults, overrides: overrideMap, effective, meta: PERMISSION_META });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/users/:id/permissions — set/clear overrides (edit_permissions)
  app.patch("/api/users/:id/permissions", requirePermission(PERMISSIONS.EDIT_PERMISSIONS), (req, res) => {
    try {
      const userId = Number(req.params.id);
      const user = storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      // req.body = { overrides: { perm_key: true|false|null } }
      // null = remove override (reset to role default)
      const { overrides } = req.body as { overrides: Record<string, boolean | null> };
      const now = new Date().toISOString();
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null) {
          sqlite.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?").run(userId, key);
        } else {
          sqlite.prepare(`
            INSERT INTO user_permissions (user_id, permission_key, granted, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, permission_key) DO UPDATE SET granted = excluded.granted, updated_at = excluded.updated_at
          `).run(userId, key, value ? 1 : 0, now, now);
        }
      }
      const effective = getEffectivePermissions(userId, user.role);
      res.json({ ok: true, effective });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── PROPERTIES ─────────────────────────────────────────────────────────────
  app.get("/api/properties", (req, res) => {
    const { techId, clientUserId } = req.query;
    if (techId) return res.json(storage.getPropertiesByTech(Number(techId)));
    if (clientUserId) {
      const prop = storage.getPropertyByClientUser(Number(clientUserId));
      return res.json(prop ? [prop] : []);
    }
    res.json(storage.getAllProperties());
  });

  // GET /api/properties/mine — MUST be before /:id to avoid Express catching "mine" as an id
  app.get("/api/properties/mine", (req, res) => {
    try {
      const { clientUserId } = req.query as Record<string, string>;
      if (!clientUserId) return res.json([]);
      const props = storage.getPropertiesForClient(Number(clientUserId));
      res.json(props);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/properties/:id", (req, res) => {
    const prop = storage.getPropertyById(Number(req.params.id));
    if (!prop) return res.status(404).json({ error: "Not found" });
    res.json(prop);
  });

  app.post("/api/properties", (req, res) => {
    try {
      const prop = storage.createProperty(req.body);
      res.status(201).json(prop);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/properties/:id", (req, res) => {
    const prop = storage.updateProperty(Number(req.params.id), req.body);
    if (!prop) return res.status(404).json({ error: "Not found" });
    res.json(prop);
  });

  // ─── VISITS ─────────────────────────────────────────────────────────────────
  app.get("/api/visits", (req, res) => {
    const { propertyId, techId, recent } = req.query;
    if (propertyId) return res.json(storage.getVisitsByProperty(Number(propertyId)));
    if (techId) return res.json(storage.getVisitsByTech(Number(techId)));
    if (recent) return res.json(storage.getRecentVisits(Number(recent)));
    res.json(storage.getAllVisits());
  });

  app.get("/api/visits/:id", (req, res) => {
    const visit = storage.getVisitById(Number(req.params.id));
    if (!visit) return res.status(404).json({ error: "Not found" });
    res.json(visit);
  });

  app.post("/api/visits", (req, res) => {
    try {
      const visit = storage.createVisit(req.body);
      res.status(201).json(visit);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/visits/:id", (req, res) => {
    const visit = storage.updateVisit(Number(req.params.id), req.body);
    if (!visit) return res.status(404).json({ error: "Not found" });
    res.json(visit);
  });

  // ─── PHOTOS ─────────────────────────────────────────────────────────────────
  app.get("/api/visits/:visitId/photos", (req, res) => {
    res.json(storage.getPhotosByVisit(Number(req.params.visitId)));
  });

  app.post("/api/visits/:visitId/photos", (req, res) => {
    try {
      const photo = storage.createPhoto({
        ...req.body,
        visitId: Number(req.params.visitId),
        uploadedAt: new Date().toISOString(),
      });
      res.status(201).json(photo);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/photos/:id", (req, res) => {
    storage.deletePhoto(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── VENDOR DISPATCHES ──────────────────────────────────────────────────────
  app.get("/api/visits/:visitId/vendors", (req, res) => {
    res.json(storage.getVendorsByVisit(Number(req.params.visitId)));
  });

  app.post("/api/visits/:visitId/vendors", (req, res) => {
    const vendor = storage.createVendorDispatch({
      ...req.body,
      visitId: Number(req.params.visitId),
    });
    res.status(201).json(vendor);
  });

  // ─── RECOMMENDATIONS ────────────────────────────────────────────────────────
  app.get("/api/recommendations", (req, res) => {
    const { propertyId } = req.query;
    if (propertyId) return res.json(storage.getRecommendationsByProperty(Number(propertyId)));
    res.json(storage.getOpenRecommendations());
  });

  app.post("/api/recommendations", (req, res) => {
    const rec = storage.createRecommendation({
      ...req.body,
      createdAt: new Date().toISOString().split('T')[0],
    });
    res.status(201).json(rec);
  });

  app.patch("/api/recommendations/:id/resolve", (req, res) => {
    storage.resolveRecommendation(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── SCHEDULED VISITS ───────────────────────────────────────────────────────
  app.get("/api/scheduled", (req, res) => {
    const { techId, upcoming } = req.query;
    if (techId) return res.json(storage.getScheduledByTech(Number(techId)));
    if (upcoming) return res.json(storage.getUpcomingScheduledVisits());
    res.json(storage.getAllScheduledVisits());
  });

  app.post("/api/scheduled", (req, res) => {
    const sv = storage.createScheduledVisit(req.body);
    res.status(201).json(sv);
  });

  app.patch("/api/scheduled/:id/complete", (req, res) => {
    storage.completeScheduledVisit(Number(req.params.id), req.body.visitId);
    res.json({ ok: true });
  });

  // ─── DASHBOARD STATS ────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", (req, res) => {
    const allProps = storage.getAllProperties();
    const allVisits = storage.getAllVisits();
    const openRecs = storage.getOpenRecommendations();
    const upcoming = storage.getUpcomingScheduledVisits();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const thisMonthVisits = allVisits.filter(v => v.visitDate >= monthStart && v.status === "submitted");
    const recentActivity = storage.getRecentVisits(10);

    res.json({
      totalActive: allProps.filter(p => p.active).length,
      propertiesWithActions: allProps.filter(p => {
        const recs = openRecs.filter(r => r.propertyId === p.id);
        return recs.length > 0;
      }).length,
      visitsThisMonth: thisMonthVisits.length,
      upcomingCount: upcoming.length,
      openRecommendations: openRecs.length,
      recentActivity: recentActivity.slice(0, 10),
      upcoming: upcoming.slice(0, 5),
    });
  });

  // ─── SIGNAL FLARE — DEVICES ─────────────────────────────────────────────────
  app.get("/api/properties/:propertyId/devices", (req, res) => {
    res.json(storage.getDevicesByProperty(Number(req.params.propertyId)));
  });

  app.post("/api/properties/:propertyId/devices", (req, res) => {
    try {
      const device = storage.createDevice({
        ...req.body,
        propertyId: Number(req.params.propertyId),
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(device);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/devices/:id", (req, res) => {
    const device = storage.updateDevice(Number(req.params.id), req.body);
    if (!device) return res.status(404).json({ error: "Not found" });
    res.json(device);
  });

  app.delete("/api/devices/:id", (req, res) => {
    storage.deleteDevice(Number(req.params.id));
    res.json({ ok: true });
  });

  // ─── SIGNAL FLARE — ALERTS ───────────────────────────────────────────────────
  app.get("/api/properties/:propertyId/alerts", (req, res) => {
    const { unresolved } = req.query;
    if (unresolved) return res.json(storage.getUnresolvedAlertsByProperty(Number(req.params.propertyId)));
    res.json(storage.getAlertsByProperty(Number(req.params.propertyId)));
  });

  app.get("/api/alerts/active", (req, res) => {
    res.json(storage.getActiveAlerts());
  });

  app.post("/api/properties/:propertyId/alerts", (req, res) => {
    try {
      const alert = storage.createAlertEvent({
        ...req.body,
        propertyId: Number(req.params.propertyId),
        eventTimestamp: req.body.eventTimestamp || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        actionTaken: "Pending",
        resolved: false,
      });
      res.status(201).json(alert);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/alerts/:id/resolve", (req, res) => {
    const { resolvedBy, actionTaken, actionNotes } = req.body;
    const alert = storage.resolveAlert(Number(req.params.id), resolvedBy, actionTaken, actionNotes);
    if (!alert) return res.status(404).json({ error: "Not found" });
    res.json(alert);
  });

  // ─── SIGNAL FLARE — NOTIFICATIONS ───────────────────────────────────────────
  app.get("/api/properties/:propertyId/notifications", (req, res) => {
    res.json(storage.getNotificationsByProperty(Number(req.params.propertyId)));
  });

  app.post("/api/properties/:propertyId/notifications", (req, res) => {
    const notif = storage.createNotification({
      ...req.body,
      propertyId: Number(req.params.propertyId),
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(notif);
  });

  // ─── SIGNAL FLARE — MONTHLY REPORTS ─────────────────────────────────────────
  app.get("/api/properties/:propertyId/monitoring-reports", (req, res) => {
    res.json(storage.getReportsByProperty(Number(req.params.propertyId)));
  });

  app.post("/api/properties/:propertyId/monitoring-reports", (req, res) => {
    const report = storage.createMonthlyReport({
      ...req.body,
      propertyId: Number(req.params.propertyId),
      generatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(report);
  });

  // ─── SIGNAL FLARE — DASHBOARD STATS ─────────────────────────────────────────
  app.get("/api/signal-flare/stats", (req, res) => {
    res.json(storage.getSignalFlareStats());
  });

  // ─── ESCALATION LOG ─────────────────────────────────────────────────────────
  app.get("/api/escalation-log", (req, res) => {
    const { propertyId } = req.query;
    const logs = storage.getEscalationLogs(propertyId ? { propertyId: Number(propertyId) } : undefined);
    res.json(logs);
  });

  app.post("/api/escalation-log", (req, res) => {
    try {
      const log = storage.createEscalationLog({
        ...req.body,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(log);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── DAILY DIGESTS ──────────────────────────────────────────────────────────
  app.get("/api/properties/:propertyId/daily-digests", (req, res) => {
    const { limit } = req.query;
    const digests = storage.getDailyDigests(Number(req.params.propertyId), limit ? Number(limit) : 30);
    res.json(digests);
  });

  app.post("/api/properties/:propertyId/daily-digests", (req, res) => {
    try {
      const digest = storage.upsertDailyDigest({
        ...req.body,
        propertyId: Number(req.params.propertyId),
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(digest);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── NOTIFICATION PREFERENCES ──────────────────────────────────────────────
  app.patch("/api/properties/:id/notification-preferences", (req, res) => {
    const updated = storage.updatePropertyNotificationPrefs(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // ─── USERS (account managers) ──────────────────────────────────────────────
  app.get("/api/users/managers", (req, res) => {
    const managers = storage.getAllUsers()
      .filter(u => (u.role === "admin" || u.role === "field_tech") && u.active)
      .map(({ password: _pw, ...u }) => u);
    res.json(managers);
  });

  // ─── LEADS (public contact form) ──────────────────────────────────────────
  app.post("/api/leads", (req, res) => {
    try {
      const { name, email, phone, propertyAddress, serviceTierInterest, message } = req.body;
      if (!name || !email || !phone || !propertyAddress || !serviceTierInterest) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const lead = storage.createLead({
        name, email, phone, propertyAddress, serviceTierInterest,
        message: message || null,
        status: "new",
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(lead);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/leads", (req, res) => {
    try {
      const allLeads = storage.getLeads();
      res.json(allLeads);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/leads/:id/status", (req, res) => {
    try {
      const { status } = req.body;
      const lead = storage.updateLeadStatus(Number(req.params.id), status);
      if (!lead) return res.status(404).json({ error: "Not found" });
      res.json(lead);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

// ─── CALENDAR (aggregates scheduled visits + recent visits) ──────────────────
  app.get("/api/calendar", (req, res) => {
    try {
      const scheduled = storage.getAllScheduledVisits();
      const allVisits = storage.getAllVisits();
      const events: any[] = [];

      // Fetch scheduled visits raw (includes extra columns added via ALTER TABLE)
      const scheduledRaw: any[] = sqlite.prepare(
        "SELECT * FROM scheduled_visits ORDER BY scheduled_date"
      ).all();

      // Scheduled visits as calendar events
      for (const sv of scheduledRaw) {
        const isStorm = sv.visit_type === "storm_response";
        const stormData: any = isStorm && sv.storm_event_id
          ? sqlite.prepare(
              `SELECT se.*, wa.event_type, wa.severity, wa.headline, wa.effective, wa.expires,
                      u.name as tech_name
               FROM storm_events se
               JOIN weather_alerts wa ON wa.id = se.weather_alert_id
               LEFT JOIN users u ON u.id = se.assigned_tech_id
               WHERE se.id = ?`
            ).get(sv.storm_event_id)
          : null;
        events.push({
          id: `sv-${sv.id}`,
          dbId: sv.id,
          scheduledId: sv.id,
          type: isStorm ? "storm_response" : "visit",
          title: isStorm ? `⚡ Storm Response` : `Property Visit`,
          date: sv.scheduled_date,
          time: sv.scheduled_time ?? "",
          propertyId: sv.property_id,
          status: sv.completed ? "completed" : "scheduled",
          notes: sv.notes ?? "",
          completed: !!sv.completed,
          stormEventId: sv.storm_event_id ?? null,
          weatherAlertId: sv.weather_alert_id ?? null,
          stormData: stormData ?? null,
        });
      }

      // Completed visits from history
      for (const v of allVisits.slice(0, 60)) {
        events.push({
          id: `v-${v.id}`,
          type: "visit",
          title: `${(v.visitType ?? "Visit").replace(/_/g, " ")}`,
          date: v.visitDate,
          time: "",
          propertyId: v.propertyId,
          status: v.overallStatus ?? v.status,
          notes: v.generalNotes ?? "",
        });
      }

      // Custom calendar events (admin-created)
      for (const ce of storage.getCalendarEvents()) {
        events.push({
          id: `ce-${ce.id}`,
          dbId: ce.id,
          type: ce.type,
          title: ce.title,
          date: ce.date,
          time: ce.time ?? "",
          propertyId: ce.property_id,
          workOrderId: ce.work_order_id,
          status: ce.status,
          notes: ce.notes ?? "",
          createdBy: ce.created_by,
          isCustom: true,
        });
      }

      res.json(events);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── VENDOR WORK ORDERS ─────────────────────────────────────────────────────
  app.get("/api/vendor-work-orders", (req, res) => {
    try {
      const { vendorId } = req.query;
      const orders = storage.getVendorWorkOrders(vendorId ? Number(vendorId) : undefined);
      res.json(orders);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/vendor-work-orders", (req, res) => {
    try {
      const order = storage.createVendorWorkOrder({
        ...req.body,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      res.status(201).json(order);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/vendor-work-orders/:id", (req, res) => {
    try {
      const order = storage.updateVendorWorkOrder(Number(req.params.id), req.body);
      if (!order) return res.status(404).json({ error: "Not found" });
      res.json(order);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── VENDOR DOCUMENTS ───────────────────────────────────────────────────────
  app.get("/api/vendor-documents", (req, res) => {
    try {
      const { vendorId } = req.query;
      const docs = storage.getVendorDocuments(vendorId ? Number(vendorId) : undefined);
      res.json(docs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/vendor-documents", (req, res) => {
    try {
      const doc = storage.createVendorDocument({
        ...req.body,
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── VENDOR MESSAGES ────────────────────────────────────────────────────────
  app.get("/api/vendor-messages", (req, res) => {
    try {
      const { vendorId } = req.query;
      const msgs = storage.getVendorMessages(vendorId ? Number(vendorId) : undefined);
      res.json(msgs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/vendor-messages", (req, res) => {
    try {
      const msg = storage.createVendorMessage({
        ...req.body,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        readAt: null,
      });
      res.status(201).json(msg);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/vendor-messages/:id/read", (req, res) => {
    try {
      const msg = storage.markVendorMessageRead(Number(req.params.id));
      if (!msg) return res.status(404).json({ error: "Not found" });
      res.json(msg);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── PHASE 2: DOCUMENT UPLOAD (base64 body, no multipart needed) ─────────
  app.post("/api/vendor-documents/:id/upload", (req, res) => {
    try {
      const { fileData, fileName, fileType, uploadedBy } = req.body;
      if (!fileData) return res.status(400).json({ error: "fileData required" });
      const doc = storage.uploadVendorDocument(
        Number(req.params.id), fileData, fileName ?? "upload", fileType ?? "application/octet-stream", Number(uploadedBy)
      );
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── PHASE 2: DOCUMENT REVIEW (admin approve/reject) ─────────────────────
  app.patch("/api/vendor-documents/:id", (req, res) => {
    try {
      const { status, reviewNotes } = req.body;
      if (!status) return res.status(400).json({ error: "status required" });
      const doc = storage.reviewVendorDocument(Number(req.params.id), status, reviewNotes);
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── PHASE 2: CALENDAR EVENTS CRUD ────────────────────────────────────────
  app.get("/api/calendar-events", (req, res) => {
    try {
      res.json(storage.getCalendarEvents());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/calendar-events", (req, res) => {
    try {
      const event = storage.createCalendarEvent({ ...req.body, createdAt: new Date().toISOString() });
      res.status(201).json(event);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/calendar-events/:id", (req, res) => {
    try {
      const event = storage.updateCalendarEvent(Number(req.params.id), req.body);
      if (!event) return res.status(404).json({ error: "Not found" });
      res.json(event);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/calendar-events/:id", (req, res) => {
    try {
      const event = storage.deleteCalendarEvent(Number(req.params.id));
      if (!event) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── VISIT REPORTS (Photo Visit Reports) ────────────────────────────────────
  // GET /api/scheduled/:id/report — fetch report for a scheduled visit
  app.get("/api/scheduled/:id/report", (req, res) => {
    try {
      const report = storage.getVisitReport(Number(req.params.id));
      if (!report) return res.status(404).json({ error: "No report found" });
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/scheduled/:id/report — submit itemized inspection report
  // Body: { note, overallStatus, techId, propertyId, checklistData, photos: [{ filename, dataUrl, caption, itemKey }] }
  app.post("/api/scheduled/:id/report", (req, res) => {
    try {
      const scheduledVisitId = Number(req.params.id);
      const { note, overallStatus, techId, propertyId, checklistData, photos } = req.body;
      if (!techId || !propertyId) return res.status(400).json({ error: "techId and propertyId required" });
      const report = storage.createVisitReport({
        scheduledVisitId,
        propertyId: Number(propertyId),
        techId: Number(techId),
        note,
        overallStatus: overallStatus ?? "all_clear",
        checklistData: checklistData ?? undefined,
        photos: photos ?? [],
      });
      res.status(201).json(report);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/visit-reports — list all (admin view)
  app.get("/api/visit-reports", (req, res) => {
    try {
      res.json(storage.getAllVisitReports());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/visit-reports/:id — single report with photos
  app.get("/api/visit-reports/:id", (req, res) => {
    try {
      const report = storage.getVisitReportById(Number(req.params.id));
      if (!report) return res.status(404).json({ error: "Not found" });
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── AFTER-ACTION REPORT (AAR) ────────────────────────────────────────────

  // GET /api/aar/preview/:reportId — returns branded HTML (admin only)
  app.get("/api/aar/preview/:reportId", (req, res) => {
    try {
      const html = buildAARPreviewHtml(Number(req.params.reportId));
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/aar/send/:reportId — trigger email send (admin only)
  // Body (optional): { to: "override@email.com" }  — omit to send to property owner
  app.post("/api/aar/send/:reportId", async (req, res) => {
    try {
      const result = await sendAARForReport(Number(req.params.reportId), req.body?.to);
      if (result.ok) {
        res.json({ ok: true, to: result.to });
      } else {
        res.status(500).json({ ok: false, error: result.error });
      }
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── CLIENT PORTAL ─────────────────────────────────────────────────────────────────────

  // (properties/mine moved above /api/properties/:id to avoid Express route shadowing)

  // GET /api/properties/:id/appliances
  app.get("/api/properties/:id/appliances", (req, res) => {
    try {
      const rows = sqlite.prepare("SELECT * FROM property_appliances WHERE property_id = ? ORDER BY name").all(Number(req.params.id));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/properties/:id/appliances
  app.post("/api/properties/:id/appliances", (req, res) => {
    try {
      const { name, make, model, serial, location, notes } = req.body;
      const row = sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING *")
        .get(Number(req.params.id), name, make??null, model??null, serial??null, location??null, notes??null, new Date().toISOString());
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/account/change-password
  app.post("/api/account/change-password", (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      if (!userId || !currentPassword || !newPassword) return res.status(400).json({ error: "Missing fields" });
      if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
      const user = storage.getUserById(Number(userId));
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.password !== currentPassword) return res.status(401).json({ error: "Current password is incorrect" });
      sqlite.prepare("UPDATE users SET password = ?, password_updated_at = ? WHERE id = ?")
        .run(newPassword, new Date().toISOString(), Number(userId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── SERVICE REQUESTS ───────────────────────────────────────────────────
  app.get("/api/service-requests", (req, res) => {
    try {
      const { clientId, propertyId } = req.query as Record<string, string>;
      let sql = `SELECT sr.*, u.name as client_name, p.nickname as property_nickname
                 FROM service_requests sr
                 JOIN users u ON u.id = sr.client_id
                 JOIN properties p ON p.id = sr.property_id
                 WHERE 1=1`;
      const params: any[] = [];
      if (clientId) { sql += " AND sr.client_id = ?"; params.push(Number(clientId)); }
      if (propertyId) { sql += " AND sr.property_id = ?"; params.push(Number(propertyId)); }
      sql += " ORDER BY sr.created_at DESC";
      res.json(sqlite.prepare(sql).all(...params));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/service-requests", async (req, res) => {
    try {
      const { propertyId, clientId, category, description } = req.body;
      if (!propertyId || !clientId || !category || !description) return res.status(400).json({ error: "Missing required fields" });
      const now = new Date().toISOString();
      const row = sqlite.prepare(
        "INSERT INTO service_requests (property_id,client_id,category,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?) RETURNING *"
      ).get(Number(propertyId), Number(clientId), category, description, "new", now, now) as any;

      // Notify admins/supervisors
      const admins = sqlite.prepare("SELECT * FROM users WHERE role IN ('admin','supervisor') AND active = 1").all() as any[];
      const prop = storage.getPropertyById(Number(propertyId));
      const client = storage.getUserById(Number(clientId));
      for (const admin of admins) {
        sqlite.prepare("INSERT INTO in_app_notifications (user_id,title,body,type,link,created_at) VALUES (?,?,?,?,?,?)").run(
          admin.id,
          `New Service Request — ${prop?.nickname ?? "Property #"+propertyId}`,
          `${client?.name ?? "Client"} submitted a ${category} request: "${description.slice(0,80)}…"`,
          "service",
          "/service-requests",
          now
        );
        if (admin.email) {
          try {
            const { sendMail } = require("./mailer");
            await sendMail({
              to: admin.email,
              subject: `New Service Request — ${prop?.nickname ?? "Property"}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#1C1C1C;color:#F5F0EA;padding:32px;border-radius:8px;">
                <div style="color:#C05A43;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Standing Rock Stewardship Co.</div>
                <h2 style="color:#F5F0EA;font-family:Georgia,serif;margin:0 0 16px 0;">New Service Request</h2>
                <p style="color:#ccc;"><strong style="color:#F5F0EA;">${client?.name}</strong> submitted a request for <strong style="color:#C05A43;">${prop?.nickname}</strong>.</p>
                <p style="color:#ccc;"><strong>Category:</strong> ${category}</p>
                <p style="color:#ccc;"><strong>Description:</strong> ${description}</p>
                <a href="https://standingrockstewards.com/#/service-requests" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#C05A43;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">View Request</a>
              </div>`,
            });
          } catch {}
        }
      }
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/service-requests/:id", (req, res) => {
    try {
      const { status, internalNote } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (status) { updates.push("status = ?"); params.push(status); }
      if (internalNote !== undefined) { updates.push("internal_note = ?"); params.push(internalNote); }
      updates.push("updated_at = ?"); params.push(new Date().toISOString());
      params.push(Number(req.params.id));
      sqlite.prepare(`UPDATE service_requests SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      const updated = sqlite.prepare(`SELECT sr.*, u.name as client_name, p.nickname as property_nickname
        FROM service_requests sr JOIN users u ON u.id = sr.client_id
        JOIN properties p ON p.id = sr.property_id WHERE sr.id = ?`).get(Number(req.params.id));
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── PROPERTY MESSAGES ───────────────────────────────────────────────────────
  app.get("/api/property-messages", (req, res) => {
    try {
      const { propertyId } = req.query as Record<string, string>;
      if (!propertyId) return res.status(400).json({ error: "propertyId required" });
      const rows = sqlite.prepare(
        `SELECT pm.*, u.name as sender_name, u.role as sender_role
         FROM property_messages pm
         JOIN users u ON u.id = pm.from_user_id
         WHERE pm.property_id = ?
         ORDER BY pm.sent_at ASC`
      ).all(Number(propertyId));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/property-messages", async (req, res) => {
    try {
      const { propertyId, fromUserId, body } = req.body;
      if (!propertyId || !fromUserId || !body) return res.status(400).json({ error: "Missing fields" });
      const now = new Date().toISOString();
      const row = sqlite.prepare(
        "INSERT INTO property_messages (property_id,from_user_id,body,sent_at) VALUES (?,?,?,?) RETURNING *"
      ).get(Number(propertyId), Number(fromUserId), body, now) as any;

      // Enrich with sender info
      const sender = storage.getUserById(Number(fromUserId));
      const prop = storage.getPropertyById(Number(propertyId));
      const result = { ...row, sender_name: sender?.name, sender_role: sender?.role };

      // Notify the other party
      if (sender?.role === "client") {
        // Notify admins
        const admins = sqlite.prepare("SELECT * FROM users WHERE role IN ('admin','supervisor') AND active = 1").all() as any[];
        for (const admin of admins) {
          sqlite.prepare("INSERT INTO in_app_notifications (user_id,title,body,type,link,created_at) VALUES (?,?,?,?,?,?)").run(
            admin.id,
            `New message from ${sender.name}`,
            `Re: ${prop?.nickname ?? "Property #"+propertyId} — "${body.slice(0,60)}…"`,
            "message", "/service-requests", now
          );
        }
      } else {
        // Notify client
        if (prop?.clientUserId) {
          sqlite.prepare("INSERT INTO in_app_notifications (user_id,title,body,type,link,created_at) VALUES (?,?,?,?,?,?)").run(
            prop.clientUserId,
            `New message from Standing Rock`,
            `Re: ${prop.nickname} — "${body.slice(0,60)}…"`,
            "message", "/portal", now
          );
        }
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/property-messages/:id/read
  app.patch("/api/property-messages/:id/read", (req, res) => {
    try {
      sqlite.prepare("UPDATE property_messages SET read_at = ? WHERE id = ?").run(new Date().toISOString(), Number(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/service-requests/all — admin sees all
  app.get("/api/service-requests/all", (req, res) => {
    try {
      const rows = sqlite.prepare(
        `SELECT sr.*, u.name as client_name, p.nickname as property_nickname
         FROM service_requests sr JOIN users u ON u.id = sr.client_id
         JOIN properties p ON p.id = sr.property_id
         ORDER BY sr.created_at DESC`
      ).all();
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── WEATHER / STORM EVENTS ─────────────────────────────────────────────

  // GET /api/weather/alerts — active NWS alerts stored in DB
  app.get("/api/weather/alerts", (_req, res) => {
    try {
      const now = new Date().toISOString();
      const alerts = sqlite.prepare(
        "SELECT * FROM weather_alerts WHERE expires > ? ORDER BY created_at DESC LIMIT 100"
      ).all(now);
      res.json(alerts);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/storm-events — list all storm events (admin/supervisor)
  app.get("/api/storm-events", (req, res) => {
    try {
      const { status, propertyId } = req.query as Record<string, string>;
      let sql = `
        SELECT se.*,
          p.nickname as property_nickname, p.owner_name, p.owner_email,
          wa.event_type, wa.severity, wa.headline, wa.effective, wa.expires,
          u.name as tech_name
        FROM storm_events se
        JOIN properties p ON p.id = se.property_id
        JOIN weather_alerts wa ON wa.id = se.weather_alert_id
        LEFT JOIN users u ON u.id = se.assigned_tech_id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (status) { sql += " AND se.status = ?"; params.push(status); }
      if (propertyId) { sql += " AND se.property_id = ?"; params.push(Number(propertyId)); }
      sql += " ORDER BY se.triggered_at DESC";
      res.json(sqlite.prepare(sql).all(...params));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/storm-events/:id — update status / assign tech
  app.patch("/api/storm-events/:id", (req, res) => {
    try {
      const { status, assignedTechId, notes } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      if (status) { updates.push("status = ?"); params.push(status); }
      if (assignedTechId !== undefined) {
        updates.push("assigned_tech_id = ?"); params.push(assignedTechId);
        // Also update the linked scheduled visit
        const se: any = sqlite.prepare("SELECT * FROM storm_events WHERE id = ?").get(Number(req.params.id));
        if (se?.scheduled_visit_id) {
          sqlite.prepare("UPDATE scheduled_visits SET tech_id = ? WHERE id = ?").run(assignedTechId, se.scheduled_visit_id);
        }
        if (status === "assigned" || !status) { updates.push("status = ?"); params.push("assigned"); }
      }
      if (notes !== undefined) { updates.push("notes = ?"); params.push(notes); }
      if (status === "closed") { updates.push("closed_at = ?"); params.push(new Date().toISOString()); }
      if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });
      params.push(Number(req.params.id));
      sqlite.prepare(`UPDATE storm_events SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      const updated = sqlite.prepare(
        `SELECT se.*, p.nickname as property_nickname, wa.event_type, wa.severity
         FROM storm_events se
         JOIN properties p ON p.id = se.property_id
         JOIN weather_alerts wa ON wa.id = se.weather_alert_id
         WHERE se.id = ?`
      ).get(Number(req.params.id));
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/properties/:id/geocode — manual re-geocode
  app.post("/api/properties/:id/geocode", async (req, res) => {
    try {
      const prop = storage.getPropertyById(Number(req.params.id));
      if (!prop) return res.status(404).json({ error: "Property not found" });
      const coords = await geocodeAddress(prop.address, prop.city, prop.state, prop.zip);
      if (!coords) return res.status(422).json({ error: "Could not geocode this address" });
      sqlite.prepare("UPDATE properties SET gps_lat = ?, gps_lng = ? WHERE id = ?").run(coords.lat, coords.lng, prop.id);
      res.json({ ok: true, lat: coords.lat, lng: coords.lng });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/notifications — in-app notifications for current user
  app.get("/api/notifications", (req, res) => {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : null;
      if (!userId) return res.json([]);
      const rows = sqlite.prepare(
        "SELECT * FROM in_app_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
      ).all(userId);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/notifications/:id/read
  app.patch("/api/notifications/:id/read", (req, res) => {
    try {
      sqlite.prepare("UPDATE in_app_notifications SET read = 1 WHERE id = ?").run(Number(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/weather/test-trigger — inject a test storm event for a property (dev/admin only)
  app.post("/api/weather/test-trigger", (req, res) => {
    try {
      const { propertyId, eventType } = req.body;
      if (!propertyId) return res.status(400).json({ error: "propertyId required" });
      const prop = storage.getPropertyById(Number(propertyId));
      if (!prop) return res.status(404).json({ error: "Property not found" });

      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

      // Insert a synthetic NWS alert
      const alert = sqlite.prepare(
        "INSERT INTO weather_alerts (nws_id, event_type, severity, headline, effective, expires, geometry, created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING *"
      ).get(
        `TEST-${Date.now()}`,
        eventType ?? "Severe Thunderstorm Warning",
        "Severe",
        `Test ${eventType ?? "Severe Thunderstorm Warning"} for ${prop.nickname}`,
        now, expires, null, now
      ) as any;

      // Insert storm event directly (no PiP needed for test)
      const existing = sqlite.prepare("SELECT id FROM storm_events WHERE property_id = ? AND weather_alert_id = ?").get(prop.id, alert.id);
      if (existing) return res.json({ ok: true, message: "Already exists", stormEventId: (existing as any).id });

      const stormEvent = sqlite.prepare(
        "INSERT INTO storm_events (property_id, weather_alert_id, triggered_at, status, created_at) VALUES (?,?,?,?,?) RETURNING *"
      ).get(prop.id, alert.id, now, "new", now) as any;

      const today = now.split("T")[0];
      const visit = sqlite.prepare(
        "INSERT INTO scheduled_visits (property_id, scheduled_date, visit_type, notes, completed, weather_alert_id, storm_event_id) VALUES (?,?,?,?,?,?,?) RETURNING *"
      ).get(prop.id, today, "storm_response", `Test trigger: ${eventType ?? "Severe Thunderstorm Warning"}`, 0, alert.id, stormEvent.id) as any;

      sqlite.prepare("UPDATE storm_events SET scheduled_visit_id = ? WHERE id = ?").run(visit.id, stormEvent.id);

      res.json({ ok: true, stormEventId: stormEvent.id, visitId: visit.id, alertId: alert.id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── VENDORS (user directory of vendor type) ────────────────────────────────
  app.get("/api/vendors", (req, res) => {
    try {
      const vendors = storage.getAllUsers()
        .filter(u => u.role === "vendor" && u.active)
        .map(({ password: _pw, ...u }) => u);
      res.json(vendors);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── FAQ / KNOWLEDGE BASE ──────────────────────────────────────────────────

  // Categories — any authed user can read
  app.get("/api/faq/categories", (req, res) => {
    try {
      const rows = sqlite.prepare("SELECT * FROM faq_categories ORDER BY sort_order, name").all();
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/faq/categories", requirePermission(PERMISSIONS.MANAGE_FAQ), (req, res) => {
    try {
      const { name, icon = "BookOpen", sort_order = 0 } = req.body;
      if (!name) return res.status(400).json({ error: "name required" });
      const now = new Date().toISOString();
      const row = sqlite.prepare("INSERT INTO faq_categories (name,icon,sort_order,created_at) VALUES (?,?,?,?) RETURNING *")
        .get(name, icon, sort_order, now);
      res.status(201).json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/faq/categories/:id", requirePermission(PERMISSIONS.MANAGE_FAQ), (req, res) => {
    try {
      const { name, icon, sort_order } = req.body;
      const sets: string[] = []; const params: any[] = [];
      if (name !== undefined) { sets.push("name = ?"); params.push(name); }
      if (icon !== undefined) { sets.push("icon = ?"); params.push(icon); }
      if (sort_order !== undefined) { sets.push("sort_order = ?"); params.push(sort_order); }
      if (!sets.length) return res.status(400).json({ error: "nothing to update" });
      params.push(Number(req.params.id));
      sqlite.prepare(`UPDATE faq_categories SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      const row = sqlite.prepare("SELECT * FROM faq_categories WHERE id = ?").get(Number(req.params.id));
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/faq/categories/:id", requirePermission(PERMISSIONS.MANAGE_FAQ), (req, res) => {
    try {
      sqlite.prepare("DELETE FROM faq_categories WHERE id = ?").run(Number(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Articles — list (clients see published only; staff see all)
  app.get("/api/faq/articles", (req, res) => {
    try {
      const role = req.headers["x-user-role"] as string;
      const isStaff = ["admin","supervisor","field_tech"].includes(role);
      const { category_id, asset_type, search, status } = req.query as any;
      let sql = `
        SELECT a.*, c.name AS category_name, c.icon AS category_icon
        FROM faq_articles a LEFT JOIN faq_categories c ON c.id = a.category_id WHERE 1=1
      `;
      const params: any[] = [];
      if (!isStaff) { sql += " AND a.status = 'published'"; }
      else if (status) { sql += " AND a.status = ?"; params.push(status); }
      if (category_id) { sql += " AND a.category_id = ?"; params.push(Number(category_id)); }
      if (asset_type)  { sql += " AND a.related_asset_type = ?"; params.push(asset_type); }
      if (search) {
        const like = `%${search}%`;
        sql += " AND (a.title LIKE ? OR a.body LIKE ? OR a.tags LIKE ?)";
        params.push(like, like, like);
      }
      sql += " ORDER BY a.sort_order, a.title";
      const rows = sqlite.prepare(sql).all(...params) as any[];
      rows.forEach(r => { try { r.tags = JSON.parse(r.tags); } catch { r.tags = []; } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Single article by slug
  app.get("/api/faq/articles/:slug", (req, res) => {
    try {
      const role = req.headers["x-user-role"] as string;
      const isStaff = ["admin","supervisor","field_tech"].includes(role);
      const row = sqlite.prepare(`
        SELECT a.*, c.name AS category_name, c.icon AS category_icon
        FROM faq_articles a LEFT JOIN faq_categories c ON c.id = a.category_id WHERE a.slug = ?
      `).get(req.params.slug) as any;
      if (!row) return res.status(404).json({ error: "Article not found" });
      if (!isStaff && row.status !== "published") return res.status(404).json({ error: "Article not found" });
      try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
      const related = sqlite.prepare(`
        SELECT id, title, slug, tags FROM faq_articles
        WHERE id != ? AND (category_id = ? OR (related_asset_type IS NOT NULL AND related_asset_type = ?)) AND status = 'published' LIMIT 4
      `).all(row.id, row.category_id, row.related_asset_type ?? null) as any[];
      related.forEach(r => { try { r.tags = JSON.parse(r.tags); } catch { r.tags = []; } });
      row.related = related;
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Create article
  app.post("/api/faq/articles", requirePermission(PERMISSIONS.MANAGE_FAQ), (req, res) => {
    try {
      const { category_id, title, slug, body, tags = [], status = "draft",
              related_asset_type, allow_service_request = false,
              service_request_category, author_id, sort_order = 0 } = req.body;
      if (!category_id || !title || !slug || !body) return res.status(400).json({ error: "category_id, title, slug, body required" });
      const now = new Date().toISOString();
      const row = sqlite.prepare(`
        INSERT INTO faq_articles
        (category_id,title,slug,body,tags,status,related_asset_type,allow_service_request,service_request_category,author_id,sort_order,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
      `).get(
        Number(category_id), title, slug, body,
        JSON.stringify(tags), status, related_asset_type ?? null,
        allow_service_request ? 1 : 0, service_request_category ?? null,
        author_id ?? null, sort_order, now, now
      ) as any;
      try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
      res.status(201).json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Update article
  app.patch("/api/faq/articles/:id", requirePermission(PERMISSIONS.MANAGE_FAQ), (req, res) => {
    try {
      const id = Number(req.params.id);
      const fields = ["category_id","title","slug","body","tags","status","related_asset_type","allow_service_request","service_request_category","sort_order"];
      const sets: string[] = []; const params: any[] = [];
      for (const f of fields) {
        if (req.body[f] !== undefined) {
          sets.push(`${f} = ?`);
          if (f === "tags") params.push(JSON.stringify(req.body[f]));
          else if (f === "allow_service_request") params.push(req.body[f] ? 1 : 0);
          else params.push(req.body[f]);
        }
      }
      if (!sets.length) return res.status(400).json({ error: "nothing to update" });
      sets.push("updated_at = ?"); params.push(new Date().toISOString()); params.push(id);
      sqlite.prepare(`UPDATE faq_articles SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      const row = sqlite.prepare("SELECT * FROM faq_articles WHERE id = ?").get(id) as any;
      if (!row) return res.status(404).json({ error: "not found" });
      try { row.tags = JSON.parse(row.tags); } catch { row.tags = []; }
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Delete article
  app.delete("/api/faq/articles/:id", requirePermission(PERMISSIONS.MANAGE_FAQ), (req, res) => {
    try {
      sqlite.prepare("DELETE FROM faq_articles WHERE id = ?").run(Number(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─── SIGNAL FLARES ─────────────────────────────────────────────────────────

  // Helper: enrich a flare row with property name, actor names
  function enrichFlare(f: any) {
    if (!f) return f;
    const prop: any = sqlite.prepare("SELECT id, nickname, address FROM properties WHERE id = ?").get(f.property_id);
    f.property_name = prop?.nickname ?? prop?.address ?? `Property ${f.property_id}`;
    const raiser: any = f.raised_by ? sqlite.prepare("SELECT id, name FROM users WHERE id = ?").get(f.raised_by) : null;
    f.raised_by_name = raiser?.name ?? (f.source === "system-weather" ? "Weather System" : f.source === "system-device" ? "Device Monitor" : "System");
    const ack: any = f.acknowledged_by ? sqlite.prepare("SELECT id, name FROM users WHERE id = ?").get(f.acknowledged_by) : null;
    f.acknowledged_by_name = ack?.name ?? null;
    const res2: any = f.resolved_by ? sqlite.prepare("SELECT id, name FROM users WHERE id = ?").get(f.resolved_by) : null;
    f.resolved_by_name = res2?.name ?? null;
    const assigned: any = f.assigned_to ? sqlite.prepare("SELECT id, name FROM users WHERE id = ?").get(f.assigned_to) : null;
    f.assigned_to_name = assigned?.name ?? null;
    return f;
  }

  // Helper: send Signal Flare notifications to all admins + supervisors
  async function notifyStaffOfFlare(flare: any, isEscalation = false, escalationMinutes = 15) {
    try {
      const { buildSignalFlareHtml } = await import("./mailer");
      const { sendMail } = await import("./mailer");
      const enriched = enrichFlare({ ...flare });
      const staff = sqlite.prepare("SELECT * FROM users WHERE role IN ('admin','supervisor') AND active = 1").all() as any[];
      const title = isEscalation
        ? `⚠️ ESCALATION: Signal Flare unacknowledged — ${enriched.property_name}`
        : `🚨 Signal Flare Raised — ${enriched.property_name} [${flare.severity}]`;
      const body = isEscalation
        ? `${flare.category}: ${flare.description}. Unacknowledged for ${escalationMinutes} min.`
        : `${flare.category}: ${flare.description}`;

      for (const u of staff) {
        // In-app
        sqlite.prepare(
          "INSERT INTO in_app_notifications (user_id,title,body,type,link,created_at) VALUES (?,?,?,?,?,?)"
        ).run(u.id, title, body, isEscalation ? "escalation" : "signal_flare",
          `#/signal-flares/${flare.id}`, new Date().toISOString());

        // Email
        if (u.email) {
          try {
            const html = buildSignalFlareHtml({
              propertyName: enriched.property_name,
              raisedByName: enriched.raised_by_name,
              severity: flare.severity,
              category: flare.category,
              description: flare.description,
              flareId: flare.id,
              isEscalation,
              escalationMinutes,
            });
            await sendMail({ to: u.email, subject: isEscalation ? `⚠️ Escalation — ${enriched.property_name} Signal Flare` : `🚨 Signal Flare — ${enriched.property_name}`, html });
          } catch (mailErr: any) {
            console.warn("Signal Flare email failed:", mailErr.message);
          }
        }
      }
    } catch (err: any) {
      console.warn("notifyStaffOfFlare failed:", err.message);
    }
  }

  // POST /api/signal-flares — raise a new flare
  app.post("/api/signal-flares", (req, res) => {
    try {
      const userId = Number(req.headers["x-user-id"]);
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const { property_id, severity = "High", category = "General Emergency", description, source } = req.body;
      if (!property_id || !description) return res.status(400).json({ error: "property_id and description required" });

      // Scope: clients can only raise on their own property
      if (role === "client") {
        const prop: any = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(Number(property_id));
        if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Not your property" });
      }
      // Vendors cannot raise flares
      if (role === "vendor") return res.status(403).json({ error: "Vendors cannot raise Signal Flares" });

      const now = new Date().toISOString();
      const effectiveSource = source ?? (role === "client" ? "client" : "staff");

      const flare = sqlite.prepare(`
        INSERT INTO signal_flares (property_id, raised_by, source, severity, category, description, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?) RETURNING *
      `).get(Number(property_id), userId, effectiveSource, severity, category, description, "Open", now, now) as any;

      // Timeline event
      const raiser: any = sqlite.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      sqlite.prepare(
        "INSERT INTO signal_flare_events (flare_id, actor_id, event_type, note, created_at) VALUES (?,?,?,?,?)"
      ).run(flare.id, userId, "raised", `Signal Flare raised by ${raiser?.name ?? "user"}: ${description}`, now);

      // Notify staff async (don't block response)
      notifyStaffOfFlare(flare);

      // Schedule escalation check
      const escalationMs = Number(process.env.FLARE_ESCALATION_MINUTES ?? 15) * 60 * 1000;
      setTimeout(async () => {
        try {
          const current: any = sqlite.prepare("SELECT * FROM signal_flares WHERE id = ?").get(flare.id);
          if (current && current.status === "Open" && !current.acknowledged_at) {
            const esNow = new Date().toISOString();
            sqlite.prepare("UPDATE signal_flares SET escalated = 1, escalated_at = ?, updated_at = ? WHERE id = ?")
              .run(esNow, esNow, flare.id);
            sqlite.prepare(
              "INSERT INTO signal_flare_events (flare_id, actor_id, event_type, note, created_at) VALUES (?,?,?,?,?)"
            ).run(flare.id, null, "escalated", `Auto-escalated: not acknowledged within ${Number(process.env.FLARE_ESCALATION_MINUTES ?? 15)} minutes`, esNow);
            notifyStaffOfFlare({ ...current, id: flare.id }, true, Number(process.env.FLARE_ESCALATION_MINUTES ?? 15));
          }
        } catch (err: any) { console.warn("Escalation timer error:", err.message); }
      }, escalationMs);

      res.status(201).json(enrichFlare(flare));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/signal-flares — list (admin/supervisor: all; client: own; field_tech: assigned to them)
  app.get("/api/signal-flares", (req, res) => {
    try {
      const userId = Number(req.headers["x-user-id"]);
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (role === "vendor") return res.status(403).json({ error: "Access denied" });

      let rows: any[];
      if (role === "client") {
        // Only flares on properties this client owns
        rows = sqlite.prepare(`
          SELECT sf.* FROM signal_flares sf
          JOIN properties p ON p.id = sf.property_id
          WHERE p.client_user_id = ?
          ORDER BY CASE sf.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                   sf.created_at DESC
        `).all(userId) as any[];
      } else if (role === "field_tech") {
        rows = sqlite.prepare(`
          SELECT sf.* FROM signal_flares sf
          WHERE sf.assigned_to = ?
          ORDER BY CASE sf.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                   sf.created_at DESC
        `).all(userId) as any[];
      } else {
        // Admin / supervisor: all
        rows = sqlite.prepare(`
          SELECT sf.* FROM signal_flares sf
          ORDER BY CASE sf.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                   sf.created_at DESC
        `).all() as any[];
      }

      res.json(rows.map(enrichFlare));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/signal-flares/count/open — badge count for nav (MUST be before /:id)
  app.get("/api/signal-flares/count/open", (req, res) => {
    try {
      const userId = Number(req.headers["x-user-id"]);
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (role === "vendor") return res.json({ count: 0 });

      let count: any;
      if (role === "client") {
        count = sqlite.prepare(`
          SELECT COUNT(*) as c FROM signal_flares sf
          JOIN properties p ON p.id = sf.property_id
          WHERE p.client_user_id = ? AND sf.status NOT IN ('Resolved','Closed')
        `).get(userId);
      } else if (role === "field_tech") {
        count = sqlite.prepare(
          "SELECT COUNT(*) as c FROM signal_flares WHERE assigned_to = ? AND status NOT IN ('Resolved','Closed')"
        ).get(userId);
      } else {
        count = sqlite.prepare(
          "SELECT COUNT(*) as c FROM signal_flares WHERE status NOT IN ('Resolved','Closed')"
        ).get();
      }
      res.json({ count: (count as any)?.c ?? 0 });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // GET /api/signal-flares/:id — detail + timeline
  app.get("/api/signal-flares/:id", (req, res) => {
    try {
      const userId = Number(req.headers["x-user-id"]);
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (role === "vendor") return res.status(403).json({ error: "Access denied" });

      const flare: any = sqlite.prepare("SELECT * FROM signal_flares WHERE id = ?").get(Number(req.params.id));
      if (!flare) return res.status(404).json({ error: "Not found" });

      // Scope check
      if (role === "client") {
        const prop: any = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(flare.property_id);
        if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Access denied" });
      } else if (role === "field_tech" && flare.assigned_to !== userId) {
        return res.status(403).json({ error: "Not assigned to this flare" });
      }

      // Timeline events
      const events: any[] = sqlite.prepare(
        "SELECT sfe.*, u.name as actor_name FROM signal_flare_events sfe LEFT JOIN users u ON u.id = sfe.actor_id WHERE sfe.flare_id = ? ORDER BY sfe.created_at ASC"
      ).all(flare.id) as any[];

      // Weather context for property
      const weather: any = sqlite.prepare(
        "SELECT * FROM weather_alerts WHERE id IN (SELECT weather_alert_id FROM storm_events WHERE property_id = ? ORDER BY id DESC LIMIT 1)"
      ).get(flare.property_id);

      // Appliances
      const appliances: any[] = sqlite.prepare(
        "SELECT * FROM property_appliances WHERE property_id = ? ORDER BY name"
      ).all(flare.property_id) as any[];

      res.json({ ...enrichFlare(flare), events, weather, appliances });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // PATCH /api/signal-flares/:id — acknowledge / assign / resolve / close / add note
  app.patch("/api/signal-flares/:id", (req, res) => {
    try {
      const userId = Number(req.headers["x-user-id"]);
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (role === "vendor") return res.status(403).json({ error: "Access denied" });

      const flare: any = sqlite.prepare("SELECT * FROM signal_flares WHERE id = ?").get(Number(req.params.id));
      if (!flare) return res.status(404).json({ error: "Not found" });

      const { action, note, assigned_to } = req.body;
      const now = new Date().toISOString();
      const actor: any = sqlite.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      const actorName = actor?.name ?? "Unknown";

      // Clients can only add notes on their own flares
      if (role === "client") {
        const prop: any = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(flare.property_id);
        if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Access denied" });
        if (action !== "note") return res.status(403).json({ error: "Clients can only add notes" });
      }

      // Field tech: only on assigned flare, only note/in-progress actions
      if (role === "field_tech") {
        if (flare.assigned_to !== userId) return res.status(403).json({ error: "Not assigned" });
        if (action !== "note" && action !== "in_progress") return res.status(403).json({ error: "Field tech can add notes and mark in-progress" });
      }

      let sets: string[] = ["updated_at = ?"];
      let params: any[] = [now];
      let eventType = action ?? "note";
      let eventNote = note ?? "";

      if (action === "acknowledge") {
        sets.push("status = ?", "acknowledged_by = ?", "acknowledged_at = ?");
        params.push("Acknowledged", userId, now);
        eventType = "acknowledged";
        eventNote = note ?? `Acknowledged by ${actorName}`;
      } else if (action === "in_progress") {
        sets.push("status = ?");
        params.push("In Progress");
        eventNote = note ?? `Status set to In Progress by ${actorName}`;
      } else if (action === "assign") {
        sets.push("assigned_to = ?", "status = ?");
        const assigneeUser: any = assigned_to ? sqlite.prepare("SELECT name FROM users WHERE id = ?").get(Number(assigned_to)) : null;
        params.push(Number(assigned_to), "In Progress");
        eventType = "assigned";
        eventNote = note ?? `Assigned to ${assigneeUser?.name ?? "tech"} by ${actorName}`;
      } else if (action === "resolve") {
        sets.push("status = ?", "resolved_by = ?", "resolved_at = ?");
        params.push("Resolved", userId, now);
        eventType = "resolved";
        eventNote = note ?? `Resolved by ${actorName}`;
      } else if (action === "close") {
        sets.push("status = ?");
        params.push("Closed");
        eventType = "closed";
        eventNote = note ?? `Closed by ${actorName}`;
      } else if (action === "note") {
        eventType = "note";
        eventNote = note ?? "";
      }

      params.push(flare.id);
      sqlite.prepare(`UPDATE signal_flares SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      sqlite.prepare(
        "INSERT INTO signal_flare_events (flare_id, actor_id, event_type, note, created_at) VALUES (?,?,?,?,?)"
      ).run(flare.id, userId, eventType, eventNote, now);

      const updated: any = sqlite.prepare("SELECT * FROM signal_flares WHERE id = ?").get(flare.id);
      const events: any[] = sqlite.prepare(
        "SELECT sfe.*, u.name as actor_name FROM signal_flare_events sfe LEFT JOIN users u ON u.id = sfe.actor_id WHERE sfe.flare_id = ? ORDER BY sfe.created_at ASC"
      ).all(flare.id) as any[];
      res.json({ ...enrichFlare(updated), events });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/signal-flares/system — system-raised (MUST be before /:id/events)
  app.post("/api/signal-flares/system", (req, res) => {
    try {
      const { property_id, source = "system-weather", severity = "Critical",
              category = "Storm Emergency", description, dedup_key } = req.body;
      if (!property_id || !description) return res.status(400).json({ error: "property_id and description required" });

      // Dedup: if an active system flare same property+source+category exists in last 24h, skip
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const existing: any = sqlite.prepare(
        "SELECT id FROM signal_flares WHERE property_id = ? AND source = ? AND category = ? AND status NOT IN ('Resolved','Closed') AND created_at > ? LIMIT 1"
      ).get(Number(property_id), source, category, since24h);

      if (existing) {
        return res.json({ ok: true, deduplicated: true, flareId: existing.id });
      }

      const now = new Date().toISOString();
      const flare = sqlite.prepare(`
        INSERT INTO signal_flares (property_id, raised_by, source, severity, category, description, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?) RETURNING *
      `).get(Number(property_id), null, source, severity, category, description, "Open", now, now) as any;

      sqlite.prepare(
        "INSERT INTO signal_flare_events (flare_id, actor_id, event_type, note, created_at) VALUES (?,?,?,?,?)"
      ).run(flare.id, null, "raised", `System-raised (${source}): ${description}`, now);

      notifyStaffOfFlare(flare);

      const escalationMs = Number(process.env.FLARE_ESCALATION_MINUTES ?? 15) * 60 * 1000;
      setTimeout(async () => {
        try {
          const current: any = sqlite.prepare("SELECT * FROM signal_flares WHERE id = ?").get(flare.id);
          if (current && current.status === "Open" && !current.acknowledged_at) {
            const esNow = new Date().toISOString();
            sqlite.prepare("UPDATE signal_flares SET escalated = 1, escalated_at = ?, updated_at = ? WHERE id = ?")
              .run(esNow, esNow, flare.id);
            sqlite.prepare(
              "INSERT INTO signal_flare_events (flare_id, actor_id, event_type, note, created_at) VALUES (?,?,?,?,?)"
            ).run(flare.id, null, "escalated", `Auto-escalated: not acknowledged within ${Number(process.env.FLARE_ESCALATION_MINUTES ?? 15)} minutes`, esNow);
            notifyStaffOfFlare({ ...current, id: flare.id }, true, Number(process.env.FLARE_ESCALATION_MINUTES ?? 15));
          }
        } catch {} 
      }, escalationMs);

      res.status(201).json(enrichFlare(flare));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // POST /api/signal-flares/:id/events — add note/timeline entry
  app.post("/api/signal-flares/:id/events", (req, res) => {
    try {
      const userId = Number(req.headers["x-user-id"]);
      const role = (req.headers["x-user-role"] as string) ?? "";
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (role === "vendor") return res.status(403).json({ error: "Access denied" });

      const flare: any = sqlite.prepare("SELECT * FROM signal_flares WHERE id = ?").get(Number(req.params.id));
      if (!flare) return res.status(404).json({ error: "Not found" });

      if (role === "client") {
        const prop: any = sqlite.prepare("SELECT client_user_id FROM properties WHERE id = ?").get(flare.property_id);
        if (!prop || prop.client_user_id !== userId) return res.status(403).json({ error: "Access denied" });
      }

      const { note, event_type = "note" } = req.body;
      if (!note) return res.status(400).json({ error: "note required" });
      const now = new Date().toISOString();
      const event = sqlite.prepare(
        "INSERT INTO signal_flare_events (flare_id, actor_id, event_type, note, created_at) VALUES (?,?,?,?,?) RETURNING *"
      ).get(flare.id, userId, event_type, note, now) as any;

      const actor: any = sqlite.prepare("SELECT name FROM users WHERE id = ?").get(userId);
      res.status(201).json({ ...event, actor_name: actor?.name });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

}