/**
 * client/src/pages/KbCategoryPage.tsx  (Brick 10k)
 *
 * Public KB category page — lists article cards for one category.
 * Route: /kb/category/:slug  (outside RequireAuth)
 *
 * Fetches:
 *   GET /kb/categories               → find the category by slug for title/desc
 *   GET /kb/articles?category=<slug> → published articles for this category
 *
 * Empty state rendered when no articles found for the slug.
 * 404 state rendered when slug is unrecognized.
 * No auth calls made from this page.
 */

import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { KbShell } from "@/components/KbShell";
import { fetchCategories, fetchArticles } from "@/lib/kbApi";
import { mdExcerpt } from "@/lib/kbMarkdown";
import type { KbCategory, KbArticle } from "@/lib/kbTypes";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--bg-card, #1e2535)",
        border: "1px solid var(--border, #242c3e)",
        borderRadius: 10,
        padding: "20px 22px",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      <div style={{ height: 16, background: "var(--border, #242c3e)", borderRadius: 4, marginBottom: 10, width: "60%" }} />
      <div style={{ height: 12, background: "var(--border, #242c3e)", borderRadius: 4, marginBottom: 6, width: "90%" }} />
      <div style={{ height: 12, background: "var(--border, #242c3e)", borderRadius: 4, width: "70%" }} />
    </div>
  );
}

// ── Article card ──────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: KbArticle }) {
  const excerpt = mdExcerpt(article.bodyMd);

  return (
    <Link
      to={`/kb/${article.slug}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          background: "var(--bg-card, #1e2535)",
          border: "1px solid var(--border, #242c3e)",
          borderRadius: 10,
          padding: "20px 22px",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent, #2b9e8e)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border, #242c3e)")}
      >
        {/* Type + tag row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {article.assetType && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--accent, #2b9e8e)",
                background: "var(--accent-dim, rgba(43,158,142,0.15))",
                padding: "1px 7px",
                borderRadius: 4,
              }}
            >
              {article.assetType}
            </span>
          )}
          {article.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                color: "var(--text-muted, #525d6e)",
                background: "var(--bg-input, #252d3d)",
                padding: "1px 6px",
                borderRadius: 10,
              }}
            >
              {t}
            </span>
          ))}
        </div>

        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, lineHeight: 1.3 }}>
          {article.title}
        </div>

        {excerpt && (
          <div style={{ fontSize: 13, color: "var(--text-secondary, #8b96a8)", lineHeight: 1.6 }}>
            {excerpt}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted, #525d6e)" }}>
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString()
              : new Date(article.updatedAt).toLocaleDateString()
            }
          </span>
          <span style={{ fontSize: 12, color: "var(--accent, #2b9e8e)" }}>
            Read →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function KbCategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<KbCategory | null>(null);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    setLoading(true);
    setNotFound(false);
    setError(null);

    Promise.all([
      fetchCategories(),
      fetchArticles({ category: slug }),
    ])
      .then(([cats, arts]) => {
        const cat = cats.find((c) => c.slug === slug);
        if (!cat) { setNotFound(true); setLoading(false); return; }
        setCategory(cat);
        setArticles(arts);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load category.");
        setLoading(false);
      });
  }, [slug]);

  return (
    <KbShell>
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-muted, #525d6e)",
          marginBottom: 28,
        }}
      >
        <Link to="/kb" style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none" }}>
          Knowledge Base
        </Link>
        <span aria-hidden="true">/</span>
        <span>{notFound ? "Not Found" : (category?.name ?? "…")}</span>
      </nav>

      {/* Not found */}
      {notFound && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">🔍</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Category not found</h1>
          <p style={{ color: "var(--text-secondary, #8b96a8)", marginBottom: 24 }}>
            The category <code style={{ background: "var(--bg-input, #252d3d)", padding: "1px 6px", borderRadius: 4 }}>{slug}</code> doesn't exist.
          </p>
          <Link
            to="/kb"
            style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}
          >
            ← Back to Knowledge Base
          </Link>
        </div>
      )}

      {/* Error */}
      {error && !notFound && (
        <p style={{ color: "var(--status-err, #ef4444)" }}>{error}</p>
      )}

      {/* Loading */}
      {loading && !notFound && (
        <>
          <div style={{ marginBottom: 28 }}>
            <div style={{ height: 28, background: "var(--border, #242c3e)", borderRadius: 4, width: 180, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 14, background: "var(--border, #242c3e)", borderRadius: 4, width: 300, animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
          </div>
        </>
      )}

      {/* Content */}
      {!loading && !notFound && category && (
        <>
          {/* Category header */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: "clamp(1.4rem, 4vw, 1.9rem)", fontWeight: 700, margin: "0 0 8px" }}>
              {category.name}
            </h1>
            {category.description && (
              <p style={{ margin: 0, fontSize: 15, color: "var(--text-secondary, #8b96a8)", lineHeight: 1.6 }}>
                {category.description}
              </p>
            )}
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-muted, #525d6e)" }}>
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </p>
          </div>

          {/* Articles */}
          {articles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted, #525d6e)" }}>
              <p style={{ margin: "0 0 12px", fontSize: 14 }}>No articles published in this category yet.</p>
              <Link
                to="/kb"
                style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none", fontSize: 14 }}
              >
                ← Browse all categories
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {articles.map((art) => (
                <ArticleCard key={art.id} article={art} />
              ))}
            </div>
          )}
        </>
      )}
    </KbShell>
  );
}
