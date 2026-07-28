/**
 * server/routes/v2/monitoringEvents.ts  (Brick 6 — rewritten)
 *
 * Mounted at /api/v2/events in v2/index.ts
 *
 * Provides admin-level event lookup and system-event ingestion.
 * Property-scoped visit routes (POST/GET /api/v2/properties/:propertyId/events)
 * live in properties.ts to keep the URL hierarchy consistent.
 *
 * Vendors receive 403 on all routes via requireNotVendor.
 */

import { Router } from "express";
import { monitoringService } from "../../services/monitoringService";
import {
  requireAdminOrSupervisor,
  requireNotVendor,
  requirePropertyOwnerOrAdmin,
} from "../../middleware/authV2";

const router = Router();

// GET /api/v2/events/:id — fetch a single event (owner-or-admin)
// Ownership: resolved by looking up the event's propertyId, then checking property ownership.
// Admin/supervisor bypass as usual. Vendors always 403.
router.get("/:id", requireNotVendor, async (req, res) => {
  const { id } = req.params;
  try {
    const event = await monitoringService.getEvent(id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Ownership check for non-admin roles
    if (req.v2Role !== "admin" && req.v2Role !== "supervisor") {
      // Dynamically verify the property belongs to this client
      const { propertiesRepo } = await import("../../repositories/properties");
      const property = await propertiesRepo.getById(event.propertyId);
      if (!property) return res.status(404).json({ error: "Property not found" });
      if (property.customerId !== req.v2CustomerId) {
        return res.status(403).json({ error: "Forbidden — you may only access your own events" });
      }
    }

    return res.json(event);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// POST /api/v2/events/system — admin-only system event ingest
// (Renamed from old POST / to avoid colliding with the /:id param route)
router.post("/system", requireAdminOrSupervisor, async (req, res) => {
  const { propertyId, source, severity, category, payload } = req.body;
  if (!propertyId || !source || !severity || !category) {
    return res.status(400).json({ error: "propertyId, source, severity, category required" });
  }
  try {
    return res.status(201).json(
      await monitoringService.ingestSystemEvent({ propertyId, source, severity, category, payload }),
    );
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// PATCH /api/v2/events/:id/acknowledge — admin/supervisor only
router.patch("/:id/acknowledge", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    return res.json(await monitoringService.acknowledge(id));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
