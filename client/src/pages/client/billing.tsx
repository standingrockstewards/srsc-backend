/**
 * Client Billing Portal
 * - Current period balance + line items
 * - Pending quote approvals
 * - Past monthly statements archive
 * - Transaction history
 * - Dispute a charge
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import {
  DollarSign, FileText, ChevronDown, ChevronUp,
  Check, X, AlertTriangle, Receipt, CreditCard,
  Clock, Shield, Loader2, ExternalLink, Info,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

const fmt = (n: number) => `$${Number(n ?? 0).toFixed(2)}`;
function timeAgo(ts: string) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Open:     { bg: "#333", text: "#888" },
  Issued:   { bg: "#1a3a5c", text: "#5b9bd5" },
  Paid:     { bg: "#1a3a2a", text: "#4caf50" },
  Disputed: { bg: "#3a1010", text: "#F87171" },
  Void:     { bg: "#252525", text: "#555" },
};

// ─── Dispute Modal ────────────────────────────────────────────────────────────
function DisputeModal({ invoiceId, lineItem, onClose }: { invoiceId: number; lineItem?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Please describe why you're disputing this charge");
      const r = await apiRequest("POST", "/api/disputes", {
        invoice_id: invoiceId,
        line_item_id: lineItem?.id ?? null,
        reason,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed to file dispute");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/billing"] });
      qc.invalidateQueries({ queryKey: ["/api/disputes"] });
      onClose();
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}` }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: TERRACOTTA }} />
            <span className="font-bold text-sm" style={{ color: CREAM }}>Dispute a Charge</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X size={14} style={{ color: "#666" }} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {lineItem && (
            <div className="rounded-xl p-3 text-sm" style={{ background: "#111", border: `1px solid ${CARD_BORDER}` }}>
              <div className="font-semibold mb-1" style={{ color: CREAM }}>{lineItem.description}</div>
              <div style={{ color: TERRACOTTA }}>{fmt(lineItem.amount)}</div>
            </div>
          )}
          {error && <div className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(192,90,67,0.1)", color: TERRACOTTA }}>{error}</div>}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Reason for dispute</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder="Please describe why you believe this charge is incorrect…"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
              style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
          </div>
          <div className="text-xs" style={{ color: "#555" }}>
            Our team will review your dispute and respond within 2 business days.
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#777" }}>
              Cancel
            </button>
            <button onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !reason.trim()}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold"
              style={{ background: TERRACOTTA, color: "#fff", opacity: !reason.trim() ? 0.6 : 1 }}>
              {mutation.isPending ? <span className="flex items-center justify-center gap-1"><Loader2 size={13} className="animate-spin" /> Filing…</span> : "File Dispute"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quote Approval Card ───────────────────────────────────────────────────────
function QuoteApprovalCard({ quote, onDone }: { quote: any; onDone: () => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState<"approve" | "decline" | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const act = async (action: "approve" | "decline") => {
    setLoading(true); setError("");
    try {
      const r = await apiRequest("PATCH", `/api/quotes/${quote.id}`, {
        action,
        ...(action === "decline" ? { declined_reason: declineReason } : {}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      qc.invalidateQueries({ queryKey: ["/api/me/billing"] });
      onDone();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid #1a3a5c`, background: "#0d1a2a" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <FileText size={13} style={{ color: "#5b9bd5" }} />
              <span className="text-sm font-bold" style={{ color: CREAM }}>Quote for Approval</span>
              <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "#1a3a5c", color: "#5b9bd5" }}>Awaiting Your Response</span>
            </div>
            <div className="text-sm font-semibold mt-1" style={{ color: CREAM }}>{quote.title}</div>
            <div className="text-xs mt-0.5" style={{ color: "#666" }}>{quote.property_name} · Sent {timeAgo(quote.sent_at)}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold" style={{ color: TERRACOTTA }}>{fmt(quote.total)}</div>
          </div>
        </div>
        {quote.description && <p className="text-xs mt-2" style={{ color: "#aaa" }}>{quote.description}</p>}
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs mt-2" style={{ color: "#666" }}>
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />} {expanded ? "Hide" : "View"} line items
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
            {(quote.line_items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm"
                style={{ borderBottom: i < quote.line_items.length - 1 ? `1px solid ${CARD_BORDER}` : "none" }}>
                <span style={{ color: "#bbb" }}>{item.description}</span>
                <span style={{ color: CREAM, flexShrink: 0, marginLeft: 8 }}>{fmt(item.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2" style={{ background: "#111" }}>
              <span className="font-bold text-sm" style={{ color: CREAM }}>Total</span>
              <span className="font-bold text-sm" style={{ color: TERRACOTTA }}>{fmt(quote.total)}</span>
            </div>
          </div>
        </div>
      )}

      {error && <div className="mx-4 mb-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(192,90,67,0.1)", color: TERRACOTTA }}>{error}</div>}

      {confirming === "decline" && (
        <div className="px-4 pb-3 space-y-2">
          <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={2}
            placeholder="Why are you declining? (optional)"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
            style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
        </div>
      )}

      {confirming ? (
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => setConfirming(null)} className="rounded-xl px-4 py-2 text-sm"
            style={{ background: "#111", border: `1px solid ${CARD_BORDER}`, color: "#666" }}>Cancel</button>
          <button onClick={() => act(confirming)} disabled={loading}
            className="flex-1 rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-1"
            style={{ background: confirming === "approve" ? SAGE : "#C0392B", color: "#fff" }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : null}
            {confirming === "approve" ? "Confirm Approval" : "Confirm Decline"}
          </button>
        </div>
      ) : (
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => setConfirming("decline")}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: "#1a1a1a", border: "1px solid #C0392B", color: "#F87171" }}>
            Decline
          </button>
          <button onClick={() => setConfirming("approve")}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold"
            style={{ background: SAGE, color: "#fff" }}>
            <Check size={13} className="inline mr-1" />
            Approve Quote
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientBillingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"current" | "history" | "transactions">("current");
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<{ invoiceId: number; lineItem?: any } | null>(null);

  const { data: billing, isLoading, error } = useQuery<any>({
    queryKey: ["/api/me/billing"],
    queryFn: async () => (await apiRequest("GET", "/api/me/billing")).json(),
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <AppLayout title="Billing" subtitle="Your account statements">
      <div className="p-4 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: CARD_BG }} />)}
      </div>
    </AppLayout>
  );

  if (error || !billing) return (
    <AppLayout title="Billing" subtitle="Your account statements">
      <div className="p-4 text-center py-16" style={{ color: "#666" }}>Unable to load billing information. Please try again.</div>
    </AppLayout>
  );

  const { balance_due, next_bill_date, current_invoice, past_invoices = [], recent_transactions = [], pending_quotes = [] } = billing;

  const TABS = [
    { key: "current", label: "Current Period" },
    { key: "history", label: "Statement Archive" },
    { key: "transactions", label: "Transactions" },
  ];

  return (
    <AppLayout title="Billing" subtitle="Your account statements">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Balance Due</div>
            <div className="text-2xl font-bold" style={{ color: balance_due > 0 ? "#F87171" : "#4caf50", fontFamily: "'Playfair Display', serif" }}>
              {fmt(balance_due)}
            </div>
            {balance_due > 0 && <div className="text-xs mt-1" style={{ color: "#555" }}>Due by {current_invoice?.due_at ?? "—"}</div>}
          </div>
          <div className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Next Bill Date</div>
            <div className="text-xl font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
              {next_bill_date ? new Date(next_bill_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            </div>
            <div className="text-xs mt-1" style={{ color: "#555" }}>
              {billing.account?.subscription_tier ?? "standard"} plan
            </div>
          </div>
        </div>

        {/* Pending quote approvals */}
        {pending_quotes.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#5b9bd5" }}>
              {pending_quotes.length} Quote{pending_quotes.length > 1 ? "s" : ""} Awaiting Approval
            </div>
            {pending_quotes.map((q: any) => (
              <QuoteApprovalCard key={q.id} quote={q} onDone={() => qc.invalidateQueries({ queryKey: ["/api/me/billing"] })} />
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors"
              style={{
                background: tab === t.key ? TERRACOTTA : "#111",
                color: tab === t.key ? "#fff" : "#666",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Current Period */}
        {tab === "current" && (
          <div className="space-y-4">
            {!current_invoice ? (
              <div className="text-center py-12" style={{ color: "#555" }}>No current invoice yet for this period.</div>
            ) : (
              <>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${CARD_BORDER}`, background: "#141414" }}>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: TERRACOTTA }}>Current Statement</div>
                      <div className="text-xs mt-0.5" style={{ color: "#666" }}>
                        {current_invoice.period_start} → {current_invoice.period_end}
                      </div>
                    </div>
                    <span className="text-xs font-bold rounded-full px-2.5 py-1"
                      style={{
                        background: STATUS_COLORS[current_invoice.status]?.bg ?? "#333",
                        color: STATUS_COLORS[current_invoice.status]?.text ?? "#888"
                      }}>
                      {current_invoice.status}
                    </span>
                  </div>

                  {/* Line items */}
                  <div className="divide-y" style={{ borderColor: CARD_BORDER }}>
                    {(current_invoice.line_items || []).map((item: any, i: number) => (
                      <div key={i} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm" style={{ color: CREAM }}>{item.description}</div>
                          <div className="text-xs mt-0.5" style={{ color: "#555" }}>{item.source_type}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold" style={{ color: item.amount < 0 ? "#4caf50" : CREAM }}>
                            {item.amount < 0 ? "-" : ""}{fmt(Math.abs(item.amount))}
                          </span>
                          {current_invoice.status === "Issued" && (
                            <button
                              onClick={() => setDisputeTarget({ invoiceId: current_invoice.id, lineItem: item })}
                              className="text-xs rounded-lg px-2 py-1 hover:bg-white/10"
                              style={{ color: "#555", border: "1px solid #333" }}
                              title="Dispute this charge">
                              Dispute
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#141414", borderTop: `1px solid ${CARD_BORDER}` }}>
                    <span className="font-bold text-sm" style={{ color: CREAM }}>Total</span>
                    <span className="font-bold text-lg" style={{ color: TERRACOTTA, fontFamily: "'Playfair Display', serif" }}>{fmt(current_invoice.total)}</span>
                  </div>
                </div>

                {current_invoice.stripe_hosted_url && (
                  <a href={current_invoice.stripe_hosted_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
                    style={{ background: TERRACOTTA, color: "#fff" }}>
                    <CreditCard size={14} /> Pay Online <ExternalLink size={12} />
                  </a>
                )}

                {/* Dispute whole invoice */}
                {current_invoice.status === "Issued" && (
                  <button onClick={() => setDisputeTarget({ invoiceId: current_invoice.id })}
                    className="w-full rounded-xl py-2.5 text-sm"
                    style={{ background: "transparent", border: `1px solid ${CARD_BORDER}`, color: "#666" }}>
                    <AlertTriangle size={12} className="inline mr-1" /> Dispute an item on this invoice
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Statement Archive */}
        {tab === "history" && (
          <div className="space-y-3">
            {past_invoices.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#555" }}>
                <Receipt size={32} style={{ color: "#333", margin: "0 auto 8px" }} />
                <p>No past statements yet</p>
              </div>
            ) : past_invoices.map((inv: any) => {
              const isExpanded = expandedInvoice === inv.id;
              const sc = STATUS_COLORS[inv.status] ?? STATUS_COLORS.Open;
              return (
                <div key={inv.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
                  <button onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 text-left">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: CREAM }}>
                          {new Date(inv.period_start).toLocaleString("en-US", { month: "long", year: "numeric" })}
                        </span>
                        <span className="text-xs font-bold rounded-full px-2 py-0.5"
                          style={{ background: sc.bg, color: sc.text }}>
                          {inv.status}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "#666" }}>
                        {inv.paid_at ? `Paid ${timeAgo(inv.paid_at)}` : inv.due_at ? `Due ${inv.due_at}` : ""}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold" style={{ color: TERRACOTTA }}>{fmt(inv.total)}</div>
                    </div>
                    {isExpanded ? <ChevronUp size={12} style={{ color: "#555" }} /> : <ChevronDown size={12} style={{ color: "#555" }} />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                      <InvoiceDetail invoiceId={inv.id} onDispute={(lineItem) => setDisputeTarget({ invoiceId: inv.id, lineItem })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Transactions */}
        {tab === "transactions" && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
            {recent_transactions.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#555" }}>No transactions yet</div>
            ) : (
              <div className="divide-y" style={{ borderColor: CARD_BORDER }}>
                {recent_transactions.map((txn: any) => (
                  <div key={txn.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm" style={{ color: CREAM }}>{txn.description || txn.type}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#555" }}>{timeAgo(txn.created_at)}</div>
                    </div>
                    <div className="font-bold text-sm" style={{ color: txn.amount < 0 ? "#4caf50" : CREAM }}>
                      {txn.amount < 0 ? "-" : "+"}{fmt(Math.abs(txn.amount))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Dispute modal */}
      {disputeTarget && (
        <DisputeModal
          invoiceId={disputeTarget.invoiceId}
          lineItem={disputeTarget.lineItem}
          onClose={() => setDisputeTarget(null)}
        />
      )}
    </AppLayout>
  );
}

// ─── Invoice Detail (lazy-loaded for archive) ───────────────────────���─────────
function InvoiceDetail({ invoiceId, onDispute }: { invoiceId: number; onDispute: (item?: any) => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/invoices/${invoiceId}`],
    queryFn: async () => (await apiRequest("GET", `/api/invoices/${invoiceId}`)).json(),
  });

  if (isLoading) return <div className="text-xs py-3" style={{ color: "#555" }}>Loading…</div>;
  if (!data) return null;

  return (
    <div className="mt-2 space-y-2">
      {(data.line_items || []).map((item: any, i: number) => (
        <div key={i} className="flex items-center justify-between py-1.5 text-sm">
          <span style={{ color: "#aaa" }}>{item.description}</span>
          <div className="flex items-center gap-2">
            <span style={{ color: item.amount < 0 ? "#4caf50" : CREAM }}>{fmt(item.amount)}</span>
            {["Issued","Open"].includes(data.status) && (
              <button onClick={() => onDispute(item)} className="text-xs" style={{ color: "#555" }}>Dispute</button>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 font-bold text-sm" style={{ borderTop: `1px solid #222` }}>
        <span style={{ color: CREAM }}>Total</span>
        <span style={{ color: "#C05A43" }}>{fmt(data.total)}</span>
      </div>
      {data.stripe_hosted_url && (
        <a href={data.stripe_hosted_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs mt-1" style={{ color: "#5b9bd5" }}>
          <ExternalLink size={10} /> View / Pay Online
        </a>
      )}
    </div>
  );
}
