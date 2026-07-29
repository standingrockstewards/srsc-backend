/**
 * client/src/lib/kbApi.ts  (Brick 10k)
 *
 * Public KB API fetch helpers — no auth required.
 * Uses raw fetch (not apiFetch) so credentials are NOT sent.
 * The public endpoints live at the same VITE_API_BASE but require no session.
 *
 * All functions throw on non-2xx; callers catch and set error state.
 */

import type { KbCategory, KbArticle } from "./kbTypes";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

async function kbFetch<T>(path: string): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url); // no credentials — public API
  if (!res.ok) {
    const err = new Error(`${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function fetchCategories(): Promise<KbCategory[]> {
  return kbFetch<KbCategory[]>("/kb/categories");
}

export interface ArticleListParams {
  category?: string;  // category slug
  tag?:      string;
  q?:        string;
  limit?:    number;
  offset?:   number;
}

export async function fetchArticles(params: ArticleListParams = {}): Promise<KbArticle[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.tag)      qs.set("tag",      params.tag);
  if (params.q)        qs.set("q",        params.q);
  if (params.limit)    qs.set("limit",    String(params.limit));
  if (params.offset)   qs.set("offset",   String(params.offset));
  const query = qs.toString();
  return kbFetch<KbArticle[]>(`/kb/articles${query ? `?${query}` : ""}`);
}

export async function fetchArticle(slug: string): Promise<KbArticle> {
  return kbFetch<KbArticle>(`/kb/articles/${encodeURIComponent(slug)}`);
}
