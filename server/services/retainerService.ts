/**
 * Retainer service — deposit/debit helpers + current balance.
 * All money values flow through as strings to preserve decimal precision.
 */

import { retainerLedgerRepo } from "../repositories/retainerLedger";

export const retainerService = {
  /** Record a deposit (adds to balance) */
  async deposit(propertyId: number, amount: string, note?: string) {
    return retainerLedgerRepo.recordEntry(propertyId, "deposit", amount, note);
  },

  /** Record a debit (subtracts from balance) */
  async debit(propertyId: number, amount: string, note?: string) {
    return retainerLedgerRepo.recordEntry(propertyId, "debit", amount, note);
  },

  /** Current balance = balanceAfter of the most recent ledger entry, or 0 */
  async currentBalance(propertyId: number): Promise<string> {
    const latest = await retainerLedgerRepo.getLatest(propertyId);
    return latest?.balanceAfter ?? "0.00";
  },

  /** Full ledger history newest-first */
  async ledger(propertyId: number) {
    return retainerLedgerRepo.listByProperty(propertyId);
  },
};
