/**
 * Property Task Rates tab (Admin property-detail page)
 * - Per-property pricing table that billing/quotes read for automated line items
 * - All rows editable inline at once; bulk-saved via PATCH
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  Edit2,
  Save,
  X,
  RefreshCw,
  Info,
  TrendingUp,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const MUTED = "#888";
const CARD_BG = "#1e1e1e";
const CARD_BG_ALT = "#1a1a1a";
const CARD_BORDER = "#2a2a2a";
const BORDER = "#222";
const INPUT_BG = "#252525";
const INPUT_BORDER = "#333";

type TaskType =
  | "storm_response"
  | "routine_inspection"
  | "launch_crew_base"
  | "dock_inspection"
  | "winterization"
  | "emergency_callout"
  | "vendor_coordination"
  | "photography";

type Unit = "per_visit" | "per_hour";

type TaskRate = {
  id?: number;
  property_id?: number;
  task_type: TaskType;
  rate: number;
  unit: Unit;
  notes: string;
  updated_at?: string;
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  storm_response: "Storm Response",
  routine_inspection: "Routine Inspection",
  launch_crew_base: "Launch Crew Base Rate",
  dock_inspection: "Dock Inspection",
  winterization: "Winterization",
  emergency_callout: "Emergency Callout",
  vendor_coordination: "Vendor Coordination Fee",
  photography: "Property Photography",
};

const TASK_TYPE_ORDER: TaskType[] = [
  "storm_response",
  "routine_inspection",
  "launch_crew_base",
  "dock_inspection",
  "winterization",
  "emergency_callout",
  "vendor_coordination",
  "photography",
];

const UNIT_LABELS: Record<Unit, string> = {
  per_visit: "per visit",
  per_hour: "per hour",
};

const DEFAULT_RATES: Record<TaskType, number> = {
  storm_response: 75,
  routine_inspection: 0,
  launch_crew_base: 150,
  dock_inspection: 85,
  winterization: 220,
  emergency_callout: 125,
  vendor_coordination: 45,
  photography: 60,
};

const DEFAULT_UNIT: Record<TaskType, Unit> = {
  storm_response: "per_visit",
  routine_inspection: "per_visit",
  launch_crew_base: "per_hour",
  dock_inspection: "per_visit",
  winterization: "per_visit",
  emergency_callout: "per_hour",
  vendor_coordination: "per_visit",
  photography: "per_visit",
};

function buildDefaultRows(): TaskRate[] {
  return TASK_TYPE_ORDER.map((task_type) => ({
    task_type,
    rate: DEFAULT_RATES[task_type],
    unit: DEFAULT_UNIT[task_type],
    notes: "",
  }));
}

function mergeWithDefaults(rows: TaskRate[]): TaskRate[] {
  const byType = new Map<TaskType, TaskRate>();
  for (const r of rows) byType.set(r.task_type, r);
  return TASK_TYPE_ORDER.map((task_type) => {
    const existing = byType.get(task_type);
    if (existing) {
      return {
        ...existing,
        rate: Number(existing.rate) || 0,
        unit: existing.unit === "per_hour" ? "per_hour" : "per_visit",
        notes: existing.notes ?? "",
      };
    }
    return {
      task_type,
      rate: DEFAULT_RATES[task_type],
      unit: DEFAULT_UNIT[task_type],
      notes: "",
    };
  });
}

export function PropertyTaskRatesTab({ propertyId }: { propertyId: number }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<TaskRate[]>(buildDefaultRows());
  const [showSaved, setShowSaved] = useState(false);

  const { data, isLoading, isFetching } = useQuery<TaskRate[]>({
    queryKey: [`/api/properties/${propertyId}/task-rates`],
    queryFn: async () =>
      (await apiRequest("GET", `/api/properties/${propertyId}/task-rates`)).json(),
    staleTime: 0,
  });

  useEffect(() => {
    if (data) setRows(mergeWithDefaults(data));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: TaskRate[]) => {
      const res = await apiRequest(
        "PATCH",
        `/api/properties/${propertyId}/task-rates/bulk`,
        payload.map(({ task_type, rate, unit, notes }) => ({
          task_type,
          rate: Number(rate) || 0,
          unit,
          notes: notes ?? "",
        })),
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/properties/${propertyId}/task-rates`],
      });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    },
  });

  function updateRow(task_type: TaskType, patch: Partial<TaskRate>) {
    setRows((prev) =>
      prev.map((r) => (r.task_type === task_type ? { ...r, ...patch } : r)),
    );
  }

  function handleResetToDefaults() {
    setRows(buildDefaultRows());
  }

  function handleSaveAll() {
    saveMutation.mutate(rows);
  }

  return (
    <div
      className="w-full"
      style={{ background: "#1C1C1C", color: CREAM, fontFamily: "'Source Sans 3', sans-serif" }}
    >
      {/* Header */}
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={20} style={{ color: TERRACOTTA }} />
          <h2
            className="text-xl md:text-2xl font-semibold"
            style={{ fontFamily: "'Playfair Display', serif", color: CREAM }}
          >
            Property Task Rates
          </h2>
        </div>
        <p className="text-sm" style={{ color: MUTED }}>
          Per-property pricing — billing reads these rates for automated line items.
        </p>
      </div>

      {/* Info box */}
      <div
        className="flex items-start gap-2 rounded-xl px-4 py-3 mb-5"
        style={{
          background: "rgba(217, 144, 43, 0.08)",
          border: "1px solid rgba(217, 144, 43, 0.35)",
        }}
      >
        <Info size={16} style={{ color: "#D9902B", marginTop: 2, flexShrink: 0 }} />
        <p className="text-sm" style={{ color: "#D9C7A0" }}>
          Quotes and billing read rates from this table. Changes apply to future billing only.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <RefreshCw size={28} className="animate-spin" style={{ color: TERRACOTTA }} />
          <p className="text-sm" style={{ color: MUTED }}>
            Loading task rates…
          </p>
        </div>
      ) : (
        <>
          {/* Rate rows */}
          <div className="flex flex-col gap-3">
            {rows.map((row) => {
              const isSubscriptionIncluded =
                row.task_type === "routine_inspection" && Number(row.rate) === 0;

              return (
                <div
                  key={row.task_type}
                  className="rounded-xl p-4"
                  style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                    {/* Task label */}
                    <div className="md:w-56 flex-shrink-0 flex items-center gap-2">
                      <TrendingUp size={15} style={{ color: SAGE, flexShrink: 0 }} />
                      <span
                        className="text-base md:text-lg"
                        style={{ fontFamily: "'Playfair Display', serif", color: CREAM }}
                      >
                        {TASK_TYPE_LABELS[row.task_type]}
                      </span>
                    </div>

                    {/* Rate */}
                    <div className="flex-shrink-0 w-full md:w-40">
                      <label className="block text-xs mb-1" style={{ color: MUTED }}>
                        Rate
                      </label>
                      {isSubscriptionIncluded ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
                            style={{ background: "rgba(122,140,110,0.18)", color: SAGE }}
                          >
                            Subscription included
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className="flex items-center justify-center rounded-lg px-2 py-2 text-sm"
                          style={{
                            background: INPUT_BG,
                            border: `1px solid ${INPUT_BORDER}`,
                            color: MUTED,
                          }}
                        >
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.rate}
                          onChange={(e) =>
                            updateRow(row.task_type, {
                              rate: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                          style={{
                            background: INPUT_BG,
                            border: `1px solid ${INPUT_BORDER}`,
                            color: CREAM,
                          }}
                        />
                      </div>
                    </div>

                    {/* Unit */}
                    <div className="flex-shrink-0 w-full md:w-36">
                      <label className="block text-xs mb-1" style={{ color: MUTED }}>
                        Unit
                      </label>
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          updateRow(row.task_type, { unit: e.target.value as Unit })
                        }
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{
                          background: INPUT_BG,
                          border: `1px solid ${INPUT_BORDER}`,
                          color: CREAM,
                        }}
                      >
                        <option value="per_visit">{UNIT_LABELS.per_visit}</option>
                        <option value="per_hour">{UNIT_LABELS.per_hour}</option>
                      </select>
                    </div>

                    {/* Notes */}
                    <div className="flex-1 w-full">
                      <label className="block text-xs mb-1" style={{ color: MUTED }}>
                        Notes
                      </label>
                      <input
                        type="text"
                        value={row.notes ?? ""}
                        onChange={(e) => updateRow(row.task_type, { notes: e.target.value })}
                        placeholder="Optional note…"
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={{
                          background: INPUT_BG,
                          border: `1px solid ${INPUT_BORDER}`,
                          color: CREAM,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mt-6 pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saveMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: TERRACOTTA, color: "#fff" }}
            >
              {saveMutation.isPending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save All Changes
            </button>

            <button
              type="button"
              onClick={handleResetToDefaults}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
              style={{
                background: "transparent",
                border: `1px solid ${INPUT_BORDER}`,
                color: CREAM,
              }}
            >
              <RefreshCw size={16} />
              Reset to Defaults
            </button>

            {isFetching && !isLoading && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <RefreshCw size={12} className="animate-spin" />
                Refreshing…
              </span>
            )}

            {showSaved && (
              <span
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: SAGE }}
              >
                <Save size={14} />
                Rates saved successfully
              </span>
            )}

            {saveMutation.isError && (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#C05A43" }}>
                <X size={14} />
                Failed to save changes. Please try again.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PropertyTaskRatesTab;
