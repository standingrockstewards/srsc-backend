/**
 * Credits routes — mounted at /api/v2/credits
 *
 * POST /api/v2/credits/customers/:customerId          — issue a credit (admin only)
 * GET  /api/v2/credits/customers/:customerId          — list credits (owner-or-admin)
 * POST /api/v2/credits/customers/:customerId/:creditId/apply  — apply credit to a property (admin)
 * GET  /api/v2/customers/:customerId/statement-summary?month=YYYY-MM (mounted via customersRouter)
 */

import { Router } from "express";
import { z } from "zod";
import {
  requireAdminOrSupervisor,
  requireSelfOrAdmin,
} from "../../middleware/authV2";
import { accountCreditsRepo } from "../../repositories/accountCredits";
import { insertAccountCreditSchema } from "../../../shared/schema-v2";

const router = Router();

const MONTH_RE = /^\d{4}-\d{2}$/;

const issueCreditSchema = insertAccountCreditSchema.omit({ id: true, applied: true, createdAt: true });

// ── POST /api/v2/credits/customers/:customerId ────────────────────────────────
router.post(
  "/customers/:customerId",
  requireAdminOrSupervisor,
  async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) return res.status(400).json({ error: "Invalid customerId" });

    const parsed = issueCreditSchema.safeParse({ ...req.body, customerId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const credit = await accountCreditsRepo.create({ ...parsed.data, applied: false });
      return res.status(201).json(credit);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /api/v2/credits/customers/:customerId ─────────────────────────────────
router.get(
  "/customers/:customerId",
  requireSelfOrAdmin("customerId"),
  async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) return res.status(400).json({ error: "Invalid customerId" });
    const { unapplied } = req.query;
    try {
      const credits = unapplied === "true"
        ? await accountCreditsRepo.listUnapplied(customerId)
        : await accountCreditsRepo.listByCustomer(customerId);
      return res.json(credits);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// ── POST /api/v2/credits/customers/:customerId/:creditId/apply ────────────────
router.post(
  "/customers/:customerId/:creditId/apply",
  requireAdminOrSupervisor,
  async (req, res) => {
    const customerId = parseInt(req.params.customerId);
    const creditId   = parseInt(req.params.creditId);
    if (isNaN(customerId) || isNaN(creditId)) return res.status(400).json({ error: "Invalid id" });

    const parsed = z.object({ propertyId: z.number().int().positive() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const result = await accountCreditsRepo.applyCredit(creditId, parsed.data.propertyId);
      return res.json(result);
    } catch (err: any) {
      return res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

export default router;
