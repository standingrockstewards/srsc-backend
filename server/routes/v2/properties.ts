import { Router } from "express";
import { propertiesRepo } from "../../repositories/properties";
import { retainerService } from "../../services/retainerService";
import { monitoringService, VISIT_TYPES, SEVERITIES } from "../../services/monitoringService";
import { insertPropertyV2Schema } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requireNotVendor,
  requirePropertyOwnerOrAdmin,
} from "../../middleware/authV2";

const router = Router();
const patchSchema = insertPropertyV2Schema.partial();

// GET /api/v2/properties
router.get("/", requireNotVendor, async (req, res) => {
  try {
    if (req.v2Role === "admin" || req.v2Role === "supervisor") {
      const { customerId } = req.query;
      const rows = customerId
        ? await propertiesRepo.listByCustomer(customerId as string)
        : await propertiesRepo.getAll();
      return res.json(rows);
    }
    if (!req.v2CustomerId) {
      return res.status(403).json({ error: "No customer record linked to your account" });
    }
    return res.json(await propertiesRepo.listByCustomer(req.v2CustomerId));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/properties/:id
router.get("/:id", requirePropertyOwnerOrAdmin("id"), async (req, res) => {
  const { id } = req.params;
  try {
    const row = await propertiesRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Property not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/properties
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertPropertyV2Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await propertiesRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/properties/:id
router.patch("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await propertiesRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Property not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v2/properties/:id
router.delete("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    await propertiesRepo.delete(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/properties/:id/retainer — kept for backward compat; Brick 5 adds /retainer router
router.post("/:id/retainer", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    const property = await propertiesRepo.getById(id);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const { type, amount, note } = req.body;
    const entry = type === "topup"
      ? await retainerService.topup(id, amount, note)
      : await retainerService.charge(id, amount, note);
    return res.status(201).json({ entry, currentBalance: (entry as any).balanceAfter ?? (entry as any).entry?.balanceAfter });
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/properties/:id/retainer
router.get("/:id/retainer", requirePropertyOwnerOrAdmin("id"), async (req, res) => {
  const { id } = req.params;
  try {
    const property = await propertiesRepo.getById(id);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const [ledger, currentBalance] = await Promise.all([
      retainerService.ledger(id),
      retainerService.currentBalance(id),
    ]);
    return res.json({ propertyId: id, currentBalance, ledger });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Brick 6 — Stewardship visit / monitoring event routes ────────────────────

// POST /api/v2/properties/:propertyId/events — log a visit (owner-or-admin; vendors 403)
router.post("/:propertyId/events", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  const {
    visitType,
    severity,
    note,
    latitude,
    longitude,
    visitAt,
    payload,
    goodSamaritan,
  } = req.body;

  if (!visitType) {
    return res.status(400).json({ error: `visitType required. Allowed: ${VISIT_TYPES.join(", ")}` });
  }

  try {
    const event = await monitoringService.logVisit({
      propertyId,
      visitType,
      severity,
      note,
      latitude:      latitude      != null ? Number(latitude)      : null,
      longitude:     longitude     != null ? Number(longitude)     : null,
      visitAt,
      payload,
      goodSamaritan: goodSamaritan === true || goodSamaritan === "true",
    });
    return res.status(201).json(event);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/properties/:propertyId/events — list with ?from=&to=&type= (owner-or-admin; vendors 403)
router.get("/:propertyId/events", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  const { from, to, type: visitType, limit } = req.query;

  try {
    const events = await monitoringService.listForProperty(propertyId, {
      from:      from      as string | undefined,
      to:        to        as string | undefined,
      visitType: visitType as string | undefined,
      limit:     limit     ? Number(limit) : undefined,
    });
    return res.json(events);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
