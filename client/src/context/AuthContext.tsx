/**
 * src/context/AuthContext.tsx  (Brick 10d — 401 redirect handler registered)
 *
 * Auth state lives here. Source of truth is the server session (cookie).
 * On mount, <AuthProvider> calls GET /auth/me to hydrate from an existing session.
 *
 * localStorage is used ONLY to persist role + customerId across page refreshes
 * so the sidebar can render before the /me check resolves. The cookie is never
 * read or written in JS — it is httpOnly by design.
 *
 * No token. No Authorization header.
 *
 * 401 handling (Brick 10d):
 *   registerUnauthorizedHandler() is called on mount. When any non-/auth/me
 *   request returns 401 (session expired), the handler clears auth state and
 *   redirects to /login?returnTo=<current path> so the user lands back where
 *   they were after re-authenticating. The /auth/me path is excluded from the
 *   handler to prevent a redirect loop on cold load.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, ApiError, registerUnauthorizedHandler } from "@/lib/api";
import type { UserRole, Permissions, LoginResponse, AuthUser } from "@/types";

// ── Context shape ──────────────────────────────────────────────────────────────

interface AuthState {
  user:        AuthUser | null;
  role:        UserRole | null;
  customerId:  string | null;
  permissions: Permissions;
  loading:     boolean;
}

interface AuthContextValue extends AuthState {
  login:  (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── localStorage keys ─────────────────────────────────────────────────────────

const LS_ROLE       = "srsc_role";
const LS_CUSTOMER   = "srsc_customer_id";

function persistSession(role: UserRole, customerId: string | null) {
  localStorage.setItem(LS_ROLE, role);
  if (customerId) localStorage.setItem(LS_CUSTOMER, customerId);
  else            localStorage.removeItem(LS_CUSTOMER);
}

function clearSession() {
  localStorage.removeItem(LS_ROLE);
  localStorage.removeItem(LS_CUSTOMER);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [state, setState] = useState<AuthState>({
    user:        null,
    role:        (localStorage.getItem(LS_ROLE) as UserRole | null) ?? null,
    customerId:  localStorage.getItem(LS_CUSTOMER),
    permissions: {},
    loading:     true,
  });

  // Keep a ref to current location so the 401 handler can read it without
  // being re-registered every navigation (avoids stale closure).
  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  // Register the global 401 handler once on mount.
  // When a non-/auth/me request returns 401, clear state + redirect to login
  // with ?returnTo=<current path> so LoginPage can send the user back.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearSession();
      setState({ user: null, role: null, customerId: null, permissions: {}, loading: false });
      const currentPath = locationRef.current.pathname + locationRef.current.search;
      // Don't add returnTo if already on /login
      if (currentPath !== "/login") {
        navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`, { replace: true });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Hydrate from existing session on mount
  useEffect(() => {
    api.get<LoginResponse>("/auth/me")
      .then((data) => {
        persistSession(data.role, data.customerId);
        setState({
          user:        data.user,
          role:        data.role,
          customerId:  data.customerId,
          permissions: data.permissions ?? {},
          loading:     false,
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
        }
        setState((s) => ({ ...s, user: null, loading: false }));
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.post<LoginResponse>("/auth/login", { username, password });
    persistSession(data.role, data.customerId);
    setState({
      user:        data.user,
      role:        data.role,
      customerId:  data.customerId,
      permissions: data.permissions ?? {},
      loading:     false,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best effort — clear local state regardless
    }
    clearSession();
    setState({ user: null, role: null, customerId: null, permissions: {}, loading: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated: !state.loading && state.user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
