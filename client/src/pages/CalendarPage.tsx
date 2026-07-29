/**
 * src/pages/CalendarPage.tsx  (Brick 10g)
 *
 * Inspection scheduling calendar — month view + list view.
 * Available to: admin, supervisor, field_tech.
 * vendor → blocked at route level (RequireRole).
 *
 * Features:
 *   - Month grid with color-coded event dots per day
 *   - Click a day to see event list + "Schedule visit" form (admin/supervisor only)
 *   - List view tab shows all events in the current month
 *   - Color coding by kind:
 *       past_visit      — muted teal (#4e9a9a)
 *       upcoming_visit  — accent blue (#58a6ff)
 *       storm_event     — amber (#f0a500)
 *       follow_up       — violet (#a78bfa)
 *   - Admin/supervisor can schedule a new visit from the day panel
 *   - Dark theme, matches AppSidebar design language
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { CalendarEvent, VisitTypeV2 } from "@/types";
import { VISIT_TYPES_V2 } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const KIND_COLORS: Record<string, string> = {
  past_visit:     "#4e9a9a",
  upcoming_visit: "#58a6ff",
  storm_event:    "#f0a500",
  follow_up:      "#a78bfa",
};

const KIND_LABELS: Record<string, string> = {
  past_visit:     "Past Visit",
  upcoming_visit: "Upcoming Visit",
  storm_event:    "Storm Event",
  follow_up:      "Follow-Up Visit",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date { return new Date(iso); }

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function monthBounds(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to   = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function visitTypeLabel(vt: string): string {
  return vt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { role, user } = useAuth();
  const isAdminOrSup = role === "admin" || role === "supervisor";

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view,  setView]  = useState<"month" | "list">("month");

  const [events,   setEvents]   = useState<CalendarEvent[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Selected day panel
  const [selectedDay,     setSelectedDay]     = useState<Date | null>(null);
  const [showCreateForm,  setShowCreateForm]  = useState(false);

  // Create form state
  const [formPropertyId,      setFormPropertyId]      = useState("");
  const [formTechId,          setFormTechId]          = useState("");
  const [formVisitType,       setFormVisitType]       = useState<VisitTypeV2>("routine");
  const [formScheduledAt,     setFormScheduledAt]     = useState("");
  const [formNotes,           setFormNotes]           = useState("");
  const [formFollowUpOf,      setFormFollowUpOf]      = useState("");
  const [formSubmitting,      setFormSubmitting]      = useState(false);
  const [formError,           setFormError]           = useState<string | null>(null);
  const [formSuccess,         setFormSuccess]         = useState(false);

  // ── Fetch calendar events ───────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = monthBounds(year, month);
      const qs = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      const data = await apiFetch(`/calendar?${qs}`) as CalendarEvent[];
      setEvents(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else             { setMonth(m => m - 1); }
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else              { setMonth(m => m + 1); }
    setSelectedDay(null);
  }

  // ── Month grid cells ────────────────────────────────────────────────────────
  function buildGrid(): (Date | null)[] {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }

  function eventsForDay(day: Date): CalendarEvent[] {
    return events.filter(e => sameDay(isoToDate(e.date), day));
  }

  // ── Create visit submit ─────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    setFormSuccess(false);
    try {
      await apiFetch("/visits", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          propertyId:      formPropertyId.trim(),
          assignedTechId:  formTechId.trim(),
          visitType:       formVisitType,
          scheduledAt:     formScheduledAt,
          notes:           formNotes.trim() || undefined,
          followUpOf:      formFollowUpOf.trim() || undefined,
        }),
      });
      setFormSuccess(true);
      setFormPropertyId(""); setFormTechId(""); setFormNotes("");
      setFormFollowUpOf(""); setFormScheduledAt("");
      await loadEvents(); // refresh
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to schedule visit.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // ── Day panel events ────────────────────────────────────────────────────────
  const dayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  // Pre-fill scheduledAt from selected day
  useEffect(() => {
    if (selectedDay) {
      const d = selectedDay;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day2 = String(d.getDate()).padStart(2, "0");
      setFormScheduledAt(`${y}-${m}-${day2}T09:00`);
    }
  }, [selectedDay]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const grid = buildGrid();

  return (
    <div className="cal-page">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <h1 className="cal-title">Calendar</h1>
          <p className="cal-subtitle">Scheduled visits, storm events, and follow-ups</p>
        </div>
        <div className="cal-header-right">
          <div className="cal-view-toggle">
            <button
              className={`cal-view-btn ${view === "month" ? "cal-view-btn--active" : ""}`}
              onClick={() => setView("month")}
            >Month</button>
            <button
              className={`cal-view-btn ${view === "list" ? "cal-view-btn--active" : ""}`}
              onClick={() => setView("list")}
            >List</button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="cal-legend">
        {Object.entries(KIND_LABELS).map(([kind, label]) => (
          <div key={kind} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: KIND_COLORS[kind] }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Nav */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="cal-nav-title">{MONTH_NAMES[month]} {year}</span>
        <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      {error && <div className="cal-error" role="alert">{error}</div>}

      {/* ── Month View ─────────────────────────────────────────────────────── */}
      {view === "month" && (
        <div className="cal-body">
          {/* Grid */}
          <div className="cal-grid-wrapper">
            {/* Day-name headers */}
            <div className="cal-grid">
              {DAY_NAMES.map(d => (
                <div key={d} className="cal-day-header">{d}</div>
              ))}
              {grid.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="cal-cell cal-cell--empty" />;
                const dayEvts = eventsForDay(day);
                const isToday  = sameDay(day, today);
                const isSelected = selectedDay ? sameDay(day, selectedDay) : false;
                return (
                  <button
                    key={day.toISOString()}
                    className={`cal-cell ${isToday ? "cal-cell--today" : ""} ${isSelected ? "cal-cell--selected" : ""}`}
                    onClick={() => {
                      setSelectedDay(day);
                      setShowCreateForm(false);
                      setFormSuccess(false);
                      setFormError(null);
                    }}
                    aria-label={`${day.getDate()} ${MONTH_NAMES[month]}, ${dayEvts.length} events`}
                    aria-pressed={isSelected}
                  >
                    <span className="cal-cell-date">{day.getDate()}</span>
                    <div className="cal-cell-dots">
                      {/* Show up to 3 dots, then +N */}
                      {dayEvts.slice(0, 3).map(e => (
                        <span
                          key={e.id}
                          className="cal-dot"
                          style={{ background: KIND_COLORS[e.kind] ?? "#8b949e" }}
                        />
                      ))}
                      {dayEvts.length > 3 && (
                        <span className="cal-dot-overflow">+{dayEvts.length - 3}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Day panel */}
            {selectedDay && (
              <div className="cal-day-panel">
                <div className="cal-day-panel-header">
                  <span className="cal-day-panel-title">{formatDate(selectedDay)}</span>
                  <button
                    className="cal-day-panel-close"
                    onClick={() => { setSelectedDay(null); setShowCreateForm(false); }}
                    aria-label="Close day panel"
                  >×</button>
                </div>

                {/* Events for this day */}
                {dayEvents.length === 0 && (
                  <div className="cal-day-empty">No events on this day.</div>
                )}
                {dayEvents.map(e => (
                  <div key={e.id} className="cal-event-row">
                    <span
                      className="cal-event-kind-bar"
                      style={{ background: KIND_COLORS[e.kind] ?? "#8b949e" }}
                      aria-hidden="true"
                    />
                    <div className="cal-event-info">
                      <div className="cal-event-title">{e.title}</div>
                      <div className="cal-event-meta">
                        {formatTime(e.date)}
                        {e.status && <span className={`cal-status-badge cal-status-badge--${e.status}`}>{e.status}</span>}
                        {e.visitType && <span className="cal-event-type">{visitTypeLabel(e.visitType)}</span>}
                        {e.severity  && <span className="cal-event-severity">{e.severity}</span>}
                      </div>
                      {e.followUpOf && (
                        <div className="cal-event-followup">↩ Follow-up of visit {e.followUpOf.slice(0, 8)}…</div>
                      )}
                      {e.notes && <div className="cal-event-notes">{e.notes}</div>}
                    </div>
                  </div>
                ))}

                {/* Schedule button (admin/supervisor only) */}
                {isAdminOrSup && !showCreateForm && (
                  <button
                    className="cal-add-btn"
                    onClick={() => { setShowCreateForm(true); setFormSuccess(false); setFormError(null); }}
                  >
                    + Schedule Visit
                  </button>
                )}

                {/* Create form */}
                {isAdminOrSup && showCreateForm && (
                  <form className="cal-create-form" onSubmit={handleCreate} noValidate>
                    <div className="cal-form-title">Schedule a Visit</div>

                    {formError   && <div className="cal-form-error" role="alert">{formError}</div>}
                    {formSuccess && <div className="cal-form-success" role="status">Visit scheduled.</div>}

                    <label className="cal-form-label">Property ID
                      <input className="cal-form-input" value={formPropertyId}
                        onChange={e => setFormPropertyId(e.target.value)} required
                        placeholder="property text id" />
                    </label>
                    <label className="cal-form-label">Tech User ID (assigned_tech_id)
                      <input className="cal-form-input" value={formTechId}
                        onChange={e => setFormTechId(e.target.value)} required
                        placeholder="user id (number as text)" />
                    </label>
                    <label className="cal-form-label">Visit Type
                      <select className="cal-form-select" value={formVisitType}
                        onChange={e => setFormVisitType(e.target.value as VisitTypeV2)}>
                        {VISIT_TYPES_V2.map(vt => (
                          <option key={vt} value={vt}>{visitTypeLabel(vt)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="cal-form-label">Scheduled Date & Time
                      <input className="cal-form-input" type="datetime-local"
                        value={formScheduledAt}
                        onChange={e => setFormScheduledAt(e.target.value)} required />
                    </label>
                    <label className="cal-form-label">Notes (optional)
                      <textarea className="cal-form-textarea" value={formNotes}
                        onChange={e => setFormNotes(e.target.value)}
                        rows={3} placeholder="Any special instructions…" />
                    </label>
                    <label className="cal-form-label">Follow-up of Visit ID (optional)
                      <input className="cal-form-input" value={formFollowUpOf}
                        onChange={e => setFormFollowUpOf(e.target.value)}
                        placeholder="leave blank if not a follow-up" />
                    </label>

                    <div className="cal-form-actions">
                      <button type="submit" className="cal-form-submit"
                        disabled={formSubmitting} aria-busy={formSubmitting}>
                        {formSubmitting ? "Scheduling…" : "Schedule"}
                      </button>
                      <button type="button" className="cal-form-cancel"
                        onClick={() => setShowCreateForm(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {loading && <div className="cal-loading" aria-live="polite">Loading…</div>}
        </div>
      )}

      {/* ── List View ──────────────────────────────────────────────────────── */}
      {view === "list" && (
        <div className="cal-list">
          {loading && <div className="cal-loading">Loading…</div>}
          {!loading && events.length === 0 && (
            <div className="cal-list-empty">No events in {MONTH_NAMES[month]} {year}.</div>
          )}
          {events.map(e => (
            <div key={e.id} className="cal-list-row">
              <div
                className="cal-list-kind-bar"
                style={{ background: KIND_COLORS[e.kind] ?? "#8b949e" }}
                aria-hidden="true"
              />
              <div className="cal-list-content">
                <div className="cal-list-title">{e.title}</div>
                <div className="cal-list-meta">
                  <span className="cal-list-date">
                    {new Date(e.date).toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                    })} at {formatTime(e.date)}
                  </span>
                  {e.status && (
                    <span className={`cal-status-badge cal-status-badge--${e.status}`}>{e.status}</span>
                  )}
                  <span className="cal-list-kind-label"
                    style={{ color: KIND_COLORS[e.kind] }}>
                    {KIND_LABELS[e.kind]}
                  </span>
                </div>
                {e.notes && <div className="cal-list-notes">{e.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
