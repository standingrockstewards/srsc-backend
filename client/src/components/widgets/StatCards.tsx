/**
 * src/components/widgets/StatCards.tsx  (Brick 10c)
 *
 * Role-aware summary stat cards.
 *
 * CLIENT view:
 *   - Active properties (from GET /properties → filter active===true)
 *   - Credit balance  (from GET /customers/:customerId — string, formatMoney)
 *   - Low-balance properties (derived from own properties list — NOT /retainer/low-balance)
 *     Low = currentBalance < targetRetainerAmount * lowBalanceAlertPct/100.
 *     Since /retainer/properties/:pid/balance returns { balance: number|string },
 *     we fetch one balance per property; see SEAM note below.
 *
 * ADMIN/SUPERVISOR view:
 *   - Total customers   (GET /customers → length)
 *   - Total properties  (GET /properties → length)
 *   - Open jobs         (reused from useBadges — no double-fetch)
 *   - Pending referrals (reused from useBadges — no double-fetch)
 *
 * All IDs are text. Money stays string (except the documented balance seam).
 */

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useAuth } from "@/context/AuthContext";
import type { BadgeCounts } from "@/hooks/useBadges";
import type { Customer, Property } from "@/types";

// ── Balance seam helper ───────────────────────────────────────────────────────
// GET /retainer/properties/:pid/balance → { propertyId, balance: number|string }
// SEAM: backend should return string (follow-on brick). Always String() on receipt.
interface BalanceResponse {
  propertyId: string;
  balance: number | string; // SEAM: should be string — always String() here
}

function isLowBalance(balance: string, target: string, alertPct: number): boolean {
  const b = parseFloat(balance);
  const t = parseFloat(target);
  if (isNaN(b) || isNaN(t) || t === 0) return false;
  return b < t * (alertPct / 100);
}

// ── Shared ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}

function StatCard({ label, value, sub, accent, warn }: StatCardProps) {
  return (
    <div className={`stat-card${accent ? " stat-card--accent" : ""}${warn ? " stat-card--warn" : ""}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function StatCardSkeleton() {
  return <div className="stat-card stat-card--loading" aria-hidden />;
}

// ── Client stats ──────────────────────────────────────────────────────────────

interface ClientStatsProps {
  customerId: string;
}

function ClientStats({ customerId }: ClientStatsProps) {
  const [customer,   setCustomer]   = useState<Customer | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [lowCount,   setLowCount]   = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [cust, props] = await Promise.all([
          api.get<Customer>(`/customers/${customerId}`),
          api.get<Property[]>("/properties"),
        ]);
        setCustomer(cust);
        setProperties(props);

        // Derive low-balance count from own properties using per-property balance endpoint.
        // SEAM: balance is number|string from backend — always String() on receipt.
        const balances = await Promise.all(
          props
            .filter((p) => p.active)
            .map(async (p): Promise<number> => {
              try {
                const res = await api.get<BalanceResponse>(`/retainer/properties/${p.id}/balance`);
                const balStr = String(res.balance); // SEAM: backend should return string
                return isLowBalance(balStr, p.targetRetainerAmount, p.lowBalanceAlertPct) ? 1 : 0;
              } catch (err) {
                if (!(err instanceof ApiError && err.status === 403)) {
                  console.warn(`[StatCards] balance fetch for ${p.id} failed:`, err);
                }
                return 0;
              }
            }),
        );
        setLowCount(balances.reduce((s, n) => s + n, 0));
      } catch (err) {
        console.warn("[StatCards] client stats fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customerId]);

  if (loading) {
    return (
      <>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </>
    );
  }

  const activeCount = properties.filter((p) => p.active).length;

  return (
    <>
      <StatCard
        label="Active Properties"
        value={activeCount}
        sub={`${properties.length} total`}
      />
      <StatCard
        label="Credit Balance"
        value={formatMoney(customer?.creditBalance ?? null)}
        accent
      />
      <StatCard
        label="Low Balance Properties"
        value={lowCount ?? "—"}
        warn={(lowCount ?? 0) > 0}
        sub={lowCount === 0 ? "All retainers healthy" : "Needs top-up"}
      />
    </>
  );
}

// ── Admin / Supervisor stats ──────────────────────────────────────────────────

interface AdminStatsProps {
  badges: BadgeCounts;
}

function AdminStats({ badges }: AdminStatsProps) {
  const [customerCount,  setCustomerCount]  = useState<number | null>(null);
  const [propertyCount,  setPropertyCount]  = useState<number | null>(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [customers, properties] = await Promise.all([
          api.get<Customer[]>("/customers"),
          api.get<Property[]>("/properties"),
        ]);
        setCustomerCount(customers.length);
        setPropertyCount(properties.length);
      } catch (err) {
        console.warn("[StatCards] admin stats fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </>
    );
  }

  return (
    <>
      <StatCard
        label="Total Customers"
        value={customerCount ?? "—"}
        sub="Active accounts"
      />
      <StatCard
        label="Total Properties"
        value={propertyCount ?? "—"}
        sub={`${badges.lowBalanceProperties} low balance`}
        warn={badges.lowBalanceProperties > 0}
      />
      <StatCard
        label="Open Jobs"
        value={badges.openJobs}
        warn={badges.openJobs > 0}
        sub="Pending · Scheduled · In progress"
      />
      <StatCard
        label="Pending Referrals"
        value={badges.pendingReferrals}
        accent={badges.pendingReferrals > 0}
        sub="Awaiting qualification"
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

interface StatCardsProps {
  badges: BadgeCounts;
}

export function StatCards({ badges }: StatCardsProps) {
  const { role, customerId } = useAuth();

  if (role === "client") {
    if (!customerId) {
      return (
        <div className="widget-error">No customer record linked to this account.</div>
      );
    }
    return (
      <div className="stat-cards-row">
        <ClientStats customerId={customerId} />
      </div>
    );
  }

  if (role === "admin" || role === "supervisor") {
    return (
      <div className="stat-cards-row">
        <AdminStats badges={badges} />
      </div>
    );
  }

  // field_tech / vendor — no stat cards in 10c
  return null;
}
