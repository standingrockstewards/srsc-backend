/**
 * Client Dashboard — Financial Overview section
 * Retainer balances, upcoming scheduled transaction costs, and top-up action.
 * Self-contained: designed to be dropped into client/portal.tsx
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Info,
  CheckCircle2,
  Clock,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const AMBER = "#D9A441";
const CREAM = "#F5F0EA";
const MUTED = "#888";
const CARD_BG = "#1a1a1a";
const CARD_BG_ALT = "#1e1e1e";
const BORDER = "#222";
const BORDER_ALT = "#2a2a2a";
const INPUT_BG = "#252525";
const INPUT_BORDER = "#333";
const RED = "#C0433F";

const FONT_HEAD = "'Playfair Display', serif";
const FONT_BODY = "'Source Sans 3', sans-serif";

// ─── Types ──────────────────────────────────────────────────────────────
type UpcomingScheduledItem = {
  id: number;
  type: string;
  visit_type: string;
  date: string;
  time?: string | null;
  description: string;
  tech_name?: string | null;
  estimated_cost: number;
  covered_by_subscription: boolean;
  notes?: string | null;
};

type PendingBillableItem = {
  id: number;
  type: string;
  quote_type: string;
  description: string;
  amount: number;
  approved_at: string;
  label: string;
};

type OpenInvoice = {
  id: number;
  total: number;
  status: string;
  period_start: string;
  period_end: string;
} | null;

type LedgerEntry = {
  entry_type: "deposit" | "draw" | "adjustment" | string;
  amount: number;
  balance_after: number;
  note?: string | null;
  created_at: string;
};

type PropertyFinancials = {
  property_id: number;
  nickname: string;
  address: string;
  service_tier: string;
  retainer_balance: number;
  upcoming_scheduled: UpcomingScheduledItem[];
  pending_billable: PendingBillableItem[];
  open_invoice: OpenInvoice;
  recent_ledger: LedgerEntry[];
  task_rates: Record<string, number>;
};

type DashboardFinancials = {
  client_id: number;
  total_retainer_balance: number;
  total_upcoming_cost: number;
  properties: PropertyFinancials[];
};

// ─── Helpers ────────────────────────────────────────────────────────────
function fmtMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtVisitType(s: string): string {
  return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function balanceColor(balance: number): string {
  if (balance > 200) return SAGE;
  if (balance >= 50) return AMBER;
  return RED;
}

// ─── Top summary strip ─────────────────────────────────────────────────
function SummaryStrip({
  totalRetainer,
  totalUpcoming,
}: {
  totalRetainer: number;
  totalUpcoming: number;
}) {
  const net = totalRetainer - totalUpcoming;
  const netColor = net >= 0 ? SAGE : RED;

  const cards = [
    {
      label: "Total Retainer Held",
      value: fmtMoney(totalRetainer),
      color: TERRACOTTA,
      icon: Wallet,
    },
    {
      label: "Upcoming Scheduled Cost",
      value: fmtMoney(totalUpcoming),
      color: AMBER,
      icon: Calendar,
    },
    {
      label: "Net Position",
      value: fmtMoney(net),
      color: netColor,
      icon: net >= 0 ? TrendingUp : TrendingDown,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-xl p-4"
            style={{ background: CARD_BG_ALT, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="rounded-lg p-1.5 flex items-center justify-center"
                style={{ background: `${c.color}1f` }}
              >
                <Icon size={14} style={{ color: c.color }} />
              </div>
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: MUTED, fontFamily: FONT_BODY }}
              >
                {c.label}
              </span>
            </div>
            <div
              className="text-2xl md:text-3xl font-bold"
              style={{ color: c.color, fontFamily: FONT_HEAD }}
            >
              {c.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Service tier badge ────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    anchor_watch: { label: "Anchor Watch", color: SAGE },
    shipshape: { label: "Shipshape", color: "#5A7A8C" },
    signal_flare: { label: "Signal Flare", color: TERRACOTTA },
    launch_crew: { label: "Launch Crew", color: "#8B7355" },
  };
  const { label, color } = labels[tier] ?? { label: tier || "—", color: MUTED };
  return (
    <span
      className="text-xs font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: FONT_BODY }}
    >
      {label}
    </span>
  );
}

// ─── Retainer balance badge (header) ───────────────────────────────────
function RetainerBadge({ balance }: { balance: number }) {
  const color = balanceColor(balance);
  return (
    <span
      className="text-xs font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: FONT_BODY }}
    >
      {fmtMoney(balance)}
    </span>
  );
}

// ─── Ledger row ─────────────────────────────────────────────────────────
function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isDeposit = entry.entry_type === "deposit";
  const isDraw = entry.entry_type === "draw";
  const color = isDeposit ? SAGE : isDraw ? RED : AMBER;
  const sign = isDeposit ? "+" : isDraw ? "−" : "±";

  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div className="flex-1 min-w-0">
        <div className="text-xs" style={{ color: CREAM, fontFamily: FONT_BODY }}>
          {entry.note || fmtVisitType(entry.entry_type)}
        </div>
        <div className="text-[11px]" style={{ color: MUTED }}>
          {fmtDate(entry.created_at)} · bal {fmtMoney(entry.balance_after)}
        </div>
      </div>
      <div className="text-sm font-semibold flex-shrink-0" style={{ color }}>
        {sign}
        {fmtMoney(Math.abs(Number(entry.amount ?? 0)))}
      </div>
    </div>
  );
}

// ─── Top-up form ────────────────────────────────────────────────────────
function TopUpForm({ propertyId }: { propertyId: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const topUpMutation = useMutation({
    mutationFn: async (amt: number) => {
      const res = await apiRequest("POST", `/api/retainer/${propertyId}/topup-intent`, { amount: amt });
      return res.json();
    },
    onSuccess: () => {
      setSuccessMsg("Top-up request noted — we'll process it shortly.");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/me/dashboard-financials"] });
    },
  });

  function handleSubmit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    setSuccessMsg(null);
    topUpMutation.mutate(amt);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSuccessMsg(null);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
        style={{
          background: "transparent",
          border: `1px solid ${INPUT_BORDER}`,
          color: CREAM,
          fontFamily: FONT_BODY,
        }}
      >
        <Plus size={13} style={{ color: TERRACOTTA }} />
        Top Up Retainer
      </button>
    );
  }

  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}` }}>
      {successMsg ? (
        <div className="flex items-start gap-2">
          <CheckCircle2 size={16} style={{ color: SAGE, marginTop: 1, flexShrink: 0 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: SAGE, fontFamily: FONT_BODY }}>
              {successMsg}
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSuccessMsg(null);
              }}
              className="text-xs mt-1 underline"
              style={{ color: MUTED }}
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="block text-xs mb-1.5 font-semibold" style={{ color: MUTED, fontFamily: FONT_BODY }}>
            Top-up amount
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span
                className="flex items-center justify-center rounded-lg px-2 py-2 text-sm"
                style={{ background: "#1e1e1e", border: `1px solid ${INPUT_BORDER}`, color: MUTED }}
              >
                $
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "#1e1e1e", border: `1px solid ${INPUT_BORDER}`, color: CREAM, fontFamily: FONT_BODY }}
              />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={topUpMutation.isPending || !amount || Number(amount) <= 0}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 flex-shrink-0"
              style={{ background: TERRACOTTA, color: "#fff", fontFamily: FONT_BODY }}
            >
              {topUpMutation.isPending ? "…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs flex-shrink-0"
              style={{ color: MUTED }}
            >
              Cancel
            </button>
          </div>
          {topUpMutation.isError && (
            <p className="text-xs mt-2" style={{ color: RED }}>
              Something went wrong. Please try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Retainer balance section ──────────────────────────────────────────
function RetainerBalanceSection({ prop }: { prop: PropertyFinancials }) {
  const color = balanceColor(prop.retainer_balance);
  // Visual progress bar: scale against a soft $500 ceiling, capped at 100%
  const pct = Math.max(0, Math.min(100, (prop.retainer_balance / 500) * 100));

  return (
    <div className="rounded-xl p-4" style={{ background: CARD_BG_ALT, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED, fontFamily: FONT_BODY }}>
            Retainer Balance
          </div>
          <div className="text-2xl md:text-3xl font-bold" style={{ color: TERRACOTTA, fontFamily: FONT_HEAD }}>
            {fmtMoney(prop.retainer_balance)}
          </div>
        </div>
        <TopUpForm propertyId={prop.property_id} />
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: INPUT_BG }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: TERRACOTTA }}
        />
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-[11px]" style={{ color: MUTED }}>
          {prop.retainer_balance > 200
            ? "Balance healthy"
            : prop.retainer_balance >= 50
              ? "Balance getting low"
              : "Balance critically low"}
        </span>
      </div>

      {/* Recent ledger */}
      {prop.recent_ledger && prop.recent_ledger.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED, fontFamily: FONT_BODY }}>
            Recent Activity
          </div>
          {prop.recent_ledger.slice(0, 3).map((entry, i) => (
            <LedgerRow key={i} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Upcoming scheduled section ────────────────────────────────────────
function UpcomingScheduledSection({ items }: { items: UpcomingScheduledItem[] }) {
  return (
    <div className="rounded-xl p-4" style={{ background: CARD_BG_ALT, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} style={{ color: TERRACOTTA }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED, fontFamily: FONT_BODY }}>
          Upcoming Scheduled
        </span>
      </div>
      {!items || items.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED, fontFamily: FONT_BODY }}>
          No upcoming visits scheduled.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 flex-wrap sm:flex-nowrap"
              style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
            >
              <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: MUTED }}>
                <Clock size={12} />
                <span className="text-xs font-semibold whitespace-nowrap">
                  {fmtDate(item.date)}
                  {item.time ? ` · ${item.time}` : ""}
                </span>
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="text-sm font-semibold" style={{ color: CREAM, fontFamily: FONT_BODY }}>
                  {fmtVisitType(item.visit_type || item.type)}
                </div>
                {item.description && (
                  <div className="text-xs" style={{ color: "#999" }}>
                    {item.description}
                  </div>
                )}
                {item.tech_name && (
                  <div className="text-[11px]" style={{ color: "#666" }}>
                    Tech: {item.tech_name}
                  </div>
                )}
              </div>
              {item.covered_by_subscription ? (
                <span
                  className="text-xs font-bold rounded-full px-2.5 py-0.5 flex-shrink-0"
                  style={{ background: `${SAGE}22`, color: SAGE, border: `1px solid ${SAGE}44`, fontFamily: FONT_BODY }}
                >
                  Included
                </span>
              ) : (
                <span className="text-sm font-bold flex-shrink-0" style={{ color: TERRACOTTA, fontFamily: FONT_BODY }}>
                  {fmtMoney(item.estimated_cost)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pending billable section ───────────────────────────────────────────
function PendingBillableSection({ items }: { items: PendingBillableItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-xl p-4" style={{ background: CARD_BG_ALT, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-3">
        <DollarSign size={14} style={{ color: AMBER }} />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED, fontFamily: FONT_BODY }}>
          Pending Billable
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isThirdParty = /third[- ]?party/i.test(item.label) || item.quote_type === "third_party";
          const chipColor = isThirdParty ? "#5A7A8C" : SAGE;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 flex-wrap sm:flex-nowrap"
              style={{ background: INPUT_BG, border: `1px solid ${BORDER}` }}
            >
              <span
                className="text-[11px] font-bold rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap"
                style={{ background: `${chipColor}22`, color: chipColor, border: `1px solid ${chipColor}44`, fontFamily: FONT_BODY }}
              >
                {isThirdParty ? "Third-Party Service" : "Standing Rock Service"}
              </span>
              <div className="flex-1 min-w-[140px] text-sm" style={{ color: CREAM, fontFamily: FONT_BODY }}>
                {item.description}
              </div>
              <span className="text-sm font-bold flex-shrink-0" style={{ color: AMBER }}>
                {fmtMoney(item.amount)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: MUTED }}>
        <Info size={11} style={{ marginTop: 1, flexShrink: 0 }} />
        These will appear on your next invoice upon service completion.
      </p>
    </div>
  );
}

// ─── Current invoice section ─────────────────────────────────────────────
function CurrentInvoiceSection({ invoice }: { invoice: OpenInvoice }) {
  if (!invoice) return null;
  return (
    <div
      className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
      style={{ background: CARD_BG_ALT, border: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} style={{ color: AMBER }} />
        <span className="text-sm font-semibold" style={{ color: CREAM, fontFamily: FONT_BODY }}>
          Current Statement: <span style={{ color: AMBER }}>{fmtVisitType(invoice.status)}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-bold" style={{ color: TERRACOTTA, fontFamily: FONT_HEAD }}>
          {fmtMoney(invoice.total)}
        </span>
        <span className="text-xs" style={{ color: MUTED }}>
          {fmtDate(invoice.period_start)} – {fmtDate(invoice.period_end)}
        </span>
      </div>
    </div>
  );
}

// ─── Per-property card ────────────────────────────────────────────────────
function PropertyFinancialCard({ prop }: { prop: PropertyFinancials }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER_ALT}` }}>
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left md:cursor-default"
        style={{ background: "#141414", borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="text-base md:text-lg font-bold truncate" style={{ color: CREAM, fontFamily: FONT_HEAD }}>
            {prop.nickname}
          </span>
          <TierBadge tier={prop.service_tier} />
          <RetainerBadge balance={prop.retainer_balance} />
        </div>
        <span className="md:hidden flex-shrink-0" style={{ color: MUTED }}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {/* Expanded content — always visible on desktop, collapsible on mobile */}
      <div className={`${collapsed ? "hidden" : "flex"} md:flex flex-col gap-3 p-4`}>
        <RetainerBalanceSection prop={prop} />
        <UpcomingScheduledSection items={prop.upcoming_scheduled} />
        <PendingBillableSection items={prop.pending_billable} />
        <CurrentInvoiceSection invoice={prop.open_invoice} />
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────
export function ClientDashboardFinancials({ clientId }: { clientId: number }) {
  const { data, isLoading, isError } = useQuery<DashboardFinancials>({
    queryKey: ["/api/me/dashboard-financials"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/dashboard-financials");
      return res.json();
    },
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: CARD_BG }} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl p-5 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <AlertTriangle size={22} style={{ color: MUTED, margin: "0 auto 8px" }} />
        <p className="text-sm" style={{ color: MUTED, fontFamily: FONT_BODY }}>
          Unable to load financial overview right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: FONT_BODY }}>
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg p-2" style={{ background: `${TERRACOTTA}18`, border: `1px solid ${TERRACOTTA}33` }}>
          <Wallet size={16} style={{ color: TERRACOTTA }} />
        </div>
        <div>
          <h2 className="text-lg font-bold leading-none" style={{ color: CREAM, fontFamily: FONT_HEAD }}>
            Financial Overview
          </h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Retainer balances, upcoming costs, and top-ups across your properties
          </p>
        </div>
      </div>

      {/* Top summary strip */}
      <SummaryStrip totalRetainer={data.total_retainer_balance} totalUpcoming={data.total_upcoming_cost} />

      {/* Per-property cards */}
      {data.properties && data.properties.length > 0 ? (
        <div className="space-y-4">
          {data.properties.map((prop) => (
            <PropertyFinancialCard key={prop.property_id} prop={prop} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <Wallet size={24} style={{ color: "#333", margin: "0 auto 8px" }} />
          <p className="text-sm" style={{ color: "#555" }}>No properties with financial data found.</p>
        </div>
      )}
    </div>
  );
}

export default ClientDashboardFinancials;
