/**
 * server/services/vendorPayoutService.ts  (Brick 7)
 *
 * Vendor payout batch management.
 *
 * Status lifecycle:
 *   pending → scheduled  (createBatch or schedule)
 *   scheduled → paid     (markPaid — writes paidAt + stripeTransferId)
 *   any → failed         (markFailed)
 *
 * Stripe integration seam:
 *   markPaid() accepts a manually-supplied stripeTransferId string.
 *   The actual Stripe API call is NOT made here — this is a clearly-marked
 *   integration point for go-live. When Stripe is wired up, replace the
 *   manual transfer id with the result of stripe.transfers.create(...).
 *
 * All IDs (payment id, vendor id, batch id) are text throughout.
 * No parseInt, no integer cast on any id or FK.
 */

import { nanoid } from "nanoid";
import { vendorPaymentsRepo } from "../repositories/vendorPayments";
import { vendorsRepo } from "../repositories/vendors";
import { VENDOR_PAYMENT_STATUSES, type VendorPaymentStatus } from "../../shared/schema-v2";
import type { ListVendorPaymentsOptions } from "../repositories/vendorPayments";

// ── Status transition guard ────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<VendorPaymentStatus, VendorPaymentStatus[]> = {
  pending:   ["scheduled", "failed"],
  scheduled: ["paid", "failed"],
  paid:      [],          // terminal state
  failed:    ["pending"], // allow retry
};

function assertTransition(from: string, to: VendorPaymentStatus): void {
  const fromTyped = from as VendorPaymentStatus;
  if (!VENDOR_PAYMENT_STATUSES.includes(fromTyped)) {
    throw Object.assign(new Error(`Unknown current status: '${from}'`), { status: 409 });
  }
  const allowed = ALLOWED_TRANSITIONS[fromTyped] ?? [];
  if (!allowed.includes(to)) {
    throw Object.assign(
      new Error(`Invalid transition ${from} → ${to}. Allowed from ${from}: [${allowed.join(", ")}]`),
      { status: 409 },
    );
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const vendorPayoutService = {
  /**
   * Create a payout batch from all currently-pending payments.
   *
   * Atomically:
   *   1. Fetch all pending (unbatched) vendor payments
   *   2. Assign a shared batchId (nanoid) to all of them
   *   3. Transition each to 'scheduled' with the given scheduledFor date
   *
   * Returns the batch summary: batchId, scheduledFor, paymentCount, totalAmount.
   * The Stripe API call happens later at markPaid time — not here.
   */
  async createBatch(scheduledFor: Date) {
    const pending = await vendorPaymentsRepo.listPending();
    if (pending.length === 0) {
      throw Object.assign(new Error("No pending payments to batch"), { status: 422 });
    }

    const batchId = nanoid();
    const totalAmount = pending
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      .toFixed(2);

    await vendorPaymentsRepo.assignBatch(
      pending.map((p) => p.id),
      batchId,
      scheduledFor,
    );

    return {
      batchId,
      scheduledFor,
      paymentCount: pending.length,
      totalAmount,
      vendorBreakdown: aggregateByVendor(pending),
    };
  },

  /**
   * Get batch detail: all payments in the batch + aggregate total.
   */
  async getBatch(batchId: string) {
    const payments = await vendorPaymentsRepo.listByBatch(batchId);
    if (payments.length === 0) {
      throw Object.assign(new Error("Batch not found or empty"), { status: 404 });
    }
    const totalAmount = payments
      .reduce((sum, p) => sum + parseFloat(p.amount), 0)
      .toFixed(2);

    return {
      batchId,
      paymentCount: payments.length,
      totalAmount,
      payments,
      vendorBreakdown: aggregateByVendor(payments),
    };
  },

  /**
   * Schedule an individual payment (pending → scheduled).
   * For one-off scheduling outside of a batch.
   */
  async schedule(paymentId: string, scheduledFor: Date) {
    const payment = await vendorPaymentsRepo.getById(paymentId);
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
    assertTransition(payment.status, "scheduled");

    return vendorPaymentsRepo.updateStatus(paymentId, "scheduled", { scheduledFor });
  },

  /**
   * Mark a payment as paid (scheduled → paid).
   *
   * ── STRIPE INTEGRATION SEAM ──────────────────────────────────────────────
   * When Stripe go-live is ready, add the following BEFORE calling markPaid:
   *
   *   const transfer = await stripe.transfers.create({
   *     amount: Math.round(parseFloat(payment.amount) * 100),
   *     currency: "usd",
   *     destination: vendor.stripeAccountId,   // add stripeAccountId to vendors table
   *     transfer_group: payment.batchId ?? paymentId,
   *   });
   *   const stripeTransferId = transfer.id;
   *
   * For now, the caller supplies stripeTransferId manually (can be any reference string).
   * ─────────────────────────────────────────────────────────────────────────
   */
  async markPaid(paymentId: string, stripeTransferId: string, paidAt?: Date) {
    if (!stripeTransferId) {
      throw Object.assign(
        new Error("stripeTransferId required (supply a reference string until Stripe is wired up)"),
        { status: 400 },
      );
    }
    return vendorPaymentsRepo.markPaid(paymentId, stripeTransferId, paidAt ?? new Date());
  },

  /**
   * Mark a payment as failed.
   * Allowed from pending or scheduled.
   */
  async markFailed(paymentId: string, reason?: string) {
    const payment = await vendorPaymentsRepo.getById(paymentId);
    if (!payment) throw Object.assign(new Error("Payment not found"), { status: 404 });
    assertTransition(payment.status, "failed");

    return vendorPaymentsRepo.updateStatus(paymentId, "failed", {});
  },

  /**
   * List payments for a vendor (vendor views own history, admin views any).
   * Supports ?status= / ?from= / ?to= filters.
   */
  async listForVendor(vendorId: string, opts: ListVendorPaymentsOptions = {}) {
    // Validate vendor exists
    const vendor = await vendorsRepo.getById(vendorId);
    if (!vendor) throw Object.assign(new Error("Vendor not found"), { status: 404 });
    return vendorPaymentsRepo.listByVendor(vendorId, opts);
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function aggregateByVendor(payments: Array<{ vendorId: string; amount: string }>) {
  const map: Record<string, number> = {};
  for (const p of payments) {
    map[p.vendorId] = (map[p.vendorId] ?? 0) + parseFloat(p.amount);
  }
  return Object.entries(map).map(([vendorId, total]) => ({
    vendorId,
    total: total.toFixed(2),
  }));
}
