import { eq } from "drizzle-orm";
import { db } from "../db";
import { referrals, type InsertReferral } from "../../shared/schema-v2";

export const referralsRepo = {
  async getAll() {
    return db.select().from(referrals).orderBy(referrals.createdAt);
  },

  async getById(id: string) {
    const [row] = await db.select().from(referrals).where(eq(referrals.id, id));
    return row ?? null;
  },

  async listByReferrer(referrerCustomerId: string) {
    return db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerCustomerId, referrerCustomerId))
      .orderBy(referrals.createdAt);
  },

  async create(data: InsertReferral) {
    const [row] = await db.insert(referrals).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertReferral>) {
    const [row] = await db
      .update(referrals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(referrals.id, id))
      .returning();
    return row ?? null;
  },
};
