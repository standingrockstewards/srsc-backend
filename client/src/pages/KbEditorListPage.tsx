/**
 * src/pages/KbEditorListPage.tsx  (Brick 10W)
 *
 * Admin-only table of ALL KB articles including drafts.
 * Route: /kb/editor  (replaces the old empty KbEditorPage placeholder)
 *
 * - Uses the auth-gated GET /api/v2/kb/articles?status=all endpoint
 * - Shows: title, category, status badge, updated_at, actions (edit / new)
 * - "New Article" button → /kb/editor/new
 * - "Edit" row action → /kb/editor/:id
 * - Guard: RequireRole(admin, supervisor) — enforced in App.tsx
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KbArticleRow {
  id:          string;
  title:       string;
  slug:        string;
  status:      "draft" | "published";
  categoryId:  string;
  categoryName?: string;
  updatedAt:   string;
  authorName?: string;
}

interface KbCategory {
  id:   string;
  name: string;
  slug: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function KbEditorListPage() {
  const navigate = useNavigate();

  const [articles,   setArticles]   = useState<KbArticleRow[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft">("all");
  const [filterCat,    setFilterCat]    = useState<string>("");
  const [search,       setSearch]       = useState<string>("");

  // Confirmation state for delete
  const [confirmDelete, setConfirmDelete] = useState<KbArticleRow | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────

  const load = () => {
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch("/kb/articles?status=all&limit=200") as Promise<KbArticleRow[]>,
      apiFetch("/kb/categories") as Promise<KbCategory[]>,
    ])
      .then(([arts, cats]) => {
        // Attach category names
        const catMap = new Map(cats.map((c) => [c.id, c.name]));
        const enriched = arts.map((a) => ({
          ...a,
          categoryName: catMap.get(a.categoryId) ?? a.categoryId,
        }));
        setArticles(enriched);
        setCategories(cats);
      })
      .catch(() => setError("Failed to load articles."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/kb/articles/${confirmDelete.id}`, { method: "DELETE" });
      setArticles((prev) => prev.filter((a) => a.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      setError("Failed to delete article.");
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtered view ─────────────────────────────────────────────────────────

  const visible = articles.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterCat && a.categoryId !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.slug.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const draftCount     = articles.filter((a) => a.status === "draft").length;
  const publishedCount = articles.filter((a) => a.status === "published").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 4px 0" }}>
              KB Admin
            </h1>
            <p style={{ margin: 0, color: "var(--text-muted, #6b7280)", fontSize: 14 }}>
              {publishedCount} published · {draftCount} draft{draftCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => navigate("/kb/editor/new")}
          >
            + New Article
          </button>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {/* Filters */}
        <div style={{
          display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center",
        }}>
          {/* Status filter */}
          <select
            className="input"
            style={{ width: 160 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>

          {/* Category filter */}
          <select
            className="input"
            style={{ width: 200 }}
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Search */}
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            type="search"
            placeholder="Search title or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search articles"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 6 }} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{
            padding: "48px 0", textAlign: "center",
            color: "var(--text-muted, #6b7280)", fontSize: 15,
          }}>
            {articles.length === 0 ? "No articles yet." : "No articles match the current filters."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border, #e5e7eb)" }}>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Updated</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((art) => (
                  <tr
                    key={art.id}
                    style={{ borderBottom: "1px solid var(--border-subtle, #f3f4f6)" }}
                  >
                    {/* Title */}
                    <td style={tdStyle}>
                      <Link
                        to={`/kb/editor/${art.id}`}
                        style={{ fontWeight: 600, color: "var(--text-accent, #0ea5e9)", textDecoration: "none" }}
                      >
                        {art.title}
                      </Link>
                      <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", fontFamily: "monospace", marginTop: 2 }}>
                        {art.slug}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={tdStyle}>
                      <span style={{ color: "var(--text-muted, #6b7280)" }}>{art.categoryName}</span>
                    </td>

                    {/* Status badge */}
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: art.status === "published"
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(245,158,11,0.12)",
                        color: art.status === "published"
                          ? "var(--status-ok, #22c55e)"
                          : "var(--status-warn, #f59e0b)",
                      }}>
                        {art.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>

                    {/* Updated */}
                    <td style={{ ...tdStyle, color: "var(--text-muted, #6b7280)", whiteSpace: "nowrap" }}>
                      {fmtDate(art.updatedAt)}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: 13, padding: "4px 12px", marginRight: 8 }}
                        onClick={() => navigate(`/kb/editor/${art.id}`)}
                      >
                        Edit
                      </button>
                      {art.status === "published" && (
                        <a
                          href={`/kb/${art.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--ghost"
                          style={{ fontSize: 13, padding: "4px 12px", marginRight: 8 }}
                        >
                          View
                        </a>
                      )}
                      <button
                        className="btn btn--ghost"
                        style={{
                          fontSize: 13, padding: "4px 12px",
                          color: "var(--status-err, #ef4444)",
                          borderColor: "transparent",
                        }}
                        onClick={() => setConfirmDelete(art)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-dialog-title"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div style={{
            background: "var(--bg-card, #fff)",
            borderRadius: 12, padding: 28, maxWidth: 420, width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <h2
              id="del-dialog-title"
              style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 12px 0" }}
            >
              Delete article?
            </h2>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-muted, #6b7280)" }}>
              <strong style={{ color: "inherit" }}>"{confirmDelete.title}"</strong> will be
              permanently deleted. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                style={{ background: "var(--status-err, #ef4444)", borderColor: "var(--status-err, #ef4444)" }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontWeight: 600,
  fontSize: 13,
  color: "var(--text-muted, #6b7280)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
};
