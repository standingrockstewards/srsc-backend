import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { retainerLedger } from "../../shared/schema-v2";

export const retainerLedgerRepo = {
  /** Newest-first ledger for a property */
  async listByProperty(propertyId: number) {
    return db
      .select()
      .from(retainerLedger)
      .where(eq(retainerLedger.propertyId, propertyId))
      .orderBy(desc(retainerLedger.createdAt));
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
   * Append-only insert. Computes balanceAfter based on the latest entry.
   * type='deposit' adds, type='debit' subtracts, type='adjustment' sets absolutely.
   */
  async recordEntry(
    propertyId: number,
    type: "deposit" | "debit" | "adjustment",
    amount: string,   // keep as string/numeric, never float
    note?: string,
  ) {
    const latest = await retainerLedgerRepo.getLatest(propertyId);
    const currentBalance = latest ? parseFloat(latest.balanceAfter) : 0;

    let newBalance: number;
    if (type === "deposit") {
      newBalance = currentBalance + parseFloat(amount);
    } else if (type === "debit") {
      newBalance = currentBalance - parseFloat(amount);
    } else {
      // adjustment: treat amount as the new absolute balance
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

  // Edits and deletes are intentionally NOT exposed here.
};
