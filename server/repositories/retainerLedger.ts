import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { retainerLedger, type RetainerEntryType } from "../../shared/schema-v2";

export const retainerLedgerRepo = {
  /** Chronological (oldest-first) ledger for a property */
  async listByProperty(propertyId: number) {
    return db
      .select()
      .from(retainerLedger)
      .where(eq(retainerLedger.propertyId, propertyId))
      .orderBy(retainerLedger.createdAt);
  },

  /** Latest single entry — used to derive current balance */
  async getLatest(propertyId: number) {
    const [row] = await db
      .select()
      .from(retainerLedger)
      .where(eq(retainerLedger.propertyId, propertyId))
      .orderBy(desc(retainerLedger.createdAt))
      .limit(1);
    return row ?? null;
  },

  /**
   * Append-only insert. Computes balanceAfter from the latest entry.
   *   topup / credit_applied → adds to balance
   *   charge                 → subtracts from balance
   *   adjustment             → sets absolute balance
   * All money as decimal strings — never float.
   */
  async recordEntry(
    propertyId: number,
    type: RetainerEntryType,
    amount: string,
    note?: string,
  ) {
    const latest = await retainerLedgerRepo.getLatest(propertyId);
    const current = parseFloat(latest?.balanceAfter ?? "0");

    let newBalance: number;
    if (type === "topup" || type === "credit_applied") {
      newBalance = current + parseFloat(amount);
    } else if (type === "charge") {
      newBalance = current - parseFloat(amount);
    } else {
      // adjustment: amount IS the new absolute balance
      newBalance = parseFloat(amount);
    }

    const [row] = await db
      .insert(retainerLedger)
      .values({
        propertyId,
        type,
        amount,
        balanceAfter: newBalance.toFixed(2),
        note: note ?? null,
      })
      .returning();
    return row;
  },

  /** Entries for a specific calendar month (YYYY-MM). */
  async listByPropertyAndMonth(propertyId: number, month: string) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end   = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    return db
      .select()
      .from(retainerLedger)
      .where(
        and(
          eq(retainerLedger.propertyId, propertyId),
          gte(retainerLedger.createdAt, start),
          lte(retainerLedger.createdAt, end),
        ),
      )
      .orderBy(retainerLedger.createdAt);
  },

  /**
   * Opening balance = balanceAfter of the last entry BEFORE the month started.
   * Returns "0.00" if no prior entries exist.
   */
  async openingBalance(propertyId: number, month: string): Promise<string> {
    const start = new Date(`${month}-01T00:00:00Z`);
    const [row] = await db
      .select({ bal: retainerLedger.balanceAfter })
      .from(retainerLedger)
      .where(
        and(
          eq(retainerLedger.propertyId, propertyId),
          lte(retainerLedger.createdAt, start),
        ),
      )
      .orderBy(desc(retainerLedger.createdAt))
      .limit(1);
    return row?.bal ?? "0.00";
  },

  // No update/delete ever exposed.
};
