/**
 * src/pages/KbEditorPage.tsx  (Brick 10W — replaces 10i stub)
 *
 * Admin KB article editor — create or edit an article.
 *
 * Routes (wired in App.tsx):
 *   /kb/editor/new        → create new article (default status = draft)
 *   /kb/editor/:id        → edit existing article
 *
 * Roles: admin, supervisor only (RequireRole enforced in App.tsx).
 *
 * Features (Brick 10W):
 *   - Title, slug (auto-generated, editable), category, tags, asset_type,
 *     status (draft/published), full Markdown body textarea.
 *   - Live Markdown preview via kbMarkdown.mdToHtml (same safe renderer as public reader).
 *   - Create via POST /api/v2/kb/articles (new articles default to draft).
 *   - Update via PATCH /api/v2/kb/articles/:id.
 *   - Publish/unpublish toggle — PATCH { status: "published"|"draft" }.
 *   - Delete via DELETE /api/v2/kb/articles/:id — requires in-UI confirm dialog.
 *   - Client-side validation: required title/slug/category.
 *   - Slug uniqueness error surfaced from API 409 — does not crash.
 *   - published_at semantics preserved server-side (COALESCE in repo).
 *   - After create → redirect to /kb/editor/:newId so user can keep editing.
 *   - Breadcrumb nav back to /kb/editor (admin list).
 *
 * Data safety:
 *   - New articles default to draft. Auto-publish is NEVER performed.
 *   - Editing an existing article does NOT change published_at unless
 *     the user explicitly flips status to published (server handles COALESCE).
 *   - Seeded articles are unaffected unless the user opens and saves them.
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { mdToHtml } from "@/lib/kbMarkdown";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KbCategory {
  id:   string;
  name: string;
}

interface ArticleForm {
  categoryId: string;
  title:      string;
  slug:       string;
  bodyMd:     string;
  tags:       string;    // comma-separated string in the UI
  assetType:  string;
  status:     "draft" | "published";
}

const EMPTY_FORM: ArticleForm = {
  categoryId: "",
  title:      "",
  slug:       "",
  bodyMd:     "",
  tags:       "",
  assetType:  "",
  status:     "draft",  // new articles always start as draft
};

const ASSET_TYPES = ["guide", "tip", "regulation", "how-to", "faq", "alert"];

// ── Slug helper ────────────────────────────────────────────────────────────────

function slugify(s: string): string {
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
  // :id is either a real article ID or the literal string "new"
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const isNew    = !id || id === "new";
  const isEdit   = !isNew;
  const articleId = isEdit ? id! : null;

  const [categories,  setCategories]  = useState<KbCategory[]>([]);
  const [form,        setForm]        = useState<ArticleForm>(EMPTY_FORM);
  const [slugEdited,  setSlugEdited]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(isEdit);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  // Track original status so publish toggle is meaningful
  const originalStatus = useRef<"draft" | "published">("draft");

  // ── Load categories ──────────────────────────────────────────────────────

  useEffect(() => {
    apiFetch("/kb/categories")
      .then((cats) => setCategories(cats as KbCategory[]))
      .catch(() => setError("Failed to load categories."));
  }, []);

  // ── Load article if editing ──────────────────────────────────────────────

  useEffect(() => {
    if (!isEdit || !articleId) return;
    setLoading(true);
    apiFetch(`/kb/articles/${articleId}`)
      .then((art: any) => {
        const loaded: ArticleForm = {
          categoryId: art.categoryId ?? "",
          title:      art.title      ?? "",
          slug:       art.slug       ?? "",
          bodyMd:     art.bodyMd     ?? "",
          tags:       Array.isArray(art.tags) ? art.tags.join(", ") : "",
          assetType:  art.assetType  ?? "",
          status:     art.status === "published" ? "published" : "draft",
        };
        setForm(loaded);
        originalStatus.current = loaded.status;
        setSlugEdited(true); // don't auto-overwrite existing slug on title change
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load article.");
        setLoading(false);
      });
  }, [articleId, isEdit]);

  // ── Field handlers ───────────────────────────────────────────────────────

  const set =
    (field: keyof ArticleForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: val };
        if (field === "title" && !slugEdited) {
          next.slug = slugify(val);
        }
        return next;
      });
    };

  const onSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }));
  };

  // ── Build payload ────────────────────────────────────────────────────────

  const buildPayload = (overrideStatus?: "draft" | "published") => ({
    categoryId: form.categoryId,
    title:      form.title.trim(),
    slug:       form.slug.trim(),
    bodyMd:     form.bodyMd,
    tags:       form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    assetType:  form.assetType || null,
    status:     overrideStatus ?? form.status,
  });

  // ── Validate ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    if (!form.categoryId) { setError("Please select a category."); return false; }
    if (!form.title.trim()) { setError("Title is required."); return false; }
    if (!form.slug.trim())  { setError("Slug is required."); return false; }
    return true;
  };

  // ── Save (draft or explicit status) ─────────────────────────────────────

  const handleSave = async (overrideStatus?: "draft" | "published") => {
    setError(null);
    setSuccess(null);
    if (!validate()) return;

    const payload = buildPayload(overrideStatus);
    setSaving(true);
    try {
      if (isEdit && articleId) {
        await apiFetch(`/kb/articles/${articleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setForm((prev) => ({ ...prev, status: payload.status as "draft" | "published" }));
        originalStatus.current = payload.status as "draft" | "published";
        setSuccess(payload.status === "published" ? "Article published." : "Draft saved.");
      } else {
        // Create — force status = draft (never auto-publish new articles)
        const createPayload = { ...payload, status: "draft" };
        const created = await apiFetch("/kb/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        }) as { id: string };
        // Redirect to edit route so user can continue editing the new article
        navigate(`/kb/editor/${created.id}`, { replace: true });
        return;
      }
    } catch (err: any) {
      const msg: string = err?.message ?? "Failed to save article.";
      if (msg.includes("409") || msg.toLowerCase().includes("slug already exists")) {
        setError("That slug is already in use. Please choose a different slug.");
      } else if (msg.includes("400") || msg.toLowerCase().includes("invalid categoryid")) {
        setError("Invalid category. Please select a valid category.");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Publish / unpublish toggle ───────────────────────────────────────────

  const handlePublishToggle = async () => {
    const nextStatus = form.status === "published" ? "draft" : "published";
    await handleSave(nextStatus);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!articleId) return;
    setDeleting(true);
    try {
      await apiFetch(`/kb/articles/${articleId}`, { method: "DELETE" });
      navigate("/kb/editor", { replace: true });
    } catch {
      setError("Failed to delete article.");
      setConfirmDel(false);
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div className="skeleton" style={{ height: 36, width: 220, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 48, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 48, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isPublished = form.status === "published";

  return (
    <div className="page-content">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Breadcrumb header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 24, flexWrap: "wrap",
        }}>
          <button
            className="btn btn--ghost"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            onClick={() => navigate("/kb/editor")}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 3L5 8l5 5" />
            </svg>
            KB Admin
          </button>
          <span style={{ color: "var(--text-muted, #6b7280)" }}>/</span>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, flex: 1 }}>
            {isNew ? "New Article" : "Edit Article"}
          </h1>

          {/* Status badge */}
          {isEdit && (
            <span style={{
              padding: "3px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
              background: isPublished ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
              color: isPublished ? "var(--status-ok, #22c55e)" : "var(--status-warn, #f59e0b)",
            }}>
              {isPublished ? "Published" : "Draft"}
            </span>
          )}
        </div>

        {/* Alerts */}
        {error   && <div className="alert alert--error"   style={{ marginBottom: 16 }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

        <form onSubmit={(e) => { e.preventDefault(); void handleSave(); }} noValidate>

          {/* Title */}
          <div className="form-group">
            <label className="form-label" htmlFor="kb-title">
              Title <span aria-hidden="true" style={{ color: "#ef4444" }}>*</span>
            </label>
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
              <span style={{
                fontSize: 12, color: "var(--text-muted, #6b7280)",
                marginLeft: 6, fontWeight: 400,
              }}>
                auto-generated · editable
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
              <span style={{
                fontSize: 12, color: "var(--text-muted, #6b7280)",
                marginLeft: 6, fontWeight: 400,
              }}>
                comma-separated
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

          {/* Status (edit mode only — new articles are always draft) */}
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

          {/* Body — editor / preview toggle */}
          <div className="form-group">
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 8,
            }}>
              <label className="form-label" htmlFor="kb-body" style={{ margin: 0 }}>
                Content (Markdown)
                <span style={{
                  fontSize: 12, color: "var(--text-muted, #6b7280)",
                  marginLeft: 6, fontWeight: 400,
                }}>
                  {form.bodyMd.length.toLocaleString()} chars
                </span>
              </label>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 12, padding: "3px 10px" }}
                onClick={() => setShowPreview((p) => !p)}
              >
                {showPreview ? "Edit" : "Preview"}
              </button>
            </div>

            {showPreview ? (
              /* Live preview — uses same safe mdToHtml renderer as public reader */
              <div
                className="kb-article-body"
                style={{
                  minHeight: 320,
                  padding: "16px 20px",
                  background: "var(--bg-input, #f9fafb)",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 6,
                  fontSize: 15,
                  lineHeight: 1.7,
                  overflowY: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: mdToHtml(form.bodyMd) }}
              />
            ) : (
              <textarea
                id="kb-body"
                className="input"
                value={form.bodyMd}
                onChange={set("bodyMd")}
                placeholder={"# Heading\n\nStart writing your article here.\n\n- Bullet points\n- work like this\n\n**Bold** and *italic* text are supported."}
                rows={22}
                style={{
                  width: "100%", fontFamily: "monospace",
                  fontSize: 13, resize: "vertical",
                }}
              />
            )}
          </div>

          {/* Action bar */}
          <div style={{
            display: "flex", gap: 10, justifyContent: "space-between",
            paddingTop: 8, flexWrap: "wrap", alignItems: "center",
          }}>
            {/* Left: delete (edit mode only) */}
            <div>
              {isEdit && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ color: "var(--status-err, #ef4444)", fontSize: 13 }}
                  onClick={() => setConfirmDel(true)}
                  disabled={saving || deleting}
                >
                  Delete article
                </button>
              )}
            </div>

            {/* Right: cancel / save draft / publish toggle */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => navigate("/kb/editor")}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn--secondary"
                disabled={saving}
              >
                {saving ? "Saving…" : isNew ? "Save Draft" : "Save Changes"}
              </button>

              {/* Publish toggle — only visible in edit mode */}
              {isEdit && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={() => void handlePublishToggle()}
                  style={isPublished ? {
                    background: "var(--status-warn, #f59e0b)",
                    borderColor: "var(--status-warn, #f59e0b)",
                  } : {}}
                >
                  {saving
                    ? "…"
                    : isPublished
                    ? "Unpublish"
                    : "Publish"}
                </button>
              )}

              {/* New article: single "Publish" button that saves then you can promote later */}
              {isNew && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  title="Saves as draft first; you can publish from the edit screen"
                  onClick={() => void handleSave()}
                >
                  {saving ? "Saving…" : "Create Draft"}
                </button>
              )}
            </div>
          </div>

        </form>
      </div>

      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      {confirmDel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-modal-title"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDel(false); }}
        >
          <div style={{
            background: "var(--bg-card, #fff)",
            borderRadius: 12, padding: 28, maxWidth: 420, width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}>
            <h2
              id="del-modal-title"
              style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 12px 0" }}
            >
              Delete article?
            </h2>
            <p style={{ margin: "0 0 8px 0", color: "var(--text-muted, #6b7280)" }}>
              <strong style={{ color: "inherit" }}>"{form.title || "Untitled"}"</strong> will be
              permanently deleted.
            </p>
            {isPublished && (
              <p style={{
                margin: "0 0 20px 0", fontSize: 13,
                color: "var(--status-warn, #f59e0b)", fontWeight: 500,
              }}>
                This article is currently published. Clients will immediately lose access.
              </p>
            )}
            {!isPublished && <div style={{ marginBottom: 20 }} />}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDel(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                style={{
                  background: "var(--status-err, #ef4444)",
                  borderColor: "var(--status-err, #ef4444)",
                }}
                onClick={() => void handleDelete()}
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
