import { eq } from "drizzle-orm";
import { db } from "../db";
import { vendorPayments, type InsertVendorPayment } from "../../shared/schema-v2";

export const vendorPaymentsRepo = {
  async getAll() {
    return db.select().from(vendorPayments).orderBy(vendorPayments.createdAt);
  },

  async getById(id: number) {
    const [row] = await db.select().from(vendorPayments).where(eq(vendorPayments.id, id));
    return row ?? null;
  },

  async listByVendor(vendorId: number) {
    return db
      .select()
      .from(vendorPayments)
      .where(eq(vendorPayments.vendorId, vendorId))
      .orderBy(vendorPayments.createdAt);
  },

  async create(data: InsertVendorPayment) {
    const [row] = await db.insert(vendorPayments).values(data).returning();
    return row;
  },

  async update(id: number, data: Partial<InsertVendorPayment>) {
    const [row] = await db
      .update(vendorPayments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vendorPayments.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: number) {
    await db.delete(vendorPayments).where(eq(vendorPayments.id, id));
  },
};
