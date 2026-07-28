import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { customerSignatures, legalDocuments, type InsertCustomerSignature } from "../../shared/schema-v2";

export const customerSignaturesRepo = {
  async create(data: InsertCustomerSignature) {
    const [row] = await db.insert(customerSignatures).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db.select().from(customerSignatures).where(eq(customerSignatures.id, id));
    return row ?? null;
  },

  async listByCustomer(customerId: string) {
    return db
      .select()
      .from(customerSignatures)
      .where(eq(customerSignatures.customerId, customerId))
      .orderBy(customerSignatures.signedAt);
  },

  async hasSignedActive(customerId: string, docType: string): Promise<boolean> {
    const rows = await db
      .select({ sigId: customerSignatures.id })
      .from(customerSignatures)
      .innerJoin(legalDocuments, eq(customerSignatures.legalDocumentId, legalDocuments.id))
      .where(
        and(
          eq(customerSignatures.customerId, customerId),
          eq(legalDocuments.docType, docType),
          eq(legalDocuments.active, true),
        ),
      )
      .limit(1);
    return rows.length > 0;
  },
};
