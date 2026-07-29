/**
 * src/pages/JobsPage.tsx  (Brick 10T)
 *
 * Route: /jobs  — inside RequireAuth / AppShell
 *
 * Fetches:
 *   GET /api/v2/jobs         → all 10 stewardship jobs
 *   GET /api/v2/properties   → 5 properties (for name lookup)
 *
 * Both fetched in parallel on mount.
 *
 * Features:
 *   - Filter by status (all | pending | scheduled | in_progress | completed | cancelled)
 *   - Filter by property (all | prop_01..05)
 *   - Sort by: newest first (createdAt) | scheduled date | due date
 *   - Row → navigate to /properties/:id
 *   - Loading skeleton; empty state when no results match filters
 *
 * Auth: apiFetch (credentials: "include"). 401 → existing redirect handler.
 * No hardcoded data.
 */

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import type { StewardshipJob, Property } from "@/types";

// ── Badge / pill helpers (reuse prop-badge classes from 10S) ─────────────────

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed:   "prop-badge prop-badge--ok",
    in_progress: "prop-badge prop-badge--info",
    scheduled:   "prop-badge prop-badge--accent",
    dispatched:  "prop-badge prop-badge--accent",
    pending:     "prop-badge prop-badge--muted",
    cancelled:   "prop-badge prop-badge--muted",
  };
  return (
    <span className={map[status] ?? "prop-badge prop-badge--muted"}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "prop-priority prop-priority--urgent",
    high:   "prop-priority prop-priority--high",
    normal: "prop-priority prop-priority--normal",
    low:    "prop-priority prop-priority--low",
  };
  return <span className={map[priority] ?? "prop-priority prop-priority--normal"}>{priority}</span>;
}

// ── Date formatter ───────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }).format(new Date(iso));
  } catch { return iso; }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="prop-table-skeleton" aria-label="Loading jobs…" role="status" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="prop-skeleton-row">
          <div className="prop-skeleton-cell prop-skeleton-cell--wide" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
          <div className="prop-skeleton-cell" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
        </div>
      ))}
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────

const JOB_STATUSES = [
  { value: "",            label: "All statuses" },
  { value: "pending",     label: "Pending" },
  { value: "scheduled",   label: "Scheduled" },
  { value: "dispatched",  label: "Dispatched" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "cancelled",   label: "Cancelled" },
] as const;

const SORT_OPTIONS = [
  { value: "createdAt_desc",   label: "Newest first" },
  { value: "createdAt_asc",    label: "Oldest first" },
  { value: "scheduledFor_asc", label: "Scheduled ↑" },
  { value: "dueBy_asc",        label: "Due date ↑" },
] as const;

type SortKey = typeof SORT_OPTIONS[number]["value"];

interface FilterBarProps {
  statusFilter:   string;
  propertyFilter: string;
  sortKey:        SortKey;
  properties:     Property[];
  onStatus:       (v: string) => void;
  onProperty:     (v: string) => void;
  onSort:         (v: SortKey) => void;
}

