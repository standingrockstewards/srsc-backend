/**
 * Client-facing Signal Flare UI
 * - RaiseFlareButton: prominent CTA with confirm step
 * - ClientFlareList: status view of the client's own flares
 * Used from the client portal page
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Flame, AlertTriangle, Check, ChevronDown, ChevronUp, Info, Shield,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

const SEV_COLOR: Record<string, string> = {
  Critical: "#C0392B", High: "#E67E22", Medium: "#D9902B", Low: "#7A8C6E",
};

const STATUS_COLOR: Record<string, string> = {
  Open: "#C0392B", Acknowledged: "#E67E22", "In Progress": "#D9902B",
  Resolved: "#7A8C6E", Closed: "#555",
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

// ─── Raise Flare Modal ───────────────────────────────────────────────────────
export function RaiseFlareButton({ propertyId, propertyName }: { propertyId: number; propertyName: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<"idle" | "confirm" | "form" | "success">("idle");
  const [form, setForm] = useState({
    category: "General Emergency",
    severity: "High",
    description: "",
  });
  const [error, setError] = useState("");

  const CATEGORIES = [
    "General Emergency",
    "Storm / Flood Damage",
    "Structural Concern",
    "Utility Failure",
    "Security / Break-in",
    "Fire Hazard",
    "Water Intrusion",
    "Unauthorized Access",
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.description.trim()) throw new Error("Please describe the situation");
      const r = await apiRequest("POST", "/api/signal-flares", {
        property_id: propertyId,
        severity: form.severity,
        category: form.category,
        description: form.description,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to raise Signal Flare");
      return data;
    },
    onSuccess: () => {
      setStep("success");
      qc.invalidateQueries({ queryKey: ["/api/signal-flares"] });
      qc.invalidateQueries({ queryKey: ["/api/signal-flares/count/open"] });
    },
    onError: (e: any) => setError(e.message),
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (step === "idle") {
    return (
      <button onClick={() => setStep("confirm")}
        className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-sm w-full transition-all hover:opacity-90"
        style={{ background: "#3A1010", border: "1px solid #C0392B", color: "#F87171" }}>
        <Flame size={16} style={{ color: "#C0392B" }} />
        <div className="text-left">
          <div style={{ color: "#F87171" }}>Raise Signal Flare</div>
          <div className="text-xs font-normal mt-0.5" style={{ color: "#aa5555" }}>For urgent situations needing immediate attention</div>
        </div>
      </button>
    );
  }

  if (step === "success") {
    return (
      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: `${SAGE}12`, border: `1px solid ${SAGE}44` }}>
        <Check size={18} style={{ color: SAGE, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="font-bold text-sm" style={{ color: CREAM }}>Signal Flare Raised</div>
          <div className="text-xs mt-0.5" style={{ color: "#888" }}>
            Our team has been notified immediately. We'll be in contact shortly regarding {propertyName}.
          </div>
          <button onClick={() => { setStep("idle"); setForm({ category: "General Emergency", severity: "High", description: "" }); setError(""); }}
            className="text-xs mt-2 underline" style={{ color: "#666" }}>
            Raise another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid #C0392B" }}>
      {/* Confirm step */}
      {step === "confirm" && (
        <div className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-full p-2 flex-shrink-0" style={{ background: "#3A1010" }}>
              <AlertTriangle size={18} style={{ color: "#C0392B" }} />
            </div>
            <div>
              <div className="font-bold text-sm mb-1" style={{ color: CREAM }}>Raise a Signal Flare?</div>
              <p className="text-sm" style={{ color: "#999", lineHeight: 1.5 }}>
                A Signal Flare immediately alerts the Standing Rock team that <strong style={{ color: CREAM }}>{propertyName}</strong> needs urgent attention. Please only use this for genuine emergencies.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("idle")} className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#777" }}>
              Cancel
            </button>
            <button onClick={() => setStep("form")} className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: "#C0392B", color: "#fff" }}>
              Yes, Raise a Flare
            </button>
          </div>
        </div>
      )}

      {/* Form step */}
      {step === "form" && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={14} style={{ color: "#C0392B" }} />
            <span className="text-sm font-bold" style={{ color: CREAM }}>Signal Flare Details</span>
          </div>
          {error && <div className="text-xs rounded-lg px-2.5 py-2" style={{ background: "rgba(192,90,67,0.1)", color: TERRACOTTA }}>{error}</div>}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>What type of emergency?</label>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
              style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Severity</label>
            <div className="flex gap-2">
              {["Medium","High","Critical"].map(s => (
                <button key={s} onClick={() => set("severity", s)}
                  className="flex-1 text-xs font-bold rounded-lg py-2"
                  style={{
                    background: form.severity === s ? `${SEV_COLOR[s]}22` : "#111",
                    border: `1px solid ${form.severity === s ? SEV_COLOR[s] : "#333"}`,
                    color: form.severity === s ? SEV_COLOR[s] : "#666"
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Describe the situation</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              placeholder="What is happening at the property? Be as specific as possible…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("confirm")} className="rounded-xl px-3 py-2.5 text-sm font-bold"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#777" }}>
              Back
            </button>
            <button onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.description.trim()}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: "#C0392B", color: "#fff", opacity: !form.description.trim() ? 0.6 : 1 }}>
              {mutation.isPending ? "Raising…" : "🚨 Send Signal Flare"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Client Flare Status List ────────────────────────────────────────────────
export function ClientFlareList() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: flares = [] } = useQuery<any[]>({
    queryKey: ["/api/signal-flares"],
    queryFn: async () => (await apiRequest("GET", "/api/signal-flares")).json(),
  });

  if (flares.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
      <div className="px-4 py-3" style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-center gap-2">
          <Flame size={14} style={{ color: TERRACOTTA }} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: TERRACOTTA }}>
            Signal Flares
          </span>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
        {flares.map((f: any) => {
          const isOpen = !["Resolved","Closed"].includes(f.status);
          const sevColor = SEV_COLOR[f.severity] ?? TERRACOTTA;
          const statusColor = STATUS_COLOR[f.status] ?? "#888";
          const isExpanded = expanded === f.id;

          return (
            <div key={f.id}>
              <button onClick={() => setExpanded(isExpanded ? null : f.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isOpen ? sevColor : "#444", boxShadow: isOpen && f.severity === "Critical" ? `0 0 6px ${sevColor}` : "none" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: CREAM }}>{f.category}</span>
                    <span className="text-xs font-bold rounded-full px-2 py-0.5"
                      style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}33` }}>
                      {f.status}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#666" }}>{timeAgo(f.created_at)}</div>
                </div>
                {isExpanded ? <ChevronUp size={12} style={{ color: "#555" }} /> : <ChevronDown size={12} style={{ color: "#555" }} />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 pt-1" style={{ background: "#0f0f0f" }}>
                  <p className="text-sm mb-2" style={{ color: "#aaa" }}>{f.description}</p>
                  {f.status === "Resolved" && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: SAGE }}>
                      <Shield size={12} /> Resolved {f.resolved_at ? timeAgo(f.resolved_at) : ""}
                    </div>
                  )}
                  {isOpen && f.acknowledged_at && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#E67E22" }}>
                      <Check size={12} /> Acknowledged — our team is working on it
                    </div>
                  )}
                  {isOpen && !f.acknowledged_at && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#C0392B" }}>
                      <Info size={12} /> Awaiting acknowledgment from our team
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
