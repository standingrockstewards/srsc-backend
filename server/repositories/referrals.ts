/**
 * server/repositories/referrals.ts  (Brick 9)
 *
 * All IDs (id, referrerCustomerId, referredCustomerId) are text (nanoid/cuid2).
 * status is plain text — enforced as ReferralStatus union in the service layer.
 * bonusCreditAmount is numeric — returned as string by pg driver; callers parse
 * as needed.
 *
 * The service layer owns all transition logic; the repo just persists.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  referrals,
  type InsertReferral,
  type ReferralStatus,
} from "../../shared/schema-v2";

export const referralsRepo = {
  async create(data: InsertReferral) {
    const [row] = await db.insert(referrals).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.id, id));
    return row ?? null;
  },

  async listByReferrer(referrerCustomerId: string) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerCustomerId, referrerCustomerId))
      .orderBy(referrals.createdAt);
  },

  async listByReferred(referredCustomerId: string) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referredCustomerId, referredCustomerId))
      .orderBy(referrals.createdAt);
  },

  async listByStatus(status: ReferralStatus) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.status, status))
      .orderBy(referrals.createdAt);
  },

  async getAll() {
    return db.select().from(referrals).orderBy(referrals.createdAt);
  },

  /**
   * Raw status + updatedAt write.
   * All callers should go through referralService.advanceStatus() for guard logic.
   * This helper is intentionally thin — no transition validation here.
   */
  async setStatus(id: string, status: ReferralStatus) {
    const [row] = await db
      .update(referrals)
      .set({ status, updatedAt: new Date() })
      .where(eq(referrals.id, id))
      .returning();
    return row ?? null;
  },
};
