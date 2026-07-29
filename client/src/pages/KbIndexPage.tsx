/**
 * client/src/pages/KbIndexPage.tsx  (Brick 10k)
 *
 * Public KB index — lists all 9 categories + search box.
 * Route: /kb  (outside RequireAuth — no login required)
 *
 * Search (?q=) drives GET /kb/articles?q=<term> and renders results inline.
 * No auth calls made from this page.
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KbShell } from "@/components/KbShell";
import {
  fetchCategories,
  fetchArticles,
} from "@/lib/kbApi";
import { mdExcerpt } from "@/lib/kbMarkdown";
import type { KbCategory, KbArticle } from "@/lib/kbTypes";

// ── Category icon map ─────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, string> = {
  "lake-life":      "🌊",
  "fishing":        "🎣",
  "bait-tackle":    "🪝",
  "rods-reels":     "🎿",
  "duck-hunting":   "🦆",
  "hunting":        "🦌",
  "optics-scopes":  "🔭",
  "property-care":  "🏡",
  "weather-storms": "⛈️",
};

// ── Skeleton card ─────────────────────────────────────────────────────────────

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
      <div style={{ height: 18, background: "var(--border, #242c3e)", borderRadius: 4, marginBottom: 10, width: "55%" }} />
      <div style={{ height: 13, background: "var(--border, #242c3e)", borderRadius: 4, width: "90%" }} />
    </div>
  );
}

// ── Article result card ───────────────────────────────────────────────────────

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
          padding: "18px 20px",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent, #2b9e8e)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border, #242c3e)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
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
          {article.tags.slice(0, 2).map((t) => (
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
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{article.title}</div>
        {excerpt && (
          <div style={{ fontSize: 13, color: "var(--text-secondary, #8b96a8)", lineHeight: 1.55 }}>
            {excerpt}
          </div>
        )}
        {article.publishedAt && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted, #525d6e)" }}>
            {new Date(article.publishedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function KbIndexPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";

  const [categories,   setCategories]   = useState<KbCategory[]>([]);
  const [catLoading,   setCatLoading]   = useState(true);
  const [catError,     setCatError]     = useState<string | null>(null);

  const [searchTerm,   setSearchTerm]   = useState(qParam);
  const [results,      setResults]      = useState<KbArticle[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError,  setSearchError]  = useState<string | null>(null);

  // ── Load categories ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCategories()
      .then((cats) => { setCategories(cats); setCatLoading(false); })
      .catch(() => { setCatError("Failed to load categories."); setCatLoading(false); });
  }, []);

  // ── Run search when ?q= param changes ──────────────────────────────────────
  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setSearchLoading(true);
    setSearchError(null);
    fetchArticles({ q: q.trim() })
      .then((arts) => { setResults(arts); setSearchLoading(false); })
      .catch(() => { setSearchError("Search failed. Please try again."); setSearchLoading(false); });
  }, []);

  useEffect(() => {
    if (qParam) runSearch(qParam);
    else setResults(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q) setSearchParams({ q });
    else setSearchParams({});
    runSearch(q);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchParams({});
    setResults(null);
  };

  const isSearchMode = Boolean(qParam || results !== null);

  return (
    <KbShell>
      {/* Hero */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 700, margin: "0 0 10px" }}>
          Knowledge Base
        </h1>
        <p style={{ color: "var(--text-secondary, #8b96a8)", fontSize: 15, margin: "0 0 28px" }}>
          Lake life, fishing, duck hunting, property care, and more — from the SRSC team.
        </p>

        {/* Search box */}
        <form
          onSubmit={handleSearch}
          style={{
            display: "flex",
            gap: 8,
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search articles…"
            aria-label="Search articles"
            style={{
              flex: 1,
              background: "var(--bg-input, #252d3d)",
              border: "1px solid var(--border, #242c3e)",
              borderRadius: 8,
              color: "var(--text-primary, #e8edf5)",
              fontSize: 14,
              padding: "9px 14px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              background: "var(--accent, #2b9e8e)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Search
          </button>
          {isSearchMode && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                background: "none",
                border: "1px solid var(--border, #242c3e)",
                borderRadius: 8,
                color: "var(--text-secondary, #8b96a8)",
                fontSize: 13,
                padding: "9px 14px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* ── Search results ─────────────────────────────────────────────────── */}
      {isSearchMode && (
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16, color: "var(--text-secondary, #8b96a8)" }}>
            {qParam ? `Results for "${qParam}"` : "Search results"}
          </h2>

          {searchLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
            </div>
          )}

          {searchError && (
            <p style={{ color: "var(--status-err, #ef4444)", fontSize: 14 }}>{searchError}</p>
          )}

          {!searchLoading && !searchError && results !== null && (
            results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted, #525d6e)" }}>
                <p style={{ margin: 0, fontSize: 14 }}>No articles matched "{qParam}".</p>
                <button
                  onClick={clearSearch}
                  style={{
                    marginTop: 12, background: "none", border: "none",
                    color: "var(--accent, #2b9e8e)", fontSize: 14, cursor: "pointer",
                  }}
                >
                  ← Back to all categories
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {results.map((art) => <ArticleCard key={art.id} article={art} />)}
              </div>
            )
          )}
        </div>
      )}

      {/* ── Category grid ──────────────────────────────────────────────────── */}
      {!isSearchMode && (
        <>
          {catError && (
            <p style={{ color: "var(--status-err, #ef4444)", marginBottom: 16 }}>{catError}</p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {catLoading
              ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <SkeletonCard key={n} />)
              : categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/kb/category/${cat.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div
                      style={{
                        background: "var(--bg-card, #1e2535)",
                        border: "1px solid var(--border, #242c3e)",
                        borderRadius: 10,
                        padding: "20px 22px",
                        cursor: "pointer",
                        height: "100%",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent, #2b9e8e)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border, #242c3e)")}
                    >
                      <div style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">
                        {CAT_ICONS[cat.slug] ?? "📖"}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                        {cat.name}
                      </div>
                      {cat.description && (
                        <div style={{ fontSize: 13, color: "var(--text-secondary, #8b96a8)", lineHeight: 1.5 }}>
                          {cat.description}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
            }
          </div>
        </>
      )}
    </KbShell>
  );
}
