import { Router } from "express";
import { retainerService } from "../../services/retainerService";
import { RETAINER_ENTRY_TYPES } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requirePropertyOwnerOrAdmin,
} from "../../middleware/authV2";

const router = Router();

// POST /api/v2/retainer/properties/:propertyId/entries
// charge + adjustment: admin only; topup: owner-or-admin
router.post("/properties/:propertyId/entries", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  const { type, amount, note } = req.body;

  if (!RETAINER_ENTRY_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${RETAINER_ENTRY_TYPES.join(", ")}` });
  }
  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: "amount must be a numeric string" });
  }
  // charge + adjustment restricted to admin/supervisor
  if ((type === "charge" || type === "adjustment") &&
      req.v2Role !== "admin" && req.v2Role !== "supervisor") {
    return res.status(403).json({ error: "Admin or supervisor required for charge/adjustment" });
  }
  try {
    let result;
    if (type === "topup")       result = await retainerService.topup(propertyId, amount, note);
    else if (type === "charge") result = await retainerService.charge(propertyId, amount, note);
    else                        result = await retainerService.adjustment(propertyId, amount, note);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/retainer/properties/:propertyId/ledger
router.get("/properties/:propertyId/ledger", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  try {
    return res.json(await retainerService.ledger(propertyId));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/retainer/properties/:propertyId/balance
router.get("/properties/:propertyId/balance", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  try {
    return res.json({ propertyId, balance: await retainerService.currentBalance(propertyId) });
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/retainer/low-balance — admin/supervisor only
router.get("/low-balance", requireAdminOrSupervisor, async (_req, res) => {
  try {
    return res.json(await retainerService.lowBalanceProperties());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/retainer/properties/:propertyId/statement?month=YYYY-MM
router.get("/properties/:propertyId/statement", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month as string)) {
    return res.status(400).json({ error: "month query param required (YYYY-MM)" });
  }
  try {
    const { billingService } = await import("../../services/billingService");
    return res.json(await billingService.propertyStatement(propertyId, month as string));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/retainer/properties/:propertyId/dunning
router.get("/properties/:propertyId/dunning", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  try {
    return res.json(await retainerService.dunningState(propertyId));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// POST /api/v2/retainer/properties/:propertyId/topup — Stripe stub
router.post("/properties/:propertyId/topup", requirePropertyOwnerOrAdmin("propertyId"), async (req, res) => {
  const { propertyId } = req.params;
  const { amount, paymentMethodId } = req.body;
  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: "amount required" });
  }
  if (!paymentMethodId) {
    return res.status(400).json({ error: "paymentMethodId required" });
  }
  try {
    return res.json(await retainerService.topupViaPayment(propertyId, amount, paymentMethodId));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
