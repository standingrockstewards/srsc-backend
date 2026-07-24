/**
 * KPI Dashboard — Admin & Supervisor
 * Revenue, Clients, Operations, Exposure, Vendors with charts and date filter.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  DollarSign, Users, Activity, Shield, Truck,
  TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronDown,
} from "lucide-react";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE       = "#7A8C6E";
const CREAM      = "#F5F0EA";
const CHARCOAL   = "#141414";
const MUTED      = "rgba(245,240,234,0.55)";
const RED_ALERT  = "#E05252";
const SERIF      = "var(--font-serif)";
const SANS       = "var(--font-sans)";

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}
function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function Tile({
  label, value, sub, icon: Icon, accent = TERRACOTTA, alert = false,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; accent?: string; alert?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${alert ? RED_ALERT : "rgba(245,240,234,0.10)"}`,
      borderRadius: 12, padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: SANS, fontSize: 13, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} color={accent} />
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: CREAM, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED }}>{sub}</div>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, icon: Icon, accent = TERRACOTTA }: { title: string; icon: any; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 32 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={16} color={accent} />
      </div>
      <h2 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: CREAM, margin: 0 }}>{title}</h2>
    </div>
  );
}

// ─── Date Range Selector ──────────────────────────────────────────────────────
function DateRange({
  from, to, onChange,
}: {
  from: string; to: string;
  onChange: (from: string, to: string) => void;
}) {
  const presets = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonth = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const prevLastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return [
      {
        label: "This Month",
        from: `${thisMonth}-01`,
        to: lastDay.toISOString().slice(0, 10),
      },
      {
        label: "Last Month",
        from: `${prevMonth}-01`,
        to: prevLastDay.toISOString().slice(0, 10),
      },
      {
        label: "Last 90 Days",
        from: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      },
      {
        label: "YTD",
        from: `${now.getFullYear()}-01-01`,
        to: now.toISOString().slice(0, 10),
      },
    ];
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {presets.map(p => (
        <button
          key={p.label}
          onClick={() => onChange(p.from, p.to)}
          style={{
            fontFamily: SANS, fontSize: 13, padding: "6px 14px",
            borderRadius: 8, border: `1px solid ${from === p.from ? TERRACOTTA : "rgba(245,240,234,0.15)"}`,
            background: from === p.from ? `${TERRACOTTA}22` : "transparent",
            color: from === p.from ? TERRACOTTA : MUTED, cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {p.label}
        </button>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 8 }}>
        <input
          type="date" value={from}
          onChange={e => onChange(e.target.value, to)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,240,234,0.15)",
            borderRadius: 8, color: CREAM, fontFamily: SANS, fontSize: 13, padding: "6px 10px",
          }}
        />
        <span style={{ color: MUTED, fontSize: 12 }}>→</span>
        <input
          type="date" value={to}
          onChange={e => onChange(from, e.target.value)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,240,234,0.15)",
            borderRadius: 8, color: CREAM, fontFamily: SANS, fontSize: 13, padding: "6px 10px",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function KpiDashboard() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to,   setTo]   = useState(defaultTo);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["dashboard-kpis", from, to],
    queryFn: () => apiRequest("GET", `/api/dashboard/kpis?from=${from}&to=${to}`).then(r => r.json()),
    staleTime: 120_000,
    refetchInterval: 300_000,
  });

  if (isLoading) return (
    <div style={{ padding: 40, color: MUTED, fontFamily: SANS, textAlign: "center" }}>
      Loading KPI data…
    </div>
  );
  if (error || !data) return (
    <div style={{ padding: 40, color: RED_ALERT, fontFamily: SANS }}>
      Failed to load KPI data. {(error as any)?.message}
    </div>
  );

  const { revenue, clients, operations, exposure, vendors } = data;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: CREAM, margin: 0 }}>
          Business Dashboard
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, marginTop: 6 }}>
          Standing Rock Stewardship Co. — Operations Overview
        </p>
      </div>

      {/* Date Range */}
      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 12,
        padding: "16px 20px", marginBottom: 28,
        border: "1px solid rgba(245,240,234,0.08)",
      }}>
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* ── Revenue ── */}
      <SectionHeader title="Revenue" icon={DollarSign} accent={SAGE} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Tile label="MRR" value={fmtCurrency(revenue.mrr)} sub="Active subscriptions" icon={TrendingUp} accent={SAGE} />
        <Tile label="MTD Billed" value={fmtCurrency(revenue.mtd_billed)} sub="Invoices issued this period" icon={DollarSign} accent={SAGE} />
        <Tile label="Net Margin" value={fmtCurrency(revenue.margin)} sub={`After $${revenue.vendor_payouts.toFixed(0)} payouts`} icon={TrendingUp} accent={SAGE} />
        <Tile label="Outstanding" value={fmtCurrency(revenue.outstanding)} sub="Unpaid invoices" icon={AlertTriangle} accent={TERRACOTTA} alert={revenue.outstanding > 0} />
      </div>

      {/* Revenue trend chart */}
      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 12,
        border: "1px solid rgba(245,240,234,0.08)", padding: "20px 24px", marginBottom: 8,
      }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginBottom: 14 }}>Revenue — 6 Month Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenue.trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,240,234,0.06)" />
            <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fill: MUTED, fontSize: 11, fontFamily: SANS }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fill: MUTED, fontSize: 11, fontFamily: SANS }} axisLine={false} tickLine={false} width={60} />
            <Tooltip
              formatter={(v: any) => [fmtCurrency(v), "Billed"]}
              labelFormatter={fmtMonth}
              contentStyle={{ background: "#1C1C1C", border: `1px solid ${TERRACOTTA}`, borderRadius: 8, fontFamily: SANS }}
              itemStyle={{ color: CREAM }} labelStyle={{ color: MUTED }}
            />
            <Bar dataKey="billed" radius={[4, 4, 0, 0]} fill={SAGE} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Clients ── */}
      <SectionHeader title="Clients" icon={Users} accent={TERRACOTTA} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Tile label="Active" value={clients.active} sub={`of ${clients.total} total`} icon={CheckCircle} accent={SAGE} />
        <Tile label="Pending / Onboarding" value={clients.pending} icon={Clock} accent={TERRACOTTA} />
        <Tile label="Halted" value={clients.halted} icon={AlertTriangle} accent={RED_ALERT} alert={clients.halted > 0} />
        <Tile label="New This Period" value={clients.new_signups} sub="Sign-ups" icon={Users} accent={SAGE} />
      </div>

      {/* ── Operations ── */}
      <SectionHeader title="Operations" icon={Activity} accent={TERRACOTTA} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Tile
          label="Visits Completed"
          value={operations.visits_completed}
          sub={`of ${operations.visits_scheduled} scheduled`}
          icon={CheckCircle} accent={SAGE}
        />
        <Tile label="Storm Responses" value={operations.storm_responses} icon={Shield} accent={TERRACOTTA} />
        <Tile label="Open Signal Flares" value={operations.open_flares} icon={AlertTriangle} accent={RED_ALERT} alert={operations.open_flares > 0} />
        <Tile label="Jobs In Progress" value={operations.jobs_in_progress} icon={Activity} accent={TERRACOTTA} />
      </div>

      {/* ── Exposure ── */}
      <SectionHeader title="Financial Exposure" icon={Shield} accent={RED_ALERT} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Tile label="Total Exposure" value={fmtCurrency(exposure.total_exposure)} sub="Unpaid/outstanding invoices" icon={AlertTriangle} accent={RED_ALERT} alert={exposure.total_exposure > 0} />
        <Tile label="Retainer Pool" value={fmtCurrency(exposure.retainer_balance)} sub="Current retainer balances" icon={DollarSign} accent={SAGE} />
        <Tile label="Grace / Past Due" value={exposure.grace_past_due} sub="Accounts needing attention" icon={AlertTriangle} accent={RED_ALERT} alert={exposure.grace_past_due > 0} />
      </div>

      {/* Account status breakdown */}
      {exposure.accounts_by_status?.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 12,
          border: "1px solid rgba(245,240,234,0.08)", padding: "16px 20px", marginBottom: 8,
        }}>
          <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginBottom: 12 }}>Billing Account Status Breakdown</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {exposure.accounts_by_status.map((s: any) => (
              <div key={s.status} style={{
                background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 16px",
                border: `1px solid ${s.status === "active" ? SAGE : s.status === "halted" || s.status === "collections" ? RED_ALERT : TERRACOTTA}22`,
              }}>
                <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: CREAM }}>{s.cnt}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: MUTED, textTransform: "capitalize" }}>{s.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendors ── */}
      <SectionHeader title="Vendors" icon={Truck} accent={SAGE} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Tile label="Active Vendors" value={vendors.active} icon={Truck} accent={SAGE} />
        <Tile label="Docs Incomplete" value={vendors.docs_incomplete} icon={AlertTriangle} accent={vendors.docs_incomplete > 0 ? TERRACOTTA : SAGE} alert={vendors.docs_incomplete > 0} />
        <Tile label="Pending Payouts" value={`${vendors.pending_payout_count}`} sub={fmtCurrency(vendors.pending_payout_total)} icon={DollarSign} accent={TERRACOTTA} />
      </div>

      {/* Payout trend */}
      {vendors.payout_trend?.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 12,
          border: "1px solid rgba(245,240,234,0.08)", padding: "20px 24px",
        }}>
          <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginBottom: 14 }}>Vendor Payouts — 6 Month Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={vendors.payout_trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,240,234,0.06)" />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fill: MUTED, fontSize: 11, fontFamily: SANS }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: MUTED, fontSize: 11, fontFamily: SANS }} axisLine={false} tickLine={false} width={60} />
              <Tooltip
                formatter={(v: any) => [fmtCurrency(v), "Paid"]}
                labelFormatter={fmtMonth}
                contentStyle={{ background: "#1C1C1C", border: `1px solid ${SAGE}`, borderRadius: 8, fontFamily: SANS }}
                itemStyle={{ color: CREAM }} labelStyle={{ color: MUTED }}
              />
              <Line dataKey="payouts" stroke={TERRACOTTA} strokeWidth={2} dot={{ fill: TERRACOTTA, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
