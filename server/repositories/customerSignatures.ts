import { eq } from "drizzle-orm";
import { db } from "../db";
import { customerSignatures, type InsertCustomerSignature } from "../../shared/schema-v2";

export const customerSignaturesRepo = {
  /** Append-only: no update/delete exposed */
  async create(data: InsertCustomerSignature) {
    const [row] = await db.insert(customerSignatures).values(data).returning();
    return row;
  },

  async getById(id: number) {
    const [row] = await db.select().from(customerSignatures).where(eq(customerSignatures.id, id));
    return row ?? null;
  },

  async listByCustomer(customerId: number) {
    return db
      .select()
      .from(customerSignatures)
      .where(eq(customerSignatures.customerId, customerId))
      .orderBy(customerSignatures.signedAt);
  },

  async listByDocument(signedDocument: string) {
    return db
      .select()
      .from(customerSignatures)
      .where(eq(customerSignatures.signedDocument, signedDocument))
      .orderBy(customerSignatures.signedAt);
  },
};
