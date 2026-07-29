/**
 * src/components/RequireRole.tsx
 *
 * Role guard: renders children only if the authenticated user's role is in the
 * allowed list. Otherwise renders a 403 fallback (or redirects to /dashboard).
 *
 * Always nest inside <RequireAuth> — RequireRole does not check authentication.
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";
import type { UserRole } from "@/types";

interface RequireRoleProps {
  roles: UserRole[];
  children: ReactNode;
  /** Where to redirect on role mismatch. Defaults to /dashboard. */
  fallback?: string;
}

export function RequireRole({ roles, children, fallback = "/dashboard" }: RequireRoleProps) {
  const { role } = useAuth();

  if (!role || !roles.includes(role)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
