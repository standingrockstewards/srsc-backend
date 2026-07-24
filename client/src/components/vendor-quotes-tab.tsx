/**
 * Vendor-facing Quotes tab
 * - Lists quotes the vendor has submitted (no client identity ever shown)
 * - Lets vendor submit a new quote tied to a work order
 * - Supports resubmission when Standing Rock returns a quote for corrections
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Upload, FileText, Clock, CheckCircle2, AlertCircle, DollarSign,
  ChevronDown, X, RotateCcw, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const MUTED = "#888";
const CARD_BG = "#1e1e1e";
const CARD_BORDER = "#2a2a2a";
const INPUT_BG = "#252525";
const INPUT_BORDER = "#333";

type LineItem = { description: string; amount: string };

type Quote = {
  id: number;
  title: string;
  description?: string;
  total: number;
  status: string;
  line_items?: { description: string; amount: number }[];
  documents?: { filename: string; url?: string }[];
  work_order_id?: number | null;
  service_request_id?: number | null;
  created_at: string;
  return_note?: string;
};

type WorkOrder = { id: number; title: string; property_id?: number; status?: string };

const STATUS_STYLES: Record<string, { bg: string; color: string; label?: string }> = {
  Submitted: { bg: "#D9902B", color: "#1a1206" },
  "In Review": { bg: "#5A7A8C", color: "#0d1417" },
  Confirmed: { bg: "#7A8C6E", color: "#101208" },
  "Released to Client": { bg: "#C05A43", color: "#1a0b07" },
  Approved: { bg: "#4a9a6a", color: "#06140c" },
  Declined: { bg: "#b44", color: "#fff" },
  "Returned to Vendor": { bg: "#D9902B", color: "#1a1206", label: "Corrections Needed" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: MUTED, color: "#111" };
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label ?? status}
    </span>
  );
}

function statusDescription(status: string): string {
  switch (status) {
    case "Submitted":
      return "Submitted to Standing Rock for review";
    case "In Review":
      return "Standing Rock is currently reviewing this quote";
    case "Confirmed":
      return "Confirmed by Standing Rock";
    case "Released to Client":
      return "Released to the client for approval";
    case "Approved":
      return "Approved — work may proceed";
    case "Declined":
      return "This quote was declined";
    case "Returned to Vendor":
      return "Returned to you for corrections";
    default:
      return "Submitted to Standing Rock for review";
  }
}

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return ts;
  }
}

function formatMoney(n: number) {
  const val = Number(n) || 0;
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data: prefix, keep only base64 payload
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type FormState = {
  work_order_id: string;
  title: string;
  description: string;
  line_items: LineItem[];
};

const emptyForm: FormState = {
  work_order_id: "",
  title: "",
  description: "",
  line_items: [{ description: "", amount: "" }],
};

export function VendorQuotesTab({ userId }: { userId: number }) {
  useAuth();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/vendor-quotes/mine"],
    queryFn: async () => (await apiRequest("GET", "/api/vendor-quotes/mine")).json(),
    staleTime: 0,
  });

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ["/api/vendor-work-orders"],
    queryFn: async () => (await apiRequest("GET", "/api/vendor-work-orders")).json(),
    staleTime: 0,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.work_order_id) throw new Error("Please select a work order");
      if (!form.title.trim()) throw new Error("Please enter a title");

      const cleanedItems = form.line_items
        .filter(li => li.description.trim() || li.amount.trim())
        .map(li => ({ description: li.description.trim(), amount: Number(li.amount) || 0 }));

      const total = cleanedItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

      const body: Record<string, unknown> = {
        work_order_id: Number(form.work_order_id),
        title: form.title.trim(),
        description: form.description.trim(),
        total,
        line_items: cleanedItems,
      };

      if (file) {
        const base64 = await fileToBase64(file);
        body.document_filename = file.name;
        body.document_data = base64;
        body.document_mime = file.type || "application/octet-stream";
      }

      const res = await apiRequest("POST", "/api/vendor-quotes", body);
      return res.json();
    },
    onSuccess: () => {
      setShowForm(false);
      setForm(emptyForm);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFormError("");
      setSuccessMsg("Your quote has been submitted to Standing Rock for review.");
      qc.invalidateQueries({ queryKey: ["/api/vendor-quotes/mine"] });
      setTimeout(() => setSuccessMsg(""), 6000);
    },
    onError: (e: any) => setFormError(e.message ?? "Failed to submit quote"),
  });

  const totalPreview = form.line_items.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  const updateLineItem = (idx: number, key: keyof LineItem, value: string) => {
    setForm(f => {
      const items = [...f.line_items];
      items[idx] = { ...items[idx], [key]: value };
      return { ...f, line_items: items };
    });
  };

  const addLineItem = () => setForm(f => ({ ...f, line_items: [...f.line_items, { description: "", amount: "" }] }));
  const removeLineItem = (idx: number) =>
    setForm(f => ({ ...f, line_items: f.line_items.length > 1 ? f.line_items.filter((_, i) => i !== idx) : f.line_items }));

  const openNewForm = () => {
    setForm(emptyForm);
    setFile(null);
    setFormError("");
    setShowForm(true);
  };

  const handleResubmit = (quote: Quote) => {
    setForm({
      work_order_id: quote.work_order_id ? String(quote.work_order_id) : "",
      title: quote.title,
      description: quote.description ?? "",
      line_items:
        quote.line_items && quote.line_items.length > 0
          ? quote.line_items.map(li => ({ description: li.description, amount: String(li.amount) }))
          : [{ description: "", amount: "" }],
    });
    setFile(null);
    setFormError("");
    setShowForm(true);
    setExpandedId(null);
  };

  return (
    <div className="w-full" style={{ color: CREAM }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: CREAM }}>My Quotes</h2>
        <Button
          onClick={openNewForm}
          className="flex items-center gap-1.5"
          style={{ background: TERRACOTTA, color: "#fff", border: "none" }}
        >
          <Plus size={15} />
          Submit New Quote
        </Button>
      </div>

      {successMsg && (
        <div
          className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2 text-sm"
          style={{ background: `${SAGE}18`, border: `1px solid ${SAGE}55`, color: SAGE }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Submit new quote form */}
      {showForm && (
        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: TERRACOTTA }} />
              <span className="text-sm font-bold" style={{ color: CREAM }}>New Quote</span>
            </div>
            <button onClick={() => setShowForm(false)} aria-label="Close form">
              <X size={16} style={{ color: MUTED }} />
            </button>
          </div>

          <div
            className="text-xs rounded-lg px-3 py-2 mb-3"
            style={{ background: "#20242a", color: "#9fb0bd", border: "1px solid #303840" }}
          >
            Your quote will be reviewed by Standing Rock before reaching the client.
          </div>

          {formError && (
            <div
              className="text-xs rounded-lg px-3 py-2 mb-3 flex items-center gap-2"
              style={{ background: "rgba(192,90,67,0.12)", color: TERRACOTTA }}
            >
              <AlertCircle size={13} />
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: MUTED }}>
                Work Order *
              </label>
              <div className="relative">
                <select
                  value={form.work_order_id}
                  onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none appearance-none pr-8"
                  style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: CREAM }}
                >
                  <option value="">Select a work order…</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.title}{wo.status ? ` (${wo.status})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ color: MUTED, position: "absolute", right: 10, top: 10, pointerEvents: "none" }} />
              </div>
              {workOrders.length === 0 && (
                <p className="text-xs mt-1" style={{ color: MUTED }}>No work orders assigned to you yet.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: MUTED }}>
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Roof repair — north wing"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: CREAM }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: MUTED }}>
                Description
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Describe the scope of work…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: CREAM }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
                Line Items
              </label>
              <div className="space-y-2">
                {form.line_items.map((li, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={li.description}
                      onChange={e => updateLineItem(idx, "description", e.target.value)}
                      placeholder="Description"
                      className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: CREAM }}
                    />
                    <input
                      type="number"
                      value={li.amount}
                      onChange={e => updateLineItem(idx, "amount", e.target.value)}
                      placeholder="0.00"
                      className="w-24 flex-shrink-0 rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: CREAM }}
                    />
                    <button
                      onClick={() => removeLineItem(idx)}
                      aria-label="Remove line item"
                      className="flex-shrink-0 p-1.5 rounded-lg"
                      style={{ color: MUTED }}
                      disabled={form.line_items.length === 1}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addLineItem}
                className="flex items-center gap-1.5 text-xs font-semibold mt-2"
                style={{ color: TERRACOTTA }}
              >
                <Plus size={13} /> Add line item
              </button>

              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${INPUT_BORDER}` }}>
                <span className="text-sm font-semibold" style={{ color: MUTED }}>Total</span>
                <span className="flex items-center gap-1 text-base font-bold" style={{ color: CREAM }}>
                  <DollarSign size={14} style={{ color: SAGE }} />
                  {formatMoney(totalPreview)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: MUTED }}>
                Attachment
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="vendor-quote-file"
                />
                <label
                  htmlFor="vendor-quote-file"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer"
                  style={{ background: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: MUTED }}
                >
                  <Upload size={14} />
                  {file ? file.name : "Choose file…"}
                </label>
                {file && (
                  <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X size={14} style={{ color: MUTED }} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                style={{ background: TERRACOTTA, color: "#fff", border: "none", opacity: submitMutation.isPending ? 0.7 : 1 }}
              >
                {submitMutation.isPending ? "Submitting…" : "Submit Quote"}
              </Button>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm font-semibold"
                style={{ color: MUTED }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing quotes list */}
      {quotesLoading ? (
        <div className="text-sm" style={{ color: MUTED }}>Loading quotes…</div>
      ) : quotes.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: MUTED }}
        >
          You haven't submitted any quotes yet.
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map(q => {
            const isExpanded = expandedId === q.id;
            const isReturned = q.status === "Returned to Vendor";
            return (
              <div
                key={q.id}
                className="rounded-xl overflow-hidden"
                style={{ background: CARD_BG, border: `1px solid ${isReturned ? "#D9902B55" : CARD_BORDER}` }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold truncate" style={{ color: CREAM }}>{q.title}</span>
                      <StatusBadge status={q.status} />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: MUTED }}>
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} style={{ color: SAGE }} />
                        {formatMoney(q.total)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(q.created_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    style={{ color: MUTED, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0, marginTop: 2 }}
                  />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                    <div className="pt-3 text-xs" style={{ color: MUTED }}>
                      {statusDescription(q.status)}
                    </div>

                    {isReturned && q.return_note && (
                      <div
                        className="rounded-lg px-3 py-2.5 text-sm flex items-start gap-2"
                        style={{ background: "rgba(217,144,43,0.12)", border: "1px solid rgba(217,144,43,0.4)", color: "#D9902B" }}
                      >
                        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div className="font-bold mb-0.5">Corrections Needed</div>
                          <div style={{ color: "#e0ac5c" }}>{q.return_note}</div>
                        </div>
                      </div>
                    )}

                    {q.description && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Description</div>
                        <p className="text-sm" style={{ color: "#ccc" }}>{q.description}</p>
                      </div>
                    )}

                    {q.line_items && q.line_items.length > 0 && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>Line Items</div>
                        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
                          {q.line_items.map((li, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-3 py-2 text-sm"
                              style={{ background: i % 2 === 0 ? "#191919" : "#1c1c1c", color: "#ccc" }}
                            >
                              <span className="truncate pr-2">{li.description}</span>
                              <span className="flex-shrink-0" style={{ color: CREAM }}>${formatMoney(li.amount)}</span>
                            </div>
                          ))}
                          <div
                            className="flex items-center justify-between px-3 py-2 text-sm font-bold"
                            style={{ background: "#141414", color: CREAM }}
                          >
                            <span>Total</span>
                            <span>${formatMoney(q.total)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {q.documents && q.documents.length > 0 && (
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>Documents</div>
                        <div className="space-y-1.5">
                          {q.documents.map((doc, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm rounded-lg px-3 py-2"
                              style={{ background: "#191919", color: "#ccc" }}
                            >
                              <FileText size={13} style={{ color: SAGE, flexShrink: 0 }} />
                              <span className="truncate">{doc.filename}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isReturned && (
                      <Button
                        onClick={() => handleResubmit(q)}
                        className="flex items-center gap-1.5"
                        style={{ background: TERRACOTTA, color: "#fff", border: "none" }}
                      >
                        <RotateCcw size={14} />
                        Resubmit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
