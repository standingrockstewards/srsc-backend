/**
 * server/services/billingService.ts  (Brick 5 — text-ID rewrite)
 *
 * All customerId / propertyId values are text (nanoid/cuid2).
 */

import { propertiesRepo } from "../repositories/properties";
import { retainerLedgerRepo } from "../repositories/retainerLedger";

export interface PropertyStatement {
  propertyId:       string;
  nickname:         string;
  month:            string;
  openingBalance:   string;
  closingBalance:   string;
  totalCharges:     string;
  totalTopups:      string;
  totalCredits:     string;
  totalAdjustments: string;
  entries:          any[];
}

export interface CustomerStatementSummary {
  customerId: string;
  month:      string;
  properties: Array<{
    propertyId:     string;
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
   */
  async propertyStatement(propertyId: string, month: string): Promise<PropertyStatement> {
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
      if (e.type === "charge")           totalCharges     += amt;
      else if (e.type === "topup")       totalTopups      += amt;
      else if (e.type === "credit_applied") totalCredits  += amt;
      else if (e.type === "adjustment")  totalAdjustments += amt;
    }

    const closingBalance = entries.length > 0
      ? entries[entries.length - 1].balanceAfter
      : openingBalance;

    return {
      propertyId,
      nickname:         property.nickname,
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
   * Customer-level roll-up — one row per property, totals at the top level.
   * Never merges property ledgers — each property is always distinct.
   */
  async customerStatementSummary(customerId: string, month: string): Promise<CustomerStatementSummary> {
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
          billingState:   p.billingState ?? "current",
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
