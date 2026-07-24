/**
 * Audit Log — /audit
 * Read-only view. Admin default; Supervisor grantable.
 * Requires view_audit permission — 403 shown otherwise.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, FileText, DollarSign, Key, AlertTriangle,
  Truck, Users, ChevronLeft, ChevronRight, Filter, Search,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE       = "#7A8C6E";
const CREAM      = "#F5F0EA";
const MUTED      = "rgba(245,240,234,0.55)";
const RED_ALERT  = "#E05252";
const SERIF      = "var(--font-serif)";
const SANS       = "var(--font-sans)";

const ENTITY_META: Record<string, { label: string; icon: any; color: string }> = {
  quote:         { label: "Quote",       icon: FileText,     color: SAGE },
  tos:           { label: "ToS",         icon: Shield,       color: TERRACOTTA },
  billing:       { label: "Billing",     icon: DollarSign,   color: SAGE },
  permissions:   { label: "Permissions", icon: Key,          color: RED_ALERT },
  signal_flares: { label: "Signal Flare",icon: AlertTriangle,color: RED_ALERT },
  vendors:       { label: "Vendor",      icon: Truck,        color: TERRACOTTA },
  users:         { label: "User",        icon: Users,        color: SAGE },
};

const ACTION_COLORS: Record<string, string> = {
  submitted: SAGE,
  reviewed:  SAGE,
  released:  SAGE,
  approved:  SAGE,
  accepted:  SAGE,
  paid:      SAGE,
  granted:   SAGE,
  issued:    TERRACOTTA,
  deposit:   SAGE,
  draw:      TERRACOTTA,
  adjustment: TERRACOTTA,
  revoked:   RED_ALERT,
  rejected:  RED_ALERT,
  deactivated: RED_ALERT,
  client_declined: RED_ALERT,
  client_approved: SAGE,
};

function timeStr(iso: string): string {
  try { return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

export function AuditLogPage() {
  const [entity,  setEntity]  = useState("");
  const [from,    setFrom]    = useState("");
  const [to,      setTo]      = useState("");
  const [actor,   setActor]   = useState("");
  const [page,    setPage]    = useState(1);
  const LIMIT = 50;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    ...(entity ? { entity } : {}),
    ...(from   ? { from }   : {}),
    ...(to     ? { to }     : {}),
    ...(actor  ? { actor }  : {}),
  });

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["audit", entity, from, to, actor, page],
    queryFn: () => apiRequest("GET", `/api/audit?${params}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const audit  = data?.audit ?? [];
  const total  = data?.total ?? 0;
  const pages  = data?.pages ?? 1;

  // 403 handling
  if ((error as any)?.message?.startsWith("403")) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center" }}>
        <Shield size={40} color={RED_ALERT} style={{ marginBottom: 16 }} />
        <h2 style={{ fontFamily: SERIF, fontSize: 22, color: CREAM, margin: 0 }}>Access Restricted</h2>
        <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, marginTop: 8 }}>
          You need the <strong>View Audit Log</strong> permission. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: CREAM, margin: 0 }}>
          Audit Log
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, marginTop: 6 }}>
          Read-only trail of quotes, payments, ToS, permissions, and lifecycle events. {total > 0 && `${total} records.`}
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
        marginBottom: 24, padding: "16px 20px",
        background: "rgba(255,255,255,0.03)", borderRadius: 12,
        border: "1px solid rgba(245,240,234,0.08)",
      }}>
        {/* Entity filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</label>
          <select
            value={entity}
            onChange={e => { setEntity(e.target.value); setPage(1); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,240,234,0.12)",
              borderRadius: 8, color: CREAM, fontFamily: SANS, fontSize: 13, padding: "7px 12px",
            }}
          >
            <option value="">All</option>
            {Object.entries(ENTITY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>From</label>
          <input
            type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,240,234,0.12)",
              borderRadius: 8, color: CREAM, fontFamily: SANS, fontSize: 13, padding: "7px 12px",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>To</label>
          <input
            type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,240,234,0.12)",
              borderRadius: 8, color: CREAM, fontFamily: SANS, fontSize: 13, padding: "7px 12px",
            }}
          />
        </div>

        {/* Actor filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Actor</label>
          <input
            type="text" value={actor} placeholder="Filter by name…"
            onChange={e => { setActor(e.target.value); setPage(1); }}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,240,234,0.12)",
              borderRadius: 8, color: CREAM, fontFamily: SANS, fontSize: 13, padding: "7px 12px",
            }}
          />
        </div>

        {/* Clear */}
        {(entity || from || to || actor) && (
          <button
            onClick={() => { setEntity(""); setFrom(""); setTo(""); setActor(""); setPage(1); }}
            style={{
              fontFamily: SANS, fontSize: 12, padding: "8px 14px",
              borderRadius: 8, border: "1px solid rgba(245,240,234,0.15)",
              background: "transparent", color: MUTED, cursor: "pointer",
              alignSelf: "flex-end",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: "center", color: MUTED, fontFamily: SANS, padding: 40 }}>Loading audit records…</div>
      ) : audit.length === 0 ? (
        <div style={{ textAlign: "center", color: MUTED, fontFamily: SANS, padding: 40 }}>
          No audit records match your filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 100px 120px 160px",
              gap: 12, padding: "8px 16px",
            }}>
              {["Category", "Summary", "Action", "Actor", "Timestamp"].map(h => (
                <div key={h} style={{ fontFamily: SANS, fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {h}
                </div>
              ))}
            </div>

            {audit.map((row: any) => {
              const meta   = ENTITY_META[row.entity] ?? { label: row.entity, icon: FileText, color: SAGE };
              const Icon   = meta.icon;
              const aColor = ACTION_COLORS[row.action] ?? MUTED;

              return (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr 100px 120px 160px",
                    gap: 12, alignItems: "flex-start",
                    padding: "14px 16px",
                    background: "rgba(255,255,255,0.025)",
                    borderRadius: 8,
                    border: "1px solid rgba(245,240,234,0.05)",
                  }}
                >
                  {/* Category */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: `${meta.color}20`, display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Icon size={12} color={meta.color} />
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: 13, color: CREAM }}>{meta.label}</span>
                  </div>

                  {/* Summary */}
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: CREAM, lineHeight: 1.4 }}>
                      {row.summary}
                    </div>
                    {row.detail && (
                      <div style={{ fontFamily: SANS, fontSize: 12, color: MUTED, marginTop: 3 }}>
                        {row.detail}
                      </div>
                    )}
                    {row.amount != null && (
                      <div style={{ fontFamily: SANS, fontSize: 12, color: SAGE, marginTop: 3 }}>
                        ${Number(row.amount).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div style={{
                    fontFamily: SANS, fontSize: 12, padding: "3px 10px",
                    borderRadius: 10, background: `${aColor}18`, color: aColor,
                    textAlign: "center", alignSelf: "flex-start",
                    textTransform: "capitalize",
                    wordBreak: "break-word",
                  }}>
                    {(row.action ?? "").replace(/_/g, " ")}
                  </div>

                  {/* Actor */}
                  <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED }}>
                    {row.actor ?? "—"}
                  </div>

                  {/* Timestamp */}
                  <div style={{ fontFamily: SANS, fontSize: 12, color: MUTED }}>
                    {timeStr(row.occurred_at)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
            <span style={{ fontFamily: SANS, fontSize: 13, color: MUTED }}>
              Page {page} of {pages} ({total} records)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  fontFamily: SANS, fontSize: 13, padding: "7px 14px",
                  borderRadius: 8, border: "1px solid rgba(245,240,234,0.15)",
                  background: "transparent", color: page === 1 ? MUTED : CREAM,
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages}
                style={{
                  fontFamily: SANS, fontSize: 13, padding: "7px 14px",
                  borderRadius: 8, border: "1px solid rgba(245,240,234,0.15)",
                  background: "transparent", color: page >= pages ? MUTED : CREAM,
                  cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.4 : 1,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
