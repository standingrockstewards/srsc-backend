/**
 * Admin Vendor Management — Phase 2
 * - Documents: approve/reject per submission
 * - Work Orders: full overview across all vendors, edit/cancel
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, CheckCircle2, XCircle, Clock, ClipboardList, AlertCircle, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/app-layout";
import { apiRequest } from "@/lib/queryClient";

type VendorDoc = { id: number; title: string; status: string; file_url?: string; file_data?: string; file_type?: string; review_notes?: string; uploaded_at: string; vendor_id: number; };
type WorkOrder = { id: number; title: string; description?: string; status: string; priority: string; due_date?: string; property_id?: number; vendor_id?: number; notes?: string; cancelled_at?: string; created_at: string; };
type Vendor = { id: number; name: string; email?: string; phone?: string; role: string; };

const DOC_STATUS_COLORS: Record<string, string> = {
  requested: "#D9902B",
  submitted: "#5A7A8C",
  approved:  "#4a9a6a",
  rejected:  "#C05A43",
};

const WO_STATUS_COLORS: Record<string, string> = {
  pending:     "#D9902B",
  accepted:    "#7A8C6E",
  in_progress: "#5A7A8C",
  complete:    "#4a9a6a",
  cancelled:   "#555",
};

function StatusChip({ status, colors }: { status: string; colors: Record<string, string> }) {
  const color = colors[status] ?? "#888";
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ doc, onClose, vendorName }: { doc: VendorDoc; onClose: () => void; vendorName: string }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const review = useMutation({
    mutationFn: ({ status, reviewNotes }: { status: string; reviewNotes?: string }) =>
      apiRequest("PATCH", `/api/vendor-documents/${doc.id}`, { status, reviewNotes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vendor-documents"] }); onClose(); },
  });

  const canPreview = doc.file_data && (doc.file_type?.startsWith("image/") || doc.file_type === "application/pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3" style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <FileText size={18} style={{ color: "#7A8C6E" }} />
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>{doc.title}</div>
            <div className="text-xs" style={{ color: "#888" }}>From: {vendorName}</div>
          </div>
          <StatusChip status={doc.status} colors={DOC_STATUS_COLORS} />
        </div>

        <div className="p-4 space-y-4">
          {/* File preview hint */}
          {doc.file_url && (
            <div className="rounded-lg p-3" style={{ background: "#252525" }}>
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#7A8C6E" }}>Submitted File</div>
              <div className="text-sm" style={{ color: "#d0cec9" }}>{doc.file_url}</div>
              {canPreview && (
                <button className="mt-2 text-xs font-semibold" style={{ color: "#C05A43" }} onClick={() => setPreviewOpen(true)}>
                  Preview File
                </button>
              )}
            </div>
          )}

          {/* File preview */}
          {previewOpen && doc.file_data && (
            <div className="rounded-lg overflow-hidden border" style={{ borderColor: "#333" }}>
              {doc.file_type?.startsWith("image/") ? (
                <img src={doc.file_data} alt={doc.title} className="w-full max-h-64 object-contain" style={{ background: "#111" }} />
              ) : (
                <iframe src={doc.file_data} title={doc.title} className="w-full h-64" />
              )}
            </div>
          )}

          {/* Review notes */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>
              Review Notes (shown to vendor)
            </label>
            <textarea rows={3} className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              placeholder="Optional note for the vendor..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" style={{ color: "#888" }} onClick={onClose}>Cancel</Button>
            <Button className="flex-1 gap-1.5 font-semibold"
              style={{ background: "#C05A43", color: "#fff" }}
              disabled={review.isPending}
              onClick={() => review.mutate({ status: "rejected", reviewNotes: notes })}>
              <XCircle size={14} /> Reject
            </Button>
            <Button className="flex-1 gap-1.5 font-semibold"
              style={{ background: "#4a9a6a", color: "#fff" }}
              disabled={review.isPending}
              onClick={() => review.mutate({ status: "approved", reviewNotes: notes })}>
              <CheckCircle2 size={14} /> Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit/Cancel Work Order Modal ─────────────────────────────────────────────
function EditWorkOrderModal({ wo, vendors, onClose }: { wo: WorkOrder; vendors: Vendor[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(wo.notes ?? "");

  const update = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/vendor-work-orders/${wo.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vendor-work-orders"] }); onClose(); },
  });

  const vendorName = vendors.find(v => v.id === wo.vendor_id)?.name ?? "Unknown";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <div>
            <div className="font-bold text-sm" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>{wo.title}</div>
            <div className="text-xs" style={{ color: "#888" }}>Vendor: {vendorName}</div>
          </div>
          <StatusChip status={wo.status} colors={WO_STATUS_COLORS} />
        </div>

        <div className="p-4 space-y-4">
          {wo.description && (
            <p className="text-sm" style={{ color: "#b0ae9a" }}>{wo.description}</p>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#7A8C6E" }}>Admin Notes</label>
            <textarea rows={3} className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
              style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
              placeholder="Notes for the vendor..."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 text-xs" style={{ color: "#888" }} onClick={onClose}>Cancel</Button>
            {wo.status !== "cancelled" && wo.status !== "complete" && (
              <Button variant="ghost" className="flex-1 text-xs"
                style={{ color: "#C05A43", border: "1px solid #C05A4344" }}
                disabled={update.isPending}
                onClick={() => update.mutate({ status: "cancelled", notes })}>
                Cancel Work Order
              </Button>
            )}
            <Button className="flex-1 text-xs font-semibold"
              style={{ background: "#C05A43", color: "#fff" }}
              disabled={update.isPending}
              onClick={() => update.mutate({ notes })}>
              Save Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function VendorManagement() {
  const [tab, setTab] = useState<"documents" | "workorders">("documents");
  const [reviewDoc, setReviewDoc] = useState<VendorDoc | null>(null);
  const [editWO, setEditWO] = useState<WorkOrder | null>(null);

  const { data: docs = [] } = useQuery<VendorDoc[]>({ queryKey: ["/api/vendor-documents"] });
  const { data: orders = [] } = useQuery<WorkOrder[]>({ queryKey: ["/api/vendor-work-orders"] });
  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const pendingReview = docs.filter(d => d.status === "submitted").length;
  const activeWO = orders.filter(o => !["cancelled","complete"].includes(o.status)).length;

  function vendorName(id?: number) {
    if (!id) return "—";
    return vendors.find(v => v.id === id)?.name ?? `Vendor #${id}`;
  }

  return (
    <AppLayout title="Vendor Management" subtitle="Documents & Work Orders">
      <div className="p-6">
        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {([
            { id: "documents", label: "Documents", count: pendingReview },
            { id: "workorders", label: "Work Orders", count: activeWO },
          ] as { id: "documents"|"workorders"; label: string; count: number }[]).map(t => (
            <button key={t.id}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={tab === t.id ? { background: "#C05A43", color: "#fff" } : { background: "#1e1e1e", color: "#888", border: "1px solid #2a2a2a" }}
              onClick={() => setTab(t.id)}>
              {t.label}
              {t.count > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: tab === t.id ? "rgba(255,255,255,0.25)" : "#C05A43", color: "#fff" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Documents */}
        {tab === "documents" && (
          <div className="space-y-3">
            {docs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 opacity-40">
                <FileText size={36} style={{ color: "#555" }} />
                <p className="text-sm mt-2" style={{ color: "#888" }}>No vendor documents yet</p>
              </div>
            )}
            {docs.map(doc => {
              const color = DOC_STATUS_COLORS[doc.status] ?? "#888";
              return (
                <div key={doc.id} className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
                  <FileText size={20} style={{ color: "#7A8C6E" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm" style={{ color: "#F5F0EA" }}>{doc.title}</span>
                      <StatusChip status={doc.status} colors={DOC_STATUS_COLORS} />
                    </div>
                    <div className="text-xs" style={{ color: "#666" }}>
                      <User size={10} className="inline mr-1" />{vendorName(doc.vendor_id)}
                      {doc.file_url && <span className="ml-2">{doc.file_url}</span>}
                    </div>
                  </div>
                  {doc.status === "submitted" && (
                    <Button size="sm" className="gap-1.5 text-xs font-semibold flex-shrink-0"
                      style={{ background: "#C05A43", color: "#fff" }}
                      onClick={() => setReviewDoc(doc)}>
                      Review
                    </Button>
                  )}
                  {doc.status === "approved" && <CheckCircle2 size={18} style={{ color: "#4a9a6a", flexShrink: 0 }} />}
                  {doc.status === "rejected" && <XCircle size={18} style={{ color: "#C05A43", flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Work Orders */}
        {tab === "workorders" && (
          <div className="space-y-3">
            {orders.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 opacity-40">
                <ClipboardList size={36} style={{ color: "#555" }} />
                <p className="text-sm mt-2" style={{ color: "#888" }}>No work orders yet</p>
              </div>
            )}
            {orders.map(wo => (
              <div key={wo.id} className="rounded-xl p-4 flex items-start gap-4"
                style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: WO_STATUS_COLORS[wo.status] ?? "#888" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm" style={{ color: "#F5F0EA" }}>{wo.title}</span>
                    <StatusChip status={wo.status} colors={WO_STATUS_COLORS} />
                    <span className="text-[11px] capitalize" style={{ color: PRIORITY_COLORS[wo.priority] ?? "#888" }}>
                      {wo.priority} priority
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: "#666" }}>
                    <Building2 size={10} className="inline mr-1" />{vendorName(wo.vendor_id)}
                    {wo.due_date && <span className="ml-2">Due: {wo.due_date}</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="text-xs flex-shrink-0"
                  style={{ borderColor: "#333", color: "#888" }}
                  onClick={() => setEditWO(wo)}>
                  Manage
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {reviewDoc && (
        <ReviewModal doc={reviewDoc} vendorName={vendorName(reviewDoc.vendor_id)} onClose={() => setReviewDoc(null)} />
      )}
      {editWO && (
        <EditWorkOrderModal wo={editWO} vendors={vendors} onClose={() => setEditWO(null)} />
      )}
    </AppLayout>
  );
}

const PRIORITY_COLORS: Record<string, string> = { high: "#C05A43", normal: "#7A8C6E", low: "#555" };
