import { eq } from "drizzle-orm";
import { db } from "../db";
import { propertiesV2, type InsertPropertyV2 } from "../../shared/schema-v2";

export const propertiesRepo = {
  async getAll() {
    return db.select().from(propertiesV2).orderBy(propertiesV2.createdAt);
  },

  async getById(id: string) {
    const [row] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, id));
    return row ?? null;
  },

  async listByCustomer(customerId: string) {
    return db
      .select()
      .from(propertiesV2)
      .where(eq(propertiesV2.customerId, customerId))
      .orderBy(propertiesV2.createdAt);
  },

  async create(data: InsertPropertyV2) {
    const [row] = await db.insert(propertiesV2).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertPropertyV2>) {
    const [row] = await db
      .update(propertiesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(propertiesV2.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(propertiesV2).where(eq(propertiesV2.id, id));
  },
};
