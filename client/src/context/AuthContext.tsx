/**
 * src/context/AuthContext.tsx
 *
 * Auth state lives here. Source of truth is the server session (cookie).
 * On mount, <AuthProvider> calls GET /auth/me to hydrate from an existing session.
 *
 * localStorage is used ONLY to persist role + customerId across page refreshes
 * so the sidebar can render before the /me check resolves. The cookie is never
 * read or written in JS — it is httpOnly by design.
 *
 * No token. No Authorization header.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/api";
import type { UserRole, Permissions, LoginResponse, AuthUser } from "@/types";

// ── Context shape ──────────────────────────────────────────────────────────────

interface AuthState {
  user:        AuthUser | null;
  role:        UserRole | null;
  customerId:  string | null;    // text cuid2 — null for non-client roles
  permissions: Permissions;
  loading:     boolean;          // true while /me is in flight on mount
}

interface AuthContextValue extends AuthState {
  login:  (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** True if auth check is done AND user is authenticated */
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
  const [state, setState] = useState<AuthState>({
    user:        null,
    role:        (localStorage.getItem(LS_ROLE) as UserRole | null) ?? null,
    customerId:  localStorage.getItem(LS_CUSTOMER),
    permissions: {},
    loading:     true,
  });

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
        // 401 = no active session — clear stale localStorage
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
