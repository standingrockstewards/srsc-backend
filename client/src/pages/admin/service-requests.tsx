/**
 * Admin Service Requests — all client requests, status management
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Wrench, ChevronDown, ChevronRight, RefreshCw, Filter } from "lucide-react";
import { AppLayout } from "@/components/app-layout";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

const STATUS_LABELS: Record<string, string> = {
  new: "New", reviewed: "Reviewed", scheduled: "Scheduled",
  completed: "Completed", declined: "Declined",
};
const STATUS_COLORS: Record<string, string> = {
  new: "#7A8C6E", reviewed: "#D9902B", scheduled: "#5A7A8C",
  completed: "#4a9a6a", declined: "#666",
};
const NEXT_STATUSES: Record<string, string[]> = {
  new: ["reviewed", "scheduled", "declined"],
  reviewed: ["scheduled", "completed", "declined"],
  scheduled: ["completed", "declined"],
  completed: [],
  declined: [],
};

function RequestRow({ req, onRefresh }: { req: any; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(req.internal_note ?? "");
  const [saving, setSaving] = useState(false);
  const statusColor = STATUS_COLORS[req.status] ?? "#888";

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/service-requests/${req.id}`, { status: newStatus, internalNote: note });
      qc.invalidateQueries({ queryKey: ["/api/service-requests/all"] });
      onRefresh();
    } catch {}
    setSaving(false);
  }

  async function handleSaveNote() {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/service-requests/${req.id}`, { internalNote: note });
      qc.invalidateQueries({ queryKey: ["/api/service-requests/all"] });
    } catch {}
    setSaving(false);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${req.status === "new" ? SAGE + "44" : CARD_BORDER}` }}>
      <button className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(v => !v)}>
        <div className="rounded-lg p-2 mt-0.5 flex-shrink-0" style={{ background: `${statusColor}18` }}>
          <Wrench size={14} style={{ color: statusColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-bold text-sm" style={{ color: CREAM }}>{req.category}</span>
            <span className="text-xs rounded-full px-2.5 py-0.5 font-bold"
              style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
              {STATUS_LABELS[req.status] ?? req.status}
            </span>
          </div>
          <p className="text-sm truncate" style={{ color: "#999" }}>{req.description}</p>
          <div className="text-xs mt-0.5 flex gap-2" style={{ color: "#555" }}>
            <span style={{ color: TERRACOTTA }}>{req.client_name}</span>
            <span>·</span>
            <span>{req.property_nickname}</span>
            <span>·</span>
            <span>{new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
        {expanded ? <ChevronDown size={14} style={{ color: "#555", flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: "#555", flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
          <div className="pt-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Full Description</div>
            <p className="text-sm" style={{ color: "#ccc" }}>{req.description}</p>
          </div>

          {/* Update status */}
          {NEXT_STATUSES[req.status]?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: SAGE }}>Update Status</div>
              <div className="flex flex-wrap gap-2">
                {NEXT_STATUSES[req.status].map(s => (
                  <button key={s} onClick={() => handleStatusChange(s)} disabled={saving}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity"
                    style={{ background: `${STATUS_COLORS[s]}22`, color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}44`, opacity: saving ? 0.5 : 1 }}>
                    → {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Internal note */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Internal Note</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Add internal note (not visible to client)…"
              className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
              style={{ background: "#141414", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
            />
            <button onClick={handleSaveNote} disabled={saving}
              className="mt-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity"
              style={{ background: "#252525", color: "#ccc", border: `1px solid ${CARD_BORDER}`, opacity: saving ? 0.5 : 1 }}>
              {saving ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminServiceRequests() {
  const [filter, setFilter] = useState("all");

  const { data: requests = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/service-requests/all"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/service-requests/all");
      return r.json();
    },
  });

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);

  return (
    <AppLayout title="Service Requests" subtitle="All client-submitted requests">
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"
            style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            <Wrench size={20} style={{ color: TERRACOTTA }} />
            Service Requests
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>All client-submitted requests across properties</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: "#252525", border: `1px solid ${CARD_BORDER}`, color: "#ccc" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {["all", ...Object.keys(STATUS_LABELS)].map(s => {
          const isActive = filter === s;
          const color = s === "all" ? TERRACOTTA : STATUS_COLORS[s] ?? "#888";
          const count = s === "all" ? requests.length : requests.filter(r => r.status === s).length;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className="rounded-full px-3 py-1 text-xs font-bold transition-all"
              style={{
                background: isActive ? `${color}22` : CARD_BG,
                border: `1px solid ${isActive ? color : CARD_BORDER}`,
                color: isActive ? color : "#888",
              }}>
              {s === "all" ? "All" : STATUS_LABELS[s]} {count > 0 ? `(${count})` : ""}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: CARD_BG }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <Wrench size={32} style={{ color: "#333", margin: "0 auto 12px" }} />
          <p style={{ color: "#666" }}>No {filter !== "all" ? STATUS_LABELS[filter]?.toLowerCase() + " " : ""}requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <RequestRow key={req.id} req={req} onRefresh={() => refetch()} />
          ))}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
