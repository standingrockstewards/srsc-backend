/**
 * server/services/retainerService.ts  (Brick 5 rewrite)
 *
 * Per-property retainer ledger with:
 *  - Correct running balance (server-computed, never trusted from client)
 *  - Discount tier applied to charges
 *  - Low-balance flag after every charge
 *  - Dunning state transitions (current → grace → delinquent) logged append-only
 *
 * Grace window: configurable via DUNNING_GRACE_DAYS env var (default 7).
 * All money as decimal strings; never use float for storage.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { propertiesV2, type RetainerEntryType } from "../../shared/schema-v2";
import { retainerLedgerRepo } from "../repositories/retainerLedger";
import { billingStateLogRepo, type BillingState } from "../repositories/billingStateLog";
import { deriveDiscountPct } from "./discountService";

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
/**
 * After any balance-changing event, re-evaluate dunning state and log if changed.
 * Logic:
 *   balance >= threshold      → current
 *   balance <  threshold
 *     AND updatedAt is within grace window  → grace
 *     AND updatedAt is outside grace window → delinquent
 */
async function evaluateDunning(
  propertyId: number,
  newBalance: string,
  property: { targetRetainerAmount: string; lowBalanceAlertPct: number; billingState: string; updatedAt: Date },
): Promise<void> {
  const threshold = parseFloat(property.targetRetainerAmount) * (property.lowBalanceAlertPct / 100);
  const balance   = parseFloat(newBalance);
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
   * Post a topup (direct deposit / Stripe top-up).
   * discountTierPct does NOT reduce top-ups — only charges.
   */
  async topup(propertyId: number, amount: string, note?: string) {
    const entry = await retainerLedgerRepo.recordEntry(propertyId, "topup", amount, note);
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (property) await evaluateDunning(propertyId, entry.balanceAfter, property);
    return entry;
  },

  /**
   * Post a service charge.
   * Amount is reduced by the property's current discountTierPct before posting.
   * After posting, evaluates low-balance flag and dunning state.
   */
  async charge(
    propertyId: number,
    grossAmount: string,
    note?: string,
  ) {
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (!property) throw Object.assign(new Error("Property not found"), { status: 404 });

    const netAmount = applyDiscount(grossAmount, property.discountTierPct);
    const entry = await retainerLedgerRepo.recordEntry(propertyId, "charge", netAmount, note);

    await evaluateDunning(propertyId, entry.balanceAfter, property);
    return { entry, grossAmount, netAmount, discountPct: property.discountTierPct };
  },

  /**
   * Post a manual adjustment (sets absolute balance).
   * Admin only — no discount applied.
   */
  async adjustment(propertyId: number, newAbsoluteBalance: string, note?: string) {
    const entry = await retainerLedgerRepo.recordEntry(propertyId, "adjustment", newAbsoluteBalance, note);
    const [property] = await db.select().from(propertiesV2).where(eq(propertiesV2.id, propertyId));
    if (property) await evaluateDunning(propertyId, entry.balanceAfter, property);
    return entry;
  },

  /** Current balance = balanceAfter of the most recent ledger entry, or "0.00" */
  async currentBalance(propertyId: number): Promise<string> {
    const latest = await retainerLedgerRepo.getLatest(propertyId);
    return latest?.balanceAfter ?? "0.00";
  },

  /** Full ledger history, chronological */
  async ledger(propertyId: number) {
    return retainerLedgerRepo.listByProperty(propertyId);
  },

  /**
   * All active properties whose current balance is below their low-balance threshold.
   * Returned with property metadata for the admin low-balance list endpoint.
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
