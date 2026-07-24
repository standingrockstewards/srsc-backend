/**
 * CompleteVisitModal — Multi-step itemized inspection form.
 * Step 1: Module tabs (exterior, security, dock, watercraft, etc.)
 * Step 2: Per-item status (OK / Attention / Issue) + note + photos
 * Step 3: Overall summary + submit
 */
import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Camera, CheckCircle2, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Home, ShieldCheck, Anchor, Ship, DoorOpen, Zap, Flame, Droplets, ArrowUpFromLine,
  ClipboardCheck, Trash2, ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { CHECKLIST_MODULES, getActiveModules, type ChecklistModule } from "@/lib/checklist";
import type { Property } from "../../../../shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ScheduledVisitSummary = {
  id: number;
  propertyId: number;
  propertyName: string;
  scheduledDate: string;
  scheduledTime?: string;
  visitType?: string;
};

type ItemStatus = "ok" | "attention" | "issue" | "na" | "";

type ItemResult = {
  status: ItemStatus;
  note: string;
  photos: PhotoEntry[];
};

type ChecklistData = Record<string, ItemResult>; // key = "module.item"

type PhotoEntry = {
  id: string;
  filename: string;
  dataUrl: string;
  caption: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTS: { value: ItemStatus; label: string; color: string; bg: string; Icon: any }[] = [
  { value: "ok",        label: "OK",        color: "#4a9a6a", bg: "#4a9a6a22", Icon: CheckCircle2 },
  { value: "attention", label: "Attention", color: "#D9902B", bg: "#D9902B22", Icon: AlertTriangle },
  { value: "issue",     label: "Issue",     color: "#C05A43", bg: "#C05A4322", Icon: AlertCircle },
  { value: "na",        label: "N/A",       color: "#555",    bg: "#55555522", Icon: CheckCircle2 },
];

const OVERALL_STATUS_OPTS = [
  { value: "all_clear",       label: "All Clear",       color: "#4a9a6a" },
  { value: "items_flagged",   label: "Items Flagged",   color: "#D9902B" },
  { value: "action_required", label: "Action Required", color: "#C05A43" },
];

const MODULE_ICONS: Record<string, any> = {
  exterior:   Home,
  security:   ShieldCheck,
  dock:       Anchor,
  watercraft: Ship,
  boat_lift:  ArrowUpFromLine,
  interior:   DoorOpen,
  generator:  Zap,
  propane:    Flame,
  irrigation: Droplets,
  summary:    ClipboardCheck,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function moduleCompletionCount(mod: ChecklistModule, data: ChecklistData): { done: number; total: number; hasIssue: boolean } {
  const nonSummary = mod.items.filter(i => i.fieldType === "pass_flag_fail" || !i.fieldType);
  const done = nonSummary.filter(i => {
    const key = `${mod.key}.${i.key}`;
    return !!data[key]?.status;
  }).length;
  const hasIssue = nonSummary.some(i => {
    const key = `${mod.key}.${i.key}`;
    const s = data[key]?.status;
    return s === "attention" || s === "issue";
  });
  return { done, total: nonSummary.length, hasIssue };
}

// ─── Photo Strip ──────────────────────────────────────────────────────────────
function PhotoStrip({ photos, onAdd, onRemove, onCaptionChange, max = 5, showProofPrompt = false }: {
  photos: PhotoEntry[];
  onAdd: (entries: PhotoEntry[]) => void;
  onRemove: (id: string) => void;
  onCaptionChange: (id: string, cap: string) => void;
  max?: number;
  showProofPrompt?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function handleFiles(files: FileList) {
    const rem = max - photos.length;
    const toProcess = Array.from(files).slice(0, rem);
    Promise.all(toProcess.map(file => new Promise<PhotoEntry>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: `${Date.now()}-${Math.random()}`,
        filename: file.name,
        dataUrl: reader.result as string,
        caption: "",
      });
      reader.readAsDataURL(file);
    }))).then(onAdd);
  }

  return (
    <div>
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {photos.map(ph => (
            <div key={ph.id} className="relative rounded-lg overflow-hidden group flex-shrink-0"
              style={{ width: 72, height: 54, background: "#111" }}>
              <img src={ph.preview ?? ph.dataUrl} alt={ph.filename} className="w-full h-full object-cover" />
              <button type="button" className="absolute top-0.5 right-0.5 rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                style={{ background: "rgba(0,0,0,0.7)" }}
                onClick={() => onRemove(ph.id)}>
                <Trash2 size={9} style={{ color: "#fff" }} />
              </button>
            </div>
          ))}
          {photos.length < max && (
            <button type="button" className="rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ width: 72, height: 54, background: "#252525", border: "1px dashed #444" }}
              onClick={() => ref.current?.click()}>
              <ImagePlus size={14} style={{ color: "#7A8C6E" }} />
            </button>
          )}
        </div>
      )}
      {photos.length === 0 && (
        <button type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mt-2 transition-opacity hover:opacity-80"
          style={showProofPrompt
            ? { background: "#4a9a6a18", border: "1px dashed #4a9a6a55", color: "#4a9a6a" }
            : { background: "#252525", border: "1px solid #333", color: "#7A8C6E" }}
          onClick={() => ref.current?.click()}>
          <Camera size={12} />
          {showProofPrompt ? "Add proof photo — good standing" : "Add photo"}
        </button>
      )}
      <input ref={ref} type="file" multiple accept="image/*" className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)} />
    </div>
  );
}

