-- =============================================================================
-- Standing Rock Stewardship Co. — Schema Additions
-- File: schema-additions.sql
--
-- PURPOSE: Additive-only schema changes for the SRSC app.
-- Run this AFTER the initial schema migration has been applied.
-- All statements use IF NOT EXISTS / DO NOTHING guards where possible
-- to make this file safe to re-run.
--
-- Existing tables (already in production, DO NOT recreate):
--   users, properties, visits, visit_photos, vendor_dispatches,
--   recommendations, scheduled_visits, monitoring_devices, alert_events,
--   alert_notifications, monthly_monitoring_reports
--
-- What this file adds:
--   1. ALTER EXISTING TABLES  — new columns on properties, monitoring_devices
--   2. NEW TABLES             — escalation_log, daily_digests
--   3. ROW LEVEL SECURITY     — RLS enable + policies for new tables
--   4. INDEXES                — supporting indexes for common query patterns
--   5. pg_cron JOBS           — escalation processor, daily digest, offline detection
-- =============================================================================


-- =============================================================================
-- SECTION 1: ALTER EXISTING TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- properties: add account_manager_id and notification_preferences columns
-- ---------------------------------------------------------------------------
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES auth.users(id);

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "escalation_enabled": true,
    "emergency_threshold_minutes": 15,
    "high_threshold_minutes": 60,
    "account_manager_email": "",
    "global_alerts_cc": "alerts@standingrockstewards.com"
  }'::jsonb;

-- ---------------------------------------------------------------------------
-- monitoring_devices: add minut_device_id column (unique external device ID)
-- ---------------------------------------------------------------------------
ALTER TABLE monitoring_devices
  ADD COLUMN IF NOT EXISTS minut_device_id TEXT UNIQUE;


-- =============================================================================
-- SECTION 2: NEW TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- escalation_log
-- Tracks each escalation step triggered for an alert event.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escalation_log (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_event_id              UUID        NOT NULL REFERENCES alert_events(id),
  property_id                 UUID        NOT NULL REFERENCES properties(id),
  account_manager_id          UUID        REFERENCES auth.users(id),
  escalation_level            TEXT        NOT NULL
                                CHECK (escalation_level IN ('Initial', 'First Escalation', 'Second Escalation')),
  triggered_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_sent           BOOLEAN     NOT NULL DEFAULT FALSE,
  notification_sent_at        TIMESTAMPTZ,
  resolved_before_escalation  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE escalation_log IS
  'Records each escalation notification attempt for alert events, including level, timing, and resolution status.';

-- ---------------------------------------------------------------------------
-- daily_digests
-- One row per property per calendar date summarising device and alert state.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_digests (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID    NOT NULL REFERENCES properties(id),
  digest_date      DATE    NOT NULL,
  total_events     INTEGER NOT NULL DEFAULT 0,
  events_summary   JSONB,
  devices_online   INTEGER NOT NULL DEFAULT 0,
  devices_offline  INTEGER NOT NULL DEFAULT 0,
  active_alerts    INTEGER NOT NULL DEFAULT 0,
  resolved_alerts  INTEGER NOT NULL DEFAULT 0,
  system_status    TEXT    NOT NULL
                    CHECK (system_status IN ('All Clear', 'Items Flagged', 'Alert Active')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (property_id, digest_date)
);

COMMENT ON TABLE daily_digests IS
  'Daily rollup of device and alert activity per property, generated at 11:59 PM CST by the daily-digest cron job.';


-- =============================================================================
-- SECTION 3: ROW LEVEL SECURITY
-- =============================================================================

-- NOTE: Adjust role checks below to match your auth.users or profiles table
-- structure. Three variants are provided for each policy:
--   A) JWT claim  (IMPLEMENTED — active)
--   B) profiles table lookup  (commented out — alternative)
--   C) user_roles table lookup (commented out — alternative)
--
-- Activate only ONE variant per policy. Comment out / drop the others.

