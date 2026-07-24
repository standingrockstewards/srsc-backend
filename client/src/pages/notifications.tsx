/**
 * Notification Center — /notifications
 * All authenticated roles. Shows in-app inbox + link to preferences.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Bell, BellOff, Check, CheckCheck, Filter, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

const TERRACOTTA = "#C05A43";
const SAGE       = "#7A8C6E";
const CREAM      = "#F5F0EA";
const CHARCOAL   = "#141414";
const MUTED      = "rgba(245,240,234,0.55)";
const RED_ALERT  = "#E05252";
const SERIF      = "var(--font-serif)";
const SANS       = "var(--font-sans)";

const TYPE_LABELS: Record<string, string> = {
  signal_flare: "Signal Flare",
  quote: "Quote",
  billing: "Billing",
  storm_event: "Storm",
  service_request: "Service Request",
  message: "Message",
  onboarding: "Onboarding",
  system: "System",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: RED_ALERT,
  attention: TERRACOTTA,
  info: SAGE,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
    ...(filterType !== "all" ? { type: filterType } : {}),
    ...(filterUnread ? { unread: "true" } : {}),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["notifications", filterType, filterUnread, page],
    queryFn: () => apiRequest("GET", `/api/notifications?${params}`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markReadMut = useMutation({
    mutationFn: ({ id, read }: { id: number; read: boolean }) =>
      apiRequest("PATCH", `/api/notifications/${id}`, { read }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: (type?: string) =>
      apiRequest("POST", "/api/notifications/read-all", type ? { type } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["nav-flags"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const total         = data?.total ?? 0;
  const unreadCount   = data?.unread_count ?? 0;
  const totalPages    = Math.ceil(total / PAGE_SIZE);

  const allTypes = ["all", ...Object.keys(TYPE_LABELS)];

  return (
    <div style={{ padding: "24px 28px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: CREAM, margin: 0 }}>
            Notifications
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("#/notification-preferences")}
            style={{
              fontFamily: SANS, fontSize: 13, padding: "8px 16px",
              borderRadius: 8, border: "1px solid rgba(245,240,234,0.15)",
              background: "transparent", color: MUTED, cursor: "pointer",
            }}
          >
            Preferences
          </button>
          <button
            onClick={() => markAllMut.mutate(filterType !== "all" ? filterType : undefined)}
            disabled={unreadCount === 0}
            style={{
              fontFamily: SANS, fontSize: 13, padding: "8px 16px",
              borderRadius: 8, border: `1px solid ${SAGE}`,
              background: `${SAGE}22`, color: SAGE, cursor: unreadCount === 0 ? "default" : "pointer",
              opacity: unreadCount === 0 ? 0.5 : 1,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <CheckCheck size={14} /> Mark All Read
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20,
        alignItems: "center",
      }}>
        {allTypes.map(t => (
          <button
            key={t}
            onClick={() => { setFilterType(t); setPage(0); }}
            style={{
              fontFamily: SANS, fontSize: 12, padding: "5px 12px",
              borderRadius: 20, border: `1px solid ${filterType === t ? TERRACOTTA : "rgba(245,240,234,0.12)"}`,
              background: filterType === t ? `${TERRACOTTA}22` : "transparent",
              color: filterType === t ? TERRACOTTA : MUTED, cursor: "pointer",
            }}
          >
            {t === "all" ? "All" : TYPE_LABELS[t] ?? t}
          </button>
        ))}
        <button
          onClick={() => { setFilterUnread(!filterUnread); setPage(0); }}
          style={{
            fontFamily: SANS, fontSize: 12, padding: "5px 12px",
            borderRadius: 20, border: `1px solid ${filterUnread ? SAGE : "rgba(245,240,234,0.12)"}`,
            background: filterUnread ? `${SAGE}22` : "transparent",
            color: filterUnread ? SAGE : MUTED, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <Filter size={12} /> Unread only
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: "center", color: MUTED, padding: 40, fontFamily: SANS }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          color: MUTED, fontFamily: SANS,
        }}>
          <BellOff size={36} color={MUTED} style={{ marginBottom: 12 }} />
          <div>No notifications{filterUnread ? " (unread)" : ""}{filterType !== "all" ? ` of type "${TYPE_LABELS[filterType]}"` : ""}.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {notifications.map((n: any) => {
            const severityColor = SEVERITY_COLORS[n.severity] ?? SAGE;
            return (
              <div
                key={n.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "16px 18px",
                  background: n.read ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                  borderRadius: 10,
                  border: `1px solid ${n.read ? "rgba(245,240,234,0.06)" : "rgba(245,240,234,0.12)"}`,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onClick={() => {
                  if (!n.read) markReadMut.mutate({ id: n.id, read: true });
                  if (n.link) {
                    // Handle hash navigation
                    const hash = n.link.startsWith("#") ? n.link.substring(1) : n.link;
                    window.location.hash = hash;
                  }
                }}
              >
                {/* Severity dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: n.read ? "transparent" : severityColor,
                  border: `2px solid ${n.read ? "rgba(245,240,234,0.15)" : severityColor}`,
                  marginTop: 6, flexShrink: 0,
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: SANS, fontSize: 12, padding: "2px 8px",
                      borderRadius: 10, background: `${severityColor}20`, color: severityColor,
                    }}>
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: MUTED }}>{timeAgo(n.created_at)}</span>
                  </div>
                  <div style={{
                    fontFamily: SANS, fontSize: 14, fontWeight: n.read ? 400 : 600,
                    color: CREAM, marginTop: 6, lineHeight: 1.4,
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 4,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                  }}>
                    {n.body}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {n.link && (
                    <div style={{ color: MUTED, padding: 4 }} onClick={e => e.stopPropagation()}>
                      <ExternalLink size={13} />
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); markReadMut.mutate({ id: n.id, read: !n.read }); }}
                    title={n.read ? "Mark unread" : "Mark read"}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      padding: 6, borderRadius: 6, color: n.read ? MUTED : SAGE,
                    }}
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              fontFamily: SANS, fontSize: 13, padding: "7px 16px",
              borderRadius: 8, border: "1px solid rgba(245,240,234,0.15)",
              background: "transparent", color: page === 0 ? MUTED : CREAM,
              cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ fontFamily: SANS, fontSize: 13, color: MUTED, padding: "8px 12px" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              fontFamily: SANS, fontSize: 13, padding: "7px 16px",
              borderRadius: 8, border: "1px solid rgba(245,240,234,0.15)",
              background: "transparent", color: page >= totalPages - 1 ? MUTED : CREAM,
              cursor: page >= totalPages - 1 ? "default" : "pointer",
              opacity: page >= totalPages - 1 ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
