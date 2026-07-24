import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";

// Public pages (no auth required)
import HomePage from "@/pages/public/home";
import ServicesPage from "@/pages/public/services";
import HowItWorksPage from "@/pages/public/how-it-works";
import ContactPage from "@/pages/public/contact";

// Auth pages
import LoginPage from "@/pages/login";

// Authenticated pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminProperties from "@/pages/admin/properties";
import AdminPropertyDetail from "@/pages/admin/property-detail";
import AdminVisitDetail from "@/pages/admin/visit-detail";
import AdminUsers from "@/pages/admin/users";
import UserManagementPage from "@/pages/admin/user-management";
import TechDashboard from "@/pages/tech/dashboard";
import TechVisitFlow from "@/pages/tech/visit-flow";
import TechVisitList from "@/pages/tech/visits";
import ClientPortal from "@/pages/client/portal";
import ClientAccount from "@/pages/client/account";
import ClientServiceRequests from "@/pages/client/service-requests";
import ClientMessages from "@/pages/client/messages";
import EscalationLogPage from "@/pages/admin/escalation-log";
import StormEventsLog from "@/pages/admin/storm-events";
import AdminServiceRequests from "@/pages/admin/service-requests";
import CalendarPage from "@/pages/calendar";
import VendorPortal from "@/pages/vendor/portal";
import VendorManagement from "@/pages/admin/vendor-management";
import AdminVisitReports from "@/pages/admin/visit-reports";
import AdminKnowledgeBasePage from "@/pages/admin/knowledge-base";
import KBIndexPage from "@/pages/kb/index";
import KBArticlePage from "@/pages/kb/article";
import SignalFlaresPage from "@/pages/admin/signal-flares";
import ClientSignalFlaresPage from "@/pages/client/signal-flares";
import TechSignalFlaresPage from "@/pages/tech/signal-flares";
import AdminBillingPage from "@/pages/admin/billing";
import ClientBillingPage from "@/pages/client/billing";
import AdminQuotesPage from "@/pages/admin/quotes";
import ClientQuotesPage from "@/pages/client/quotes";
import AdminRetainerPage from "@/pages/admin/retainer";
import OpsMapPage from "@/pages/admin/ops-map";
import SignupPage from "@/pages/public/signup";
import OnboardingQueuePage from "@/pages/admin/onboarding-queue";
import TosManagerPage from "@/pages/admin/tos-manager";
import VendorCompliancePage from "@/pages/admin/vendor-compliance";
import LifecyclePage from "@/pages/admin/lifecycle";
import ReferralPage from "@/pages/client/referral";
import ReferralsAdminPage from "@/pages/admin/referrals";
import { TosGate } from "@/components/tos-gate";
import { FirstRunWizard } from "@/components/first-run-wizard";
import NotFound from "@/pages/not-found";
// Business Ops Layer
import { KpiDashboard } from "@/pages/admin/kpi-dashboard";
import { NotificationsPage } from "@/pages/notifications";
import { NotificationPreferencesPage } from "@/pages/notification-preferences";
import { AuditLogPage } from "@/pages/admin/audit-log";

// Placeholder for tech visit detail
function TechVisitDetail() {
  return <div className="p-8 text-center text-muted-foreground">Loading visit...</div>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* ─── PUBLIC ROUTES (no auth required) ─── */}
      <Route path="/" component={HomePage} />
      <Route path="/services" component={ServicesPage} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/signup" component={SignupPage} />

      {/* ─── LOGIN ─── */}
      <Route path="/login" component={LoginPage} />

      {/* ─── AUTHENTICATED ROUTES ─── */}
      {!user ? (
        // Not logged in — show login for any portal route
        <Route component={LoginPage} />
      ) : user.role === "vendor" ? (
        <Switch>
          <Route path="/portal" component={VendorPortal} />
          <Route path="/dashboard" component={VendorPortal} />
          <Route component={VendorPortal} />
        </Switch>
      ) : user.role === "client" ? (
        <TosGate>
          <FirstRunWizard>
            <Switch>
              <Route path="/portal" component={ClientPortal} />
              <Route path="/dashboard" component={ClientPortal} />
              <Route path="/account" component={ClientAccount} />
              <Route path="/service-requests" component={ClientServiceRequests} />
              <Route path="/messages" component={ClientMessages} />
              <Route path="/kb" component={KBIndexPage} />
              <Route path="/kb/:slug" component={KBArticlePage} />
              <Route path="/signal-flares" component={ClientSignalFlaresPage} />
              <Route path="/billing" component={ClientBillingPage} />
              <Route path="/quotes" component={ClientQuotesPage} />
              <Route path="/referral" component={ReferralPage} />
              <Route path="/notifications" component={NotificationsPage} />
              <Route path="/notification-preferences" component={NotificationPreferencesPage} />
              <Route component={ClientPortal} />
            </Switch>
          </FirstRunWizard>
        </TosGate>
      ) : user.role === "field_tech" ? (
        <Switch>
          <Route path="/tech" component={TechDashboard} />
          <Route path="/visits" component={TechVisitList} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/visit/:id" component={TechVisitDetail} />
          <Route path="/visit/new/:propertyId" component={TechVisitFlow} />
          <Route path="/kb" component={KBIndexPage} />
          <Route path="/kb/:slug" component={KBArticlePage} />
          <Route path="/signal-flares" component={TechSignalFlaresPage} />
          <Route path="/ops-map" component={OpsMapPage} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/notification-preferences" component={NotificationPreferencesPage} />
          <Route component={TechDashboard} />
        </Switch>
      ) : (
        // Admin + Supervisor
        <Switch>
          <Route path="/dashboard" component={AdminDashboard} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/properties" component={AdminProperties} />
          <Route path="/properties/:id" component={AdminPropertyDetail} />
          <Route path="/visits/:id" component={AdminVisitDetail} />
          <Route path="/users" component={UserManagementPage} />
          <Route path="/users-legacy" component={AdminUsers} />
          <Route path="/escalation-log" component={EscalationLogPage} />
          <Route path="/storm-events" component={StormEventsLog} />
          <Route path="/vendors" component={VendorManagement} />
          <Route path="/visit-reports" component={AdminVisitReports} />
          <Route path="/service-requests" component={AdminServiceRequests} />
          <Route path="/messages" component={ClientMessages} />
          <Route path="/visit/new/:propertyId" component={TechVisitFlow} />
          <Route path="/kb/manage" component={AdminKnowledgeBasePage} />
          <Route path="/kb" component={KBIndexPage} />
          <Route path="/kb/:slug" component={KBArticlePage} />
          <Route path="/signal-flares" component={SignalFlaresPage} />
          <Route path="/billing" component={AdminBillingPage} />
          <Route path="/quotes" component={AdminQuotesPage} />
          <Route path="/retainer" component={AdminRetainerPage} />
          <Route path="/ops-map" component={OpsMapPage} />
          <Route path="/onboarding-queue" component={OnboardingQueuePage} />
          <Route path="/tos-manager" component={TosManagerPage} />
          <Route path="/vendor-compliance" component={VendorCompliancePage} />
          <Route path="/lifecycle" component={LifecyclePage} />
          <Route path="/referrals" component={ReferralsAdminPage} />
          <Route path="/kpi-dashboard" component={KpiDashboard} />
          <Route path="/notifications" component={NotificationsPage} />
          <Route path="/notification-preferences" component={NotificationPreferencesPage} />
          <Route path="/audit" component={AuditLogPage} />
          <Route component={NotFound} />
        </Switch>
      )}
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <AppRoutes />
          </Router>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
