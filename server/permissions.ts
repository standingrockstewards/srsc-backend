/**
 * Central Permission System for SRSC
 *
 * Architecture:
 *   effectivePermission(userId, key) = roleDefault(role, key) OVERRIDDEN BY user_permissions row
 *
 * Every protected route calls requirePermission('key') middleware.
 * Frontend reads /api/me/permissions to gate UI elements.
 */

import { sqlite } from "./storage";

// ─── Permission Catalog ───────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Properties
  VIEW_ALL_PROPERTIES:   "view_all_properties",
  EDIT_PROPERTIES:       "edit_properties",
  CREATE_PROPERTIES:     "create_properties",
  DELETE_PROPERTIES:     "delete_properties",

  // Visits & scheduling
  VIEW_ALL_VISITS:       "view_all_visits",
  VIEW_OWN_VISITS:       "view_own_visits",
  CREATE_VISITS:         "create_visits",
  EDIT_VISITS:           "edit_visits",
  COMPLETE_VISITS:       "complete_visits",
  SCHEDULE_VISITS:       "schedule_visits",
  ASSIGN_TECHS:          "assign_techs",

  // Reports & documents
  VIEW_VISIT_REPORTS:    "view_visit_reports",
  CREATE_VISIT_REPORTS:  "create_visit_reports",
  VIEW_ESCALATION_LOG:   "view_escalation_log",
  CREATE_ESCALATION:     "create_escalation",
  SEND_AAR:              "send_aar",
  APPROVE_DOCUMENTS:     "approve_documents",

  // Vendors
  MANAGE_VENDORS:        "manage_vendors",
  VIEW_VENDORS:          "view_vendors",

  // Service requests
  MANAGE_SERVICE_REQUESTS: "manage_service_requests",
  SUBMIT_SERVICE_REQUESTS: "submit_service_requests",

  // Storm events
  RESPOND_STORM_EVENTS:  "respond_storm_events",
  TRIGGER_STORM_TEST:    "trigger_storm_test",

  // Calendar & scheduling
  MANAGE_CALENDAR:       "manage_calendar",
  VIEW_CALENDAR:         "view_calendar",

  // Messaging
  SEND_PROPERTY_MESSAGES: "send_property_messages",
  VIEW_ALL_MESSAGES:     "view_all_messages",

  // Dashboard & stats
  VIEW_DASHBOARD:        "view_dashboard",
  VIEW_SIGNAL_FLARE:     "view_signal_flare",
  RESPOND_SIGNAL_FLARES: "respond_signal_flares",
  RAISE_SIGNAL_FLARE:    "raise_signal_flare",

  // User management — Admin-only by default
  MANAGE_USERS:          "manage_users",
  EDIT_PERMISSIONS:      "edit_permissions",
  VIEW_BILLING:          "view_billing",
  MANAGE_BILLING:        "manage_billing",
  MANAGE_QUOTES:         "manage_quotes",
  MANAGE_RETAINER:       "manage_retainer",
  VIEW_RETAINER:         "view_retainer",
  VIEW_OPS_MAP:          "view_ops_map",
  SUBMIT_VENDOR_QUOTE:   "submit_vendor_quote",
  VIEW_OWN_QUOTES:       "view_own_quotes",

  // Knowledge Base
  MANAGE_FAQ:            "manage_faq",
  VIEW_FAQ:              "view_faq",

  // Client-specific
  VIEW_OWN_PROPERTY:     "view_own_property",
  VIEW_AUDIT:            "view_audit",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Role Defaults ─────────────────────────────────────────────────────────────
