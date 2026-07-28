import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { legalDocuments } from "../../shared/schema-v2";

export const legalDocumentsRepo = {
  async getAll() {
    return db.select().from(legalDocuments).orderBy(legalDocuments.effectiveDate);
  },

  async getById(id: number) {
    const [row] = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id));
    return row ?? null;
  },

  /** Get the currently active document for a given type (e.g. 'ToS', 'ServiceAgreement') */
  async getActiveByType(docType: string) {
    const [row] = await db
      .select()
      .from(legalDocuments)
      .where(and(eq(legalDocuments.docType, docType), eq(legalDocuments.active, true)));
    return row ?? null;
  },

  async listByType(docType: string) {
    return db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.docType, docType))
      .orderBy(legalDocuments.effectiveDate);
  },

  async create(data: {
    docType: string;
    version: string;
    bodyMd: string;
    effectiveDate: string;
    active?: boolean;
  }) {
    const [row] = await db.insert(legalDocuments).values(data).returning();
    return row;
  },

  /** Only allows toggling active; body/version are immutable after creation */
  async setActive(id: number, active: boolean) {
    const [row] = await db
      .update(legalDocuments)
      .set({ active })
      .where(eq(legalDocuments.id, id))
      .returning();
    return row ?? null;
  },
};
