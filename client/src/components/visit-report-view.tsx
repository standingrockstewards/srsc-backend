/**
 * VisitReportView — renders a completed itemized inspection report.
 * Used in: admin Visit Reports page (expanded card), calendar event panel,
 * and the upcoming property detail activity tab.
 */
import { CheckCircle2, AlertTriangle, AlertCircle, MinusCircle, ImageOff } from "lucide-react";
import { CHECKLIST_MODULES } from "@/lib/checklist";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ReportPhoto = {
  id: number;
  report_id: number;
  filename: string;
  data_url: string;
  caption: string | null;
  item_key: string | null;
};

export type VisitReportData = {
  id: number;
  scheduled_visit_id: number;
  property_id: number;
  tech_id: number;
  note: string | null;
  overall_status: string;
  completed_at: string;
  checklist_data: Record<string, { status: string; note: string }> | null;
  photos: ReportPhoto[];
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; Icon: any }> = {
  ok:        { label: "OK",        color: "#4a9a6a", Icon: CheckCircle2 },
  attention: { label: "Attention", color: "#D9902B", Icon: AlertTriangle },
  issue:     { label: "Issue",     color: "#C05A43", Icon: AlertCircle },
  na:        { label: "N/A",       color: "#555",    Icon: MinusCircle },
};

const OVERALL_STATUS_CFG: Record<string, { label: string; color: string }> = {
  all_clear:       { label: "All Clear",       color: "#4a9a6a" },
  items_flagged:   { label: "Items Flagged",   color: "#D9902B" },
  action_required: { label: "Action Required", color: "#C05A43" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusChip({ status, small }: { status: string; small?: boolean }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return null;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
      style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}
    >
      <Icon size={small ? 9 : 11} />
      {cfg.label}
    </span>
  );
}

function PhotoThumbs({ photos }: { photos: ReportPhoto[] }) {
  if (!photos.length) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {photos.map(ph => (
        <div key={ph.id} className="relative rounded-lg overflow-hidden flex-shrink-0 group"
          style={{ width: 80, height: 60, background: "#111" }}>
          <img src={ph.data_url} alt={ph.filename} className="w-full h-full object-cover" />
          {ph.caption && (
            <div className="absolute bottom-0 inset-x-0 px-1 py-0.5" style={{ background: "rgba(0,0,0,0.7)" }}>
              <p className="text-[8px] text-white leading-tight truncate">{ph.caption}</p>
            </div>
          )}
        </div>
      ))}
      {photos.length > 1 && (
        <span className="text-[10px] self-center" style={{ color: "#555" }}>{photos.length} photos</span>
      )}
    </div>
  );
}

