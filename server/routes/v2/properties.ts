import { Router } from "express";
import { z } from "zod";
import { propertiesRepo } from "../../repositories/properties";
import { retainerService } from "../../services/retainerService";
import { insertPropertyV2Schema } from "../../../shared/schema-v2";

const router = Router();

const patchSchema = insertPropertyV2Schema.partial();

const retainerBodySchema = z.object({
  type:   z.enum(["deposit", "debit"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal string"),
  note:   z.string().optional(),
});

// GET /api/v2/properties
router.get("/", async (req, res) => {
  try {
    const { customerId } = req.query;
    const rows = customerId
      ? await propertiesRepo.listByCustomer(parseInt(customerId as string))
      : await propertiesRepo.getAll();
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/properties/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await propertiesRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Property not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/properties
router.post("/", async (req, res) => {
  const parsed = insertPropertyV2Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await propertiesRepo.create(parsed.data);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/properties/:id
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await propertiesRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Property not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v2/properties/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await propertiesRepo.delete(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/properties/:id/retainer — record deposit or debit
router.post("/:id/retainer", async (req, res) => {
  const propertyId = parseInt(req.params.id);
  if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid id" });

  const parsed = retainerBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { type, amount, note } = parsed.data;
  try {
    const property = await propertiesRepo.getById(propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    const entry =
      type === "deposit"
        ? await retainerService.deposit(propertyId, amount, note)
        : await retainerService.debit(propertyId, amount, note);

    return res.status(201).json({
      entry,
      currentBalance: entry.balanceAfter,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/properties/:id/retainer — ledger history newest-first
router.get("/:id/retainer", async (req, res) => {
  const propertyId = parseInt(req.params.id);
  if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid id" });
  try {
    const property = await propertiesRepo.getById(propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    const [ledger, currentBalance] = await Promise.all([
      retainerService.ledger(propertyId),
      retainerService.currentBalance(propertyId),
    ]);

    return res.json({ propertyId, currentBalance, ledger });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