-- ---------------------------------------------------------------------------
-- 3a. escalation_log RLS
-- ---------------------------------------------------------------------------
ALTER TABLE escalation_log ENABLE ROW LEVEL SECURITY;

-- Admin: full SELECT / INSERT / UPDATE
-- Variant A — JWT claim (active)
CREATE POLICY "escalation_log_admin_all"
  ON escalation_log
  FOR ALL
  TO authenticated
  USING     ( auth.jwt() ->> 'role' = 'admin' )
  WITH CHECK( auth.jwt() ->> 'role' = 'admin' );

-- Variant B — profiles table
-- CREATE POLICY "escalation_log_admin_all"
--   ON escalation_log
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'admin'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'admin'
--     )
--   );

-- Variant C — user_roles table
-- CREATE POLICY "escalation_log_admin_all"
--   ON escalation_log
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'admin'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'admin'
--     )
--   );

-- Field Tech: SELECT only — rows for their assigned properties
-- Variant A — JWT claim (active)
CREATE POLICY "escalation_log_field_tech_select"
  ON escalation_log
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'field_tech'
    AND property_id IN (
      -- Replace with the actual join that maps a field tech to their properties,
      -- e.g. a property_assignments table or a properties.assigned_tech_id column.
      SELECT p.id FROM properties p
      WHERE p.account_manager_id = auth.uid()
    )
  );

-- Variant B — profiles table
-- CREATE POLICY "escalation_log_field_tech_select"
--   ON escalation_log
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'field_tech'
--     )
--     AND property_id IN (
--       SELECT p.id FROM properties p
--       WHERE p.account_manager_id = auth.uid()
--     )
--   );

-- Variant C — user_roles table
-- CREATE POLICY "escalation_log_field_tech_select"
--   ON escalation_log
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'field_tech'
--     )
--     AND property_id IN (
--       SELECT p.id FROM properties p
--       WHERE p.account_manager_id = auth.uid()
--     )
--   );

-- Client: no access to escalation_log (no policy = deny by default under RLS)
-- No additional policy required. Clients are blocked by the default-deny of RLS.


-- ---------------------------------------------------------------------------
-- 3b. daily_digests RLS
-- ---------------------------------------------------------------------------
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

-- Admin: full SELECT / INSERT / UPDATE
-- Variant A — JWT claim (active)
CREATE POLICY "daily_digests_admin_all"
  ON daily_digests
  FOR ALL
  TO authenticated
  USING     ( auth.jwt() ->> 'role' = 'admin' )
  WITH CHECK( auth.jwt() ->> 'role' = 'admin' );

-- Variant B — profiles table
-- CREATE POLICY "daily_digests_admin_all"
--   ON daily_digests
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'admin'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'admin'
--     )
--   );

-- Variant C — user_roles table
-- CREATE POLICY "daily_digests_admin_all"
--   ON daily_digests
--   FOR ALL
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'admin'
--     )
--   )
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'admin'
--     )
--   );

-- Field Tech: SELECT only — rows for their assigned properties
-- Variant A — JWT claim (active)
CREATE POLICY "daily_digests_field_tech_select"
  ON daily_digests
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'field_tech'
    AND property_id IN (
      SELECT p.id FROM properties p
      WHERE p.account_manager_id = auth.uid()
    )
  );

-- Variant B — profiles table
-- CREATE POLICY "daily_digests_field_tech_select"
--   ON daily_digests
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'field_tech'
--     )
--     AND property_id IN (
--       SELECT p.id FROM properties p
--       WHERE p.account_manager_id = auth.uid()
--     )
--   );

-- Variant C — user_roles table
-- CREATE POLICY "daily_digests_field_tech_select"
--   ON daily_digests
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'field_tech'
--     )
--     AND property_id IN (
--       SELECT p.id FROM properties p
--       WHERE p.account_manager_id = auth.uid()
--     )
--   );

