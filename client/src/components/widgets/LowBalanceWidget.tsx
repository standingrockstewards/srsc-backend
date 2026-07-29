/**
 * src/components/widgets/LowBalanceWidget.tsx  (Brick 10c)
 *
 * Admin/supervisor only — hidden for all other roles.
 * Fetches GET /api/v2/retainer/low-balance → LowBalanceProperty[]
 * (the `currentBalance` field on LowBalanceProperty is a string from the
 * lowBalanceProperties() service path, which returns retainerService.currentBalance()
 * — that is a string. Distinct from the /balance endpoint seam in StatCards.)
 *
 * Row click: navigate to /properties (no per-property page in 10c — follow-on brick).
 * Read-only display only.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { formatMoney, balancePctDisplay } from "@/lib/money";
import { useAuth } from "@/context/AuthContext";
import type { LowBalanceProperty } from "@/types";

export function LowBalanceWidget() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [rows,    setRows]    = useState<LowBalanceProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Role guard — enforced at the API level too (requireAdminOrSupervisor)
  const isVisible = role === "admin" || role === "supervisor";

  useEffect(() => {
    if (!isVisible) return;

    api.get<LowBalanceProperty[]>("/retainer/low-balance")
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Could not load low-balance properties.";
        console.warn("[LowBalanceWidget]", err);
        setError(msg);
        setLoading(false);
      });
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-title">Low Retainer Balance</span>
        {!loading && !error && rows.length > 0 && (
          <span className="widget-badge widget-badge--warn">{rows.length}</span>
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

      {!loading && !error && rows.length === 0 && (
        <div className="widget-empty">
          <span className="widget-empty-icon">✓</span>
          All retainer balances are healthy.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="widget-list">
          {rows.map((prop) => {
            const pct = balancePctDisplay(prop.currentBalance, prop.targetRetainerAmount);
            const pctNum = parseInt(pct, 10);
            const isUrgent = !isNaN(pctNum) && pctNum < 10;

            return (
              <button
                key={prop.id}
                className="widget-list-row widget-list-row--clickable"
                onClick={() => navigate("/properties")}
                title={`View ${prop.nickname}`}
              >
                <div className="widget-list-row-main">
                  <span className="widget-list-row-name">{prop.nickname}</span>
                  <span className="widget-list-row-sub">
                    {prop.city ?? prop.address}
                  </span>
                </div>
                <div className="widget-list-row-meta">
                  <span
                    className={`widget-list-row-value${isUrgent ? " widget-list-row-value--urgent" : " widget-list-row-value--warn"}`}
                  >
                    {formatMoney(prop.currentBalance)}
                  </span>
                  <span className="widget-list-row-sub-right">
                    {pct} of {formatMoney(prop.targetRetainerAmount)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
