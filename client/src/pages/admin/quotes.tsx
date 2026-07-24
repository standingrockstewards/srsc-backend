/**
 * Admin/Supervisor Quote Management
 *
 * Tabs:
 *   - Review Queue: vendor quotes needing review (Submitted / In Review)
 *   - All Quotes: every quote in the system, filterable by type/status
 *   - New Launch Crew Quote: build & send a Launch Crew quote to a client
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, Clock, AlertCircle, Plus, ChevronDown, ChevronUp,
  Eye, Send, RotateCcw, XCircle, DollarSign, ClipboardList, Zap, Upload, X, Check,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1e1e1e";
const BORDER = "#2a2a2a";
const MUTED = "#888";

const STATUS_COLORS: Record<string, string> = {
  Draft: "#888",
  Submitted: "#D9902B",
  "In Review": "#5A7A8C",
  Confirmed: "#7A8C6E",
  "Released to Client": "#C05A43",
  "Sent to Client": "#C05A43",
  Approved: "#4a9a6a",
  Declined: "#b44444",
  "Returned to Vendor": "#D9902B",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? MUTED;
}

function StatusChip({ status }: { status: string }) {
  const c = statusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}
    >
      {status}
    </span>
  );
}

function TypeChip({ type }: { type: string }) {
  const isVendor = type === "vendor";
  const c = isVendor ? "#5A7A8C" : SAGE;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}
    >
      {isVendor ? "Vendor" : "Launch Crew"}
    </span>
  );
}

function fmtMoney(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

// ─── Loading / Empty states ───────────────────────────────────────────────────
function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{ border: `3px solid ${BORDER}`, borderTopColor: TERRACOTTA }}
      />
      {label && <p className="text-sm" style={{ color: MUTED }}>{label}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl"
      style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
    >
      <div className="rounded-full p-3 mb-3" style={{ background: `${SAGE}18` }}>
        <Icon size={22} style={{ color: SAGE }} />
      </div>
      <p className="font-bold text-sm" style={{ color: CREAM, fontFamily: "var(--font-serif)" }}>{title}</p>
      {subtitle && <p className="text-xs mt-1 max-w-sm" style={{ color: MUTED }}>{subtitle}</p>}
    </div>
  );
}

function Banner({ message, kind }: { message: string; kind: "success" | "error" }) {
  const c = kind === "success" ? "#4a9a6a" : "#b44444";
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium mb-4"
      style={{ background: `${c}18`, border: `1px solid ${c}44`, color: c }}
    >
      <Icon size={15} />
      <span>{message}</span>
    </div>
  );
}

// ─── Line items list (for expanded rows) ─────────────────────────────────────
function LineItemsList({ lineItems, total }: { lineItems: any[]; total: number | string }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {(lineItems ?? []).map((li: any, idx: number) => (
        <div
          key={idx}
          className="flex items-center justify-between px-3 py-2 text-sm"
          style={{ borderBottom: `1px solid ${BORDER}`, color: "#ccc" }}
        >
          <span className="truncate pr-2">{li.description}</span>
          <span className="flex-shrink-0 font-mono" style={{ color: CREAM }}>{fmtMoney(li.amount)}</span>
        </div>
      ))}
      <div
        className="flex items-center justify-between px-3 py-2 text-sm font-bold"
        style={{ background: "#141414", color: TERRACOTTA }}
      >
        <span>Total</span>
        <span className="font-mono">{fmtMoney(total)}</span>
      </div>
    </div>
  );
}

function DocumentsList({ documents }: { documents: any[] }) {
  if (!documents || documents.length === 0) {
    return <p className="text-xs" style={{ color: MUTED }}>No documents attached.</p>;
  }
  return (
    <div className="space-y-1.5">
      {documents.map((doc: any) => (
        <div
          key={doc.id}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: "#141414", border: `1px solid ${BORDER}` }}
        >
          <FileText size={14} style={{ color: SAGE, flexShrink: 0 }} />
          <span className="truncate flex-1" style={{ color: CREAM }}>{doc.filename}</span>
          {doc.file_url ? (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold flex-shrink-0"
              style={{ color: TERRACOTTA }}
            >
              Download
            </a>
          ) : (
            <span className="text-xs flex-shrink-0" style={{ color: MUTED }}>No file</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REVIEW QUEUE ROW
// ═══════════════════════════════════════════════════════════════════════════
function ReviewQueueRow({ quote, onDone }: { quote: any; onDone: (msg: string, kind: "success" | "error") => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [returnNote, setReturnNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/quote-requests"] });
    qc.invalidateQueries({ queryKey: ["/api/quote-requests/review-queue/pending"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (body: { action: string; return_note?: string }) => {
      const res = await apiRequest("PATCH", `/api/quote-requests/${quote.id}`, body);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate();
      const labels: Record<string, string> = {
        confirm: "Quote confirmed.",
        release: "Quote released to client.",
        return: "Quote returned to vendor.",
        decline: "Quote declined.",
      };
      onDone(labels[variables.action] ?? "Updated.", "success");
      setShowReturn(false);
      setReturnNote("");
    },
    onError: (err: any) => onDone(err?.message ?? "Something went wrong.", "error"),
  });

  const c = statusColor(quote.status);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="rounded-lg p-2 mt-0.5 flex-shrink-0" style={{ background: `${c}18` }}>
          <ClipboardList size={14} style={{ color: c }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-bold text-sm" style={{ color: CREAM, fontFamily: "var(--font-serif)" }}>
              {quote.title}
            </span>
            <StatusChip status={quote.status} />
          </div>
          <div className="text-xs flex flex-wrap gap-2 items-center" style={{ color: "#999" }}>
            <span style={{ color: TERRACOTTA, fontWeight: 600 }}>{quote.vendor_name ?? "Unknown Vendor"}</span>
            <span>·</span>
            <span className="font-mono" style={{ color: CREAM }}>{fmtMoney(quote.total)}</span>
            <span>·</span>
            <span>{fmtDate(quote.created_at)}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: MUTED, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="pt-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Description</div>
            <p className="text-sm" style={{ color: "#ccc" }}>{quote.description || "No description provided."}</p>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Line Items</div>
            <LineItemsList lineItems={quote.line_items ?? []} total={quote.total} />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Documents</div>
            <DocumentsList documents={quote.documents ?? []} />
          </div>

          {showReturn && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Return Note</div>
              <textarea
                value={returnNote}
                onChange={e => setReturnNote(e.target.value)}
                rows={3}
                placeholder="Explain what needs to change before resubmission…"
                className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
                style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  disabled={!returnNote.trim() || actionMutation.isPending}
                  onClick={() => actionMutation.mutate({ action: "return", return_note: returnNote })}
                  style={{ background: TERRACOTTA, color: "white", border: "none" }}
                >
                  <Send size={13} /> Submit Return
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowReturn(false); setReturnNote(""); }}
                  style={{ color: MUTED }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {(quote.status === "Submitted" || quote.status === "In Review") && (
              <Button
                size="sm"
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: "confirm" })}
                style={{ background: SAGE, color: "white", border: "none" }}
              >
                <Check size={13} /> Confirm
              </Button>
            )}
            <Button
              size="sm"
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate({ action: "release" })}
              style={{ background: TERRACOTTA, color: "white", border: "none" }}
            >
              <Send size={13} /> Release to Client
            </Button>
            {!showReturn && (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionMutation.isPending}
                onClick={() => setShowReturn(true)}
                style={{ color: "#D9902B", border: `1px solid ${BORDER}` }}
              >
                <RotateCcw size={13} /> Return to Vendor
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={actionMutation.isPending}
              onClick={() => {
                if (window.confirm("Decline this quote? This cannot be undone.")) {
                  actionMutation.mutate({ action: "decline" });
                }
              }}
              style={{ color: "#b44444", border: `1px solid ${BORDER}` }}
            >
              <XCircle size={13} /> Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — REVIEW QUEUE
// ═══════════════════════════════════════════════════════════════════════════
function ReviewQueueTab({ onDone }: { onDone: (msg: string, kind: "success" | "error") => void }) {
  const { data, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/quote-requests/review-queue/pending"],
    staleTime: 0,
  });

  if (isLoading) return <LoadingSpinner label="Loading review queue…" />;
  if (isError) return <EmptyState icon={AlertCircle} title="Couldn't load review queue" subtitle="Please try again in a moment." />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing waiting for review"
        subtitle="Vendor quotes that are Submitted or In Review will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {data.map(q => <ReviewQueueRow key={q.id} quote={q} onDone={onDone} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — ALL QUOTES
// ═══════════════════════════════════════════════════════════════════════════
const ALL_STATUSES = [
  "Draft", "Submitted", "In Review", "Confirmed",
  "Released to Client", "Sent to Client", "Approved", "Declined", "Returned to Vendor",
];

function AllQuoteRow({
  quote, users, properties, onDone,
}: {
  quote: any; users: any[]; properties: any[]; onDone: (msg: string, kind: "success" | "error") => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/quote-requests"] });
    qc.invalidateQueries({ queryKey: ["/api/quote-requests/review-queue/pending"] });
  };

  const actionMutation = useMutation({
    mutationFn: async (body: { action: string }) => {
      const res = await apiRequest("PATCH", `/api/quote-requests/${quote.id}`, body);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidate();
      const labels: Record<string, string> = {
        send: "Quote sent to client.",
        release: "Quote released to client.",
        decline: "Quote declined.",
      };
      onDone(labels[variables.action] ?? "Updated.", "success");
    },
    onError: (err: any) => onDone(err?.message ?? "Something went wrong.", "error"),
  });

  const property = properties.find((p: any) => p.id === quote.property_id);
  const client = users.find((u: any) => u.id === quote.client_id);
  const c = statusColor(quote.status);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="rounded-lg p-2 mt-0.5 flex-shrink-0" style={{ background: `${c}18` }}>
          {quote.quote_type === "vendor" ? <Zap size={14} style={{ color: c }} /> : <FileText size={14} style={{ color: c }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-xs" style={{ color: MUTED }}>#{quote.id}</span>
            <TypeChip type={quote.quote_type} />
            <span className="font-bold text-sm" style={{ color: CREAM, fontFamily: "var(--font-serif)" }}>
              {quote.title}
            </span>
            <StatusChip status={quote.status} />
          </div>
          <div className="text-xs flex flex-wrap gap-2 items-center" style={{ color: "#999" }}>
            <span>{property?.nickname ?? "—"}</span>
            <span>·</span>
            <span style={{ color: SAGE }}>{client?.name ?? "—"}</span>
            <span>·</span>
            <span className="font-mono" style={{ color: CREAM }}>{fmtMoney(quote.total)}</span>
            <span>·</span>
            <span>{fmtDate(quote.created_at)}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: MUTED, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: MUTED, flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="pt-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: SAGE }}>Description</div>
            <p className="text-sm" style={{ color: "#ccc" }}>{quote.description || "No description provided."}</p>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Line Items</div>
            <LineItemsList lineItems={quote.line_items ?? []} total={quote.total} />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: SAGE }}>Documents</div>
            <DocumentsList documents={quote.documents ?? []} />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {quote.quote_type === "launch_crew" && quote.status === "Draft" && (
              <Button
                size="sm"
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: "send" })}
                style={{ background: TERRACOTTA, color: "white", border: "none" }}
              >
                <Send size={13} /> Send to Client
              </Button>
            )}
            {quote.quote_type === "vendor" && quote.status === "Confirmed" && (
              <Button
                size="sm"
                disabled={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: "release" })}
                style={{ background: TERRACOTTA, color: "white", border: "none" }}
              >
                <Send size={13} /> Release to Client
              </Button>
            )}
            {!["Approved", "Declined"].includes(quote.status) && (
              <Button
                size="sm"
                variant="ghost"
                disabled={actionMutation.isPending}
                onClick={() => {
                  if (window.confirm("Decline this quote? This cannot be undone.")) {
                    actionMutation.mutate({ action: "decline" });
                  }
                }}
                style={{ color: "#b44444", border: `1px solid ${BORDER}` }}
              >
                <XCircle size={13} /> Decline
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AllQuotesTab({
  onDone, focusId,
}: { onDone: (msg: string, kind: "success" | "error") => void; focusId?: number | null }) {
  const [typeFilter, setTypeFilter] = useState<"all" | "vendor" | "launch_crew">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/quote-requests"],
    staleTime: 0,
  });
  const { data: properties } = useQuery<any[]>({
    queryKey: ["/api/properties"],
    staleTime: 0,
  });
  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
    staleTime: 0,
  });

  const filtered = (data ?? []).filter(q => {
    if (typeFilter !== "all" && q.quote_type !== typeFilter) return false;
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(["all", "vendor", "launch_crew"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
              style={
                typeFilter === t
                  ? { background: TERRACOTTA, color: "white" }
                  : { background: CARD_BG, color: MUTED, border: `1px solid ${BORDER}` }
              }
            >
              {t === "all" ? "All" : t === "vendor" ? "Vendor" : "Launch Crew"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("all")}
            className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
            style={
              statusFilter === "all"
                ? { background: SAGE, color: "white" }
                : { background: CARD_BG, color: MUTED, border: `1px solid ${BORDER}` }
            }
          >
            All Statuses
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
              style={
                statusFilter === s
                  ? { background: statusColor(s), color: "white" }
                  : { background: CARD_BG, color: MUTED, border: `1px solid ${BORDER}` }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading quotes…" />
      ) : isError ? (
        <EmptyState icon={AlertCircle} title="Couldn't load quotes" subtitle="Please try again in a moment." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotes match these filters"
          subtitle="Try a different type or status filter, or create a new Launch Crew quote."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <AllQuoteRow key={q.id} quote={q} users={users ?? []} properties={properties ?? []} onDone={onDone} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — NEW LAUNCH CREW QUOTE
// ═══════════════════════════════════════════════════════════════════════════
type LineItem = { description: string; amount: string };

function NewQuoteTab({
  onDone, onCreated,
}: { onDone: (msg: string, kind: "success" | "error") => void; onCreated: () => void }) {
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceRequestId, setServiceRequestId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", amount: "" }]);

  const { data: properties, isLoading: loadingProps } = useQuery<any[]>({
    queryKey: ["/api/properties"],
    staleTime: 0,
  });
  const { data: users, isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    staleTime: 0,
  });

  const clients = (users ?? []).filter((u: any) => u.role === "client");

  const total = lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0);

  function updateLineItem(idx: number, field: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((li, i) => (i === idx ? { ...li, [field]: value } : li)));
  }
  function addLineItem() {
    setLineItems(prev => [...prev, { description: "", amount: "" }]);
  }
  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handlePropertyChange(id: string) {
    setPropertyId(id);
    const prop = (properties ?? []).find((p: any) => String(p.id) === id);
    if (prop?.client_user_id) {
      setClientId(String(prop.client_user_id));
    }
  }

  function resetForm() {
    setPropertyId("");
    setClientId("");
    setTitle("");
    setDescription("");
    setServiceRequestId("");
    setLineItems([{ description: "", amount: "" }]);
  }

  const createMutation = useMutation({
    mutationFn: async (opts: { send: boolean }) => {
      const cleanedLineItems = lineItems
        .filter(li => li.description.trim() || Number(li.amount) > 0)
        .map(li => ({ description: li.description.trim(), amount: Number(li.amount) || 0 }));

      const res = await apiRequest("POST", "/api/quote-requests", {
        property_id: Number(propertyId),
        client_id: Number(clientId),
        title: title.trim(),
        description: description.trim(),
        line_items: cleanedLineItems,
        service_request_id: serviceRequestId ? Number(serviceRequestId) : undefined,
      });
      const created = await res.json();

      if (opts.send) {
        const sendRes = await apiRequest("PATCH", `/api/quote-requests/${created.id}`, { action: "send" });
        return sendRes.json();
      }
      return created;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/quote-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/quote-requests/review-queue/pending"] });
      onDone(
        variables.send ? "Quote created and sent to client." : "Quote saved as draft.",
        "success"
      );
      resetForm();
      onCreated();
    },
    onError: (err: any) => onDone(err?.message ?? "Something went wrong.", "error"),
  });

  const canSubmit = propertyId && clientId && title.trim() && lineItems.some(li => li.description.trim() && Number(li.amount) > 0);

  return (
    <div
      className="rounded-xl p-4 sm:p-6 space-y-5"
      style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
    >
      <div>
        <h3 className="font-bold text-base mb-1" style={{ color: CREAM, fontFamily: "var(--font-serif)" }}>
          New Launch Crew Quote
        </h3>
        <p className="text-xs" style={{ color: MUTED }}>
          Build a quote on behalf of the Launch Crew team and send it directly to a client.
        </p>
      </div>

      {/* Property */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
            Property
          </label>
          <select
            value={propertyId}
            onChange={e => handlePropertyChange(e.target.value)}
            disabled={loadingProps}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
          >
            <option value="">Select a property…</option>
            {(properties ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.nickname} — {p.address}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
            Client
          </label>
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            disabled={loadingUsers}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
          >
            <option value="">Select a client…</option>
            {clients.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
          Title
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Annual Property Inspection & Winterization Package"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the work covered by this quote…"
          className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none"
          style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
        />
      </div>

      {/* Service request link */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
          Link to Service Request (optional)
        </label>
        <input
          value={serviceRequestId}
          onChange={e => setServiceRequestId(e.target.value)}
          placeholder="Service request ID"
          className="w-full sm:w-64 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
        />
      </div>

      {/* Line items */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
          Line Items
        </label>
        <div className="space-y-2">
          {lineItems.map((li, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                value={li.description}
                onChange={e => updateLineItem(idx, "description", e.target.value)}
                placeholder="Description"
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
              />
              <div className="flex gap-2 items-center">
                <div className="relative flex-1 sm:w-36">
                  <DollarSign size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                  <input
                    value={li.amount}
                    onChange={e => updateLineItem(idx, "amount", e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-full rounded-xl pl-7 pr-3 py-2 text-sm outline-none"
                    style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
                  />
                </div>
                <button
                  onClick={() => removeLineItem(idx)}
                  disabled={lineItems.length === 1}
                  className="rounded-lg p-2 flex-shrink-0 disabled:opacity-30"
                  style={{ border: `1px solid ${BORDER}`, color: "#b44444" }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addLineItem}
          className="mt-2 flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-1.5"
          style={{ border: `1px solid ${BORDER}`, color: SAGE }}
        >
          <Plus size={13} /> Add Line Item
        </button>

        <div
          className="flex items-center justify-between mt-3 rounded-lg px-3 py-2 text-sm font-bold"
          style={{ background: "#141414", color: TERRACOTTA, border: `1px solid ${BORDER}` }}
        >
          <span>Running Total</span>
          <span className="font-mono">{fmtMoney(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate({ send: false })}
          variant="ghost"
          style={{ border: `1px solid ${BORDER}`, color: CREAM }}
        >
          <Upload size={14} /> Save as Draft
        </Button>
        <Button
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate({ send: true })}
          style={{ background: TERRACOTTA, color: "white", border: "none" }}
        >
          <Send size={14} /> Save &amp; Send to Client
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════
type TabKey = "review" | "all" | "new";

export default function AdminQuotesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("review");
  const [banner, setBanner] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const bannerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showBanner(message: string, kind: "success" | "error") {
    setBanner({ message, kind });
    if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
    bannerTimeout.current = setTimeout(() => setBanner(null), 4000);
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "review", label: "Review Queue", icon: Clock },
    { key: "all", label: "All Quotes", icon: ClipboardList },
    { key: "new", label: "New Launch Crew Quote", icon: Plus },
  ];

  return (
    <AppLayout title="Quote Management" subtitle="Review vendor quotes and manage Launch Crew quotes">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {banner && <Banner message={banner.message} kind={banner.kind} />}

        {/* Tab bar */}
        <div
          className="flex flex-wrap gap-2 mb-5 p-1 rounded-xl w-fit"
          style={{ background: "#161616", border: `1px solid ${BORDER}` }}
        >
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold transition-colors"
                style={active ? { background: TERRACOTTA, color: "white" } : { color: MUTED }}
              >
                <Icon size={14} />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>

        {tab === "review" && <ReviewQueueTab onDone={showBanner} />}
        {tab === "all" && <AllQuotesTab onDone={showBanner} />}
        {tab === "new" && (
          <NewQuoteTab onDone={showBanner} onCreated={() => setTab("all")} />
        )}
      </div>
    </AppLayout>
  );
}
