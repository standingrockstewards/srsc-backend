-- Brick 10R: properties additive schema-drift migration
-- Adds the 7 columns the Drizzle propertiesV2 model expects but the live DB
-- is missing, causing HTTP 500 on any endpoint that calls propertiesRepo.
--
-- RULES:
--   • ADD COLUMN IF NOT EXISTS only — zero risk of data loss or re-run failure.
--   • No DROP, no RENAME, no type changes to existing columns.
--   • Existing 5 demo rows (prop_01..prop_05) remain fully valid after migration.
--   • Re-running this file is a no-op (IF NOT EXISTS guard on every statement).
--
-- Column spec (from shared/schema-v2.ts propertiesV2, verified 2026-07-29):
--
--   nickname      varchar(255)  NOT NULL  — model: .notNull(), no default
--                                           migration default: '' (empty str, keeps NOT NULL)
--   city          varchar(100)  NULL      — model: nullable, no default
--   state         varchar(2)    NULL      — model: nullable, .default("OK")
--   zip           varchar(10)   NULL      — model: nullable, no default
--   service_tier  varchar(50)   NULL      — model: nullable, no default
--   active        boolean       NOT NULL  — model: .notNull().default(true)
--   updated_at    timestamptz   NOT NULL  — model: .notNull().defaultNow()
--                                           using timestamptz to match live created_at convention
--
-- Run: psql $DATABASE_URL -f server/migrations/10R_properties_add_missing_cols.sql

BEGIN;

-- 1. nickname VARCHAR(255) NOT NULL — default '' makes all existing rows valid immediately
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(255) NOT NULL DEFAULT '';

-- 2. city VARCHAR(100) NULL
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- 3. state VARCHAR(2) NULL, default 'OK' (matches Drizzle model .default("OK"))
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS state VARCHAR(2) DEFAULT 'OK';

-- 4. zip VARCHAR(10) NULL
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS zip VARCHAR(10);

-- 5. service_tier VARCHAR(50) NULL
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS service_tier VARCHAR(50);

-- 6. active BOOLEAN NOT NULL DEFAULT true — all existing rows become active=true
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- 7. updated_at TIMESTAMPTZ NOT NULL DEFAULT now() — existing rows get current timestamp
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMIT;

-- Verify: confirm all 7 new columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'properties'
  AND column_name IN ('nickname','city','state','zip','service_tier','active','updated_at')
ORDER BY column_name;
