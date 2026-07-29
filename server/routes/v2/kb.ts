/**
 * server/routes/v2/kb.ts  (Brick 10i)
 *
 * Knowledge Base API.
 *
 * Categories:
 *   GET    /api/v2/kb/categories            — all roles (non-vendor)
 *   POST   /api/v2/kb/categories            — admin/supervisor
 *   PATCH  /api/v2/kb/categories/:id        — admin/supervisor
 *   DELETE /api/v2/kb/categories/:id        — admin/supervisor
 *
 * Articles:
 *   GET    /api/v2/kb/articles              — non-vendor; ?category=&tag=&search=&status=
 *                                             status defaults to "published";
 *                                             admin/supervisor may pass status=all or status=draft
 *   GET    /api/v2/kb/articles/tags         — published tags list (non-vendor)
 *   GET    /api/v2/kb/articles/:idOrSlug    — non-vendor; draft only visible to admin/supervisor
 *   POST   /api/v2/kb/articles              — admin/supervisor
 *   PATCH  /api/v2/kb/articles/:id          — admin/supervisor; updated_at + published_at set here
 *   DELETE /api/v2/kb/articles/:id          — admin/supervisor
 *
 * Role scoping:
 *   vendor              → 403 on all routes
 *   client / field_tech → GET published only
 *   admin / supervisor  → full CRUD + draft access
 */

import { Router, type Request, type Response } from "express";
import { requireAuthV2 } from "../../middleware/authV2";
import { kbCategoriesRepo, kbArticlesRepo } from "../../repositories/kb";

const router = Router();
router.use(requireAuthV2);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAdminOrSup(role: string)     { return role === "admin" || role === "supervisor"; }
function isVendor(role: string)         { return role === "vendor"; }

function requireNotVendorKb(req: Request, res: Response): boolean {
  if (isVendor(req.v2Role ?? "")) {
    res.status(403).json({ error: "Access denied." });
    return false;
  }
  return true;
}

function requireAdminSupKb(req: Request, res: Response): boolean {
  if (!isAdminOrSup(req.v2Role ?? "")) {
    res.status(403).json({ error: "Admin or supervisor role required." });
    return false;
  }
  return true;
}

// ── Categories ────────────────────────────────────────────────────────────────

router.get("/categories", async (req: Request, res: Response) => {
  if (!requireNotVendorKb(req, res)) return;
  return res.json(await kbCategoriesRepo.getAll());
});

router.post("/categories", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;
  const { slug, name, description, sortOrder } = req.body as Record<string, unknown>;
  if (!slug || !name) return res.status(400).json({ error: "slug and name are required." });
  try {
    const cat = await kbCategoriesRepo.create({
      slug:        String(slug),
      name:        String(name),
      description: description ? String(description) : null,
      sortOrder:   sortOrder   ? Number(sortOrder)   : 0,
    });
    return res.status(201).json(cat);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Slug already exists." });
    return res.status(500).json({ error: "Failed to create category." });
  }
});

router.patch("/categories/:id", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;
  const id = String(req.params["id"]);
  const { slug, name, description, sortOrder } = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (slug        !== undefined) patch["slug"]        = String(slug);
  if (name        !== undefined) patch["name"]        = String(name);
  if (description !== undefined) patch["description"] = description ? String(description) : null;
  if (sortOrder   !== undefined) patch["sortOrder"]   = Number(sortOrder);
  const updated = await kbCategoriesRepo.update(id, patch as any);
  if (!updated) return res.status(404).json({ error: "Category not found." });
  return res.json(updated);
});

router.delete("/categories/:id", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;
  await kbCategoriesRepo.delete(String(req.params["id"]));
  return res.status(204).send();
});

// ── Articles: tags list ───────────────────────────────────────────────────────

router.get("/articles/tags", async (req: Request, res: Response) => {
  if (!requireNotVendorKb(req, res)) return;
  return res.json(await kbArticlesRepo.allPublishedTags());
});

// ── Articles: list ────────────────────────────────────────────────────────────

