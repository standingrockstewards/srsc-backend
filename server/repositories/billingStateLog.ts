import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { billingStateLog, propertiesV2 } from "../../shared/schema-v2";

export type BillingState = "current" | "grace" | "delinquent";

export const billingStateLogRepo = {
  /**
   * Append a state transition AND update properties.billing_state atomically.
   * Both propertyId and the log id are text.
   */
  async transition(
    propertyId: string,
    fromState: BillingState,
    toState: BillingState,
    reason?: string,
  ) {
    const [logRow] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(billingStateLog)
        .values({ propertyId, fromState, toState, reason: reason ?? null })
        .returning();

      await tx
        .update(propertiesV2)
        .set({ billingState: toState, updatedAt: new Date() })
        .where(eq(propertiesV2.id, propertyId));

      return inserted;
    });
    return logRow;
  },

  async listByProperty(propertyId: string) {
    return db
      .select()
      .from(billingStateLog)
      .where(eq(billingStateLog.propertyId, propertyId))
      .orderBy(desc(billingStateLog.createdAt));
  },
};
