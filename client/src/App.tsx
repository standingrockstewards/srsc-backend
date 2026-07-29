/**
 * src/App.tsx
 *
 * Route tree:
 *   /login              — public, LoginPage
 *   /                   — redirect to /dashboard
 *   /dashboard          — RequireAuth → AppShell → DashboardPage
 *   /properties         — RequireAuth → AppShell → PropertiesPage
 *   /customers          — RequireAuth → AppShell → CustomersPage
 *   /field-ops          — RequireAuth → AppShell → FieldOpsPage
 *   /admin              — RequireAuth + RequireRole([admin,supervisor]) → AppShell → AdminPage
 *   *                   — redirect to /dashboard
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { LoginPage }      from "@/pages/LoginPage";
import { DashboardPage }  from "@/pages/DashboardPage";
import { PropertiesPage } from "@/pages/PropertiesPage";
import { CustomersPage }  from "@/pages/CustomersPage";
import { FieldOpsPage }   from "@/pages/FieldOpsPage";
import { AdminPage }      from "@/pages/AdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected shell — all children share the sidebar layout */}
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

            {/* Admin/Supervisor only */}
            <Route
              path="/admin"
              element={
                <RequireRole roles={["admin", "supervisor"]}>
                  <AdminPage />
                </RequireRole>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
