import { Router } from "express";
import { referralService } from "../../services/referralService";
import { insertReferralSchema } from "../../../shared/schema-v2";

const router = Router();

// POST /api/v2/referrals
router.post("/", async (req, res) => {
  const parsed = insertReferralSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await referralService.create(parsed.data);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/referrals?referrerId=N
router.get("/", async (req, res) => {
  const { referrerId } = req.query;
  if (!referrerId) return res.status(400).json({ error: "referrerId query param required" });
  const id = parseInt(referrerId as string);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid referrerId" });
  try {
    const rows = await referralService.listByReferrer(id);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/referrals/:id/vest
router.post("/:id/vest", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const result = await referralService.vest(id);
    return res.json(result);
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404
      : err.message.includes("cannot be vested") ? 409
      : 500;
    return res.status(status).json({ error: err.message });
  }
});

export default router;