// true = granted by default for this role
export const ROLE_DEFAULTS: Record<string, Record<PermissionKey, boolean>> = {
  admin: {
    view_all_properties: true,
    edit_properties: true,
    create_properties: true,
    delete_properties: true,
    view_all_visits: true,
    view_own_visits: true,
    create_visits: true,
    edit_visits: true,
    complete_visits: true,
    schedule_visits: true,
    assign_techs: true,
    view_visit_reports: true,
    create_visit_reports: true,
    view_escalation_log: true,
    create_escalation: true,
    send_aar: true,
    approve_documents: true,
    manage_vendors: true,
    view_vendors: true,
    manage_service_requests: true,
    submit_service_requests: false,
    respond_storm_events: true,
    trigger_storm_test: true,
    manage_calendar: true,
    view_calendar: true,
    send_property_messages: true,
    view_all_messages: true,
    view_dashboard: true,
    view_signal_flare: true,
    respond_signal_flares: true,
    raise_signal_flare: true,
    manage_users: true,
    edit_permissions: true,
    view_billing: true,
    manage_billing: true,
    manage_quotes: true,
    manage_retainer: true,
    view_retainer: true,
    view_ops_map: true,
    submit_vendor_quote: false,
    view_own_quotes: true,
    manage_faq: true,
    view_faq: true,
    view_own_property: false,
    view_audit: true,    // ← Admin sees audit log by default
  },

  supervisor: {
    view_all_properties: true,
    edit_properties: true,
    create_properties: false,
    delete_properties: false,
    view_all_visits: true,
    view_own_visits: true,
    create_visits: true,
    edit_visits: true,
    complete_visits: true,
    schedule_visits: true,
    assign_techs: true,
    view_visit_reports: true,
    create_visit_reports: true,
    view_escalation_log: true,
    create_escalation: true,
    send_aar: true,
    approve_documents: true,
    manage_vendors: false,
    view_vendors: true,
    manage_service_requests: true,
    submit_service_requests: false,
    respond_storm_events: true,
    trigger_storm_test: false,
    manage_calendar: true,
    view_calendar: true,
    send_property_messages: true,
    view_all_messages: true,
    view_dashboard: true,
    view_signal_flare: true,
    respond_signal_flares: true,
    raise_signal_flare: true,
    manage_users: false,       // ← blocked unless Admin grants
    edit_permissions: false,   // ← blocked unless Admin grants
    view_billing: false,       // ← blocked unless Admin grants
    manage_billing: false,     // ← grantable to supervisor
    manage_quotes: false,     // ← grantable to supervisor
    manage_retainer: false,    // ← grantable
    view_retainer: true,
    view_ops_map: false,     // <- grantable to supervisor
    submit_vendor_quote: false,
    view_own_quotes: true,
    manage_faq: false,
    view_faq: true,
    view_own_property: false,
    view_audit: false,    // ← grantable by Admin
  },

  field_tech: {
    view_all_properties: false,  // guardrailed — only assigned properties
    edit_properties: false,
    create_properties: false,
    delete_properties: false,
    view_all_visits: false,      // guardrailed — only own visits
    view_own_visits: true,
    create_visits: false,
    edit_visits: false,
    complete_visits: true,       // can complete their assigned visits
    schedule_visits: false,
    assign_techs: false,
    view_visit_reports: false,
    create_visit_reports: true,  // can write reports for their visits
    view_escalation_log: false,
    create_escalation: true,     // can flag issues
    send_aar: false,
    approve_documents: false,
    manage_vendors: false,
    view_vendors: false,
    manage_service_requests: false,
    submit_service_requests: false,
    respond_storm_events: false,
    trigger_storm_test: false,
    manage_calendar: false,
    view_calendar: true,         // can see their own calendar
    send_property_messages: false,
    view_all_messages: false,
    view_dashboard: false,
    view_signal_flare: false,
    respond_signal_flares: false,
    raise_signal_flare: true,
    manage_users: false,
    edit_permissions: false,
    view_billing: false,
    manage_billing: false,
    manage_quotes: false,
    manage_retainer: false,
    view_retainer: false,
    view_ops_map: false,     // <- grantable per-tech by admin
    submit_vendor_quote: false,
    view_own_quotes: false,
    manage_faq: false,
    view_faq: true,
    view_own_property: false,
    view_audit: false,    // ← grantable by Admin
  },

  client: {
    view_all_properties: false,
    edit_properties: false,
    create_properties: false,
    delete_properties: false,
    view_all_visits: false,
    view_own_visits: false,
    create_visits: false,
    edit_visits: false,
    complete_visits: false,
    schedule_visits: false,
    assign_techs: false,
    view_visit_reports: false,
    create_visit_reports: false,
    view_escalation_log: false,
    create_escalation: false,
    send_aar: false,
    approve_documents: false,
    manage_vendors: false,
    view_vendors: false,
    manage_service_requests: false,
    submit_service_requests: true,
    respond_storm_events: false,
    trigger_storm_test: false,
    manage_calendar: false,
    view_calendar: false,
    send_property_messages: true,
    view_all_messages: false,
    view_dashboard: false,
    view_signal_flare: false,
    respond_signal_flares: false,
    raise_signal_flare: true,
    manage_users: false,
    edit_permissions: false,
    view_billing: true,
    manage_billing: false,
    manage_quotes: false,
    manage_retainer: false,
    view_retainer: true,     // clients see own retainer balance
    view_ops_map: false,     // NEVER - confidential
    submit_vendor_quote: false,
    view_own_quotes: true,   // clients see their own released quotes
    manage_faq: false,
    view_faq: true,
    view_own_property: true,
    view_audit: false,    // ← grantable by Admin
  },

  vendor: {
    view_all_properties: false,
    edit_properties: false,
    create_properties: false,
    delete_properties: false,
    view_all_visits: false,
    view_own_visits: false,
    create_visits: false,
    edit_visits: false,
    complete_visits: false,
    schedule_visits: false,
    assign_techs: false,
    view_visit_reports: false,
    create_visit_reports: false,
    view_escalation_log: false,
    create_escalation: false,
    send_aar: false,
    approve_documents: false,
    manage_vendors: false,
    view_vendors: false,
    manage_service_requests: false,
    submit_service_requests: false,
    respond_storm_events: false,
    trigger_storm_test: false,
    manage_calendar: false,
    view_calendar: false,
    send_property_messages: false,
    view_all_messages: false,
    view_dashboard: false,
    view_signal_flare: false,
    respond_signal_flares: false,
    raise_signal_flare: false,
    manage_users: false,
    edit_permissions: false,
    view_billing: false,
    manage_billing: false,
    manage_quotes: false,
    manage_retainer: false,
    view_retainer: false,
    view_ops_map: false,     // NEVER - confidential
    submit_vendor_quote: true,  // vendors can submit their own quotes
    view_own_quotes: true,
    manage_faq: false,
    view_faq: false,
    view_own_property: false,
    view_audit: false,    // ← grantable by Admin
  },
};

