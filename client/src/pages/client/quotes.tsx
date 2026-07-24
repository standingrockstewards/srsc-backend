/**
 * Client Quote Review & Decision
 *
 * Clients see only released/decided quotes (backend enforces this — a client
 * GET of a non-released quote returns 403). Vendor identity, vendor contact,
 * vendor_id, and internal review notes are stripped server-side and are
 * never rendered here even if present on the payload.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, CheckCircle2, Clock, XCircle, DollarSign,
  ChevronDown, ChevronUp, AlertTriangle, Eye,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const BG = "#1C1C1C";
const CARD_BG = "#1e1e1e";
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const BORDER = "#2a2a2a";
const GOLD = "#D9A441";

type LineItem = { description: string; amount: number };
type QuoteDocument = { id: number; filename: string; visibility?: string; created_at?: string };
type Quote = {
  id: number;
  quote_type: "vendor" | "launch_crew";
  title: string;
  description?: string | null;
  line_items: LineItem[];
  total: number;
  currency?: string;
  status: string;
  client_decision?: string | null;
  declined_reason?: string | null;
  created_at: string;
  documents?: QuoteDocument[];
};

const PENDING_STATUSES = ["Released to Client", "Sent to Client"];
const PAST_STATUSES = ["Approved", "Declined"];

const TYPE_LABELS: Record<string, string> = {
  vendor: "Third-Party Service",
  launch_crew: "Standing Rock Service",
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  "Released to Client": { label: "Awaiting Your Review", color: GOLD, icon: Clock },
  "Sent to Client": { label: "Awaiting Your Review", color: GOLD, icon: Clock },
  Approved: { label: "Approved", color: SAGE, icon: CheckCircle2 },
  Declined: { label: "Declined", color: "#888", icon: XCircle },
};

function money(n: number | undefined | null): string {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "#888", icon: Clock };
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ background: `${meta.color}1F`, color: meta.color, border: `1px solid ${meta.color}55` }}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

function TypeBadge({ quoteType }: { quoteType: string }) {
  const label = TYPE_LABELS[quoteType] ?? quoteType;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
      style={{ background: "rgba(122,140,110,0.15)", color: SAGE, border: `1px solid ${SAGE}44` }}
    >
      {label}
    </span>
  );
}

// ─── Quote Card ────────────────────────────────────────────────────────────────
function QuoteCard({ quote, pending, onDecided }: { quote: Quote; pending: boolean; onDecided: () => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(pending);
  const [mode, setMode] = useState<"idle" | "approving" | "declining">("idle");
  const [declineReason, setDeclineReason] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const decisionMutation = useMutation({
    mutationFn: async (decision: "approved" | "declined") => {
      const body: any = { decision };
      if (decision === "declined") body.declined_reason = declineReason.trim() || undefined;
      const res = await apiRequest("PATCH", `/api/quote-requests/${quote.id}/decision`, body);
      return res.json();
    },
    onSuccess: (_data, decision) => {
      qc.invalidateQueries({ queryKey: ["/api/quote-requests"] });
      setMode("idle");
      setSuccessMsg(decision === "approved" ? "Quote approved. Thank you!" : "Quote declined.");
      onDecided();
    },
  });

  const lineItems = Array.isArray(quote.line_items) ? quote.line_items : [];
  const documents = Array.isArray(quote.documents) ? quote.documents : [];

  const accentBorder = pending ? `1px solid ${GOLD}66` : `1px solid ${BORDER}`;

  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{ background: CARD_BG, border: accentBorder, opacity: pending ? 1 : 0.9 }}
      data-testid={`quote-card-${quote.id}`}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="rounded-lg p-2 mt-0.5 flex-shrink-0"
          style={{ background: pending ? `${GOLD}1F` : "rgba(122,140,110,0.12)" }}
        >
          <FileText size={16} style={{ color: pending ? GOLD : SAGE }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <TypeBadge quoteType={quote.quote_type} />
            <StatusPill status={quote.status} />
          </div>
          <h3
            className="text-base sm:text-lg font-bold leading-tight"
            style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}
          >
            {quote.title}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>{formatDate(quote.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-base sm:text-lg font-bold hidden sm:inline" style={{ color: TERRACOTTA }}>
            {money(quote.total)}
          </span>
          {expanded ? <ChevronUp size={16} style={{ color: "#555" }} /> : <ChevronDown size={16} style={{ color: "#555" }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          {/* Description */}
          {quote.description && (
            <p className="text-sm pt-4 leading-relaxed" style={{ color: "#ccc" }}>{quote.description}</p>
          )}

          {/* Line items */}
          {lineItems.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <div className="px-3 py-2" style={{ background: "#161616" }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#999" }}>
                  Line Items
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: BORDER }}>
                {lineItems.map((li, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                    style={{ borderTop: idx === 0 ? "none" : `1px solid ${BORDER}` }}
                  >
                    <span style={{ color: "#ccc" }}>{li.description}</span>
                    <span className="flex-shrink-0 font-semibold text-right" style={{ color: CREAM }}>
                      {money(li.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "rgba(192,90,67,0.10)" }}>
            <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: CREAM }}>
              <DollarSign size={14} style={{ color: TERRACOTTA }} />
              Total
            </span>
            <span className="text-xl font-bold" style={{ color: TERRACOTTA, fontFamily: "'Playfair Display', serif" }}>
              {money(quote.total)}
            </span>
          </div>

          {/* Documents */}
          {documents.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#999" }}>
                Documents
              </div>
              <div className="space-y-1.5">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#161616", border: `1px solid ${BORDER}` }}
                  >
                    <FileText size={14} style={{ color: SAGE, flexShrink: 0 }} />
                    <span className="truncate" style={{ color: "#ccc" }}>{doc.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Declined reason (past quotes) */}
          {quote.status === "Declined" && quote.declined_reason && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ background: "rgba(136,136,136,0.10)", color: "#aaa" }}
            >
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-xs uppercase tracking-wide mb-0.5" style={{ color: "#888" }}>
                  Your Note
                </div>
                {quote.declined_reason}
              </div>
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold"
              style={{ background: "rgba(122,140,110,0.15)", color: SAGE, border: `1px solid ${SAGE}44` }}
            >
              <CheckCircle2 size={14} />
              {successMsg}
            </div>
          )}

          {/* Decision actions — only for pending quotes */}
          {pending && !successMsg && (
            <div className="pt-1">
              {decisionMutation.isError && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-sm"
                  style={{ background: "rgba(192,90,67,0.12)", color: TERRACOTTA }}
                >
                  <AlertTriangle size={13} />
                  Something went wrong. Please try again.
                </div>
              )}

              {mode === "idle" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setMode("approving")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                    style={{ background: SAGE, color: "#fff" }}
                    data-testid={`button-approve-${quote.id}`}
                  >
                    <CheckCircle2 size={15} />
                    Approve Quote
                  </button>
                  <button
                    onClick={() => setMode("declining")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors hover:bg-white/5"
                    style={{ background: "transparent", border: "1px solid #6b3a35", color: "#C97B6E" }}
                    data-testid={`button-decline-${quote.id}`}
                  >
                    <XCircle size={15} />
                    Decline
                  </button>
                </div>
              )}

              {mode === "approving" && (
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                    style={{ background: "rgba(122,140,110,0.12)", color: SAGE }}
                  >
                    <AlertTriangle size={14} />
                    Confirm approval of <strong>{money(quote.total)}</strong> for "{quote.title}"?
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => decisionMutation.mutate("approved")}
                      disabled={decisionMutation.isPending}
                      className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                      style={{ background: SAGE, color: "#fff", opacity: decisionMutation.isPending ? 0.6 : 1 }}
                      data-testid={`button-confirm-approve-${quote.id}`}
                    >
                      {decisionMutation.isPending ? "Submitting…" : "Confirm Approval"}
                    </button>
                    <button
                      onClick={() => setMode("idle")}
                      disabled={decisionMutation.isPending}
                      className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors hover:bg-white/5"
                      style={{ background: "transparent", border: `1px solid ${SAGE}`, color: SAGE }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {mode === "declining" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: "#999" }}>
                      Reason (optional)
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={e => setDeclineReason(e.target.value)}
                      rows={3}
                      placeholder="Let us know why you're declining this quote…"
                      className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                      style={{ background: "#141414", border: `1px solid ${BORDER}`, color: CREAM }}
                      data-testid={`textarea-decline-reason-${quote.id}`}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => decisionMutation.mutate("declined")}
                      disabled={decisionMutation.isPending}
                      className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
                      style={{ background: "#8B4038", color: "#fff", opacity: decisionMutation.isPending ? 0.6 : 1 }}
                      data-testid={`button-confirm-decline-${quote.id}`}
                    >
                      {decisionMutation.isPending ? "Submitting…" : "Confirm Decline"}
                    </button>
                    <button
                      onClick={() => { setMode("idle"); setDeclineReason(""); }}
                      disabled={decisionMutation.isPending}
                      className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors hover:bg-white/5"
                      style={{ background: "transparent", border: `1px solid ${SAGE}`, color: SAGE }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ClientQuotesPage() {
  const { user } = useAuth();

  const { data: quotes = [], isLoading, isError } = useQuery<Quote[]>({
    queryKey: ["/api/quote-requests"],
    staleTime: 0,
  });

  const pendingQuotes = quotes.filter(q => PENDING_STATUSES.includes(q.status));
  const pastQuotes = quotes.filter(q => PAST_STATUSES.includes(q.status));

  return (
    <AppLayout title="Quotes & Proposals" subtitle="Review and approve service quotes for your property.">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-8" style={{ background: BG }}>
        {/* Header */}
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}
          >
            <FileText size={20} style={{ color: TERRACOTTA }} />
            Quotes &amp; Proposals
          </h1>
          <p className="text-sm mt-1" style={{ color: "#888" }}>
            Review and approve service quotes for your property.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-8 h-8 rounded-full animate-spin"
              style={{ border: `3px solid ${BORDER}`, borderTopColor: TERRACOTTA }}
            />
          </div>
        )}

        {isError && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(192,90,67,0.12)", border: "1px solid rgba(192,90,67,0.3)", color: TERRACOTTA }}
          >
            <AlertTriangle size={14} />
            Unable to load quotes right now. Please try again shortly.
          </div>
        )}

        {!isLoading && !isError && quotes.length === 0 && (
          <div
            className="rounded-xl p-10 text-center"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
          >
            <Eye size={32} style={{ color: "#333", margin: "0 auto 12px" }} />
            <p className="font-semibold" style={{ color: "#666" }}>No quotes at this time.</p>
            <p className="text-sm mt-1" style={{ color: "#444" }}>
              We'll notify you when a quote is ready for your review.
            </p>
          </div>
        )}

        {!isLoading && !isError && quotes.length > 0 && (
          <>
            {/* Pending Decisions */}
            {pendingQuotes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: GOLD }} />
                  <h2 className="text-lg font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
                    Pending Decisions
                  </h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: `${GOLD}22`, color: GOLD }}
                  >
                    {pendingQuotes.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingQuotes.map(q => (
                    <QuoteCard key={q.id} quote={q} pending onDecided={() => {}} />
                  ))}
                </div>
              </div>
            )}

            {/* Past Quotes */}
            {pastQuotes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold" style={{ color: "#999", fontFamily: "'Playfair Display', serif" }}>
                  Past Quotes
                </h2>
                <div className="space-y-3">
                  {pastQuotes.map(q => (
                    <QuoteCard key={q.id} quote={q} pending={false} onDecided={() => {}} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
