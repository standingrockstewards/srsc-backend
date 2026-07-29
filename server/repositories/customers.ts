import { eq } from "drizzle-orm";
import { db } from "../db";
import { customers, type InsertCustomer } from "../../shared/schema-v2";

export const customersRepo = {
  async getAll() {
    return db.select().from(customers).orderBy(customers.createdAt);
  },

  async getById(id: string) {
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    return row ?? null;
  },

  async getByEmail(email: string) {
    const [row] = await db.select().from(customers).where(eq(customers.email, email));
    return row ?? null;
  },

  /**
   * Brick 10V: schema-safe variant used by auth middleware.
   * The live `customers` table has schema drift (missing `phone`, `updated_at`).
   * Selecting only `id` avoids querying non-existent columns.
   * Auth only needs the customer id for the v2CustomerId join.
   */
  async getIdByEmail(email: string): Promise<{ id: string } | null> {
    const [row] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, email));
    return row ?? null;
  },

  async create(data: InsertCustomer) {
    const [row] = await db.insert(customers).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertCustomer>) {
    const [row] = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(customers).where(eq(customers.id, id));
  },
};
