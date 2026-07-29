/**
 * server/repositories/vaultAuditLog.ts  (Brick 10h)
 *
 * Append-only audit log for every vault decrypt read.
 *
 * AUDIT-FIRST CONTRACT (hard rule):
 *   The insert MUST succeed before any decrypted values are returned.
 *   If this insert throws, the caller MUST return 503 without returning data.
 *   There are intentionally NO update or delete methods — log entries are permanent.
 *
 * fields_read records exactly which sensitive fields were decrypted on that call.
 */

import { db } from "../db";
import { vaultAccessLog, type VaultAccessLog } from "../../shared/schema-v2";
import type { VaultFieldName } from "../services/vaultService";

export interface AuditEntry {
  propertyId:  string;
  userId:      string;       // string representation of SQLite users.id
  userRole:    string;
  fieldsRead:  VaultFieldName[];  // exactly which fields were decrypted
  ipAddress?:  string | null;
}

export const vaultAuditLogRepo = {
  /**
   * Append a single audit entry.
   * MUST be called before returning decrypted values — caller enforces audit-first.
   * Throws on DB error — caller interprets as 503 and does NOT return decrypted data.
   */
  async append(entry: AuditEntry): Promise<VaultAccessLog> {
    const [row] = await db
      .insert(vaultAccessLog)
      .values({
        propertyId:  entry.propertyId,
        userId:      entry.userId,
        userRole:    entry.userRole,
        fieldsRead:  entry.fieldsRead,
        ipAddress:   entry.ipAddress ?? null,
      })
      .returning();
    return row;
  },

  /** List audit entries for a given property (admin use). */
  async getByProperty(propertyId: string): Promise<VaultAccessLog[]> {
    const { eq, desc } = await import("drizzle-orm");
    return db
      .select()
      .from(vaultAccessLog)
      .where(eq(vaultAccessLog.propertyId, propertyId))
      .orderBy(desc(vaultAccessLog.accessedAt));
  },
};
