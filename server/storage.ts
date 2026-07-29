import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import {
  users, properties, visits, visitPhotos,
  vendorDispatches, recommendations, scheduledVisits,
  type User, type InsertUser,
  type Property, type InsertProperty,
  type Visit, type InsertVisit,
  type VisitPhoto, type InsertVisitPhoto,
  type VendorDispatch, type InsertVendorDispatch,
  type Recommendation, type InsertRecommendation,
  type ScheduledVisit, type InsertScheduledVisit,
} from "../shared/schema";
import {
  monitoringDevices, alertEvents, alertNotifications, monthlyMonitoringReports,
  type MonitoringDevice, type InsertMonitoringDevice,
  type AlertEvent, type InsertAlertEvent,
  type AlertNotification, type InsertAlertNotification,
  type MonthlyMonitoringReport, type InsertMonthlyMonitoringReport,
} from "../shared/schema";
import {
  escalationLog, dailyDigests,
  type EscalationLog, type InsertEscalationLog,
  type DailyDigest, type InsertDailyDigest,
} from "../shared/schema";
import {
  leads,
  type Lead, type InsertLead,
} from "../shared/schema";

export const sqlite = new Database("data.db");
const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'field_tech',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'OK',
    zip TEXT NOT NULL,
    gps_lat REAL,
    gps_lng REAL,
    service_tier TEXT NOT NULL,
    interior_access INTEGER NOT NULL DEFAULT 0,
    has_dock INTEGER NOT NULL DEFAULT 0,
    has_boat INTEGER NOT NULL DEFAULT 0,
    boat_details TEXT,
    has_boat_lift INTEGER NOT NULL DEFAULT 0,
    has_generator INTEGER NOT NULL DEFAULT 0,
    has_irrigation INTEGER NOT NULL DEFAULT 0,
    has_propane INTEGER NOT NULL DEFAULT 0,
    has_alarm INTEGER NOT NULL DEFAULT 0,
    alarm_panel_location TEXT,
    alarm_code TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    access_notes TEXT,
    property_notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    date_added TEXT NOT NULL,
    assigned_tech_id INTEGER,
    client_user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    tech_id INTEGER NOT NULL,
    visit_type TEXT NOT NULL,
    visit_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER,
    weather_temp TEXT,
    weather_conditions TEXT,
    overall_status TEXT,
    general_notes TEXT,
    actions_taken TEXT,
    storm_subtype TEXT,
    storm_damage_narrative TEXT,
    areas_affected TEXT,
    damage_severity TEXT,
    vendor_dispatched INTEGER,
    emergency_contact_notified INTEGER,
    request_reason TEXT,
    request_areas TEXT,
    hours_worked REAL,
    hourly_rate REAL DEFAULT 85,
    materials_amount REAL DEFAULT 0,
    mileage REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    checklist_data TEXT,
    next_scheduled_visit TEXT,
    tech_signature TEXT,
    tech_signature_date TEXT
  );

  CREATE TABLE IF NOT EXISTS visit_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL,
    checklist_item_key TEXT,
    filename TEXT NOT NULL,
    data_url TEXT NOT NULL,
    caption TEXT,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vendor_dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL,
    vendor_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    date_dispatched TEXT NOT NULL,
    approval_obtained INTEGER NOT NULL DEFAULT 0,
    estimated_cost REAL
  );

  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scheduled_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    tech_id INTEGER,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT,
    visit_type TEXT NOT NULL DEFAULT 'routine',
    notes TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    visit_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS monitoring_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    nickname TEXT NOT NULL,
    device_type TEXT NOT NULL,
    location_description TEXT,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    install_date TEXT,
    installed_by TEXT,
    warranty_expiration TEXT,
    battery_level INTEGER,
    status TEXT NOT NULL DEFAULT 'Online',
    last_ping TEXT,
    configuration_notes TEXT,
    install_photo_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alert_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    device_id INTEGER,
    event_timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    action_taken TEXT NOT NULL DEFAULT 'Pending',
    action_notes TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alert_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    alert_event_id INTEGER,
    notification_type TEXT NOT NULL,
    method TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_contact TEXT NOT NULL,
    content_summary TEXT,
    sent_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS monthly_monitoring_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    reporting_period_start TEXT NOT NULL,
    reporting_period_end TEXT NOT NULL,
    total_events INTEGER NOT NULL DEFAULT 0,
    events_by_type TEXT,
    device_uptime_summary TEXT,
    alerts_resolved INTEGER NOT NULL DEFAULT 0,
    site_visits_triggered INTEGER NOT NULL DEFAULT 0,
    recommendations TEXT,
    billing_hours REAL DEFAULT 0,
    billing_rate REAL DEFAULT 99,
    billing_total REAL DEFAULT 0,
    generated_by TEXT,
    generated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS escalation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_event_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    account_manager_id INTEGER,
    escalation_level TEXT NOT NULL DEFAULT 'Initial',
    triggered_at TEXT NOT NULL,
    notification_sent INTEGER NOT NULL DEFAULT 0,
    notification_sent_at TEXT,
    resolved_before_escalation INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    digest_date TEXT NOT NULL,
    total_events INTEGER NOT NULL DEFAULT 0,
    events_summary TEXT,
    devices_online INTEGER NOT NULL DEFAULT 0,
    devices_offline INTEGER NOT NULL DEFAULT 0,
    active_alerts INTEGER NOT NULL DEFAULT 0,
    resolved_alerts INTEGER NOT NULL DEFAULT 0,
    system_status TEXT NOT NULL DEFAULT 'All Clear',
    created_at TEXT NOT NULL,
    UNIQUE(property_id, digest_date)
  );
`);

try { sqlite.exec("ALTER TABLE properties ADD COLUMN account_manager_id INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE properties ADD COLUMN notification_preferences TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE monitoring_devices ADD COLUMN minut_device_id TEXT"); } catch {}
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      property_address TEXT NOT NULL,
      service_tier_interest TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
  `);
} catch {}

// Vendor work orders, documents, messages (raw SQLite — no Drizzle ORM for these)
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS vendor_work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      property_id INTEGER,
      vendor_id INTEGER,
      assigned_by INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'normal',
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vendor_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      file_url TEXT,
      file_type TEXT,
      vendor_id INTEGER,
      property_id INTEGER,
      work_order_id INTEGER,
      uploaded_by INTEGER,
      uploaded_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vendor_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER,
      from_user_id INTEGER,
      to_user_id INTEGER,
      subject TEXT,
      body TEXT NOT NULL,
      work_order_id INTEGER,
      sent_at TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
} catch {}

// Phase 2 migrations — vendor_documents status/upload, work_orders notes
try {
  sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'requested'`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN review_notes TEXT`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN requested_by INTEGER`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE vendor_documents ADD COLUMN file_data TEXT`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE vendor_work_orders ADD COLUMN notes TEXT`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE vendor_work_orders ADD COLUMN cancelled_at TEXT`);
} catch {}
try {
  sqlite.exec(`ALTER TABLE vendor_messages ADD COLUMN parent_id INTEGER`);
} catch {}
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom',
      date TEXT NOT NULL,
      time TEXT,
      end_date TEXT,
      property_id INTEGER,
      work_order_id INTEGER,
      created_by INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
} catch {}

// Photo Visit Reports — quick report tied to a scheduled visit completion
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS visit_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduled_visit_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      tech_id INTEGER NOT NULL,
      note TEXT,
      overall_status TEXT NOT NULL DEFAULT 'all_clear',
      completed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
} catch {}
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS visit_report_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      data_url TEXT NOT NULL,
      caption TEXT,
      uploaded_at TEXT NOT NULL
    );
  `);
} catch {}
// Phase 3: Extend visit_reports with checklist_data + extend visit_report_photos with item_key
try { sqlite.exec("ALTER TABLE visit_reports ADD COLUMN checklist_data TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE visit_report_photos ADD COLUMN item_key TEXT"); } catch {}

// Weather Auto-Response Engine tables
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS weather_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nws_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'Unknown',
      headline TEXT,
      description TEXT,
      effective TEXT NOT NULL,
      expires TEXT NOT NULL,
      geometry TEXT,
      raw_payload TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS storm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      weather_alert_id INTEGER NOT NULL,
      triggered_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_tech_id INTEGER,
      scheduled_visit_id INTEGER,
      notes TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(property_id, weather_alert_id)
    );
    CREATE TABLE IF NOT EXISTS in_app_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL
    );
  `);
} catch {}
// Add storm_response visit_type support (already stored as TEXT so no migration needed)
try { sqlite.exec("ALTER TABLE scheduled_visits ADD COLUMN weather_alert_id INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE scheduled_visits ADD COLUMN storm_event_id INTEGER"); } catch {}

// Client Portal tables
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      internal_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS property_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      from_user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      read_at TEXT
    );
    CREATE TABLE IF NOT EXISTS property_appliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      make TEXT,
      model TEXT,
      serial TEXT,
      location TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
} catch {}
// Ensure user password field exists for change-password
try { sqlite.exec("ALTER TABLE users ADD COLUMN password_updated_at TEXT"); } catch {}

// Brick 10f — TOTP 2FA columns (additive, Migration A)
try { sqlite.exec("ALTER TABLE users ADD COLUMN totp_secret       TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN totp_enabled      INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN totp_opt_out_ack  INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN totp_backup_codes TEXT"); } catch {}

// ─── FAQ / Knowledge Base tables ─────────────────────────────────────────────
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS faq_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'BookOpen',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS faq_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      related_asset_type TEXT,
      allow_service_request INTEGER NOT NULL DEFAULT 0,
      service_request_category TEXT,
      author_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
} catch {}

