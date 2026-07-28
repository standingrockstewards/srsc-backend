import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { accountCredits, type InsertAccountCredit } from "../../shared/schema-v2";

export const accountCreditsRepo = {
  async create(data: InsertAccountCredit) {
    const [row] = await db.insert(accountCredits).values(data).returning();
    return row;
  },

  async listByCustomer(customerId: number) {
    return db
      .select()
      .from(accountCredits)
      .where(eq(accountCredits.customerId, customerId))
      .orderBy(accountCredits.createdAt);
  },

  async listUnapplied(customerId: number) {
    return db
      .select()
      .from(accountCredits)
      .where(
        and(
          eq(accountCredits.customerId, customerId),
          eq(accountCredits.applied, false),
        )
      )
      .orderBy(accountCredits.createdAt);
  },

  async markApplied(id: number) {
    const [row] = await db
      .update(accountCredits)
      .set({ applied: true })
      .where(eq(accountCredits.id, id))
      .returning();
    return row ?? null;
  },
};
