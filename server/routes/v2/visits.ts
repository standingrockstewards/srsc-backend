/**
 * server/routes/v2/visits.ts  (Brick 10g)
 *
 * Scheduled visit management API.
 *
 * Role scoping:
 *   admin / supervisor  — full CRUD, see all visits
 *   field_tech          — GET only, scoped to own assigned_tech_id
 *   vendor              — 403 on all routes
 *   client              — 403 on all routes (portal has no scheduling access)
 *
 * Routes:
 *   POST   /api/v2/visits           — create visit (admin/supervisor)
 *   PATCH  /api/v2/visits/:id       — update visit (admin/supervisor)
 *   GET    /api/v2/visits           — list (role-scoped)
 *   GET    /api/v2/visits/:id       — single (own tech or admin/supervisor)
 *
 * ID rules: all IDs are text (nanoid). Never parseInt.
 * updated_at is set application-side in the repository on every PATCH.
 */

import { Router, type Request, type Response } from "express";
import { scheduledVisitsRepo } from "../../repositories/scheduledVisits";
import { requireAuthV2 } from "../../middleware/authV2";
import { VISIT_TYPES_V2, VISIT_STATUSES } from "../../../shared/schema-v2";

const router = Router();

// All routes require authentication
router.use(requireAuthV2);

// ── Role guards ────────────────────────────────────────────────────────────────

function isAdminOrSupervisor(role: string) {
  return role === "admin" || role === "supervisor";
}

function requireAdminSupervisor(req: Request, res: Response): boolean {
  if (!isAdminOrSupervisor(req.v2Role ?? "")) {
    res.status(403).json({ error: "Admin or supervisor role required." });
    return false;
  }
  return true;
}

function requireNotVendorOrClient(req: Request, res: Response): boolean {
  const r = req.v2Role ?? "";
  if (r === "vendor" || r === "client") {
    res.status(403).json({ error: "Access denied." });
    return false;
  }
  return true;
}

// ── POST /api/v2/visits ────────────────────────────────────────────────────────
// Schedule + assign a tech. Admin/supervisor only.
router.post("/", async (req: Request, res: Response) => {
  if (!requireAdminSupervisor(req, res)) return;

  const { propertyId, assignedTechId, visitType, scheduledAt, notes, followUpOf } =
    req.body as Record<string, string | undefined>;

  if (!propertyId || !assignedTechId || !visitType || !scheduledAt) {
    return res.status(400).json({
      error: "propertyId, assignedTechId, visitType, scheduledAt are required.",
    });
  }

  if (!(VISIT_TYPES_V2 as readonly string[]).includes(visitType)) {
    return res.status(400).json({
      error: `visitType must be one of: ${VISIT_TYPES_V2.join(", ")}`,
    });
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ error: "scheduledAt must be a valid ISO 8601 datetime." });
  }

  try {
    const visit = await scheduledVisitsRepo.create({
      propertyId,
      assignedTechId,
      visitType,
      scheduledAt: scheduledDate,
      status:      "scheduled",
      notes:       notes ?? null,
      followUpOf:  followUpOf ?? null,
      createdBy:   String(req.v2UserId ?? "unknown"),
    });
    return res.status(201).json(visit);
  } catch (err: any) {
    if (err?.code === "23503") {
      return res.status(400).json({ error: "Invalid propertyId — property not found." });
    }
    return res.status(500).json({ error: "Failed to create visit." });
  }
});

// ── PATCH /api/v2/visits/:id ───────────────────────────────────────────────────
// Reschedule / reassign / change status. Admin/supervisor only.
// updated_at set application-side in repository.
router.patch("/:id", async (req: Request, res: Response) => {
  if (!requireAdminSupervisor(req, res)) return;

  const id = String(req.params["id"]);

  const existing = await scheduledVisitsRepo.getById(id);
  if (!existing) return res.status(404).json({ error: "Visit not found." });

  const {
    assignedTechId,
    visitType,
    scheduledAt,
    status,
    followUpOf,
    notes,
  } = req.body as Record<string, string | undefined>;

  // Validate enums if provided
  if (visitType && !(VISIT_TYPES_V2 as readonly string[]).includes(visitType)) {
    return res.status(400).json({
      error: `visitType must be one of: ${VISIT_TYPES_V2.join(", ")}`,
    });
  }
  if (status && !(VISIT_STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${VISIT_STATUSES.join(", ")}`,
    });
  }

  let scheduledDate: Date | undefined;
  if (scheduledAt) {
    scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: "scheduledAt must be a valid ISO 8601 datetime." });
    }
  }

  const patch: Parameters<typeof scheduledVisitsRepo.update>[1] = {};
  if (assignedTechId !== undefined) patch.assignedTechId = assignedTechId;
  if (visitType     !== undefined) patch.visitType      = visitType;
  if (scheduledDate !== undefined) patch.scheduledAt    = scheduledDate;
  if (status        !== undefined) patch.status         = status;
  if (followUpOf    !== undefined) patch.followUpOf     = followUpOf || null;
  if (notes         !== undefined) patch.notes          = notes || null;

  const updated = await scheduledVisitsRepo.update(id, patch);
  if (!updated) return res.status(404).json({ error: "Visit not found." });

  return res.json(updated);
});

// ── GET /api/v2/visits ─────────────────────────────────────────────────────────
// admin/supervisor → all visits
// field_tech       → own assignments only
// vendor/client    → 403
router.get("/", async (req: Request, res: Response) => {
  if (!requireNotVendorOrClient(req, res)) return;

  const role   = req.v2Role ?? "";
  const userId = req.v2UserId;

  if (isAdminOrSupervisor(role)) {
    const visits = await scheduledVisitsRepo.getAll();
    return res.json(visits);
  }

  // field_tech: scope to own ID (stored as string in assigned_tech_id)
  const visits = await scheduledVisitsRepo.getByTech(String(userId));
  return res.json(visits);
});

// ── GET /api/v2/visits/:id ─────────────────────────────────────────────────────
// admin/supervisor → any visit
// field_tech       → only if assigned to them
// vendor/client    → 403
router.get("/:id", async (req: Request, res: Response) => {
  if (!requireNotVendorOrClient(req, res)) return;

  const id   = String(req.params["id"]);
  const role = req.v2Role ?? "";
  const userId = req.v2UserId;

  const visit = await scheduledVisitsRepo.getById(id);
  if (!visit) return res.status(404).json({ error: "Visit not found." });

  if (!isAdminOrSupervisor(role)) {
    // field_tech: must be assigned to this visit
    if (visit.assignedTechId !== String(userId)) {
      return res.status(403).json({ error: "Access denied." });
    }
  }

  return res.json(visit);
});

export default router;
