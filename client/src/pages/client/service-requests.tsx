/**
 * Service Requests — client view
 * Submit on-demand Launch Crew / service requests, track status.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Wrench, Plus, ChevronDown, CheckCircle2, Clock, AlertTriangle, X, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/app-layout";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

// Launch Crew service categories
const CATEGORIES = [
  "Boat Care",
  "Dock Inspection",
  "Generator Test",
  "Propane Check",
  "Interior Check",
  "HVAC / Filters",
  "Lawn & Exterior",
  "Pest Control",
  "Lock / Security",
  "Plumbing",
  "Electrical",
  "Seasonal Prep",
  "Storm Recovery",
  "Other",
];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  scheduled: "Scheduled",
  completed: "Completed",
  declined: "Declined",
};
const STATUS_COLORS: Record<string, string> = {
  new: "#7A8C6E",
  reviewed: "#D9902B",
  scheduled: "#5A7A8C",
  completed: "#4a9a6a",
  declined: "#666",
};

export default function ClientServiceRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Fetch client's properties
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties/mine", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await apiRequest("GET", `/api/properties/mine?clientUserId=${user.id}`);
      return r.json();
    },
    enabled: !!user?.id,
  });

  const [activePropId, setActivePropId] = useState<number | null>(null);
  const property = useMemo(() =>
    properties.find(p => p.id === activePropId) ?? properties[0],
    [properties, activePropId]
  );

  // Fetch existing requests
  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/service-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await apiRequest("GET", `/api/service-requests?clientId=${user.id}`);
      return r.json();
    },
    enabled: !!user?.id,
  });

  // New request form
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!category) throw new Error("Please select a category");
      if (!description.trim()) throw new Error("Please describe what you need");
      if (!property?.id) throw new Error("No property selected");
      const res = await apiRequest("POST", "/api/service-requests", {
        propertyId: property.id,
        clientId: user!.id,
        category,
        description: description.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/service-requests", user?.id] });
      setShowForm(false);
      setCategory("");
      setDescription("");
      setFormError("");
    },
    onError: (e: any) => setFormError(e.message),
  });

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <AppLayout title="Request Service" subtitle="Launch Crew on-demand requests">
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"
            style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
            <Wrench size={20} style={{ color: TERRACOTTA }} />
            Service Requests
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#888" }}>
            Submit on-demand Launch Crew requests for your property
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: TERRACOTTA, color: "#fff" }}
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? "Cancel" : "New Request"}
        </button>
      </div>

      {/* Property switcher (if multiple) */}
      {properties.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {properties.map(p => (
            <button key={p.id}
              onClick={() => setActivePropId(p.id)}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition-all"
              style={{
                background: (property?.id === p.id) ? `${TERRACOTTA}22` : CARD_BG,
                border: `1px solid ${(property?.id === p.id) ? TERRACOTTA : CARD_BORDER}`,
                color: (property?.id === p.id) ? TERRACOTTA : "#888",
              }}>
              {p.nickname}
            </button>
          ))}
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${TERRACOTTA}44` }}>
          <div className="px-5 py-4" style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
            <h2 className="font-bold text-base" style={{ color: CREAM }}>New Service Request</h2>
            {property && (
              <p className="text-xs mt-0.5" style={{ color: "#888" }}>For: {property.nickname}</p>
            )}
          </div>
          <div className="p-5 space-y-4">
            {formError && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(192,90,67,0.12)", border: "1px solid rgba(192,90,67,0.3)", color: TERRACOTTA }}>
                <AlertTriangle size={14} />
                {formError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: "#999" }}>
                Service Category
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: "#141414", border: `1px solid ${CARD_BORDER}`, color: category ? CREAM : "#555" }}
                >
                  <option value="">Select a category…</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} style={{ color: "#555", position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: "#999" }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what you need done, including any specific details that will help our team…"
                className="w-full rounded-xl px-4 py-2.5 text-sm resize-none outline-none"
                style={{ background: "#141414", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
              />
            </div>

            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="w-full rounded-xl py-3 text-sm font-bold transition-opacity"
              style={{ background: TERRACOTTA, color: "#fff", opacity: submitMutation.isPending ? 0.6 : 1 }}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </div>
      )}

      {/* Submitted Requests */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: CARD_BG }} />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <Wrench size={32} style={{ color: "#333", margin: "0 auto 12px" }} />
          <p className="font-semibold" style={{ color: "#666" }}>No requests submitted yet</p>
          <p className="text-sm mt-1" style={{ color: "#444" }}>
            Use the "New Request" button above to get in touch with your team.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => {
            const statusColor = STATUS_COLORS[req.status] ?? "#888";
            const isOpen = expanded === req.id;
            return (
              <div key={req.id} className="rounded-xl overflow-hidden"
                style={{ background: CARD_BG, border: `1px solid ${req.status === "new" ? SAGE + "44" : CARD_BORDER}` }}>
                <button
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : req.id)}>
                  <div className="rounded-lg p-2 mt-0.5 flex-shrink-0" style={{ background: `${statusColor}18` }}>
                    <Wrench size={14} style={{ color: statusColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm" style={{ color: CREAM }}>{req.category}</span>
                      <span className="text-xs rounded-full px-2.5 py-0.5 font-bold"
                        style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
                        {STATUS_LABELS[req.status] ?? req.status}
                      </span>
                      {req.property_nickname && req.property_nickname !== property?.nickname && (
                        <span className="text-xs" style={{ color: "#555" }}>{req.property_nickname}</span>
                      )}
                    </div>
                    <p className="text-sm truncate" style={{ color: "#999" }}>{req.description}</p>
                    <div className="text-xs mt-1" style={{ color: "#555" }}>
                      {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={14} style={{ color: "#555", flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: "#555", flexShrink: 0 }} />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                    <div className="pt-3">
                      <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Request Details</div>
                      <p className="text-sm" style={{ color: "#ccc" }}>{req.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-bold uppercase tracking-wide mb-0.5" style={{ color: "#555" }}>Submitted</div>
                        <div style={{ color: "#999" }}>{new Date(req.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="font-bold uppercase tracking-wide mb-0.5" style={{ color: "#555" }}>Last Updated</div>
                        <div style={{ color: "#999" }}>{new Date(req.updated_at).toLocaleString()}</div>
                      </div>
                    </div>
                    {req.status === "completed" && (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                        style={{ background: "rgba(74,154,106,0.12)", color: "#4a9a6a" }}>
                        <CheckCircle2 size={13} />
                        This request has been completed.
                      </div>
                    )}
                    {req.status === "declined" && (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                        style={{ background: "rgba(102,102,102,0.12)", color: "#888" }}>
                        <AlertTriangle size={13} />
                        This request was declined. Please contact us for details.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
