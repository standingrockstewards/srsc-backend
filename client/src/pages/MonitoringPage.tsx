/**
 * src/pages/MonitoringPage.tsx  (Brick 10T)
 *
 * Route: /monitoring  — inside RequireAuth / AppShell
 *
 * No account-level events list endpoint exists in v2 (confirmed in Brick 10T
 * audit). The page fetches all 5 properties, then fires GET
 * /api/v2/properties/:id/events for each in parallel and merges the results.
 *
 * Fetches:
 *   GET /api/v2/properties                     → property list (for name map + filter)
 *   GET /api/v2/properties/:id/events × 5      → per-property event arrays (parallel)
 *
 * Features:
 *   - Merged, sorted newest-first by createdAt
 *   - Filter by severity (all | info | warning | critical)
 *   - Filter by property (all | prop_01..05)
 *   - Severity badge, category, visit type, property name, note, ack status
 *   - Loading skeleton; empty state when no results match
 *
 * Auth: apiFetch (credentials: "include"). 401 → existing redirect handler.
 * No hardcoded data.
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { Property, MonitoringEvent } from "@/types";

// ── Badge helpers (reuse prop-badge from 10S) ────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info:     "prop-badge prop-badge--info",
    warning:  "prop-badge prop-badge--warn",
    critical: "prop-badge prop-badge--err",
  };
  return <span className={map[severity] ?? "prop-badge prop-badge--muted"}>{severity}</span>;
}

function AckBadge({ ackAt }: { ackAt: string | null }) {
  return ackAt
    ? <span className="prop-badge prop-badge--ok">Ack'd</span>
    : <span className="prop-badge prop-badge--muted">Unacked</span>;
}

// ── Date formatter ───────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch { return iso; }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="prop-table-skeleton" aria-label="Loading events…" role="status" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="prop-skeleton-row">
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
          <div className="prop-skeleton-cell prop-skeleton-cell--wide" />
          <div className="prop-skeleton-cell" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

const SEVERITIES = [
  { value: "",         label: "All severities" },
  { value: "info",     label: "Info" },
  { value: "warning",  label: "Warning" },
  { value: "critical", label: "Critical" },
] as const;

interface FilterBarProps {
  severityFilter: string;
  propertyFilter: string;
  properties:     Property[];
  onSeverity:     (v: string) => void;
  onProperty:     (v: string) => void;
}

function FilterBar({
  severityFilter, propertyFilter, properties,
  onSeverity, onProperty,
}: FilterBarProps) {
  return (
    <div className="jobs-filter-bar">
      <select
        className="jobs-filter-select"
        value={severityFilter}
        onChange={(e) => onSeverity(e.target.value)}
        aria-label="Filter by severity"
      >
        {SEVERITIES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        className="jobs-filter-select"
        value={propertyFilter}
        onChange={(e) => onProperty(e.target.value)}
        aria-label="Filter by property"
      >
        <option value="">All properties</option>
        {properties.map((p) => {
          const label = p.nickname && p.nickname.trim() ? p.nickname : p.address;
          return <option key={p.id} value={p.id}>{label}</option>;
        })}
      </select>
    </div>
  );
}

// ── Event row ────────────────────────────────────────────────────────────────

function EventRow({
  event, propName, onClick,
}: {
  event:    MonitoringEvent;
  propName: string;
  onClick:  () => void;
}) {
  return (
    <div
      className="mon-event-row"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`View property for ${event.category} event`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      }}
    >
      {/* Left: severity + metadata */}
      <div className="mon-event-left">
        <div className="mon-event-title">
          <SeverityBadge severity={event.severity} />
          <span className="prop-detail-category">{event.category}</span>
          {event.visitType && (
            <span className="prop-detail-meta-tag">{event.visitType.replace(/_/g, " ")}</span>
          )}
        </div>
        {event.note && (
          <p className="prop-detail-note">{event.note}</p>
        )}
        <div className="mon-event-meta">
          <span className="mon-event-prop">{propName}</span>
          <span className="mon-event-dot" aria-hidden="true">·</span>
          <span className="prop-detail-row-sub">{event.source}</span>
          <span className="mon-event-dot" aria-hidden="true">·</span>
          <span className="prop-detail-row-sub">{fmtDate(event.createdAt)}</span>
        </div>
      </div>

      {/* Right: ack badge */}
      <div className="mon-event-right">
        <AckBadge ackAt={event.acknowledgedAt} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MonitoringPage() {
  const navigate = useNavigate();

  const [properties,  setProperties]  = useState<Property[]>([]);
  const [events,      setEvents]      = useState<MonitoringEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  // Track partial errors (some props failed) without blocking the view
  const [partialErr,  setPartialErr]  = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");

  // Property lookup map
  const propNameMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of properties) {
      m[p.id] = p.nickname && p.nickname.trim() ? p.nickname : p.address;
    }
    return m;
  }, [properties]);

  useEffect(() => {
    // Step 1: fetch properties
    api.get<Property[]>("/properties")
      .then((props) => {
        setProperties(props);

        // Step 2: parallel per-property event fetch
        const fetches = props.map((p) =>
          api.get<MonitoringEvent[]>(`/properties/${p.id}/events`)
            .then((rows) => ({ ok: true as const, rows }))
            .catch((err: unknown) => ({
              ok: false as const,
              id: p.id,
              msg: err instanceof ApiError ? err.message : "Unknown error",
            })),
        );

        return Promise.all(fetches);
      })
      .then((results) => {
        const merged: MonitoringEvent[] = [];
        const failed: string[] = [];

        for (const r of results) {
          if (r.ok) {
            merged.push(...r.rows);
          } else {
            failed.push(r.id);
          }
        }

        // Sort newest first
        merged.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        setEvents(merged);
        if (failed.length > 0) {
          setPartialErr(`Events unavailable for: ${failed.join(", ")}`);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? `Failed to load monitoring data: ${err.message}`
            : "Failed to load monitoring data.",
        );
        setLoading(false);
      });
  }, []);

  // ── Filtered view ──────────────────────────────────────────────────────
  const visible = useMemo(() => {
    let rows = events;
    if (severityFilter) rows = rows.filter((e) => e.severity === severityFilter);
    if (propertyFilter) rows = rows.filter((e) => e.propertyId === propertyFilter);
    return rows;
  }, [events, severityFilter, propertyFilter]);

  const subtitle = loading
    ? "Loading…"
    : error
    ? "Could not load events."
    : visible.length === events.length
    ? `${events.length} event${events.length === 1 ? "" : "s"} across ${properties.length} properties`
    : `${visible.length} of ${events.length} events`;

  return (
    <div className="mon-page">
      <div className="page-header">
        <h1 className="page-title">Monitoring</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {!loading && !error && (
        <FilterBar
          severityFilter={severityFilter}
          propertyFilter={propertyFilter}
          properties={properties}
          onSeverity={setSeverityFilter}
          onProperty={setPropertyFilter}
        />
      )}

      {partialErr && !loading && (
        <div className="widget-error" style={{ marginBottom: "12px" }}>{partialErr}</div>
      )}

      {loading && <FeedSkeleton />}
      {!loading && error && <div className="widget-error">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="prop-empty">
          <span className="prop-empty-icon" aria-hidden="true">📡</span>
          <span className="prop-empty-msg">No monitoring events match the current filters.</span>
          <span className="prop-empty-hint">
            {events.length > 0 ? "Try clearing the filters." : "No events have been recorded yet."}
          </span>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="mon-event-feed">
          {visible.map((ev) => (
            <EventRow
              key={ev.id}
              event={ev}
              propName={propNameMap[ev.propertyId] ?? ev.propertyId}
              onClick={() => navigate(`/properties/${ev.propertyId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
