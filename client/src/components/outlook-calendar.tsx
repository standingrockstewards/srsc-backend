/**
 * OutlookCalendar — Phase 2: clickable events, detail panel, admin event creation.
 * Events fetched from /api/calendar.
 * Color coding: Visits = #C05A43, Launch Crew = #7A8C6E, Weather Alerts = #D9902B, Custom = #8B7355
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X, Plus, CalendarDays, Clock, MapPin, FileText, Zap, AlertTriangle, UserCheck, ExternalLink } from "lucide-react";
import { VisitReportView, type VisitReportData } from "@/components/visit-report-view";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────
type CalendarEvent = {
  id: string;
  dbId?: number;
  scheduledId?: number; // present on scheduled visit events
  completed?: boolean;  // true if that scheduled visit is done
  type: string;
  title: string;
  date: string;
  time?: string;
  propertyId?: number;
  workOrderId?: number;
  status?: string;
  notes?: string;
  isCustom?: boolean;
  // Storm response fields
  stormEventId?: number | null;
  weatherAlertId?: number | null;
  stormData?: {
    id: number;
    status: string;
    event_type: string;
    severity: string;
    headline: string | null;
    effective: string;
    expires: string;
    assigned_tech_id: number | null;
    tech_name?: string | null;
  } | null;
};


type View = "month" | "week" | "day";

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  visit:          "#C05A43",
  launch_crew:    "#7A8C6E",
  weather_alert:  "#D9902B",
  custom:         "#8B7355",
  maintenance:    "#5A7A8C",
  storm_response: "#7B3FA0",  // purple — urgent, distinct from all others
};

const EVENT_BG: Record<string, string> = {
  visit:          "rgba(192, 90, 67, 0.18)",
  launch_crew:    "rgba(122, 140, 110, 0.18)",
  weather_alert:  "rgba(217, 144, 43, 0.18)",
  custom:         "rgba(139, 115, 85, 0.18)",
  maintenance:    "rgba(90, 122, 140, 0.18)",
  storm_response: "rgba(123, 63, 160, 0.22)",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  visit:          "Property Visit",
  launch_crew:    "Launch Crew Task",
  weather_alert:  "Weather Alert",
  custom:         "Custom Event",
  maintenance:    "Maintenance",
  storm_response: "Storm Response",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled:    "#7A8C6E",
  completed:    "#4a9a6a",
  all_clear:    "#4a9a6a",
  items_flagged:"#D9902B",
  active:       "#C05A43",
  cancelled:    "#666",
};

// ─── Date utilities ───────────────────────────────────────────────────────────
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  return s;
}

function formatDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Event Chip ───────────────────────────────────────────────────────────────
function EventChip({ event, onClick }: { event: CalendarEvent; onClick: (e: CalendarEvent, ev: React.MouseEvent) => void }) {
  const color = EVENT_COLORS[event.type] ?? "#C05A43";
  const bg = EVENT_BG[event.type] ?? "rgba(192,90,67,0.15)";
  return (
    <div
      className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight cursor-pointer hover:opacity-90 transition-opacity"
      style={{ color, background: bg, borderLeft: `2px solid ${color}` }}
      title={event.title + (event.time ? ` @ ${event.time}` : "") + (event.notes ? ` — ${event.notes}` : "")}
      onClick={(ev) => { ev.stopPropagation(); onClick(event, ev); }}
    >
      {event.type === "storm_response" && <Zap size={9} className="inline mr-0.5 mb-0.5" />}
      {event.time && <span className="opacity-70 mr-1">{event.time}</span>}
      {event.title}
    </div>
  );
}

// ─── Visit Report Section (wraps VisitReportView with query) ─────────────────
function VisitReportSection({ scheduledId }: { scheduledId: number }) {
  const { data: report, isLoading } = useQuery<VisitReportData>({
    queryKey: ["/api/scheduled", scheduledId, "report"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/scheduled/${scheduledId}/report`);
      if (!res.ok) throw new Error("no report");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg p-3 animate-pulse" style={{ background: "#252525" }}>
        <div className="h-3 rounded bg-white/10 w-1/3 mb-2" />
        <div className="h-3 rounded bg-white/10 w-2/3" />
      </div>
    );
  }
  if (!report) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2a2a" }}>
      <div className="px-3 py-2" style={{ background: "#252525" }}>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#7A8C6E" }}>Visit Report</span>
      </div>
      <div className="p-3" style={{ background: "#1e1e1e" }}>
        <VisitReportView report={report} compact={true} />
      </div>
    </div>
  );
}
// ─── Event Detail Panel ───────────────────────────────────────────────────────
// ─── Storm Event Detail (inline panel inside calendar detail) ─────────────────
function StormEventDetail({ event, isAdmin }: { event: CalendarEvent; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: techs = [] } = useQuery<any[]>({
    queryKey: ["/api/users/techs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const all = await res.json();
      return all.filter((u: any) => ["field_tech","supervisor"].includes(u.role));
    },
  });

  const [assignTech, setAssignTech] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [assigned, setAssigned] = useState(false);

  const sd = event.stormData;
  if (!sd) return null;

  const STORM_STATUS_COLORS: Record<string,string> = {
    new: "#C05A43", assigned: "#D9902B", responded: "#7A8C6E", closed: "#555",
  };
  const statusColor = STORM_STATUS_COLORS[sd.status] ?? "#888";

  async function handleAssign() {
    if (!assignTech || !event.stormEventId) return;
    setAssigning(true);
    try {
      await apiRequest("PATCH", `/api/storm-events/${event.stormEventId}`, {
        assignedTechId: Number(assignTech),
        status: "assigned",
      });
      setAssigned(true);
      qc.invalidateQueries({ queryKey: ["/api/calendar"] });
      qc.invalidateQueries({ queryKey: ["/api/storm-events"] });
    } catch {}
    setAssigning(false);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #3a2060" }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(123,63,160,0.18)", borderBottom: "1px solid #3a2060" }}>
        <Zap size={13} style={{ color: "#c084fc" }} />
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#c084fc" }}>Storm Response Event</span>
        <span className="ml-auto text-xs rounded-full px-2 py-0.5 font-bold capitalize"
          style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
          {sd.status}
        </span>
      </div>

      <div className="p-3 space-y-2" style={{ background: "#1e1825" }}>
        {/* Warning type */}
        <div className="flex items-start gap-2">
          <AlertTriangle size={13} style={{ color: "#D9902B", marginTop: 2, flexShrink: 0 }} />
          <div>
            <div className="text-xs font-bold" style={{ color: "#F5F0EA" }}>{sd.event_type}</div>
            {sd.headline && <div className="text-xs" style={{ color: "#aaa" }}>{sd.headline}</div>}
          </div>
        </div>

        {/* Time window */}
        <div className="text-xs space-y-0.5" style={{ color: "#888" }}>
          <div><span style={{ color: "#aaa" }}>Active:</span> {new Date(sd.effective).toLocaleString()}</div>
          <div><span style={{ color: "#aaa" }}>Expires:</span> {new Date(sd.expires).toLocaleString()}</div>
        </div>

        {/* Assigned tech */}
        {sd.assigned_tech_id && !assigned && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#7A8C6E" }}>
            <UserCheck size={12} />
            <span>Assigned: <strong style={{ color: "#F5F0EA" }}>{sd.tech_name ?? `Tech #${sd.assigned_tech_id}`}</strong></span>
          </div>
        )}
        {assigned && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#7A8C6E" }}>
            <UserCheck size={12} /><span>Tech assigned ✓</span>
          </div>
        )}

        {/* Assign tech (admin/supervisor) */}
        {isAdmin && sd.status !== "closed" && !assigned && (
          <div className="flex items-center gap-2 pt-1">
            <select
              value={assignTech}
              onChange={e => setAssignTech(e.target.value)}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "#2a1e38", border: "1px solid #4a3060", color: "#F5F0EA" }}
            >
              <option value="">Assign tech…</option>
              {techs.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button
              onClick={handleAssign}
              disabled={!assignTech || assigning}
              className="rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity"
              style={{ background: "#7B3FA0", color: "#fff", opacity: (!assignTech || assigning) ? 0.5 : 1 }}
            >
              {assigning ? "…" : "Assign"}
            </button>
          </div>
        )}

        {/* Link to storm events log */}
        <a
          href="#/storm-events"
          className="flex items-center gap-1 text-xs pt-1"
          style={{ color: "#c084fc", textDecoration: "none" }}
        >
          <ExternalLink size={11} />
          View in Storm Events Log
        </a>
      </div>
    </div>
  );
}

