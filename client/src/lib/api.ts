/**
 * src/lib/api.ts  (Brick 10d — 401 handler + network toast)
 *
 * Centralised fetch wrapper for the v2 API.
 *
 * - Prefixes every request with VITE_API_BASE.
 * - ALWAYS sends credentials: "include" (httpOnly session cookie).
 * - Does NOT send an Authorization header. No token — cookie-only auth.
 * - On 401: fires the registered onUnauthorized callback (clears auth + redirects).
 *   Guard: if the request is /auth/me itself, does NOT fire the callback to
 *   avoid a redirect loop on the initial session hydration check.
 * - On network failure or 5xx: fires the registered onNetworkError callback
 *   so a non-blocking toast can be shown.
 * - Every failure is either thrown (caller degrades) or logged — no silent drops.
 */

// VITE_API_BASE is baked in at build time by vite.config.ts define block.
// Falls back to "/api/v2" so the SPA always works same-origin even if the
// env var was absent during the build.
const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api/v2";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Module-level callbacks registered by providers ────────────────────────────
// Using module-level refs avoids circular imports with AuthContext/ToastContext.

type UnauthorizedHandler = () => void;
type NetworkErrorHandler = (message: string) => void;

let _onUnauthorized: UnauthorizedHandler | null = null;
let _onNetworkError: NetworkErrorHandler | null  = null;

/** Called once by AuthProvider on mount to register the 401 redirect handler. */
export function registerUnauthorizedHandler(fn: UnauthorizedHandler) {
  _onUnauthorized = fn;
}

/** Called once by ToastProvider on mount to register the network-error toast handler. */
export function registerNetworkErrorHandler(fn: NetworkErrorHandler) {
  _onNetworkError = fn;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "credentials"> {
  // credentials is always "include" — callers cannot override it
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch (networkErr) {
    // Network-level failure (offline, DNS, CORS preflight crash)
    const msg = navigator.onLine
      ? "Server unreachable. Check your connection."
      : "You appear to be offline.";
    _onNetworkError?.(msg);
    console.warn("[api] Network error on", path, networkErr);
    throw new ApiError(0, msg);
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      message = body?.error ?? body?.message ?? message;
    } catch {
      // ignore parse errors — keep status text
    }

    // 401 handling — but NOT for /auth/me (avoids redirect loop on cold load)
    if (res.status === 401 && !path.includes("/auth/me")) {
      _onUnauthorized?.();
    }

    // 5xx server errors — show non-blocking toast
    if (res.status >= 500) {
      _onNetworkError?.(`Server error (${res.status}). Please try again.`);
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