// ─── Signal Flare tables ─────────────────────────────────────────────────────
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS signal_flares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      raised_by INTEGER,
      source TEXT NOT NULL DEFAULT 'client',
      severity TEXT NOT NULL DEFAULT 'High',
      category TEXT NOT NULL DEFAULT 'General Emergency',
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      assigned_to INTEGER,
      acknowledged_by INTEGER,
      acknowledged_at TEXT,
      resolved_by INTEGER,
      resolved_at TEXT,
      escalated INTEGER NOT NULL DEFAULT 0,
      escalated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signal_flare_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flare_id INTEGER NOT NULL,
      actor_id INTEGER,
      event_type TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);
} catch {}

// ─── Billing tables ──────────────────────────────────────────────────────────────────────────────
try {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS client_billing_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL UNIQUE,
      stripe_customer_id TEXT,
      stripe_payment_method_id TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'standard',
      billing_day INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      line_items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Draft',
      sent_at TEXT,
      approved_at TEXT,
      approved_by INTEGER,
      declined_at TEXT,
      declined_reason TEXT,
      service_request_id INTEGER,
      work_order_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      property_id INTEGER,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      issued_at TEXT,
      due_at TEXT,
      paid_at TEXT,
      stripe_invoice_id TEXT,
      stripe_hosted_url TEXT,
      stripe_pdf_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id INTEGER,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      invoice_id INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT,
      description TEXT,
      stripe_payment_intent_id TEXT,
      stripe_charge_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vendor_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      work_order_id INTEGER,
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'check',
      status TEXT NOT NULL DEFAULT 'Pending',
      paid_at TEXT,
      note TEXT,
      recorded_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      line_item_id INTEGER,
      client_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      staff_notes TEXT,
      resolution TEXT,
      resolved_by INTEGER,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- ─── QUOTE MANAGEMENT (Vendor + Launch Crew) ────────────────────────────────
    CREATE TABLE IF NOT EXISTS quote_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_type TEXT NOT NULL CHECK(quote_type IN ('vendor','launch_crew')),
      property_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      service_request_id INTEGER,
      work_order_id INTEGER,
      vendor_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      line_items TEXT NOT NULL DEFAULT '[]',
      total REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'Draft',
      created_by INTEGER NOT NULL,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      released_at TEXT,
      returned_at TEXT,
      return_note TEXT,
      client_decision TEXT,
      client_decision_at TEXT,
      client_decision_by INTEGER,
      billable INTEGER NOT NULL DEFAULT 0,
      sent_to_client_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quote_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_data TEXT,
      file_url TEXT,
      mime_type TEXT,
      file_size INTEGER,
      uploaded_by INTEGER NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'internal',
      created_at TEXT NOT NULL
    );

    -- Per-property task pricing
    CREATE TABLE IF NOT EXISTS property_task_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      task_type TEXT NOT NULL,
      rate REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'per_visit',
      notes TEXT,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(property_id, task_type)
    );

    -- Retainer ledger
    CREATE TABLE IF NOT EXISTS retainer_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('deposit','draw','refund','adjustment')),
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      related_source_type TEXT,
      related_source_id INTEGER,
      note TEXT,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
} catch {}

