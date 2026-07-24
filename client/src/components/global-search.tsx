/**
 * Global Search — Ctrl+K modal, top-bar trigger
 * Permission-scoped results, grouped by entity type.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Search, X, Building2, Users, Truck, FileText,
  Receipt, Wrench, Activity, AlertTriangle, BookOpen,
  ChevronRight,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE       = "#7A8C6E";
const CREAM      = "#F5F0EA";
const CHARCOAL   = "#141414";
const MUTED      = "rgba(245,240,234,0.55)";
const RED_ALERT  = "#E05252";
const SERIF      = "var(--font-serif)";
const SANS       = "var(--font-sans)";

const GROUP_META: Record<string, { label: string; icon: any; color: string }> = {
  clients:          { label: "Clients",          icon: Users,        color: TERRACOTTA },
  properties:       { label: "Properties",       icon: Building2,    color: SAGE },
  vendors:          { label: "Vendors",          icon: Truck,        color: TERRACOTTA },
  quotes:           { label: "Quotes",           icon: FileText,     color: SAGE },
  invoices:         { label: "Invoices",         icon: Receipt,      color: TERRACOTTA },
  service_requests: { label: "Service Requests", icon: Wrench,       color: SAGE },
  visits:           { label: "Visit Reports",    icon: Activity,     color: TERRACOTTA },
  signal_flares:    { label: "Signal Flares",    icon: AlertTriangle,color: RED_ALERT },
  faq:              { label: "Knowledge Base",   icon: BookOpen,     color: SAGE },
};

function ResultRow({ item, group, onSelect }: { item: any; group: string; onSelect: () => void }) {
  const meta = GROUP_META[group];
  const Icon = meta?.icon ?? FileText;
  const color = meta?.color ?? SAGE;

  const label = item.nickname ?? item.title ?? item.name ?? item.description ?? item.category ?? "—";
  const sub   = item.property_name ?? item.address ?? item.status ?? item.overall_status ?? "";

  return (
    <div
      onClick={() => {
        if (item._link) {
          const hash = item._link.startsWith("#") ? item._link.substring(1) : item._link;
          window.location.hash = hash;
        }
        onSelect();
      }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 16px", cursor: "pointer", borderRadius: 8,
        transition: "background 0.1s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={13} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: SANS, fontSize: 13, fontWeight: 500, color: CREAM,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontFamily: SANS, fontSize: 12, color: MUTED,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {sub}
          </div>
        )}
      </div>
      <ChevronRight size={13} color={MUTED} />
    </div>
  );
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery("");
      setDebouncedQ("");
    }
  }, [open]);

  // Debounce input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["global-search", debouncedQ],
    queryFn: () => apiRequest("GET", `/api/search?q=${encodeURIComponent(debouncedQ)}`).then(r => r.json()),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  });

  const results = data?.results ?? {};
  const groups  = Object.keys(results).filter(k => results[k]?.length > 0);
  const total   = groups.reduce((s, k) => s + results[k].length, 0);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 600,
        background: "#1C1C1C",
        border: "1px solid rgba(245,240,234,0.12)",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        margin: "0 16px",
      }}>
        {/* Input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(245,240,234,0.08)",
        }}>
          <Search size={18} color={MUTED} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search properties, clients, quotes, Signal Flares…"
            onKeyDown={e => { if (e.key === "Escape") onClose(); }}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: SANS, fontSize: 15, color: CREAM,
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setDebouncedQ(""); inputRef.current?.focus(); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={16} color={MUTED} />
            </button>
          )}
          <kbd style={{
            fontFamily: SANS, fontSize: 11, color: MUTED, padding: "2px 7px",
            background: "rgba(255,255,255,0.07)", borderRadius: 5,
            border: "1px solid rgba(245,240,234,0.12)",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "8px 0" }}>
          {debouncedQ.length < 2 ? (
            <div style={{ padding: "24px 20px", textAlign: "center" }}>
              <Search size={28} color={MUTED} style={{ marginBottom: 10 }} />
              <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED }}>
                Type at least 2 characters to search
              </div>
            </div>
          ) : isLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: MUTED, fontFamily: SANS, fontSize: 13 }}>
              Searching…
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: MUTED, fontFamily: SANS, fontSize: 13 }}>
              No results for "{debouncedQ}"
            </div>
          ) : (
            <>
              {groups.map(group => {
                const meta = GROUP_META[group];
                const Icon = meta?.icon ?? FileText;
                return (
                  <div key={group}>
                    {/* Group header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 18px 4px",
                    }}>
                      <Icon size={12} color={meta?.color ?? SAGE} />
                      <span style={{
                        fontFamily: SANS, fontSize: 11, color: MUTED,
                        textTransform: "uppercase", letterSpacing: "0.07em",
                      }}>
                        {meta?.label ?? group} ({results[group].length})
                      </span>
                    </div>
                    {results[group].map((item: any, i: number) => (
                      <ResultRow key={i} item={item} group={group} onSelect={onClose} />
                    ))}
                  </div>
                );
              })}
              <div style={{ padding: "8px 18px 4px", textAlign: "right" }}>
                <span style={{ fontFamily: SANS, fontSize: 11, color: MUTED }}>
                  {total} result{total !== 1 ? "s" : ""}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
