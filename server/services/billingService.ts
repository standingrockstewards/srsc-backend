/**
 * server/services/billingService.ts  (Brick 5)
 *
 * Per-property monthly statements + customer-level roll-up summary.
 * Each property ALWAYS has its own statement.
 * The customer summary is a top-level overview — never merges property ledgers.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { propertiesV2 } from "../../shared/schema-v2";
import { retainerLedgerRepo } from "../repositories/retainerLedger";
import { propertiesRepo } from "../repositories/properties";

export interface PropertyStatement {
  propertyId:      number;
  nickname:        string;
  month:           string;           // YYYY-MM
  openingBalance:  string;
  closingBalance:  string;
  totalCharges:    string;
  totalTopups:     string;
  totalCredits:    string;
  totalAdjustments: string;
  entries:         any[];
}

export interface CustomerStatementSummary {
  customerId: number;
  month:      string;
  properties: Array<{
    propertyId:     number;
    nickname:       string;
    billingState:   string;
    openingBalance: string;
    closingBalance: string;
    totalCharges:   string;
    totalTopups:    string;
  }>;
  totalOpeningBalance:  string;
  totalClosingBalance:  string;
  totalChargesAllProps: string;
}

export const billingService = {
  /**
   * Per-property monthly statement.
   * Returns all ledger entries for the month with opening + closing balances.
   */
  async propertyStatement(propertyId: number, month: string): Promise<PropertyStatement> {
    const property = await propertiesRepo.getById(propertyId);
    if (!property) throw Object.assign(new Error("Property not found"), { status: 404 });

    const [entries, openingBalance] = await Promise.all([
      retainerLedgerRepo.listByPropertyAndMonth(propertyId, month),
      retainerLedgerRepo.openingBalance(propertyId, month),
    ]);

    let totalCharges     = 0;
    let totalTopups      = 0;
    let totalCredits     = 0;
    let totalAdjustments = 0;

    for (const e of entries) {
      const amt = parseFloat(e.amount);
      if (e.type === "charge")         totalCharges     += amt;
      else if (e.type === "topup")     totalTopups      += amt;
      else if (e.type === "credit_applied") totalCredits += amt;
      else if (e.type === "adjustment") totalAdjustments += amt;
    }

    const closingBalance = entries.length > 0
      ? entries[entries.length - 1].balanceAfter
      : openingBalance;

    return {
      propertyId,
      nickname:        property.nickname,
      month,
      openingBalance,
      closingBalance,
      totalCharges:     totalCharges.toFixed(2),
      totalTopups:      totalTopups.toFixed(2),
      totalCredits:     totalCredits.toFixed(2),
      totalAdjustments: totalAdjustments.toFixed(2),
      entries,
    };
  },

  /**
   * Customer-level roll-up: one row per property, totals at the top level.
   * Never merges individual property ledgers — each property is always distinct.
   */
  async customerStatementSummary(customerId: number, month: string): Promise<CustomerStatementSummary> {
    const properties = await propertiesRepo.listByCustomer(customerId);

    let totalOpeningBalance  = 0;
    let totalClosingBalance  = 0;
    let totalChargesAllProps = 0;

    const rows = await Promise.all(
      properties.map(async (p) => {
        const stmt = await billingService.propertyStatement(p.id, month);
        totalOpeningBalance  += parseFloat(stmt.openingBalance);
        totalClosingBalance  += parseFloat(stmt.closingBalance);
        totalChargesAllProps += parseFloat(stmt.totalCharges);
        return {
          propertyId:     p.id,
          nickname:       p.nickname,
          billingState:   p.billingState,
          openingBalance: stmt.openingBalance,
          closingBalance: stmt.closingBalance,
          totalCharges:   stmt.totalCharges,
          totalTopups:    stmt.totalTopups,
        };
      }),
    );

    return {
      customerId,
      month,
      properties: rows,
      totalOpeningBalance:  totalOpeningBalance.toFixed(2),
      totalClosingBalance:  totalClosingBalance.toFixed(2),
      totalChargesAllProps: totalChargesAllProps.toFixed(2),
    };
  },
};
