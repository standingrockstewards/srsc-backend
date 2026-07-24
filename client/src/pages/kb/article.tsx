/**
 * Knowledge Base — Article Reader
 * Full article view with: breadcrumbs, markdown body, "Have Standing Rock do this" CTA,
 * related articles, asset-aware context panel for matching client appliances.
 */
import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  BookOpen, ChevronRight, Wrench, ChevronLeft, Tag, Check,
  Cpu, AlertCircle, X as XIcon,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SIDEBAR_BG = "#141414";

// ─── Service Request Modal ────────────────────────────────────────────────────
function ServiceRequestModal({
  article, onClose, onCreated,
}: { article: any; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Get the client's properties
  const { data: myProperties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties/mine", user?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/mine?clientUserId=${user?.id}`);
      return r.json();
    },
    enabled: !!user?.id && user.role === "client",
  });

  // Admins/supervisors pick from all properties
  const { data: allProperties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => (await apiRequest("GET", "/api/properties")).json(),
    enabled: !!user && ["admin","supervisor"].includes(user.role),
  });

  const properties = user?.role === "client" ? myProperties : allProperties;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!propertyId) throw new Error("Please select a property");
      const prop = properties.find((p: any) => p.id === Number(propertyId));
      const clientId = prop?.clientUserId ?? user?.id;
      const r = await apiRequest("POST", "/api/service-requests", {
        property_id: Number(propertyId),
        client_id: clientId,
        category: article.service_request_category || "General Maintenance",
        description: `From Knowledge Base: "${article.title}"\n\n${note || "Please handle this on my behalf."}`,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to create request");
      return data;
    },
    onSuccess: () => { setSuccess(true); onCreated(); },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative rounded-2xl overflow-hidden w-full max-w-lg"
        style={{ background: "#141414", border: `1px solid ${CARD_BORDER}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center gap-2">
            <Wrench size={16} style={{ color: TERRACOTTA }} />
            <h3 className="font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
              Request Standing Rock to Handle This
            </h3>
          </div>
          <button onClick={onClose} style={{ color: "#666" }}>✕</button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="rounded-full p-3 mx-auto mb-3 w-fit" style={{ background: `${SAGE}22` }}>
              <Check size={28} style={{ color: SAGE }} />
            </div>
            <h4 className="font-bold text-lg mb-1" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>Request Submitted</h4>
            <p className="text-sm" style={{ color: "#888" }}>We've received your request and will be in touch shortly.</p>
            <button onClick={onClose} className="mt-4 rounded-xl px-5 py-2.5 text-sm font-bold"
              style={{ background: TERRACOTTA, color: "#fff" }}>Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Article info */}
            <div className="rounded-xl px-4 py-3" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: TERRACOTTA }}>Service Type</div>
              <div className="font-semibold text-sm" style={{ color: CREAM }}>
                {article.service_request_category || "General Maintenance"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#666" }}>From: {article.title}</div>
            </div>

            {error && (
              <div className="text-sm rounded-xl px-3 py-2" style={{ background: "rgba(192,90,67,0.1)", color: TERRACOTTA }}>
                <AlertCircle size={12} className="inline mr-1" />{error}
              </div>
            )}

            {/* Property selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#666" }}>Property</label>
              {properties.length === 0 ? (
                <p className="text-sm" style={{ color: "#555" }}>No properties found.</p>
              ) : properties.length === 1 ? (
                <div className="rounded-xl px-3 py-2.5 text-sm font-semibold"
                  style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
                  onClick={() => setPropertyId((properties[0] as any).id)}>
                  {(properties[0] as any).name}
                  {propertyId === "" && (() => { setPropertyId((properties[0] as any).id); return null; })()}
                </div>
              ) : (
                <select value={propertyId} onChange={e => setPropertyId(Number(e.target.value))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none appearance-none"
                  style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                  <option value="">Select property…</option>
                  {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>

            {/* Optional note */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#666" }}>Additional Notes (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Any details that would help our team…"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold"
                style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#777" }}>Cancel</button>
              <button onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold"
                style={{ background: TERRACOTTA, color: "#fff", opacity: mutation.isPending ? 0.6 : 1 }}>
                {mutation.isPending ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Article Page ────────────────────────────────────────────────────────
export default function KBArticlePage() {
  const [, params] = useRoute("/kb/:slug");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showSRModal, setShowSRModal] = useState(false);
  const [srCreated, setSrCreated] = useState(false);
  const qc = useQueryClient();

  const slug = params?.slug ?? "";

  const { data: article, isLoading, error } = useQuery<any>({
    queryKey: ["/api/faq/articles", slug],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/faq/articles/${slug}`);
      if (!r.ok) throw new Error("Article not found");
      return r.json();
    },
    enabled: !!slug,
  });

  // Asset-awareness: load client's appliances for matching
  const { data: myProperties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties/mine", user?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/mine?clientUserId=${user?.id}`);
      return r.json();
    },
    enabled: !!user?.id && user.role === "client" && !!article?.related_asset_type,
  });

  const firstProperty = myProperties[0];

  const { data: appliances = [] } = useQuery<any[]>({
    queryKey: ["/api/properties", firstProperty?.id, "appliances"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/properties/${firstProperty.id}/appliances`);
      return r.json();
    },
    enabled: !!firstProperty?.id && !!article?.related_asset_type,
  });

  // Match appliances to article's asset type
  const matchingAppliances = appliances.filter((ap: any) => {
    if (!article?.related_asset_type) return false;
    const name = ap.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return name.includes(article.related_asset_type.replace(/_/g, "")) ||
           article.related_asset_type.includes(name.split("_")[0]);
  });

  if (isLoading) {
    return (
      <AppLayout title="Knowledge Base">
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-8 animate-pulse rounded-xl" style={{ background: CARD_BG }} />)}
        </div>
      </AppLayout>
    );
  }

  if (error || !article) {
    return (
      <AppLayout title="Knowledge Base">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle size={40} style={{ color: "#333", margin: "0 auto 12px" }} />
            <p style={{ color: "#666" }}>Article not found.</p>
            <button onClick={() => setLocation("/kb")} className="mt-3 text-sm underline" style={{ color: TERRACOTTA }}>
              Back to Knowledge Base
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={article.title}>
      {showSRModal && (
        <ServiceRequestModal
          article={article}
          onClose={() => setShowSRModal(false)}
          onCreated={() => {
            setSrCreated(true);
            qc.invalidateQueries({ queryKey: ["/api/service-requests"] });
          }}
        />
      )}

      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Main content */}
          <div className="lg:col-span-3">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs mb-5 flex-wrap">
              <button onClick={() => setLocation("/kb")} className="hover:underline" style={{ color: TERRACOTTA }}>Knowledge Base</button>
              <ChevronRight size={12} style={{ color: "#444" }} />
              <span style={{ color: "#666" }}>{article.category_name}</span>
              <ChevronRight size={12} style={{ color: "#444" }} />
              <span style={{ color: "#888" }}>{article.title}</span>
            </div>

            {/* Asset-aware context panel */}
            {matchingAppliances.length > 0 && (
              <div className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
                style={{ background: `${SAGE}10`, border: `1px solid ${SAGE}33` }}>
                <Cpu size={16} style={{ color: SAGE, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="text-sm font-bold" style={{ color: CREAM }}>Your Equipment</div>
                  <div className="text-sm mt-0.5" style={{ color: "#aaa" }}>
                    This guide applies to your{" "}
                    {matchingAppliances.map((ap: any, i: number) => (
                      <span key={ap.id}>
                        <strong style={{ color: CREAM }}>{ap.make} {ap.model}</strong>
                        {i < matchingAppliances.length - 1 ? " and " : ""}
                      </span>
                    ))}{" "}
                    at {firstProperty?.name}.
                  </div>
                </div>
              </div>
            )}

            {/* "Have Standing Rock do this" CTA */}
            {article.allow_service_request === 1 && (
              <div className="flex items-center gap-4 rounded-2xl px-5 py-4 mb-6"
                style={{ background: `${TERRACOTTA}10`, border: `1px solid ${TERRACOTTA}33` }}>
                <div className="rounded-full p-2.5 flex-shrink-0" style={{ background: `${TERRACOTTA}20` }}>
                  <Wrench size={18} style={{ color: TERRACOTTA }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base" style={{ color: CREAM }}>
                    Have Standing Rock handle this
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: "#888" }}>
                    We'll take care of it so you don't have to.
                    {srCreated && <span style={{ color: SAGE }}> ✓ Request submitted!</span>}
                  </div>
                </div>
                {!srCreated && (
                  <button onClick={() => setShowSRModal(true)}
                    className="flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold"
                    style={{ background: TERRACOTTA, color: "#fff" }}>
                    Request Service
                  </button>
                )}
              </div>
            )}

            {/* Article body */}
            <div className="rounded-2xl px-5 py-6" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <MarkdownRenderer content={article.body} />
            </div>

            {/* Tags */}
            {article.tags?.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <Tag size={12} style={{ color: "#555" }} />
                {article.tags.map((t: string) => (
                  <span key={t} className="text-xs rounded-full px-2.5 py-0.5"
                    style={{ background: "#222", color: "#777", border: "1px solid #333" }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Back button */}
            <button onClick={() => setLocation("/kb")}
              className="flex items-center gap-2 text-sm rounded-xl px-3 py-2 w-full"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#777" }}>
              <ChevronLeft size={14} />All Articles
            </button>

            {/* Related articles */}
            {article.related?.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
                <div className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide"
                  style={{ background: "#141414", color: TERRACOTTA, borderBottom: `1px solid ${CARD_BORDER}` }}>
                  Related Articles
                </div>
                <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
                  {article.related.map((r: any) => (
                    <button key={r.id} onClick={() => setLocation(`/kb/${r.slug}`)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white/5 transition-colors">
                      <BookOpen size={12} style={{ color: "#555", flexShrink: 0, marginTop: 3 }} />
                      <span className="text-sm" style={{ color: "#ccc", lineHeight: 1.4 }}>{r.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Article meta */}
            <div className="rounded-xl px-3 py-3 space-y-2" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#555" }}>About This Article</div>
              <div className="text-xs" style={{ color: "#555" }}>
                <span style={{ color: "#777" }}>Category:</span> {article.category_name}
              </div>
              {article.related_asset_type && (
                <div className="text-xs" style={{ color: "#555" }}>
                  <span style={{ color: "#777" }}>Asset type:</span> {article.related_asset_type.replace(/_/g, " ")}
                </div>
              )}
              <div className="text-xs" style={{ color: "#555" }}>
                <span style={{ color: "#777" }}>Updated:</span>{" "}
                {new Date(article.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
