import { Router } from "express";
import { vendorsRepo } from "../../repositories/vendors";
import { vendorReviewsRepo } from "../../repositories/vendorReviews";
import { vendorScoringService } from "../../services/vendorScoringService";
import { insertVendorSchema, insertVendorReviewSchema } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requireNotVendor,
  requireVendorSelfOrAdmin,
} from "../../middleware/authV2";

const router = Router();
const patchVendorSchema = insertVendorSchema.partial();

// ── Vendors ──────────────────────────────────────────────────────────────────

// GET /api/v2/vendors — admin/supervisor; clients blocked; vendors see list (no client data)
router.get("/", async (req, res) => {
  // Vendors can see the vendor list (for their own reference); clients cannot
  if (req.v2Role === "client") {
    return res.status(403).json({ error: "Forbidden — clients may not access vendor records directly" });
  }
  try {
    return res.json(await vendorsRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/vendors/:id — admin/supervisor or the vendor themselves
router.get("/:id", requireVendorSelfOrAdmin("id"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await vendorsRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Vendor not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/vendors — admin only
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertVendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await vendorsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/vendors/:id — admin only
router.patch("/:id", requireAdminOrSupervisor, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = patchVendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await vendorsRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Vendor not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/vendors/:id/scorecard — public (no ownership restriction, gated by min-reviews)
// Clients can see the scorecard (score only, no identity leak); vendors/admin also ok
router.get("/:id/scorecard", async (req, res) => {
  // Preserve middleman: clients see score + breakdown, but NOT vendor contact details
  // (scorecard endpoint returns only scoring data, not email/phone — safe to expose)
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const scorecard = await vendorScoringService.scorecard(id);
    if (!scorecard) return res.status(404).json({ error: "Vendor not found" });
    return res.json(scorecard);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Vendor Reviews ────────────────────────────────────────────────────────────

// GET /api/v2/vendors/reviews/list?vendorId=N — admin/supervisor; client blocked
router.get("/reviews/list", requireAdminOrSupervisor, async (req, res) => {
  const { vendorId } = req.query;
  if (!vendorId) return res.status(400).json({ error: "vendorId query param required" });
  const id = parseInt(vendorId as string);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid vendorId" });
  try {
    return res.json(await vendorReviewsRepo.listByVendor(id));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/vendors/reviews — admin submits reviews (on behalf of clients in v2)
// Vendors cannot review themselves; clients submit via admin-mediated flow
router.post("/reviews", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertVendorReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await vendorScoringService.submitReview(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
