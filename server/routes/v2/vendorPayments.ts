/**
 * server/routes/v2/vendorPayments.ts  (Brick 7)
 *
 * Mounted at /api/v2 in v2/index.ts — routes are prefixed there.
 *
 * Authorization:
 *   - All mutation routes: Admin / Supervisor only.
 *   - GET /vendors/:vendorId/payments: Admin/Supervisor OR the vendor viewing their own.
 *   - Clients get 403 on all routes (requireNotVendorOrClient used where needed).
 *
 * All IDs are text. No parseInt anywhere.
 */

import { Router } from "express";
import { vendorPayoutService } from "../../services/vendorPayoutService";
import { VENDOR_PAYMENT_STATUSES } from "../../../shared/schema-v2";
import {
  requireAdminOrSupervisor,
} from "../../middleware/authV2";

const router = Router();

// ─── POST /api/v2/payout-batches ─────────────────────────────────────────────
// Create a batch from all pending payments. Admin/Supervisor only.
router.post("/payout-batches", requireAdminOrSupervisor, async (req, res) => {
  const { scheduledFor } = req.body;
  if (!scheduledFor) {
    return res.status(400).json({ error: "scheduledFor (ISO datetime) required" });
  }
  const date = new Date(scheduledFor);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: "scheduledFor must be a valid ISO datetime" });
  }
  try {
    return res.status(201).json(await vendorPayoutService.createBatch(date));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ─── GET /api/v2/payout-batches/:batchId ─────────────────────────────────────
// Batch detail + line items. Admin/Supervisor only.
router.get("/payout-batches/:batchId", requireAdminOrSupervisor, async (req, res) => {
  const { batchId } = req.params;
  try {
    return res.json(await vendorPayoutService.getBatch(batchId));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ─── PATCH /api/v2/vendor-payments/:id/schedule ──────────────────────────────
// Set status → scheduled + scheduledFor. Admin/Supervisor only.
router.patch("/vendor-payments/:id/schedule", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const { scheduledFor } = req.body;
  if (!scheduledFor) {
    return res.status(400).json({ error: "scheduledFor required" });
  }
  const date = new Date(scheduledFor);
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: "scheduledFor must be a valid ISO datetime" });
  }
  try {
    return res.json(await vendorPayoutService.schedule(id, date));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ─── PATCH /api/v2/vendor-payments/:id/mark-paid ─────────────────────────────
// Set status → paid + paidAt + stripeTransferId. Admin/Supervisor only.
// stripeTransferId must be supplied manually until Stripe is wired up (integration seam).
router.patch("/vendor-payments/:id/mark-paid", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const { stripeTransferId, paidAt } = req.body;
  if (!stripeTransferId) {
    return res.status(400).json({
      error: "stripeTransferId required — supply a reference string (Stripe API not yet wired)",
    });
  }
  const paidAtDate = paidAt ? new Date(paidAt) : new Date();
  if (isNaN(paidAtDate.getTime())) {
    return res.status(400).json({ error: "paidAt must be a valid ISO datetime" });
  }
  try {
    return res.json(await vendorPayoutService.markPaid(id, stripeTransferId, paidAtDate));
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ─── GET /api/v2/vendors/:vendorId/payments ───────────────────────────────────
// Vendor's payment history. Admin/Supervisor see any vendor.
// A vendor may only read their own. Clients always 403.
router.get("/vendors/:vendorId/payments", async (req, res) => {
  const { vendorId } = req.params;

  // Clients are blocked entirely
  if (req.v2Role === "client") {
    return res.status(403).json({ error: "Forbidden — clients may not access vendor payment records" });
  }

  // Vendor: can only see own payments
  if (req.v2Role === "vendor") {
    // Vendors have no v2CustomerId; ownership is checked via the session's linked vendor record.
    // For now, admin must have provisioned the vendor's userId with a matching vendor email.
    // The vendor's identity is req.v2UserId (v1 SQLite id) — we resolve to the vendor record
    // by looking up users.email → vendors.email in the route handler.
    const { storage } = await import("../../../server/storage");
    const user = storage.getUserById(req.v2UserId!);
    if (!user) return res.status(401).json({ error: "User not found" });

    const { vendorsRepo } = await import("../../repositories/vendors");
    const vendorRecord = await vendorsRepo.getByEmail(user.email);
    if (!vendorRecord) {
      return res.status(403).json({ error: "No vendor record linked to your account" });
    }
    if (vendorRecord.id !== vendorId) {
      return res.status(403).json({ error: "Forbidden — you may only view your own payments" });
    }
  } else if (req.v2Role !== "admin" && req.v2Role !== "supervisor") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { status, from, to } = req.query;

  if (status && !VENDOR_PAYMENT_STATUSES.includes(status as any)) {
    return res.status(400).json({
      error: `status must be one of: ${VENDOR_PAYMENT_STATUSES.join(", ")}`,
    });
  }

  try {
    return res.json(
      await vendorPayoutService.listForVendor(vendorId, {
        status: status as any,
        from:   from as string | undefined,
        to:     to   as string | undefined,
      }),
    );
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