// ─── Single Checklist Item Row ────────────────────────────────────────────────
// Photos are available on EVERY item regardless of status — good conditions
// deserve documentation too (proof of standing).
function ChecklistItemRow({ moduleKey, item, result, onChange }: {
  moduleKey: string;
  item: import("@/lib/checklist").ChecklistItemDef;
  result: ItemResult;
  onChange: (key: string, r: ItemResult) => void;
}) {
  const key = `${moduleKey}.${item.key}`;
  const [showNote, setShowNote] = useState(!!result.note);

  const isPFF = item.fieldType === "pass_flag_fail" || !item.fieldType;
  const isText = item.fieldType === "text" || item.fieldType === "date" || item.fieldType === "number";
  const isSelect = item.fieldType === "select";

  function set(partial: Partial<ItemResult>) {
    onChange(key, { ...result, ...partial });
  }

  const statusOpt = STATUS_OPTS.find(o => o.value === result.status);

  return (
    <div className="py-3 border-b last:border-0" style={{ borderColor: "#252525" }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: "#e8e4de" }}>{item.label}</p>

          {/* Pass/Flag/Fail buttons */}
          {isPFF && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {STATUS_OPTS.map(opt => (
                <button key={opt.value} type="button"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
                  style={result.status === opt.value
                    ? { background: opt.bg, color: opt.color, border: `1.5px solid ${opt.color}` }
                    : { background: "#1e1e1e", color: "#555", border: "1.5px solid #333" }}
                  onClick={() => set({ status: opt.value })}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Text / number / date input */}
          {isText && (
            <input
              type={item.fieldType === "number" ? "number" : item.fieldType === "date" ? "date" : "text"}
              className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              placeholder={item.key === "weather_temp" ? "e.g. 78" : ""}
              value={result.note}
              onChange={e => set({ note: e.target.value, status: "ok" })}
            />
          )}

          {/* Select */}
          {isSelect && (
            <select
              className="mt-2 w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              value={result.note}
              onChange={e => set({ note: e.target.value, status: "ok" })}>
              <option value="">Select…</option>
              {(item.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}

          {/* Expandable note (all PFF items) */}
          {isPFF && (
            <>
              {!showNote && (
                <button type="button" className="text-xs mt-1.5 underline"
                  style={{ color: "#7A8C6E" }}
                  onClick={() => setShowNote(true)}>
                  + Add note
                </button>
              )}
              {showNote && (
                <textarea rows={2}
                  className="mt-2 w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                  style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
                  placeholder="Note (optional)…"
                  value={result.note}
                  onChange={e => set({ note: e.target.value })}
                />
              )}
            </>
          )}

          {/* Photos — available on ALL items regardless of status.
              Good conditions deserve documentation too (proof of good standing). */}
          {result.status !== "na" && (
            <div className="mt-2">
              <PhotoStrip
                photos={result.photos}
                onAdd={newPhotos => set({ photos: [...result.photos, ...newPhotos] })}
                onRemove={id => set({ photos: result.photos.filter(p => p.id !== id) })}
                onCaptionChange={(id, cap) => set({ photos: result.photos.map(p => p.id === id ? { ...p, caption: cap } : p) })}
                max={5}
                showProofPrompt={result.status === "ok"}
              />
            </div>
          )}
        </div>

        {/* Status indicator dot */}
        {isPFF && statusOpt && (
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: statusOpt.color }} />
        )}
      </div>
    </div>
  );
}

// ─── Module Panel ─────────────────────────────────────────────────────────────
function ModulePanel({ mod, data, onChange }: {
  mod: ChecklistModule;
  data: ChecklistData;
  onChange: (key: string, r: ItemResult) => void;
}) {
  return (
    <div className="divide-y" style={{ divideColor: "#252525" }}>
      {mod.items.map(item => {
        const key = `${mod.key}.${item.key}`;
        const result: ItemResult = data[key] ?? { status: "", note: "", photos: [] };
        return (
          <ChecklistItemRow
            key={key}
            moduleKey={mod.key}
            item={item}
            result={result}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}

// ─── Main Modal ───────────���───────────────────────────────────────────────────
export function CompleteVisitModal({ visit, techId, onClose }: {
  visit: ScheduledVisitSummary;
  techId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // Fetch property to know which conditional modules to show
  const { data: property } = useQuery<Property>({
    queryKey: ["/api/properties", visit.propertyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/properties/${visit.propertyId}`);
      return res.json();
    },
  });

  const activeModules = property ? getActiveModules(property) : CHECKLIST_MODULES.filter(m => !m.conditional);

  const [step, setStep] = useState<"checklist" | "summary" | "success">("checklist");
  const [activeModIdx, setActiveModIdx] = useState(0);
  const [data, setData] = useState<ChecklistData>({});
  const [overallStatus, setOverallStatus] = useState("all_clear");
  const [summaryNote, setSummaryNote] = useState("");

  // Modules excluding "summary" (handled in step 2)
  const checklistModules = activeModules.filter(m => m.key !== "summary");
  const activeMod = checklistModules[activeModIdx];

  function setItem(key: string, result: ItemResult) {
    setData(prev => ({ ...prev, [key]: result }));
  }

  // Auto-derive overall status from items
  function deriveStatus(): string {
    const vals = Object.values(data).map(r => r.status);
    if (vals.some(s => s === "issue")) return "action_required";
    if (vals.some(s => s === "attention")) return "items_flagged";
    return "all_clear";
  }

  // When moving to summary, auto-set overall status
  function goToSummary() {
    setOverallStatus(deriveStatus());
    setStep("summary");
  }

  const submit = useMutation({
    mutationFn: async () => {
      // Flatten all photos across all items into the photos array
      const allPhotos: { filename: string; dataUrl: string; caption?: string; itemKey: string }[] = [];
      const cleanData: Record<string, { status: string; note: string }> = {};

      for (const [key, result] of Object.entries(data)) {
        cleanData[key] = { status: result.status, note: result.note };
        for (const photo of result.photos ?? []) {
          allPhotos.push({
            filename: photo.filename,
            dataUrl: photo.dataUrl,
            caption: photo.caption,
            itemKey: key,
          });
        }
      }

      return apiRequest("POST", `/api/scheduled/${visit.id}/report`, {
        note: summaryNote,
        overallStatus,
        techId,
        propertyId: visit.propertyId,
        checklistData: cleanData,
        photos: allPhotos,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/scheduled"] });
      qc.invalidateQueries({ queryKey: ["/api/visit-reports"] });
      setStep("success");
    },
  });

  // ── Completion stats ──
  const totalItems = checklistModules.reduce((sum, m) => sum + m.items.filter(i => i.fieldType === "pass_flag_fail" || !i.fieldType).length, 0);
  const doneItems = checklistModules.reduce((sum, m) => {
    return sum + m.items.filter(i => {
      const k = `${m.key}.${i.key}`;
      return (i.fieldType === "pass_flag_fail" || !i.fieldType) && !!data[k]?.status;
    }).length;
  }, 0);
  const issueCount = Object.values(data).filter(r => r.status === "issue").length;
  const attentionCount = Object.values(data).filter(r => r.status === "attention").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full sm:max-w-lg lg:max-w-4xl rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl"
        style={{ background: "#141414", border: "1px solid #2a2a2a", maxHeight: "95vh" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid #222" }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#7A8C6E" }}>
              {step === "checklist" ? "Inspection Checklist" : step === "summary" ? "Summary & Submit" : "Complete"}
            </div>
            <div className="font-bold text-base leading-tight" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
              {visit.propertyName}
            </div>
            <div className="text-[11px]" style={{ color: "#555" }}>
              {visit.scheduledDate}{visit.scheduledTime ? ` · ${visit.scheduledTime}` : ""} · {(visit.visitType ?? "routine").replace(/_/g, " ")}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: "#555" }} />
          </button>
        </div>

        {/* ── Success ── */}
        {step === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#4a9a6a22" }}>
              <CheckCircle2 size={32} style={{ color: "#4a9a6a" }} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg mb-1" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
                Inspection Complete
              </h3>
              <p className="text-sm" style={{ color: "#888" }}>
                {doneItems} items checked · {issueCount} issue{issueCount !== 1 ? "s" : ""} · {attentionCount} attention
              </p>
            </div>
            <Button className="w-full font-semibold" style={{ background: "#C05A43", color: "#fff" }} onClick={onClose}>
              Done
            </Button>
          </div>
        )}

        {/* ── Checklist step ── */}
        {step === "checklist" && activeMod && (
          <>
            {/* Progress bar (full-width, always) */}
            <div className="h-0.5 flex-shrink-0" style={{ background: "#1a1a1a" }}>
              <div className="h-full transition-all" style={{
                width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%`,
                background: issueCount > 0 ? "#C05A43" : attentionCount > 0 ? "#D9902B" : "#4a9a6a",
              }} />
            </div>

            {/* Mobile: horizontal tab bar */}
            <div className="lg:hidden flex-shrink-0 overflow-x-auto px-2 pt-2 pb-0" style={{ borderBottom: "1px solid #222" }}>
              <div className="flex gap-1 pb-2 min-w-max">
                {checklistModules.map((mod, midx) => {
                  const { done, total, hasIssue } = moduleCompletionCount(mod, data);
                  const Icon = MODULE_ICONS[mod.key] ?? ClipboardCheck;
                  const isActive = midx === activeModIdx;
                  return (
                    <button key={mod.key} type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-all"
                      style={isActive
                        ? { background: "#C05A4322", color: "#C05A43", border: "1.5px solid #C05A43" }
                        : { background: "#1e1e1e", color: "#555", border: "1.5px solid #2a2a2a" }}
                      onClick={() => setActiveModIdx(midx)}>
                      <Icon size={11} />
                      {mod.label}
                      {done > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: hasIssue ? "#C05A43" : done === total ? "#4a9a6a" : "#D9902B" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop + Mobile: content area */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Desktop: vertical module sidebar */}
              <div className="hidden lg:flex flex-col flex-shrink-0 overflow-y-auto py-2"
                style={{ width: "200px", background: "#111", borderRight: "1px solid #222" }}>
                {checklistModules.map((mod, midx) => {
                  const { done, total, hasIssue } = moduleCompletionCount(mod, data);
                  const Icon = MODULE_ICONS[mod.key] ?? ClipboardCheck;
                  const isActive = midx === activeModIdx;
                  return (
                    <button key={mod.key} type="button"
                      className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-left w-full transition-all"
                      style={isActive
                        ? { background: "#C05A4318", color: "#C05A43", borderLeft: "3px solid #C05A43", paddingLeft: "9px" }
                        : { color: "#666", borderLeft: "3px solid transparent", paddingLeft: "9px" }}
                      onClick={() => setActiveModIdx(midx)}>
                      <Icon size={13} className="flex-shrink-0" />
                      <span className="flex-1 leading-tight">{mod.label}</span>
                      {done > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: hasIssue ? "#C05A43" : done === total ? "#4a9a6a" : "#D9902B" }} />
                      )}
                    </button>
                  );
                })}
                {/* Progress summary in sidebar */}
                <div className="mt-auto px-3 py-3 border-t" style={{ borderColor: "#222" }}>
                  <div className="text-xs" style={{ color: "#444" }}>{doneItems}/{totalItems} items</div>
                  {attentionCount > 0 && <div className="text-xs mt-0.5" style={{ color: "#D9902B" }}>{attentionCount} attention</div>}
                  {issueCount > 0 && <div className="text-xs mt-0.5" style={{ color: "#C05A43" }}>{issueCount} issues</div>}
                </div>
              </div>

              {/* Item content */}
              <div className="flex-1 min-w-0 overflow-y-auto px-4">
                <ModulePanel mod={activeMod} data={data} onChange={setItem} />
              </div>
            </div>

            {/* Nav footer */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
              style={{ borderTop: "1px solid #222" }}>
              <div className="text-xs lg:hidden" style={{ color: "#444" }}>
                {doneItems}/{totalItems} items
              </div>
              <div className="flex gap-2 ml-auto">
                {activeModIdx > 0 && (
                  <Button variant="ghost" size="sm" style={{ color: "#666" }}
                    onClick={() => setActiveModIdx(i => i - 1)}>
                    <ChevronLeft size={14} className="mr-1" /> Back
                  </Button>
                )}
                {activeModIdx < checklistModules.length - 1 ? (
                  <Button size="sm" style={{ background: "#C05A43", color: "#fff" }}
                    onClick={() => setActiveModIdx(i => i + 1)}>
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" style={{ background: "#C05A43", color: "#fff" }}
                    onClick={goToSummary}>
                    Review & Submit <ChevronRight size={14} className="ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Summary step ── */}
        {step === "summary" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Checked", value: doneItems, color: "#4a9a6a" },
                  { label: "Attention", value: attentionCount, color: "#D9902B" },
                  { label: "Issues", value: issueCount, color: "#C05A43" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
                    <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: "'Playfair Display', serif" }}>
                      {s.value}
                    </div>
                    <div className="text-[11px]" style={{ color: "#555" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Flagged items summary */}
              {(issueCount > 0 || attentionCount > 0) && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2a2a2a" }}>
                  <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{ background: "#1e1e1e", color: "#7A8C6E" }}>
                    Flagged Items
                  </div>
                  <div className="divide-y" style={{ divideColor: "#252525" }}>
                    {Object.entries(data)
                      .filter(([, r]) => r.status === "attention" || r.status === "issue")
                      .map(([key, r]) => {
                        const [modKey, itemKey] = key.split(".");
                        const mod = CHECKLIST_MODULES.find(m => m.key === modKey);
                        const item = mod?.items.find(i => i.key === itemKey);
                        const sOpt = STATUS_OPTS.find(o => o.value === r.status)!;
                        return (
                          <div key={key} className="px-3 py-2 flex items-start gap-2" style={{ background: "#191919" }}>
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: sOpt.color }} />
                            <div>
                              <span className="text-xs font-semibold" style={{ color: sOpt.color }}>{sOpt.label}</span>
                              <span className="text-xs ml-2" style={{ color: "#d0cec9" }}>{item?.label ?? key}</span>
                              {r.note && <p className="text-xs mt-0.5" style={{ color: "#777" }}>{r.note}</p>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Overall status override */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-2" style={{ color: "#7A8C6E" }}>
                  Overall Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {OVERALL_STATUS_OPTS.map(opt => (
                    <button key={opt.value} type="button"
                      className="rounded-xl py-2.5 text-xs font-semibold text-center transition-all"
                      style={overallStatus === opt.value
                        ? { background: `${opt.color}22`, color: opt.color, border: `1.5px solid ${opt.color}` }
                        : { background: "#1e1e1e", color: "#555", border: "1.5px solid #2a2a2a" }}
                      onClick={() => setOverallStatus(opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary note */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-2" style={{ color: "#7A8C6E" }}>
                  Overall Summary Note
                </label>
                <textarea rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#F5F0EA", lineHeight: "1.6" }}
                  placeholder="General observations, anything not captured in individual items…"
                  value={summaryNote}
                  onChange={e => setSummaryNote(e.target.value)}
                />
              </div>

              {submit.isError && (
                <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: "#C05A4322", border: "1px solid #C05A4344" }}>
                  <AlertCircle size={14} style={{ color: "#C05A43" }} />
                  <span className="text-xs" style={{ color: "#C05A43" }}>Failed to save. Please try again.</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid #222" }}>
              <Button variant="ghost" className="flex-1" style={{ color: "#555" }}
                onClick={() => setStep("checklist")}>
                <ChevronLeft size={14} className="mr-1" /> Edit
              </Button>
              <Button className="flex-grow font-semibold gap-2" style={{ background: "#C05A43", color: "#fff" }}
                disabled={submit.isPending}
                onClick={() => submit.mutate()}>
                {submit.isPending
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Saving…</span>
                  : <><CheckCircle2 size={15} /> Complete Visit</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
