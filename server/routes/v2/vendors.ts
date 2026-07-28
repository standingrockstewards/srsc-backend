import { Router } from "express";
import { vendorsRepo } from "../../repositories/vendors";
import { vendorReviewsRepo } from "../../repositories/vendorReviews";
import { insertVendorSchema, insertVendorReviewSchema } from "../../../shared/schema-v2";
import { requireAdminOrSupervisor, requireNotVendor } from "../../middleware/authV2";

const router = Router();

// GET /api/v2/vendors
router.get("/", requireNotVendor, async (_req, res) => {
  try {
    return res.json(await vendorsRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/vendors/:id
router.get("/:id", requireNotVendor, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await vendorsRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Vendor not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/vendors
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertVendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await vendorsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/vendors/:id
router.patch("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const parsed = insertVendorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await vendorsRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Vendor not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v2/vendors/:id
router.delete("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    await vendorsRepo.delete(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/vendors/:id/reviews
router.get("/:id/reviews", requireNotVendor, async (req, res) => {
  const { id } = req.params;
  try {
    const agg   = await vendorReviewsRepo.getAggregateForVendor(id);
    const items = await vendorReviewsRepo.listByVendor(id);
    return res.json({ aggregate: agg, reviews: items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/vendors/:id/reviews
router.post("/:id/reviews", requireNotVendor, async (req, res) => {
  const { id: vendorId } = req.params;
  const parsed = insertVendorReviewSchema.safeParse({ ...req.body, vendorId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await vendorReviewsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
