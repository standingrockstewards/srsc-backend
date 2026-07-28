import { eq } from "drizzle-orm";
import { db } from "../db";
import { vendors, type InsertVendor } from "../../shared/schema-v2";

export const vendorsRepo = {
  async getAll() {
    return db.select().from(vendors).orderBy(vendors.createdAt);
  },

  async getById(id: string) {
    const [row] = await db.select().from(vendors).where(eq(vendors.id, id));
    return row ?? null;
  },

  async getByEmail(email: string) {
    const [row] = await db.select().from(vendors).where(eq(vendors.email, email));
    return row ?? null;
  },

  async create(data: InsertVendor) {
    const [row] = await db.insert(vendors).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertVendor>) {
    const [row] = await db
      .update(vendors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(vendors).where(eq(vendors.id, id));
  },

  async updateScore(vendorId: string, publicScore: string, reviewCount: number) {
    const [row] = await db
      .update(vendors)
      .set({ publicScore, reviewCount, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();
    return row ?? null;
  },
};
