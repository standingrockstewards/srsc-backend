/**
 * Referral service — create and vest referrals.
 * Vesting creates an account credit for the referrer; no cash-out.
 */

import { referralsRepo } from "../repositories/referrals";
import { accountCreditsRepo } from "../repositories/accountCredits";
import { customersRepo } from "../repositories/customers";
import type { InsertReferral } from "../../shared/schema-v2";

export const referralService = {
  async create(data: InsertReferral) {
    return referralsRepo.create(data);
  },

  /**
   * Vest a referral:
   * 1. Marks referral status = 'vested'
   * 2. Creates an account_credits row for the referrer (source = 'referral')
   * Returns { referral, credit }
   */
  async vest(referralId: number) {
    const referral = await referralsRepo.getById(referralId);
    if (!referral) throw new Error(`Referral ${referralId} not found`);
    if (referral.status !== "pending") {
      throw new Error(
        `Referral ${referralId} cannot be vested — current status: ${referral.status}`
      );
    }

    const [vested, credit] = await Promise.all([
      referralsRepo.markVested(referralId),
      accountCreditsRepo.create({
        customerId: referral.referrerCustomerId,
        amount: referral.bonusCreditAmount,
        source: "referral",
        applied: false,
      }),
    ]);

    return { referral: vested, credit };
  },

  async listByReferrer(referrerCustomerId: number) {
    return referralsRepo.listByReferrer(referrerCustomerId);
  },
};
