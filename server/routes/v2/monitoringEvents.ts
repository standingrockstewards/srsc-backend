import { Router } from "express";
import { z } from "zod";
import { monitoringEventsRepo } from "../../repositories/monitoringEvents";
import { insertMonitoringEventSchema } from "../../../shared/schema-v2";

const router = Router();

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
    return false; // reject unparseable JSON
  }
}

// GET /api/v2/monitoring-events?propertyId=N[&limit=N]
router.get("/", async (req, res) => {
  const { propertyId, limit } = req.query;
  if (!propertyId) return res.status(400).json({ error: "propertyId query param required" });
  const pid = parseInt(propertyId as string);
  if (isNaN(pid)) return res.status(400).json({ error: "Invalid propertyId" });
  const lim = limit ? Math.min(parseInt(limit as string) || 100, 500) : 100;
  try {
    return res.json(await monitoringEventsRepo.listByProperty(pid, lim));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/monitoring-events/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await monitoringEventsRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Event not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/monitoring-events — append-only
router.post("/", async (req, res) => {
  const parsed = insertMonitoringEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!payloadIsSafe(parsed.data.payload ?? null)) {
    return res.status(400).json({
      error: "payload contains prohibited high-sensitivity fields (alarm codes, access notes)",
    });
  }

  try {
    return res.status(201).json(await monitoringEventsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/monitoring-events/:id/acknowledge — only allowed mutation
router.post("/:id/acknowledge", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await monitoringEventsRepo.acknowledge(id);
    if (!row) return res.status(404).json({ error: "Event not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
