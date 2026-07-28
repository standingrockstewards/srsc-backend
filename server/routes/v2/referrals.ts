import { Router } from "express";
import { referralService } from "../../services/referralService";
import { insertReferralSchema } from "../../../shared/schema-v2";
import { requireAdminOrSupervisor, requireNotVendor } from "../../middleware/authV2";

const router = Router();

// POST /api/v2/referrals — admin creates; clients cannot self-create referrals via API
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertReferralSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await referralService.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/referrals?referrerId=N — self or admin
// Clients can only see referrals where referrerId === their own customerId
router.get("/", requireNotVendor, async (req, res) => {
  const { referrerId } = req.query;
  if (!referrerId) return res.status(400).json({ error: "referrerId query param required" });
  const id = parseInt(referrerId as string);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid referrerId" });

  // Client ownership check
  if (req.v2Role === "client" && req.v2CustomerId !== id) {
    return res.status(403).json({ error: "Forbidden — you may only view your own referrals" });
  }

  try {
    return res.json(await referralService.listByReferrer(id));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/referrals/:id/vest — admin only
router.post("/:id/vest", requireAdminOrSupervisor, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    return res.json(await referralService.vest(id));
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404
      : err.message.includes("cannot be vested") ? 409 : 500;
    return res.status(status).json({ error: err.message });
  }
});

export default router;
