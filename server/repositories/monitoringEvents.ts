/**
 * server/repositories/monitoringEvents.ts  (Brick 6 — extended)
 *
 * Append-only event log for stewardship visits + system events.
 * All IDs (id, propertyId) are text (nanoid/cuid2).
 */

import { eq, desc, and, gte, lte, inArray, SQL } from "drizzle-orm";
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

/**
 * Options for listing events across multiple properties (account-level).
 * Brick 10U.
 */
export interface ListAllEventsOptions {
  /** The property IDs the caller is authorized to see. Pass [] to return nothing. */
  propertyIds: string[];
  /** Filter by exact severity ("info" | "warning" | "critical"). */
  severity?:   string;
  /** Filter to a single property id (must be in propertyIds; no-op if not). */
  propertyId?: string;
  /** Max rows returned. Default 100, cap 500. */
  limit?:      number;
  /** Row offset for pagination. Default 0. */
  offset?:     number;
}

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

  /**
   * List events across all authorized properties — newest-first.
   * Brick 10U: account-level feed.
   *
   * Auth scoping is enforced by the caller: pass only the property IDs the
   * authenticated user is permitted to see.  An empty propertyIds array short-
   * circuits to an empty result immediately (no DB query issued).
   *
   * Filters applied in SQL:
   *   - IN (propertyIds)              always applied
   *   - WHERE severity = ?            if opts.severity supplied
   *   - WHERE property_id = ?         if opts.propertyId supplied (intersected with IN)
   * Pagination: LIMIT (default 100, cap 500) + OFFSET (default 0).
   */
  async listAll(opts: ListAllEventsOptions) {
    const {
      propertyIds,
      severity,
      propertyId,
      limit  = 100,
      offset = 0,
    } = opts;

    // Short-circuit: caller has no authorized properties
    if (propertyIds.length === 0) return [];

    const cappedLimit = Math.min(limit, 500);

    const conditions: SQL[] = [
      inArray(monitoringEvents.propertyId, propertyIds),
    ];

    if (severity) {
      conditions.push(eq(monitoringEvents.severity, severity));
    }

    // If a specific propertyId filter is requested AND it is within the
    // authorized set, narrow to it.  If it is NOT in the authorized set,
    // we intentionally return empty (no 403 — the IN clause already filters).
    if (propertyId) {
      conditions.push(eq(monitoringEvents.propertyId, propertyId));
    }

    return db
      .select()
      .from(monitoringEvents)
      .where(and(...conditions))
      .orderBy(desc(monitoringEvents.createdAt))
      .limit(cappedLimit)
      .offset(offset);
  },

  payloadIsSafe,
};
