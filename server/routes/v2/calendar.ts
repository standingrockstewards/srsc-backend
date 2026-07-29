/**
 * server/routes/v2/calendar.ts  (Brick 10g)
 *
 * GET /api/v2/calendar?from=&to=
 *
 * Returns a merged, role-scoped feed of calendar events tagged by `kind` so
 * the UI can color-code them:
 *
 *   kind: "past_visit"      — scheduled_visits with status = completed/missed, scheduledAt <= now
 *   kind: "upcoming_visit"  — scheduled_visits with status = scheduled/canceled, scheduledAt > now
 *   kind: "storm_event"     — monitoring_events with severity = 'high' | 'critical' | 'severe'
 *   kind: "follow_up"       — scheduled_visits where followUpOf IS NOT NULL (overlay on kind above)
 *
 * Role scoping:
 *   admin / supervisor  — full feed across all properties
 *   field_tech          — scoped to their assigned_tech_id
 *   vendor / client     — 403
 *
 * Query params:
 *   from  ISO 8601 datetime (required)
 *   to    ISO 8601 datetime (required)
 *
 * Empty date range renders cleanly — returns [] with 200.
 */

import { Router, type Request, type Response } from "express";
import { and, gte, lte, eq } from "drizzle-orm";
import { db } from "../../db";
import { scheduledVisits, monitoringEvents } from "../../../shared/schema-v2";
import { requireAuthV2 } from "../../middleware/authV2";

const router = Router();
router.use(requireAuthV2);

// Storm severity values that qualify as calendar events
const STORM_SEVERITIES = new Set(["high", "critical", "severe", "warning"]);

// ── GET /api/v2/calendar ──────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const role   = req.v2Role ?? "";
  const userId = req.v2UserId;

  // Vendor/client blocked
  if (role === "vendor" || role === "client") {
    return res.status(403).json({ error: "Access denied." });
  }

  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    return res.status(400).json({ error: "from and to query params are required (ISO 8601)." });
  }

  const fromDate = new Date(from);
  const toDate   = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: "from and to must be valid ISO 8601 datetimes." });
  }

  // Empty range — return immediately
  if (toDate < fromDate) {
    return res.json([]);
  }

  const isAdminOrSup = role === "admin" || role === "supervisor";
  const now = new Date();

  // ── 1. Fetch scheduled_visits in range ──────────────────────────────────────
  const visitConditions = [
    gte(scheduledVisits.scheduledAt, fromDate),
    lte(scheduledVisits.scheduledAt, toDate),
  ];
  if (!isAdminOrSup) {
    // field_tech: scope to own assignments
    visitConditions.push(eq(scheduledVisits.assignedTechId, String(userId)));
  }

  const visits = await db
    .select()
    .from(scheduledVisits)
    .where(and(...visitConditions));

  // ── 2. Fetch monitoring_events (storm events) in range ────────────────────
  // Only admin/supervisor see storm events on the calendar (field_tech sees
  // their own work, not raw storm data)
  let stormEvents: Array<typeof monitoringEvents.$inferSelect> = [];
  if (isAdminOrSup) {
    stormEvents = await db
      .select()
      .from(monitoringEvents)
      .where(
        and(
          gte(monitoringEvents.visitAt, fromDate),
          lte(monitoringEvents.visitAt, toDate),
        ),
      );
  }

  // ── 3. Shape output events ────────────────────────────────────────────────
  type CalendarEvent = {
    id:          string;
    kind:        "past_visit" | "upcoming_visit" | "storm_event" | "follow_up";
    title:       string;
    date:        string;          // ISO datetime
    propertyId:  string | null;
    assignedTechId?: string;
    status?:     string;
    visitType?:  string;
    followUpOf?: string | null;
    severity?:   string;
    notes?:      string | null;
  };

  const events: CalendarEvent[] = [];

  for (const v of visits) {
    // Determine base kind
    let kind: CalendarEvent["kind"];
    if (v.followUpOf) {
      kind = "follow_up";
    } else if (v.scheduledAt <= now && (v.status === "completed" || v.status === "missed")) {
      kind = "past_visit";
    } else {
      kind = "upcoming_visit";
    }

    const label = (v.visitType ?? "visit").replace(/_/g, " ");

    events.push({
      id:            v.id,
      kind,
      title:         label.replace(/\b\w/g, (c) => c.toUpperCase()),
      date:          v.scheduledAt.toISOString(),
      propertyId:    v.propertyId,
      assignedTechId: v.assignedTechId,
      status:        v.status,
      visitType:     v.visitType ?? undefined,
      followUpOf:    v.followUpOf,
      notes:         v.notes,
    });
  }

  for (const e of stormEvents) {
    if (!STORM_SEVERITIES.has(e.severity)) continue;

    events.push({
      id:         e.id,
      kind:       "storm_event",
      title:      `Storm Event — ${e.severity.charAt(0).toUpperCase() + e.severity.slice(1)}`,
      date:       e.visitAt.toISOString(),
      propertyId: e.propertyId,
      severity:   e.severity,
      notes:      e.note,
    });
  }

  // Sort by date ascending
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return res.json(events);
});

export default router;