// ─── Module Section ───────────────────────────────────────────────────────────
function ModuleSection({
  moduleKey, moduleLabel, items, checklistData, photos,
}: {
  moduleKey: string;
  moduleLabel: string;
  items: import("@/lib/checklist").ChecklistItemDef[];
  checklistData: Record<string, { status: string; note: string }>;
  photos: ReportPhoto[];
}) {
  // Show items that have a status OR photos attached
  const filledItems = items.filter(item => {
    const key = `${moduleKey}.${item.key}`;
    const hasStatus = !!checklistData[key]?.status;
    const hasPhotos = photos.some(p => p.item_key === key);
    return hasStatus || hasPhotos;
  });

  if (!filledItems.length) return null;

  const hasIssues = filledItems.some(i => {
    const k = `${moduleKey}.${i.key}`;
    return checklistData[k]?.status === "issue" || checklistData[k]?.status === "attention";
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #252525" }}>
      {/* Module header */}
      <div className="flex items-center justify-between px-3 py-2.5"
        style={{ background: "#1e1e1e", borderBottom: "1px solid #252525" }}>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#7A8C6E" }}>
          {moduleLabel}
        </span>
        {hasIssues && (
          <span className="w-2 h-2 rounded-full" style={{ background: "#D9902B" }} />
        )}
      </div>

      {/* Items */}
      <div style={{ background: "#191919" }}>
        {filledItems.map((item, idx) => {
          const key = `${moduleKey}.${item.key}`;
          const result = checklistData[key];
          const itemPhotos = photos.filter(p => p.item_key === key);
          const cfg = STATUS_CFG[result.status];
          const isPFF = item.fieldType === "pass_flag_fail" || !item.fieldType;

          return (
            <div key={key}
              className={idx < filledItems.length - 1 ? "border-b" : ""}
              style={{ borderColor: "#252525", padding: "10px 12px" }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-snug flex-1" style={{ color: "#b0aaa3" }}>{item.label}</p>
                {isPFF && cfg && (
                  <StatusChip status={result.status} small />
                )}
                {!isPFF && result.note && (
                  <span className="text-xs font-mono" style={{ color: "#d0cec9" }}>{result.note}</span>
                )}
              </div>
              {isPFF && result.note && (
                <p className="text-xs mt-1" style={{ color: "#666" }}>{result.note}</p>
              )}
              <PhotoThumbs photos={itemPhotos} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function VisitReportView({ report, compact = false }: { report: VisitReportData; compact?: boolean }) {
  const overallCfg = OVERALL_STATUS_CFG[report.overall_status] ?? { label: report.overall_status, color: "#888" };
  const checklist = report.checklist_data ?? {};
  const hasChecklist = Object.keys(checklist).length > 0;

  // Build summary stats
  const statuses = Object.values(checklist).map(r => r.status);
  const okCount = statuses.filter(s => s === "ok").length;
  const attentionCount = statuses.filter(s => s === "attention").length;
  const issueCount = statuses.filter(s => s === "issue").length;
  const naCount = statuses.filter(s => s === "na").length;
  const totalCount = statuses.length;

  const unreferencedPhotos = report.photos.filter(p => !p.item_key);

  return (
    <div className="space-y-3">
      {/* Overall status + stats bar */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize"
          style={{ background: `${overallCfg.color}22`, color: overallCfg.color, border: `1px solid ${overallCfg.color}44` }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: overallCfg.color }} />
          {overallCfg.label}
        </span>
        {hasChecklist && (
          <div className="flex items-center gap-3 text-xs" style={{ color: "#555" }}>
            <span style={{ color: "#4a9a6a" }}>{okCount} OK</span>
            {attentionCount > 0 && <span style={{ color: "#D9902B" }}>{attentionCount} Attention</span>}
            {issueCount > 0 && <span style={{ color: "#C05A43" }}>{issueCount} Issue{issueCount !== 1 ? "s" : ""}</span>}
            {naCount > 0 && <span style={{ color: "#555" }}>{naCount} N/A</span>}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {hasChecklist && totalCount > 0 && (
        <div className="w-full rounded-full overflow-hidden h-1" style={{ background: "#252525" }}>
          <div className="flex h-full">
            <div style={{ width: `${(okCount / totalCount) * 100}%`, background: "#4a9a6a" }} />
            <div style={{ width: `${(attentionCount / totalCount) * 100}%`, background: "#D9902B" }} />
            <div style={{ width: `${(issueCount / totalCount) * 100}%`, background: "#C05A43" }} />
          </div>
        </div>
      )}

      {/* Issues / attention callout */}
      {(issueCount > 0 || attentionCount > 0) && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #C05A4333" }}>
          <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{ background: "#C05A4311", color: "#C05A43" }}>
            Needs Attention
          </div>
          <div className="divide-y" style={{ divideColor: "#252525" }}>
            {Object.entries(checklist)
              .filter(([, r]) => r.status === "attention" || r.status === "issue")
              .map(([key, r]) => {
                const [modKey, itemKey] = key.split(".");
                const mod = CHECKLIST_MODULES.find(m => m.key === modKey);
                const item = mod?.items.find(i => i.key === itemKey);
                return (
                  <div key={key} className="px-3 py-2 flex items-start gap-2" style={{ background: "#191919" }}>
                    <StatusChip status={r.status} small />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: "#d0cec9" }}>{item?.label ?? key}</p>
                      {r.note && <p className="text-[11px] mt-0.5" style={{ color: "#666" }}>{r.note}</p>}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Overall summary note */}
      {report.note && (
        <div className="rounded-xl p-3" style={{ background: "#1e1e1e", border: "1px solid #252525" }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#7A8C6E" }}>Summary Note</p>
          <p className="text-sm leading-relaxed" style={{ color: "#d0cec9" }}>{report.note}</p>
        </div>
      )}

      {/* Full itemized checklist (collapsed in compact mode) */}
      {!compact && hasChecklist && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#7A8C6E" }}>
            Full Inspection ({totalCount} items)
          </p>
          {CHECKLIST_MODULES.filter(m => m.key !== "summary").map(mod => (
            <ModuleSection
              key={mod.key}
              moduleKey={mod.key}
              moduleLabel={mod.label}
              items={mod.items}
              checklistData={checklist}
              photos={report.photos}
            />
          ))}
        </div>
      )}

      {/* Unreferenced photos (from old reports without item_key) */}
      {unreferencedPhotos.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#7A8C6E" }}>
            Photos ({unreferencedPhotos.length})
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {unreferencedPhotos.map(ph => (
              <div key={ph.id} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: "4/3", background: "#111" }}>
                <img src={ph.data_url} alt={ph.filename} className="w-full h-full object-cover" />
                {ph.caption && (
                  <div className="absolute bottom-0 inset-x-0 px-1.5 py-1" style={{ background: "rgba(0,0,0,0.65)" }}>
                    <p className="text-[9px] text-white leading-tight">{ph.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasChecklist && !report.note && unreferencedPhotos.length === 0 && (
        <div className="flex items-center gap-2 py-2" style={{ color: "#444" }}>
          <ImageOff size={14} />
          <span className="text-sm">No report data</span>
        </div>
      )}

      <div className="text-[10px]" style={{ color: "#444" }}>
        Completed {new Date(report.completed_at).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        })}
      </div>
    </div>
  );
}
