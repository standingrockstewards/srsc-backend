import { Router } from "express";
import { customersRepo } from "../../repositories/customers";
import { insertCustomerSchema } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requireNotVendor,
  requireSelfOrAdmin,
} from "../../middleware/authV2";
import { billingService } from "../../services/billingService";

const router = Router();
const patchSchema = insertCustomerSchema.partial();

// GET /api/v2/customers — admin/supervisor only (full list)
router.get("/", requireAdminOrSupervisor, async (_req, res) => {
  try {
    return res.json(await customersRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/customers/:id
router.get("/:id", requireSelfOrAdmin("id"), async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await customersRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/customers — admin only
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertCustomerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await customersRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/customers/:id — self or admin
router.patch("/:id", requireSelfOrAdmin("id"), async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await customersRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Customer not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v2/customers/:id — admin only
router.delete("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Invalid id" });
  try {
    await customersRepo.delete(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/customers/:id/statement-summary?month=YYYY-MM  (Brick 5)
router.get("/:id/statement-summary", requireSelfOrAdmin("id"), async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month as string)) {
    return res.status(400).json({ error: "month query param required (YYYY-MM)" });
  }
  try {
    return res.json(await billingService.customerStatementSummary(id, month as string));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;

// GET /api/v2/customers/:customerId/referrals  (Brick 9)
// Returns all referrals where the customer is the referrer or the referred party.
// Owner-or-admin: customers see only their own; admin/supervisor see any.
import { referralsRepo as _referralsRepo } from "../../repositories/referrals";
router.get("/:customerId/referrals", requireSelfOrAdmin("customerId"), async (req, res) => {
  const { customerId } = req.params;
  try {
    const [asReferrer, asReferred] = await Promise.all([
      _referralsRepo.listByReferrer(customerId),
      _referralsRepo.listByReferred(customerId),
    ]);
    // Merge and deduplicate (a referral can appear in both lists if same customer is referrer+referred, though createReferral guards against that)
    const seen = new Set<string>();
    const all = [...asReferrer, ...asReferred].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    return res.json(all);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});