// ─── Table setup ──────────────────────────────────────────────────────────────
export function initPermissionsTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      permission_key TEXT NOT NULL,
      granted INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, permission_key)
    )
  `);
}

// ─── Core helper: get effective permissions for a user ────────────────────────
export function getEffectivePermissions(userId: number, role: string): Record<PermissionKey, boolean> {
  const roleDefaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.field_tech;

  // Start with a copy of role defaults
  const effective: Record<string, boolean> = { ...roleDefaults };

  // Apply per-user overrides
  try {
    const overrides = sqlite
      .prepare("SELECT permission_key, granted FROM user_permissions WHERE user_id = ?")
      .all(userId) as { permission_key: string; granted: number }[];

    for (const row of overrides) {
      effective[row.permission_key] = row.granted === 1;
    }
  } catch {
    // table may not exist yet during first startup
  }

  return effective as Record<PermissionKey, boolean>;
}

// ─── Check a single permission ────────────────────────────────────────────────
export function hasPermission(userId: number, role: string, permKey: PermissionKey): boolean {
  const perms = getEffectivePermissions(userId, role);
  return perms[permKey] === true;
}

// ─── Express middleware factory ───────────────────────────────────────────────
// Usage: app.get('/api/users', requirePermission('manage_users'), handler)
//
// Reads userId + role from the X-User-Id / X-User-Role headers that the
// frontend sends on every authenticated request.
//
export function requirePermission(permKey: PermissionKey) {
  return (req: any, res: any, next: any) => {
    const userId = Number(req.headers["x-user-id"]);
    const role   = (req.headers["x-user-role"] as string) || "";

    if (!userId || !role) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    if (!hasPermission(userId, role, permKey)) {
      return res.status(403).json({
        error: "Forbidden",
        required: permKey,
        hint: `Your account does not have the '${permKey}' permission. Contact your administrator.`,
      });
    }

    next();
  };
}

// ─── Human-readable permission metadata (for the UI) ──────────────────────────
export const PERMISSION_META: Record<PermissionKey, { label: string; group: string; description: string }> = {
  view_all_properties:    { group: "Properties",      label: "View All Properties",      description: "See every property in the system" },
  edit_properties:        { group: "Properties",      label: "Edit Properties",           description: "Update property details and settings" },
  create_properties:      { group: "Properties",      label: "Create Properties",         description: "Add new properties" },
  delete_properties:      { group: "Properties",      label: "Delete Properties",         description: "Remove properties from the system" },
  view_all_visits:        { group: "Visits",          label: "View All Visits",           description: "See every visit, not just assigned ones" },
  view_own_visits:        { group: "Visits",          label: "View Own Visits",           description: "See visits assigned to this user" },
  create_visits:          { group: "Visits",          label: "Create Visits",             description: "Schedule new property visits" },
  edit_visits:            { group: "Visits",          label: "Edit Visits",               description: "Modify existing visit details" },
  complete_visits:        { group: "Visits",          label: "Complete Visits",           description: "Mark visits as completed and submit reports" },
  schedule_visits:        { group: "Visits",          label: "Schedule Visits",           description: "Assign dates and times to upcoming visits" },
  assign_techs:           { group: "Visits",          label: "Assign Technicians",        description: "Assign field techs to visits and properties" },
  view_visit_reports:     { group: "Reports",         label: "View Visit Reports",        description: "Read completed inspection reports" },
  create_visit_reports:   { group: "Reports",         label: "Create Visit Reports",      description: "Write and submit inspection reports" },
  view_escalation_log:    { group: "Reports",         label: "View Escalation Log",       description: "See the escalation and incident log" },
  create_escalation:      { group: "Reports",         label: "Create Escalations",        description: "File escalation entries" },
  send_aar:               { group: "Reports",         label: "Send After-Action Reports", description: "Email AAR reports to clients" },
  approve_documents:      { group: "Reports",         label: "Approve Documents",         description: "Approve vendor and property documents" },
  manage_vendors:         { group: "Vendors",         label: "Manage Vendors",            description: "Add/edit vendors, assign work orders" },
  view_vendors:           { group: "Vendors",         label: "View Vendors",              description: "See vendor list and status" },
  manage_service_requests:{ group: "Service",         label: "Manage Service Requests",   description: "Review, schedule, and close client service requests" },
  submit_service_requests:{ group: "Service",         label: "Submit Service Requests",   description: "Submit new on-demand service requests (clients)" },
  respond_storm_events:   { group: "Storm",           label: "Respond to Storm Events",   description: "Review and manage weather auto-responses" },
  trigger_storm_test:     { group: "Storm",           label: "Trigger Storm Test",        description: "Fire test storm-response events" },
  manage_calendar:        { group: "Calendar",        label: "Manage Calendar",           description: "Create, edit, delete calendar events" },
  view_calendar:          { group: "Calendar",        label: "View Calendar",             description: "See the shared calendar" },
  send_property_messages: { group: "Messaging",       label: "Send Messages",             description: "Send property-scoped messages" },
  view_all_messages:      { group: "Messaging",       label: "View All Messages",         description: "Read all property message threads" },
  view_dashboard:         { group: "Dashboard",       label: "View Dashboard",            description: "Access the main admin/supervisor dashboard" },
  view_signal_flare:      { group: "Dashboard",       label: "View Signal Flare Stats",   description: "See Signal Flare property analytics" },
  respond_signal_flares:  { group: "Signal Flare",    label: "Respond to Signal Flares",  description: "Acknowledge, assign, resolve, and close Signal Flares" },
  raise_signal_flare:     { group: "Signal Flare",    label: "Raise Signal Flare",         description: "Raise an urgent Signal Flare on a property" },
  manage_users:           { group: "Administration",  label: "Manage Users",              description: "Create, edit, enable/disable user accounts" },
  edit_permissions:       { group: "Administration",  label: "Edit Permissions",          description: "Change per-user permission overrides" },
  view_billing:           { group: "Administration",  label: "View Billing",              description: "Access billing and payment information" },
  manage_billing:         { group: "Administration",  label: "Manage Billing",            description: "Create quotes, issue invoices, record payouts, manage disputes" },
  manage_faq:             { group: "Knowledge Base",  label: "Manage Knowledge Base",     description: "Create, edit, publish, and delete FAQ articles and categories" },
  view_faq:               { group: "Knowledge Base",  label: "View Knowledge Base",       description: "Read published knowledge base articles" },
  view_own_property:      { group: "Client",          label: "View Own Property",         description: "Client access to their own property dashboard" },
  view_audit:             { group: "Administration",  label: "View Audit Log",             description: "Access the read-only audit trail for disputes, permissions, and compliance" },
  manage_quotes:          { group: "Quotes",          label: "Manage Quotes",              description: "Review, release, decline vendor quotes; create Launch Crew quotes" },
  submit_vendor_quote:    { group: "Quotes",          label: "Submit Vendor Quotes",       description: "Upload vendor cost quotes for Standing Rock review" },
  view_own_quotes:        { group: "Quotes",          label: "View Own Quotes",            description: "See quotes for your own properties or work orders" },
  manage_retainer:        { group: "Billing",         label: "Manage Retainer",            description: "Record deposits, draws, and adjustments to client retainer balances" },
  view_retainer:          { group: "Billing",         label: "View Retainer",              description: "View retainer balance and ledger for own properties" },
  view_ops_map:           { group: "Operations",     label: "View Operations Map",        description: "Access the confidential staff operations map with all property pins" },
};
