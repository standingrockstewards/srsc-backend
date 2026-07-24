/**
 * Storm Events Log — Admin/Supervisor only
 * Shows all storm-triggered response events with status workflow,
 * assign-tech action, and storm details.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, AlertTriangle, UserCheck, ChevronDown, RefreshCw, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StormEvent {
  id: number;
  property_id: number;
  weather_alert_id: number;
  triggered_at: string;
  status: "new" | "assigned" | "responded" | "closed";
  assigned_tech_id: number | null;
  scheduled_visit_id: number | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  property_nickname: string;
  owner_name: string;
  owner_email: string;
  event_type: string;
  severity: string;
  headline: string | null;
  effective: string;
  expires: string;
  tech_name: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  responded: "Responded",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#C05A43",
  assigned: "#D9902B",
  responded: "#7A8C6E",
  closed: "#555",
};

const SEVERITY_COLORS: Record<string, string> = {
  Extreme: "#C05A43",
  Severe: "#D9902B",
  Moderate: "#D9902B",
  Minor: "#7A8C6E",
  Unknown: "#888",
};

// ─── Storm Event Row ──────────────────────────────────────────────────────────

function StormEventRow({
  event,
  isAdmin,
  techs,
  onRefresh,
}: {
  event: StormEvent;
  isAdmin: boolean;
  techs: any[];
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assignTech, setAssignTech] = useState<string>(event.assigned_tech_id?.toString() ?? "");
  const [statusOverride, setStatusOverride] = useState<string>("");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const statusColor = STATUS_COLORS[event.status] ?? "#888";
  const severityColor = SEVERITY_COLORS[event.severity] ?? "#888";

  async function handleSave() {
    setSaving(true);
    try {
      const body: any = {};
      if (assignTech && Number(assignTech) !== event.assigned_tech_id) {
        body.assignedTechId = Number(assignTech);
      }
      if (statusOverride && statusOverride !== event.status) body.status = statusOverride;
      if (notes !== (event.notes ?? "")) body.notes = notes;
      if (Object.keys(body).length === 0) { setSaving(false); return; }
      await apiRequest("PATCH", `/api/storm-events/${event.id}`, body);
      qc.invalidateQueries({ queryKey: ["/api/storm-events"] });
      qc.invalidateQueries({ queryKey: ["/api/calendar"] });
      onRefresh();
    } catch {}
    setSaving(false);
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow"
      style={{ background: "#1a1a1a", border: `1px solid ${event.status === "new" ? "#3a1515" : "#222"}` }}
    >
      {/* Row header */}
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Icon */}
        <div
          className="flex items-center justify-center rounded-lg w-9 h-9 flex-shrink-0 mt-0.5"
          style={{ background: "rgba(123,63,160,0.18)", border: "1px solid #3a2060" }}
        >
          <Zap size={16} style={{ color: "#c084fc" }} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-bold text-sm" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
              {event.property_nickname}
            </span>
            {/* Status badge */}
            <span
              className="text-xs rounded-full px-2.5 py-0.5 font-bold"
              style={{
                background: `${statusColor}22`,
                color: statusColor,
                border: `1px solid ${statusColor}44`,
              }}
            >
              {STATUS_LABELS[event.status] ?? event.status}
            </span>
            {/* Severity */}
            <span
              className="text-xs rounded-full px-2 py-0.5 font-semibold"
              style={{ background: `${severityColor}18`, color: severityColor }}
            >
              {event.severity}
            </span>
          </div>

          <div className="text-sm font-medium mb-1" style={{ color: "#C05A43" }}>
            <AlertTriangle size={12} className="inline mr-1 mb-0.5" />
            {event.event_type}
          </div>

          <div className="text-xs" style={{ color: "#888" }}>
            Triggered {new Date(event.triggered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {event.tech_name && (
              <span style={{ color: "#7A8C6E" }}>
                {" "}· Assigned to <strong style={{ color: "#F5F0EA" }}>{event.tech_name}</strong>
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          size={16}
          style={{
            color: "#666",
            flexShrink: 0,
            marginTop: 4,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid #222" }}>
          {/* Headline */}
          {event.headline && (
            <div className="pt-3 text-sm" style={{ color: "#ccc" }}>
              {event.headline}
            </div>
          )}

          {/* Time window */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: "#252525" }}>
              <div className="text-xs font-semibold mb-1" style={{ color: "#7A8C6E" }}>WARNING ACTIVE</div>
              <div className="text-sm" style={{ color: "#F5F0EA" }}>
                {new Date(event.effective).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "#252525" }}>
              <div className="text-xs font-semibold mb-1" style={{ color: "#C05A43" }}>EXPIRES</div>
              <div className="text-sm" style={{ color: "#F5F0EA" }}>
                {new Date(event.expires).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Property owner */}
          <div className="rounded-lg p-3" style={{ background: "#252525" }}>
            <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "#7A8C6E" }}>Property Owner</div>
            <div className="text-sm font-medium" style={{ color: "#F5F0EA" }}>{event.owner_name}</div>
            <div className="text-xs" style={{ color: "#888" }}>{event.owner_email}</div>
          </div>

          {/* Admin controls */}
          {isAdmin && event.status !== "closed" && (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7A8C6E" }}>
                Update Storm Event
              </div>

              {/* Assign tech */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#aaa" }}>Assign Technician</label>
                <select
                  value={assignTech}
                  onChange={(e) => setAssignTech(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "#1e1e1e", border: "1px solid #333", color: "#F5F0EA" }}
                >
                  <option value="">— Unassigned —</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#aaa" }}>Status</label>
                <select
                  value={statusOverride || event.status}
                  onChange={(e) => setStatusOverride(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "#1e1e1e", border: "1px solid #333", color: "#F5F0EA" }}
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: "#aaa" }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add notes…"
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                  style={{ background: "#1e1e1e", border: "1px solid #333", color: "#F5F0EA" }}
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-lg py-2.5 text-sm font-bold transition-opacity"
                style={{ background: "#7B3FA0", color: "#fff", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}

          {/* Notes display (read-only if closed) */}
          {event.status === "closed" && event.notes && (
            <div className="rounded-lg p-3" style={{ background: "#252525" }}>
              <div className="text-xs font-semibold mb-1" style={{ color: "#7A8C6E" }}>Notes</div>
              <p className="text-sm" style={{ color: "#ccc" }}>{event.notes}</p>
            </div>
          )}
          {event.closed_at && (
            <div className="text-xs" style={{ color: "#555" }}>
              Closed {new Date(event.closed_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Storm Events Log Page ────────────────────────────────────────────────────

export default function StormEventsLog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isAdmin = user?.role === "admin" || user?.role === "supervisor";

  // Gate access
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap size={40} style={{ color: "#7B3FA0", margin: "0 auto 12px" }} />
          <p style={{ color: "#888" }}>Storm Events are visible to admins and supervisors only.</p>
        </div>
      </div>
    );
  }

  const { data: events = [], isLoading, refetch } = useQuery<StormEvent[]>({
    queryKey: ["/api/storm-events", statusFilter],
    queryFn: async () => {
      const url = statusFilter !== "all" ? `/api/storm-events?status=${statusFilter}` : "/api/storm-events";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });
  const techs = allUsers.filter((u) => ["field_tech", "supervisor"].includes(u.role));

  const counts = {
    all: events.length,
    new: events.filter((e) => e.status === "new").length,
    assigned: events.filter((e) => e.status === "assigned").length,
    responded: events.filter((e) => e.status === "responded").length,
    closed: events.filter((e) => e.status === "closed").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}
          >
            <Zap size={22} style={{ color: "#c084fc" }} />
            Storm Events
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>
            NWS-triggered storm response visits — polygon-matched to your properties
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "#252525", border: "1px solid #333", color: "#ccc" }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "new", "assigned", "responded", "closed"] as const).map((s) => {
          const isActive = statusFilter === s;
          const color = s === "all" ? "#7B3FA0" : STATUS_COLORS[s] ?? "#888";
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="rounded-full px-3 py-1 text-xs font-bold transition-all"
              style={{
                background: isActive ? `${color}22` : "#1a1a1a",
                border: `1px solid ${isActive ? color : "#333"}`,
                color: isActive ? color : "#888",
              }}
            >
              {STATUS_LABELS[s] ?? "All"} {counts[s] > 0 && `(${counts[s]})`}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1 text-xs" style={{ color: "#555" }}>
          <Filter size={11} />
          <span>Filtered to: {statusFilter === "all" ? "all statuses" : STATUS_LABELS[statusFilter]}</span>
        </div>
      </div>

      {/* Event list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#1a1a1a" }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20" style={{ color: "#555" }}>
          <Zap size={36} style={{ color: "#2a1e38", marginBottom: 12 }} />
          <div className="text-base font-medium" style={{ color: "#666" }}>
            {statusFilter === "all" ? "No storm events yet" : `No ${STATUS_LABELS[statusFilter]?.toLowerCase()} events`}
          </div>
          <div className="text-xs mt-1" style={{ color: "#444" }}>
            Events appear here when an NWS warning polygon covers one of your properties.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <StormEventRow
              key={ev.id}
              event={ev}
              isAdmin={isAdmin}
              techs={techs}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["/api/storm-events"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