function FilterBar({
  statusFilter, propertyFilter, sortKey,
  properties, onStatus, onProperty, onSort,
}: FilterBarProps) {
  return (
    <div className="jobs-filter-bar">
      <select
        className="jobs-filter-select"
        value={statusFilter}
        onChange={(e) => onStatus(e.target.value)}
        aria-label="Filter by status"
      >
        {JOB_STATUSES.map((s) => (
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

      <select
        className="jobs-filter-select"
        value={sortKey}
        onChange={(e) => onSort(e.target.value as SortKey)}
        aria-label="Sort jobs"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function JobsPage() {
  const navigate = useNavigate();

  const [jobs,       setJobs]      = useState<StewardshipJob[]>([]);
  const [properties, setProps]     = useState<Property[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState<string | null>(null);

  const [statusFilter,   setStatusFilter]   = useState<string>("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [sortKey,        setSortKey]        = useState<SortKey>("createdAt_desc");

  // Property lookup map: id → display name
  const propNameMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const p of properties) {
      m[p.id] = p.nickname && p.nickname.trim() ? p.nickname : p.address;
    }
    return m;
  }, [properties]);

  useEffect(() => {
    Promise.all([
      api.get<StewardshipJob[]>("/jobs"),
      api.get<Property[]>("/properties"),
    ])
      .then(([jobRows, propRows]) => {
        setJobs(jobRows);
        setProps(propRows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiError
            ? `Failed to load jobs: ${err.message}`
            : "Failed to load jobs.",
        );
        setLoading(false);
      });
  }, []);

  // ── Filtered + sorted view ──────────────────────────────────────────────
  const visible = useMemo(() => {
    let rows = [...jobs];

    if (statusFilter)   rows = rows.filter((j) => j.status === statusFilter);
    if (propertyFilter) rows = rows.filter((j) => j.propertyId === propertyFilter);

    rows.sort((a, b) => {
      switch (sortKey) {
        case "createdAt_asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "scheduledFor_asc": {
          const ta = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Infinity;
          const tb = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Infinity;
          return ta - tb;
        }
        case "dueBy_asc": {
          const ta = a.dueBy ? new Date(a.dueBy).getTime() : Infinity;
          const tb = b.dueBy ? new Date(b.dueBy).getTime() : Infinity;
          return ta - tb;
        }
        default: // createdAt_desc
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return rows;
  }, [jobs, statusFilter, propertyFilter, sortKey]);

  const subtitle = loading
    ? "Loading…"
    : error
    ? "Could not load jobs."
    : visible.length === jobs.length
    ? `${jobs.length} job${jobs.length === 1 ? "" : "s"}`
    : `${visible.length} of ${jobs.length} jobs`;

  return (
    <div className="jobs-page">
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {!loading && !error && (
        <FilterBar
          statusFilter={statusFilter}
          propertyFilter={propertyFilter}
          sortKey={sortKey}
          properties={properties}
          onStatus={setStatusFilter}
          onProperty={setPropertyFilter}
          onSort={setSortKey}
        />
      )}

      {loading && <TableSkeleton />}
      {!loading && error && <div className="widget-error">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="prop-empty">
          <span className="prop-empty-icon" aria-hidden="true">🔧</span>
          <span className="prop-empty-msg">No jobs match the current filters.</span>
          <span className="prop-empty-hint">
            {jobs.length > 0 ? "Try clearing the filters." : "No jobs have been created yet."}
          </span>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="prop-table-wrap">
          <table className="prop-table" aria-label="Jobs">
            <thead>
              <tr>
                <th className="prop-th">Property</th>
                <th className="prop-th">Type / Trigger</th>
                <th className="prop-th prop-th--center">Status</th>
                <th className="prop-th prop-th--center">Priority</th>
                <th className="prop-th">Assignee</th>
                <th className="prop-th">Scheduled</th>
                <th className="prop-th">Due / Completed</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => {
                const propName = propNameMap[job.propertyId] ?? job.propertyId;
                return (
                  <tr
                    key={job.id}
                    className="prop-tr prop-tr--clickable"
                    onClick={() => navigate(`/properties/${job.propertyId}`)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View property for job ${job.id}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/properties/${job.propertyId}`);
                      }
                    }}
                  >
                    <td className="prop-td">
                      <span className="prop-name">{propName}</span>
                      <span className="prop-id">{job.id}</span>
                    </td>
                    <td className="prop-td">
                      <span className="jobs-job-type">{job.jobType.replace(/_/g, " ")}</span>
                      <span className="jobs-trigger">{job.triggerType.replace(/_/g, " ")}</span>
                    </td>
                    <td className="prop-td prop-td--center">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="prop-td prop-td--center">
                      <PriorityPill priority={job.priority} />
                    </td>
                    <td className="prop-td jobs-assignee">
                      {job.assignedTo
                        ? <><span>{job.assignedTo}</span><span className="jobs-assignee-type">{job.assignedToType}</span></>
                        : <span className="jobs-unassigned">Unassigned</span>
                      }
                    </td>
                    <td className="prop-td jobs-date">{fmtDate(job.scheduledFor)}</td>
                    <td className="prop-td jobs-date">
                      {job.completedAt ? fmtDate(job.completedAt) : fmtDate(job.dueBy)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
