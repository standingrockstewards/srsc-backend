/**
 * Admin — Client Lifecycle: Offboarding + Soft-Delete + Hard-Delete
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserMinus, AlertTriangle, CheckCircle2, RefreshCw, Trash2, RotateCcw, ChevronDown, ChevronUp, Clock } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ClientLifecycleCard({ client }: { client: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [retYears, setRetYears] = useState(3);
  const [confirming, setConfirming] = useState<"deactivate" | "hard-delete" | null>(null);

  const { data: checklistData, isLoading: checklistLoading } = useQuery({
    queryKey: ["offboarding-checklist", client.id],
    queryFn: () => apiRequest("GET", `/api/offboarding/${client.id}/checklist`).then(r => r.json()),
    enabled: expanded,
    staleTime: 0,
  });

  const deactivateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/clients/${client.id}/deactivate`, { retentionYears: retYears }),
    onSuccess: (data: any) => {
      toast({ title: "Client deactivated", description: `Data retained until ${fmtDate(data.retainUntil)}` });
      qc.invalidateQueries({ queryKey: ["clients-lifecycle"] });
      setConfirming(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/clients/${client.id}`),
    onSuccess: () => {
      toast({ title: "Client permanently deleted" });
      qc.invalidateQueries({ queryKey: ["clients-lifecycle"] });
      setConfirming(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const checklist = checklistData?.checklist ?? [];
  const readyToDeactivate = checklistData?.readyToDeactivate ?? false;
  const isActive = client.status === "active";
  const isInactive = client.status === "inactive";

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold"
            style={{ background: isActive ? `${SAGE}22` : `${TERRACOTTA}22`, color: isActive ? SAGE : TERRACOTTA, fontFamily: SERIF }}>
            {client.name?.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-semibold text-base" style={{ color: CREAM, fontFamily: SERIF }}>{client.name}</p>
            <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>{client.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
            style={{ background: isActive ? `${SAGE}22` : `${TERRACOTTA}22`, color: isActive ? SAGE : TERRACOTTA }}>
            {client.status}
          </span>
          {isInactive && client.retention_delete_after && (
            <span className="text-xs hidden sm:block" style={{ color: MUTED, fontFamily: SANS }}>
              <Clock size={11} className="inline mr-0.5" />Retain until {fmtDate(client.retention_delete_after)}
            </span>
          )}
          {expanded ? <ChevronUp size={16} style={{ color: MUTED }} /> : <ChevronDown size={16} style={{ color: MUTED }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t space-y-4" style={{ borderColor: CARD_BORDER }}>
          {/* Offboarding checklist */}
          {checklistLoading && (
            <div className="flex items-center gap-2 py-4">
              <RefreshCw size={14} className="animate-spin" style={{ color: MUTED }} />
              <span style={{ color: MUTED, fontFamily: SANS, fontSize: 13 }}>Loading checklist…</span>
            </div>
          )}

          {!checklistLoading && checklist.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-2" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Offboarding Checklist</p>
              <div className="space-y-2">
                {checklist.map((item: any) => (
                  <div key={item.key} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "#141414" }}>
                    {item.done
                      ? <CheckCircle2 size={15} style={{ color: SAGE, flexShrink: 0 }} />
                      : <AlertTriangle size={15} style={{ color: TERRACOTTA, flexShrink: 0 }} />
                    }
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: item.done ? MUTED : CREAM, fontFamily: SANS }}>{item.label}</p>
                      {item.detail && <p className="text-xs" style={{ color: MUTED }}>{item.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {!readyToDeactivate && (
                <p className="text-xs mt-2" style={{ color: TERRACOTTA, fontFamily: SANS }}>
                  ⚠ Complete all checklist items before deactivating.
                </p>
              )}
            </div>
          )}

          {/* Deactivate */}
          {isActive && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Soft-Delete / Deactivate</p>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-sm" style={{ color: CREAM, fontFamily: SANS }}>Data retention:</label>
                <select value={retYears} onChange={e => setRetYears(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg text-sm border"
                  style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}>
                  <option value={2}>2 years</option>
                  <option value={3}>3 years (default)</option>
                  <option value={5}>5 years</option>
                </select>
              </div>

              {confirming === "deactivate" ? (
                <div className="rounded-lg p-3" style={{ background: `${TERRACOTTA}15`, border: `1px solid ${TERRACOTTA}44` }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: TERRACOTTA, fontFamily: SANS }}>Confirm deactivation?</p>
                  <p className="text-xs mb-3" style={{ color: MUTED, fontFamily: SANS }}>
                    This will halt services, hide client from active views, and retain data for {retYears} years.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => deactivateMutation.mutate()}
                      disabled={deactivateMutation.isPending}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
                      style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                      {deactivateMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <UserMinus size={13} />} Confirm
                    </button>
                    <button onClick={() => setConfirming(null)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: "#222", color: MUTED, fontFamily: SANS }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirming("deactivate")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, fontFamily: SANS }}>
                  <UserMinus size={14} /> Deactivate Client
                </button>
              )}
            </div>
          )}

          {/* Hard-delete (inactive only) */}
          {isInactive && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Permanent Deletion</p>
              {confirming === "hard-delete" ? (
                <div className="rounded-lg p-3" style={{ background: `${TERRACOTTA}15`, border: `1px solid ${TERRACOTTA}44` }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: TERRACOTTA, fontFamily: SANS }}>⚠ IRREVERSIBLE — Permanently delete all data?</p>
                  <p className="text-xs mb-3" style={{ color: MUTED, fontFamily: SANS }}>
                    This will permanently remove the client and all associated records. Only available after retention window expires.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => hardDeleteMutation.mutate()}
                      disabled={hardDeleteMutation.isPending}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
                      style={{ background: "#8b0000", color: CREAM, fontFamily: SANS }}>
                      {hardDeleteMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete Permanently
                    </button>
                    <button onClick={() => setConfirming(null)} className="flex-1 py-2 rounded-lg text-sm" style={{ background: "#222", color: MUTED, fontFamily: SANS }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirming("hard-delete")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: "#1a1a1a", color: "#ff6b6b", fontFamily: SANS, border: "1px solid #441111" }}>
                  <Trash2 size={14} /> Hard Delete (Post-Retention)
                </button>
              )}
              <p className="text-xs mt-2" style={{ color: MUTED, fontFamily: SANS }}>
                Deactivated {fmtDate(client.deactivated_at)} · Retain until {fmtDate(client.retention_delete_after)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LifecyclePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["clients-lifecycle"],
    queryFn: () => apiRequest("GET", "/api/users").then(r => r.json()).then((users: any[]) => users.filter((u: any) => u.role === "client")),
    staleTime: 0,
  });

  const clients: any[] = data ?? [];
  const active = clients.filter(c => c.status === "active" || c.status === "pending");
  const inactive = clients.filter(c => c.status === "inactive");

  return (
    <AppLayout title="Client Lifecycle" subtitle="Offboarding & retention">
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg" style={{ background: `${TERRACOTTA}22` }}>
            <UserMinus size={20} style={{ color: TERRACOTTA }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Client Lifecycle</h1>
            <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>Offboarding checklist · soft-delete · 3-year data retention</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12">
            <RefreshCw size={16} className="animate-spin" style={{ color: MUTED }} />
          </div>
        )}

        {active.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold mb-2" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active Clients ({active.length})</p>
            <div className="space-y-2">{active.map(c => <ClientLifecycleCard key={c.id} client={c} />)}</div>
          </div>
        )}

        {inactive.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Inactive / Offboarded ({inactive.length})</p>
            <div className="space-y-2">{inactive.map(c => <ClientLifecycleCard key={c.id} client={c} />)}</div>
          </div>
        )}

        {!isLoading && clients.length === 0 && (
          <div className="text-center py-16 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <UserMinus size={40} style={{ color: MUTED, margin: "0 auto 12px" }} />
            <p style={{ color: MUTED, fontFamily: SANS }}>No clients found</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
