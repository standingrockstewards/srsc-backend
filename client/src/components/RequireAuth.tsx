/**
 * src/components/RequireAuth.tsx
 *
 * Route guard: redirects to /login if the session /me check returned 401.
 * While the check is in-flight (loading=true), renders nothing (prevents flash).
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;  // wait for /me — no flash of redirect

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
