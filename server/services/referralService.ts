/**
 * server/services/referralService.ts  (Brick 9)
 *
 * Referral lifecycle:  pending → qualified → vested
 *                               └→ cancelled
 *                               └→ expired
 *
 * Vesting is ATOMIC: one raw pg transaction that:
 *   1. Acquires a FOR UPDATE lock on the referral row (idempotent double-vest guard)
 *   2. Sets referrals.status = 'vested'
 *   3. Inserts an account_credits row (source = 'referral:<referralId>')
 *   4. Increments customers.credit_balance by bonus_credit_amount
 *
 * This follows the exact same raw-pg-pool pattern used by Brick 5's
 * accountCreditsRepo.applyCredit() — same pool import, same BEGIN/COMMIT/ROLLBACK
 * structure, same customers.credit_balance SQL. No second balance-write path is
 * introduced.
 *
 * All IDs are text. No parseInt anywhere.
 */

import { pool } from "../db";
import { nanoid } from "nanoid";
import { referralsRepo } from "../repositories/referrals";
import {
  REFERRAL_STATUSES,
  type ReferralStatus,
  type Referral,
} from "../../shared/schema-v2";

// ── Status transition table ───────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  pending:   ["qualified", "cancelled", "expired"],
  qualified: ["vested",    "cancelled", "expired"],
  vested:    [],                                    // terminal
  cancelled: [],                                    // terminal
  expired:   [],                                    // terminal
};

function isAllowed(from: ReferralStatus, to: ReferralStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const referralService = {
  /**
   * createReferral
   * Creates a new referral row with status='pending'.
   * bonusCreditAmount is a numeric string (e.g. "25.00").
   */
  async createReferral(opts: {
    referrerCustomerId: string;
    referredCustomerId: string;
    bonusCreditAmount:  string;   // numeric string — matches money() column
    vestsAt?:           Date | null;
  }): Promise<Referral> {
    const { referrerCustomerId, referredCustomerId, bonusCreditAmount, vestsAt } = opts;

    if (referrerCustomerId === referredCustomerId) {
      throw Object.assign(new Error("Referrer and referred customer must be different"), { status: 400 });
    }

    return referralsRepo.create({
      referrerCustomerId,
      referredCustomerId,
      bonusCreditAmount,
      status: "pending",
      vestsAt: vestsAt ?? null,
    });
  },

  /**
   * advanceStatus
   * Validates and applies a status transition for a referral.
   * If the target status is 'vested', delegates to vestReferral() for atomicity.
   */
  async advanceStatus(
    id:        string,
    newStatus: ReferralStatus,
  ): Promise<Referral> {
    if (!REFERRAL_STATUSES.includes(newStatus)) {
      throw Object.assign(
        new Error(`Invalid status '${newStatus}'. Must be one of: ${REFERRAL_STATUSES.join(", ")}`),
        { status: 400 },
      );
    }

    const referral = await referralsRepo.getById(id);
    if (!referral) {
      throw Object.assign(new Error("Referral not found"), { status: 404 });
    }

    const current = referral.status as ReferralStatus;

    if (current === newStatus) return referral;  // idempotent no-op

    if (!isAllowed(current, newStatus)) {
      throw Object.assign(
        new Error(
          `Invalid transition '${current}' → '${newStatus}'. ` +
          `Allowed from '${current}': [${ALLOWED_TRANSITIONS[current].join(", ") || "none"}]`,
        ),
        { status: 409 },
      );
    }

    if (newStatus === "vested") {
      return referralService.vestReferral(referral);
    }

    const updated = await referralsRepo.setStatus(id, newStatus);
    if (!updated) throw Object.assign(new Error("Referral update failed"), { status: 500 });
    return updated;
  },

  /**
   * vestReferral
   *
   * Atomic pg transaction — mirrors Brick 5 accountCreditsRepo.applyCredit():
   *   BEGIN
   *   SELECT ... FOR UPDATE          — lock the row; detect double-vest
   *   UPDATE referrals status='vested'
   *   INSERT account_credits (source='referral:<id>')
   *   UPDATE customers credit_balance += bonus_credit_amount
   *   COMMIT
   *
   * Double-vest guard: if the row is already 'vested' when the lock is acquired,
   * return the existing row without error (idempotent).
   */
  async vestReferral(referral: Referral): Promise<Referral> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lock the row to prevent concurrent double-vest
      const lockRes = await client.query(
        `SELECT id, status, referrer_customer_id, bonus_credit_amount
         FROM referrals
         WHERE id = $1
         FOR UPDATE`,
        [referral.id],
      );
      if (lockRes.rows.length === 0) {
        throw Object.assign(new Error("Referral not found"), { status: 404 });
      }

      const live = lockRes.rows[0];

      // Idempotent: already vested — return current state, no error
      if (live.status === "vested") {
        await client.query("ROLLBACK");
        const existing = await referralsRepo.getById(referral.id);
        return existing!;
      }

      // 1. Advance status
      await client.query(
        `UPDATE referrals SET status = 'vested', updated_at = NOW() WHERE id = $1`,
        [referral.id],
      );

      // 2. Insert account_credits row for the referrer
      //    source = 'referral:<referralId>' for traceability
      //    applied = false (credit available to use, not yet consumed)
      const creditId = nanoid();
      await client.query(
        `INSERT INTO account_credits (id, customer_id, amount, source, applied)
         VALUES ($1, $2, $3, $4, false)`,
        [
          creditId,
          live.referrer_customer_id,
          live.bonus_credit_amount,
          `referral:${referral.id}`,
        ],
      );

      // 3. Increment referrer's credit_balance
      //    Matches Brick 5 pattern (accountCreditsRepo.applyCredit) but in the
      //    issuance direction: += instead of -=.
      await client.query(
        `UPDATE customers
         SET credit_balance = credit_balance::numeric + $1::numeric
         WHERE id = $2`,
        [live.bonus_credit_amount, live.referrer_customer_id],
      );

      await client.query("COMMIT");

      // Return the freshly-committed referral row via Drizzle
      const updated = await referralsRepo.getById(referral.id);
      return updated!;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
