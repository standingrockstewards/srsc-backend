/**
 * src/pages/KbEditorPage.tsx  (Brick 10i)
 *
 * Admin KB article editor — create or edit an article.
 *
 * Route:
 *   /kb/editor          → new article
 *   /kb/editor/:id      → edit existing
 *
 * Roles: admin, supervisor only (RequireRole in App.tsx).
 *
 * Features:
 *   - Title, category, asset_type, status (draft/published), tags (comma-separated input),
 *     full Markdown body textarea with live character count.
 *   - Auto-generates a slug from the title (editable).
 *   - Saves draft on first save; publish flips status to published.
 *   - updated_at + published_at enforced server-side (no frontend hacks).
 *   - After save: redirect to /kb.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KbCategory {
  id: string;
  name: string;
}

interface ArticleForm {
  categoryId:  string;
  title:       string;
  slug:        string;
  bodyMd:      string;
  tags:        string;      // comma-separated string in the UI
  assetType:   string;
  status:      "draft" | "published";
}

const EMPTY_FORM: ArticleForm = {
  categoryId: "",
  title:      "",
  slug:       "",
  bodyMd:     "",
  tags:       "",
  assetType:  "",
  status:     "draft",
};

const ASSET_TYPES = ["guide", "tip", "regulation", "how-to", "faq", "alert"];

// ── Slug helper ────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function KbEditorPage() {
  const { id }    = useParams<{ id?: string }>();
  const navigate  = useNavigate();
  const isEdit    = Boolean(id);

  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [form,       setForm]       = useState<ArticleForm>(EMPTY_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(isEdit);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);

  // ── Load categories ─────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/kb/categories")
      .then((cats) => setCategories(cats as KbCategory[]))
      .catch(() => setError("Failed to load categories."));
  }, []);

  // ── Load article if editing ─────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !id) return;
    apiFetch(`/kb/articles/${id}`)
      .then((art: any) => {
        setForm({
          categoryId: art.categoryId ?? "",
          title:      art.title      ?? "",
          slug:       art.slug       ?? "",
          bodyMd:     art.bodyMd     ?? "",
          tags:       (art.tags ?? []).join(", "),
          assetType:  art.assetType  ?? "",
          status:     art.status     ?? "draft",
        });
        setSlugEdited(true); // Don't auto-overwrite existing slug
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load article.");
        setLoading(false);
      });
  }, [id, isEdit]);

  // ── Field handlers ──────────────────────────────────────────────────────
  const set = (field: keyof ArticleForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: val };
        // Auto-generate slug from title unless user manually edited it
        if (field === "title" && !slugEdited) {
          next.slug = slugify(val);
        }
        return next;
      });
    };

  const onSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, slug: e.target.value }));
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (publishNow: boolean) => {
    setError(null);
    setSuccess(null);
    if (!form.categoryId) { setError("Please select a category."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.slug.trim())  { setError("Slug is required."); return; }

    const payload = {
      categoryId: form.categoryId,
      title:      form.title.trim(),
      slug:       form.slug.trim(),
      bodyMd:     form.bodyMd,
      tags:       form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      assetType:  form.assetType || null,
      status:     publishNow ? "published" : form.status,
    };

    setSaving(true);
    try {
      if (isEdit && id) {
        await apiFetch(`/kb/articles/${id}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
        setSuccess("Article updated.");
      } else {
        await apiFetch("/kb/articles", { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
        setSuccess("Article created.");
      }
      setTimeout(() => navigate("/kb"), 800);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save article.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="skeleton" style={{ height: 36, width: 200, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 48, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button
            className="btn btn--ghost"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => navigate("/kb")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            Knowledge Base
          </button>
          <span style={{ color: "var(--text-muted, #6b7280)" }}>/</span>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
            {isEdit ? "Edit Article" : "New Article"}
          </h1>
        </div>

        {error   && <div className="alert alert--error"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

        <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} noValidate>

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="kb-title">Title <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span></label>
            <input
              id="kb-title"
              className="input"
              type="text"
              value={form.title}
              onChange={set("title")}
              placeholder="e.g. How to Choose the Right Rod for Lake Eufaula"
              required
              style={{ width: "100%" }}
            />
          </div>

          {/* Slug */}
          <div className="form-group">
            <label className="form-label" htmlFor="kb-slug">
              Slug
              <span style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginLeft: 6, fontWeight: 400 }}>
                (auto-generated; edit to customize URL)
              </span>
            </label>
            <input
              id="kb-slug"
              className="input"
              type="text"
              value={form.slug}
              onChange={onSlugChange}
              placeholder="how-to-choose-rod-lake-eufaula"
              style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
            />
          </div>

          {/* Category + Asset type row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="kb-category">
                Category <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                id="kb-category"
                className="input"
                value={form.categoryId}
                onChange={set("categoryId")}
                required
                style={{ width: "100%" }}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="kb-asset-type">Asset Type</label>
              <select
                id="kb-asset-type"
                className="input"
                value={form.assetType}
                onChange={set("assetType")}
                style={{ width: "100%" }}
              >
                <option value="">None</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label" htmlFor="kb-tags">
              Tags
              <span style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginLeft: 6, fontWeight: 400 }}>
                comma-separated, e.g. bass, crappie, topwater
              </span>
            </label>
            <input
              id="kb-tags"
              className="input"
              type="text"
              value={form.tags}
              onChange={set("tags")}
              placeholder="bass, crappie, summer, early morning"
              style={{ width: "100%" }}
            />
          </div>

          {/* Status (for edit mode — new drafts default to draft) */}
          {isEdit && (
            <div className="form-group">
              <label className="form-label" htmlFor="kb-status">Status</label>
              <select
                id="kb-status"
                className="input"
                value={form.status}
                onChange={set("status")}
                style={{ width: "100%" }}
              >
                <option value="draft">Draft (hidden from clients)</option>
                <option value="published">Published</option>
              </select>
            </div>
          )}

          {/* Body */}
          <div className="form-group">
            <label className="form-label" htmlFor="kb-body">
              Content (Markdown)
              <span style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginLeft: 6, fontWeight: 400 }}>
                {form.bodyMd.length} chars
              </span>
            </label>
            <textarea
              id="kb-body"
              className="input"
              value={form.bodyMd}
              onChange={set("bodyMd")}
              placeholder={"# Heading\n\nStart writing your article here. Markdown is supported.\n\n- Bullet points\n- work like this\n\n**Bold** and *italic* text are supported."}
              rows={20}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate("/kb")}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--secondary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={saving}
              onClick={() => handleSave(true)}
            >
              {saving ? "Publishing…" : (isEdit && form.status === "published") ? "Update & Publish" : "Publish"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
