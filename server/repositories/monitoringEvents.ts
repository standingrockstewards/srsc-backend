/**
 * server/repositories/monitoringEvents.ts  (Brick 6 — extended)
 *
 * Append-only event log for stewardship visits + system events.
 * All IDs (id, propertyId) are text (nanoid/cuid2).
 */

import { eq, desc, and, gte, lte, SQL } from "drizzle-orm";
import { db } from "../db";
import { monitoringEvents, type InsertMonitoringEvent } from "../../shared/schema-v2";

// ── Payload safety ─────────────────────────────────────────────────────────────
// Keys that must never appear in a stored payload — they reveal security details.
const BLOCKED_PAYLOAD_KEYS = [
  "alarm_code",          "alarmCode",
  "alarm_panel_location","alarmPanelLocation",
  "access_notes",        "accessNotes",
];

function payloadIsSafe(payloadStr: string | undefined | null): boolean {
  if (!payloadStr) return true;
  try {
    const obj = JSON.parse(payloadStr);
    return !BLOCKED_PAYLOAD_KEYS.some((k) => k in obj);
  } catch {
    return false; // unparseable JSON → reject
  }
}

// ── Filter options ─────────────────────────────────────────────────────────────
export interface ListEventsOptions {
  from?:      string;   // ISO date/datetime — inclusive lower bound on created_at
  to?:        string;   // ISO date/datetime — inclusive upper bound on created_at
  visitType?: string;   // filter on visit_type column (exact match)
  limit?:     number;   // max rows (default 200)
}

// ── Repository ─────────────────────────────────────────────────────────────────
export const monitoringEventsRepo = {
  async create(data: InsertMonitoringEvent) {
    const [row] = await db.insert(monitoringEvents).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(monitoringEvents)
      .where(eq(monitoringEvents.id, id));
    return row ?? null;
  },

  /**
   * List events for a property — newest-first.
   * Supports optional date-range (from/to on createdAt) and visitType filter.
   */
  async listByProperty(propertyId: string, opts: ListEventsOptions = {}) {
    const { from, to, visitType, limit = 200 } = opts;

    const conditions: SQL[] = [eq(monitoringEvents.propertyId, propertyId)];

    if (from) {
      conditions.push(gte(monitoringEvents.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(monitoringEvents.createdAt, new Date(to)));
    }
    if (visitType) {
      conditions.push(eq(monitoringEvents.visitType, visitType));
    }

    return db
      .select()
      .from(monitoringEvents)
      .where(and(...conditions))
      .orderBy(desc(monitoringEvents.createdAt))
      .limit(limit);
  },

  async acknowledge(id: string) {
    const [row] = await db
      .update(monitoringEvents)
      .set({ acknowledgedAt: new Date() })
      .where(eq(monitoringEvents.id, id))
      .returning();
    return row ?? null;
  },

  payloadIsSafe,
};
