/**
 * Retainer routes — mounted at /api/v2/retainer
 *
 * POST /api/v2/retainer/properties/:propertyId/entries   — post topup/charge/credit_applied/adjustment
 * GET  /api/v2/retainer/properties/:propertyId/ledger    — chronological ledger (owner-or-admin)
 * GET  /api/v2/retainer/properties/:propertyId/balance   — current balance + dunning state
 * GET  /api/v2/retainer/low-balance                      — admin: all flagged properties
 * GET  /api/v2/retainer/properties/:propertyId/statement?month=YYYY-MM
 * POST /api/v2/retainer/properties/:propertyId/topup     — Stripe stub top-up hook
 */

import { Router } from "express";
import { z } from "zod";
import {
  requireAdminOrSupervisor,
  requirePropertyOwnerOrAdmin,
} from "../../middleware/authV2";
import { retainerService } from "../../services/retainerService";
import { billingService }  from "../../services/billingService";
import { billingStateLogRepo } from "../../repositories/billingStateLog";
import { propertiesRepo } from "../../repositories/properties";
import { paymentProvider } from "../../services/paymentProvider";
import { RETAINER_ENTRY_TYPES } from "../../../shared/schema-v2";

const router = Router();

const MONTH_RE = /^\d{4}-\d{2}$/;

const entrySchema = z.object({
  type:   z.enum(RETAINER_ENTRY_TYPES),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal"),
  note:   z.string().optional(),
});

const topupSchema = z.object({
  amountCents: z.number().int().positive(),
  description: z.string().optional(),
});

// ── POST /api/v2/retainer/properties/:propertyId/entries ─────────────────────
// topup + credit_applied: owner-or-admin
// charge + adjustment: admin/supervisor only
router.post(
  "/properties/:propertyId/entries",
  requirePropertyOwnerOrAdmin("propertyId"),
  async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });

    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { type, amount, note } = parsed.data;

    // charge + adjustment require admin
    if ((type === "charge" || type === "adjustment") &&
        req.v2Role !== "admin" && req.v2Role !== "supervisor") {
      return res.status(403).json({ error: "Forbidden — charge/adjustment requires admin" });
    }

    try {
      let result: any;
      if (type === "topup")          result = await retainerService.topup(propertyId, amount, note);
      else if (type === "charge")    result = await retainerService.charge(propertyId, amount, note);
      else if (type === "adjustment") result = await retainerService.adjustment(propertyId, amount, note);
      else {
        // credit_applied — use accountCreditsRepo directly from calling code (see /credits routes)
        // Direct credit_applied entries not allowed here; use POST /customers/:id/credits/:creditId/apply
        return res.status(400).json({ error: "Use /customers/:customerId/credits/:creditId/apply to apply credits" });
      }
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

// ── GET /api/v2/retainer/properties/:propertyId/ledger ───────────────────────
router.get(
  "/properties/:propertyId/ledger",
  requirePropertyOwnerOrAdmin("propertyId"),
  async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
    try {
      const ledger = await retainerService.ledger(propertyId);
      return res.json({ propertyId, ledger });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /api/v2/retainer/properties/:propertyId/balance ──────────────────────
router.get(
  "/properties/:propertyId/balance",
  requirePropertyOwnerOrAdmin("propertyId"),
  async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
    try {
      const [balance, property] = await Promise.all([
        retainerService.currentBalance(propertyId),
        propertiesRepo.getById(propertyId),
      ]);
      if (!property) return res.status(404).json({ error: "Property not found" });
      const threshold = parseFloat(property.targetRetainerAmount) * (property.lowBalanceAlertPct / 100);
      return res.json({
        propertyId,
        currentBalance:        balance,
        targetRetainerAmount:  property.targetRetainerAmount,
        lowBalanceThreshold:   threshold.toFixed(2),
        lowBalanceAlert:       parseFloat(balance) < threshold,
        billingState:          property.billingState,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /api/v2/retainer/low-balance ─────────────────────────────────────────
router.get("/low-balance", requireAdminOrSupervisor, async (_req, res) => {
  try {
    return res.json(await retainerService.lowBalanceProperties());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v2/retainer/properties/:propertyId/statement?month=YYYY-MM ──────
router.get(
  "/properties/:propertyId/statement",
  requirePropertyOwnerOrAdmin("propertyId"),
  async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
    const { month } = req.query;
    if (!month || !MONTH_RE.test(month as string)) {
      return res.status(400).json({ error: "month query param required (YYYY-MM)" });
    }
    try {
      return res.json(await billingService.propertyStatement(propertyId, month as string));
    } catch (err: any) {
      return res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

// ── GET /api/v2/retainer/properties/:propertyId/dunning ──────────────────────
router.get(
  "/properties/:propertyId/dunning",
  requirePropertyOwnerOrAdmin("propertyId"),
  async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
    try {
      const [property, log] = await Promise.all([
        propertiesRepo.getById(propertyId),
        billingStateLogRepo.listByProperty(propertyId),
      ]);
      if (!property) return res.status(404).json({ error: "Property not found" });
      return res.json({ propertyId, billingState: property.billingState, transitionLog: log });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// ── POST /api/v2/retainer/properties/:propertyId/topup ───────────────────────
// Stripe stub — initiates payment intent (no real keys required yet)
router.post(
  "/properties/:propertyId/topup",
  requirePropertyOwnerOrAdmin("propertyId"),
  async (req, res) => {
    const propertyId = parseInt(req.params.propertyId);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid propertyId" });
    const parsed = topupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (!req.v2CustomerId && req.v2Role !== "admin" && req.v2Role !== "supervisor") {
      return res.status(403).json({ error: "No customer record linked to your account" });
    }

    try {
      const result = await paymentProvider.initiateTopUp({
        propertyId,
        customerId:  req.v2CustomerId ?? 0,
        amountCents: parsed.data.amountCents,
        description: parsed.data.description,
      });
      if (!result.success) {
        return res.status(502).json({ error: result.errorMessage ?? "Payment provider error" });
      }
      // On success, post the topup entry to the ledger
      const dollarAmount = (parsed.data.amountCents / 100).toFixed(2);
      const entry = await retainerService.topup(
        propertyId,
        dollarAmount,
        `Stripe top-up ref:${result.providerRef}`,
      );
      return res.status(201).json({ entry, providerRef: result.providerRef });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

export default router;
