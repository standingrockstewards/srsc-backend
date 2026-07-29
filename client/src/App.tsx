/**
 * src/App.tsx  (Brick 10e — OpsMapPage + /ops-map route)
 *
 * Route tree additions from 10e:
 *   - /ops-map  — RequireRole([admin, supervisor, field_tech]) → OpsMapPage.
 *     Vendors and clients land on /dashboard redirect (RequireRole fallback).
 *
 * AuthProvider is inside BrowserRouter (needs useNavigate for the 401 redirect handler).
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider, useToast } from "@/context/ToastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { registerNetworkErrorHandler } from "@/lib/api";
import { LoginPage }      from "@/pages/LoginPage";
import { DashboardPage }  from "@/pages/DashboardPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { CustomersPage }  from "@/pages/CustomersPage";
import { FieldOpsPage }   from "@/pages/FieldOpsPage";
import { AdminPage }      from "@/pages/AdminPage";
import { OpsMapPage }            from "@/pages/OpsMapPage";
import { TwoFactorSetupPage }    from "@/pages/TwoFactorSetupPage";
import { CalendarPage }          from "@/pages/CalendarPage";
import { KbPage }                from "@/pages/KbPage";
import { KbEditorPage }          from "@/pages/KbEditorPage";  // Brick 10i: KB editor

// Bridge: registers the network error handler once ToastProvider is in scope.
// Must be a child of ToastProvider so useToast() works.
function NetworkErrorBridge() {
  const { showToast } = useToast();
  useEffect(() => {
    registerNetworkErrorHandler((msg) => showToast("network", msg));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <NetworkErrorBridge />
          <AuthProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Protected shell */}
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard"  element={<DashboardPage />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/customers"  element={<CustomersPage />} />
                <Route path="/field-ops"  element={<FieldOpsPage />} />

                <Route
                  path="/admin"
                  element={
                    <RequireRole roles={["admin", "supervisor"]}>
                      <AdminPage />
                    </RequireRole>
                  }
                />

                {/* Brick 10e — Confidential Ops Map */}
                {/* vendor + client → RequireRole redirects to /dashboard */}
                <Route path="/settings/2fa" element={<TwoFactorSetupPage />} />

                {/* Brick 10g — Calendar (admin/supervisor/field_tech) */}
                <Route
                  path="/calendar"
                  element={
                    <RequireRole roles={["admin", "supervisor", "field_tech"]}>
                      <CalendarPage />
                    </RequireRole>
                  }
                />

                <Route
                  path="/ops-map"
                  element={
                    <RequireRole roles={["admin", "supervisor", "field_tech"]}>
                      <OpsMapPage />
                    </RequireRole>
                  }
                />

                {/* Brick 10i — Knowledge Base */}
                <Route path="/kb" element={<KbPage />} />
                <Route
                  path="/kb/editor"
                  element={
                    <RequireRole roles={["admin", "supervisor"]}>
                      <KbEditorPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/kb/editor/:id"
                  element={
                    <RequireRole roles={["admin", "supervisor"]}>
                      <KbEditorPage />
                    </RequireRole>
                  }
                />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
