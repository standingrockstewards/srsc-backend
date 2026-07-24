import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiRequest } from "./queryClient";

export type PermissionKey = string;
export type Permissions = Record<PermissionKey, boolean>;

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "admin" | "field_tech" | "client" | "vendor" | "supervisor";
  active: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  permissions: Permissions;
  can: (key: PermissionKey) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshPermissions: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Inject user id + role into every API request header so backend can enforce permissions
const _origFetch = window.fetch;
let _currentUser: AuthUser | null = null;
window.fetch = function (input, init = {}) {
  if (_currentUser && typeof input === "string" && input.includes("/api/")) {
    const headers = new Headers(init.headers);
    headers.set("x-user-id", String(_currentUser.id));
    headers.set("x-user-role", _currentUser.role);
    init = { ...init, headers };
  }
  return _origFetch.call(this, input, init);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [isLoading, setIsLoading] = useState(false);

  // Keep the fetch interceptor's reference up to date
  useEffect(() => { _currentUser = user; }, [user]);

  const can = useCallback((key: PermissionKey) => permissions[key] === true, [permissions]);

  const refreshPermissions = useCallback(async () => {
    if (!_currentUser) return;
    try {
      const res = await apiRequest("GET", "/api/me/permissions");
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions ?? {});
      }
    } catch {}
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.user);
    setPermissions(data.permissions ?? {});
    _currentUser = data.user;
  };

  const logout = () => {
    setUser(null);
    setPermissions({});
    _currentUser = null;
  };

  return (
    <AuthContext.Provider value={{ user, permissions, can, login, logout, refreshPermissions, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Convenience hook for checking a single permission
export function useCan(permKey: PermissionKey): boolean {
  const { can } = useAuth();
  return can(permKey);
}
