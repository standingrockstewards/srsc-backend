/**
 * src/pages/PropertyDetailPage.tsx  (Brick 10S)
 *
 * Route: /properties/:id  — inside RequireAuth / AppShell
 *
 * Fetches (in parallel):
 *   GET /api/v2/properties/:id           → property header
 *   GET /api/v2/properties/:id/events    → monitoring events
 *   GET /api/v2/properties/:id/retainer  → ledger + currentBalance
 *   GET /api/v2/jobs?property_id=:id     → jobs filtered to this property
 *
 * Tabs: Events | Ledger | Jobs
 * 404 property → not-found panel (no redirect — stays in AppShell).
 * 401 → existing apiFetch redirect handler fires automatically.
 *
 * Auth: apiFetch (credentials: "include"). No hardcoded data.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type {
  Property,
  MonitoringEvent,
  RetainerResponse,
  RetainerLedgerEntry,
  StewardshipJob,
} from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Billing badge ─────────────────────────────────────────────────────────────

function BillingBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    current:    { label: "Current",    cls: "prop-badge prop-badge--ok" },
    grace:      { label: "Grace",      cls: "prop-badge prop-badge--warn" },
    delinquent: { label: "Delinquent", cls: "prop-badge prop-badge--err" },
  };
  const { label, cls } = map[state] ?? { label: state, cls: "prop-badge prop-badge--muted" };
  return <span className={cls}>{label}</span>;
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    info:     "prop-badge prop-badge--info",
    warning:  "prop-badge prop-badge--warn",
    critical: "prop-badge prop-badge--err",
  };
  const cls = map[severity] ?? "prop-badge prop-badge--muted";
  return <span className={cls}>{severity}</span>;
}

// ── Job status badge ──────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:   "prop-badge prop-badge--ok",
    in_progress: "prop-badge prop-badge--info",
    scheduled:   "prop-badge prop-badge--accent",
    dispatched:  "prop-badge prop-badge--accent",
    pending:     "prop-badge prop-badge--muted",
    cancelled:   "prop-badge prop-badge--muted",
  };
  const cls = map[status] ?? "prop-badge prop-badge--muted";
  const label = status.replace(/_/g, " ");
  return <span className={cls}>{label}</span>;
}

// ── Priority pill ─────────────────────────────────────────────────────────────

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "prop-priority prop-priority--urgent",
    high:   "prop-priority prop-priority--high",
    normal: "prop-priority prop-priority--normal",
    low:    "prop-priority prop-priority--low",
  };
  const cls = map[priority] ?? "prop-priority prop-priority--normal";
  return <span className={cls}>{priority}</span>;
}

// ── Ledger type label ─────────────────────────────────────────────────────────

function LedgerTypeLabel({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    topup:          { label: "Deposit",       cls: "prop-badge prop-badge--ok" },
    charge:         { label: "Charge",        cls: "prop-badge prop-badge--warn" },
    credit_applied: { label: "Credit",        cls: "prop-badge prop-badge--accent" },
    adjustment:     { label: "Adjustment",    cls: "prop-badge prop-badge--muted" },
  };
  const { label, cls } = map[type] ?? { label: type, cls: "prop-badge prop-badge--muted" };
  return <span className={cls}>{label}</span>;
}

// ── Section skeleton ──────────────────────────────────────────────────────────

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="prop-section-skeleton" aria-label="Loading…" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="prop-skeleton-row">
          <div className="prop-skeleton-cell prop-skeleton-cell--wide" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
          <div className="prop-skeleton-cell" />
        </div>
      ))}
    </div>
  );
}

// ── Events tab ────────────────────────────────────────────────────────────────

function EventsTab({ events, loading, error }: {
  events: MonitoringEvent[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <SectionSkeleton rows={4} />;
  if (error)   return <div className="widget-error">{error}</div>;
  if (events.length === 0) {
    return (
      <div className="prop-empty">
        <span className="prop-empty-icon" aria-hidden="true">📡</span>
        <span className="prop-empty-msg">No monitoring events recorded.</span>
      </div>
    );
  }

  return (
    <div className="prop-detail-list">
      {events.map((ev) => (
        <div key={ev.id} className="prop-detail-row">
          <div className="prop-detail-row-left">
            <div className="prop-detail-row-title">
              <SeverityBadge severity={ev.severity} />
              <span className="prop-detail-category">{ev.category}</span>
              {ev.visitType && (
                <span className="prop-detail-meta-tag">{ev.visitType.replace(/_/g, " ")}</span>
              )}
            </div>
            {ev.note && (
              <p className="prop-detail-note">{ev.note}</p>
            )}
            <span className="prop-detail-row-sub">
              Source: {ev.source} · {fmtDate(ev.createdAt)}
            </span>
          </div>
          <div className="prop-detail-row-right">
            {ev.acknowledgedAt
              ? <span className="prop-badge prop-badge--ok">Ack'd</span>
              : <span className="prop-badge prop-badge--muted">Unacked</span>
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ledger tab ────────────────────────────────────────────────────────────────

function LedgerTab({ retainer, loading, error }: {
  retainer: RetainerResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <SectionSkeleton rows={4} />;
  if (error)   return <div className="widget-error">{error}</div>;
  if (!retainer || retainer.ledger.length === 0) {
    return (
      <div className="prop-empty">
        <span className="prop-empty-icon" aria-hidden="true">📒</span>
        <span className="prop-empty-msg">No ledger entries found.</span>
      </div>
    );
  }

  const sorted = [...retainer.ledger].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="prop-detail-list">
      {sorted.map((entry: RetainerLedgerEntry) => {
        const isCharge = entry.type === "charge";
        return (
          <div key={entry.id} className="prop-detail-row">
            <div className="prop-detail-row-left">
              <div className="prop-detail-row-title">
                <LedgerTypeLabel type={entry.type} />
                <span className="prop-detail-row-sub">{fmtShortDate(entry.createdAt)}</span>
              </div>
              {entry.note && <p className="prop-detail-note">{entry.note}</p>}
            </div>
            <div className="prop-detail-row-right prop-detail-row-right--money">
              <span className={isCharge ? "prop-money prop-money--debit" : "prop-money prop-money--credit"}>
                {isCharge ? "−" : "+"}{formatMoney(entry.amount)}
              </span>
              <span className="prop-balance-after">
                Balance: {formatMoney(entry.balanceAfter)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Jobs tab ──────────────────────────────────────────────────────────────────

function JobsTab({ jobs, loading, error }: {
  jobs: StewardshipJob[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <SectionSkeleton rows={3} />;
  if (error)   return <div className="widget-error">{error}</div>;
  if (jobs.length === 0) {
    return (
      <div className="prop-empty">
        <span className="prop-empty-icon" aria-hidden="true">🔧</span>
        <span className="prop-empty-msg">No jobs for this property.</span>
      </div>
    );
  }

  const sorted = [...jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="prop-detail-list">
      {sorted.map((job) => (
        <div key={job.id} className="prop-detail-row">
          <div className="prop-detail-row-left">
            <div className="prop-detail-row-title">
              <JobStatusBadge status={job.status} />
              <PriorityPill priority={job.priority} />
              <span className="prop-detail-category">{job.jobType.replace(/_/g, " ")}</span>
            </div>
            {job.notes && <p className="prop-detail-note">{job.notes}</p>}
            <span className="prop-detail-row-sub">
              Trigger: {job.triggerType.replace(/_/g, " ")}
              {job.assignedTo ? ` · Assigned: ${job.assignedTo}` : ""}
              {job.scheduledFor ? ` · Scheduled: ${fmtShortDate(job.scheduledFor)}` : ""}
              {job.completedAt  ? ` · Completed: ${fmtShortDate(job.completedAt)}`  : ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Not Found ─────────────────────────────────────────────────────────────────

function PropertyNotFound({ id }: { id: string }) {
  return (
    <div className="prop-not-found">
      <span className="prop-not-found-icon" aria-hidden="true">🏚️</span>
      <h2 className="prop-not-found-title">Property not found</h2>
      <p className="prop-not-found-msg">No property with ID <code>{id}</code> exists.</p>
      <Link to="/properties" className="prop-not-found-back">← Back to Properties</Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "events" | "ledger" | "jobs";

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const propId  = id ?? "";

  const [property,  setProperty]  = useState<Property | null>(null);
  const [propErr,   setPropErr]   = useState<string | null>(null);
  const [propLoad,  setPropLoad]  = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  const [events,    setEvents]    = useState<MonitoringEvent[]>([]);
  const [evtLoad,   setEvtLoad]   = useState(true);
  const [evtErr,    setEvtErr]    = useState<string | null>(null);

  const [retainer,  setRetainer]  = useState<RetainerResponse | null>(null);
  const [retLoad,   setRetLoad]   = useState(true);
  const [retErr,    setRetErr]    = useState<string | null>(null);

  const [jobs,      setJobs]      = useState<StewardshipJob[]>([]);
  const [jobLoad,   setJobLoad]   = useState(true);
  const [jobErr,    setJobErr]    = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("events");

  useEffect(() => {
    if (!propId) return;

    // Fetch property header
    api.get<Property>(`/properties/${propId}`)
      .then((p) => { setProperty(p); setPropLoad(false); })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setPropErr(
            err instanceof ApiError ? err.message : "Failed to load property.",
          );
        }
        setPropLoad(false);
      });

    // Fetch events
    api.get<MonitoringEvent[]>(`/properties/${propId}/events`)
      .then((rows) => { setEvents(rows); setEvtLoad(false); })
      .catch((err: unknown) => {
        setEvtErr(err instanceof ApiError ? err.message : "Failed to load events.");
        setEvtLoad(false);
      });

    // Fetch retainer
    api.get<RetainerResponse>(`/properties/${propId}/retainer`)
      .then((data) => { setRetainer(data); setRetLoad(false); })
      .catch((err: unknown) => {
        setRetErr(err instanceof ApiError ? err.message : "Failed to load retainer.");
        setRetLoad(false);
      });

    // Fetch all jobs, filter client-side to this property
    api.get<StewardshipJob[]>(`/jobs?property_id=${propId}`)
      .then((rows) => {
        setJobs(rows.filter((j) => j.propertyId === propId));
        setJobLoad(false);
      })
      .catch((err: unknown) => {
        setJobErr(err instanceof ApiError ? err.message : "Failed to load jobs.");
        setJobLoad(false);
      });
  }, [propId]);

  // ── Property header skeleton ─────────────────────────────────────────────

  if (propLoad) {
    return (
      <div className="prop-detail-page">
        <div className="page-header">
          <div className="prop-skeleton-cell prop-skeleton-cell--wide" style={{ height: "1.75rem", marginBottom: "0.5rem" }} />
          <div className="prop-skeleton-cell" style={{ height: "1rem", width: "60%" }} />
        </div>
      </div>
    );
  }

  if (notFound) return <PropertyNotFound id={propId} />;

  if (propErr) {
    return (
      <div className="prop-detail-page">
        <div className="page-header">
          <Link to="/properties" className="prop-back-link">← Properties</Link>
        </div>
        <div className="widget-error">{propErr}</div>
      </div>
    );
  }

  if (!property) return null;

  const displayName = property.nickname && property.nickname.trim()
    ? property.nickname
    : property.address;

  const location = [property.city, property.state, property.zip]
    .filter(Boolean)
    .join(", ");

  const currentBalance = retainer?.currentBalance ?? null;

  const TAB_DEFS: { key: Tab; label: string; count?: number }[] = [
    { key: "events", label: "Monitoring Events", count: evtLoad ? undefined : events.length },
    { key: "ledger", label: "Retainer Ledger",   count: retLoad ? undefined : (retainer?.ledger.length ?? 0) },
    { key: "jobs",   label: "Jobs",               count: jobLoad ? undefined : jobs.length },
  ];

  return (
    <div className="prop-detail-page">
      {/* Breadcrumb */}
      <Link to="/properties" className="prop-back-link">← Properties</Link>

      {/* Property header card */}
      <div className="prop-header-card">
        <div className="prop-header-main">
          <div className="prop-header-title-row">
            <h1 className="prop-header-name">{displayName}</h1>
            <BillingBadge state={property.billingState} />
            {!property.active && (
              <span className="prop-badge prop-badge--muted">Inactive</span>
            )}
          </div>
          <p className="prop-header-address">{property.address}</p>
          {location && (
            <p className="prop-header-location">{location}</p>
          )}
          {(property.latitude && property.longitude) && (
            <p className="prop-header-coords">
              {parseFloat(property.latitude).toFixed(4)}, {parseFloat(property.longitude).toFixed(4)}
            </p>
          )}
        </div>

        {/* Retainer summary */}
        <div className="prop-header-retainer">
          <div className="prop-retainer-label">Retainer Balance</div>
          <div className="prop-retainer-value">
            {retLoad
              ? <span className="prop-skeleton-inline" />
              : retErr
              ? <span className="prop-retainer-err">Unavailable</span>
              : formatMoney(currentBalance)
            }
          </div>
          <div className="prop-retainer-target">
            Target: {formatMoney(property.targetRetainerAmount)}
          </div>
          {property.serviceTier && (
            <div className="prop-retainer-tier">
              Tier: <strong>{property.serviceTier}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="prop-tabs" role="tablist" aria-label="Property sections">
        {TAB_DEFS.map(({ key, label, count }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`prop-tabpanel-${key}`}
            className={`prop-tab${tab === key ? " prop-tab--active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
            {count !== undefined && (
              <span className={`prop-tab-count${count === 0 ? " prop-tab-count--zero" : ""}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        id={`prop-tabpanel-${tab}`}
        role="tabpanel"
        aria-labelledby={`prop-tab-${tab}`}
        className="prop-tab-panel"
      >
        {tab === "events" && (
          <EventsTab events={events} loading={evtLoad} error={evtErr} />
        )}
        {tab === "ledger" && (
          <LedgerTab retainer={retainer} loading={retLoad} error={retErr} />
        )}
        {tab === "jobs" && (
          <JobsTab jobs={jobs} loading={jobLoad} error={jobErr} />
        )}
      </div>
    </div>
  );
}
