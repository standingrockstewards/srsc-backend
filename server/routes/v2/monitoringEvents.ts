import { Router } from "express";
import { monitoringEventsRepo } from "../../repositories/monitoringEvents";
import { insertMonitoringEventSchema } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requirePropertyOwnerOrAdmin,
} from "../../middleware/authV2";

const router = Router();

// GET /api/v2/monitoring-events?propertyId=<text-id>
router.get("/", requireAdminOrSupervisor, async (req, res) => {
  const { propertyId } = req.query;
  if (!propertyId) return res.status(400).json({ error: "propertyId required" });
  try {
    return res.json(await monitoringEventsRepo.listByProperty(propertyId as string));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/monitoring-events/:id
router.get("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await monitoringEventsRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Event not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/monitoring-events — ingest an event
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertMonitoringEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!monitoringEventsRepo.payloadIsSafe(parsed.data.payload ?? null)) {
    return res.status(400).json({ error: "Payload contains blocked keys" });
  }
  try {
    return res.status(201).json(await monitoringEventsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/monitoring-events/:id/acknowledge
router.patch("/:id/acknowledge", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await monitoringEventsRepo.acknowledge(id);
    if (!row) return res.status(404).json({ error: "Event not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
