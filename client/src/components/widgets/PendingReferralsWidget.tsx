/**
 * src/components/widgets/PendingReferralsWidget.tsx  (Brick 10c)
 *
 * Admin/supervisor only — hidden for all other roles (enforced at API level too).
 * Fetches GET /api/v2/referrals?status=pending → Referral[]
 *
 * READ-ONLY in 10c. No vesting or approve actions.
 * bonusCreditAmount is a string (Postgres numeric → JSON string driver).
 * vestsAt is an ISO datetime string or null.
 */

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtRelative } from "@/lib/dates";
import { useAuth } from "@/context/AuthContext";
import type { Referral } from "@/types";

export function PendingReferralsWidget() {
  const { role } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Role guard — API also enforces requireAdminOrSupervisor
  const isVisible = role === "admin" || role === "supervisor";

  useEffect(() => {
    if (!isVisible) return;

    api.get<Referral[]>("/referrals?status=pending")
      .then((data) => {
        setReferrals(data);
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Could not load pending referrals.";
        console.warn("[PendingReferralsWidget]", err);
        setError(msg);
        setLoading(false);
      });
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-title">Pending Referrals</span>
        {!loading && !error && referrals.length > 0 && (
          <span className="widget-badge widget-badge--accent">{referrals.length}</span>
        )}
      </div>

      {loading && (
        <div className="widget-loading">
          <div className="widget-skeleton" />
          <div className="widget-skeleton" />
        </div>
      )}

      {error && (
        <div className="widget-error">{error}</div>
      )}

      {!loading && !error && referrals.length === 0 && (
        <div className="widget-empty">
          <span className="widget-empty-icon">✓</span>
          No pending referrals.
        </div>
      )}

      {!loading && !error && referrals.length > 0 && (
        <div className="widget-list">
          {referrals.map((ref) => (
            <div key={ref.id} className="widget-list-row">
              <div className="widget-list-row-main">
                <span className="widget-list-row-name">
                  {/* Show truncated IDs — a future brick will resolve these to names */}
                  Referrer <code className="id-chip">{ref.referrerCustomerId.slice(0, 8)}</code>
                  {" → "}
                  <code className="id-chip">{ref.referredCustomerId.slice(0, 8)}</code>
                </span>
                <span className="widget-list-row-sub">
                  Created {fmtDate(ref.createdAt)}
                  {ref.vestsAt ? ` · Vests ${fmtRelative(ref.vestsAt)}` : ""}
                </span>
              </div>
              <div className="widget-list-row-meta">
                <span className="widget-list-row-value widget-list-row-value--accent">
                  {formatMoney(ref.bonusCreditAmount)}
                </span>
                <span className="pill pill--muted">pending</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
