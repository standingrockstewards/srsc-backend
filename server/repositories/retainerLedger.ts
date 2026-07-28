import { eq, desc, and, gte, lt } from "drizzle-orm";
import { db } from "../db";
import { retainerLedger, type RetainerEntryType } from "../../shared/schema-v2";

export const retainerLedgerRepo = {
  async listByProperty(propertyId: string) {
    return db
      .select()
      .from(retainerLedger)
      .where(eq(retainerLedger.propertyId, propertyId))
      .orderBy(retainerLedger.createdAt);
  },

  async getLatest(propertyId: string) {
    const [row] = await db
      .select()
      .from(retainerLedger)
      .where(eq(retainerLedger.propertyId, propertyId))
      .orderBy(desc(retainerLedger.createdAt))
      .limit(1);
    return row ?? null;
  },

  async recordEntry(
    propertyId: string,
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

  async listByPropertyAndMonth(propertyId: string, month: string) {
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
          lt(retainerLedger.createdAt, end),
        ),
      )
      .orderBy(retainerLedger.createdAt);
  },

  async openingBalance(propertyId: string, month: string): Promise<string> {
    const start = new Date(`${month}-01T00:00:00Z`);
    const [row] = await db
      .select({ bal: retainerLedger.balanceAfter })
      .from(retainerLedger)
      .where(
        and(
          eq(retainerLedger.propertyId, propertyId),
          lt(retainerLedger.createdAt, start),
        ),
      )
      .orderBy(desc(retainerLedger.createdAt))
      .limit(1);
    return row?.bal ?? "0.00";
  },
};
