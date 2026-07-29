/**
 * server/routes/v2/kb.ts  (Brick 10i + Brick 10j)
 *
 * Two routers exported:
 *
 *   kbPublicRouter  — NO auth required. Published data only.
 *     GET  /api/v2/kb/categories
 *     GET  /api/v2/kb/articles?category=<slug>&tag=<t>&q=<search>
 *     GET  /api/v2/kb/articles/:slug      (published only; 404 on draft/missing)
 *
 *   default (router)  — requireAuthV2 wall. All roles except vendor see published;
 *                        admin/supervisor see drafts + full CRUD.
 *     GET    /api/v2/kb/categories
 *     POST   /api/v2/kb/categories
 *     PATCH  /api/v2/kb/categories/:id
 *     DELETE /api/v2/kb/categories/:id
 *     GET    /api/v2/kb/articles              ?category=&tag=&search=&status=
 *     GET    /api/v2/kb/articles/tags
 *     GET    /api/v2/kb/articles/:idOrSlug    (draft visible to admin/supervisor only)
 *     POST   /api/v2/kb/articles
 *     PATCH  /api/v2/kb/articles/:id
 *     DELETE /api/v2/kb/articles/:id
 *
 * Mount order in index.ts (IMPORTANT):
 *   v2.use("/kb", kbPublicRouter);    // before requireAuthV2
 *   ...
 *   v2.use(requireAuthV2);
 *   v2.use("/kb", router);            // after requireAuthV2
 */

import { Router, type Request, type Response } from "express";
import { requireAuthV2 } from "../../middleware/authV2";
import { kbCategoriesRepo, kbArticlesRepo } from "../../repositories/kb";

// ═══════════════════════════════════════════════════════════════════
// PUBLIC ROUTER  — no auth, published data only
// ═══════════════════════════════════════════════════════════════════

export const kbPublicRouter = Router();

/**
 * GET /api/v2/kb/categories
 * Returns all categories ordered by sort_order. No auth required.
 */
kbPublicRouter.get("/categories", async (_req: Request, res: Response) => {
  try {
    return res.json(await kbCategoriesRepo.getAll());
  } catch {
    return res.status(500).json({ error: "Failed to load categories." });
  }
});

/**
 * GET /api/v2/kb/articles?category=<slug>&tag=<t>&q=<search>
 * Returns published articles only. category param is a category SLUG.
 * No auth required.
 */
kbPublicRouter.get("/articles", async (req: Request, res: Response) => {
  const { category, tag, q, limit, offset } = req.query as Record<string, string | undefined>;

  // Resolve category slug → id if provided
  let categoryId: string | undefined;
  if (category) {
    const cat = await kbCategoriesRepo.getBySlug(category);
    if (!cat) return res.json([]); // unknown slug → empty result, not 404
    categoryId = cat.id;
  }

  try {
    const articles = await kbArticlesRepo.list({
      categoryId,
      tag,
      search: q,
      status: "published",
      limit:  limit  ? Number(limit)  : 50,
      offset: offset ? Number(offset) : 0,
    });
    return res.json(articles);
  } catch {
    return res.status(500).json({ error: "Failed to load articles." });
  }
});

/**
 * GET /api/v2/kb/articles/:slug
 * Returns a single published article by slug. 404 if draft or missing.
 * Note: only slug lookup — not ID — for the public API.
 */
kbPublicRouter.get("/articles/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params["slug"]);
  try {
    const article = await kbArticlesRepo.getBySlug(slug);
    if (!article || article.status !== "published") {
      return res.status(404).json({ error: "Article not found." });
    }
    return res.json(article);
  } catch {
    return res.status(500).json({ error: "Failed to load article." });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTER  — requireAuthV2 applied at mount site
// ═══════════════════════════════════════════════════════════════════

const router = Router();
router.use(requireAuthV2);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAdminOrSup(role: string) { return role === "admin" || role === "supervisor"; }
function isVendor(role: string)     { return role === "vendor"; }

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

  const role     = req.v2Role ?? "";
  const idOrSlug = String(req.params["idOrSlug"]);

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

  const { categoryId, title, slug, bodyMd, tags, assetType, status } = req.body as Record<string, unknown>;

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

// ── Articles: update (updated_at + published_at managed in repo) ──────────────

router.patch("/articles/:id", async (req: Request, res: Response) => {
  if (!requireAdminSupKb(req, res)) return;

  const id       = String(req.params["id"]);
  const existing = await kbArticlesRepo.getById(id);
  if (!existing) return res.status(404).json({ error: "Article not found." });

  const { categoryId, title, slug, bodyMd, tags, assetType, status } = req.body as Record<string, unknown>;

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
