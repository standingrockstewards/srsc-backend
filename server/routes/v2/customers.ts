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

// GET /api/v2/customers/:id — self or admin
router.get("/:id", requireSelfOrAdmin("id"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
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
    const row = await customersRepo.create(parsed.data);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/customers/:id — self or admin
router.patch("/:id", requireSelfOrAdmin("id"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
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
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await customersRepo.delete(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/customers/:id/statement-summary?month=YYYY-MM  (Brick 5)
router.get("/:id/statement-summary", requireSelfOrAdmin("id"), async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
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
