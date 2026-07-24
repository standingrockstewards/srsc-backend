/**
 * Admin — Referral Management
 * All referrals, statuses, reward notes.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Gift, CheckCircle2, RefreshCw, XCircle, Clock } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

function statusColor(s: string) {
  if (s === "converted") return SAGE;
  if (s === "signed_up") return "#d4b800";
  if (s === "rewarded") return "#7ab8e8";
  if (s === "voided") return TERRACOTTA;
  return MUTED;
}

function statusBg(s: string) {
  if (s === "converted") return `${SAGE}22`;
  if (s === "signed_up") return "#2a2a00";
  if (s === "rewarded") return "#0d2a3a";
  if (s === "voided") return `${TERRACOTTA}22`;
  return "#222";
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReferralsAdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ status: "", rewardNote: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: () => apiRequest("GET", "/api/referrals").then(r => r.json()),
    staleTime: 0,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => apiRequest("PATCH", `/api/referrals/${id}`, payload),
    onSuccess: () => {
      toast({ title: "Referral updated" });
      qc.invalidateQueries({ queryKey: ["admin-referrals"] });
      setEditingId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const referrals: any[] = data?.referrals ?? [];

  return (
    <AppLayout title="Referrals" subtitle="Client referral tracking">
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg" style={{ background: `${TERRACOTTA}22` }}>
            <Gift size={20} style={{ color: TERRACOTTA }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Referral Management</h1>
            <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>Track client referrals · update status · record rewards</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12">
            <RefreshCw size={16} className="animate-spin" style={{ color: MUTED }} />
          </div>
        )}

        {!isLoading && referrals.length === 0 && (
          <div className="text-center py-16 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <Gift size={40} style={{ color: MUTED, margin: "0 auto 12px" }} />
            <p style={{ color: MUTED, fontFamily: SANS }}>No referrals yet</p>
          </div>
        )}

        <div className="space-y-3">
          {referrals.map((r: any) => (
            <div key={r.id} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm" style={{ color: CREAM, fontFamily: SERIF }}>
                    Code: <span style={{ color: TERRACOTTA }}>{r.referral_code}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: MUTED, fontFamily: SANS }}>
                    Referrer ID: {r.referrer_client_id} · Referred: {r.referred_email ?? "pending"}
                  </p>
                  <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>
                    Created {fmtDate(r.created_at)} {r.converted_at ? `· Converted ${fmtDate(r.converted_at)}` : ""}
                  </p>
                  {r.reward_note && (
                    <p className="text-xs mt-1" style={{ color: SAGE, fontFamily: SANS }}>Reward: {r.reward_note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                    style={{ background: statusBg(r.status), color: statusColor(r.status) }}>
                    {r.status}
                  </span>
                  <button onClick={() => { setEditingId(r.id); setEditForm({ status: r.status, rewardNote: r.reward_note ?? "" }); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "#222", color: MUTED, fontFamily: SANS }}>
                    Edit
                  </button>
                </div>
              </div>

              {editingId === r.id && (
                <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: CARD_BORDER }}>
                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}>
                        <option value="pending">Pending</option>
                        <option value="signed_up">Signed Up</option>
                        <option value="converted">Converted</option>
                        <option value="rewarded">Rewarded</option>
                        <option value="voided">Voided</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Reward Note</label>
                      <input value={editForm.rewardNote} onChange={e => setEditForm(f => ({ ...f, rewardNote: e.target.value }))}
                        placeholder="e.g. $50 credit applied"
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateMutation.mutate({ id: r.id, status: editForm.status, rewardNote: editForm.rewardNote })}
                      disabled={updateMutation.isPending}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
                      style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                      {updateMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#222", color: MUTED, fontFamily: SANS }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
