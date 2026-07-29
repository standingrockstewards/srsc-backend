/**
 * client/src/pages/KbArticlePage.tsx  (Brick 10k)
 *
 * Public KB article reader — renders a single published article by slug.
 * Route: /kb/:slug  (outside RequireAuth)
 *
 * Fetches:
 *   GET /kb/articles/:slug → 200 with article data, or 404 if draft/missing
 *
 * 404 shows a clean "Article not found" component.
 * body_md is rendered via mdToHtml (sanitized — no raw HTML injection).
 * No auth calls made from this page.
 */

import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { KbShell } from "@/components/KbShell";
import { fetchArticle } from "@/lib/kbApi";
import { mdToHtml } from "@/lib/kbMarkdown";
import type { KbArticle } from "@/lib/kbTypes";

// ── Asset type badge ──────────────────────────────────────────────────────────

const ASSET_COLORS: Record<string, string> = {
  guide:      "#2563eb",
  tip:        "#059669",
  regulation: "#dc2626",
  "how-to":   "#7c3aed",
  faq:        "#d97706",
  alert:      "#be185d",
};

function AssetBadge({ type }: { type: string }) {
  const bg = ASSET_COLORS[type] ?? "#4b5563";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        backgroundColor: bg,
        color: "#fff",
      }}
    >
      {type}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div style={{ animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ height: 14, background: "var(--border, #242c3e)", borderRadius: 4, width: 120, marginBottom: 28 }} />
      <div style={{ height: 36, background: "var(--border, #242c3e)", borderRadius: 4, width: "75%", marginBottom: 14 }} />
      <div style={{ height: 14, background: "var(--border, #242c3e)", borderRadius: 4, width: 200, marginBottom: 32 }} />
      {[90, 100, 85, 95, 80].map((w, i) => (
        <div
          key={i}
          style={{
            height: 13,
            background: "var(--border, #242c3e)",
            borderRadius: 4,
            width: `${w}%`,
            marginBottom: 10,
          }}
        />
      ))}
    </div>
  );
}

// ── 404 component ─────────────────────────────────────────────────────────────

function ArticleNotFound({ slug }: { slug: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden="true">📄</div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Article not found</h1>
      <p style={{ color: "var(--text-secondary, #8b96a8)", marginBottom: 8 }}>
        No published article found for{" "}
        <code
          style={{
            background: "var(--bg-input, #252d3d)",
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          {slug}
        </code>
        .
      </p>
      <p style={{ color: "var(--text-muted, #525d6e)", fontSize: 13, marginBottom: 28 }}>
        It may have been removed or the link may be incorrect.
      </p>
      <Link
        to="/kb"
        style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}
      >
        ← Back to Knowledge Base
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function KbArticlePage() {
  const { slug } = useParams<{ slug: string }>();

  const [article,  setArticle]  = useState<KbArticle | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    setLoading(true);
    setNotFound(false);
    setError(null);

    fetchArticle(slug)
      .then((art) => { setArticle(art); setLoading(false); })
      .catch((err: any) => {
        if (err?.status === 404 || String(err?.message).startsWith("404")) {
          setNotFound(true);
        } else {
          setError("Failed to load article. Please try again.");
        }
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
          marginBottom: 32,
          flexWrap: "wrap",
        }}
      >
        <Link to="/kb" style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none" }}>
          Knowledge Base
        </Link>
        <span aria-hidden="true">/</span>
        {article ? (
          <>
            <Link
              to={`/kb/category/${article.categoryId}`}
              style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none" }}
            >
              Category
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--text-secondary, #8b96a8)" }}>{article.title}</span>
          </>
        ) : (
          <span>{notFound ? "Not Found" : "…"}</span>
        )}
      </nav>

      {/* Not found */}
      {notFound && <ArticleNotFound slug={slug ?? ""} />}

      {/* Error */}
      {error && !notFound && (
        <p style={{ color: "var(--status-err, #ef4444)" }}>{error}</p>
      )}

      {/* Loading */}
      {loading && !notFound && <ArticleSkeleton />}

      {/* Article */}
      {!loading && !notFound && article && (
        <article style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Meta row */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {article.assetType && <AssetBadge type={article.assetType} />}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: 700,
              lineHeight: 1.25,
              margin: "0 0 12px",
            }}
          >
            {article.title}
          </h1>

          {/* Byline */}
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted, #525d6e)" }}>
            By {article.authorName}
            {article.publishedAt && (
              <> · Published {new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</>
            )}
          </p>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 28 }}>
              {article.tags.map((t) => (
                <Link
                  key={t}
                  to={`/kb?q=${encodeURIComponent(t)}`}
                  style={{
                    textDecoration: "none",
                    fontSize: 12,
                    padding: "2px 9px",
                    borderRadius: 12,
                    background: "var(--bg-input, #252d3d)",
                    color: "var(--text-secondary, #8b96a8)",
                    border: "1px solid var(--border, #242c3e)",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent, #2b9e8e)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border, #242c3e)")}
                >
                  {t}
                </Link>
              ))}
            </div>
          )}

          {/* Divider */}
          <hr style={{ border: "none", borderTop: "1px solid var(--border, #242c3e)", marginBottom: 28 }} />

          {/* Article body — safe HTML from mdToHtml */}
          <div
            className="kb-prose"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: mdToHtml(article.bodyMd) }}
          />

          {/* Footer nav */}
          <div
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: "1px solid var(--border, #242c3e)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <Link
              to="/kb"
              style={{ color: "var(--accent, #2b9e8e)", textDecoration: "none", fontSize: 14 }}
            >
              ← Knowledge Base
            </Link>
            <span style={{ fontSize: 12, color: "var(--text-muted, #525d6e)" }}>
              Last updated {new Date(article.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </article>
      )}
    </KbShell>
  );
}
