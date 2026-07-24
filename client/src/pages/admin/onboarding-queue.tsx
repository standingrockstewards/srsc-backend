/**
 * Admin — Onboarding Queue
 * Lists pending self-sign-ups. Admin reviews, activates, links property + tier.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, Clock, Phone, Mail, Building2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function Spinner() {
  return <RefreshCw size={16} className="animate-spin" style={{ color: TERRACOTTA }} />;
}

export default function OnboardingQueuePage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["onboarding-queue"],
    queryFn: () => apiRequest("GET", "/api/onboarding/queue").then(r => r.json()),
    staleTime: 0,
  });

  const { data: propsData } = useQuery({
    queryKey: ["properties"],
    queryFn: () => apiRequest("GET", "/api/properties").then(r => r.json()),
    staleTime: 0,
  });

  const pending: any[] = data?.pending ?? [];
  const allProps: any[] = propsData ?? [];
  const unlinkedProps = allProps.filter((p: any) => !p.client_user_id);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activateForm, setActivateForm] = useState<Record<number, { propertyId: string; tier: string }>>({});

  const activateMutation = useMutation({
    mutationFn: ({ id, propertyId, tier }: { id: number; propertyId?: number; tier?: string }) =>
      apiRequest("PATCH", `/api/onboarding/${id}/activate`, { propertyId, tier }),
    onSuccess: (_, vars) => {
      toast({ title: "Account activated", description: "Client can now log in." });
      qc.invalidateQueries({ queryKey: ["onboarding-queue"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e: any) => toast({ title: "Activation failed", description: e.message, variant: "destructive" }),
  });

  const getForm = (id: number) => activateForm[id] ?? { propertyId: "", tier: "" };
  const setForm = (id: number, patch: any) => setActivateForm(f => ({ ...f, [id]: { ...getForm(id), ...patch } }));

  const tiers = [
    { value: "anchor_watch", label: "Anchor Watch" },
    { value: "shipshape", label: "Ship Shape" },
    { value: "signal_flare", label: "Signal Flare" },
  ];

  return (
    <AppLayout title="Onboarding Queue" subtitle={`${pending.length} pending account${pending.length !== 1 ? "s" : ""}`}>
      <div className="p-4 md:p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${TERRACOTTA}22` }}>
              <UserCheck size={20} style={{ color: TERRACOTTA }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Client Sign-Up Queue</h1>
              <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>Review and activate pending client accounts</p>
            </div>
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:opacity-80" style={{ background: CARD_BG }}>
            <RefreshCw size={16} style={{ color: MUTED }} />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 p-8 justify-center">
            <Spinner /><span style={{ color: MUTED, fontFamily: SANS }}>Loading…</span>
          </div>
        )}

        {!isLoading && pending.length === 0 && (
          <div className="text-center py-16 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <UserCheck size={40} style={{ color: MUTED, margin: "0 auto 12px" }} />
            <p style={{ color: CREAM, fontFamily: SERIF, fontSize: 18 }}>No pending accounts</p>
            <p className="text-sm mt-2" style={{ color: MUTED, fontFamily: SANS }}>New sign-ups will appear here for review.</p>
          </div>
        )}

        <div className="space-y-3">
          {pending.map((u: any) => {
            const isOpen = expandedId === u.id;
            const form = getForm(u.id);
            return (
              <div key={u.id} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                {/* Summary row */}
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : u.id)}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: `${TERRACOTTA}33`, color: TERRACOTTA, fontFamily: SERIF }}>
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-base" style={{ color: CREAM, fontFamily: SERIF }}>{u.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-0.5">
                        <span className="text-sm flex items-center gap-1" style={{ color: MUTED, fontFamily: SANS }}>
                          <Mail size={12} />{u.email}
                        </span>
                        {u.phone && (
                          <span className="text-sm flex items-center gap-1" style={{ color: MUTED, fontFamily: SANS }}>
                            <Phone size={12} />{u.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>
                        <Clock size={11} className="inline mr-1" />{fmtDate(u.created_at ?? "")}
                      </p>
                      {u.referred_by_code && (
                        <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${SAGE}22`, color: SAGE }}>Referred</span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp size={16} style={{ color: MUTED }} /> : <ChevronDown size={16} style={{ color: MUTED }} />}
                  </div>
                </button>

                {/* Expanded activation form */}
                {isOpen && (
                  <div className="p-4 pt-0 border-t" style={{ borderColor: CARD_BORDER }}>
                    <div className="pt-4 space-y-4">
                      <p className="text-sm font-semibold" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Activation Options</p>

                      {/* Link property */}
                      <div>
                        <label className="text-sm font-medium block mb-1.5" style={{ color: CREAM, fontFamily: SANS }}>Link Property (optional)</label>
                        <select
                          value={form.propertyId}
                          onChange={e => setForm(u.id, { propertyId: e.target.value })}
                          className="w-full rounded-lg px-3 py-2.5 text-base border"
                          style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}
                        >
                          <option value="">— No property yet —</option>
                          {unlinkedProps.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.nickname} · {p.city}</option>
                          ))}
                        </select>
                      </div>

                      {/* Service tier */}
                      {form.propertyId && (
                        <div>
                          <label className="text-sm font-medium block mb-1.5" style={{ color: CREAM, fontFamily: SANS }}>Service Tier</label>
                          <div className="grid grid-cols-3 gap-2">
                            {tiers.map(t => (
                              <button
                                key={t.value}
                                onClick={() => setForm(u.id, { tier: t.value })}
                                className="px-3 py-2 rounded-lg text-sm font-medium border transition-all"
                                style={{
                                  background: form.tier === t.value ? `${TERRACOTTA}22` : "#141414",
                                  borderColor: form.tier === t.value ? TERRACOTTA : CARD_BORDER,
                                  color: form.tier === t.value ? TERRACOTTA : MUTED,
                                  fontFamily: SANS,
                                }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => activateMutation.mutate({
                            id: u.id,
                            propertyId: form.propertyId ? Number(form.propertyId) : undefined,
                            tier: form.tier || undefined,
                          })}
                          disabled={activateMutation.isPending}
                          className="flex-1 py-3 rounded-lg font-semibold text-base flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                          style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}
                        >
                          {activateMutation.isPending ? <Spinner /> : <UserCheck size={16} />}
                          Activate Account
                        </button>
                      </div>

                      {u.referred_by_code && (
                        <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>
                          Referred via code: <code style={{ color: SAGE }}>{u.referred_by_code}</code>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
