/**
 * src/lib/api.ts
 *
 * Centralised fetch wrapper for the v2 API.
 *
 * - Prefixes every request with VITE_API_BASE.
 * - ALWAYS sends credentials: "include" so the __Host-srsc-v2 session cookie
 *   is attached on every request. The cookie is httpOnly — JS never reads it.
 * - Does NOT send an Authorization header. There is no token; auth is cookie-only.
 * - On 401, throws an ApiError with status=401 so callers / guards can redirect.
 */

const BASE = import.meta.env.VITE_API_BASE as string;

if (!BASE) {
  console.error("[api] VITE_API_BASE is not set. Check your .env file.");
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "credentials"> {
  // credentials is always "include" — callers cannot override it
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    credentials: "include",   // always — session cookie
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      // ignore parse errors — keep the status text
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ── Convenience methods ────────────────────────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return apiFetch<T>(path, { method: "GET", ...options });
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return apiFetch<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return apiFetch<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    });
  },
  delete<T>(path: string, options?: RequestOptions) {
    return apiFetch<T>(path, { method: "DELETE", ...options });
  },
};
