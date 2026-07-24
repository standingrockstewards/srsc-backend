/**
 * Admin/Supervisor — Signal Flare Console
 * Full list + detail drawer with timeline, ACK/assign/resolve/close actions
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import {
  Flame, AlertTriangle, ChevronRight, Clock, Check, User,
  MessageSquare, X as XIcon, Loader2, Shield, Zap, Info,
  MapPin, Wrench, RefreshCw,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SIDEBAR_BG = "#141414";

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  Critical: { color: "#C0392B", bg: "#3A1010", border: "#6B1515", label: "Critical", dot: "bg-red-600" },
  High:     { color: "#E67E22", bg: "#2A1800", border: "#5A3000", label: "High",     dot: "bg-orange-500" },
  Medium:   { color: "#D9902B", bg: "#2A2000", border: "#5A4000", label: "Medium",   dot: "bg-yellow-500" },
  Low:      { color: "#7A8C6E", bg: "#1A2018", border: "#3A4A30", label: "Low",      dot: "bg-green-600" },
};

const STATUS_COLOR: Record<string, string> = {
  Open:         "#C0392B",
  Acknowledged: "#E67E22",
  "In Progress":"#D9902B",
  Resolved:     "#7A8C6E",
  Closed:       "#555",
};

const EVENT_ICONS: Record<string, React.ComponentType<any>> = {
  raised:       Flame,
  acknowledged: Check,
  note:         MessageSquare,
  assigned:     User,
  escalated:    AlertTriangle,
  resolved:     Shield,
  closed:       XIcon,
  in_progress:  RefreshCw,
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEV[severity as keyof typeof SEV] ?? SEV.High;
  return (
    <span className="text-xs font-bold rounded-full px-2.5 py-0.5"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#888";
  return (
    <span className="text-xs font-bold rounded-full px-2.5 py-0.5"
      style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
      {status}
    </span>
  );
}

// ─── Flare Detail Drawer ─────────────────────────────────────────────────────
function FlareDetail({ flareId, onClose, onUpdated }: {
  flareId: number;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [assignTo, setAssignTo] = useState<number | "">("");
  const [actionLoading, setActionLoading] = useState("");

  const { data: flare, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/signal-flares", flareId],
    queryFn: async () => (await apiRequest("GET", `/api/signal-flares/${flareId}`)).json(),
  });

  const { data: techs = [] } = useQuery<any[]>({
    queryKey: ["/api/users/techs"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/users");
      const all = await r.json();
      return all.filter((u: any) => u.role === "field_tech" && u.active);
    },
  });

  const doAction = async (action: string, extra?: Record<string, any>) => {
    setActionLoading(action);
    try {
      await apiRequest("PATCH", `/api/signal-flares/${flareId}`, { action, note: note || undefined, ...extra });
      setNote("");
      refetch();
      qc.invalidateQueries({ queryKey: ["/api/signal-flares"] });
      qc.invalidateQueries({ queryKey: ["/api/signal-flares/count/open"] });
      onUpdated();
    } finally { setActionLoading(""); }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await doAction("note");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin" style={{ color: TERRACOTTA }} />
      </div>
    );
  }
  if (!flare) return null;

  const sev = SEV[flare.severity as keyof typeof SEV] ?? SEV.High;
  const isOpen = !["Resolved","Closed"].includes(flare.status);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 flex items-start gap-3"
        style={{ background: sev.bg, borderBottom: `1px solid ${sev.border}` }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SeverityBadge severity={flare.severity} />
            <StatusBadge status={flare.status} />
            {flare.escalated === 1 && (
              <span className="text-xs font-bold rounded-full px-2.5 py-0.5 bg-red-900/50 text-red-400 border border-red-800">
                ⚠ Escalated
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold mt-1" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            {flare.category}
          </h2>
          <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: "#aaa" }}>
            <MapPin size={12} />
            <span>{flare.property_name}</span>
            <span style={{ color: "#444" }}>·</span>
            <span>Raised by {flare.raised_by_name}</span>
            <span style={{ color: "#444" }}>·</span>
            <span>{timeAgo(flare.created_at)}</span>
          </div>
        </div>
        <button onClick={onClose} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-white/10" style={{ color: "#888" }}>
          <XIcon size={16} />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#666" }}>Description</div>
          <p className="text-sm" style={{ color: "#ccc", lineHeight: 1.6 }}>{flare.description}</p>
        </div>

        {/* Context panel — appliances */}
        {flare.appliances?.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#666" }}>Property Equipment</div>
            <div className="flex flex-wrap gap-2">
              {flare.appliances.map((ap: any) => (
                <span key={ap.id} className="text-xs rounded-lg px-2.5 py-1"
                  style={{ background: "#222", color: "#aaa", border: `1px solid ${CARD_BORDER}` }}>
                  {ap.make} {ap.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {isOpen && (
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#666" }}>Actions</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {flare.status === "Open" && (
                <button onClick={() => doAction("acknowledge")}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 text-sm font-bold rounded-xl px-3 py-2"
                  style={{ background: TERRACOTTA, color: "#fff" }}>
                  {actionLoading === "acknowledge" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Acknowledge
                </button>
              )}
              {["Open","Acknowledged","In Progress"].includes(flare.status) && (
                <button onClick={() => doAction("resolve")}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 text-sm font-bold rounded-xl px-3 py-2"
                  style={{ background: SAGE, color: "#fff" }}>
                  {actionLoading === "resolve" ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                  Resolve
                </button>
              )}
              {flare.status === "Resolved" && (
                <button onClick={() => doAction("close")}
                  disabled={!!actionLoading}
                  className="flex items-center gap-1.5 text-sm font-bold rounded-xl px-3 py-2"
                  style={{ background: "#333", color: "#aaa", border: `1px solid #444` }}>
                  {actionLoading === "close" ? <Loader2 size={12} className="animate-spin" /> : <XIcon size={12} />}
                  Close
                </button>
              )}
            </div>

            {/* Assign tech */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Assign to Field Tech</label>
                <select value={assignTo}
                  onChange={e => setAssignTo(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                  style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                  <option value="">Select tech…</option>
                  {techs.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button onClick={() => { if (assignTo) doAction("assign", { assigned_to: assignTo }); }}
                disabled={!assignTo || !!actionLoading}
                className="rounded-xl px-3 py-2 text-sm font-bold"
                style={{ background: `${TERRACOTTA}cc`, color: "#fff", opacity: !assignTo ? 0.5 : 1 }}>
                <User size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Add note */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#666" }}>Add Note</div>
          <div className="flex gap-2">
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add a note to the timeline…"
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
              onKeyDown={e => { if (e.key === "Enter" && note.trim()) addNote(); }} />
            <button onClick={addNote}
              disabled={!note.trim() || !!actionLoading}
              className="rounded-xl px-3 py-2 text-sm font-bold"
              style={{ background: TERRACOTTA, color: "#fff", opacity: !note.trim() ? 0.5 : 1 }}>
              <MessageSquare size={14} />
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-5 py-4">
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#666" }}>Timeline</div>
          <div className="space-y-3">
            {(flare.events ?? []).map((ev: any, i: number) => {
              const Icon = EVENT_ICONS[ev.event_type] ?? Info;
              const isEscalation = ev.event_type === "escalated";
              return (
                <div key={ev.id} className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: isEscalation ? "#3A1010" : "#1e1e1e", border: `1px solid ${isEscalation ? "#6B1515" : "#333"}` }}>
                      <Icon size={13} style={{ color: isEscalation ? "#C0392B" : "#888" }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: isEscalation ? "#F87171" : "#ccc", lineHeight: 1.4 }}>
                      {ev.note}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#555" }}>
                      {ev.actor_name ?? "System"} · {timeAgo(ev.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Raise Flare Modal (Admin/Staff) ────────────────────────────────────────
function RaiseFlareModal({ onClose, onRaised }: { onClose: () => void; onRaised: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    property_id: "",
    severity: "High",
    category: "General Emergency",
    description: "",
  });
  const [error, setError] = useState("");

  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => (await apiRequest("GET", "/api/properties")).json(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.property_id || !form.description) throw new Error("All fields are required");
      const r = await apiRequest("POST", "/api/signal-flares", { ...form, property_id: Number(form.property_id), source: "staff" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      return data;
    },
    onSuccess: () => { onRaised(); onClose(); },
    onError: (e: any) => setError(e.message),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative rounded-2xl overflow-hidden w-full max-w-lg"
        style={{ background: "#141414", border: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center gap-2">
            <Flame size={16} style={{ color: TERRACOTTA }} />
            <h3 className="font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
              Raise Signal Flare
            </h3>
          </div>
          <button onClick={onClose} style={{ color: "#666" }}>✕</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="text-sm rounded-xl px-3 py-2" style={{ background: "rgba(192,90,67,0.1)", color: TERRACOTTA }}>{error}</div>}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#666" }}>Property</label>
            <select value={form.property_id} onChange={e => set("property_id", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none"
              style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
              <option value="">Select property…</option>
              {properties.map((p: any) => <option key={p.id} value={p.id}>{p.nickname ?? p.address}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#666" }}>Severity</label>
              <select value={form.severity} onChange={e => set("severity", e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none"
                style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                {["Low","Medium","High","Critical"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#666" }}>Category</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none"
                style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                {["General Emergency","Storm Damage","Structural Issue","Security Breach","Utility Failure","Flooding","Fire Hazard","Medical Emergency","Unauthorized Access"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#666" }}>Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              placeholder="Describe what you observed or what's happening at the property…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#777" }}>Cancel</button>
            <button onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: TERRACOTTA, color: "#fff" }}>
              {mutation.isPending ? "Raising…" : "🚨 Raise Signal Flare"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Console Page ───────────────────────────────────────────────────────
export default function SignalFlaresPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("active");
  const [showRaise, setShowRaise] = useState(false);

  const { data: flares = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/signal-flares"],
    queryFn: async () => (await apiRequest("GET", "/api/signal-flares")).json(),
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  const canRespond = can("respond_signal_flares");

  const filtered = flares.filter((f: any) => {
    if (filterStatus === "active") return !["Resolved","Closed"].includes(f.status);
    if (filterStatus === "resolved") return ["Resolved","Closed"].includes(f.status);
    return true;
  });

  const openCount = flares.filter((f: any) => f.status === "Open").length;
  const criticalCount = flares.filter((f: any) => f.severity === "Critical" && !["Resolved","Closed"].includes(f.status)).length;

  return (
    <AppLayout title="Signal Flares" subtitle="Urgent property escalations">
      {showRaise && (
        <RaiseFlareModal onClose={() => setShowRaise(false)} onRaised={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ["/api/signal-flares/count/open"] });
        }} />
      )}

      <div className="flex flex-col lg:flex-row h-full" style={{ minHeight: "calc(100vh - 60px)" }}>
        {/* Left: list */}
        <div className={`flex-shrink-0 ${selectedId ? "lg:w-2/5" : "w-full"} flex flex-col`}
          style={{ borderRight: selectedId ? `1px solid ${CARD_BORDER}` : "none" }}>

          {/* Console header */}
          <div className="p-4 flex-shrink-0" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
            {/* Stats row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: openCount > 0 ? "#3A1010" : "#1a1a1a", border: `1px solid ${openCount > 0 ? "#6B1515" : CARD_BORDER}` }}>
                <Flame size={14} style={{ color: openCount > 0 ? "#C0392B" : "#555" }} />
                <span className="text-sm font-bold" style={{ color: openCount > 0 ? "#F87171" : "#555" }}>
                  {openCount} Open
                </span>
              </div>
              {criticalCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 animate-pulse"
                  style={{ background: "#3A1010", border: "1px solid #C0392B" }}>
                  <AlertTriangle size={14} style={{ color: "#C0392B" }} />
                  <span className="text-sm font-bold" style={{ color: "#F87171" }}>
                    {criticalCount} Critical
                  </span>
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => refetch()} className="rounded-lg p-2 hover:bg-white/5" style={{ color: "#666" }}>
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => setShowRaise(true)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold"
                  style={{ background: TERRACOTTA, color: "#fff" }}>
                  <Flame size={13} /> Raise
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {[["active","Active"],["resolved","Resolved"],["all","All"]].map(([v,l]) => (
                <button key={v} onClick={() => setFilterStatus(v)}
                  className="text-xs font-bold rounded-full px-3 py-1"
                  style={{
                    background: filterStatus === v ? `${TERRACOTTA}22` : CARD_BG,
                    border: `1px solid ${filterStatus === v ? TERRACOTTA : CARD_BORDER}`,
                    color: filterStatus === v ? TERRACOTTA : "#777"
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Flare list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: CARD_BG }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <Shield size={32} style={{ color: "#333" }} />
                <p className="text-sm" style={{ color: "#555" }}>No {filterStatus === "active" ? "active" : ""} flares</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
                {filtered.map((f: any) => {
                  const s = SEV[f.severity as keyof typeof SEV] ?? SEV.High;
                  const isSelected = selectedId === f.id;
                  const isEscalated = f.escalated === 1;
                  return (
                    <button key={f.id} onClick={() => setSelectedId(isSelected ? null : f.id)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/5 ${isSelected ? "bg-white/5" : ""}`}
                      style={{ borderLeft: `3px solid ${isSelected ? s.color : "transparent"}` }}>
                      {/* Severity indicator */}
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color, boxShadow: isEscalated ? `0 0 8px ${s.color}` : "none" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm" style={{ color: CREAM }}>{f.category}</span>
                          {isEscalated && <span className="text-xs text-red-400 font-bold">⚠ ESCALATED</span>}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "#777" }}>{f.property_name}</div>
                        <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={f.severity} />
                          <StatusBadge status={f.status} />
                          <span style={{ color: "#555" }}>{timeAgo(f.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight size={14} style={{ color: "#444", flexShrink: 0, marginTop: 4 }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selectedId && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <FlareDetail
              flareId={selectedId}
              onClose={() => setSelectedId(null)}
              onUpdated={() => {
                refetch();
                qc.invalidateQueries({ queryKey: ["/api/signal-flares/count/open"] });
              }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
