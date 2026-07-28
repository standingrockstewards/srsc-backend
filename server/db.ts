/**
 * server/db.ts — v2 Postgres connection
 * Uses pg Pool + drizzle-orm/node-postgres, SSL required for Render.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema-v2";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "[db] DATABASE_URL is not set. " +
    "Add it as an environment variable (Render dashboard → Environment)."
  );
}

export const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] unexpected pool error", err);
});

export const db = drizzle(pool, { schema });

/** Verify connectivity — used by /api/v2/health */
export async function checkDbConnection(): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}
