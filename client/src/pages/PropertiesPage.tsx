/**
 * src/pages/PropertiesPage.tsx  (Brick 10S)
 *
 * Route: /properties  — inside RequireAuth / AppShell
 * Lists all properties returned by GET /api/v2/properties.
 * Each row links to /properties/:id for the detail view.
 *
 * Auth: apiFetch (credentials: "include"). 401 → existing redirect handler.
 * No hardcoded data — 100 % live API.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Property } from "@/types";

// ── Billing-state badge ───────────────────────────────────────────────────────

function BillingBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    current:    { label: "Current",    cls: "prop-badge prop-badge--ok" },
    grace:      { label: "Grace",      cls: "prop-badge prop-badge--warn" },
    delinquent: { label: "Delinquent", cls: "prop-badge prop-badge--err" },
  };
  const { label, cls } = map[state] ?? { label: state, cls: "prop-badge prop-badge--muted" };
  return <span className={cls}>{label}</span>;
}

// ── Active badge ──────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return active
    ? <span className="prop-badge prop-badge--ok">Active</span>
    : <span className="prop-badge prop-badge--muted">Inactive</span>;
}

// ── Service-tier pill ─────────────────────────────────────────────────────────

function TierPill({ tier }: { tier: string | null }) {
  if (!tier) return <span className="prop-tier prop-tier--none">—</span>;
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return <span className="prop-tier">{label}</span>;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="prop-table-skeleton" aria-label="Loading properties…" role="status" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="prop-skeleton-row">
          <div className="prop-skeleton-cell prop-skeleton-cell--wide" />
          <div className="prop-skeleton-cell" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
          <div className="prop-skeleton-cell prop-skeleton-cell--narrow" />
          <div className="prop-skeleton-cell" />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyProperties() {
  return (
    <div className="prop-empty" role="status">
      <span className="prop-empty-icon" aria-hidden="true">🏡</span>
      <span className="prop-empty-msg">No properties found.</span>
      <span className="prop-empty-hint">Properties added to the system will appear here.</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertiesPage() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    api.get<Property[]>("/properties")
      .then((rows) => {
        setProperties(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
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
    : `${properties.length} propert${properties.length === 1 ? "y" : "ies"}`;

  return (
    <div className="prop-list-page">
      <div className="page-header">
        <h1 className="page-title">Properties</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {loading && <TableSkeleton />}

      {!loading && error && (
        <div className="widget-error">{error}</div>
      )}

      {!loading && !error && properties.length === 0 && <EmptyProperties />}

      {!loading && !error && properties.length > 0 && (
        <div className="prop-table-wrap">
          <table className="prop-table" aria-label="Properties">
            <thead>
              <tr>
                <th className="prop-th">Property</th>
                <th className="prop-th">Location</th>
                <th className="prop-th prop-th--center">Tier</th>
                <th className="prop-th prop-th--center">Billing</th>
                <th className="prop-th prop-th--center">Status</th>
                <th className="prop-th prop-th--right">Target Retainer</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((prop) => {
                const displayName = prop.nickname && prop.nickname.trim()
                  ? prop.nickname
                  : prop.address;
                const location = [prop.city, prop.state]
                  .filter(Boolean)
                  .join(", ") || prop.address;

                return (
                  <tr
                    key={prop.id}
                    className="prop-tr prop-tr--clickable"
                    onClick={() => navigate(`/properties/${prop.id}`)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${displayName}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/properties/${prop.id}`);
                      }
                    }}
                  >
                    <td className="prop-td prop-td--name">
                      <span className="prop-name">{displayName}</span>
                      <span className="prop-id">{prop.id}</span>
                    </td>
                    <td className="prop-td prop-td--location">{location}</td>
                    <td className="prop-td prop-td--center">
                      <TierPill tier={prop.serviceTier} />
                    </td>
                    <td className="prop-td prop-td--center">
                      <BillingBadge state={prop.billingState} />
                    </td>
                    <td className="prop-td prop-td--center">
                      <ActiveBadge active={prop.active} />
                    </td>
                    <td className="prop-td prop-td--right prop-td--money">
                      {formatMoney(prop.targetRetainerAmount)}
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
