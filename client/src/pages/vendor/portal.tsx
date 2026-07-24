/**
 * Vendor Portal — Phase 2: fully interactive
 * - Documents: upload per-request, see status chips
 * - Work Orders: status transitions (Accepted → In Progress → Complete)
 * - Messages: thread view + reply
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, Clock, AlertCircle, MessageSquare, ClipboardList, X, Send, ChevronDown, ShieldCheck, ShieldAlert } from "lucide-react";
import { VendorQuotesTab } from "@/components/vendor-quotes-tab";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────
type VendorDoc = { id: number; title: string; status: string; file_url?: string; file_type?: string; review_notes?: string; uploaded_at: string; };
type WorkOrder = { id: number; title: string; description?: string; status: string; priority: string; due_date?: string; property_id?: number; notes?: string; created_at: string; };
type Message = { id: number; from_user_id: number; to_user_id: number; subject?: string; body: string; sent_at: string; read_at?: string; parent_id?: number; };

// ─── Status configs ───────────────────────────────────────────────────────────
const DOC_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  requested: { label: "Requested",  color: "#D9902B", icon: <Clock size={12} /> },
  submitted: { label: "Submitted",  color: "#7A8C6E", icon: <FileText size={12} /> },
  approved:  { label: "Approved",   color: "#4a9a6a", icon: <CheckCircle2 size={12} /> },
  rejected:  { label: "Rejected",   color: "#C05A43", icon: <AlertCircle size={12} /> },
};

const WO_STATUS_TRANSITIONS: Record<string, { next: string; label: string } | null> = {
  pending:     { next: "accepted",    label: "Accept Work Order" },
  accepted:    { next: "in_progress", label: "Mark In Progress" },
  in_progress: { next: "complete",    label: "Mark Complete" },
  complete:    null,
  cancelled:   null,
};

const WO_STATUS_COLORS: Record<string, string> = {
  pending:     "#D9902B",
  accepted:    "#7A8C6E",
  in_progress: "#5A7A8C",
  complete:    "#4a9a6a",
  cancelled:   "#555",
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   "#C05A43",
  normal: "#7A8C6E",
  low:    "#555",
};

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
      {tabs.map(t => (
        <button key={t.id}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={active === t.id
            ? { background: "#C05A43", color: "#fff" }
            : { color: "#888", background: "transparent" }}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: active === t.id ? "rgba(255,255,255,0.25)" : "#333", color: active === t.id ? "#fff" : "#aaa" }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Documents Tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ vendorId, userId }: { vendorId: number; userId: number }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const { data: docs = [], isLoading } = useQuery<VendorDoc[]>({
    queryKey: ["/api/vendor-documents", vendorId],
    queryFn: () => fetch(`/api/vendor-documents?vendorId=${vendorId}`).then(r => r.json()),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ docId, fileData, fileName, fileType }: { docId: number; fileData: string; fileName: string; fileType: string }) =>
      apiRequest("POST", `/api/vendor-documents/${docId}/upload`, { fileData, fileName, fileType, uploadedBy: userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vendor-documents", vendorId] }); setUploadingId(null); },
  });

  function handleFileSelect(docId: number) {
    setUploadingId(docId);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploadingId === null) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadMutation.mutate({
        docId: uploadingId,
        fileData: reader.result as string,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "#C05A43", borderTopColor: "transparent" }} /></div>;

  if (docs.length === 0) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50">
      <FileText size={36} style={{ color: "#555" }} />
      <p className="text-sm" style={{ color: "#888" }}>No documents requested yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv" />
      {docs.map(doc => {
        const sc = DOC_STATUS[doc.status] ?? DOC_STATUS.requested;
        const canUpload = doc.status === "requested" || doc.status === "rejected";
        return (
          <div key={doc.id} className="rounded-xl p-4 flex items-start gap-4"
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#252525" }}>
              <FileText size={20} style={{ color: "#7A8C6E" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: "#F5F0EA" }}>{doc.title}</span>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: `${sc.color}22`, color: sc.color, border: `1px solid ${sc.color}44` }}>
                  {sc.icon} {sc.label}
                </span>
              </div>
              {doc.file_url && <div className="text-xs mb-1" style={{ color: "#7A8C6E" }}>{doc.file_url}</div>}
              {doc.review_notes && (
                <div className="text-xs mt-1 rounded px-2 py-1" style={{ background: "#252525", color: "#b0ae9a" }}>
                  Note: {doc.review_notes}
                </div>
              )}
            </div>
            {canUpload && (
              <Button size="sm" variant="outline" className="flex-shrink-0 gap-1.5 text-xs"
                style={{ borderColor: "#C05A43", color: "#C05A43", background: "transparent" }}
                onClick={() => handleFileSelect(doc.id)}
                disabled={uploadMutation.isPending && uploadingId === doc.id}>
                <Upload size={12} />
                {uploadMutation.isPending && uploadingId === doc.id ? "Uploading..." : "Upload"}
              </Button>
            )}
            {doc.status === "submitted" && (
              <span className="text-xs flex-shrink-0" style={{ color: "#555" }}>Pending review</span>
            )}
            {doc.status === "approved" && (
              <CheckCircle2 size={18} style={{ color: "#4a9a6a", flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Work Orders Tab ───────────────────────────────────────────────────────────
function WorkOrdersTab({ vendorId }: { vendorId: number }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: orders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ["/api/vendor-work-orders", vendorId],
    queryFn: () => fetch(`/api/vendor-work-orders?vendorId=${vendorId}`).then(r => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/vendor-work-orders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vendor-work-orders", vendorId] }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "#C05A43", borderTopColor: "transparent" }} /></div>;

  if (orders.length === 0) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50">
      <ClipboardList size={36} style={{ color: "#555" }} />
      <p className="text-sm" style={{ color: "#888" }}>No work orders assigned yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map(wo => {
        const statusColor = WO_STATUS_COLORS[wo.status] ?? "#888";
        const transition = WO_STATUS_TRANSITIONS[wo.status];
        const isExpanded = expanded === wo.id;
        const priorityColor = PRIORITY_COLORS[wo.priority] ?? "#888";

        return (
          <div key={wo.id} className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
            {/* Header row */}
            <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpanded(isExpanded ? null : wo.id)}>
              <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: statusColor }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm" style={{ color: "#F5F0EA" }}>{wo.title}</span>
                  <span className="text-[11px] rounded-full px-2 py-0.5 font-semibold capitalize"
                    style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>
                    {wo.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] rounded-full px-2 py-0.5 font-semibold capitalize"
                    style={{ background: `${priorityColor}22`, color: priorityColor }}>
                    {wo.priority}
                  </span>
                </div>
                {wo.due_date && <div className="text-xs" style={{ color: "#666" }}>Due: {wo.due_date}</div>}
              </div>
              <ChevronDown size={14} style={{ color: "#555", transform: isExpanded ? "rotate(180deg)" : undefined, transition: "transform 0.2s", flexShrink: 0, marginTop: 4 }} />
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "#2a2a2a" }}>
                {wo.description && (
                  <p className="text-sm mt-3 mb-3 leading-relaxed" style={{ color: "#b0ae9a" }}>{wo.description}</p>
                )}
                {wo.notes && (
                  <div className="rounded-lg p-3 mb-3" style={{ background: "#252525" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#7A8C6E" }}>Admin Notes</div>
                    <p className="text-sm" style={{ color: "#b0ae9a" }}>{wo.notes}</p>
                  </div>
                )}
                {transition && (
                  <Button className="w-full mt-2 font-semibold text-sm"
                    style={{ background: "#C05A43", color: "#fff" }}
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: wo.id, status: transition.next })}>
                    {updateStatus.isPending ? "Updating..." : transition.label}
                  </Button>
                )}
                {wo.status === "complete" && (
                  <div className="flex items-center gap-2 justify-center mt-2">
                    <CheckCircle2 size={16} style={{ color: "#4a9a6a" }} />
                    <span className="text-sm font-semibold" style={{ color: "#4a9a6a" }}>Work Order Complete</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Messages Tab ──────────────────────────────────────────────────────────────
function MessagesTab({ vendorId, userId }: { vendorId: number; userId: number }) {
  const qc = useQueryClient();
  const [replyBody, setReplyBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/vendor-messages", vendorId],
    queryFn: () => fetch(`/api/vendor-messages?vendorId=${vendorId}`).then(r => r.json()),
  });

  const sendReply = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/vendor-messages", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vendor-messages", vendorId] });
      setReplyBody("");
      setReplyingTo(null);
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "#C05A43", borderTopColor: "transparent" }} /></div>;

  if (messages.length === 0) return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50">
      <MessageSquare size={36} style={{ color: "#555" }} />
      <p className="text-sm" style={{ color: "#888" }}>No messages yet</p>
    </div>
  );

  const sorted = [...messages].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  return (
    <div className="space-y-3">
      {/* Thread */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a" }}>
        <div className="px-4 py-3 border-b" style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <div className="font-semibold text-sm" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
            {sorted[0]?.subject ?? "Message Thread"}
          </div>
        </div>

        <div className="divide-y">
          {sorted.map(msg => {
            const isFromAdmin = msg.from_user_id !== userId;
            const date = new Date(msg.sent_at);
            const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

            return (
              <div key={msg.id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: isFromAdmin ? "#C05A43" : "#7A8C6E", color: "#fff" }}>
                    {isFromAdmin ? "SR" : "VC"}
                  </div>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: isFromAdmin ? "#C05A43" : "#7A8C6E" }}>
                      {isFromAdmin ? "Standing Rock Stewards" : "You"}
                    </span>
                    <span className="text-xs ml-2" style={{ color: "#555" }}>{dateStr}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#d0cec9" }}>{msg.body}</p>
                {isFromAdmin && !replyingTo && (
                  <button className="mt-2 text-xs font-semibold hover:opacity-80" style={{ color: "#7A8C6E" }}
                    onClick={() => setReplyingTo(msg)}>
                    Reply
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Reply composer */}
        <div className="p-4 border-t" style={{ borderColor: "#2a2a2a" }}>
          {replyingTo ? (
            <>
              <div className="text-xs mb-2 font-semibold" style={{ color: "#7A8C6E" }}>Replying...</div>
              <textarea
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
                style={{ background: "#252525", border: "1px solid #333", color: "#F5F0EA" }}
                placeholder="Write your reply..."
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" size="sm" className="flex-1" style={{ color: "#666" }}
                  onClick={() => { setReplyingTo(null); setReplyBody(""); }}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 gap-1.5 font-semibold"
                  style={{ background: "#C05A43", color: "#fff" }}
                  disabled={!replyBody.trim() || sendReply.isPending}
                  onClick={() => sendReply.mutate({
                    vendorId, fromUserId: userId, toUserId: replyingTo.from_user_id,
                    subject: `Re: ${replyingTo.subject ?? "Message"}`,
                    body: replyBody,
                    parentId: replyingTo.id,
                  })}>
                  <Send size={12} /> {sendReply.isPending ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </>
          ) : (
            <button className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{ color: "#7A8C6E" }}
              onClick={() => setReplyingTo(sorted[sorted.length - 1])}>
              <MessageSquare size={14} /> Reply to this thread
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Vendor Portal ────────────────────────────────────────────────────────
// ─── Vendor Compliance Tab ────────────────────────────────────────────────────
function VendorComplianceTab({ vendorId, userId }: { vendorId: number; userId: number }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["vendor-compliance-self", vendorId],
    queryFn: () => fetch(`/api/vendors/${vendorId}/compliance`, {
      headers: { "x-user-id": String(userId), "x-user-role": "vendor" },
    }).then(r => r.json()),
    staleTime: 0,
  });

  const gates: any[] = data?.gates ?? [];
  const payoutAllowed = data?.payoutAllowed ?? false;

  const handleUpload = (cat: string) => {
    setSelectedCat(cat);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCat) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await apiRequest("POST", `/api/vendors/${vendorId}/documents`, {
          title: file.name, docCategory: selectedCat, fileData: reader.result, fileName: file.name, fileMime: file.type,
        });
        qc.invalidateQueries({ queryKey: ["vendor-compliance-self", vendorId] });
      } catch {}
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const TERRA = "#C05A43"; const SAGE = "#7A8C6E"; const CREAM = "#F5F0EA";
  const MUTED = "rgba(245,240,234,0.45)"; const SANS = "var(--font-sans)";

  return (
    <div className="p-4">
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />
      <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: payoutAllowed ? `${SAGE}15` : `${TERRA}15`, border: `1px solid ${payoutAllowed ? SAGE : TERRA}44` }}>
        {payoutAllowed ? <ShieldCheck size={18} style={{ color: SAGE }} /> : <ShieldAlert size={18} style={{ color: TERRA }} />}
        <span className="text-sm font-semibold" style={{ color: payoutAllowed ? SAGE : TERRA, fontFamily: SANS }}>
          {payoutAllowed ? "All documents verified — payout eligible" : "Upload required documents to enable payout"}
        </span>
      </div>
      <div className="space-y-3">
        {gates.map((gate: any) => (
          <div key={gate.category} className="rounded-xl p-4" style={{ background: "#1a1a1a", border: `1px solid ${gate.verified ? `${SAGE}44` : "#222"}` }}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm" style={{ color: CREAM, fontFamily: SANS }}>{gate.label}</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: gate.verified ? `${SAGE}22` : gate.doc?.status === "submitted" ? "#2a2a00" : `${TERRA}22`,
                  color: gate.verified ? SAGE : gate.doc?.status === "submitted" ? "#d4b800" : TERRA }}>
                {gate.verified ? "Verified" : gate.doc?.status === "submitted" ? "Under Review" : gate.doc?.status === "rejected" ? "Rejected — Re-upload" : "Not Submitted"}
              </span>
            </div>
            {gate.doc?.review_notes && <p className="text-xs mb-2" style={{ color: TERRA }}>Note: {gate.doc.review_notes}</p>}
            {!gate.verified && (
              <button onClick={() => handleUpload(gate.category)}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: `${TERRA}22`, color: TERRA, fontFamily: SANS }}>
                <Upload size={13} /> {gate.doc?.status === "submitted" ? "Re-upload" : "Upload File"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VendorPortal() {
  const { user } = useAuth();
  const [tab, setTab] = useState("documents");

  const { data: docs = [] } = useQuery<VendorDoc[]>({
    queryKey: ["/api/vendor-documents", user?.id],
    queryFn: () => fetch(`/api/vendor-documents?vendorId=${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
  });
  const { data: orders = [] } = useQuery<WorkOrder[]>({
    queryKey: ["/api/vendor-work-orders", user?.id],
    queryFn: () => fetch(`/api/vendor-work-orders?vendorId=${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
  });
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/vendor-messages", user?.id],
    queryFn: () => fetch(`/api/vendor-messages?vendorId=${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const pendingDocs = docs.filter(d => d.status === "requested" || d.status === "rejected").length;
  const pendingWO = orders.filter(o => o.status === "pending").length;
  const unreadMsg = messages.filter(m => !m.read_at && m.from_user_id !== user?.id).length;

  // Quotes badge: submitted quotes in Submitted/Returned state
  const { data: myQuotes = [] } = useQuery<any[]>({
    queryKey: ["/api/vendor-quotes/mine"],
    staleTime: 0,
    enabled: !!user?.id,
  });
  const pendingQuotes = (myQuotes as any[]).filter(q => q.status === "Returned to Vendor").length;

  if (!user) return null;

  return (
    <AppLayout title="Vendor Portal" subtitle={`${user.name} — Vendor`}>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#F5F0EA", fontFamily: "'Playfair Display', serif" }}>
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm" style={{ color: "#888" }}>Standing Rock Stewardship Co. Vendor Portal</p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <TabBar
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "documents",   label: "Documents",    count: pendingDocs || undefined },
              { id: "compliance",  label: "Compliance",   count: undefined },
              { id: "workorders",  label: "Work Orders",  count: pendingWO || undefined },
              { id: "messages",    label: "Messages",     count: unreadMsg || undefined },
              { id: "quotes",      label: "Quotes",       count: pendingQuotes || undefined },
            ]}
          />
        </div>

        {/* Tab content */}
        {tab === "documents"   && <DocumentsTab   vendorId={user.id} userId={user.id} />}
        {tab === "compliance"  && <VendorComplianceTab vendorId={user.id} userId={user.id} />}
        {tab === "workorders"  && <WorkOrdersTab  vendorId={user.id} />}
        {tab === "messages"    && <MessagesTab    vendorId={user.id} userId={user.id} />}
        {tab === "quotes"      && <VendorQuotesTab userId={user.id} />}
      </div>
    </AppLayout>
  );
}
