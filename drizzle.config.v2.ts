/**
 * drizzle.config.v2.ts — Postgres config for v2 schema migrations.
 *
 * Usage (Render Shell only — DATABASE_URL must be set in Render's environment):
 *   npx drizzle-kit push --config drizzle.config.v2.ts
 *
 * This config is intentionally separate from drizzle.config.ts (SQLite/v1).
 * Do NOT run this locally — DATABASE_URL lives on Render, not in this repo.
 * The locked `db:push` npm script remains pointed at SQLite and is unchanged.
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations-v2",
  schema: "./shared/schema-v2.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
