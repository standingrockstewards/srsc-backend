/**
 * src/pages/DashboardPage.tsx  (Brick 10c — dashboard widgets)
 *
 * Layout:
 *   1. Page header (title + subtitle from property count)
 *   2. StatCards row (role-aware: client vs admin/supervisor)
 *   3. Widget grid — 2-col responsive CSS grid:
 *        LowBalanceWidget | UpcomingJobsWidget
 *        PendingReferralsWidget | RecentActivityWidget
 *   4. MapView (primary panel — from Brick 10b, unchanged)
 *
 * badges come from Outlet context (AppShell → useBadges → Outlet context),
 * so StatCards can reuse the counts without a second fetch.
 *
 * All IDs text. Money string. AuthUser.id is the only integer.
 */

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { MapView } from "@/components/MapView";
import { StatCards } from "@/components/widgets/StatCards";
import { LowBalanceWidget } from "@/components/widgets/LowBalanceWidget";
import { UpcomingJobsWidget } from "@/components/widgets/UpcomingJobsWidget";
import { RecentActivityWidget } from "@/components/widgets/RecentActivityWidget";
import { PendingReferralsWidget } from "@/components/widgets/PendingReferralsWidget";
import type { Property } from "@/types";
import type { BadgeCounts } from "@/hooks/useBadges";

type OutletCtx = { badges: BadgeCounts };

export function DashboardPage() {
  const { badges } = useOutletContext<OutletCtx>();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    api.get<Property[]>("/properties")
      .then((rows) => {
        setProperties(rows);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? `Failed to load properties: ${err.message}`
            : "Failed to load properties.",
        );
        setLoading(false);
      });
  }, []);

  const subtitle = loading
    ? "Loading…"
    : error
    ? "Could not load property data."
    : `${properties.length} propert${properties.length === 1 ? "y" : "ies"} monitored`;

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {/* Stat cards (role-aware) */}
      <StatCards badges={badges} />

      {/* Widget grid */}
      <div className="widget-grid">
        <LowBalanceWidget />
        <UpcomingJobsWidget />
        <PendingReferralsWidget />
        <RecentActivityWidget />
      </div>

      {/* Map — primary panel from Brick 10b */}
      <div className="dashboard-map">
        <MapView
          properties={properties}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}
