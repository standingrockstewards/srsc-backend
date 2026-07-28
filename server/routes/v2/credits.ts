import { Router } from "express";
import { accountCreditsRepo } from "../../repositories/accountCredits";
import { insertAccountCreditSchema } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requireSelfOrAdmin,
} from "../../middleware/authV2";

const router = Router();

// POST /api/v2/credits/customers/:customerId — admin/supervisor issues a credit
router.post("/customers/:customerId", requireAdminOrSupervisor, async (req, res) => {
  const { customerId } = req.params;
  const parsed = insertAccountCreditSchema.safeParse({ ...req.body, customerId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await accountCreditsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/credits/customers/:customerId — owner or admin
router.get("/customers/:customerId", requireSelfOrAdmin("customerId"), async (req, res) => {
  const { customerId } = req.params;
  try {
    return res.json(await accountCreditsRepo.listByCustomer(customerId));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/credits/customers/:customerId/:creditId/apply — admin only
router.post(
  "/customers/:customerId/:creditId/apply",
  requireAdminOrSupervisor,
  async (req, res) => {
    const { creditId } = req.params;
    const { propertyId } = req.body;
    if (!propertyId) return res.status(400).json({ error: "propertyId required" });
    try {
      return res.json(await accountCreditsRepo.applyCredit(creditId, propertyId));
    } catch (err: any) {
      return res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

export default router;
