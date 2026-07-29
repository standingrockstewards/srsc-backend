/**
 * server/repositories/kb.ts  (Brick 10i)
 *
 * CRUD for kb_categories and kb_articles.
 *
 * Rules:
 *   - updated_at set application-side on every UPDATE.
 *   - published_at set when status flips to 'published' (if not already set).
 *   - Draft articles only visible to admin/supervisor — callers enforce this.
 *   - All IDs are text (nanoid). No parseInt.
 *   - tags is TEXT[] — passed as string[] from the client.
 */

import { eq, and, or, ilike, arrayContains, asc, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  kbCategories,
  kbArticles,
  type InsertKbCategory,
  type InsertKbArticle,
  type KbCategory,
  type KbArticle,
} from "../../shared/schema-v2";

// ── Categories ────────────────────────────────────────────────────────────────

export const kbCategoriesRepo = {
  async getAll(): Promise<KbCategory[]> {
    return db.select().from(kbCategories).orderBy(asc(kbCategories.sortOrder));
  },

  async getById(id: string): Promise<KbCategory | undefined> {
    const [row] = await db.select().from(kbCategories).where(eq(kbCategories.id, id)).limit(1);
    return row;
  },

  async getBySlug(slug: string): Promise<KbCategory | undefined> {
    const [row] = await db.select().from(kbCategories).where(eq(kbCategories.slug, slug)).limit(1);
    return row;
  },

  async create(data: InsertKbCategory): Promise<KbCategory> {
    const [row] = await db.insert(kbCategories).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertKbCategory>): Promise<KbCategory | undefined> {
    const [row] = await db.update(kbCategories).set(data).where(eq(kbCategories.id, id)).returning();
    return row;
  },

  async delete(id: string): Promise<void> {
    await db.delete(kbCategories).where(eq(kbCategories.id, id));
  },
};

// ── Articles ──────────────────────────────────────────────────────────────────

export interface ArticleListOptions {
  categoryId?:  string;
  tag?:         string;
  search?:      string;        // ilike on title
  status?:      "draft" | "published" | "all";  // default "published"
  limit?:       number;
  offset?:      number;
}

export const kbArticlesRepo = {
  async list(opts: ArticleListOptions = {}): Promise<KbArticle[]> {
    const {
      categoryId,
      tag,
      search,
      status = "published",
      limit  = 50,
      offset = 0,
    } = opts;

    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(kbArticles.status, status));
    }
    if (categoryId) {
      conditions.push(eq(kbArticles.categoryId, categoryId));
    }
    if (tag) {
      // GIN-indexed array containment: tags @> ARRAY[tag]
      conditions.push(arrayContains(kbArticles.tags, [tag]));
    }
    if (search) {
      conditions.push(ilike(kbArticles.title, `%${search}%`));
    }

    const query = db
      .select()
      .from(kbArticles)
      .orderBy(desc(kbArticles.updatedAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  },

  async getById(id: string): Promise<KbArticle | undefined> {
    const [row] = await db.select().from(kbArticles).where(eq(kbArticles.id, id)).limit(1);
    return row;
  },

  async getBySlug(slug: string): Promise<KbArticle | undefined> {
    const [row] = await db.select().from(kbArticles).where(eq(kbArticles.slug, slug)).limit(1);
    return row;
  },

  async create(data: InsertKbArticle): Promise<KbArticle> {
    const [row] = await db.insert(kbArticles).values(data).returning();
    return row;
  },

  /**
   * Update an article.
   * - updated_at always set to now() (application-side).
   * - published_at set to now() when status flips to 'published' (if not already set).
   */
  async update(
    id: string,
    patch: Partial<Omit<InsertKbArticle, "authorId" | "authorName">>,
    existingStatus?: string,
  ): Promise<KbArticle | undefined> {
    const now = new Date();

    const dbPatch: Record<string, unknown> = { ...patch, updatedAt: now };

    // Set published_at when status flips to published (only if not already set)
    if (patch.status === "published" && existingStatus !== "published") {
      if (!("publishedAt" in patch) || patch.publishedAt == null) {
        dbPatch["publishedAt"] = now;
      }
    }

    const [row] = await db
      .update(kbArticles)
      .set(dbPatch as any)
      .where(eq(kbArticles.id, id))
      .returning();
    return row;
  },

  async delete(id: string): Promise<void> {
    await db.delete(kbArticles).where(eq(kbArticles.id, id));
  },

  /** All unique tags across published articles (for filter UI). */
  async allPublishedTags(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ tags: kbArticles.tags })
      .from(kbArticles)
      .where(eq(kbArticles.status, "published"));
    const tagSet = new Set<string>();
    for (const r of rows) {
      for (const t of (r.tags ?? [])) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  },
};
