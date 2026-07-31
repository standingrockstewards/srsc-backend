/**
 * src/context/AuthContext.tsx  (Brick 10d — 401 redirect handler registered)
 *
 * Auth state lives here. Source of truth is the server session (cookie).
 * On mount, <AuthProvider> calls GET /auth/me to hydrate from an existing session.
 *
 * /auth/me is PUBLIC + null-safe on the server: it returns 200 with
 * { user: null, role: null, customerId: null, permissions: null } when there is
 * no session. The bootstrap below treats a null user as "logged out" and renders
 * the login UI instead of crashing. loading:true means "still checking".
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

// ── Context shape ───────────────────────────────────────
interface AuthState {
user: AuthUser | null;
role: UserRole | null;
customerId: string | null;
permissions: Permissions;
loading: boolean;
}

interface AuthContextValue extends AuthState {
login: (username: string, password: string) => Promise<void>;
logout: () => Promise<void>;
refreshMe: () => Promise<void>;  // Brick 10f: re-sync after TOTP validate
isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── localStorage keys ──────────────────────────────────
const LS_ROLE = "srsc_role";
const LS_CUSTOMER = "srsc_customer_id";

function persistSession(role: UserRole, customerId: string | null) {
localStorage.setItem(LS_ROLE, role);
if (customerId) localStorage.setItem(LS_CUSTOMER, customerId);
else localStorage.removeItem(LS_CUSTOMER);
}

function clearSession() {
localStorage.removeItem(LS_ROLE);
localStorage.removeItem(LS_CUSTOMER);
}

// ── Provider ───────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
const navigate = useNavigate();
const location = useLocation();

const [state, setState] = useState<AuthState>({
user: null,
role: (localStorage.getItem(LS_ROLE) as UserRole | null) ?? null,
customerId: localStorage.getItem(LS_CUSTOMER),
permissions: {},
loading: true,
});

// Apply a /auth/me (or /auth/login) response to state — null-safe.
// A null user means "logged out": clear persisted role/customerId and render
// the login UI instead of writing "null" strings to localStorage.
function applyMe(data: LoginResponse) {
if (!data || !data.user || !data.role) {
clearSession();
setState({
user: null,
role: null,
customerId: null,
permissions: {},
loading: false,
});
return;
}
persistSession(data.role, data.customerId);
setState({
user: data.user,
role: data.role,
customerId: data.customerId,
permissions: data.permissions ?? {},
loading: false,
});
}

// Keep a ref to current location so the 401 handler can read it without
// being re-registered every navigation (avoids stale closure).
const locationRef = useRef(location);
useEffect(() => {
locationRef.current = location;
}, [location]);

// Register the global 401 handler once on mount.
useEffect(() => {
registerUnauthorizedHandler(() => {
clearSession();
setState({ user: null, role: null, customerId: null, permissions: {}, loading: false });
const currentPath = locationRef.current.pathname + locationRef.current.search;
if (currentPath !== "/login") {
navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`, { replace: true });
}
});
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [navigate]);

// Hydrate from existing session on mount. /auth/me now returns 200 { user: null }
// when logged out, so the happy path already covers the unauthenticated case via
// applyMe(). The catch is a defensive fallback (network/5xx): never throw, never
// crash — resolve to logged-out so the login UI renders.
useEffect(() => {
api.get<LoginResponse>("/auth/me")
.then((data) => applyMe(data))
.catch((err) => {
if (err instanceof ApiError && err.status === 401) {
clearSession();
}
setState((s) => ({ ...s, user: null, role: null, loading: false }));
});
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const login = useCallback(async (username: string, password: string) => {
const data = await api.post<LoginResponse>("/auth/login", { username, password });
applyMe(data);
}, []);

// Brick 10f: re-sync auth state from server after TOTP validation promotes session
const refreshMe = useCallback(async () => {
const data = await api.get<LoginResponse>("/auth/me");
applyMe(data);
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
refreshMe,
}}
>
{children}
</AuthContext.Provider>
);
}

// ── Hook ────────────────────────────────────────────
export function useAuth(): AuthContextValue {
const ctx = useContext(AuthContext);
if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
return ctx;
}
