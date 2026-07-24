/**
 * Admin/Supervisor — Retainer & Exposure Guard
 * Three tabs: Exposure Panel, Retainer Balances, Overview
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, AlertTriangle, DollarSign, Plus, Check, ChevronDown, ChevronUp,
  TrendingDown, TrendingUp, RefreshCw, Eye, Building2,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const BG = "#1C1C1C";
const CARD_BG = "#1e1e1e";
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const AMBER = "#D9A441";
const CREAM = "#F5F0EA";
const MUTED = "#888";
const BORDER = "#2a2a2a";

const SERIF = "'Playfair Display', serif";
const SANS = "'Source Sans 3', sans-serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(ts: string) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const ENTRY_TYPE_COLOR: Record<string, string> = {
  deposit: SAGE,
  draw: TERRACOTTA,
  refund: SAGE,
  adjustment: AMBER,
};

// ─── Small building blocks ────────────────────────────────────────────────────
function Spinner({ size = 20 }: { size?: number }) {
  return <RefreshCw size={size} className="animate-spin" style={{ color: TERRACOTTA }} />;
}

function EmptyState({ label, icon: Icon = Building2 }: { label: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <Icon size={30} style={{ color: "#3a3a3a" }} />
      <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>{label}</p>
    </div>
  );
}

function Banner({ type, message, onClose }: { type: "success" | "error"; message: string; onClose?: () => void }) {
  const color = type === "success" ? SAGE : TERRACOTTA;
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-4 text-sm"
      style={{ background: `${color}18`, border: `1px solid ${color}44`, color, fontFamily: SANS }}
    >
      <div className="flex items-center gap-2">
        {type === "success" ? <Check size={15} /> : <AlertTriangle size={15} />}
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-xs font-bold opacity-70 hover:opacity-100">✕</button>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="flex flex-col rounded-lg px-3 py-2 min-w-[130px]"
      style={{ background: "#161616", border: `1px solid ${BORDER}` }}
    >
      <span className="text-[10px] uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: color ?? CREAM, fontFamily: SANS }}>{value}</span>
    </div>
  );
}

// ─── TAB 1: Exposure Panel ────────────────────────────────────────────────────
function ExposureCard({ property }: { property: any }) {
  const [expanded, setExpanded] = useState(false);
  const exposed = !!property.exposed;
  const borderColor = exposed ? TERRACOTTA : SAGE;
  const hasBlocked = (property.blocked_work_orders ?? 0) > 0;
  const upcomingWO = property.upcoming_work_orders ?? [];
  const upcomingVisits = property.upcoming_visits ?? [];
  const hasCollapsible = upcomingWO.length > 0 || upcomingVisits.length > 0;

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{ background: CARD_BG, border: `1px solid ${borderColor}`, boxShadow: exposed ? `0 0 0 1px ${TERRACOTTA}33` : "none" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {exposed && <AlertTriangle size={15} style={{ color: TERRACOTTA }} />}
            <h3 className="font-bold text-base truncate" style={{ color: CREAM, fontFamily: SERIF }}>
              {property.nickname || property.address}
            </h3>
          </div>
          <p className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: SANS }}>
            {property.client_name} · {property.address}
          </p>
        </div>

        {exposed ? (
          <span
            className="text-xs font-bold rounded-full px-3 py-1 flex-shrink-0"
            style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, border: `1px solid ${TERRACOTTA}55`, fontFamily: SANS }}
          >
            EXPOSURE FLAGGED — Gap: {money(property.exposure_gap)}
          </span>
        ) : (
          <span
            className="text-xs font-bold rounded-full px-3 py-1 flex-shrink-0"
            style={{ background: `${SAGE}22`, color: SAGE, border: `1px solid ${SAGE}55`, fontFamily: SANS }}
          >
            Covered
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mt-3">
        <StatPill label="Retainer Balance" value={money(property.retainer_balance)} />
        <StatPill label="Approved Coverage" value={money(property.approved_coverage)} />
        <StatPill label="Upcoming Cost" value={money(property.upcoming_cost)} color={exposed ? TERRACOTTA : undefined} />
      </div>

      {hasBlocked && (
        <div className="mt-3 flex items-center gap-2 text-xs font-bold" style={{ color: TERRACOTTA, fontFamily: SANS }}>
          <Shield size={13} />
          {property.blocked_work_orders} blocked work order{property.blocked_work_orders === 1 ? "" : "s"}
        </div>
      )}

      {hasCollapsible && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold"
            style={{ color: TERRACOTTA, fontFamily: SANS }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? "Hide" : "Show"} upcoming work ({upcomingWO.length} orders, {upcomingVisits.length} visits)
          </button>

          {expanded && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: MUTED, fontFamily: SANS }}>
                  Upcoming Work Orders
                </p>
                {upcomingWO.length === 0 ? (
                  <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>None</p>
                ) : (
                  <ul className="space-y-1.5">
                    {upcomingWO.map((wo: any, i: number) => (
                      <li key={wo.id ?? i} className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: "#161616", border: `1px solid ${BORDER}`, color: "#ccc", fontFamily: SANS }}>
                        {wo.description ?? wo.title ?? `Work order #${wo.id ?? i + 1}`}
                        {wo.estimated_cost != null && <span style={{ color: MUTED }}> — {money(wo.estimated_cost)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: MUTED, fontFamily: SANS }}>
                  Upcoming Visits
                </p>
                {upcomingVisits.length === 0 ? (
                  <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>None</p>
                ) : (
                  <ul className="space-y-1.5">
                    {upcomingVisits.map((v: any, i: number) => (
                      <li key={v.id ?? i} className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: "#161616", border: `1px solid ${BORDER}`, color: "#ccc", fontFamily: SANS }}>
                        {v.scheduled_date ? formatDate(v.scheduled_date) : (v.date ?? `Visit #${v.id ?? i + 1}`)}
                        {v.type && <span style={{ color: MUTED }}> — {v.type}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExposurePanelTab() {
  const { data: exposure = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["/api/exposure"],
    queryFn: async () => (await apiRequest("GET", "/api/exposure")).json(),
    staleTime: 0,
  });

  const sorted = [...exposure].sort((a, b) => (b.exposed ? 1 : 0) - (a.exposed ? 1 : 0));
  const exposedCount = exposure.filter((p: any) => p.exposed).length;

  return (
    <div>
      <div
        className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
        style={{ background: `${AMBER}14`, border: `1px solid ${AMBER}44` }}
      >
        <Shield size={18} style={{ color: AMBER, flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm" style={{ color: "#e8d9b8", fontFamily: SANS, lineHeight: 1.5 }}>
          <strong style={{ color: AMBER }}>Exposure Guard</strong> — Properties with scheduled costs exceeding
          retainer + approved authorization are flagged here. Review before dispatching vendors.
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {exposedCount > 0 && (
            <span
              className="text-xs font-bold rounded-full px-3 py-1"
              style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, border: `1px solid ${TERRACOTTA}55`, fontFamily: SANS }}
            >
              {exposedCount} flagged
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5"
          style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: MUTED, fontFamily: SANS }}
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : sorted.length === 0 ? (
        <EmptyState label="No properties found." icon={Shield} />
      ) : (
        sorted.map((p: any) => <ExposureCard key={p.property_id} property={p} />)
      )}
    </div>
  );
}

// ─── TAB 2: Retainer Balances ─────────────────────────────────────────────────
function LedgerView({ propertyId }: { propertyId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/retainer", propertyId],
    queryFn: async () => (await apiRequest("GET", `/api/retainer/${propertyId}`)).json(),
    staleTime: 0,
  });

  if (isLoading) return <div className="flex justify-center py-6"><Spinner size={16} /></div>;

  const ledger = data?.ledger ?? [];
  if (ledger.length === 0) {
    return <p className="text-xs py-3" style={{ color: MUTED, fontFamily: SANS }}>No ledger entries yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {ledger.map((entry: any, i: number) => {
        const color = ENTRY_TYPE_COLOR[entry.entry_type] ?? MUTED;
        return (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 flex-wrap"
            style={{ background: "#161616", border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 flex-shrink-0"
                style={{ background: `${color}22`, color, border: `1px solid ${color}55`, fontFamily: SANS }}
              >
                {entry.entry_type}
              </span>
              <span className="text-xs truncate" style={{ color: "#ccc", fontFamily: SANS }}>
                {entry.note || "—"}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-bold" style={{ color, fontFamily: SANS }}>
                {Number(entry.amount) >= 0 ? "+" : ""}{money(entry.amount)}
              </span>
              <span className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>
                bal {money(entry.balance_after)}
              </span>
              <span className="text-xs hidden sm:inline" style={{ color: "#555", fontFamily: SANS }}>
                {entry.created_by_name} · {formatDate(entry.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DepositForm({ propertyId, onDone }: { propertyId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amount || isNaN(amt) || amt <= 0) throw new Error("Enter a valid deposit amount");
      const r = await apiRequest("POST", `/api/retainer/${propertyId}/deposit`, { amount: amt, note, method });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Deposit failed");
      return data;
    },
    onSuccess: () => {
      setAmount(""); setNote(""); setError("");
      qc.invalidateQueries({ queryKey: ["/api/retainer"] });
      qc.invalidateQueries({ queryKey: ["/api/retainer", propertyId] });
      qc.invalidateQueries({ queryKey: ["/api/exposure"] });
      onDone();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: "#161616", border: `1px solid ${BORDER}` }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: SAGE, fontFamily: SANS }}>Record Deposit</p>
      {error && <div className="text-xs mb-2" style={{ color: TERRACOTTA, fontFamily: SANS }}>{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input
          type="number" min="0" step="0.01" placeholder="Amount" value={amount}
          onChange={e => setAmount(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#1e1e1e", border: `1px solid ${BORDER}`, color: CREAM, fontFamily: SANS }}
        />
        <select
          value={method} onChange={e => setMethod(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm outline-none appearance-none"
          style={{ background: "#1e1e1e", border: `1px solid ${BORDER}`, color: CREAM, fontFamily: SANS }}
        >
          {["Cash", "Check", "Bank Transfer", "Other"].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="text" placeholder="Note" value={note} onChange={e => setNote(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm outline-none sm:col-span-1"
          style={{ background: "#1e1e1e", border: `1px solid ${BORDER}`, color: CREAM, fontFamily: SANS }}
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-bold flex items-center justify-center gap-1.5"
          style={{ background: SAGE, color: "#fff", fontFamily: SANS, opacity: mutation.isPending ? 0.7 : 1 }}
        >
          {mutation.isPending ? <Spinner size={13} /> : <Plus size={13} />}
          Deposit
        </button>
      </div>
    </div>
  );
}

function AdjustmentForm({ propertyId, onDone }: { propertyId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amount || isNaN(amt) || amt === 0) throw new Error("Enter a non-zero adjustment amount");
      const r = await apiRequest("POST", `/api/retainer/${propertyId}/adjust`, { amount: amt, note });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Adjustment failed");
      return data;
    },
    onSuccess: () => {
      setAmount(""); setNote(""); setError("");
      qc.invalidateQueries({ queryKey: ["/api/retainer"] });
      qc.invalidateQueries({ queryKey: ["/api/retainer", propertyId] });
      qc.invalidateQueries({ queryKey: ["/api/exposure"] });
      onDone();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: "#161616", border: `1px solid ${BORDER}` }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: AMBER, fontFamily: SANS }}>Record Adjustment</p>
      <p className="text-[11px] mb-2" style={{ color: MUTED, fontFamily: SANS }}>Positive amount adds to balance, negative subtracts.</p>
      {error && <div className="text-xs mb-2" style={{ color: TERRACOTTA, fontFamily: SANS }}>{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="number" step="0.01" placeholder="Amount (+/-)" value={amount}
          onChange={e => setAmount(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#1e1e1e", border: `1px solid ${BORDER}`, color: CREAM, fontFamily: SANS }}
        />
        <input
          type="text" placeholder="Note" value={note} onChange={e => setNote(e.target.value)}
          className="rounded-lg px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#1e1e1e", border: `1px solid ${BORDER}`, color: CREAM, fontFamily: SANS }}
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-lg px-3 py-1.5 text-sm font-bold flex items-center justify-center gap-1.5"
          style={{ background: AMBER, color: "#1c1c1c", fontFamily: SANS, opacity: mutation.isPending ? 0.7 : 1 }}
        >
          {mutation.isPending ? <Spinner size={13} /> : <Check size={13} />}
          Adjust
        </button>
      </div>
    </div>
  );
}

function RetainerRow({ property }: { property: any }) {
  const [expanded, setExpanded] = useState(false);
  const [activeForm, setActiveForm] = useState<"deposit" | "adjust" | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const balance = Number(property.balance ?? 0);
  const trendUp = balance >= 0;

  return (
    <div className="rounded-xl mb-3" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 flex-wrap text-left"
      >
        <div className="min-w-0">
          <h3 className="font-bold text-sm truncate" style={{ color: CREAM, fontFamily: SERIF }}>
            {property.nickname || property.address}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: SANS }}>
            {property.client_name} · {property.address}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {trendUp ? <TrendingUp size={14} style={{ color: SAGE }} /> : <TrendingDown size={14} style={{ color: TERRACOTTA }} />}
          <span className="text-sm font-bold" style={{ color: trendUp ? SAGE : TERRACOTTA, fontFamily: SANS }}>
            {money(balance)}
          </span>
          {expanded ? <ChevronUp size={14} style={{ color: MUTED }} /> : <ChevronDown size={14} style={{ color: MUTED }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
          {banner && (
            <div className="mt-3">
              <Banner type={banner.type} message={banner.message} onClose={() => setBanner(null)} />
            </div>
          )}

          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: MUTED, fontFamily: SANS }}>Ledger</p>
            <LedgerView propertyId={property.property_id} />
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveForm(activeForm === "deposit" ? null : "deposit")}
              className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5"
              style={{
                background: activeForm === "deposit" ? SAGE : "#161616",
                color: activeForm === "deposit" ? "#fff" : SAGE,
                border: `1px solid ${SAGE}55`, fontFamily: SANS,
              }}
            >
              <Plus size={12} /> Record Deposit
            </button>
            <button
              onClick={() => setActiveForm(activeForm === "adjust" ? null : "adjust")}
              className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5"
              style={{
                background: activeForm === "adjust" ? AMBER : "#161616",
                color: activeForm === "adjust" ? "#1c1c1c" : AMBER,
                border: `1px solid ${AMBER}55`, fontFamily: SANS,
              }}
            >
              <Eye size={12} /> Record Adjustment
            </button>
          </div>

          {activeForm === "deposit" && (
            <DepositForm
              propertyId={property.property_id}
              onDone={() => { setBanner({ type: "success", message: "Deposit recorded successfully." }); setActiveForm(null); }}
            />
          )}
          {activeForm === "adjust" && (
            <AdjustmentForm
              propertyId={property.property_id}
              onDone={() => { setBanner({ type: "success", message: "Adjustment recorded successfully." }); setActiveForm(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RetainerBalancesTab() {
  const { data: retainers = [], isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["/api/retainer"],
    queryFn: async () => (await apiRequest("GET", "/api/retainer")).json(),
    staleTime: 0,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS }}>
          {retainers.length} propert{retainers.length === 1 ? "y" : "ies"}
        </h2>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5"
          style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: MUTED, fontFamily: SANS }}
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : retainers.length === 0 ? (
        <EmptyState label="No retainer accounts found." icon={DollarSign} />
      ) : (
        retainers.map((p: any) => <RetainerRow key={p.property_id} property={p} />)
      )}
    </div>
  );
}

// ─── TAB 3: Overview ──────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: exposure = [], isLoading: loadingExposure } = useQuery<any[]>({
    queryKey: ["/api/exposure"],
    queryFn: async () => (await apiRequest("GET", "/api/exposure")).json(),
    staleTime: 0,
  });
  const { data: retainers = [], isLoading: loadingRetainers } = useQuery<any[]>({
    queryKey: ["/api/retainer"],
    queryFn: async () => (await apiRequest("GET", "/api/retainer")).json(),
    staleTime: 0,
  });

  const isLoading = loadingExposure || loadingRetainers;
  const totalRetainer = retainers.reduce((sum: number, p: any) => sum + Number(p.balance ?? 0), 0);
  const exposureCount = exposure.filter((p: any) => p.exposed).length;
  const blockedDispatches = exposure.reduce((sum: number, p: any) => sum + Number(p.blocked_work_orders ?? 0), 0);
  const maxBalance = Math.max(1, ...retainers.map((p: any) => Number(p.balance ?? 0)), 1);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} style={{ color: SAGE }} />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS }}>Total Retainer Held</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>{money(totalRetainer)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${exposureCount > 0 ? TERRACOTTA : BORDER}` }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} style={{ color: exposureCount > 0 ? TERRACOTTA : MUTED }} />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS }}>Exposure Count</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: exposureCount > 0 ? TERRACOTTA : CREAM, fontFamily: SERIF }}>{exposureCount}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${blockedDispatches > 0 ? AMBER : BORDER}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} style={{ color: blockedDispatches > 0 ? AMBER : MUTED }} />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: MUTED, fontFamily: SANS }}>Blocked Dispatches</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: blockedDispatches > 0 ? AMBER : CREAM, fontFamily: SERIF }}>{blockedDispatches}</p>
        </div>
      </div>

      {retainers.length === 0 ? (
        <EmptyState label="No properties found." icon={Building2} />
      ) : (
        <div className="space-y-3">
          {retainers.map((p: any) => {
            const balance = Number(p.balance ?? 0);
            const pct = Math.max(0, Math.min(100, (balance / maxBalance) * 100));
            return (
              <div key={p.property_id} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate" style={{ color: CREAM, fontFamily: SERIF }}>
                      {p.nickname || p.address}
                    </h3>
                    <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>{p.client_name}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: CREAM, fontFamily: SANS }}>{money(balance)}</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#161616" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: TERRACOTTA }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type TabKey = "exposure" | "retainer" | "overview";

export default function RetainerPage() {
  const [tab, setTab] = useState<TabKey>("exposure");

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "exposure", label: "Exposure Panel", icon: AlertTriangle },
    { key: "retainer", label: "Retainer Balances", icon: DollarSign },
    { key: "overview", label: "Overview", icon: Building2 },
  ];

  return (
    <AppLayout title="Retainer & Exposure Guard" subtitle="Manage client retainers and monitor cost exposure">
      <div className="p-4 sm:p-6" style={{ background: BG, fontFamily: SANS, minHeight: "100%" }}>
        {/* Tab nav */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 text-sm font-bold rounded-xl px-3.5 py-2 transition-colors"
                style={{
                  background: active ? TERRACOTTA : CARD_BG,
                  color: active ? "#fff" : MUTED,
                  border: `1px solid ${active ? TERRACOTTA : BORDER}`,
                  fontFamily: SANS,
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "exposure" && <ExposurePanelTab />}
        {tab === "retainer" && <RetainerBalancesTab />}
        {tab === "overview" && <OverviewTab />}
      </div>
    </AppLayout>
  );
}