// ─── FAQ seed data ───────────────────���────────────────────────────────────────
const faqCount = sqlite.prepare("SELECT COUNT(*) as c FROM faq_categories").get() as any;
if (!faqCount || faqCount.c === 0) {
  const now = new Date().toISOString();

  // Insert categories
  const catStmt = sqlite.prepare("INSERT INTO faq_categories (name,icon,sort_order,created_at) VALUES (?,?,?,?) RETURNING id");
  const catWater = (catStmt.get("Water Management", "Droplets", 1, now) as any).id;
  const catHVAC  = (catStmt.get("HVAC & Climate", "Thermometer", 2, now) as any).id;
  const catSafety = (catStmt.get("Safety & Security", "ShieldCheck", 3, now) as any).id;
  const catDock  = (catStmt.get("Docks & Marine", "Anchor", 4, now) as any).id;
  const catGeneral = (catStmt.get("General Property Care", "Home", 5, now) as any).id;
  const catEmerg = (catStmt.get("Emergency Preparedness", "Zap", 6, now) as any).id;

  // Insert articles
  const artStmt = sqlite.prepare(`
    INSERT INTO faq_articles
    (category_id,title,slug,body,tags,status,related_asset_type,allow_service_request,service_request_category,author_id,sort_order,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  // ── Water Management ──
  artStmt.run(catWater, "How to Winterize Your Waterline",
    "winterize-waterline",
    `# How to Winterize Your Waterline

Winterizing your waterline before the first hard freeze protects you from one of the most expensive lake-property repairs: burst pipes. A single freeze event can cause $5,000–$20,000 in damage if water is left standing in lines.

## What You'll Need
- Air compressor (min. 50 CFM for most lake-home systems)
- Non-toxic propylene glycol antifreeze (NOT automotive antifreeze)
- Pipe insulation wrap
- Ball-valve shutoff wrench

## Step-by-Step

### 1. Shut Off the Water at the Source
Locate your main water shutoff — usually near the pressure tank or at the meter pit. Turn the valve fully clockwise to close.

### 2. Drain All Supply Lines
Open every faucet inside and outside — hot and cold — to let standing water drain. Start at the highest point in the house and work your way down.

### 3. Blow Out Irrigation Lines
Connect the air compressor to the irrigation blowout port (usually near the backflow preventer). Run each zone for 2–3 minutes until no water mist exits the heads.

### 4. Add Antifreeze to Traps
Pour 1–2 cups of non-toxic propylene glycol antifreeze into:
- All sink drains
- All toilet bowls (flush first, then pour into bowl and tank)
- The floor drain
- The washer drain

### 5. Insulate Exposed Pipes
Any pipes running through unheated spaces (crawl spaces, under decks, along exterior walls) should be wrapped with foam pipe insulation or heat tape.

### 6. Document Everything
Take a photo of each shutoff valve in the closed position. This is your proof of completion and helps during spring startup.

## Common Mistakes
- **Leaving garden hoses connected** — water backs up into the spigot and freezes the valve body
- **Skipping the antifreeze in P-traps** — a frozen trap can crack the fitting
- **Forgetting the ice-maker line** — it's a separate small-diameter line that freezes easily

## When to Call a Professional
If your system uses a submersible well pump, the pull-and-winterize process requires a licensed plumber. The pump must be physically removed from the well casing.

> **Standing Rock Tip:** We perform winterization as part of our Anchor Watch and Shipshape service packages. If you'd like us to handle this, click the button below.`,
    '["winterization","pipes","freeze","water","seasonal"]', "published",
    "water_heater", 1, "Seasonal Maintenance", 1, 1, now, now);

  artStmt.run(catWater, "Reading and Resetting Your Water Pressure Tank",
    "water-pressure-tank",
    `# Reading and Resetting Your Water Pressure Tank

A pressure tank stores pressurized water so your pump doesn't cycle on and off every time you open a faucet. Understanding it helps you spot problems early.

## Normal Operating Pressures
Most lake-home systems run at **30–50 PSI** or **40–60 PSI**. Your pressure switch is set to cut in at the lower number and cut out at the higher.

## How to Check the Pre-Charge Pressure
1. Turn off power to the pump at the breaker
2. Open a faucet to relieve pressure until flow stops
3. Remove the Schrader valve cap on top of the tank (looks like a tire valve)
4. Check pressure with a tire gauge — it should read **2 PSI below the cut-in pressure**
   - Example: 30/50 system → pre-charge should be 28 PSI
5. Add air with a bicycle pump or compressor if too low

## Signs of Waterlogged Tank
- Pump short-cycles (turns on/off rapidly)
- Pressure gauge spikes and drops quickly
- Banging noise in pipes when pump starts

A waterlogged tank means the internal bladder has failed. The tank usually needs replacement.

## Resetting After a Power Outage
Most systems restart automatically. If the pump won't start:
1. Check the breaker
2. Check the pressure switch — it may have a manual reset lever
3. Prime the pump if it ran dry (see your pump manual)

> **Standing Rock Tip:** If your pressure tank is more than 10 years old or you're experiencing any of the symptoms above, we recommend a professional inspection. Click below to request service.`,
    '["water","pump","pressure","tank","well"]', "published",
    "water_heater", 1, "Plumbing Inspection", 1, 2, now, now);

  // ── HVAC ──
  artStmt.run(catHVAC, "How to Change Your HVAC Filter",
    "hvac-filter-change",
    `# How to Change Your HVAC Filter

A clean filter is the single most impactful maintenance item for your HVAC system. A clogged filter can increase energy use by 15–30%, reduce system life, and degrade air quality.

## How Often?
| Filter Type | Change Interval |
|---|---|
| Fiberglass 1" | Every 30 days |
| Pleated 1–4" | Every 60–90 days |
| HEPA / High MERV | Every 6–12 months |

For vacation/lake properties that sit empty for weeks, extend intervals — the filter only loads when the system runs.

## Step-by-Step

### 1. Find the Filter Location
Filter slots are typically:
- At the return-air grille (large louvered vent, usually in a hallway or ceiling)
- At the air handler/furnace unit itself

### 2. Note the Size
The current filter will have its size printed on the frame, e.g., **20x25x1** or **16x25x4**.

### 3. Check the Airflow Arrow
Filters have a printed arrow showing airflow direction. It should point **toward the blower** (away from the return grille, toward the air handler).

### 4. Slide Out the Old Filter
Note how dirty it is — a gray-black filter is seriously overdue. A light gray film is normal.

### 5. Insert the New Filter
Make sure the arrow points the correct direction. Ensure the filter fits snugly with no gaps at the edges.

### 6. Note the Date
Write the install date on the filter frame with a marker so you know when to change it next.

## For HEPA / High-MERV Filters
These require more force to pull air through. Make sure your system is rated for the filter's MERV level (check your equipment manual or data plate). Using a MERV 13+ filter on an older system can starve it of airflow.

> **Standing Rock Tip:** We log filter changes during every scheduled visit. We stock the most common sizes for properties we manage. Click below if you'd like us to handle this.`,
    '["hvac","filter","air quality","maintenance","seasonal"]', "published",
    "hvac_system", 1, "HVAC Maintenance", 1, 1, now, now);

  artStmt.run(catHVAC, "Preparing Your HVAC for Summer (Lake Home)",
    "hvac-summer-prep",
    `# Preparing Your HVAC for Summer (Lake Home)

Lake homes face unique HVAC challenges: high humidity, seasonal vacancy, and sometimes critters that nest in equipment over the winter.

## Spring Startup Checklist

### Outdoor Unit (Condenser)
- Remove any winter cover (a covered condenser can't dissipate heat)
- Clear debris: leaves, sticks, seeds from around the unit — maintain 18" clearance on all sides
- Rinse condenser coils with a garden hose (gentle pressure, top-down)
- Check refrigerant lines for insulation damage (rodent chewing is common)
- Inspect and straighten bent coil fins with a fin comb if needed

### Indoor Air Handler
- Replace the filter (see filter change article)
- Wipe down the evaporator coil access panel
- Pour 1 cup of diluted bleach OR white vinegar down the condensate drain
- Check the condensate drain pan for standing water or algae

### Thermostat
- Replace batteries
- Switch from Heat to Cool mode, set to 78°F, and verify the system kicks on within 5 minutes
- Check all vents are open and unobstructed

## Humidity Control at Lake Properties
With humidity regularly above 70%, your AC does double duty removing moisture. Consider:
- Setting thermostat fan to **Auto** (not On) — continuous fan recirculates humid air without dehumidifying
- A whole-home dehumidifier if you experience mold/mildew even with AC running
- Keeping interior doors open to allow air circulation

> **Standing Rock Tip:** Our spring activation service includes a full HVAC check. Click below to schedule.`,
    '["hvac","summer","ac","seasonal","lake home"]', "published",
    "hvac_system", 1, "HVAC Maintenance", 1, 2, now, now);

  // ── Safety & Security ──
  artStmt.run(catSafety, "Smoke & CO Detector Maintenance",
    "smoke-co-detectors",
    `# Smoke & CO Detector Maintenance

Detectors are the first line of defense at a property that may sit vacant for extended periods. A battery failure that goes unnoticed can be catastrophic.

## Required Locations (Oklahoma minimum code)
- Inside every bedroom
- Outside each sleeping area (hallway)
- On every level, including basement
- Within 10 feet of any fuel-burning appliance (CO detector)

## Maintenance Schedule
| Task | Frequency |
|---|---|
| Test (press test button) | Monthly |
| Replace batteries | Annually (or when low-battery chirp starts) |
| Replace entire unit | Every 10 years (smoke) / Every 7 years (CO) |
| Clean with compressed air | Annually |

## How to Test
1. Press and hold the test button for 3–5 seconds
2. You should hear a loud alarm pattern
3. If the alarm is weak or absent, replace batteries first, then retest
4. If still failing after new batteries, replace the unit

## Vacation Property Best Practice
- Use 10-year sealed-battery units — no annual battery swaps needed
- Enable remote monitoring if your security system supports it
- Log the installation date on the unit with a label maker

> **Standing Rock Tip:** We test all detectors during each scheduled visit and flag any units that need replacement. Click below if you'd like us to perform a detector audit at your property.`,
    '["safety","smoke","carbon monoxide","detectors","maintenance"]', "published",
    null, 1, "Safety Inspection", 1, 1, now, now);

  // ── Docks & Marine ──
  artStmt.run(catDock, "Dock and Boat Lift Seasonal Checklist",
    "dock-boat-lift-checklist",
    `# Dock and Boat Lift Seasonal Checklist

Lake Eufaula experiences significant water-level fluctuations managed by the Army Corps of Engineers. Your dock maintenance schedule should align with seasonal pool levels.

## Spring Launch Checklist

### Dock
- [ ] Inspect all dock planking for rot, cracks, or warped boards
- [ ] Tighten all bolts and hardware (use stainless or galvanized fasteners only)
- [ ] Check anchor cables/chains — look for rust, fraying, or broken links
- [ ] Inspect flotation drums or foam billets for damage or waterlogging
- [ ] Test dock lights; replace bulbs and check GFCI outlets
- [ ] Clean and apply non-slip coating to walking surfaces
- [ ] Check water depth at slip — Corps drawdown can leave you grounded

### Boat Lift
- [ ] Lubricate all sheaves, pulleys, and the gear drive
- [ ] Inspect lift cables for fraying or corrosion
- [ ] Test motor (run lift up and down under no load)
- [ ] Inspect cradle bunks — repad if worn
- [ ] Check all limit switches
- [ ] Load test with boat before first use

## Fall / Winter Preparation
- Remove canvas, cushions, and electronics from any boats stored in open lifts
- Add winter shore power connection if your marina supports it
- Consider a dock de-icer if you're in a cove that freezes

## Lake Eufaula Water Levels
The Corps typically begins pool drawdown in mid-October (winter pool = 583 ft MSL). Check current levels at the [Eufaula Lake Operations website](https://www.swt.usace.army.mil).

> **Standing Rock Tip:** We perform dock and lift inspections as part of our seasonal service. Click below to request a dock condition report.`,
    '["dock","boat lift","lake","seasonal","marine","Eufaula"]', "published",
    "dock", 1, "Dock Inspection", 1, 1, now, now);

  // ── General Property Care ──
  artStmt.run(catGeneral, "Pest Prevention for Lake Properties",
    "pest-prevention",
    `# Pest Prevention for Lake Properties

Lake properties attract a wider range of pests than urban homes: spiders, wasps, mice, snakes, bats, and the ever-present lake flies. A vacant property is especially vulnerable.

## Common Pests at Lake Eufaula Properties

### Mice & Rodents
- Entry points: gaps around pipes, vents, and utility penetrations; gaps under doors
- Signs: droppings, gnawed food packaging, nesting material
- Prevention: seal all penetrations with steel wool + caulk; use bait stations in crawl spaces

### Wasps & Yellow Jackets
- Highly active April–September
- Nests in eaves, deck cavities, and inside outdoor furniture
- Prevention: knock down new nests in spring (paper golf-ball size) before colonies establish

### Bats
- Protected by law — do not harm
- Entry through gaps as small as 3/8"
- Exclusion (not killing) is the only legal method during non-pup season (Aug–Oct)

### Brown Recluse Spiders
- Common in Oklahoma; hide in dark, undisturbed areas
- Inspect before putting hands in cabinets, stored boxes, under furniture
- Sticky traps in corners are effective for monitoring

## General Prevention Strategy
1. **Eliminate food sources** — all food stored in sealed containers or removed when leaving
2. **Reduce clutter** — firewood stored 20 ft from structure, no debris piles against foundation
3. **Seal entry points** — caulk, steel wool, weatherstripping on all doors
4. **Regular inspection** — a bi-monthly walk-through catches infestations early

> **Standing Rock Tip:** Pest monitoring is part of every Standing Rock property check. We document evidence and recommend action. Click below to request a dedicated pest inspection.`,
    '["pest","mice","spiders","wasps","lake","prevention"]', "published",
    null, 1, "Pest Inspection", 1, 1, now, now);

  artStmt.run(catGeneral, "Mold Prevention in a Lake Home",
    "mold-prevention",
    `# Mold Prevention in a Lake Home

High humidity, seasonal vacancy, and warm summers make lake homes one of the highest-risk environments for mold growth. Left unchecked, mold can render a property unlivable and require costly remediation.

## Why Lake Homes Are High Risk
- Humidity regularly exceeds 70–80% in summer
- AC is often turned off or set high when vacant (humidity spikes)
- Ventilation is reduced with windows closed
- Roof or plumbing leaks go undetected for weeks

## Prevention Checklist

### HVAC & Dehumidification
- Do NOT turn off AC when leaving — set to 80°F instead of off
- Set thermostat to **Dehumidify** or **Fan Auto** mode if available
- Run a standalone dehumidifier set to 50% RH in problem areas (basements, enclosed spaces)
- Clean condensate drain line quarterly

### Ventilation
- Install bathroom exhaust fans with humidity sensors (auto-run when humidity exceeds 60%)
- Ensure attic and crawl space are properly vented
- Open windows/doors briefly during low-humidity weather

### Early Detection
- Install a WiFi humidity monitor (Govee, SensorPush) that alerts you remotely
- Check window sills, under sinks, and around tub surrounds during every visit
- Dark spots on drywall, musty odor, or peeling paint indicate moisture intrusion

### After a Flood or Leak
- Dry completely within 48 hours to prevent mold
- Use commercial air movers + dehumidifiers
- Remove and replace drywall that stays wet more than 24 hours

> **Standing Rock Tip:** We check for moisture and mold indicators during every property visit and track trends over time. Click below if you'd like us to perform a dedicated mold prevention assessment.`,
    '["mold","humidity","moisture","prevention","lake home"]', "published",
    null, 1, "Mold Inspection", 1, 2, now, now);

  // ── Emergency Preparedness ──
  artStmt.run(catEmerg, "What to Do When a Severe Storm Hits Your Lake Property",
    "storm-emergency-response",
    `# What to Do When a Severe Storm Hits Your Lake Property

Lake Eufaula sits in Tornado Alley and experiences severe thunderstorms, flash flooding, and occasional tornadoes. Knowing the response sequence can prevent serious damage.

## Before the Storm (24–48 hours out)
- Secure or stow all outdoor furniture, cushions, and decorations
- Pull boats out of the water or raise lifts to maximum height
- Close all windows and doors; check weatherstripping
- Fill vehicles with gas
- Have a battery-powered weather radio ready

## During the Storm
- Monitor alerts via the [NOAA Weather page](https://www.weather.gov) or a NWS-certified app
- If a Tornado Warning is issued: move to interior, lowest-level room; avoid windows
- If flash flooding is possible: move vehicles to high ground

## Immediately After
1. Walk the exterior before entering — check for downed power lines, structural damage
2. Photograph all damage before cleanup for insurance purposes
3. Check roof from the ground for missing shingles or damaged ridge cap
4. Inspect dock — debris strikes are common after storms
5. Check sump pump operation if you have a basement or crawl space
6. Run water in the house — a surge can dislodge sediment in filters

## Filing an Insurance Claim
- Notify your insurer within 24–48 hours of the event
- Keep all damaged materials (don't dispose of them before adjuster visits)
- Get at least 2 contractor quotes for all repair work
- Document your pre-storm condition with a photo library (update annually)

## Standing Rock Storm Response
When a severe weather event is detected in your property's area, our system automatically triggers a property check protocol. You'll receive a Signal Flare notification with our findings.

> **Standing Rock Tip:** Need a post-storm damage assessment? Click below to request an emergency visit.`,
    '["storm","tornado","emergency","flood","severe weather","Eufaula"]', "published",
    null, 1, "Storm Damage Assessment", 1, 1, now, now);

  artStmt.run(catEmerg, "Generator Maintenance for Backup Power",
    "generator-maintenance",
    `# Generator Maintenance for Backup Power

A backup generator is critical at a lake property — ice storms and severe weather can knock power out for days. A generator that won't start in an emergency is worse than no generator at all.

## Monthly (Auto-Test)
Most standby generators (Generac, Kohler) have a weekly or monthly auto-test feature. Verify yours is enabled:
- Generac: Press **ENTER** → **EXERCISE** → set day and time
- Exercise should run for at least 20 minutes under load

## Every 3 Months
- Check oil level (see dipstick markings)
- Inspect air filter — clean or replace if dirty
- Check coolant level on liquid-cooled units
- Test transfer switch by manually switching loads

## Annually
- Change oil and oil filter (every 100–200 hrs or annually, whichever comes first)
- Replace air filter
- Replace spark plugs
- Test battery with a battery load tester
- Clean the unit exterior — remove debris from around enclosure

## Before a Known Storm Event
- Test-run the generator under load (turn off main breaker after transfer switch activates)
- Check fuel level (propane/natural gas supply; diesel generators — top off)
- Have a service technician on call if the unit hasn't been serviced recently

## When Generator Won't Start
1. Check oil level — most generators have a low-oil shutdown
2. Check battery — a dead battery is the most common failure
3. Check fuel supply valve is open
4. Check choke setting on manual-start units

> **Standing Rock Tip:** Generator service coordination is available as an add-on. Click below to schedule a generator maintenance visit.`,
    '["generator","power","backup","emergency","maintenance"]', "published",
    "generator", 1, "Generator Service", 1, 2, now, now);

  console.log("[storage] FAQ seed data inserted.");
}

