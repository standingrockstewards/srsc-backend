import { eq, and } from "drizzle-orm";
import { db, pool } from "../db";
import { accountCredits, type InsertAccountCredit } from "../../shared/schema-v2";

export const accountCreditsRepo = {
  async create(data: InsertAccountCredit) {
    const [row] = await db.insert(accountCredits).values(data).returning();
    return row;
  },

  async getById(id: number) {
    const [row] = await db.select().from(accountCredits).where(eq(accountCredits.id, id));
    return row ?? null;
  },

  async listByCustomer(customerId: number) {
    return db
      .select()
      .from(accountCredits)
      .where(eq(accountCredits.customerId, customerId))
      .orderBy(accountCredits.createdAt);
  },

  async listUnapplied(customerId: number) {
    return db
      .select()
      .from(accountCredits)
      .where(and(eq(accountCredits.customerId, customerId), eq(accountCredits.applied, false)))
      .orderBy(accountCredits.createdAt);
  },

  /**
   * Atomically:
   *   1. Mark credit as applied=true.
   *   2. Post a credit_applied entry to retainer_ledger for the given propertyId.
   *   3. Decrement customers.credit_balance by the credit amount.
   * Uses raw pg transaction for cross-table atomicity.
   * Throws if the credit is already applied.
   */
  async applyCredit(
    creditId: number,
    propertyId: number,
  ): Promise<{ credit: typeof accountCredits.$inferSelect; newRetainerBalance: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Fetch and lock the credit row
      const creditRes = await client.query(
        `SELECT * FROM account_credits WHERE id = $1 FOR UPDATE`,
        [creditId],
      );
      if (creditRes.rows.length === 0) throw Object.assign(new Error("Credit not found"), { status: 404 });
      const credit = creditRes.rows[0];
      if (credit.applied) throw Object.assign(new Error("Credit already applied"), { status: 409 });

      // Mark applied
      await client.query(`UPDATE account_credits SET applied = true WHERE id = $1`, [creditId]);

      // Get current retainer balance
      const ledgerRes = await client.query(
        `SELECT balance_after FROM retainer_ledger WHERE property_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [propertyId],
      );
      const currentBalance = parseFloat(ledgerRes.rows[0]?.balance_after ?? "0");
      const creditAmount   = parseFloat(credit.amount);
      const newBalance     = (currentBalance + creditAmount).toFixed(2);

      // Post retainer entry
      await client.query(
        `INSERT INTO retainer_ledger (property_id, type, amount, balance_after, note)
         VALUES ($1, 'credit_applied', $2, $3, $4)`,
        [propertyId, credit.amount, newBalance, `Credit #${creditId} applied`],
      );

      // Decrement customers.credit_balance (floor at 0)
      await client.query(
        `UPDATE customers
         SET credit_balance = GREATEST(0, credit_balance::numeric - $1::numeric)
         WHERE id = $2`,
        [credit.amount, credit.customer_id],
      );

      await client.query("COMMIT");
      return { credit: { ...credit, applied: true }, newRetainerBalance: newBalance };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
