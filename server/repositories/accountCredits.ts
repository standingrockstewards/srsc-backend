import { eq, and } from "drizzle-orm";
import { db, pool } from "../db";
import { accountCredits, type InsertAccountCredit } from "../../shared/schema-v2";

export const accountCreditsRepo = {
  async create(data: InsertAccountCredit) {
    const [row] = await db.insert(accountCredits).values(data).returning();
    return row;
  },

  async getById(id: string) {
    const [row] = await db.select().from(accountCredits).where(eq(accountCredits.id, id));
    return row ?? null;
  },

  async listByCustomer(customerId: string) {
    return db
      .select()
      .from(accountCredits)
      .where(eq(accountCredits.customerId, customerId))
      .orderBy(accountCredits.createdAt);
  },

  async listUnapplied(customerId: string) {
    return db
      .select()
      .from(accountCredits)
      .where(and(eq(accountCredits.customerId, customerId), eq(accountCredits.applied, false)))
      .orderBy(accountCredits.createdAt);
  },

  /**
   * Atomically:
   *   1. Mark credit as applied=true (with row lock)
   *   2. Post a credit_applied entry to retainer_ledger for the given propertyId
   *   3. Decrement customers.credit_balance by the credit amount
   * All IDs are text throughout.
   */
  async applyCredit(
    creditId: string,
    propertyId: string,
  ): Promise<{ credit: typeof accountCredits.$inferSelect; newRetainerBalance: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const creditRes = await client.query(
        `SELECT * FROM account_credits WHERE id = $1 FOR UPDATE`,
        [creditId],
      );
      if (creditRes.rows.length === 0) throw Object.assign(new Error("Credit not found"), { status: 404 });
      const credit = creditRes.rows[0];
      if (credit.applied) throw Object.assign(new Error("Credit already applied"), { status: 409 });

      await client.query(`UPDATE account_credits SET applied = true WHERE id = $1`, [creditId]);

      const ledgerRes = await client.query(
        `SELECT balance_after FROM retainer_ledger WHERE property_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [propertyId],
      );
      const currentBalance = parseFloat(ledgerRes.rows[0]?.balance_after ?? "0");
      const creditAmount   = parseFloat(credit.amount);
      const newBalance     = (currentBalance + creditAmount).toFixed(2);

      await client.query(
        `INSERT INTO retainer_ledger (id, property_id, type, amount, balance_after, note)
         VALUES ($1, $2, 'credit_applied', $3, $4, $5)`,
        [
          // generate a nanoid-style id for the raw insert
          Math.random().toString(36).slice(2) + Date.now().toString(36),
          propertyId,
          credit.amount,
          newBalance,
          `Credit ${creditId} applied`,
        ],
      );

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
