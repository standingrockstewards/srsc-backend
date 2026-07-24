/**
 * Property Document Vault Tab
 * Staff: all docs + upload + visibility toggle + delete
 * Client: client_visible docs only + download
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Download, Trash2, Eye, EyeOff, RefreshCw, Lock, File, FolderOpen } from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SERIF = "var(--font-serif)";
const SANS = "var(--font-sans)";
const MUTED = "rgba(245,240,234,0.45)";

const DOC_TYPES = [
  { value: "contract", label: "Contract" },
  { value: "tos_acceptance", label: "ToS Acceptance" },
  { value: "inspection_report", label: "Inspection Report" },
  { value: "after_action_report", label: "After-Action Report" },
  { value: "quote_document", label: "Quote Document" },
  { value: "coi", label: "COI (Staff Only)" },
  { value: "w9", label: "W-9 (Staff Only)" },
  { value: "appliance_manual", label: "Appliance Manual" },
  { value: "other", label: "Other" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function FileIcon({ mime }: { mime?: string }) {
  if (!mime) return <File size={16} style={{ color: MUTED }} />;
  if (mime.includes("pdf")) return <FileText size={16} style={{ color: TERRACOTTA }} />;
  if (mime.includes("image")) return <File size={16} style={{ color: SAGE }} />;
  return <File size={16} style={{ color: MUTED }} />;
}

interface PropertyDocumentsTabProps {
  propertyId: number;
}

export function PropertyDocumentsTab({ propertyId }: PropertyDocumentsTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isStaff = user?.role === "admin" || user?.role === "supervisor";

  const [uploadForm, setUploadForm] = useState({ title: "", docType: "other", visibility: "staff_only" });
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["property-documents", propertyId],
    queryFn: () => apiRequest("GET", `/api/properties/${propertyId}/documents`).then(r => r.json()),
    staleTime: 0,
  });

  const docs: any[] = data?.documents ?? [];

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => apiRequest("DELETE", `/api/properties/${propertyId}/documents/${docId}`),
    onSuccess: () => {
      toast({ title: "Document deleted" });
      qc.invalidateQueries({ queryKey: ["property-documents", propertyId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ docId, visibility }: { docId: number; visibility: string }) =>
      apiRequest("PATCH", `/api/properties/${propertyId}/documents/${docId}`, { visibility }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["property-documents", propertyId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileData = reader.result as string;
        await apiRequest("POST", `/api/properties/${propertyId}/documents`, {
          docType: uploadForm.docType,
          title: uploadForm.title || file.name,
          fileData,
          fileName: file.name,
          fileMime: file.type,
          visibility: isStaff ? uploadForm.visibility : "client_visible",
        });
        toast({ title: "Document uploaded" });
        qc.invalidateQueries({ queryKey: ["property-documents", propertyId] });
        setUploadForm({ title: "", docType: "other", visibility: "staff_only" });
        setShowUpload(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const result = await apiRequest("GET", `/api/properties/${propertyId}/documents/${doc.id}/download`);
      if (result.fileData) {
        const a = document.createElement("a");
        a.href = result.fileData;
        a.download = result.fileName ?? doc.title;
        a.click();
      } else {
        toast({ title: "No file", description: "This document has no file attached.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} style={{ color: TERRACOTTA }} />
          <span className="font-semibold text-base" style={{ color: CREAM, fontFamily: SERIF }}>Document Vault</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${TERRACOTTA}22`, color: TERRACOTTA }}>{docs.length}</span>
        </div>
        {(isStaff || user?.role === "client") && (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: showUpload ? `${TERRACOTTA}22` : "#222", color: showUpload ? TERRACOTTA : MUTED, fontFamily: SANS }}
          >
            <Upload size={14} /> Upload
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="rounded-xl p-4 mb-4" style={{ background: "#141414", border: `1px solid ${TERRACOTTA}33` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: CREAM, fontFamily: SERIF }}>Upload Document</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Title (optional — defaults to filename)</label>
              <input
                value={uploadForm.title}
                onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Document title"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: "#1a1a1a", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Type</label>
                <select
                  value={uploadForm.docType}
                  onChange={e => setUploadForm(f => ({ ...f, docType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ background: "#1a1a1a", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}
                >
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {isStaff && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: MUTED, fontFamily: SANS }}>Visibility</label>
                  <select
                    value={uploadForm.visibility}
                    onChange={e => setUploadForm(f => ({ ...f, visibility: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: "#1a1a1a", color: CREAM, borderColor: CARD_BORDER, fontFamily: SANS }}
                  >
                    <option value="staff_only">Staff Only</option>
                    <option value="client_visible">Client Visible</option>
                  </select>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.txt" className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: TERRACOTTA, color: CREAM, fontFamily: SANS }}
            >
              {uploading ? <><RefreshCw size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Choose File</>}
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {isLoading && (
        <div className="flex items-center gap-2 py-8 justify-center">
          <RefreshCw size={16} className="animate-spin" style={{ color: MUTED }} />
          <span style={{ color: MUTED, fontFamily: SANS, fontSize: 14 }}>Loading…</span>
        </div>
      )}

      {!isLoading && docs.length === 0 && (
        <div className="text-center py-12 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <FolderOpen size={32} style={{ color: MUTED, margin: "0 auto 10px" }} />
          <p className="text-sm" style={{ color: MUTED, fontFamily: SANS }}>No documents yet</p>
        </div>
      )}

      <div className="space-y-2">
        {docs.map((doc: any) => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <FileIcon mime={doc.file_mime} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: CREAM, fontFamily: SANS }}>{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: MUTED }}>{DOC_TYPES.find(t => t.value === doc.doc_type)?.label ?? doc.doc_type}</span>
                <span className="text-xs" style={{ color: MUTED }}>·</span>
                <span className="text-xs" style={{ color: MUTED }}>{fmtDate(doc.created_at)}</span>
                {isStaff && (
                  <span className="text-xs flex items-center gap-0.5 ml-1" style={{ color: doc.visibility === "client_visible" ? SAGE : MUTED }}>
                    {doc.visibility === "client_visible" ? <Eye size={11} /> : <Lock size={11} />}
                    {doc.visibility === "client_visible" ? "Client visible" : "Staff only"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {doc.file_name && (
                <button onClick={() => handleDownload(doc)} className="p-1.5 rounded-lg hover:bg-white/10" title="Download">
                  <Download size={14} style={{ color: SAGE }} />
                </button>
              )}
              {isStaff && (
                <>
                  <button
                    onClick={() => toggleVisibility.mutate({ docId: doc.id, visibility: doc.visibility === "staff_only" ? "client_visible" : "staff_only" })}
                    className="p-1.5 rounded-lg hover:bg-white/10"
                    title={doc.visibility === "staff_only" ? "Make client-visible" : "Make staff-only"}
                  >
                    {doc.visibility === "staff_only" ? <EyeOff size={14} style={{ color: MUTED }} /> : <Eye size={14} style={{ color: SAGE }} />}
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }}
                    className="p-1.5 rounded-lg hover:bg-white/10"
                    title="Delete"
                  >
                    <Trash2 size={14} style={{ color: TERRACOTTA }} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
