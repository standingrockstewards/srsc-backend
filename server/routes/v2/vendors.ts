import { Router } from "express";
import { vendorsRepo } from "../../repositories/vendors";
import { vendorReviewsRepo } from "../../repositories/vendorReviews";
import { vendorScoringService } from "../../services/vendorScoringService";
import { insertVendorSchema, insertVendorReviewSchema } from "../../../shared/schema-v2";

const router = Router();

const patchVendorSchema = insertVendorSchema.partial();

// ── Vendors ──────────────────────────────────────────────────────────────────

// GET /api/v2/vendors
router.get("/", async (_req, res) => {
  try {
    return res.json(await vendorsRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/vendors/:id
router.get("/:id", async (req, res) => {
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

// POST /api/v2/vendors
router.post("/", async (req, res) => {
  const parsed = insertVendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await vendorsRepo.create(parsed.data);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/vendors/:id
router.patch("/:id", async (req, res) => {
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

// GET /api/v2/vendors/:id/scorecard — respects min-reviews gate
router.get("/:id/scorecard", async (req, res) => {
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

// GET /api/v2/vendor-reviews?vendorId=N
router.get("/reviews/list", async (req, res) => {
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

// POST /api/v2/vendor-reviews
router.post("/reviews", async (req, res) => {
  const parsed = insertVendorReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const review = await vendorScoringService.submitReview(parsed.data);
    return res.status(201).json(review);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