function EventDetailPanel({ event, onClose, isAdmin }: { event: CalendarEvent; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/calendar-events/${event.dbId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar"] }); onClose(); },
  });

  const color = EVENT_COLORS[event.type] ?? "#C05A43";
  const statusColor = STATUS_COLORS[event.status ?? ""] ?? "#888";
  const typeParsed = parseEventDate(event.date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", maxHeight: "90vh" }}>
        {/* Header bar */}
        <div className="flex items-center gap-3 p-4 pb-3 flex-shrink-0" style={{ borderLeft: `4px solid ${color}`, background: "#1a1a1a" }}>
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color }}>
              {EVENT_TYPE_LABELS[event.type] ?? event.type}
            </div>
            <div className="font-bold text-lg" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
              {event.title}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-white/10">
            <X size={16} style={{ color: "#888" }} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Date/time */}
          <div className="flex items-center gap-2 text-sm" style={{ color: "#ccc" }}>
            <CalendarDays size={14} style={{ color: "#7A8C6E" }} />
            <span>{typeParsed ? formatDate(typeParsed) : event.date}</span>
            {event.time && (
              <>
                <Clock size={14} style={{ color: "#7A8C6E", marginLeft: 4 }} />
                <span>{event.time}</span>
              </>
            )}
          </div>

          {/* Status */}
          {event.status && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize" style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor }} />
                {event.status.replace(/_/g, " ")}
              </span>
            </div>
          )}

          {/* Property link */}
          {event.propertyId && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#ccc" }}>
              <MapPin size={14} style={{ color: "#7A8C6E" }} />
              <span className="text-sm">Property #{event.propertyId}</span>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="rounded-lg p-3" style={{ background: "#252525", border: "1px solid #2a2a2a" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <FileText size={12} style={{ color: "#7A8C6E" }} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7A8C6E" }}>Notes</span>
              </div>
              <p className="text-sm" style={{ color: "#d0cec9" }}>{event.notes}</p>
            </div>
          )}

          {/* ── Storm Response Detail ── */}
          {event.type === "storm_response" && (
            <StormEventDetail event={event} isAdmin={isAdmin} />
          )}

          {/* ── Visit Report (if this is a completed scheduled visit) ── */}
          {event.scheduledId && event.completed && (
            <VisitReportSection scheduledId={event.scheduledId} />
          )}

          {/* Admin delete for custom events */}
          {isAdmin && event.isCustom && event.dbId && (
            <div className="pt-2 border-t" style={{ borderColor: "#2a2a2a" }}>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 w-full"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New Event Modal (admin only) ─────────────────────────────────────────────
function NewEventModal({ defaultDate, onClose }: { defaultDate: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    type: "custom",
    date: toYMD(defaultDate),
    time: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/calendar-events", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar"] }); onClose(); },
  });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
          <h3 className="font-bold text-base" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>New Event</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10"><X size={16} style={{ color: "#888" }} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>Event Title</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              value={form.title}
              onChange={e => update("title", e.target.value)}
              placeholder="e.g. Dock Inspection, Storm Prep..."
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>Type</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              value={form.type}
              onChange={e => update("type", e.target.value)}
            >
              <option value="custom">Custom Event</option>
              <option value="visit">Property Visit</option>
              <option value="launch_crew">Launch Crew Task</option>
              <option value="maintenance">Maintenance</option>
              <option value="weather_alert">Weather Alert</option>
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>Date</label>
              <input type="date" className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
                value={form.date} onChange={e => update("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>Time (optional)</label>
              <input type="time" className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
                value={form.time} onChange={e => update("time", e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>Notes (optional)</label>
            <textarea
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              value={form.notes}
              onChange={e => update("notes", e.target.value)}
              placeholder="Any relevant details..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" style={{ color: "#888" }} onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 font-semibold"
              style={{ background: "#C05A43", color: "#fff" }}
              onClick={() => create.mutate({ ...form, createdBy: user?.id })}
              disabled={!form.title || !form.date || create.isPending}
            >
              {create.isPending ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({
  year, month, events, today, onDayClick, onEventClick,
}: {
  year: number; month: number; events: CalendarEvent[]; today: Date;
  onDayClick: (d: Date) => void; onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void;
}) {
  const firstDay = startOfMonth(year, month);
  const startDay = startOfWeek(firstDay);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    cells.push(d);
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const d = parseEventDate(ev.date);
      if (!d) continue;
      const key = toYMD(d);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  const todayYMD = toYMD(today);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "#2a2a2a" }}>
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide"
            style={{ color: d === "Sun" || d === "Sat" ? "#5a5a5a" : "#8a8a8a", background: "#1a1a1a" }}>
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-rows-6" style={{ gridAutoRows: "1fr" }}>
        {Array.from({ length: 6 }).map((_, wi) => (
          <div key={wi} className="grid grid-cols-7" style={{ borderBottom: "1px solid #222" }}>
            {cells.slice(wi * 7, wi * 7 + 7).map((cell) => {
              const ymd = toYMD(cell);
              const dayEvents = eventsByDate[ymd] ?? [];
              const isCurrentMonth = cell.getMonth() === month;
              const isToday = ymd === todayYMD;
              const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;

              return (
                <div key={ymd}
                  className="flex flex-col p-1 cursor-pointer transition-colors hover:bg-white/[0.03]"
                  style={{ borderRight: "1px solid #222", background: isWeekend ? "rgba(255,255,255,0.015)" : "transparent", opacity: isCurrentMonth ? 1 : 0.35 }}
                  onClick={() => onDayClick(cell)}
                >
                  <span className="text-xs font-semibold mb-0.5 self-end w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                    style={isToday ? { background: "#C05A43", color: "#F5F0EA" } : { color: isCurrentMonth ? "#d0cec9" : "#555" }}>
                    {cell.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <EventChip key={ev.id} event={ev} onClick={onEventClick} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ date, events, today, onEventClick }: { date: Date; events: CalendarEvent[]; today: Date; onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void }) {
  const weekStart = startOfWeek(date);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const todayYMD = toYMD(today);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const d = parseEventDate(ev.date);
      if (!d) continue;
      const key = toYMD(d);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "#2a2a2a", background: "#1a1a1a" }}>
        {days.map((d) => {
          const ymd = toYMD(d);
          const isToday = ymd === todayYMD;
          return (
            <div key={ymd} className="py-3 text-center">
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "#8a8a8a" }}>{DAYS_FULL[d.getDay()].slice(0, 3)}</div>
              <span className="text-lg font-semibold w-9 h-9 flex items-center justify-center rounded-full mx-auto"
                style={isToday ? { background: "#C05A43", color: "#fff" } : { color: "#d0cec9" }}>
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex-1 grid grid-cols-7 overflow-y-auto">
        {days.map((d) => {
          const ymd = toYMD(d);
          const dayEvents = eventsByDate[ymd] ?? [];
          return (
            <div key={ymd} className="p-2 flex flex-col gap-1.5" style={{ borderRight: "1px solid #222", minHeight: 200 }}>
              {dayEvents.length === 0 && <span className="text-[11px] text-center mt-4" style={{ color: "#444" }}>—</span>}
              {dayEvents.map(ev => <EventChip key={ev.id} event={ev} onClick={onEventClick} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({ date, events, today, onEventClick }: { date: Date; events: CalendarEvent[]; today: Date; onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void }) {
  const ymd = toYMD(date);
  const dayEvents = useMemo(() => events.filter(ev => {
    const d = parseEventDate(ev.date);
    return d && toYMD(d) === ymd;
  }), [events, ymd]);
  const isToday = ymd === toYMD(today);

  return (
    <div className="flex-1 flex flex-col p-6" style={{ background: "#1a1a1a" }}>
      <div className="mb-6">
        <div className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#7A8C6E" }}>{DAYS_FULL[date.getDay()]}</div>
        <div className="text-4xl font-bold" style={{ color: isToday ? "#C05A43" : "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>{date.getDate()}</div>
        <div className="text-sm" style={{ color: "#888" }}>{MONTH_NAMES[date.getMonth()]} {date.getFullYear()}</div>
      </div>
      {dayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 opacity-40">
          <CalendarDays size={40} style={{ color: "#555" }} />
          <p className="text-sm" style={{ color: "#888" }}>No events scheduled</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dayEvents.map(ev => {
            const color = EVENT_COLORS[ev.type] ?? "#C05A43";
            const bg = EVENT_BG[ev.type] ?? "rgba(192,90,67,0.15)";
            return (
              <div key={ev.id} className="rounded-xl p-4 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: bg, borderLeft: `4px solid ${color}` }}
                onClick={(e) => onEventClick(ev, e)}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color }}>{EVENT_TYPE_LABELS[ev.type] ?? ev.type}</div>
                <div className="font-semibold text-base mb-1" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>{ev.title}</div>
                {ev.time && <div className="text-sm" style={{ color: "#999" }}>{ev.time}</div>}
                {ev.notes && <div className="text-sm mt-2" style={{ color: "#b0ae9a" }}>{ev.notes}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main OutlookCalendar ─────────────────────────────────────────────────────
// ─── Desktop Event Detail (side panel — no overlay) ──────────────────────────
function DesktopEventDetail({ event, onClose, isAdmin }: { event: CalendarEvent; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/calendar-events/${event.dbId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/calendar"] }); onClose(); },
  });

  const color = EVENT_COLORS[event.type] ?? "#C05A43";
  const statusColor = STATUS_COLORS[event.status ?? ""] ?? "#888";
  const typeParsed = parseEventDate(event.date);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Color bar + title */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderLeft: `4px solid ${color}`, background: "#1a1a1a" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color }}>
          {EVENT_TYPE_LABELS[event.type] ?? event.type}
        </div>
        <div className="font-bold text-lg leading-tight" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
          {event.title}
        </div>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        {/* Date/time */}
        <div className="flex items-center gap-2 text-sm" style={{ color: "#ccc" }}>
          <CalendarDays size={14} style={{ color: "#7A8C6E" }} />
          <span>{typeParsed ? formatDate(typeParsed) : event.date}</span>
          {event.time && (
            <>
              <Clock size={14} style={{ color: "#7A8C6E", marginLeft: 4 }} />
              <span>{event.time}</span>
            </>
          )}
        </div>

        {/* Status */}
        {event.status && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize"
              style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor }} />
              {event.status.replace(/_/g, " ")}
            </span>
          </div>
        )}

        {/* Property */}
        {event.propertyId && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "#ccc" }}>
            <MapPin size={14} style={{ color: "#7A8C6E" }} />
            <span>Property #{event.propertyId}</span>
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="rounded-lg p-3" style={{ background: "#252525", border: "1px solid #2a2a2a" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <FileText size={12} style={{ color: "#7A8C6E" }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#7A8C6E" }}>Notes</span>
            </div>
            <p className="text-sm" style={{ color: "#d0cec9" }}>{event.notes}</p>
          </div>
        )}

        {/* Visit report */}
        {event.scheduledId && event.completed && (
          <VisitReportSection scheduledId={event.scheduledId} />
        )}

        {/* Admin delete */}
        {isAdmin && event.isCustom && event.dbId && (
          <div className="pt-2 border-t" style={{ borderColor: "#2a2a2a" }}>
            <Button
              variant="ghost" size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 w-full"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


export function OutlookCalendar() {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar"],
  });

  const navigate = (dir: -1 | 1) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + dir);
      else if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const headerLabel = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "week") {
      const ws = startOfWeek(currentDate);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      return sameMonth
        ? `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${ws.getFullYear()}`
        : `${MONTH_NAMES[ws.getMonth()].slice(0,3)} ${ws.getDate()} – ${MONTH_NAMES[we.getMonth()].slice(0,3)} ${we.getDate()}, ${ws.getFullYear()}`;
    }
    return `${DAYS_FULL[currentDate.getDay()]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  }, [view, currentDate]);

  function handleDayClick(d: Date) {
    if (isAdmin) setNewEventDate(d);
    else { setCurrentDate(d); setView("day"); }
  }

  function handleEventClick(ev: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedEvent(ev);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#141414" }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}>
        <Button size="sm" variant="ghost" className="text-sm px-3 py-1.5 h-auto rounded-lg" style={{ color: "#d0cec9", background: "#252525" }}
          onClick={() => setCurrentDate(today)}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><ChevronLeft size={16} style={{ color: "#888" }} /></button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><ChevronRight size={16} style={{ color: "#888" }} /></button>
        </div>
        <h2 className="flex-1 text-base font-bold" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>{headerLabel}</h2>
        
        {/* Admin new event button */}
        {isAdmin && (
          <Button size="sm" className="gap-1.5 text-xs font-semibold h-8"
            style={{ background: "#C05A43", color: "#fff" }}
            onClick={() => setNewEventDate(today)}>
            <Plus size={13} /> New Event
          </Button>
        )}

        {/* View tabs */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
          {(["month","week","day"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
              style={{ background: view === v ? "#C05A43" : "#1e1e1e", color: view === v ? "#fff" : "#888", borderRight: v !== "day" ? "1px solid #2a2a2a" : undefined }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-4 py-2 border-b" style={{ background: "#181818", borderColor: "#222" }}>
        {Object.entries(EVENT_TYPE_LABELS).filter(([k]) => ["visit","launch_crew","weather_alert"].includes(k)).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: EVENT_COLORS[k] }} />
            <span className="text-[11px]" style={{ color: "#888" }}>{label.split(" ").slice(-1)[0] === "Tasks" ? "Launch Crew" : label}</span>
          </div>
        ))}
      </div>

      {/* ── Calendar body + optional side panel ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#C05A43", borderTopColor: "transparent" }} />
            </div>
          ) : view === "month" ? (
            <MonthView year={currentDate.getFullYear()} month={currentDate.getMonth()} events={events} today={today}
              onDayClick={handleDayClick} onEventClick={handleEventClick} />
          ) : view === "week" ? (
            <WeekView date={currentDate} events={events} today={today} onEventClick={handleEventClick} />
          ) : (
            <DayView date={currentDate} events={events} today={today} onEventClick={handleEventClick} />
          )}
        </div>

        {/* ── Desktop side panel — event detail ── */}
        {selectedEvent && (
          <div
            className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 overflow-y-auto"
            style={{ background: "#1a1a1a", borderLeft: "1px solid #2a2a2a" }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#7A8C6E" }}>Event Detail</span>
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg p-1.5 hover:bg-white/10">
                <X size={14} style={{ color: "#888" }} />
              </button>
            </div>
            {/* Reuse EventDetailPanel content inline */}
            <DesktopEventDetail event={selectedEvent} isAdmin={isAdmin} onClose={() => setSelectedEvent(null)} />
          </div>
        )}
      </div>

      {/* ── Mobile Event detail modal ── */}
      {selectedEvent && (
        <div className="lg:hidden">
          <EventDetailPanel event={selectedEvent} isAdmin={isAdmin} onClose={() => setSelectedEvent(null)} />
        </div>
      )}

      {/* ── New event modal (admin) ── */}
      {newEventDate && (
        <NewEventModal defaultDate={newEventDate} onClose={() => setNewEventDate(null)} />
      )}
    </div>
  );
}
