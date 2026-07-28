import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import { billingStateLog, propertiesV2 } from "../../shared/schema-v2";

export type BillingState = "current" | "grace" | "delinquent";

export const billingStateLogRepo = {
  /**
   * Append a state transition log entry AND update properties.billing_state
   * in the same Drizzle transaction.
   */
  async transition(
    propertyId: number,
    fromState: BillingState,
    toState: BillingState,
    reason?: string,
  ) {
    const id = nanoid();
    // Run both writes together
    const [logRow] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(billingStateLog)
        .values({ id, propertyId, fromState, toState, reason: reason ?? null })
        .returning();

      await tx
        .update(propertiesV2)
        .set({ billingState: toState, updatedAt: new Date() })
        .where(eq(propertiesV2.id, propertyId));

      return inserted;
    });
    return logRow;
  },

  /** Full transition history for a property, newest-first */
  async listByProperty(propertyId: number) {
    return db
      .select()
      .from(billingStateLog)
      .where(eq(billingStateLog.propertyId, propertyId))
      .orderBy(desc(billingStateLog.createdAt));
  },
};
