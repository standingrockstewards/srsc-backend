/**
 * Admin Knowledge Base Manager
 * Requires: manage_faq permission
 * Features: category CRUD, article editor (title/slug/body/tags/asset-type/service-request toggle), Draft/Publish, preview
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/app-layout";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  BookOpen, Plus, Edit3, Trash2, Eye, EyeOff, Lock,
  ChevronRight, Tag, Link2, Wrench, FileText, Check, X as XIcon,
} from "lucide-react";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";
const SIDEBAR_BG = "#141414";

const ICONS = ["BookOpen","Droplets","Thermometer","ShieldCheck","Anchor","Home","Zap","Wrench","Leaf","Sun","Cloud","AlertTriangle"];
const ASSET_TYPES = ["","hvac_system","water_heater","generator","dock","irrigation","refrigerator","propane_tank","fireplace"];
const SR_CATEGORIES = ["","Seasonal Maintenance","HVAC Maintenance","Plumbing Inspection","Safety Inspection","Dock Inspection","Pest Inspection","Mold Inspection","Storm Damage Assessment","Generator Service"];

// ─── Slugify helper ───────────────────────────────────────────────────────────
function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─── Empty article form ───────────────────────────────────────────────────────
const EMPTY_ART = {
  category_id: "",
  title: "",
  slug: "",
  body: "",
  tags: "",
  status: "draft",
  related_asset_type: "",
  allow_service_request: false,
  service_request_category: "",
};

// ─── Article Editor Modal ─────────────────────────────────────────────────────
function ArticleEditor({
  article, categories, onClose, onSaved,
}: {
  article: any | null;
  categories: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState(article ? {
    ...EMPTY_ART,
    ...article,
    tags: Array.isArray(article.tags) ? article.tags.join(", ") : article.tags ?? "",
    related_asset_type: article.related_asset_type ?? "",
    service_request_category: article.service_request_category ?? "",
  } : EMPTY_ART);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        category_id: Number(form.category_id),
        tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
        allow_service_request: form.allow_service_request,
        related_asset_type: form.related_asset_type || null,
        service_request_category: form.service_request_category || null,
        author_id: user?.id,
      };
      if (article?.id) {
        const r = await apiRequest("PATCH", `/api/faq/articles/${article.id}`, payload);
        return r.json();
      } else {
        const r = await apiRequest("POST", "/api/faq/articles", payload);
        return r.json();
      }
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => setError(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        category_id: Number(form.category_id),
        tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
        allow_service_request: form.allow_service_request,
        related_asset_type: form.related_asset_type || null,
        service_request_category: form.service_request_category || null,
        status: "published",
        author_id: user?.id,
      };
      if (article?.id) {
        const r = await apiRequest("PATCH", `/api/faq/articles/${article.id}`, payload);
        return r.json();
      } else {
        const r = await apiRequest("POST", "/api/faq/articles", payload);
        return r.json();
      }
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => setError(e.message),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-4xl mx-auto my-4 rounded-2xl overflow-hidden"
        style={{ background: "#0f0f0f", border: `1px solid ${CARD_BORDER}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: SIDEBAR_BG, borderBottom: `1px solid ${CARD_BORDER}` }}>
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: TERRACOTTA }} />
            <h2 className="font-bold" style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
              {article ? "Edit Article" : "New Article"}
            </h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-2 ${form.status === "published" ? "bg-green-900/40 text-green-400" : "bg-yellow-900/40 text-yellow-400"}`}>
              {form.status === "published" ? "Published" : "Draft"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab(tab === "edit" ? "preview" : "edit")}
              className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-bold"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: tab === "preview" ? TERRACOTTA : "#777" }}>
              <Eye size={12} /> {tab === "preview" ? "Back to Edit" : "Preview"}
            </button>
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm" style={{ color: "#666" }}>✕</button>
          </div>
        </div>

        {/* Tab: Edit / Preview */}
        <div className="flex-1 overflow-y-auto">
          {tab === "preview" ? (
            <div className="p-6 max-w-2xl mx-auto">
              <div className="mb-4">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TERRACOTTA }}>Preview</span>
              </div>
              {form.allow_service_request && form.service_request_category && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
                  style={{ background: `${TERRACOTTA}12`, border: `1px solid ${TERRACOTTA}33` }}>
                  <Wrench size={16} style={{ color: TERRACOTTA, flexShrink: 0 }} />
                  <div>
                    <div className="text-sm font-bold" style={{ color: CREAM }}>Have Standing Rock handle this</div>
                    <div className="text-xs mt-0.5" style={{ color: "#888" }}>Creates a service request for: {form.service_request_category}</div>
                  </div>
                  <button className="ml-auto text-xs font-bold rounded-lg px-3 py-1.5"
                    style={{ background: TERRACOTTA, color: "#fff" }}>
                    Request Service
                  </button>
                </div>
              )}
              <MarkdownRenderer content={form.body || "*Article body is empty*"} />
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && (
                <div className="col-span-2 text-sm rounded-xl px-3 py-2" style={{ background: "rgba(192,90,67,0.1)", color: TERRACOTTA }}>{error}</div>
              )}

              {/* Left column: metadata */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Title *</label>
                  <input value={form.title} onChange={e => { set("title", e.target.value); if (!article) set("slug", slugify(e.target.value)); }}
                    placeholder="How to Winterize Your Waterline"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Slug (URL) *</label>
                  <input value={form.slug} onChange={e => set("slug", e.target.value)}
                    placeholder="how-to-winterize-your-waterline"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none font-mono"
                    style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: "#aaa" }} />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Category *</label>
                  <select value={form.category_id} onChange={e => set("category_id", e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                    style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                    <option value="">Select category…</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Tags (comma-separated)</label>
                  <input value={form.tags} onChange={e => set("tags", e.target.value)}
                    placeholder="hvac, filter, maintenance"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Related Asset Type</label>
                  <select value={form.related_asset_type} onChange={e => set("related_asset_type", e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                    style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t || "None"}</option>)}
                  </select>
                </div>

                <div className="rounded-xl p-3 space-y-3" style={{ background: "#141414", border: `1px solid ${CARD_BORDER}` }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div onClick={() => set("allow_service_request", !form.allow_service_request)}
                      className="w-9 h-5 rounded-full transition-colors flex items-center"
                      style={{ background: form.allow_service_request ? TERRACOTTA : "#333", padding: "2px" }}>
                      <div className="w-4 h-4 rounded-full bg-white transition-transform"
                        style={{ transform: form.allow_service_request ? "translateX(16px)" : "translateX(0)" }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: CREAM }}>"Have Standing Rock do this" button</span>
                  </label>
                  {form.allow_service_request && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>Service Request Category</label>
                      <select value={form.service_request_category} onChange={e => set("service_request_category", e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none appearance-none"
                        style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
                        {SR_CATEGORIES.map(c => <option key={c} value={c}>{c || "Select…"}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: body editor */}
              <div className="flex flex-col">
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#666" }}>
                  Article Body (Markdown) *
                </label>
                <textarea value={form.body} onChange={e => set("body", e.target.value)}
                  placeholder="# Article Title&#10;&#10;Write your how-to content here in Markdown..."
                  rows={20}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none font-mono resize-y"
                  style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: "#ccc", minHeight: 300, lineHeight: 1.6 }} />
                <div className="text-xs mt-1" style={{ color: "#444" }}>
                  Supports: # headings, **bold**, *italic*, `code`, &gt; blockquote, - lists, | tables, [link](url)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 flex flex-wrap gap-3 items-center justify-between"
          style={{ background: SIDEBAR_BG, borderTop: `1px solid ${CARD_BORDER}` }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#666" }}>Cancel</button>
          <div className="flex gap-3">
            <button onClick={() => { set("status", "draft"); mutation.mutate(); }}
              disabled={mutation.isPending}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: "#252525", border: `1px solid #444`, color: "#aaa", opacity: mutation.isPending ? 0.6 : 1 }}>
              {mutation.isPending ? "Saving…" : "Save as Draft"}
            </button>
            <button onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: SAGE, color: "#fff", opacity: publishMutation.isPending ? 0.6 : 1 }}>
              {publishMutation.isPending ? "Publishing…" : "✓ Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category Manager ─────────────────────────────────────────────────────────
function CategoryManager({ categories, onRefresh }: { categories: any[]; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("BookOpen");

  const createMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/faq/categories", { name: newName, icon: newIcon, sort_order: categories.length + 1 });
    },
    onSuccess: () => { onRefresh(); setAdding(false); setNewName(""); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/faq/categories/${id}`);
    },
    onSuccess: onRefresh,
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: TERRACOTTA }}>Categories</span>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: "#888" }}>
          <Plus size={11} /> Add
        </button>
      </div>
      {adding && (
        <div className="p-3 flex gap-2 items-center" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Category name"
            className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none"
            style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }} />
          <select value={newIcon} onChange={e => setNewIcon(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-sm outline-none appearance-none"
            style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: CREAM }}>
            {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <button onClick={() => createMut.mutate()} className="text-xs font-bold rounded-lg px-3 py-1.5"
            style={{ background: TERRACOTTA, color: "#fff" }}>Save</button>
          <button onClick={() => setAdding(false)} style={{ color: "#666" }}>✕</button>
        </div>
      )}
      <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
        {categories.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-2.5" style={{ background: CARD_BG }}>
            <span className="text-sm" style={{ color: CREAM }}>{c.name}</span>
            <button onClick={() => deleteMut.mutate(c.id)} className="text-xs hover:text-red-400" style={{ color: "#444" }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminKnowledgeBasePage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canManage = can("manage_faq");

  const [editing, setEditing] = useState<any | null | "new">(null);
  const [filterCat, setFilterCat] = useState<number | "all">("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: categories = [], refetch: refetchCats } = useQuery<any[]>({
    queryKey: ["/api/faq/categories"],
    queryFn: async () => (await apiRequest("GET", "/api/faq/categories")).json(),
  });

  const { data: articles = [], refetch: refetchArts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/faq/articles", "admin-all"],
    queryFn: async () => (await apiRequest("GET", "/api/faq/articles")).json(),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/faq/articles/${id}`);
    },
    onSuccess: () => refetchArts(),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/faq/articles/${id}`, { status });
    },
    onSuccess: () => refetchArts(),
  });

  if (!canManage) {
    return (
      <AppLayout title="Knowledge Base Manager">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Lock size={40} style={{ color: "#333", margin: "0 auto 12px" }} />
            <p style={{ color: "#666" }}>You don't have the manage_faq permission.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const filtered = articles.filter((a: any) => {
    if (filterCat !== "all" && a.category_id !== filterCat) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <AppLayout title="Knowledge Base" subtitle="Manage how-to articles for clients">
      {(editing === "new" || (editing && typeof editing === "object")) && (
        <ArticleEditor
          article={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { refetchArts(); qc.invalidateQueries({ queryKey: ["/api/faq/articles"] }); }}
        />
      )}

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"
              style={{ color: CREAM, fontFamily: "'Playfair Display', serif" }}>
              <BookOpen size={20} style={{ color: TERRACOTTA }} /> Knowledge Base
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#888" }}>{articles.length} article{articles.length !== 1 ? "s" : ""} · {categories.length} categories</p>
          </div>
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ background: TERRACOTTA, color: "#fff" }}>
            <Plus size={14} /> New Article
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar: categories */}
          <div className="lg:col-span-1">
            <CategoryManager categories={categories} onRefresh={() => refetchCats()} />
          </div>

          {/* Main: article list */}
          <div className="lg:col-span-3 space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterStatus("all")}
                className="text-xs font-bold rounded-full px-3 py-1"
                style={{ background: filterStatus === "all" ? `${TERRACOTTA}22` : CARD_BG, border: `1px solid ${filterStatus === "all" ? TERRACOTTA : CARD_BORDER}`, color: filterStatus === "all" ? TERRACOTTA : "#777" }}>
                All
              </button>
              {["published","draft"].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="text-xs font-bold rounded-full px-3 py-1 capitalize"
                  style={{ background: filterStatus === s ? `${s === "published" ? "#4a9a6a" : "#D9902B"}22` : CARD_BG, border: `1px solid ${filterStatus === s ? (s === "published" ? "#4a9a6a" : "#D9902B") : CARD_BORDER}`, color: filterStatus === s ? (s === "published" ? "#4a9a6a" : "#D9902B") : "#777" }}>
                  {s}
                </button>
              ))}
              <div className="ml-auto">
                <select value={filterCat} onChange={e => setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="text-xs rounded-lg px-2.5 py-1.5 outline-none appearance-none"
                  style={{ background: "#1a1a1a", border: `1px solid ${CARD_BORDER}`, color: "#aaa" }}>
                  <option value="all">All categories</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Article table */}
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: CARD_BG }} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#555" }}>No articles found. Create one to get started.</div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${CARD_BORDER}` }}>
                {filtered.map((a: any, i: number) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ background: i % 2 === 0 ? CARD_BG : "#1e1e1e", borderBottom: i < filtered.length - 1 ? `1px solid #1a1a1a` : "none" }}>
                    {/* Status dot */}
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: a.status === "published" ? "#4a9a6a" : "#D9902B" }} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: CREAM }}>{a.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: "#555" }}>{a.category_name}</span>
                        {a.related_asset_type && (
                          <span className="text-xs font-mono" style={{ color: "#444" }}>{a.related_asset_type}</span>
                        )}
                        {a.allow_service_request === 1 && (
                          <span className="text-xs" style={{ color: TERRACOTTA }}>⚡ SR</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggleStatus.mutate({ id: a.id, status: a.status === "published" ? "draft" : "published" })}
                        title={a.status === "published" ? "Unpublish" : "Publish"}
                        className="text-xs rounded-lg px-2.5 py-1 font-bold"
                        style={{ background: a.status === "published" ? "#4a9a6a22" : "#D9902B22", color: a.status === "published" ? "#4a9a6a" : "#D9902B", border: `1px solid ${a.status === "published" ? "#4a9a6a33" : "#D9902B33"}` }}>
                        {a.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => setEditing(a)}
                        className="p-1.5 rounded-lg hover:bg-white/10" style={{ color: "#666" }}>
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => { if (confirm(`Delete "${a.title}"?`)) deleteMut.mutate(a.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-900/20" style={{ color: "#444" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
