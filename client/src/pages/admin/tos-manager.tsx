/**
 * Admin — ToS Version Manager
 * View/publish ToS versions, see acceptance log.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, CheckCircle2, RefreshCw, Clock } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TosManagerPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ versionLabel: "", body: "", effectiveDate: new Date().toISOString().split("T")[0], makeCurrent: true });

  const { data, isLoading } = useQuery({
    queryKey: ["tos-versions"],
    queryFn: () => apiRequest("GET", "/api/tos/versions").then(r => r.json()),
    staleTime: 0,
  });

  const publishMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/tos/versions", form),
    onSuccess: () => {
      toast({ title: "ToS version published", description: form.makeCurrent ? "All clients will be prompted to re-accept." : undefined });
      qc.invalidateQueries({ queryKey: ["tos-versions"] });
      setForm({ versionLabel: "", body: "", effectiveDate: new Date().toISOString().split("T")[0], makeCurrent: true });
      setShowNew(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const versions: any[] = data?.versions ?? [];

  return (
    <AppLayout title="Terms of Service" subtitle="Version management">
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: `${TERRACOTTA}22` }}>
              <FileText size={20} style={{ color: TERRACOTTA }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: CREAM, fontFamily: SERIF }}>Terms of Service</h1>
              <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>Publish new versions · track client acceptances</p>
            </div>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: showNew ? `${TERRACOTTA}22` : TERRACOTTA, color: showNew ? TERRACOTTA : CREAM, fontFamily: SANS }}
          >
            <Plus size={15} /> New Version
          </button>
        </div>

        {/* New version form */}
        {showNew && (
          <div className="rounded-xl p-5 mb-5" style={{ background: CARD_BG, border: `1px solid ${TERRACOTTA}33` }}>
            <p className="text-base font-semibold mb-4" style={{ color: CREAM, fontFamily: SERIF }}>Publish New ToS Version</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Version Label</label>
                  <input value={form.versionLabel} onChange={e => setForm(f => ({ ...f, versionLabel: e.target.value }))}
                    placeholder="v2.0 — 2026-07-23"
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Effective Date</label>
                  <input type="date" value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>ToS Body (Markdown supported)</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={8} placeholder="Paste attorney-approved ToS text here…"
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono resize-y"
                  style={{ background: "#141414", color: CREAM, borderColor: CARD_BORDER }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.makeCurrent} onChange={e => setForm(f => ({ ...f, makeCurrent: e.target.checked }))}
                  className="w-4 h-4 accent-orange-600" />
                <span className="text-sm" style={{ color: CREAM, fontFamily: SANS }}>Make this the current version (clients prompted to re-accept at next login)</span>
              </label>
              <button onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || !form.versionLabel || !form.body}
                className="w-full py-3 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
                style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}>
                {publishMutation.isPending ? <><RefreshCw size={15} className="animate-spin" /> Publishing…</> : <><CheckCircle2 size={15} /> Publish Version</>}
              </button>
            </div>
          </div>
        )}

        {/* Version list */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12">
            <RefreshCw size={16} className="animate-spin" style={{ color: MUTED }} />
          </div>
        )}

        <div className="space-y-3">
          {versions.map((v: any) => (
            <div key={v.id} className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${v.is_current ? `${SAGE}44` : CARD_BORDER}` }}>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={16} style={{ color: v.is_current ? SAGE : MUTED }} />
                  <div>
                    <p className="font-semibold text-sm" style={{ color: CREAM, fontFamily: SERIF }}>{v.version_label}</p>
                    <p className="text-xs" style={{ color: MUTED, fontFamily: SANS }}>
                      <Clock size={11} className="inline mr-0.5" />Effective {fmtDate(v.effective_date)} · Published {fmtDate(v.created_at)}
                    </p>
                  </div>
                </div>
                {v.is_current && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${SAGE}22`, color: SAGE }}>
                    Current
                  </span>
                )}
              </div>
              <div className="px-4 pb-3">
                <p className="text-xs leading-relaxed line-clamp-3" style={{ color: MUTED, fontFamily: SANS }}>
                  {v.body?.split("\n").find((l: string) => l.trim() && !l.startsWith("#") && !l.startsWith(">")) ?? ""}
                </p>
              </div>
            </div>
          ))}

          {!isLoading && versions.length === 0 && (
            <div className="text-center py-12 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <FileText size={32} style={{ color: MUTED, margin: "0 auto 10px" }} />
              <p style={{ color: MUTED, fontFamily: SANS }}>No ToS versions yet</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
