/**
 * server/routes/v2/referrals.ts  (Brick 9 — full rewrite)
 *
 * POST   /api/v2/referrals                               — create
 * GET    /api/v2/referrals                               — list all (admin/supervisor)
 * GET    /api/v2/customers/:customerId/referrals         — customer's own (owner-or-admin)
 * PATCH  /api/v2/referrals/:id/status                   — advance status (admin/supervisor)
 *
 * Auth:
 *   Admin/Supervisor — full access on all routes.
 *   Customer (client) — POST (own referrer_customer_id only) + GET own referrals.
 *   Vendor — 403 on all routes.
 *   field_tech — 403 on all routes.
 *
 * All IDs are text. No parseInt anywhere.
 */

import { Router } from "express";
import { referralsRepo } from "../../repositories/referrals";
import { referralService } from "../../services/referralService";
import {
  insertReferralSchema,
  REFERRAL_STATUSES,
  type ReferralStatus,
} from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
  requireSelfOrAdmin,
} from "../../middleware/authV2";
import { z } from "zod";

const router = Router();

// ── POST /api/v2/referrals ────────────────────────────────────────────────────
// Admin/Supervisor: any referrer.
// Client: may only create a referral where referrer_customer_id === their own customerId.
router.post("/", async (req, res) => {
  // Vendor and field_tech: 403
  if (req.v2Role === "vendor" || req.v2Role === "field_tech") {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Client: referrer_customer_id must be their own id
  if (req.v2Role === "client") {
    const bodyReferrer = req.body?.referrerCustomerId ?? req.body?.referrer_customer_id;
    if (!bodyReferrer || bodyReferrer !== req.v2CustomerId) {
      return res.status(403).json({
        error: "Clients may only create referrals where referrerCustomerId matches their own customer ID",
      });
    }
  }

  const parsed = insertReferralSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const referral = await referralService.createReferral({
      referrerCustomerId: parsed.data.referrerCustomerId,
      referredCustomerId: parsed.data.referredCustomerId,
      bonusCreditAmount:  String(parsed.data.bonusCreditAmount),
      vestsAt:            parsed.data.vestsAt ?? null,
    });
    return res.status(201).json(referral);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── GET /api/v2/referrals ─────────────────────────────────────────────────────
// Admin/Supervisor only. Optional ?status= filter.
router.get("/", requireAdminOrSupervisor, async (req, res) => {
  const { status, referrerId, referredId } = req.query;
  try {
    if (status) {
      if (!REFERRAL_STATUSES.includes(status as ReferralStatus)) {
        return res.status(400).json({ error: `status must be one of: ${REFERRAL_STATUSES.join(", ")}` });
      }
      return res.json(await referralsRepo.listByStatus(status as ReferralStatus));
    }
    if (referrerId) return res.json(await referralsRepo.listByReferrer(referrerId as string));
    if (referredId) return res.json(await referralsRepo.listByReferred(referredId as string));
    return res.json(await referralsRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v2/referrals/:id ─────────────────────────────────────────────────
// Admin/Supervisor, or the referrer/referred customer themselves.
router.get("/:id", async (req, res) => {
  if (req.v2Role === "vendor" || req.v2Role === "field_tech") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const { id } = req.params;
  try {
    const referral = await referralsRepo.getById(id);
    if (!referral) return res.status(404).json({ error: "Referral not found" });

    if (req.v2Role === "admin" || req.v2Role === "supervisor") {
      return res.json(referral);
    }

    // Client: only if they are the referrer or the referred customer
    if (
      referral.referrerCustomerId !== req.v2CustomerId &&
      referral.referredCustomerId !== req.v2CustomerId
    ) {
      return res.status(403).json({ error: "Forbidden — not your referral" });
    }
    return res.json(referral);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ── PATCH /api/v2/referrals/:id/status ────────────────────────────────────────
// Admin/Supervisor only. Vesting triggers atomic credit issuance.
router.patch("/:id/status", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const statusSchema = z.object({ status: z.enum(REFERRAL_STATUSES) });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: `status must be one of: ${REFERRAL_STATUSES.join(", ")}`,
    });
  }
  try {
    const updated = await referralService.advanceStatus(id, parsed.data.status);
    return res.json(updated);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
