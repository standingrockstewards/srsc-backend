/**
 * src/App.tsx (Brick 10e — OpsMapPage + /ops-map route)
 *
 * Route tree additions from 10e:
 *  - /ops-map — RequireRole([admin, supervisor, field_tech]) -> OpsMapPage.
 *    Vendors and clients land on /dashboard redirect (RequireRole fallback).
 *
 * AuthProvider is inside BrowserRouter (needs useNavigate for the 401 redirect handler).
 *
 * Pages are lazy-loaded so a single broken page module cannot white-screen the
 * whole app: the failure is isolated to its own route and caught by ErrorBoundary.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider, useToast } from "@/context/ToastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { registerNetworkErrorHandler } from "@/lib/api";

// Pages — lazy loaded (named exports, so map to { default }).
const LoginPage = lazy(() => import("@/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const PropertiesPage = lazy(() => import("@/pages/PropertiesPage").then(m => ({ default: m.PropertiesPage })));
const PropertyDetailPage = lazy(() => import("@/pages/PropertyDetailPage").then(m => ({ default: m.PropertyDetailPage })));
const CustomersPage = lazy(() => import("@/pages/CustomersPage").then(m => ({ default: m.CustomersPage })));
const FieldOpsPage = lazy(() => import("@/pages/FieldOpsPage").then(m => ({ default: m.FieldOpsPage })));
const JobsPage = lazy(() => import("@/pages/JobsPage").then(m => ({ default: m.JobsPage })));
const MonitoringPage = lazy(() => import("@/pages/MonitoringPage").then(m => ({ default: m.MonitoringPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(m => ({ default: m.AdminPage })));
const OpsMapPage = lazy(() => import("@/pages/OpsMapPage").then(m => ({ default: m.OpsMapPage })));
const TwoFactorSetupPage = lazy(() => import("@/pages/TwoFactorSetupPage").then(m => ({ default: m.TwoFactorSetupPage })));
const CalendarPage = lazy(() => import("@/pages/CalendarPage").then(m => ({ default: m.CalendarPage })));
const KbEditorPage = lazy(() => import("@/pages/KbEditorPage").then(m => ({ default: m.KbEditorPage })));
const KbEditorListPage = lazy(() => import("@/pages/KbEditorListPage").then(m => ({ default: m.KbEditorListPage })));
const AccountSecurityPage = lazy(() => import("@/pages/AccountSecurityPage").then(m => ({ default: m.AccountSecurityPage })));
const AdminVaultPage = lazy(() => import("@/pages/AdminVaultPage").then(m => ({ default: m.AdminVaultPage })));
const KbIndexPage = lazy(() => import("@/pages/KbIndexPage").then(m => ({ default: m.KbIndexPage })));
const KbCategoryPage = lazy(() => import("@/pages/KbCategoryPage").then(m => ({ default: m.KbCategoryPage })));
const KbArticlePage = lazy(() => import("@/pages/KbArticlePage").then(m => ({ default: m.KbArticlePage })));

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
<ToastProvider>
<BrowserRouter>
<AuthProvider>
<NetworkErrorBridge />
<Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
<Routes>
{/* Public */}
<Route path="/login" element={<LoginPage />} />

{/* Brick 10k — Public KB pages (no auth required) */}
<Route path="/kb" element={<KbIndexPage />} />
<Route path="/kb/category/:slug" element={<KbCategoryPage />} />
{/* /kb/:slug must come AFTER /kb/editor to avoid capturing 'editor' as slug */}
<Route path="/kb/:slug" element={<KbArticlePage />} />

{/* Root redirect */}
<Route path="/" element={<Navigate to="/dashboard" replace />} />

{/* Protected shell */}
<Route element={<RequireAuth><AppShell /></RequireAuth>}>
<Route path="/dashboard" element={<DashboardPage />} />
<Route path="/properties" element={<PropertiesPage />} />
<Route path="/properties/:id" element={<PropertyDetailPage />} />
<Route path="/customers" element={<CustomersPage />} />
<Route path="/field-ops" element={<FieldOpsPage />} />
<Route path="/jobs" element={<JobsPage />} />
<Route path="/monitoring" element={<MonitoringPage />} />
<Route path="/admin" element={<AdminPage />} />

{/* Brick 10e — Confidential Ops Map */}
{/* vendor + client -> RequireRole redirects to /dashboard */}
<Route path="/ops-map" element={<RequireRole roles={["admin", "supervisor", "field_tech"]}><OpsMapPage /></RequireRole>} />

{/* Brick 10Y — Account Security (any role: each user manages own 2FA) */}
<Route path="/account/security" element={<AccountSecurityPage />} />
<Route path="/account/2fa" element={<TwoFactorSetupPage />} />

{/* Brick 10g — Calendar (admin/supervisor/field_tech) */}
<Route path="/calendar" element={<CalendarPage />} />

{/* Brick 10W — KB admin write UI */}
{/* /kb/editor -> KbEditorListPage (admin article table) */}
{/* /kb/editor/new -> KbEditorPage (create) */}
{/* /kb/editor/:id -> KbEditorPage (edit existing) */}
<Route path="/kb/editor" element={<KbEditorListPage />} />
<Route path="/kb/editor/new" element={<KbEditorPage />} />
<Route path="/kb/editor/:id" element={<KbEditorPage />} />

{/* Brick 10Z: Encrypted Vault — admin only */}
<Route path="/admin/vault" element={<RequireRole roles={["admin"]}><AdminVaultPage /></RequireRole>} />
</Route>

{/* Catch-all */}
<Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
</Suspense>
</AuthProvider>
</BrowserRouter>
</ToastProvider>
</ErrorBoundary>
);
}
