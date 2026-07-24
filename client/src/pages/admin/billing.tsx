/**
 * Admin Billing & Payments
 * - Overview: revenue summary + quick stats
 * - Quotes: create/send/view quotes with line items
 * - Invoices: issue/mark paid/void invoices (Stripe test mode)
 * - Vendor Payouts: record + mark paid
 * - Disputes: uphold/credit dispute queue
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import {
  DollarSign, FileText, Users, AlertTriangle, CreditCard, TrendingUp,
  Plus, Send, Check, X, ChevronDown, ChevronUp, Loader2, ExternalLink, Receipt,
} from "lucide-react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const INPUT_BG = "#111";

// ─── Types ────────────────────────────────────────────────────────────────────
type BillingSummary = {
  this_month_revenue: number;
  outstanding_balance: number;
  open_quotes: { count: number; value: number };
  pending_payouts: { count: number; value: number };
  open_disputes: number;
  active_clients: number;
};

type LineItem = { description: string; qty: number; unit_price: number; amount: number };

type Quote = {
  id: number;
  property_id?: number;
  property_name?: string;
  client_id?: number;
  client_name?: string;
  title: string;
  description?: string;
  line_items?: LineItem[] | string;
  total: number;
  status: "draft" | "sent" | "approved" | "declined";
  service_request_id?: number | null;
  created_at: string;
};

type Invoice = {
  id: number;
  client_id?: number;
  client_name?: string;
  period_start: string;
  period_end: string;
  status: "open" | "issued" | "paid" | "disputed" | "void";
  total: number;
  line_items?: LineItem[] | string;
  issued_at?: string | null;
  due_date?: string | null;
  stripe_url?: string | null;
};

type VendorPayout = {
  id: number;
  vendor_id?: number;
  vendor_name?: string;
  amount: number;
  method: "check" | "cash" | "other";
  status: "pending" | "paid";
  paid_at?: string | null;
  created_at: string;
  note?: string;
};

type Dispute = {
  id: number;
  client_id?: number;
  client_name?: string;
  invoice_id?: number;
  invoice_period?: string;
  reason: string;
  status: "open" | "reviewing" | "resolved_upheld" | "resolved_credited";
  staff_notes?: string;
  credit_amount?: number;
  created_at: string;
};

type Property = { id: number; name?: string; nickname?: string; client_id?: number; client_name?: string };
type UserRow = { id: number; name: string; role: string };

// ─── Formatting helpers ───────────────────────────────────────────────────────
function money(n: number | undefined | null) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function ageDays(d?: string) {
  if (!d) return "—";
  const created = new Date(d).getTime();
  if (isNaN(created)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - created) / 86400000));
  return `${days}d`;
}
function parseLineItems(li?: LineItem[] | string): LineItem[] {
  if (!li) return [];
  if (Array.isArray(li)) return li;
  try {
    const parsed = JSON.parse(li);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

const QUOTE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "Draft", bg: "#555", color: "#999" },
  sent: { label: "Sent", bg: "#1a3a5c", color: "#5b9bd5" },
  approved: { label: "Approved", bg: "#1a3a2a", color: "#4caf50" },
  declined: { label: "Declined", bg: "#3a1010", color: "#F87171" },
};

const INVOICE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: "Open", bg: "#555", color: "#F5F0EA" },
  issued: { label: "Issued", bg: "#1a3a5c", color: "#5b9bd5" },
  paid: { label: "Paid", bg: "#1a3a2a", color: "#4caf50" },
  disputed: { label: "Disputed", bg: "#3a1010", color: "#F87171" },
  void: { label: "Void", bg: "#333", color: "#555" },
};

const PAYOUT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#3a2a10", color: "#D9902B" },
  paid: { label: "Paid", bg: "#1a3a2a", color: "#4caf50" },
};

const DISPUTE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open: { label: "Open", bg: "#3a1010", color: "#F87171" },
  reviewing: { label: "Reviewing", bg: "#3a2a10", color: "#D9902B" },
  resolved_upheld: { label: "Resolved · Upheld", bg: "#555", color: "#ccc" },
  resolved_credited: { label: "Resolved · Credited", bg: "#1a3a2a", color: "#4caf50" },
};

// ─── Shared small UI ──────────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-4 mb-4 flex items-center gap-3"
      style={{ background: "#3a1010", border: "1px solid #F8717144" }}
    >
      <AlertTriangle size={18} style={{ color: "#F87171", flexShrink: 0 }} />
      <p className="text-sm" style={{ color: "#F87171" }}>{message}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 opacity-50">
      <Icon size={36} style={{ color: "#555" }} />
      <p className="text-sm mt-2" style={{ color: "#888" }}>{message}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <div className="h-3 w-20 rounded mb-3" style={{ background: "#2a2a2a" }} />
      <div className="h-6 w-28 rounded" style={{ background: "#2a2a2a" }} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse flex items-center gap-4"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <div className="h-4 flex-1 rounded" style={{ background: "#2a2a2a" }} />
      <div className="h-4 w-16 rounded" style={{ background: "#2a2a2a" }} />
      <div className="h-4 w-20 rounded" style={{ background: "#2a2a2a" }} />
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className ?? ""}`}
      style={{ background: INPUT_BG, border: "1px solid #333", color: CREAM, ...props.style }}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none resize-none ${props.className ?? ""}`}
      style={{ background: INPUT_BG, border: "1px solid #333", color: CREAM, ...props.style }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none ${props.className ?? ""}`}
      style={{ background: INPUT_BG, border: "1px solid #333", color: CREAM, ...props.style }}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: SAGE }}>
      {children}
    </label>
  );
}

function ModalShell({
  title, subtitle, onClose, children, wide,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col`}
        style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}
      >
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <div>
            <div className="font-bold text-base" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>{title}</div>
            {subtitle && <div className="text-xs mt-0.5" style={{ color: "#888" }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/[0.06] transition-colors" style={{ color: "#888" }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ActionButton({
  children, onClick, disabled, variant = "outline", size = "sm",
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "solid" | "outline" | "danger" | "ghost"; size?: "sm" | "md";
}) {
  const styles: Record<string, React.CSSProperties> = {
    solid: { background: TERRACOTTA, color: "#fff" },
    outline: { background: "transparent", border: "1px solid #333", color: "#ccc" },
    danger: { background: "transparent", border: "1px solid #F8717144", color: "#F87171" },
    ghost: { background: "transparent", color: "#888" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-opacity ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"}`}
      style={{ ...styles[variant], opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ════════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const { data, isLoading, isError, error } = useQuery<BillingSummary>({
    queryKey: ["/api/billing/summary"],
    refetchInterval: 30000,
  });

  if (isError) return <ErrorBanner message={(error as Error)?.message || "Failed to load billing summary."} />;

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const cards = [
    { label: "This Month Revenue", value: money(data.this_month_revenue), icon: TrendingUp },
    { label: "Outstanding Balance", value: money(data.outstanding_balance), icon: DollarSign },
    { label: "Open Quotes", value: `${data.open_quotes?.count ?? 0}`, sub: money(data.open_quotes?.value), icon: FileText },
    { label: "Pending Payouts", value: `${data.pending_payouts?.count ?? 0}`, sub: money(data.pending_payouts?.value), icon: CreditCard },
    { label: "Open Disputes", value: `${data.open_disputes ?? 0}`, icon: AlertTriangle },
    { label: "Active Clients", value: `${data.active_clients ?? 0}`, icon: Users },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl p-4" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#888" }}>{c.label}</span>
            <c.icon size={16} style={{ color: SAGE }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: TERRACOTTA, fontFamily: "'Playfair Display', serif" }}>
            {c.value}
          </div>
          {c.sub && <div className="text-xs mt-1" style={{ color: "#666" }}>{c.sub} total</div>}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 2 — QUOTES
// ════════════════════════════════════════════════════════════════════════════════
function CreateQuoteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: properties = [] } = useQuery<Property[]>({ queryKey: ["/api/properties"] });

  const [propertyId, setPropertyId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceRequestId, setServiceRequestId] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", qty: 1, unit_price: 0, amount: 0 }]);

  const selectedProperty = properties.find((p) => String(p.id) === propertyId);
  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.amount = (Number(next.qty) || 0) * (Number(next.unit_price) || 0);
        return next;
      })
    );
  }
  function addItem() {
    setItems((prev) => [...prev, { description: "", qty: 1, unit_price: 0, amount: 0 }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const create = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/quotes", {
        property_id: propertyId ? Number(propertyId) : undefined,
        client_id: selectedProperty?.client_id,
        title,
        description,
        line_items: items.filter((it) => it.description.trim() !== ""),
        total,
        service_request_id: serviceRequestId ? Number(serviceRequestId) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
      onClose();
    },
  });

  return (
    <ModalShell title="New Quote" subtitle="Create a quote for client approval" onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Property</Label>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.nickname || p.name || `Property #${p.id}`}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Client</Label>
          <TextInput value={selectedProperty?.client_name || ""} disabled placeholder="Auto-filled from property" />
        </div>
      </div>

      <div>
        <Label>Title</Label>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spring Dock Repair" />
      </div>

      <div>
        <Label>Description</Label>
        <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details for the client…" />
      </div>

      <div>
        <Label>Service Request ID (optional)</Label>
        <TextInput value={serviceRequestId} onChange={(e) => setServiceRequestId(e.target.value)} placeholder="e.g. 42" type="number" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Line Items</Label>
          <button onClick={addItem} className="text-xs font-bold flex items-center gap-1" style={{ color: TERRACOTTA }}>
            <Plus size={12} /> Add Item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_60px_90px_90px_28px] gap-2 items-center">
              <TextInput
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
              />
              <TextInput
                type="number"
                min={0}
                placeholder="Qty"
                value={it.qty}
                onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
              />
              <TextInput
                type="number"
                min={0}
                step="0.01"
                placeholder="Unit $"
                value={it.unit_price}
                onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
              />
              <div className="text-sm text-right px-2" style={{ color: SAGE }}>{money(it.amount)}</div>
              <button onClick={() => removeItem(idx)} disabled={items.length <= 1} className="p-1" style={{ color: "#666", opacity: items.length <= 1 ? 0.3 : 1 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3 pt-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
          <div className="text-sm font-bold" style={{ color: CREAM }}>
            Total: <span style={{ color: TERRACOTTA }}>{money(total)}</span>
          </div>
        </div>
      </div>

      {create.isError && <ErrorBanner message={(create.error as Error)?.message || "Failed to create quote."} />}

      <div className="flex gap-3 pt-2">
        <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
        <ActionButton
          variant="solid"
          size="md"
          disabled={create.isPending || !title || !propertyId}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create Quote
        </ActionButton>
      </div>
    </ModalShell>
  );
}

function QuoteRow({ quote }: { quote: Quote }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const badge = QUOTE_STATUS[quote.status] ?? QUOTE_STATUS.draft;
  const lineItems = parseLineItems(quote.line_items);

  const send = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/quotes/${quote.id}`, { action: "send" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/quotes"] }),
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="grid grid-cols-1 md:grid-cols-[60px_1fr_1fr_1fr_100px_110px_60px_1fr] gap-3 items-center p-3 md:p-4">
        <div className="text-xs" style={{ color: "#666" }}>#{quote.id}</div>
        <div className="text-sm truncate" style={{ color: CREAM }}>{quote.property_name || `Property #${quote.property_id ?? "—"}`}</div>
        <div className="text-sm truncate" style={{ color: "#ccc" }}>{quote.client_name || "—"}</div>
        <div className="text-sm truncate" style={{ color: "#ccc" }}>{quote.title}</div>
        <div className="text-sm font-bold" style={{ color: TERRACOTTA }}>{money(quote.total)}</div>
        <div><Badge label={badge.label} bg={badge.bg} color={badge.color} /></div>
        <div className="text-xs" style={{ color: "#666" }}>{ageDays(quote.created_at)}</div>
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {quote.status === "draft" && (
            <ActionButton variant="solid" disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
            </ActionButton>
          )}
          <ActionButton variant="outline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} View
          </ActionButton>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
          <div className="pt-3">
            {quote.description && <p className="text-sm mb-3" style={{ color: "#b0ae9a" }}>{quote.description}</p>}
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: SAGE }}>Line Items</div>
            {lineItems.length === 0 ? (
              <p className="text-xs" style={{ color: "#666" }}>No line items.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "#888" }}>
                    <th className="text-left font-normal py-1">Description</th>
                    <th className="text-right font-normal py-1">Qty</th>
                    <th className="text-right font-normal py-1">Unit Price</th>
                    <th className="text-right font-normal py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                      <td className="py-1.5" style={{ color: CREAM }}>{it.description}</td>
                      <td className="py-1.5 text-right" style={{ color: "#ccc" }}>{it.qty}</td>
                      <td className="py-1.5 text-right" style={{ color: "#ccc" }}>{money(it.unit_price)}</td>
                      <td className="py-1.5 text-right font-semibold" style={{ color: SAGE }}>{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {quote.service_request_id && (
              <div className="mt-2 text-xs" style={{ color: "#666" }}>Linked service request #{quote.service_request_id}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuotesTab() {
  const { data: quotes = [], isLoading, isError, error } = useQuery<Quote[]>({ queryKey: ["/api/quotes"] });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#888" }}>
          {quotes.length} Quote{quotes.length === 1 ? "" : "s"}
        </h3>
        <ActionButton variant="solid" size="md" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Quote
        </ActionButton>
      </div>

      {isError && <ErrorBanner message={(error as Error)?.message || "Failed to load quotes."} />}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : quotes.length === 0 ? (
        <EmptyState icon={FileText} message="No quotes yet. Create one to get started." />
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => <QuoteRow key={q.id} quote={q} />)}
        </div>
      )}

      {showCreate && <CreateQuoteModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 3 — INVOICES
// ════════════════════════════════════════════════════════════════════════════════
function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ["/api/users?role=client"] });
  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/invoices", {
        client_id: Number(clientId),
        period_start: periodStart,
        period_end: periodEnd,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      onClose();
    },
  });

  return (
    <ModalShell title="New Invoice" subtitle="Generate an invoice for a billing period" onClose={onClose}>
      <div>
        <Label>Client</Label>
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Select a client…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Period Start</Label>
          <TextInput type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </div>
        <div>
          <Label>Period End</Label>
          <TextInput type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>
      </div>

      {create.isError && <ErrorBanner message={(create.error as Error)?.message || "Failed to create invoice."} />}

      <div className="flex gap-3 pt-2">
        <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
        <ActionButton
          variant="solid"
          size="md"
          disabled={create.isPending || !clientId || !periodStart || !periodEnd}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create Invoice
        </ActionButton>
      </div>
    </ModalShell>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const badge = INVOICE_STATUS[invoice.status] ?? INVOICE_STATUS.open;
  const lineItems = parseLineItems(invoice.line_items);

  const issue = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/invoices/${invoice.id}`, { action: "issue" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
  });
  const markPaid = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/invoices/${invoice.id}`, { action: "mark_paid" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
  });
  const voidInvoice = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/invoices/${invoice.id}`, { action: "void" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="grid grid-cols-1 md:grid-cols-[50px_1fr_1fr_100px_90px_100px_100px_1fr] gap-3 items-center p-3 md:p-4">
        <div className="text-xs" style={{ color: "#666" }}>#{invoice.id}</div>
        <div className="text-sm truncate" style={{ color: CREAM }}>{invoice.client_name || `Client #${invoice.client_id ?? "—"}`}</div>
        <div className="text-xs" style={{ color: "#ccc" }}>{fmtDate(invoice.period_start)} – {fmtDate(invoice.period_end)}</div>
        <div><Badge label={badge.label} bg={badge.bg} color={badge.color} /></div>
        <div className="text-sm font-bold" style={{ color: TERRACOTTA }}>{money(invoice.total)}</div>
        <div className="text-xs" style={{ color: "#666" }}>{fmtDate(invoice.issued_at)}</div>
        <div className="text-xs" style={{ color: "#666" }}>{fmtDate(invoice.due_date)}</div>
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {invoice.status === "open" && (
            <ActionButton variant="solid" disabled={issue.isPending} onClick={() => issue.mutate()}>
              {issue.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Issue
            </ActionButton>
          )}
          {invoice.status === "issued" && (
            <ActionButton variant="solid" disabled={markPaid.isPending} onClick={() => markPaid.mutate()}>
              {markPaid.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Mark Paid
            </ActionButton>
          )}
          {(invoice.status === "open" || invoice.status === "issued") && (
            <ActionButton variant="danger" disabled={voidInvoice.isPending} onClick={() => voidInvoice.mutate()}>
              <X size={12} /> Void
            </ActionButton>
          )}
          <ActionButton variant="outline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </ActionButton>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
          <div className="pt-3">
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: SAGE }}>Line Items</div>
            {lineItems.length === 0 ? (
              <p className="text-xs" style={{ color: "#666" }}>No line items.</p>
            ) : (
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr style={{ color: "#888" }}>
                    <th className="text-left font-normal py-1">Description</th>
                    <th className="text-right font-normal py-1">Qty</th>
                    <th className="text-right font-normal py-1">Unit Price</th>
                    <th className="text-right font-normal py-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                      <td className="py-1.5" style={{ color: CREAM }}>{it.description}</td>
                      <td className="py-1.5 text-right" style={{ color: "#ccc" }}>{it.qty}</td>
                      <td className="py-1.5 text-right" style={{ color: "#ccc" }}>{money(it.unit_price)}</td>
                      <td className="py-1.5 text-right font-semibold" style={{ color: SAGE }}>{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {invoice.stripe_url && (
              <a href={invoice.stripe_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: TERRACOTTA }}>
                <ExternalLink size={12} /> View in Stripe
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicesTab() {
  const { data: invoices = [], isLoading, isError, error } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#888" }}>
          {invoices.length} Invoice{invoices.length === 1 ? "" : "s"}
        </h3>
        <ActionButton variant="solid" size="md" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Invoice
        </ActionButton>
      </div>

      {isError && <ErrorBanner message={(error as Error)?.message || "Failed to load invoices."} />}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={Receipt} message="No invoices yet. Create one to get started." />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
        </div>
      )}

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 4 — VENDOR PAYOUTS
// ════════════════════════════════════════════════════════════════════════════════
function RecordPayoutModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: vendors = [] } = useQuery<UserRow[]>({ queryKey: ["/api/users?role=vendor"] });
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"check" | "cash" | "other">("check");
  const [note, setNote] = useState("");
  const [useCustomVendor, setUseCustomVendor] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/vendor-payouts", {
        vendor_id: !useCustomVendor && vendorId ? Number(vendorId) : undefined,
        vendor_name: useCustomVendor ? vendorName : undefined,
        amount: Number(amount),
        method,
        note,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vendor-payouts"] });
      onClose();
    },
  });

  return (
    <ModalShell title="Record Payout" subtitle="Log a payment made to a vendor" onClose={onClose}>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>Vendor</Label>
          <button className="text-xs font-semibold" style={{ color: TERRACOTTA }} onClick={() => setUseCustomVendor((v) => !v)}>
            {useCustomVendor ? "Choose from list" : "Enter manually"}
          </button>
        </div>
        {useCustomVendor ? (
          <TextInput placeholder="Vendor name" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        ) : (
          <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select a vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Amount ($)</Label>
          <TextInput type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>Note</Label>
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note…" />
      </div>

      {create.isError && <ErrorBanner message={(create.error as Error)?.message || "Failed to record payout."} />}

      <div className="flex gap-3 pt-2">
        <ActionButton variant="ghost" onClick={onClose}>Cancel</ActionButton>
        <ActionButton
          variant="solid"
          size="md"
          disabled={create.isPending || !amount || (!useCustomVendor && !vendorId) || (useCustomVendor && !vendorName)}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Record Payout
        </ActionButton>
      </div>
    </ModalShell>
  );
}

function PayoutRow({ payout }: { payout: VendorPayout }) {
  const qc = useQueryClient();
  const badge = PAYOUT_STATUS[payout.status] ?? PAYOUT_STATUS.pending;

  const markPaid = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/vendor-payouts/${payout.id}`, { action: "mark_paid" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vendor-payouts"] }),
  });

  return (
    <div className="rounded-xl grid grid-cols-1 md:grid-cols-[50px_1fr_100px_100px_100px_110px_1fr_1fr] gap-3 items-center p-3 md:p-4"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="text-xs" style={{ color: "#666" }}>#{payout.id}</div>
      <div className="text-sm truncate" style={{ color: CREAM }}>{payout.vendor_name || `Vendor #${payout.vendor_id ?? "—"}`}</div>
      <div className="text-sm font-bold" style={{ color: TERRACOTTA }}>{money(payout.amount)}</div>
      <div className="text-xs capitalize" style={{ color: "#ccc" }}>{payout.method}</div>
      <div><Badge label={badge.label} bg={badge.bg} color={badge.color} /></div>
      <div className="text-xs" style={{ color: "#666" }}>{fmtDate(payout.paid_at || payout.created_at)}</div>
      <div className="text-xs truncate" style={{ color: "#888" }}>{payout.note || "—"}</div>
      <div className="flex items-center justify-end">
        {payout.status === "pending" && (
          <ActionButton variant="solid" disabled={markPaid.isPending} onClick={() => markPaid.mutate()}>
            {markPaid.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Mark Paid
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function PayoutsTab() {
  const { data: payouts = [], isLoading, isError, error } = useQuery<VendorPayout[]>({ queryKey: ["/api/vendor-payouts"] });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#888" }}>
          {payouts.length} Payout{payouts.length === 1 ? "" : "s"}
        </h3>
        <ActionButton variant="solid" size="md" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Record Payout
        </ActionButton>
      </div>

      {isError && <ErrorBanner message={(error as Error)?.message || "Failed to load vendor payouts."} />}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : payouts.length === 0 ? (
        <EmptyState icon={CreditCard} message="No vendor payouts recorded yet." />
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => <PayoutRow key={p.id} payout={p} />)}
        </div>
      )}

      {showCreate && <RecordPayoutModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TAB 5 — DISPUTES
// ════════════════════════════════════════════════════════════════════════════════
function DisputeRow({ dispute }: { dispute: Dispute }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState<null | "uphold" | "credit">(null);
  const [staffNotes, setStaffNotes] = useState(dispute.staff_notes ?? "");
  const [creditAmount, setCreditAmount] = useState("");
  const badge = DISPUTE_STATUS[dispute.status] ?? DISPUTE_STATUS.open;
  const canAct = dispute.status === "open" || dispute.status === "reviewing";

  const resolve = useMutation({
    mutationFn: (action: "uphold" | "credit") =>
      apiRequest("PATCH", `/api/disputes/${dispute.id}`, {
        action,
        staff_notes: staffNotes,
        ...(action === "credit" ? { credit_amount: Number(creditAmount) } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/disputes"] });
      setShowForm(null);
    },
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="grid grid-cols-1 md:grid-cols-[50px_1fr_1fr_1fr_140px_100px_1fr] gap-3 items-center p-3 md:p-4">
        <div className="text-xs" style={{ color: "#666" }}>#{dispute.id}</div>
        <div className="text-sm truncate" style={{ color: CREAM }}>{dispute.client_name || `Client #${dispute.client_id ?? "—"}`}</div>
        <div className="text-xs" style={{ color: "#ccc" }}>{dispute.invoice_period || (dispute.invoice_id ? `Invoice #${dispute.invoice_id}` : "—")}</div>
        <div className="text-sm truncate" style={{ color: "#ccc" }}>{dispute.reason}</div>
        <div><Badge label={badge.label} bg={badge.bg} color={badge.color} /></div>
        <div className="text-xs" style={{ color: "#666" }}>{fmtDate(dispute.created_at)}</div>
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {canAct && (
            <>
              <ActionButton variant="outline" onClick={() => setShowForm(showForm === "uphold" ? null : "uphold")}>
                Uphold
              </ActionButton>
              <ActionButton variant="solid" onClick={() => setShowForm(showForm === "credit" ? null : "credit")}>
                Credit
              </ActionButton>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
          <div className="pt-3">
            <Label>Staff Notes</Label>
            <TextArea rows={2} value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} placeholder="Explain the resolution…" />
          </div>
          {showForm === "credit" && (
            <div>
              <Label>Credit Amount ($)</Label>
              <TextInput type="number" min={0} step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="0.00" />
            </div>
          )}
          {resolve.isError && <ErrorBanner message={(resolve.error as Error)?.message || "Failed to resolve dispute."} />}
          <div className="flex gap-2">
            <ActionButton variant="ghost" onClick={() => setShowForm(null)}>Cancel</ActionButton>
            <ActionButton
              variant="solid"
              disabled={resolve.isPending || (showForm === "credit" && !creditAmount)}
              onClick={() => resolve.mutate(showForm)}
            >
              {resolve.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Confirm {showForm === "uphold" ? "Uphold" : "Credit"}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

function DisputesTab() {
  const { data: disputes = [], isLoading, isError, error } = useQuery<Dispute[]>({ queryKey: ["/api/disputes"] });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#888" }}>
          {disputes.length} Dispute{disputes.length === 1 ? "" : "s"}
        </h3>
      </div>

      {isError && <ErrorBanner message={(error as Error)?.message || "Failed to load disputes."} />}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : disputes.length === 0 ? (
        <EmptyState icon={AlertTriangle} message="No disputes in the queue." />
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => <DisputeRow key={d.id} dispute={d} />)}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════════
type TabId = "overview" | "quotes" | "invoices" | "payouts" | "disputes";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "payouts", label: "Vendor Payouts", icon: CreditCard },
  { id: "disputes", label: "Disputes", icon: AlertTriangle },
];

export default function AdminBillingPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <AppLayout title="Billing & Payments" subtitle="Quotes · Invoices · Payouts · Disputes">
      <div className="p-6">
        {/* Tab bar */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                tab === t.id
                  ? { background: TERRACOTTA, color: "#fff" }
                  : { background: "#1e1e1e", color: "#888", border: "1px solid #2a2a2a" }
              }
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "quotes" && <QuotesTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "payouts" && <PayoutsTab />}
        {tab === "disputes" && <DisputesTab />}
      </div>
    </AppLayout>
  );
}