// Seed demo data
const existingAdmin = db.select().from(users).where(eq(users.username, "admin")).get();
if (!existingAdmin) {
  // Seed users
  db.insert(users).values([
    { username: "admin", password: "admin123", name: "Chris Fansler", email: "fansler.cc@standingrockstewards.com", phone: "9187072228", role: "admin" },
    { username: "jake", password: "jake123", name: "Jake Mitchell", email: "jake@standingrockstewards.com", phone: "9185551234", role: "field_tech" },
    { username: "marcus", password: "marcus123", name: "Marcus Webb", email: "marcus@standingrockstewards.com", phone: "9185555678", role: "field_tech" },
    { username: "jsmith", password: "client123", name: "John Smith", email: "jsmith@example.com", phone: "4058881234", role: "client" },
    { username: "rhenderson", password: "client123", name: "Ray Henderson", email: "rhenderson@example.com", phone: "9185559012", role: "client" },
    { username: "apatel", password: "client123", name: "Anita Patel", email: "apatel@example.com", phone: "2145553456", role: "client" },
    { username: "vendor1", password: "vendor123", name: "River City Plumbing", email: "contact@rivercityplumbing.com", phone: "9185550099", role: "vendor" },
    { username: "supervisor1", password: "super123", name: "Sarah Torres", email: "storres@standingrockstewards.com", phone: "9185552222", role: "supervisor" },
  ]).run();

  // Seed properties
  db.insert(properties).values([
    {
      nickname: "Smith Lake House",
      ownerName: "John Smith", ownerEmail: "jsmith@example.com", ownerPhone: "4058881234",
      address: "4821 Lakeview Dr", city: "Checotah", state: "OK", zip: "74426",
      gpsLat: 35.4726, gpsLng: -95.5286,
      serviceTier: "anchor_watch",
      interiorAccess: true, hasDock: true, hasBoat: true,
      boatDetails: JSON.stringify({ type: "Pontoon", make: "Sun Tracker", name: "Smith Family Cruiser" }),
      hasBoatLift: true, hasGenerator: false, hasIrrigation: false, hasPropane: true, hasAlarm: true,
      alarmPanelLocation: "Master bedroom closet",
      alarmCode: "4821",
      emergencyContactName: "Mary Smith", emergencyContactPhone: "4058881235",
      accessNotes: "Gate code: 7744. Lockbox on right side of front door, code 2211.",
      propertyNotes: "Large wraparound deck. Propane tank on east side. Boat is winterized November-March.",
      active: true, dateAdded: "2024-03-15", assignedTechId: 2, clientUserId: 4,
    },
    {
      nickname: "Henderson Retreat",
      ownerName: "Ray Henderson", ownerEmail: "rhenderson@example.com", ownerPhone: "9185559012",
      address: "1102 Harbor Cove Rd", city: "Eufaula", state: "OK", zip: "74432",
      gpsLat: 35.2891, gpsLng: -95.5821,
      serviceTier: "shipshape",
      interiorAccess: true, hasDock: true, hasBoat: true,
      boatDetails: JSON.stringify({ type: "Bass Boat", make: "Ranger", name: "Ray's Ranger" }),
      hasBoatLift: true, hasGenerator: true, hasIrrigation: true, hasPropane: true, hasAlarm: true,
      alarmPanelLocation: "Utility room near garage entry",
      alarmCode: "1102",
      emergencyContactName: "Carol Henderson", emergencyContactPhone: "9185559013",
      accessNotes: "No gate. Front door lockbox code: 8855. Generator shed key on same ring.",
      propertyNotes: "Premium property. Generator tested monthly. Irrigation has 6 zones, controller in garage.",
      active: true, dateAdded: "2023-11-01", assignedTechId: 2, clientUserId: 5,
    },
    {
      nickname: "Patel Cove Cabin",
      ownerName: "Anita Patel", ownerEmail: "apatel@example.com", ownerPhone: "2145553456",
      address: "607 Wildwood Shores Ln", city: "Checotah", state: "OK", zip: "74426",
      gpsLat: 35.5011, gpsLng: -95.5102,
      serviceTier: "anchor_watch",
      interiorAccess: true, hasDock: true, hasBoat: false,
      hasBoatLift: false, hasGenerator: false, hasIrrigation: false, hasPropane: true, hasAlarm: false,
      emergencyContactName: "Raj Patel", emergencyContactPhone: "2145553457",
      accessNotes: "Gate at road entry, code 3344. Key under pot on back porch.",
      propertyNotes: "Smaller cabin, 2BR. Propane fireplace inside. Dock is fixed wood construction.",
      active: true, dateAdded: "2024-06-20", assignedTechId: 3, clientUserId: 6,
    },
    {
      nickname: "Williams Getaway",
      ownerName: "Linda Williams", ownerEmail: "lwilliams@example.com", ownerPhone: "9185554321",
      address: "2244 East Shore Dr", city: "Eufaula", state: "OK", zip: "74432",
      gpsLat: 35.3120, gpsLng: -95.5640,
      serviceTier: "anchor_watch",
      interiorAccess: false, hasDock: true, hasBoat: false,
      hasBoatLift: false, hasGenerator: false, hasIrrigation: false, hasPropane: false, hasAlarm: false,
      accessNotes: "No gate. No interior access. External check only.",
      propertyNotes: "Owner visits monthly. Exterior and dock only per service agreement.",
      active: true, dateAdded: "2025-01-10", assignedTechId: 3, clientUserId: null,
    },
  ]).run();

  // Seed some visits
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  db.insert(visits).values([
    {
      propertyId: 1, techId: 2, visitType: "routine", visitDate: lastMonth,
      startTime: "09:00", endTime: "10:30", durationMinutes: 90,
      weatherTemp: "72", weatherConditions: "Clear",
      overallStatus: "all_clear", generalNotes: "Property in excellent condition. Dock cleats recently re-tightened.",
      actionsTaken: "Checked all exterior doors and windows. Tested smoke detectors. Inspected dock.",
      hoursWorked: 1.5, hourlyRate: 85, materialsAmount: 0, mileage: 14,
      status: "submitted",
      checklistData: JSON.stringify({ exterior: {}, security: {}, interior: {}, dock: {} }),
      nextScheduledVisit: today,
      techSignature: "Jake Mitchell", techSignatureDate: lastMonth,
    },
    {
      propertyId: 2, techId: 2, visitType: "routine", visitDate: lastMonth,
      startTime: "11:00", endTime: "13:15", durationMinutes: 135,
      weatherTemp: "68", weatherConditions: "Cloudy",
      overallStatus: "items_flagged", generalNotes: "Generator service overdue. Irrigation head #3 cracked.",
      actionsTaken: "Documented all issues. Contacted owner. Irrigation head flagged for repair.",
      hoursWorked: 2.25, hourlyRate: 85, materialsAmount: 12, mileage: 22,
      status: "submitted",
      checklistData: JSON.stringify({}),
      nextScheduledVisit: today,
      techSignature: "Jake Mitchell", techSignatureDate: lastMonth,
    },
  ]).run();

  // Seed recommendations
  db.insert(recommendations).values([
    { visitId: 2, propertyId: 2, description: "Generator service overdue — schedule professional service", priority: "High", resolved: false, createdAt: lastMonth },
    { visitId: 2, propertyId: 2, description: "Irrigation head #3 is cracked and leaking — replace before spring season", priority: "Medium", resolved: false, createdAt: lastMonth },
  ]).run();

  // Seed vendor demo data (Phase 2)
  try {
    const vendorUser = sqlite.prepare("SELECT id FROM users WHERE username = 'vendor1'").get() as any;
    const vendorId = vendorUser?.id;
    const existingVWO = sqlite.prepare("SELECT id FROM vendor_work_orders LIMIT 1").get();
    if (vendorId && !existingVWO) {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const nextWeek = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

      sqlite.prepare("INSERT INTO vendor_work_orders (title,description,property_id,vendor_id,assigned_by,status,priority,due_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
        "HVAC Filter Replacement", "Replace all HVAC filters at Smith Lake House — 4 return vents, 2-inch pleated filters.", 1, vendorId, 1, "pending", "normal", nextWeek, null, now
      );
      sqlite.prepare("INSERT INTO vendor_work_orders (title,description,property_id,vendor_id,assigned_by,status,priority,due_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
        "Dock Pressure Wash", "Full dock and boat lift pressure wash before summer season.", 2, vendorId, 1, "accepted", "high", today, "Customer requested completion by end of week.", now
      );
      sqlite.prepare("INSERT INTO vendor_work_orders (title,description,property_id,vendor_id,assigned_by,status,priority,due_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
        "Generator Service", "Annual generator service — oil, filters, load test.", 2, vendorId, 1, "in_progress", "normal", nextWeek, null, now
      );

      sqlite.prepare("INSERT INTO vendor_documents (title,file_url,file_type,vendor_id,property_id,work_order_id,uploaded_by,status,requested_by,review_notes,uploaded_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
        "W-9 Tax Form", null, "pdf", vendorId, null, null, null, "requested", 1, null, now, now
      );
      sqlite.prepare("INSERT INTO vendor_documents (title,file_url,file_type,vendor_id,property_id,work_order_id,uploaded_by,status,requested_by,review_notes,uploaded_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
        "Insurance Certificate", null, "pdf", vendorId, null, null, null, "requested", 1, null, now, now
      );
      sqlite.prepare("INSERT INTO vendor_documents (title,file_url,file_type,vendor_id,property_id,work_order_id,uploaded_by,status,requested_by,review_notes,file_data,uploaded_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
        "Dock Pressure Wash Invoice", null, "pdf", vendorId, 2, 2, vendorId, "submitted", 1, null, null, now, now
      );

      // Seed messages — thread between admin and vendor
      sqlite.prepare("INSERT INTO vendor_messages (vendor_id,from_user_id,to_user_id,subject,body,work_order_id,parent_id,sent_at,read_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
        vendorId, 1, vendorId, "Welcome to Standing Rock Stewards", "Hi River City Plumbing, welcome to the Standing Rock vendor portal. Please upload your W-9 and insurance certificate at your earliest convenience. Let us know if you have any questions.", null, null, now, null, now
      );
      sqlite.prepare("INSERT INTO vendor_messages (vendor_id,from_user_id,to_user_id,subject,body,work_order_id,parent_id,sent_at,read_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(
        vendorId, vendorId, 1, "Re: Welcome to Standing Rock Stewards", "Thank you for the welcome! We will have those documents uploaded shortly. Looking forward to working with you.", null, null, new Date(Date.now()+60000).toISOString(), null, now
      );
    }
  } catch(e) { console.warn("Vendor seed error:", e); }

  // Seed upcoming scheduled visits
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  db.insert(scheduledVisits).values([
    { propertyId: 1, techId: 2, scheduledDate: today, scheduledTime: "09:00", visitType: "routine", notes: "Monthly routine check" },
    { propertyId: 2, techId: 2, scheduledDate: today, scheduledTime: "11:00", visitType: "routine", notes: "Follow up on flagged items" },
    { propertyId: 3, techId: 3, scheduledDate: nextWeek, scheduledTime: "10:00", visitType: "routine" },
    { propertyId: 4, techId: 3, scheduledDate: nextWeek, scheduledTime: "13:00", visitType: "routine" },
  ]).run();

  // Seed Signal Flare demo property (property 1 upgraded to signal_flare)
  db.update(properties).set({ serviceTier: "signal_flare" }).where(eq(properties.id, 1)).run();

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Seed monitoring devices for property 1
  db.insert(monitoringDevices).values([
    {
      propertyId: 1, nickname: "Front Door Cam", deviceType: "Camera",
      locationDescription: "Front entrance, covering driveway", manufacturer: "Minut",
      model: "Minut Pro", serialNumber: "MNT-001-2024", installDate: "2024-03-15",
      installedBy: "Chris Fansler", warrantyExpiration: "2026-03-15",
      batteryLevel: null, status: "Online", lastPing: now,
      configurationNotes: "24/7 motion-triggered recording, 30-day cloud storage",
      createdAt: "2024-03-15T10:00:00Z",
    },
    {
      propertyId: 1, nickname: "Back Deck Cam", deviceType: "Camera",
      locationDescription: "Rear deck overlooking lake", manufacturer: "Minut",
      model: "Minut Pro", serialNumber: "MNT-002-2024", installDate: "2024-03-15",
      installedBy: "Chris Fansler", warrantyExpiration: "2026-03-15",
      batteryLevel: null, status: "Online", lastPing: now,
      configurationNotes: "Waterproof housing, motion zones set to exclude lake movement",
      createdAt: "2024-03-15T10:00:00Z",
    },
    {
      propertyId: 1, nickname: "Indoor Minut Sensor", deviceType: "Minut Sensor",
      locationDescription: "Living room, main hub", manufacturer: "Minut",
      model: "Minut Home", serialNumber: "MNT-003-2024", installDate: "2024-03-15",
      installedBy: "Chris Fansler", warrantyExpiration: "2026-03-15",
      batteryLevel: 78, status: "Online", lastPing: now,
      configurationNotes: "Monitors sound, temperature, humidity, motion. Alerts on smoke/CO.",
      createdAt: "2024-03-15T10:00:00Z",
    },
    {
      propertyId: 1, nickname: "Boat House Door Sensor", deviceType: "Door-Window Sensor",
      locationDescription: "Boat house entry door", manufacturer: "SimpliSafe",
      model: "Entry Sensor Gen3", serialNumber: "SS-004-2024", installDate: "2024-03-15",
      installedBy: "Chris Fansler", warrantyExpiration: "2026-03-15",
      batteryLevel: 12, status: "Alert", lastPing: yesterday,
      configurationNotes: "Low battery — replacement needed at next visit",
      createdAt: "2024-03-15T10:00:00Z",
    },
    {
      propertyId: 1, nickname: "Dock Temperature Sensor", deviceType: "Temperature Sensor",
      locationDescription: "Dock utility box", manufacturer: "SensorPush",
      model: "HT1", serialNumber: "SP-005-2024", installDate: "2024-03-15",
      installedBy: "Chris Fansler", warrantyExpiration: "2025-03-15",
      batteryLevel: 95, status: "Online", lastPing: now,
      configurationNotes: "Alerts below 32°F for freeze risk",
      createdAt: "2024-03-15T10:00:00Z",
    },
  ]).run();

  // Seed alert events for property 1
  db.insert(alertEvents).values([
    {
      propertyId: 1, deviceId: 4, eventTimestamp: yesterday,
      eventType: "Device Offline", severity: "Medium",
      description: "Boat house door sensor battery critically low (12%). Device may go offline soon.",
      actionTaken: "Pending", resolved: false,
      createdAt: yesterday,
    },
    {
      propertyId: 1, deviceId: 1, eventTimestamp: twoDaysAgo,
      eventType: "Motion", severity: "Low",
      description: "Motion detected at front entrance at 11:42 PM. No vehicle in driveway. Likely wildlife.",
      actionTaken: "Resolved-No Action", actionNotes: "Reviewed footage — deer in yard. No action needed.",
      resolved: true, resolvedBy: "Chris Fansler", resolvedAt: twoDaysAgo,
      createdAt: twoDaysAgo,
    },
    {
      propertyId: 1, deviceId: 3, eventTimestamp: weekAgo,
      eventType: "Temperature", severity: "High",
      description: "Indoor temperature dropped to 44°F — possible HVAC issue or power outage.",
      actionTaken: "Owner Notified", actionNotes: "Called owner John Smith at 7:15 AM. Owner confirmed HVAC thermostat was turned off remotely. Resolved.",
      resolved: true, resolvedBy: "Chris Fansler", resolvedAt: weekAgo,
      createdAt: weekAgo,
    },
  ]).run();

  // Seed demo appliances
  const applianceCount = sqlite.prepare("SELECT COUNT(*) as c FROM property_appliances").get() as any;
  if (!applianceCount || applianceCount.c === 0) {
    const now2 = new Date().toISOString();
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(1,"HVAC System","Carrier","Performance 16 Central Air","CAR-2021-4821","Utility closet","Annual filter change due March",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(1,"Water Heater","Rheem","Marathon 50-Gallon","RH-WH-48210","Garage utility bay","Anode rod replaced 2023",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(1,"Refrigerator","Samsung","RF28R7351SR","SSG-RF-2022-1","Kitchen","Ice maker occasionally freezes up",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(1,"Propane Tank","AmeriGas","500-Gallon","AMG-500-4821","East side of house","Auto-fill service enrolled",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(2,"Generator","Generac","Guardian 22kW","GEN-22KW-1102","Generator shed","Monthly auto-test Sundays 12pm",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(2,"Irrigation Controller","Rachio","3rd Gen 8-Zone","RAC-8Z-2023","Garage","6 active zones; schedule in app",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(2,"HVAC System","Lennox","XC20 Variable Speed","LEN-XC20-1102","Utility room","HEPA filter, replace every 6 months",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(3,"Propane Fireplace","Napoleon","Ascent B35","NAP-B35-607","Living room","Annual inspection due Oct",now2);
    sqlite.prepare("INSERT INTO property_appliances (property_id,name,make,model,serial,location,notes,created_at) VALUES (?,?,?,?,?,?,?,?)").run(3,"Water Heater","Bradford White","40-Gallon Electric","BW-40E-607","Utility closet","",now2);
  }

  // Seed demo property messages + service requests
  const msgCount = sqlite.prepare("SELECT COUNT(*) as c FROM property_messages").get() as any;
  if (!msgCount || msgCount.c === 0) {
    sqlite.prepare("INSERT INTO property_messages (property_id,from_user_id,body,sent_at) VALUES (?,?,?,?)").run(1,1,"Hi John — just wrapped up this month's routine visit. Everything looks great at the lake house. We topped off the propane and checked all door seals. Full report is in your portal.",new Date(Date.now()-3*86400000).toISOString());
    sqlite.prepare("INSERT INTO property_messages (property_id,from_user_id,body,sent_at) VALUES (?,?,?,?)").run(1,4,"Thanks Chris! One thing — can you check if the dock light is working? I noticed it was off last weekend.",new Date(Date.now()-2*86400000).toISOString());
    sqlite.prepare("INSERT INTO property_messages (property_id,from_user_id,body,sent_at) VALUES (?,?,?,?)").run(1,1,"We'll check it on the next visit, which is scheduled for next week. Will get back to you with an update!",new Date(Date.now()-1*86400000).toISOString());
    sqlite.prepare("INSERT INTO service_requests (property_id,client_id,category,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(1,4,"Boat Care","Boat battery died — can you jump it and check the connections? Also need the bilge pump tested.","scheduled",new Date(Date.now()-5*86400000).toISOString(),new Date(Date.now()-2*86400000).toISOString());
  }
}

// ─── STORAGE INTERFACE ────────────────────────────────────────────────────────
export interface IStorage {
  // Users
  getUserByUsername(username: string): User | undefined;
  getUserById(id: number): User | undefined;
  getAllUsers(): User[];
  createUser(data: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;

  // Properties
  getAllProperties(): Property[];
  getPropertyById(id: number): Property | undefined;
  getPropertiesByTech(techId: number): Property[];
  getPropertyByClientUser(clientUserId: number): Property | undefined;
  getPropertiesForClient(clientUserId: number): Property[];
  createProperty(data: InsertProperty): Property;
  updateProperty(id: number, data: Partial<InsertProperty>): Property | undefined;

  // Visits
  getAllVisits(): Visit[];
  getVisitById(id: number): Visit | undefined;
  getVisitsByProperty(propertyId: number): Visit[];
  getVisitsByTech(techId: number): Visit[];
  getRecentVisits(limit: number): Visit[];
  createVisit(data: InsertVisit): Visit;
  updateVisit(id: number, data: Partial<InsertVisit>): Visit | undefined;

  // Photos
  getPhotosByVisit(visitId: number): VisitPhoto[];
  createPhoto(data: InsertVisitPhoto): VisitPhoto;
  deletePhoto(id: number): void;

  // Vendor Dispatches
  getVendorsByVisit(visitId: number): VendorDispatch[];
  createVendorDispatch(data: InsertVendorDispatch): VendorDispatch;

  // Recommendations
  getRecommendationsByProperty(propertyId: number): Recommendation[];
  getOpenRecommendations(): Recommendation[];
  createRecommendation(data: InsertRecommendation): Recommendation;
  resolveRecommendation(id: number): void;

  // Scheduled Visits
  getAllScheduledVisits(): ScheduledVisit[];
  getUpcomingScheduledVisits(): ScheduledVisit[];
  getScheduledByTech(techId: number): ScheduledVisit[];
  createScheduledVisit(data: InsertScheduledVisit): ScheduledVisit;
  completeScheduledVisit(id: number, visitId: number): void;

  // Signal Flare — Monitoring Devices
  getDevicesByProperty(propertyId: number): MonitoringDevice[];
  getDeviceById(id: number): MonitoringDevice | undefined;
  createDevice(data: InsertMonitoringDevice): MonitoringDevice;
  updateDevice(id: number, data: Partial<InsertMonitoringDevice>): MonitoringDevice | undefined;
  deleteDevice(id: number): void;

  // Signal Flare — Alert Events
  getAlertsByProperty(propertyId: number): AlertEvent[];
  getActiveAlerts(): AlertEvent[];
  getUnresolvedAlertsByProperty(propertyId: number): AlertEvent[];
  getAlertById(id: number): AlertEvent | undefined;
  createAlertEvent(data: InsertAlertEvent): AlertEvent;
  resolveAlert(id: number, resolvedBy: string, actionTaken: string, actionNotes: string): AlertEvent | undefined;

  // Signal Flare — Notifications
  getNotificationsByProperty(propertyId: number): AlertNotification[];
  createNotification(data: InsertAlertNotification): AlertNotification;

  // Signal Flare — Monthly Reports
  getReportsByProperty(propertyId: number): MonthlyMonitoringReport[];
  createMonthlyReport(data: InsertMonthlyMonitoringReport): MonthlyMonitoringReport;

  // Signal Flare — Dashboard stats
  getSignalFlareStats(): { totalProperties: number; totalDevices: number; unresolvedAlerts: number; devicesOffline: number };

  // Escalation Log
  getEscalationLogs(filters?: { propertyId?: number; resolved?: boolean }): EscalationLog[];
  getEscalationLogByAlertId(alertEventId: number): EscalationLog[];
  createEscalationLog(data: InsertEscalationLog): EscalationLog;
  updateEscalationLog(id: number, data: Partial<EscalationLog>): EscalationLog | undefined;

  // Daily Digests
  getDailyDigests(propertyId: number, limit?: number): DailyDigest[];
  getDailyDigestByDate(propertyId: number, date: string): DailyDigest | undefined;
  upsertDailyDigest(data: InsertDailyDigest): DailyDigest;

  // Property notification prefs
  updatePropertyNotificationPrefs(propertyId: number, prefs: Record<string, any>): Property | undefined;
}

export class Storage implements IStorage {
  // ─── Users ─────────────────────────────────────────────────────────────────
  getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getAllUsers() {
    return db.select().from(users).all();
  }
  createUser(data: InsertUser) {
    return db.insert(users).values(data).returning().get();
  }
  updateUser(id: number, data: Partial<InsertUser>) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  // ─── Properties ────────────────────────────────────────────────────────────
  getAllProperties() {
    return db.select().from(properties).all();
  }
  getPropertyById(id: number) {
    return db.select().from(properties).where(eq(properties.id, id)).get();
  }
  getPropertiesByTech(techId: number) {
    return db.select().from(properties).where(eq(properties.assignedTechId, techId)).all();
  }
  getPropertyByClientUser(clientUserId: number) {
    return db.select().from(properties).where(eq(properties.clientUserId, clientUserId)).get();
  }
  getPropertiesForClient(clientUserId: number) {
    return db.select().from(properties).where(eq(properties.clientUserId, clientUserId)).all();
  }
  createProperty(data: InsertProperty) {
    return db.insert(properties).values(data).returning().get();
  }
  updateProperty(id: number, data: Partial<InsertProperty>) {
    return db.update(properties).set(data).where(eq(properties.id, id)).returning().get();
  }

  // ─── Visits ────────────────────────────────────────────────────────────────
  getAllVisits() {
    return db.select().from(visits).orderBy(desc(visits.visitDate)).all();
  }
  getVisitById(id: number) {
    return db.select().from(visits).where(eq(visits.id, id)).get();
  }
  getVisitsByProperty(propertyId: number) {
    return db.select().from(visits).where(eq(visits.propertyId, propertyId)).orderBy(desc(visits.visitDate)).all();
  }
  getVisitsByTech(techId: number) {
    return db.select().from(visits).where(eq(visits.techId, techId)).orderBy(desc(visits.visitDate)).all();
  }
  getRecentVisits(limit: number) {
    return db.select().from(visits).orderBy(desc(visits.visitDate)).limit(limit).all();
  }
  createVisit(data: InsertVisit) {
    return db.insert(visits).values(data).returning().get();
  }
  updateVisit(id: number, data: Partial<InsertVisit>) {
    return db.update(visits).set(data).where(eq(visits.id, id)).returning().get();
  }

  // ─── Photos ────────────────────────────────────────────────────────────────
  getPhotosByVisit(visitId: number) {
    return db.select().from(visitPhotos).where(eq(visitPhotos.visitId, visitId)).all();
  }
  createPhoto(data: InsertVisitPhoto) {
    return db.insert(visitPhotos).values(data).returning().get();
  }
  deletePhoto(id: number) {
    db.delete(visitPhotos).where(eq(visitPhotos.id, id)).run();
  }

  // ─── Vendor Dispatches ─────────────────────────────────────────────────────
  getVendorsByVisit(visitId: number) {
    return db.select().from(vendorDispatches).where(eq(vendorDispatches.visitId, visitId)).all();
  }
  createVendorDispatch(data: InsertVendorDispatch) {
    return db.insert(vendorDispatches).values(data).returning().get();
  }

  // ─── Recommendations ───────────────────────────────────────────────────────
  getRecommendationsByProperty(propertyId: number) {
    return db.select().from(recommendations).where(eq(recommendations.propertyId, propertyId)).orderBy(desc(recommendations.createdAt)).all();
  }
  getOpenRecommendations() {
    return db.select().from(recommendations).where(eq(recommendations.resolved, false)).all();
  }
  createRecommendation(data: InsertRecommendation) {
    return db.insert(recommendations).values(data).returning().get();
  }
  resolveRecommendation(id: number) {
    db.update(recommendations).set({ resolved: true }).where(eq(recommendations.id, id)).run();
  }

  // ─── Scheduled Visits ──────────────────────────────────────────────────────
  getAllScheduledVisits() {
    return db.select().from(scheduledVisits).orderBy(scheduledVisits.scheduledDate).all();
  }
  getUpcomingScheduledVisits() {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(scheduledVisits)
      .where(and(eq(scheduledVisits.completed, false), gte(scheduledVisits.scheduledDate, today)))
      .orderBy(scheduledVisits.scheduledDate).all();
  }
  getScheduledByTech(techId: number) {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(scheduledVisits)
      .where(and(eq(scheduledVisits.techId, techId), eq(scheduledVisits.completed, false)))
      .orderBy(scheduledVisits.scheduledDate).all();
  }
  createScheduledVisit(data: InsertScheduledVisit) {
    return db.insert(scheduledVisits).values(data).returning().get();
  }
  completeScheduledVisit(id: number, visitId: number) {
    db.update(scheduledVisits).set({ completed: true, visitId }).where(eq(scheduledVisits.id, id)).run();
  }

  // ─── Signal Flare — Monitoring Devices ─────────────────────────────────────
  getDevicesByProperty(propertyId: number) {
    return db.select().from(monitoringDevices).where(eq(monitoringDevices.propertyId, propertyId)).all();
  }
  getDeviceById(id: number) {
    return db.select().from(monitoringDevices).where(eq(monitoringDevices.id, id)).get();
  }
  createDevice(data: InsertMonitoringDevice) {
    return db.insert(monitoringDevices).values(data).returning().get();
  }
  updateDevice(id: number, data: Partial<InsertMonitoringDevice>) {
    return db.update(monitoringDevices).set(data).where(eq(monitoringDevices.id, id)).returning().get();
  }
  deleteDevice(id: number) {
    db.delete(monitoringDevices).where(eq(monitoringDevices.id, id)).run();
  }

  // ─── Signal Flare — Alert Events ───────────────────────────────────────────
  getAlertsByProperty(propertyId: number) {
    return db.select().from(alertEvents).where(eq(alertEvents.propertyId, propertyId)).orderBy(desc(alertEvents.eventTimestamp)).all();
  }
  getActiveAlerts() {
    return db.select().from(alertEvents).where(eq(alertEvents.resolved, false)).orderBy(desc(alertEvents.eventTimestamp)).all();
  }
  getUnresolvedAlertsByProperty(propertyId: number) {
    return db.select().from(alertEvents).where(and(eq(alertEvents.propertyId, propertyId), eq(alertEvents.resolved, false))).orderBy(desc(alertEvents.eventTimestamp)).all();
  }
  getAlertById(id: number) {
    return db.select().from(alertEvents).where(eq(alertEvents.id, id)).get();
  }
  createAlertEvent(data: InsertAlertEvent) {
    return db.insert(alertEvents).values(data).returning().get();
  }
  resolveAlert(id: number, resolvedBy: string, actionTaken: string, actionNotes: string) {
    return db.update(alertEvents).set({
      resolved: true, resolvedBy, actionTaken, actionNotes,
      resolvedAt: new Date().toISOString(),
    }).where(eq(alertEvents.id, id)).returning().get();
  }

  // ─── Signal Flare — Notifications ──────────────────────────────────────────
  getNotificationsByProperty(propertyId: number) {
    return db.select().from(alertNotifications).where(eq(alertNotifications.propertyId, propertyId)).orderBy(desc(alertNotifications.sentAt)).all();
  }
  createNotification(data: InsertAlertNotification) {
    return db.insert(alertNotifications).values(data).returning().get();
  }

  // ─── Signal Flare — Monthly Reports ────────────────────────────────────────
  getReportsByProperty(propertyId: number) {
    return db.select().from(monthlyMonitoringReports).where(eq(monthlyMonitoringReports.propertyId, propertyId)).orderBy(desc(monthlyMonitoringReports.reportingPeriodStart)).all();
  }
  createMonthlyReport(data: InsertMonthlyMonitoringReport) {
    return db.insert(monthlyMonitoringReports).values(data).returning().get();
  }

  // ─── Signal Flare — Dashboard Stats ────────────────────────────────────────
  getSignalFlareStats() {
    const sfProperties = db.select().from(properties).where(eq(properties.serviceTier, "signal_flare")).all();
    const sfPropertyIds = sfProperties.map(p => p.id);
    const totalDevices = sfPropertyIds.reduce((acc, pid) => {
      return acc + db.select().from(monitoringDevices).where(eq(monitoringDevices.propertyId, pid)).all().length;
    }, 0);
    const unresolvedAlerts = db.select().from(alertEvents).where(eq(alertEvents.resolved, false)).all().length;
    const devicesOffline = db.select().from(monitoringDevices).where(eq(monitoringDevices.status, "Offline")).all().length;
    return { totalProperties: sfProperties.length, totalDevices, unresolvedAlerts, devicesOffline };
  }

  // ─── Escalation Log ────────────────────────────────────────────────────────
  getEscalationLogs(filters?: { propertyId?: number }): EscalationLog[] {
    if (filters?.propertyId) {
      return db.select().from(escalationLog).where(eq(escalationLog.propertyId, filters.propertyId)).orderBy(desc(escalationLog.triggeredAt)).all();
    }
    return db.select().from(escalationLog).orderBy(desc(escalationLog.triggeredAt)).all();
  }
  getEscalationLogByAlertId(alertEventId: number): EscalationLog[] {
    return db.select().from(escalationLog).where(eq(escalationLog.alertEventId, alertEventId)).all();
  }
  createEscalationLog(data: InsertEscalationLog): EscalationLog {
    return db.insert(escalationLog).values(data).returning().get();
  }
  updateEscalationLog(id: number, data: Partial<EscalationLog>): EscalationLog | undefined {
    return db.update(escalationLog).set(data).where(eq(escalationLog.id, id)).returning().get();
  }

  // ─── Daily Digests ─────────────────────────────────────────────────────────
  getDailyDigests(propertyId: number, limit = 30): DailyDigest[] {
    return db.select().from(dailyDigests).where(eq(dailyDigests.propertyId, propertyId)).orderBy(desc(dailyDigests.digestDate)).limit(limit).all();
  }
  getDailyDigestByDate(propertyId: number, date: string): DailyDigest | undefined {
    return db.select().from(dailyDigests).where(and(eq(dailyDigests.propertyId, propertyId), eq(dailyDigests.digestDate, date))).get();
  }
  upsertDailyDigest(data: InsertDailyDigest): DailyDigest {
    const existing = this.getDailyDigestByDate(data.propertyId, data.digestDate);
    if (existing) {
      return db.update(dailyDigests).set(data).where(eq(dailyDigests.id, existing.id)).returning().get()!;
    }
    return db.insert(dailyDigests).values(data).returning().get();
  }

  // ─── Property Notification Prefs ───────────────────────────────────────────
  updatePropertyNotificationPrefs(propertyId: number, prefs: Record<string, any>): Property | undefined {
    return db.update(properties).set({ notificationPreferences: JSON.stringify(prefs) } as any).where(eq(properties.id, propertyId)).returning().get();
  }

  // ─── Leads (contact form submissions) ──────────────────────────────────────
  createLead(data: InsertLead): Lead {
    return db.insert(leads).values(data).returning().get();
  }
  getLeads(): Lead[] {
    return db.select().from(leads).orderBy(desc(leads.createdAt)).all();
  }
  updateLeadStatus(id: number, status: string): Lead | undefined {
    return db.update(leads).set({ status }).where(eq(leads.id, id)).returning().get();
  }

  // ─── VENDOR WORK ORDERS ───────────────────────────────────────────────────
  getVendorWorkOrders(vendorId?: number): any[] {
    if (vendorId !== undefined) {
      return sqlite.prepare("SELECT * FROM vendor_work_orders WHERE vendor_id = ? ORDER BY created_at DESC").all(vendorId);
    }
    return sqlite.prepare("SELECT * FROM vendor_work_orders ORDER BY created_at DESC").all();
  }
  createVendorWorkOrder(data: any): any {
    const { title, description, propertyId, vendorId, assignedBy, status, priority, dueDate, createdAt } = data;
    return sqlite.prepare(
      "INSERT INTO vendor_work_orders (title, description, property_id, vendor_id, assigned_by, status, priority, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *"
    ).get(title, description ?? null, propertyId ?? null, vendorId ?? null, assignedBy ?? null, status ?? "pending", priority ?? "normal", dueDate ?? null, createdAt);
  }
  updateVendorWorkOrder(id: number, data: any): any {
    const fields: string[] = [];
    const vals: any[] = [];
    for (const [k, v] of Object.entries(data)) {
      const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${col} = ?`);
      vals.push(v);
    }
    if (!fields.length) return this.getVendorWorkOrders().find((r: any) => r.id === id);
    vals.push(id);
    return sqlite.prepare(`UPDATE vendor_work_orders SET ${fields.join(", ")} WHERE id = ? RETURNING *`).get(...vals);
  }

  // ─── VENDOR DOCUMENTS ─────────────────────────────────────────────────────
  getVendorDocuments(vendorId?: number): any[] {
    if (vendorId !== undefined) {
      return sqlite.prepare("SELECT * FROM vendor_documents WHERE vendor_id = ? ORDER BY created_at DESC").all(vendorId);
    }
    return sqlite.prepare("SELECT * FROM vendor_documents ORDER BY created_at DESC").all();
  }
  createVendorDocument(data: any): any {
    const { title, fileUrl, fileType, vendorId, propertyId, workOrderId, uploadedBy, uploadedAt, createdAt } = data;
    return sqlite.prepare(
      "INSERT INTO vendor_documents (title, file_url, file_type, vendor_id, property_id, work_order_id, uploaded_by, uploaded_at, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *"
    ).get(title, fileUrl ?? null, fileType ?? null, vendorId ?? null, propertyId ?? null, workOrderId ?? null, uploadedBy ?? null, uploadedAt, createdAt);
  }

  // ─── VENDOR MESSAGES ──────────────────────────────────────────────────────
  getVendorMessages(vendorId?: number): any[] {
    if (vendorId !== undefined) {
      return sqlite.prepare("SELECT * FROM vendor_messages WHERE vendor_id = ? OR to_user_id = ? ORDER BY sent_at DESC").all(vendorId, vendorId);
    }
    return sqlite.prepare("SELECT * FROM vendor_messages ORDER BY sent_at DESC").all();
  }
  createVendorMessage(data: any): any {
    const { vendorId, fromUserId, toUserId, subject, body, workOrderId, sentAt, readAt, createdAt } = data;
    return sqlite.prepare(
      "INSERT INTO vendor_messages (vendor_id, from_user_id, to_user_id, subject, body, work_order_id, sent_at, read_at, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *"
    ).get(vendorId ?? null, fromUserId ?? null, toUserId ?? null, subject ?? null, body, workOrderId ?? null, sentAt, readAt ?? null, createdAt);
  }
  markVendorMessageRead(id: number): any {
    return sqlite.prepare("UPDATE vendor_messages SET read_at = ? WHERE id = ? RETURNING *").get(new Date().toISOString(), id);
  }

  // Phase 2: upload document (base64 data url)
  uploadVendorDocument(id: number, fileData: string, fileName: string, fileType: string, uploadedBy: number): any {
    const now = new Date().toISOString();
    return sqlite.prepare(
      "UPDATE vendor_documents SET file_data = ?, file_url = ?, file_type = ?, uploaded_by = ?, uploaded_at = ?, status = 'submitted' WHERE id = ? RETURNING *"
    ).get(fileData, fileName, fileType, uploadedBy, now, id);
  }

  // Phase 2: admin review document
  reviewVendorDocument(id: number, status: string, reviewNotes?: string): any {
    return sqlite.prepare(
      "UPDATE vendor_documents SET status = ?, review_notes = ? WHERE id = ? RETURNING *"
    ).get(status, reviewNotes ?? null, id);
  }

  // Phase 2: calendar events CRUD
  getCalendarEvents(): any[] {
    return sqlite.prepare("SELECT * FROM calendar_events ORDER BY date ASC, time ASC").all();
  }

  createCalendarEvent(data: any): any {
    const { title, type, date, time, endDate, propertyId, workOrderId, createdBy, status, notes, createdAt } = data;
    return sqlite.prepare(
      "INSERT INTO calendar_events (title,type,date,time,end_date,property_id,work_order_id,created_by,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *"
    ).get(title, type ?? "custom", date, time ?? null, endDate ?? null, propertyId ?? null, workOrderId ?? null, createdBy ?? null, status ?? "active", notes ?? null, createdAt);
  }

  updateCalendarEvent(id: number, data: any): any {
    const fields: string[] = [];
    const vals: any[] = [];
    const allowed = ["title","type","date","time","status","notes","property_id","work_order_id"];
    for (const k of allowed) {
      const camel = k.replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
      const val = (data as any)[camel] ?? (data as any)[k];
      if (val !== undefined) { fields.push(`${k} = ?`); vals.push(val); }
    }
    if (!fields.length) return null;
    vals.push(id);
    return sqlite.prepare(`UPDATE calendar_events SET ${fields.join(", ")} WHERE id = ? RETURNING *`).get(...vals);
  }

  deleteCalendarEvent(id: number): any {
    return sqlite.prepare("DELETE FROM calendar_events WHERE id = ? RETURNING *").get(id);
  }

  // ─── VISIT REPORTS (Photo Report tied to scheduled visit completion) ─────────
  getVisitReport(scheduledVisitId: number): any {
    const report = sqlite.prepare("SELECT * FROM visit_reports WHERE scheduled_visit_id = ? ORDER BY id DESC LIMIT 1").get(scheduledVisitId) as any;
    if (!report) return null;
    const photos = sqlite.prepare("SELECT id, report_id, filename, data_url, caption, item_key, uploaded_at FROM visit_report_photos WHERE report_id = ? ORDER BY id ASC").all(report.id) as any[];
    // Parse checklist_data JSON
    if (report.checklist_data) {
      try { report.checklist_data = JSON.parse(report.checklist_data); } catch {}
    }
    return { ...report, photos };
  }

  getVisitReportById(reportId: number): any {
    const report = sqlite.prepare("SELECT * FROM visit_reports WHERE id = ?").get(reportId) as any;
    if (!report) return null;
    const photos = sqlite.prepare("SELECT id, report_id, filename, data_url, caption, item_key, uploaded_at FROM visit_report_photos WHERE report_id = ? ORDER BY id ASC").all(report.id) as any[];
    if (report.checklist_data) {
      try { report.checklist_data = JSON.parse(report.checklist_data); } catch {}
    }
    return { ...report, photos };
  }

  createVisitReport(data: {
    scheduledVisitId: number;
    propertyId: number;
    techId: number;
    note?: string;
    overallStatus?: string;
    checklistData?: Record<string, any>; // { "exterior.roof_damage": { status: "ok"|"attention"|"issue", note: string }, ... }
    photos: { filename: string; dataUrl: string; caption?: string; itemKey?: string }[];
  }): any {
    const now = new Date().toISOString();
    const checklistJson = data.checklistData ? JSON.stringify(data.checklistData) : null;
    const report = sqlite.prepare(
      "INSERT INTO visit_reports (scheduled_visit_id, property_id, tech_id, note, overall_status, checklist_data, completed_at, created_at) VALUES (?,?,?,?,?,?,?,?) RETURNING *"
    ).get(data.scheduledVisitId, data.propertyId, data.techId, data.note ?? null, data.overallStatus ?? "all_clear", checklistJson, now, now) as any;

    const savedPhotos: any[] = [];
    for (const photo of (data.photos ?? [])) {
      const saved = sqlite.prepare(
        "INSERT INTO visit_report_photos (report_id, filename, data_url, caption, item_key, uploaded_at) VALUES (?,?,?,?,?,?) RETURNING *"
      ).get(report.id, photo.filename, photo.dataUrl, photo.caption ?? null, photo.itemKey ?? null, now) as any;
      savedPhotos.push(saved);
    }

    // Mark the scheduled visit as completed
    sqlite.prepare("UPDATE scheduled_visits SET completed = 1, visit_id = ? WHERE id = ?").run(report.id, data.scheduledVisitId);

    return { ...report, photos: savedPhotos };
  }

  getAllVisitReports(): any[] {
    const reports = sqlite.prepare("SELECT * FROM visit_reports ORDER BY completed_at DESC").all() as any[];
    return reports.map(r => {
      const photos = sqlite.prepare("SELECT id, report_id, filename, data_url, caption, item_key, uploaded_at FROM visit_report_photos WHERE report_id = ?").all(r.id) as any[];
      let checklistData = r.checklist_data;
      if (checklistData) { try { checklistData = JSON.parse(checklistData); } catch {} }
      return { ...r, checklist_data: checklistData, photos };
    });
  }
}

export const storage = new Storage();
