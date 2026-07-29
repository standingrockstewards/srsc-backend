/**
 * src/components/RequireAuth.tsx  (Brick 10d — PageSpinner while loading)
 *
 * Route guard: redirects to /login if the session /me check returned 401.
 * While the check is in-flight, shows a PageSpinner instead of rendering
 * null (which produced a brief flash of blank content in 10a–10c).
 *
 * Preserves the intended destination in location.state.from so LoginPage
 * can redirect back after authentication.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PageSpinner } from "@/components/ui";
import type { ReactNode } from "react";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
