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

// GET /api/v2/events — account-level list (Brick 10U)
// Must be registered BEFORE /:id to prevent "events" being swallowed as an :id param.
//
// Auth scoping:
//   admin / supervisor  → events for ALL properties
//   client              → events for properties owned by their customer record only
//   field_tech          → events for ALL properties (no customer FK; same as staff)
//   vendor              → 403 (requireNotVendor blocks before handler)
//
// Query params:
//   ?severity=info|warning|critical   exact match, applied in SQL WHERE clause
//   ?property_id=<id>                 narrow to one property (must be in caller scope)
//   ?limit=<n>                        default 100, max 500
//   ?offset=<n>                       default 0 (for pagination)
router.get("/", requireNotVendor, async (req, res) => {
  const { severity, property_id, limit, offset } = req.query;

  const limitNum  = limit  ? Math.min(Number(String(limit)),  500) : 100;
  const offsetNum = offset ? Number(String(offset)) : 0;

  if (isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: "limit must be a positive integer (max 500)" });
  }
  if (isNaN(offsetNum) || offsetNum < 0) {
    return res.status(400).json({ error: "offset must be a non-negative integer" });
  }

  try {
    const events = await monitoringService.listForCaller(
      req.v2Role     ?? "",
      req.v2CustomerId ?? null,
      {
        severity:   severity    ? String(severity)    : undefined,
        propertyId: property_id ? String(property_id) : undefined,
        limit:      limitNum,
        offset:     offsetNum,
      },
    );
    return res.json(events);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

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
