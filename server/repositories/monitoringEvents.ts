import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { monitoringEvents, type InsertMonitoringEvent } from "../../shared/schema-v2";

const BLOCKED_PAYLOAD_KEYS = [
  "alarm_code", "alarmCode",
  "alarm_panel_location", "alarmPanelLocation",
  "access_notes", "accessNotes",
];

function payloadIsSafe(payloadStr: string | undefined | null): boolean {
  if (!payloadStr) return true;
  try {
    const obj = JSON.parse(payloadStr);
    return !BLOCKED_PAYLOAD_KEYS.some((k) => k in obj);
  } catch {
    return false;
  }
}

export const monitoringEventsRepo = {
  async create(data: InsertMonitoringEvent) {
    const [row] = await db.insert(monitoringEvents).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db.select().from(monitoringEvents).where(eq(monitoringEvents.id, id));
    return row ?? null;
  },

  async listByProperty(propertyId: string, limit = 100) {
    return db
      .select()
      .from(monitoringEvents)
      .where(eq(monitoringEvents.propertyId, propertyId))
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
