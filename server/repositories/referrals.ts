import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { referrals, type InsertReferral } from "../../shared/schema-v2";

export const referralsRepo = {
  async create(data: InsertReferral) {
    const [row] = await db.insert(referrals).values(data).returning();
    return row;
  },

  async getById(id: number) {
    const [row] = await db.select().from(referrals).where(eq(referrals.id, id));
    return row ?? null;
  },

  async listByReferrer(referrerCustomerId: number) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerCustomerId, referrerCustomerId))
      .orderBy(referrals.createdAt);
  },

  async markVested(id: number) {
    const [row] = await db
      .update(referrals)
      .set({ status: "vested", updatedAt: new Date() })
      .where(eq(referrals.id, id))
      .returning();
    return row ?? null;
  },

  async markForfeited(id: number) {
    const [row] = await db
      .update(referrals)
      .set({ status: "forfeited", updatedAt: new Date() })
      .where(eq(referrals.id, id))
      .returning();
    return row ?? null;
  },
};