-- Client: SELECT only — their own property's digests
-- Requires a way to map a client user to a property_id.
-- The example below assumes properties has an owner_id or client_user_id column;
-- adjust the join condition to match your schema.
--
-- Variant A — JWT claim (active)
CREATE POLICY "daily_digests_client_select"
  ON daily_digests
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'client'
    AND property_id IN (
      -- Adjust the join below to reflect how clients are linked to properties
      -- e.g. properties.owner_id, a client_properties join table, etc.
      SELECT p.id FROM properties p
      WHERE p.account_manager_id = auth.uid()   -- <-- replace with correct client→property link
    )
  );

-- Variant B — profiles table
-- CREATE POLICY "daily_digests_client_select"
--   ON daily_digests
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'client'
--     )
--     AND property_id IN (
--       SELECT p.id FROM properties p
--       WHERE p.account_manager_id = auth.uid()
--     )
--   );

-- Variant C — user_roles table
-- CREATE POLICY "daily_digests_client_select"
--   ON daily_digests
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_roles.user_id = auth.uid()
--         AND user_roles.role = 'client'
--     )
--     AND property_id IN (
--       SELECT p.id FROM properties p
--       WHERE p.account_manager_id = auth.uid()
--     )
--   );


-- =============================================================================
-- SECTION 4: INDEXES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- escalation_log indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_escalation_log_property_id
  ON escalation_log (property_id);

CREATE INDEX IF NOT EXISTS idx_escalation_log_alert_event_id
  ON escalation_log (alert_event_id);

CREATE INDEX IF NOT EXISTS idx_escalation_log_triggered_at
  ON escalation_log (triggered_at);

CREATE INDEX IF NOT EXISTS idx_escalation_log_notification_sent
  ON escalation_log (notification_sent);

-- ---------------------------------------------------------------------------
-- daily_digests indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_daily_digests_property_id
  ON daily_digests (property_id);

CREATE INDEX IF NOT EXISTS idx_daily_digests_digest_date
  ON daily_digests (digest_date);

-- Composite index supports the common per-property date-range query
-- (also covers the unique constraint, but kept explicit for query planner clarity)
CREATE INDEX IF NOT EXISTS idx_daily_digests_property_id_digest_date
  ON daily_digests (property_id, digest_date);


-- =============================================================================
-- SECTION 5: pg_cron JOBS
-- =============================================================================
--
-- IMPORTANT: Before running this section, replace every occurrence of:
--   [PROJECT_REF]     — your Supabase project reference ID
--   [SERVICE_ROLE_KEY] — your Supabase service role secret key
--
-- pg_cron and pg_net must be enabled on your Supabase project.
-- Enable via: Dashboard → Database → Extensions → pg_cron, pg_net
--
-- All cron times are in UTC.
-- ---------------------------------------------------------------------------

-- Escalation processor — every 5 minutes
-- Calls the process-escalations Edge Function to evaluate pending alerts
SELECT cron.schedule(
  'process-escalations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://[PROJECT_REF].supabase.co/functions/v1/process-escalations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

-- Daily digest generator — 11:59 PM CST (04:59 UTC)
-- Calls the generate-daily-digests Edge Function to create nightly rollups
SELECT cron.schedule(
  'daily-digest',
  '59 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://[PROJECT_REF].supabase.co/functions/v1/generate-daily-digests',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

-- Offline detection — every 15 minutes
-- Marks monitoring devices as Offline if their last_ping is more than 30 minutes ago.
-- Devices already in 'Offline' or 'Alert' status are skipped.
SELECT cron.schedule(
  'offline-detection',
  '*/15 * * * *',
  $$
  UPDATE monitoring_devices
  SET    status = 'Offline'
  WHERE  last_ping < NOW() - INTERVAL '30 minutes'
    AND  status NOT IN ('Offline', 'Alert')
  $$
);

-- =============================================================================
-- END OF SCHEMA ADDITIONS
-- =============================================================================