router.get("/articles", async (req: Request, res: Response) => {
  if (!requireNotVendorKb(req, res)) return;

  const role = req.v2Role ?? "";
  const { category, tag, search, status, limit, offset } = req.query as Record<string, string | undefined>;

  // Non-admin can only see published
  let resolvedStatus: "published" | "draft" | "all" = "published";
  if (isAdminOrSup(role) && (status === "all" || status === "draft" || status === "published")) {
    resolvedStatus = status as typeof resolvedStatus;
  }

  const articles = await kbArticlesRepo.list({
    categoryId: category,
    tag,
    search,
    status:  resolvedStatus,
    limit:   limit  ? Number(limit)  : 50,
    offset:  offset ? Number(offset) : 0,
  });

  return res.json(articles);
});

// ── Articles: single by ID or slug ───────────────────────────────────────────

router.get("/articles/:idOrSlug", async (req: Request, res: Response) => {
  if (!requireNotVendorKb(req, res)) return;

  const role      = req.v2Role ?? "";
  const idOrSlug  = String(req.params["idOrSlug"]);

  // Try by ID first, then slug
  let article = await kbArticlesRepo.getById(idOrSlug);
  if (!article) article = await kbArticlesRepo.getBySlug(idOrSlug);
  if (!article) return res.status(404).json({ error: "Article not found." });

  // Draft visible to admin/supervisor only
  if (article.status === "draft" && !isAdminOrSup(role)) {
    return res.status(404).json({ error: "Article not found." });
  }

  return res.json(article);
});

// ── Articles: create ──────────────────────────────────────────────────────────

router.post("/articles", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;

  const {
    categoryId, title, slug, bodyMd, tags, assetType, status,
  } = req.body as Record<string, unknown>;

  if (!categoryId || !title || !slug) {
    return res.status(400).json({ error: "categoryId, title, slug are required." });
  }

  const resolvedStatus = status === "published" ? "published" : "draft";
  const now            = new Date();

  try {
    const article = await kbArticlesRepo.create({
      categoryId:  String(categoryId),
      title:       String(title),
      slug:        String(slug),
      bodyMd:      bodyMd    ? String(bodyMd)   : "",
      tags:        Array.isArray(tags) ? (tags as string[]).map(String) : [],
      assetType:   assetType ? String(assetType) : null,
      status:      resolvedStatus,
      authorId:    String(req.v2UserId   ?? "unknown"),
      authorName:  req.v2Username ?? String(req.v2UserId ?? "unknown"),
      publishedAt: resolvedStatus === "published" ? now : null,
    });
    return res.status(201).json(article);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Slug already exists." });
    if (err?.code === "23503") return res.status(400).json({ error: "Invalid categoryId." });
    return res.status(500).json({ error: "Failed to create article." });
  }
});

// ── Articles: update ──────────────────────────────────────────────────────────
// updated_at and published_at managed in kbArticlesRepo.update()

router.patch("/articles/:id", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;

  const id      = String(req.params["id"]);
  const existing = await kbArticlesRepo.getById(id);
  if (!existing) return res.status(404).json({ error: "Article not found." });

  const {
    categoryId, title, slug, bodyMd, tags, assetType, status,
  } = req.body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (categoryId !== undefined) patch["categoryId"] = String(categoryId);
  if (title      !== undefined) patch["title"]      = String(title);
  if (slug       !== undefined) patch["slug"]       = String(slug);
  if (bodyMd     !== undefined) patch["bodyMd"]     = String(bodyMd);
  if (assetType  !== undefined) patch["assetType"]  = assetType ? String(assetType) : null;
  if (status     !== undefined) patch["status"]     = status === "published" ? "published" : "draft";
  if (tags       !== undefined) patch["tags"]       = Array.isArray(tags) ? (tags as string[]).map(String) : [];

  try {
    const updated = await kbArticlesRepo.update(id, patch as any, existing.status);
    if (!updated) return res.status(404).json({ error: "Article not found." });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Slug already exists." });
    if (err?.code === "23503") return res.status(400).json({ error: "Invalid categoryId." });
    return res.status(500).json({ error: "Failed to update article." });
  }
});

// ── Articles: delete ──────────────────────────────────────────────────────────

router.delete("/articles/:id", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;
  const id = String(req.params["id"]);
  const existing = await kbArticlesRepo.getById(id);
  if (!existing) return res.status(404).json({ error: "Article not found." });
  await kbArticlesRepo.delete(id);
  return res.status(204).send();
});

export default router;
