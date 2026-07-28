import { eq } from "drizzle-orm";
import { db } from "../db";
import { vendors, type InsertVendor } from "../../shared/schema-v2";

export const vendorsRepo = {
  async getAll() {
    return db.select().from(vendors).orderBy(vendors.createdAt);
  },

  async getById(id: number) {
    const [row] = await db.select().from(vendors).where(eq(vendors.id, id));
    return row ?? null;
  },

  async create(data: InsertVendor) {
    const [row] = await db.insert(vendors).values(data).returning();
    return row;
  },

  async update(id: number, data: Partial<InsertVendor>) {
    const [row] = await db
      .update(vendors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return row ?? null;
  },

  /** Internal — used by scoring service to update score + count atomically */
  async updateScore(id: number, publicScore: string, reviewCount: number) {
    const [row] = await db
      .update(vendors)
      .set({ publicScore, reviewCount, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: number) {
    await db.delete(vendors).where(eq(vendors.id, id));
  },
};
