/**
 * Discount tier service.
 * Derives discountTierPct from customer's activePropertyCount
 * and writes it to every property belonging to that customer.
 *
 * Tiers:
 *   1 property  →  0%
 *   2–3         →  5%
 *   4–5         → 10%
 *   6+          → 15%
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { propertiesV2 } from "../../shared/schema-v2";
import { customersRepo } from "../repositories/customers";

export function deriveDiscountPct(activePropertyCount: number): number {
  if (activePropertyCount >= 6) return 15;
  if (activePropertyCount >= 4) return 10;
  if (activePropertyCount >= 2) return 5;
  return 0;
}

/**
 * Recalculate and persist discountTierPct for all active properties
 * belonging to the given customer.
 */
export async function refreshDiscountTier(customerId: number): Promise<void> {
  const customer = await customersRepo.getById(customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found`);

  const pct = deriveDiscountPct(customer.activePropertyCount);

  await db
    .update(propertiesV2)
    .set({ discountTierPct: pct, updatedAt: new Date() })
    .where(eq(propertiesV2.customerId, customerId));
}
