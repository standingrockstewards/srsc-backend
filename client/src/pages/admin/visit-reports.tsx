/**
 * AdminVisitReports — lists completed itemized inspection reports.
 * Each card: expand full checklist · preview AAR email · re-send button.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, getApiBase } from "@/lib/queryClient";
import {
  CheckCircle2, ChevronDown, ChevronUp,
  Mail, Send, Eye, X, Loader2, CheckCheck,
} from "lucide-react";
import { VisitReportView, type VisitReportData } from "@/components/visit-report-view";

const OVERALL_STATUS_CFG: Record<string, { label: string; color: string }> = {
  all_clear:       { label: "All Clear",       color: "#4a9a6a" },
  items_flagged:   { label: "Items Flagged",   color: "#D9902B" },
  action_required: { label: "Action Required", color: "#C05A43" },
};

// ─── AAR PREVIEW MODAL ───────────────────────────────────────────────────────

function AARPreviewModal({
  reportId,
  onClose,
}: {
  reportId: number;
  onClose: () => void;
}) {
  const base = getApiBase();
  const previewUrl = `${base}/api/aar/preview/${reportId}`;

  const [sendTo, setSendTo] = useState("");
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await apiRequest("POST", `/api/aar/send/${reportId}`, sendTo ? { to: sendTo } : {});
      const data = await res.json();
      if (data.ok) {
        setSendResult({ ok: true, msg: `Sent to ${data.to}` });
      } else {
        setSendResult({ ok: false, msg: data.error ?? "Send failed" });
      }
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message ?? "Network error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="flex flex-col w-full max-w-3xl rounded-xl overflow-hidden"
        style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", maxHeight: "90vh" }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: "#161616", borderBottom: "1px solid #2e2e2e" }}
        >
          <div className="flex items-center gap-2">
            <Eye size={16} style={{ color: "#C05A43" }} />
            <span className="text-sm font-semibold" style={{ color: "#F5F0EA" }}>
              After-Action Report Preview
            </span>
            <span className="text-xs ml-1" style={{ color: "#555" }}>Report #{reportId}</span>
          </div>
          <button onClick={onClose} style={{ color: "#555" }} className="hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Send bar */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0 flex-wrap"
          style={{ background: "#1e1e1e", borderBottom: "1px solid #2e2e2e" }}
        >
          <Mail size={14} style={{ color: "#7A8C6E" }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#666" }}>
            Send Report
          </span>
          <input
            className="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-sm outline-none"
            style={{
              background: "#252525", border: "1px solid #333",
              color: "#F5F0EA", placeholder: "#555",
            }}
            placeholder="Override email (leave blank to send to property owner)"
            value={sendTo}
            onChange={e => setSendTo(e.target.value)}
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-opacity"
            style={{
              background: "#C05A43", color: "#fff",
              opacity: sending ? 0.6 : 1, cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        {/* Send result */}
        {sendResult && (
          <div
            className="flex items-center gap-2 px-5 py-2 text-sm flex-shrink-0"
            style={{
              background: sendResult.ok ? "#1a3a2a" : "#3a1a1a",
              color: sendResult.ok ? "#4ADE80" : "#F87171",
              borderBottom: "1px solid #2e2e2e",
            }}
          >
            {sendResult.ok ? <CheckCheck size={14} /> : <X size={14} />}
            {sendResult.msg}
          </div>
        )}

        {/* Email preview iframe */}
        <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
          <iframe
            src={previewUrl}
            title="AAR Email Preview"
            className="w-full h-full border-0"
            style={{ minHeight: "500px" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── REPORT CARD ─────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: VisitReportData }) {
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const sc = OVERALL_STATUS_CFG[report.overall_status] ?? { label: report.overall_status, color: "#888" };

  const checklist = report.checklist_data ?? {};
  const statuses = Object.values(checklist).map(r => r.status);
  const okCount = statuses.filter(s => s === "ok").length;
  const attentionCount = statuses.filter(s => s === "attention").length;
  const issueCount = statuses.filter(s => s === "issue").length;
  const totalCount = statuses.length;

  return (
    <>
      {showPreview && (
        <AARPreviewModal reportId={report.id} onClose={() => setShowPreview(false)} />
      )}

      <Card className="overflow-hidden" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
        {/* Collapsed header — clickable to expand */}
        <button className="w-full text-left" onClick={() => setExpanded(v => !v)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Status + stats row */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: `${sc.color}22`, color: sc.color, border: `1px solid ${sc.color}44` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.color }} />
                    {sc.label}
                  </span>
                  {totalCount > 0 && (
                    <span className="text-xs" style={{ color: "#555" }}>
                      {okCount} OK · {attentionCount} Attn · {issueCount} Issue{issueCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {report.photos.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#252525", color: "#7A8C6E" }}>
                      {report.photos.length} photo{report.photos.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Meta */}
                <p className="text-xs" style={{ color: "#555" }}>
                  Visit #{report.scheduled_visit_id} · Property #{report.property_id} ·{" "}
                  {new Date(report.completed_at).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                  })}
                </p>

                {/* Summary note preview */}
                {report.note && !expanded && (
                  <p className="text-sm mt-2 line-clamp-2" style={{ color: "#d0cec9", lineHeight: "1.55" }}>
                    {report.note}
                  </p>
                )}
                {!report.note && !expanded && totalCount === 0 && (
                  <p className="text-sm mt-1 italic" style={{ color: "#444" }}>No report data.</p>
                )}
              </div>
              <div className="flex-shrink-0" style={{ color: "#555" }}>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </CardContent>
        </button>

        {/* Expanded full report */}
        {expanded && (
          <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid #252525" }}>
            <VisitReportView report={report} />

            {/* AAR action bar */}
            <div
              className="mt-4 pt-4 flex items-center gap-3 flex-wrap"
              style={{ borderTop: "1px solid #252525" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#555" }}>
                After-Action Report
              </span>
              <button
                onClick={e => { e.stopPropagation(); setShowPreview(true); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: "#252525", color: "#F5F0EA", border: "1px solid #333" }}
              >
                <Eye size={13} />
                Preview Email
              </button>
              <button
                onClick={async e => {
                  e.stopPropagation();
                  try {
                    const res = await apiRequest("POST", `/api/aar/send/${report.id}`, {});
                    const data = await res.json();
                    if (data.ok) {
                      alert(`✓ Sent to ${data.to}`);
                    } else {
                      alert(`Send failed: ${data.error}`);
                    }
                  } catch (err: any) {
                    alert(`Send failed: ${err.message}`);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: "#C05A43", color: "#fff" }}
              >
                <Send size={13} />
                Send to Owner
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function AdminVisitReports() {
  const { data: reports = [], isLoading } = useQuery<VisitReportData[]>({
    queryKey: ["/api/visit-reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/visit-reports");
      return res.json();
    },
  });

  return (
    <AppLayout title="Visit Reports" subtitle="Itemized field inspection reports">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#252525" }} />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-20 text-center" style={{ color: "#555" }}>
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No visit reports filed yet.</p>
            <p className="text-xs mt-1" style={{ color: "#444" }}>
              Field staff complete visits from their dashboard to submit reports here.
            </p>
          </div>
        ) : (
          <>
            <div className="text-xs mb-3" style={{ color: "#555" }}>
              {reports.length} report{reports.length !== 1 ? "s" : ""} · tap to expand full inspection
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reports.map(r => <ReportCard key={r.id} report={r} />)}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
