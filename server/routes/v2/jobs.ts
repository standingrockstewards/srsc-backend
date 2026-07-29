/**
 * server/routes/v2/jobs.ts  (Brick 8)
 *
 * Stewardship jobs CRUD + status/assignment management.
 *
 * Authorization matrix:
 *   Admin/Supervisor  — full access: list all, create, assign, transition any status
 *   field_tech        — read + update jobs assigned to them only
 *   client            — read their own property's jobs (owner-or-admin guard on propertyId)
 *   vendor            — 403 on all routes UNLESS assigned to the job
 *   (vendor-assigned  — GET /:id only, via inline ownership check)
 *
 * All IDs are text. No parseInt anywhere.
 */

import { Router } from "express";
import { stewardshipJobsRepo } from "../../repositories/stewardshipJobs";
import { insertStewardshipJobSchema, JOB_STATUSES, JOB_PRIORITIES } from "../../../shared/schema-v2";
import type { JobStatus } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requireNotVendor,
  requirePropertyOwnerOrAdmin,
} from "../../middleware/authV2";

const router = Router();

// ── Status transition guard ────────────────────────────────────────────────────
const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending:     ["scheduled", "dispatched", "cancelled"],
  scheduled:   ["dispatched", "cancelled"],
  dispatched:  ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed:   [],
  cancelled:   [],
};

function isValidTransition(from: string, to: JobStatus): boolean {
  return (ALLOWED_TRANSITIONS[from as JobStatus] ?? []).includes(to);
}

// ── GET /api/v2/jobs ──────────────────────────────────────────────────────────
// Admin/Supervisor: full list with optional filters.
// field_tech: jobs assigned to them.
// client: use GET /api/v2/properties/:propertyId/jobs (not this route).
// vendor: 403.
router.get("/", requireNotVendor, async (req, res) => {
  const { propertyId, status, assignedTo, from, to, limit } = req.query;

  // field_tech: scope to their own assigned jobs
  if (req.v2Role === "field_tech") {
    if (!req.v2UserId) return res.status(401).json({ error: "User identity missing" });
    // assignedTo for field_tech is their v1 user ID as string
    const ftId = String(req.v2UserId);
    try {
      return res.json(await stewardshipJobsRepo.list({
        assignedTo: ftId,
        status:     status as JobStatus | undefined,
        limit:      limit ? Number(limit) : undefined,
      }));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // client: must use property-scoped route
  if (req.v2Role === "client") {
    return res.status(403).json({ error: "Clients must use GET /api/v2/properties/:propertyId/jobs" });
  }

  // admin/supervisor: full filter
  if (req.v2Role !== "admin" && req.v2Role !== "supervisor") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    return res.json(await stewardshipJobsRepo.list({
      propertyId:  propertyId  as string | undefined,
      status:      status      as JobStatus | undefined,
      assignedTo:  assignedTo  as string | undefined,
      from:        from        as string | undefined,
      to:          to          as string | undefined,
      limit:       limit       ? Number(limit) : undefined,
    }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v2/jobs/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const job = await stewardshipJobsRepo.getById(id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Admin/supervisor: full access
    if (req.v2Role === "admin" || req.v2Role === "supervisor") {
      return res.json(job);
    }

    // field_tech: only if assigned to them
    if (req.v2Role === "field_tech") {
      if (job.assignedTo !== String(req.v2UserId)) {
        return res.status(403).json({ error: "Forbidden — not assigned to you" });
      }
      return res.json(job);
    }

    // vendor: only if assigned to them (rare edge case — vendor as assignee)
    if (req.v2Role === "vendor") {
      if (job.assignedTo !== String(req.v2UserId)) {
        return res.status(403).json({ error: "Forbidden — vendors may not access jobs they are not assigned to" });
      }
      return res.json(job);
    }

    // client: only if their property
    if (req.v2Role === "client") {
      const { propertiesRepo } = await import("../../repositories/properties");
      const property = await propertiesRepo.getById(job.propertyId);
      if (!property || property.customerId !== req.v2CustomerId) {
        return res.status(403).json({ error: "Forbidden — not your property" });
      }
      return res.json(job);
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── POST /api/v2/jobs — manual job creation ───────────────────────────────────
// Admin/Supervisor only. Clients/field_tech cannot create jobs directly.
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertStewardshipJobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await stewardshipJobsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── PATCH /api/v2/jobs/:id/assign ─────────────────────────────────────────────
// Admin/Supervisor only. Sets assignedTo + assignedToType.
router.patch("/:id/assign", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const { assignedTo, assignedToType } = req.body;
  if (!assignedTo || !assignedToType) {
    return res.status(400).json({ error: "assignedTo and assignedToType required" });
  }
  try {
    const job = await stewardshipJobsRepo.getById(id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const updated = await stewardshipJobsRepo.assign(id, assignedTo, assignedToType);
    return res.json(updated);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── PATCH /api/v2/jobs/:id/status ─────────────────────────────────────────────
// Admin/Supervisor: any transition.
// field_tech: may transition dispatched→in_progress and in_progress→completed on their own jobs.
// All others: 403.
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, notes, metadata } = req.body;

  if (!status) return res.status(400).json({ error: "status required" });
  if (!JOB_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${JOB_STATUSES.join(", ")}` });
  }

  try {
    const job = await stewardshipJobsRepo.getById(id);
    if (!job) return res.status(404).json({ error: "Job not found" });

    if (req.v2Role === "admin" || req.v2Role === "supervisor") {
      // Admin: validate transition but allow all
      if (!isValidTransition(job.status, status as JobStatus)) {
        return res.status(409).json({
          error: `Invalid transition ${job.status} → ${status}. Allowed: [${ALLOWED_TRANSITIONS[job.status as JobStatus]?.join(", ")}]`,
        });
      }
    } else if (req.v2Role === "field_tech") {
      // field_tech: only their own jobs, only dispatched→in_progress or in_progress→completed
      if (job.assignedTo !== String(req.v2UserId)) {
        return res.status(403).json({ error: "Forbidden — not assigned to you" });
      }
      const allowed: JobStatus[] = ["in_progress", "completed"];
      if (!allowed.includes(status as JobStatus)) {
        return res.status(403).json({ error: "Field tech may only set status to in_progress or completed" });
      }
      if (!isValidTransition(job.status, status as JobStatus)) {
        return res.status(409).json({ error: `Invalid transition ${job.status} → ${status}` });
      }
    } else {
      return res.status(403).json({ error: "Forbidden — insufficient role for status updates" });
    }

    const updated = await stewardshipJobsRepo.transition(id, status as JobStatus, {
      notes:    notes    ?? undefined,
      metadata: metadata ?? undefined,
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── GET /api/v2/properties/:propertyId/jobs (Brick 8 — property-scoped) ───────
// Exposed on the properties router in properties.ts — NOT here.
// Kept as a note so the full route list is documented.

export default router;
