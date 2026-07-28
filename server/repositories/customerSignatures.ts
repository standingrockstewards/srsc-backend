import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { customerSignatures, legalDocuments, type InsertCustomerSignature } from "../../shared/schema-v2";

export const customerSignaturesRepo = {
  /** Append-only: no update/delete ever exposed. */
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

  /**
   * Check whether a customer has signed the currently-active version of a docType.
   * Joins customer_signatures.legal_document_id → legal_documents.id and confirms
   * that document has active=true and docType matches.
   */
  async hasSignedActive(customerId: number, docType: string): Promise<boolean> {
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
