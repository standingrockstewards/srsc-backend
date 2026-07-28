import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { monitoringEvents, type InsertMonitoringEvent } from "../../shared/schema-v2";

export const monitoringEventsRepo = {
  /**
   * Append-only: historical rows are never updated or deleted.
   * Caller is responsible for sanitising payload — alarm codes,
   * alarm_panel_location, and access_notes must NOT appear in payload.
   */
  async create(data: InsertMonitoringEvent) {
    const [row] = await db.insert(monitoringEvents).values(data).returning();
    return row;
  },

  async getById(id: number) {
    const [row] = await db.select().from(monitoringEvents).where(eq(monitoringEvents.id, id));
    return row ?? null;
  },

  /** Newest-first list for a property */
  async listByProperty(propertyId: number, limit = 100) {
    return db
      .select()
      .from(monitoringEvents)
      .where(eq(monitoringEvents.propertyId, propertyId))
      .orderBy(desc(monitoringEvents.createdAt))
      .limit(limit);
  },

  /**
   * Acknowledge an event — this is the ONLY mutation allowed on historical rows.
   * Sets acknowledgedAt to now. Cannot be un-acknowledged (append-only principle).
   */
  async acknowledge(id: number) {
    const [row] = await db
      .update(monitoringEvents)
      .set({ acknowledgedAt: new Date() })
      .where(eq(monitoringEvents.id, id))
      .returning();
    return row ?? null;
  },
};
