/**
 * src/components/widgets/UpcomingJobsWidget.tsx  (Brick 10c)
 *
 * Shows next N jobs with status scheduled|dispatched, sorted by scheduledFor asc.
 *
 * ROLE ROUTING (enforced at API level, not just client-side hiding):
 *
 *   admin/supervisor/field_tech:
 *     GET /api/v2/jobs?status=scheduled&limit=50
 *     GET /api/v2/jobs?status=dispatched&limit=50
 *     Merge → sort by scheduledFor asc → take first MAX_DISPLAY.
 *     (field_tech: backend scopes to their assigned jobs)
 *
 *   client:
 *     GET /api/v2/jobs is 403 for clients — DO NOT call it.
 *     Instead: for each owned property → GET /api/v2/properties/:pid/jobs?status=scheduled
 *              and GET /api/v2/properties/:pid/jobs?status=dispatched
 *     Merge all → sort → take first MAX_DISPLAY.
 *     Requires customerId from AuthContext; fetches properties first, then jobs per property.
 *
 *   vendor: not shown (requireNotVendor on /jobs).
 *
 * All IDs are text. scheduledFor is ISO string or null.
 */

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime, fmtRelative } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { StewardshipJob, Property } from "@/types";

const MAX_DISPLAY = 8;
const ACTIVE_STATUSES = ["scheduled", "dispatched"] as const;

// Status pill styles
const STATUS_STYLES: Record<string, string> = {
  scheduled:  "pill--info",
  dispatched: "pill--warn",
  in_progress:"pill--accent",
  pending:    "pill--muted",
  completed:  "pill--ok",
  cancelled:  "pill--err",
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "pill--muted";
  return <span className={`pill ${cls}`}>{status.replace("_", " ")}</span>;
}

// Sort jobs by scheduledFor asc; nulls last
function sortJobs(jobs: StewardshipJob[]): StewardshipJob[] {
  return [...jobs].sort((a, b) => {
    if (!a.scheduledFor && !b.scheduledFor) return 0;
    if (!a.scheduledFor) return 1;
    if (!b.scheduledFor) return -1;
    return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
  });
}

// ── Admin / Supervisor / field_tech fetch ─────────────────────────────────────

async function fetchStaffJobs(): Promise<StewardshipJob[]> {
  const results = await Promise.all(
    ACTIVE_STATUSES.map((status) =>
      api.get<StewardshipJob[]>(`/jobs?status=${status}&limit=50`).catch((err) => {
        if (!(err instanceof ApiError && err.status === 403)) {
          console.warn(`[UpcomingJobsWidget] /jobs?status=${status} failed:`, err);
        }
        return [] as StewardshipJob[];
      }),
    ),
  );
  return results.flat();
}

// ── Client fetch — per-property, NOT /jobs directly (403 for clients) ─────────

async function fetchClientJobs(_customerId: string): Promise<StewardshipJob[]> {
  let properties: Property[] = [];
  try {
    properties = await api.get<Property[]>("/properties");
  } catch (err) {
    console.warn("[UpcomingJobsWidget] /properties fetch failed:", err);
    return [];
  }

  // For each active property, fetch scheduled + dispatched jobs
  const jobLists = await Promise.all(
    properties
      .filter((p) => p.active)
      .flatMap((p) =>
        ACTIVE_STATUSES.map((status) =>
          api
            .get<StewardshipJob[]>(`/properties/${p.id}/jobs?status=${status}&limit=50`)
            .catch((err) => {
              if (!(err instanceof ApiError && err.status === 403)) {
                console.warn(
                  `[UpcomingJobsWidget] /properties/${p.id}/jobs?status=${status} failed:`,
                  err,
                );
              }
              return [] as StewardshipJob[];
            }),
        ),
      ),
  );

  // Deduplicate by job ID (same job might appear in multiple property fetches)
  const seen = new Set<string>();
  return jobLists.flat().filter((j) => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UpcomingJobsWidget() {
  const { role, customerId } = useAuth();
  const [jobs,    setJobs]    = useState<StewardshipJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isVisible = role !== "vendor";

  useEffect(() => {
    if (!isVisible) return;

    const load = async () => {
      try {
        let raw: StewardshipJob[];
        if (role === "client") {
          if (!customerId) {
            setError("No customer record linked to this account.");
            setLoading(false);
            return;
          }
          raw = await fetchClientJobs(customerId);
        } else {
          // admin, supervisor, field_tech
          raw = await fetchStaffJobs();
        }
        setJobs(sortJobs(raw).slice(0, MAX_DISPLAY));
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Could not load upcoming jobs.";
        console.warn("[UpcomingJobsWidget]", err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isVisible, role, customerId]);

  if (!isVisible) return null;

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-title">Upcoming Jobs</span>
        {!loading && !error && jobs.length > 0 && (
          <span className="widget-badge widget-badge--info">{jobs.length}</span>
        )}
      </div>

      {loading && (
        <div className="widget-loading">
          <div className="widget-skeleton" />
          <div className="widget-skeleton" />
          <div className="widget-skeleton" />
        </div>
      )}

      {error && (
        <div className="widget-error">{error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="widget-empty">
          <span className="widget-empty-icon">📋</span>
          No scheduled or dispatched jobs.
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="widget-list">
          {jobs.map((job) => (
            <div key={job.id} className="widget-list-row">
              <div className="widget-list-row-main">
                <span className="widget-list-row-name">
                  {job.jobType.replace(/_/g, " ")}
                </span>
                <span className="widget-list-row-sub">
                  {job.scheduledFor
                    ? `${fmtDateTime(job.scheduledFor)} · ${fmtRelative(job.scheduledFor)}`
                    : "No schedule set"}
                </span>
              </div>
              <div className="widget-list-row-meta">
                <StatusPill status={job.status} />
                <span className="widget-list-row-sub-right">
                  {job.priority !== "normal" ? job.priority : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
