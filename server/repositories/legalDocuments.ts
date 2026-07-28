import { eq, and } from "drizzle-orm";
import { db, pool } from "../db";
import { legalDocuments, type InsertLegalDocument } from "../../shared/schema-v2";

export const legalDocumentsRepo = {
  async getAll() {
    return db.select().from(legalDocuments).orderBy(legalDocuments.effectiveDate);
  },

  async getById(id: string) {
    const [row] = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id));
    return row ?? null;
  },

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

  /**
   * Insert a new document version.
   * If active=true, atomically deactivates the previous active version of the
   * same docType in the same transaction — guaranteeing at most one active per docType.
   */
  async createWithAtomicActivate(data: InsertLegalDocument): Promise<typeof legalDocuments.$inferSelect> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // If the new doc is being set active, deactivate existing active version(s)
      if (data.active) {
        await client.query(
          `UPDATE legal_documents SET active = false WHERE doc_type = $1 AND active = true`,
          [data.docType],
        );
      }

      const result = await client.query<typeof legalDocuments.$inferSelect>(
        `INSERT INTO legal_documents (id, doc_type, version, body_md, effective_date, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [data.id, data.docType, data.version, data.bodyMd, data.effectiveDate, data.active ?? false],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /** Toggle active flag only — does NOT enforce single-active constraint; use createWithAtomicActivate for new docs */
  async setActive(id: string, active: boolean) {
    const [row] = await db
      .update(legalDocuments)
      .set({ active })
      .where(eq(legalDocuments.id, id))
      .returning();
    return row ?? null;
  },
};
