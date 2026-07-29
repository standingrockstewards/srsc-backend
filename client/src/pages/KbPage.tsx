/**
 * src/pages/KbPage.tsx  (Brick 10i)
 *
 * Knowledge Base — browse, search, category + tag filter, article reader.
 *
 * Role access: admin, supervisor, client, field_tech (vendor → blocked at route level).
 * Draft articles: visible only to admin/supervisor (API enforces; UI hides draft badge from others).
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KbCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

interface KbArticle {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  bodyMd: string;
  tags: string[];
  assetType: string | null;
  status: "draft" | "published";
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Markdown renderer (simple, no dependency) ─────────────────────────────────

function renderMarkdown(md: string): string {
  return md
    // headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // horizontal rule
    .replace(/^---+$/gm, "<hr>")
    // unordered lists (runs of lines starting with - or *)
    .replace(/((?:^[-*] .+\n?)+)/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^[-*] /, "")}</li>`).join("");
      return `<ul>${items}</ul>`;
    })
    // ordered lists
    .replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
      return `<ol>${items}</ol>`;
    })
    // blockquote
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // double newlines → paragraph breaks
    .replace(/\n\n+/g, "</p><p>")
    // wrap in paragraph
    .replace(/^(?!<[h1-6ulob])/gm, "")
    // clean up stray single newlines inside paragraphs
    .replace(/([^>])\n([^<])/g, "$1 $2");
}

// ── Asset type badge color ────────────────────────────────────────────────────

const ASSET_COLORS: Record<string, string> = {
  guide:      "#2563eb",
  tip:        "#059669",
  regulation: "#dc2626",
  "how-to":   "#7c3aed",
  faq:        "#d97706",
  alert:      "#be185d",
};

function assetBadge(type: string | null) {
  if (!type) return null;
  const bg = ASSET_COLORS[type] ?? "#4b5563";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        backgroundColor: bg,
        color: "#fff",
        marginRight: 6,
        verticalAlign: "middle",
      }}
    >
      {type}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function KbPage() {
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "supervisor";

  const [categories,    setCategories]    = useState<KbCategory[]>([]);
  const [articles,      setArticles]      = useState<KbArticle[]>([]);
  const [allTags,       setAllTags]       = useState<string[]>([]);
  const [selectedCat,   setSelectedCat]   = useState<string>("");
  const [selectedTag,   setSelectedTag]   = useState<string>("");
  const [search,        setSearch]        = useState<string>("");
  const [statusFilter,  setStatusFilter]  = useState<"published" | "draft" | "all">("published");
  const [openArticle,   setOpenArticle]   = useState<KbArticle | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [artLoading,    setArtLoading]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // ── Load categories + tags on mount ───────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiFetch("/kb/categories"),
      apiFetch("/kb/articles/tags"),
    ])
      .then(([cats, tags]) => {
        setCategories(cats as KbCategory[]);
        setAllTags(tags as string[]);
      })
      .catch(() => setError("Failed to load knowledge base."));
  }, []);

  // ── Load articles when filters change ─────────────────────────────────────
  const loadArticles = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCat)  params.set("category", selectedCat);
    if (selectedTag)  params.set("tag",      selectedTag);
    if (search)       params.set("search",   search);
    if (isStaff)      params.set("status",   statusFilter);
    apiFetch(`/kb/articles?${params.toString()}`)
      .then((data) => { setArticles(data as KbArticle[]); setLoading(false); })
      .catch(() => { setError("Failed to load articles."); setLoading(false); });
  }, [selectedCat, selectedTag, search, statusFilter, isStaff]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  // ── Open article ──────────────────────────────────────────────────────────
  const openArticleById = (id: string) => {
    setArtLoading(true);
    apiFetch(`/kb/articles/${id}`)
      .then((data) => { setOpenArticle(data as KbArticle); setArtLoading(false); })
      .catch(() => { setArtLoading(false); });
  };

  const catName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "—";

  // ── Article detail view ───────────────────────────────────────────────────
  if (openArticle) {
    return (
      <div className="page-content">
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          {/* Back */}
          <button
            className="btn btn--ghost"
            style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setOpenArticle(null)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            Back to Knowledge Base
          </button>

          {/* Meta row */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {assetBadge(openArticle.assetType)}
            <span style={{ fontSize: 13, color: "var(--text-muted, #9ca3af)" }}>
              {catName(openArticle.categoryId)}
            </span>
            {openArticle.status === "draft" && isStaff && (
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase" as const, color: "#f59e0b",
                border: "1px solid #f59e0b", borderRadius: 4, padding: "1px 6px",
              }}>
                Draft
              </span>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 700, marginBottom: 12, lineHeight: 1.25 }}>
            {openArticle.title}
          </h1>

          {/* Author / date */}
          <p style={{ fontSize: 13, color: "var(--text-muted, #9ca3af)", marginBottom: 24 }}>
            By {openArticle.authorName}
            {openArticle.publishedAt
              ? ` · Published ${new Date(openArticle.publishedAt).toLocaleDateString()}`
              : ` · Updated ${new Date(openArticle.updatedAt).toLocaleDateString()}`
            }
          </p>

          {/* Tags */}
          {openArticle.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
              {openArticle.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 12, padding: "2px 8px", borderRadius: 12,
                    background: "var(--surface-2, rgba(255,255,255,0.06))",
                    color: "var(--text-muted, #9ca3af)",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Body */}
          <div
            className="kb-article-body"
            dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(openArticle.bodyMd || "_No content yet._")}</p>` }}
            style={{
              lineHeight: 1.75,
              fontSize: 15,
              color: "var(--text-primary, #f1f5f9)",
            }}
          />
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Knowledge Base</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted, #9ca3af)" }}>
            Lake life, fishing, hunting, property care, and more.
          </p>
        </div>
        {isStaff && (
          <a href="/kb/editor" className="btn btn--primary" style={{ textDecoration: "none", fontSize: 14 }}>
            New Article
          </a>
        )}
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 20 }}>{error}</div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        {/* Search */}
        <input
          className="input"
          type="search"
          placeholder="Search articles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 200px", minWidth: 160 }}
          aria-label="Search articles"
        />

        {/* Category filter */}
        <select
          className="input"
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          style={{ flex: "0 0 auto", minWidth: 160 }}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <select
            className="input"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            style={{ flex: "0 0 auto", minWidth: 140 }}
            aria-label="Filter by tag"
          >
            <option value="">All Tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Status filter — admin/supervisor only */}
        {isStaff && (
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            style={{ flex: "0 0 auto", minWidth: 140 }}
            aria-label="Filter by status"
          >
            <option value="published">Published</option>
            <option value="draft">Drafts Only</option>
            <option value="all">All (Draft + Published)</option>
          </select>
        )}
      </div>

      {/* Category quick pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        <button
          className={`btn ${!selectedCat ? "btn--primary" : "btn--ghost"}`}
          style={{ fontSize: 13, padding: "4px 14px" }}
          onClick={() => setSelectedCat("")}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`btn ${selectedCat === c.id ? "btn--primary" : "btn--ghost"}`}
            style={{ fontSize: 13, padding: "4px 14px" }}
            onClick={() => setSelectedCat(selectedCat === c.id ? "" : c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Article grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="skeleton" style={{ height: 130, borderRadius: 10 }} />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted, #6b7280)" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p style={{ margin: 0, fontSize: 14 }}>
            {search || selectedCat || selectedTag
              ? "No articles match your filters."
              : "No articles published yet."}
          </p>
          {isStaff && !search && !selectedCat && !selectedTag && (
            <a href="/kb/editor" style={{ marginTop: 12, display: "inline-block", fontSize: 14, color: "var(--accent, #14b8a6)" }}>
              Create the first article →
            </a>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {articles.map((art) => (
            <button
              key={art.id}
              className="card card--interactive"
              style={{
                textAlign: "left",
                padding: "18px 20px",
                border: "none",
                cursor: "pointer",
                width: "100%",
                position: "relative",
              }}
              onClick={() => openArticleById(art.id)}
            >
              {/* Draft badge */}
              {art.status === "draft" && isStaff && (
                <span style={{
                  position: "absolute", top: 12, right: 12,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                  textTransform: "uppercase" as const, color: "#f59e0b",
                  border: "1px solid #f59e0b", borderRadius: 4, padding: "1px 5px",
                }}>
                  Draft
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {assetBadge(art.assetType)}
                <span style={{ fontSize: 12, color: "var(--text-muted, #9ca3af)" }}>
                  {catName(art.categoryId)}
                </span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>
                {art.title}
              </div>
              {art.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {art.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 11, padding: "1px 6px", borderRadius: 10,
                        background: "var(--surface-2, rgba(255,255,255,0.05))",
                        color: "var(--text-muted, #9ca3af)",
                        border: "1px solid var(--border, rgba(255,255,255,0.06))",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  {art.tags.length > 3 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted, #6b7280)" }}>
                      +{art.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted, #6b7280)" }}>
                {art.publishedAt
                  ? new Date(art.publishedAt).toLocaleDateString()
                  : `Updated ${new Date(art.updatedAt).toLocaleDateString()}`
                }
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
