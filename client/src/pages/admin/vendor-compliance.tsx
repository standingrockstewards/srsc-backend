/**
 * Admin — Vendor Compliance & Document Gate
 * Shows COI / W-9 / Vendor Agreement status per vendor.
 * Blocks payout indicator if not all verified.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldAlert, Upload, CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, Banknote } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

function StatusBadge({ verified, status }: { verified: boolean; status?: string }) {
  if (verified) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${SAGE}22`, color: SAGE }}>
      <CheckCircle2 size={11} /> Verified
    </span>
  );
  if (status === "submitted") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#2a2a00", color: "#d4b800" }}>
      <Clock size={11} /> Pending Review
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA }}>
      <XCircle size={11} /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#222", color: MUTED }}>
      <Clock size={11} /> Not Submitted
    </span>
  );
}

function VendorComplianceCard({ vendor }: { vendor: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState<Record<number, string>>({});

  const { data } = useQuery({
    queryKey: ["vendor-compliance", vendor.id],
    queryFn: () => apiRequest("GET", `/api/vendors/${vendor.id}/compliance`).then(r => r.json()),
    staleTime: 0,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ docId, status, notes }: { docId: number; status: string; notes: string }) =>
      apiRequest("PATCH", `/api/vendors/${vendor.id}/documents/${docId}/verify`, { status, reviewNotes: notes }),
    onSuccess: () => {
      toast({ title: "Document updated" });
      qc.invalidateQueries({ queryKey: ["vendor-compliance", vendor.id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const gates: any[] = data?.gates ?? [];
  const payoutAllowed = data?.payoutAllowed ?? false;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${payoutAllowed ? `${SAGE}33` : CARD_BORDER}` }}>
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: payoutAllowed ? `${SAGE}22` : `${TERRACOTTA}22` }}>
            {payoutAllowed ? <ShieldCheck size={18} style={{ color: SAGE }} /> : <ShieldAlert size={18} style={{ color: TERRACOTTA }} />}
          </div>
          <div className="text-left">
            <p className="font-semibold text-base" style={{ color: CREAM, fontFamily: SERIF }}>{vendor.name}</p>
            <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>{vendor.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: payoutAllowed ? `${SAGE}15` : `${TERRACOTTA}15` }}>
            <Banknote size={14} style={{ color: payoutAllowed ? SAGE : TERRACOTTA }} />
            <span className="text-xs font-semibold" style={{ color: payoutAllowed ? SAGE : TERRACOTTA, fontFamily: SANS }}>
              Payout {payoutAllowed ? "Allowed" : "Blocked"}
            </span>
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: MUTED }} /> : <ChevronDown size={16} style={{ color: MUTED }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t space-y-3" style={{ borderColor: CARD_BORDER }}>
          <p className="text-xs font-semibold mt-3" style={{ color: MUTED, fontFamily: SANS, textTransform: "uppercase", letterSpacing: "0.05em" }}>Required Documents</p>
          {gates.map((gate: any) => (
            <div key={gate.category} className="rounded-lg p-3" style={{ background: "#141414", border: `1px solid ${CARD_BORDER}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: CREAM, fontFamily: SANS }}>{gate.label}</p>
                <StatusBadge verified={gate.verified} status={gate.doc?.status} />
              </div>
              {gate.doc && (
                <p className="text-xs mb-2" style={{ color: MUTED, fontFamily: SANS }}>
                  Submitted: {gate.doc.file_name ?? gate.doc.title}
                  {gate.doc.review_notes && <> · <span style={{ color: TERRACOTTA }}>{gate.doc.review_notes}</span></>}
                </p>
              )}
              {gate.doc && gate.doc.status === "submitted" && (
                <div className="flex flex-col gap-2">
                  <input
                    value={verifyNotes[gate.doc.id] ?? ""}
                    onChange={e => setVerifyNotes(n => ({ ...n, [gate.doc.id]: e.target.value }))}
                    placeholder="Optional review note"
                    className="px-3 py-1.5 rounded text-xs border w-full"
                    style={{ background: "#1a1a1a", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => verifyMutation.mutate({ docId: gate.doc.id, status: "verified", notes: verifyNotes[gate.doc.id] ?? "" })}
                      className="flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ background: `${SAGE}22`, color: SAGE, fontFamily: SANS }}
                    >
                      <CheckCircle2 size={11} /> Verify
                    </button>
                    <button
                      onClick={() => verifyMutation.mutate({ docId: gate.doc.id, status: "rejected", notes: verifyNotes[gate.doc.id] ?? "" })}
                      className="flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1"
                      style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA, fontFamily: SANS }}
                    >
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VendorCompliancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["vendors-list"],
    queryFn: () => apiRequest("GET", "/api/vendors").then(r => r.json()),
    staleTime: 0,
  });

  const vendors: any[] = data ?? [];

  return (
    <AppLayout title="Vendor Compliance" subtitle="Document gate & payout eligibility">
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg" style={{ background: `${TERRACOTTA}22` }}>
            <ShieldCheck size={20} style={{ color: TERRACOTTA }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Vendor Compliance</h1>
            <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>COI · W-9 · Vendor Agreement — all required before payout</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12">
            <RefreshCw size={16} className="animate-spin" style={{ color: MUTED }} />
            <span style={{ color: MUTED, fontFamily: SANS }}>Loading…</span>
          </div>
        )}

        {!isLoading && vendors.length === 0 && (
          <div className="text-center py-16 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <ShieldCheck size={40} style={{ color: MUTED, margin: "0 auto 12px" }} />
            <p style={{ color: MUTED, fontFamily: SANS }}>No vendors found</p>
          </div>
        )}

        <div className="space-y-3">
          {vendors.map((v: any) => <VendorComplianceCard key={v.id} vendor={v} />)}
        </div>
      </div>
    </AppLayout>
  );
}
