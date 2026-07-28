/**
 * server/repositories/vendorPayments.ts  (Brick 7 — rewritten)
 *
 * All IDs (id, vendorId, batchId) are text (nanoid/cuid2).
 * No created_at / updated_at columns — live DB does not have them.
 * status is plain text; VENDOR_PAYMENT_STATUSES union enforced in the service layer.
 */

import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { db, pool } from "../db";
import { vendorPayments, type InsertVendorPayment, type VendorPaymentStatus } from "../../shared/schema-v2";

export interface ListVendorPaymentsOptions {
  status?: VendorPaymentStatus;
  from?:   string;   // ISO datetime — inclusive lower bound on scheduled_for or paid_at (uses created filter on id ordering)
  to?:     string;   // ISO datetime — inclusive upper bound
}

export const vendorPaymentsRepo = {
  async create(data: InsertVendorPayment) {
    const [row] = await db.insert(vendorPayments).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.id, id));
    return row ?? null;
  },

  /** All payments in a batch, newest-first by scheduledFor (nulls last) */
  async listByBatch(batchId: string) {
    return db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.batchId, batchId))
      .orderBy(vendorPayments.scheduledFor);
  },

  /** Payments for a specific vendor with optional status + date filters */
  async listByVendor(vendorId: string, opts: ListVendorPaymentsOptions = {}) {
    const { status, from, to } = opts;
    const conditions: SQL[] = [eq(vendorPayments.vendorId, vendorId)];

    if (status) {
      conditions.push(eq(vendorPayments.status, status));
    }
    if (from) {
      conditions.push(gte(vendorPayments.scheduledFor, new Date(from)));
    }
    if (to) {
      conditions.push(lte(vendorPayments.scheduledFor, new Date(to)));
    }

    return db
      .select()
      .from(vendorPayments)
      .where(and(...conditions))
      .orderBy(vendorPayments.scheduledFor);
  },

  /** All pending (unbatched) payments — used by createBatch */
  async listPending() {
    return db
      .select()
      .from(vendorPayments)
      .where(and(
        eq(vendorPayments.status, "pending"),
      ));
  },

  async updateStatus(
    id: string,
    status: VendorPaymentStatus,
    extra: {
      batchId?:          string | null;
      scheduledFor?:     Date | null;
      paidAt?:           Date | null;
      stripeTransferId?: string | null;
    } = {},
  ) {
    const [row] = await db
      .update(vendorPayments)
      .set({ status, ...extra })
      .where(eq(vendorPayments.id, id))
      .returning();
    return row ?? null;
  },

  /**
   * Atomically assign batchId + set status = 'scheduled' on all provided payment IDs.
   * Uses a raw pg transaction so the entire batch assignment is one atomic op.
   */
  async assignBatch(paymentIds: string[], batchId: string, scheduledFor: Date): Promise<void> {
    if (paymentIds.length === 0) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const pid of paymentIds) {
        await client.query(
          `UPDATE vendor_payments
           SET batch_id = $1, status = 'scheduled', scheduled_for = $2
           WHERE id = $3 AND status = 'pending'`,
          [batchId, scheduledFor, pid],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Mark a payment as paid. Writes paidAt + stripeTransferId atomically.
   * Validates current status is 'scheduled' before transitioning.
   */
  async markPaid(id: string, stripeTransferId: string, paidAt: Date = new Date()) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const check = await client.query(
        `SELECT status FROM vendor_payments WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (check.rows.length === 0) {
        throw Object.assign(new Error("Payment not found"), { status: 404 });
      }
      if (check.rows[0].status !== "scheduled") {
        throw Object.assign(
          new Error(`Cannot mark paid: current status is '${check.rows[0].status}', expected 'scheduled'`),
          { status: 409 },
        );
      }

      const result = await client.query(
        `UPDATE vendor_payments
         SET status = 'paid', paid_at = $1, stripe_transfer_id = $2
         WHERE id = $3
         RETURNING *`,
        [paidAt, stripeTransferId, id],
      );
      await client.query("COMMIT");
      return result.rows[0] as VendorPayment;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

// Re-export type for convenience
import type { VendorPayment } from "../../shared/schema-v2";
