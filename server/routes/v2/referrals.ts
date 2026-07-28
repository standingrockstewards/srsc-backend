import { Router } from "express";
import { referralsRepo } from "../../repositories/referrals";
import { insertReferralSchema } from "../../../shared/schema-v2";
import { requireAdminOrSupervisor, requireSelfOrAdmin } from "../../middleware/authV2";

const router = Router();

// GET /api/v2/referrals?referrerId=<text-id>
router.get("/", requireAdminOrSupervisor, async (req, res) => {
  try {
    const { referrerId } = req.query;
    if (referrerId) {
      return res.json(await referralsRepo.listByReferrer(referrerId as string));
    }
    return res.json(await referralsRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/referrals/:id
router.get("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await referralsRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Referral not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/referrals
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertReferralSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await referralsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/referrals/:id
router.patch("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const parsed = insertReferralSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await referralsRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Referral not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
