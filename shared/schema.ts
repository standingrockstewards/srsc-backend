import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── USERS ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // hashed
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("field_tech"), // admin | field_tech | client
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── PROPERTIES ──────────────────────────────────────────────────────────────
export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nickname: text("nickname").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  ownerPhone: text("owner_phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull().default("OK"),
  zip: text("zip").notNull(),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  serviceTier: text("service_tier").notNull(), // anchor_watch | shipshape | launch_crew
  // Feature flags — stored as integers (0/1)
  interiorAccess: integer("interior_access", { mode: "boolean" }).notNull().default(false),
  hasDock: integer("has_dock", { mode: "boolean" }).notNull().default(false),
  hasBoat: integer("has_boat", { mode: "boolean" }).notNull().default(false),
  boatDetails: text("boat_details"), // JSON: {type, make, name}
  hasBoatLift: integer("has_boat_lift", { mode: "boolean" }).notNull().default(false),
  hasGenerator: integer("has_generator", { mode: "boolean" }).notNull().default(false),
  hasIrrigation: integer("has_irrigation", { mode: "boolean" }).notNull().default(false),
  hasPropane: integer("has_propane", { mode: "boolean" }).notNull().default(false),
  hasAlarm: integer("has_alarm", { mode: "boolean" }).notNull().default(false),
  alarmPanelLocation: text("alarm_panel_location"), // sensitive
  alarmCode: text("alarm_code"), // sensitive — treat as masked
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  accessNotes: text("access_notes"), // sensitive — masked in UI
  propertyNotes: text("property_notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  dateAdded: text("date_added").notNull(),
  assignedTechId: integer("assigned_tech_id"),
  clientUserId: integer("client_user_id"), // links to users.id with role=client
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// ─── VISITS ──────────────────────────────────────────────────────────────────
export const visits = sqliteTable("visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  techId: integer("tech_id").notNull(),
  visitType: text("visit_type").notNull(), // routine | storm_event | requested_check | pre_season_open | post_season_close
  visitDate: text("visit_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  durationMinutes: integer("duration_minutes"),
  weatherTemp: text("weather_temp"),
  weatherConditions: text("weather_conditions"), // Clear | Cloudy | Rain | Storm | Snow | Ice
  overallStatus: text("overall_status"), // all_clear | items_flagged | action_required
  generalNotes: text("general_notes"),
  actionsTaken: text("actions_taken"),
  // Storm-event specific
  stormSubtype: text("storm_subtype"), // pre_storm | post_storm
  stormDamageNarrative: text("storm_damage_narrative"),
  areasAffected: text("areas_affected"),
  damageSeverity: text("damage_severity"), // Minor | Moderate | Severe
  vendorDispatched: integer("vendor_dispatched", { mode: "boolean" }),
  emergencyContactNotified: integer("emergency_contact_notified", { mode: "boolean" }),
  // Requested check specific
  requestReason: text("request_reason"),
  requestAreas: text("request_areas"),
  // Billing
  hoursWorked: real("hours_worked"),
  hourlyRate: real("hourly_rate").default(85),
  materialsAmount: real("materials_amount").default(0),
  mileage: real("mileage").default(0),
  status: text("status").notNull().default("in_progress"), // in_progress | submitted | approved
  checklistData: text("checklist_data"), // JSON blob — all item results
  nextScheduledVisit: text("next_scheduled_visit"),
  techSignature: text("tech_signature"),
  techSignatureDate: text("tech_signature_date"),
});

export const insertVisitSchema = createInsertSchema(visits).omit({ id: true });
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visits.$inferSelect;

// ─── VISIT PHOTOS ─────────────────────────────────────────────────────────────
export const visitPhotos = sqliteTable("visit_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: integer("visit_id").notNull(),
  checklistItemKey: text("checklist_item_key"), // e.g. "exterior.roof_damage"
  filename: text("filename").notNull(),
  dataUrl: text("data_url").notNull(), // base64 compressed image
  caption: text("caption"),
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertVisitPhotoSchema = createInsertSchema(visitPhotos).omit({ id: true });
export type InsertVisitPhoto = z.infer<typeof insertVisitPhotoSchema>;
export type VisitPhoto = typeof visitPhotos.$inferSelect;

// ─── VENDOR DISPATCHES ───────────────────────────────────────────────────────
export const vendorDispatches = sqliteTable("vendor_dispatches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: integer("visit_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  reason: text("reason").notNull(),
  dateDispatched: text("date_dispatched").notNull(),
  approvalObtained: integer("approval_obtained", { mode: "boolean" }).notNull().default(false),
  estimatedCost: real("estimated_cost"),
});

export const insertVendorDispatchSchema = createInsertSchema(vendorDispatches).omit({ id: true });
export type InsertVendorDispatch = z.infer<typeof insertVendorDispatchSchema>;
export type VendorDispatch = typeof vendorDispatches.$inferSelect;

// ─── RECOMMENDATIONS ─────────────────────────────────────────────────────────
export const recommendations = sqliteTable("recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: integer("visit_id").notNull(),
  propertyId: integer("property_id").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("Medium"), // Low | Medium | High | Urgent
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true });
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendations.$inferSelect;

// ─── SCHEDULED VISITS ────────────────────────────────────────────────────────
export const scheduledVisits = sqliteTable("scheduled_visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  techId: integer("tech_id"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  visitType: text("visit_type").notNull().default("routine"),
  notes: text("notes"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  visitId: integer("visit_id"), // linked once completed
});

export const insertScheduledVisitSchema = createInsertSchema(scheduledVisits).omit({ id: true });
export type InsertScheduledVisit = z.infer<typeof insertScheduledVisitSchema>;
export type ScheduledVisit = typeof scheduledVisits.$inferSelect;

// ─── CHECKLIST ITEM RESULT TYPE (in-memory, not stored separately) ────────────
export type ChecklistItemResult = {
  result: "pass" | "flag" | "fail" | "na" | null;
  notes?: string;
  photoKeys?: string[]; // references to visitPhotos
};

export type ChecklistData = {
  [moduleKey: string]: {
    [itemKey: string]: ChecklistItemResult;
  };
};

// ─── OFFLINE DRAFT TYPE (stored in IndexedDB on device) ─────────────────────
export type OfflineDraft = {
  id: string; // uuid
  propertyId: number;
  visitType: string;
  startedAt: string;
  lastSavedAt: string;
  formData: Partial<InsertVisit>;
  checklistData: ChecklistData;
  photos: { key: string; dataUrl: string; caption?: string }[];
  synced: boolean;
};

// ─── SIGNAL FLARE — MONITORING DEVICES ───────────────────────────────────────
export const monitoringDevices = sqliteTable("monitoring_devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  nickname: text("nickname").notNull(),
  deviceType: text("device_type").notNull(), // Camera | Motion Sensor | Door-Window Sensor | Smoke-CO Detector | Minut Sensor | Temperature Sensor | Humidity Sensor | Other
  locationDescription: text("location_description"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  installDate: text("install_date"),
  installedBy: text("installed_by"),
  warrantyExpiration: text("warranty_expiration"),
  batteryLevel: integer("battery_level"), // 0–100, nullable
  status: text("status").notNull().default("Online"), // Online | Offline | Alert | Unknown
  lastPing: text("last_ping"),
  configurationNotes: text("configuration_notes"),
  installPhotoUrl: text("install_photo_url"),
  createdAt: text("created_at").notNull(),
});
export const insertMonitoringDeviceSchema = createInsertSchema(monitoringDevices).omit({ id: true });
export type InsertMonitoringDevice = z.infer<typeof insertMonitoringDeviceSchema>;
export type MonitoringDevice = typeof monitoringDevices.$inferSelect;

// ─── SIGNAL FLARE — ALERT EVENTS ─────────────────────────────────────────────
export const alertEvents = sqliteTable("alert_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  deviceId: integer("device_id"), // nullable
  eventTimestamp: text("event_timestamp").notNull(),
  eventType: text("event_type").notNull(), // Motion | Sound | Temperature | Humidity | Smoke-CO | Device Offline | Unauthorized Entry | Manual Entry | Other
  severity: text("severity").notNull(), // Low | Medium | High | Emergency
  description: text("description").notNull(),
  actionTaken: text("action_taken").notNull().default("Pending"), // Pending | Resolved-No Action | Owner Notified | Vendor Dispatched | Site Visit Initiated | Emergency Escalated
  actionNotes: text("action_notes"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  resolvedBy: text("resolved_by"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull(),
});
export const insertAlertEventSchema = createInsertSchema(alertEvents).omit({ id: true });
export type InsertAlertEvent = z.infer<typeof insertAlertEventSchema>;
export type AlertEvent = typeof alertEvents.$inferSelect;

// ─── SIGNAL FLARE — ALERT NOTIFICATIONS ──────────────────────────────────────
export const alertNotifications = sqliteTable("alert_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  alertEventId: integer("alert_event_id"), // nullable
  notificationType: text("notification_type").notNull(), // Alert Notification | Daily Digest | Monthly Report | Vendor Dispatch Notice | Emergency Notification
  method: text("method").notNull(), // SMS | Email | Phone Call | In-App
  recipientName: text("recipient_name").notNull(),
  recipientContact: text("recipient_contact").notNull(),
  contentSummary: text("content_summary"),
  sentAt: text("sent_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertAlertNotificationSchema = createInsertSchema(alertNotifications).omit({ id: true });
export type InsertAlertNotification = z.infer<typeof insertAlertNotificationSchema>;
export type AlertNotification = typeof alertNotifications.$inferSelect;

// ─── SIGNAL FLARE — MONTHLY MONITORING REPORTS ───────────────────────────────
export const monthlyMonitoringReports = sqliteTable("monthly_monitoring_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  reportingPeriodStart: text("reporting_period_start").notNull(),
  reportingPeriodEnd: text("reporting_period_end").notNull(),
  totalEvents: integer("total_events").notNull().default(0),
  eventsByType: text("events_by_type"), // JSON
  deviceUptimeSummary: text("device_uptime_summary"), // JSON
  alertsResolved: integer("alerts_resolved").notNull().default(0),
  siteVisitsTriggered: integer("site_visits_triggered").notNull().default(0),
  recommendations: text("recommendations"),
  billingHours: real("billing_hours").default(0),
  billingRate: real("billing_rate").default(99),
  billingTotal: real("billing_total").default(0),
  generatedBy: text("generated_by"),
  generatedAt: text("generated_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertMonthlyMonitoringReportSchema = createInsertSchema(monthlyMonitoringReports).omit({ id: true });
export type InsertMonthlyMonitoringReport = z.infer<typeof insertMonthlyMonitoringReportSchema>;
export type MonthlyMonitoringReport = typeof monthlyMonitoringReports.$inferSelect;

// ─── SIGNAL FLARE AUTOMATION — SCHEMA ADDITIONS ───────────────────────────

// Add to properties table (note: SQLite ALTER TABLE handled in storage.ts migration)
// New fields: accountManagerId (integer FK → users.id), notificationPreferences (text/JSON)

// ─── ESCALATION LOG ───────────────────────────────────────────────────────
export const escalationLog = sqliteTable("escalation_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertEventId: integer("alert_event_id").notNull(),
  propertyId: integer("property_id").notNull(),
  accountManagerId: integer("account_manager_id"),
  escalationLevel: text("escalation_level").notNull().default("Initial"), // Initial | First Escalation | Second Escalation
  triggeredAt: text("triggered_at").notNull(),
  notificationSent: integer("notification_sent", { mode: "boolean" }).notNull().default(false),
  notificationSentAt: text("notification_sent_at"),
  resolvedBeforeEscalation: integer("resolved_before_escalation", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
export const insertEscalationLogSchema = createInsertSchema(escalationLog).omit({ id: true });
export type InsertEscalationLog = z.infer<typeof insertEscalationLogSchema>;
export type EscalationLog = typeof escalationLog.$inferSelect;

// ─── DAILY DIGESTS ────────────────────────────────────────────────────────
export const dailyDigests = sqliteTable("daily_digests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  digestDate: text("digest_date").notNull(), // YYYY-MM-DD
  totalEvents: integer("total_events").notNull().default(0),
  eventsSummary: text("events_summary"), // JSON: { "Motion": 3, "Temperature": 1 }
  devicesOnline: integer("devices_online").notNull().default(0),
  devicesOffline: integer("devices_offline").notNull().default(0),
  activeAlerts: integer("active_alerts").notNull().default(0),
  resolvedAlerts: integer("resolved_alerts").notNull().default(0),
  systemStatus: text("system_status").notNull().default("All Clear"), // All Clear | Items Flagged | Alert Active
  createdAt: text("created_at").notNull(),
});
export const insertDailyDigestSchema = createInsertSchema(dailyDigests).omit({ id: true });
export type InsertDailyDigest = z.infer<typeof insertDailyDigestSchema>;
export type DailyDigest = typeof dailyDigests.$inferSelect;

// ─── LEADS (public contact form submissions) ─────────────────────────────────
export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  propertyAddress: text("property_address").notNull(),
  serviceTierInterest: text("service_tier_interest").notNull(),
  message: text("message"),
  status: text("status").notNull().default("new"), // new | contacted | qualified | closed
  createdAt: text("created_at").notNull(),
});
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
