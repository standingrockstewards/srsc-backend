/**
 * client/src/lib/kbTypes.ts  (Brick 10k)
 *
 * Shared types for public KB pages (consumed from the public API — no auth).
 */

export interface KbCategory {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  sortOrder:   number;
}

export interface KbArticle {
  id:          string;
  categoryId:  string;
  title:       string;
  slug:        string;
  bodyMd:      string;
  tags:        string[];
  assetType:   string | null;
  status:      "draft" | "published";
  authorName:  string;
  publishedAt: string | null;
  createdAt:   string;
  updatedAt:   string;
}
