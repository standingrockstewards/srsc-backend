/**
 * server/services/retainerService.ts  (Brick 5 — text-ID rewrite)
 *
 * All propertyId values are text (nanoid/cuid2) throughout.
 * No parseInt, no number cast on any ID.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { propertiesV2, type RetainerEntryType } from "../../shared/schema-v2";
import { retainerLedgerRepo } from "../repositories/retainerLedger";
import { billingStateLogRepo, type BillingState } from "../repositories/billingStateLog";
import { paymentProvider } from "./paymentProvider";

const GRACE_DAYS = parseInt(process.env.DUNNING_GRACE_DAYS ?? "7", 10);

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyDiscount(amount: string, discountPct: number): string {
  const raw = parseFloat(amount) * (1 - discountPct / 100);
  return raw.toFixed(2);
}

function isLowBalance(balance: string, target: string, alertPct: number): boolean {
  return parseFloat(balance) < parseFloat(target) * (alertPct / 100);
}

// ── Dunning evaluator ─────────────────────────────────────────────────────────

async function evaluateDunning(
  propertyId: string,                           // text ID
  newBalance: string,
  property: {
    targetRetainerAmount: string;
    lowBalanceAlertPct: number;
    billingState: string;
    updatedAt: Date;
  },
): Promise<void> {
  const threshold    = parseFloat(property.targetRetainerAmount) * (property.lowBalanceAlertPct / 100);
  const balance      = parseFloat(newBalance);
  const currentState = property.billingState as BillingState;

  let targetState: BillingState;
  if (balance >= threshold) {
    targetState = "current";
  } else {
    const daysSinceUpdate = (Date.now() - property.updatedAt.getTime()) / 86_400_000;
    targetState = daysSinceUpdate <= GRACE_DAYS ? "grace" : "delinquent";
  }

  if (targetState !== currentState) {
    await billingStateLogRepo.transition(
      propertyId,
      currentState,
      targetState,
      `Balance ${newBalance} vs threshold ${threshold.toFixed(2)}`,
    );
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const retainerService = {
  /**
   * Post a topup (direct deposit).
   * discountTierPct does NOT reduce top-ups — only charges.
   */
  async topup(propertyId: string, amount: string, note?: string) {
    const entry = await retainerLedgerRepo.recordEntry(propertyId, "topup", amount, note);
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (property) await evaluateDunning(propertyId, entry.balanceAfter, property);
    return entry;
  },

  /**
   * Post a service charge.
   * Amount is reduced by the property's discountTierPct before posting.
   */
  async charge(propertyId: string, grossAmount: string, note?: string) {
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (!property) throw Object.assign(new Error("Property not found"), { status: 404 });

    const netAmount = applyDiscount(grossAmount, property.discountTierPct);
    const entry = await retainerLedgerRepo.recordEntry(propertyId, "charge", netAmount, note);

    await evaluateDunning(propertyId, entry.balanceAfter, property);
    return { entry, grossAmount, netAmount, discountPct: property.discountTierPct };
  },

  /**
   * Post a manual adjustment (sets absolute balance). Admin only.
   */
  async adjustment(propertyId: string, newAbsoluteBalance: string, note?: string) {
    const entry = await retainerLedgerRepo.recordEntry(propertyId, "adjustment", newAbsoluteBalance, note);
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (property) await evaluateDunning(propertyId, entry.balanceAfter, property);
    return entry;
  },

  /** Current balance = balanceAfter of the most recent ledger entry, or "0.00" */
  async currentBalance(propertyId: string): Promise<string> {
    const latest = await retainerLedgerRepo.getLatest(propertyId);
    return latest?.balanceAfter ?? "0.00";
  },

  /** Full ledger history, chronological */
  async ledger(propertyId: string) {
    return retainerLedgerRepo.listByProperty(propertyId);
  },

  /** Current dunning state and log for a property */
  async dunningState(propertyId: string) {
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (!property) throw Object.assign(new Error("Property not found"), { status: 404 });
    const log = await billingStateLogRepo.listByProperty(propertyId);
    return {
      propertyId,
      billingState: property.billingState,
      stateHistory: log,
    };
  },

  /**
   * Top-up via Stripe (stub). Charges the payment method, then posts the topup entry.
   */
  async topupViaPayment(propertyId: string, amount: string, paymentMethodId: string) {
    const charge = await paymentProvider.chargePaymentMethod(paymentMethodId, amount);
    if (charge.status !== "succeeded") {
      throw Object.assign(new Error(`Payment failed: ${charge.status}`), { status: 402 });
    }
    const entry = await retainerService.topup(propertyId, amount, `Stripe payment ${charge.id}`);
    return { charge, entry };
  },

  /**
   * All active properties whose current balance is below their low-balance threshold.
   */
  async lowBalanceProperties() {
    const props = await db.select().from(propertiesV2).where(eq(propertiesV2.active, true));
    const flagged = await Promise.all(
      props.map(async (p) => {
        const balance = await retainerService.currentBalance(p.id);
        const low = isLowBalance(balance, p.targetRetainerAmount, p.lowBalanceAlertPct);
        return low ? { ...p, currentBalance: balance } : null;
      }),
    );
    return flagged.filter(Boolean);
  },
};
