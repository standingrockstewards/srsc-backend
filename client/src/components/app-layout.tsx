/**
 * AppLayout — full-app shell with responsive sidebar.
 *
 * Desktop (lg+): sidebar always visible at 15rem, no toggle needed.
 * Mobile (<lg):  sidebar hidden behind a slide-in drawer; hamburger toggle in header.
 *
 * Nav-flags: polls /api/nav-flags every 60s and on every route change.
 * Each nav item can carry a flagKey that maps to the returned flags map.
 * Severity → color:
 *   critical  → #E05252 (red)
 *   attention → #C05A43 (terracotta)
 *   info      → #7A8C6E (sage)
 */
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, type PermissionKey } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Building2, Users, LogOut,
  ClipboardList, AlertOctagon, Calendar, Anchor,
  FileText, MessageSquare, Wrench, FilePlus, ClipboardPlus,
  Map, CheckSquare, Bell, Menu, X, Zap, User, Home, BookOpen, Flame, CreditCard, Shield,
  UserPlus, ShieldCheck, UserMinus, Gift, Search, BarChart3, ClipboardCheck, Settings,
} from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import logoLight from "@assets/logo-light.png";

// ─── Brand palette ────────────────────────────────────────────────────────────
const TERRACOTTA  = "#C05A43";
const SAGE        = "#7A8C6E";
const SIDEBAR_BG  = "#141414";
const BORDER_CLR  = "#2a2a2a";

// ─── Severity → badge color ───────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  critical:  "#E05252",
  attention: "#C05A43",
  info:      "#7A8C6E",
};
const SEVERITY_BG: Record<string, string> = {
  critical:  "rgba(224,82,82,0.18)",
  attention: "rgba(192,90,67,0.18)",
  info:      "rgba(122,140,110,0.18)",
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  roles?: string[];
  permission?: PermissionKey;
  /** Key into the /api/nav-flags response map */
  flagKey?: string;
};

const allNavItems: NavItem[] = [
  // Admin + Supervisor
  { href: "/dashboard",        label: "Dashboard",           icon: LayoutDashboard, roles: ["admin", "supervisor"],  permission: "view_dashboard" },
  { href: "/properties",       label: "Properties",           icon: Building2,       roles: ["admin", "supervisor"],  permission: "view_all_properties" },
  { href: "/calendar",         label: "Calendar",             icon: Calendar,        roles: ["admin", "supervisor", "field_tech"], permission: "view_calendar" },
  { href: "/users",            label: "Staff & Users",        icon: Users,           roles: ["admin", "supervisor"],  permission: "manage_users" },
  { href: "/vendors",          label: "Vendor Management",    icon: Wrench,          roles: ["admin", "supervisor"],  permission: "manage_vendors",       flagKey: "vendors" },
  { href: "/visit-reports",    label: "Visit Reports",        icon: ClipboardList,   roles: ["admin", "supervisor"],  permission: "view_visit_reports" },
  { href: "/escalation-log",   label: "Escalation Log",       icon: AlertOctagon,    roles: ["admin", "supervisor"],  permission: "view_escalation_log" },
  { href: "/storm-events",     label: "Storm Events",         icon: Zap,             roles: ["admin", "supervisor"],  permission: "respond_storm_events", flagKey: "storm-events" },
  { href: "/service-requests", label: "Service Requests",     icon: Wrench,          roles: ["admin", "supervisor"],  permission: "manage_service_requests", flagKey: "service-requests" },
  { href: "/messages",         label: "Client Messages",      icon: MessageSquare,   roles: ["admin", "supervisor"],  permission: "view_all_messages",    flagKey: "messages" },
  { href: "/kb/manage",        label: "Knowledge Base",       icon: BookOpen,        roles: ["admin", "supervisor"],  permission: "manage_faq" },
  { href: "/signal-flares",    label: "Signal Flares",        icon: Flame,           roles: ["admin", "supervisor"],  permission: "respond_signal_flares",flagKey: "signal-flares" },
  { href: "/billing",          label: "Billing",              icon: CreditCard,      roles: ["admin", "supervisor"],  permission: "manage_billing",       flagKey: "billing" },
  { href: "/quotes",           label: "Quotes",               icon: FileText,        roles: ["admin", "supervisor"],  permission: "manage_quotes",        flagKey: "quotes" },
  { href: "/retainer",         label: "Retainer & Exposure",  icon: Shield,          roles: ["admin", "supervisor"],  permission: "manage_billing",       flagKey: "retainer" },
  { href: "/ops-map",          label: "Operations Map",       icon: Map,             roles: ["admin", "supervisor", "field_tech"] },
  { href: "/onboarding-queue", label: "Onboarding Queue",     icon: UserPlus,        roles: ["admin", "supervisor"],  permission: "manage_users",         flagKey: "onboarding-queue" },
  { href: "/tos-manager",      label: "Terms of Service",     icon: FileText,        roles: ["admin"],                permission: "manage_users" },
  { href: "/vendor-compliance",label: "Vendor Compliance",    icon: ShieldCheck,     roles: ["admin", "supervisor"],  permission: "manage_vendors" },
  { href: "/lifecycle",        label: "Client Lifecycle",     icon: UserMinus,       roles: ["admin"],                permission: "manage_users" },
  { href: "/referrals",        label: "Referrals",            icon: Gift,            roles: ["admin", "supervisor"],  permission: "manage_users" },
  // ── Business Ops Layer ──
  { href: "/kpi-dashboard",    label: "KPI Dashboard",        icon: BarChart3,       roles: ["admin", "supervisor"],  permission: "view_dashboard" },
  { href: "/audit",            label: "Audit Log",            icon: ClipboardCheck,  roles: ["admin", "supervisor"],  permission: "view_audit" as any },
  // ── Notifications (all roles) ──
  { href: "/notifications",    label: "Notifications",        icon: Bell,            roles: ["admin", "supervisor", "field_tech", "client", "vendor"], flagKey: "notifications" },
  // Field Tech
  { href: "/tech",             label: "My Dashboard",         icon: LayoutDashboard, roles: ["field_tech"] },
  { href: "/visits",           label: "My Visits",            icon: ClipboardList,   roles: ["field_tech"],           permission: "view_own_visits",      flagKey: "visits" },
  { href: "/calendar",         label: "My Calendar",          icon: Calendar,        roles: ["field_tech"],           permission: "view_calendar" },
  { href: "/kb",               label: "Knowledge Base",       icon: BookOpen,        roles: ["field_tech"],           permission: "view_faq" },
  { href: "/signal-flares",    label: "My Flares",            icon: Flame,           roles: ["field_tech"],                                               flagKey: "signal-flares" },
  { href: "/messages",         label: "Messages",             icon: MessageSquare,   roles: ["field_tech"],                                               flagKey: "messages" },
  // Client
  { href: "/portal",           label: "My Property",          icon: Home,            roles: ["client"],               permission: "view_own_property" },
  { href: "/service-requests", label: "Request Service",      icon: Wrench,          roles: ["client"],               permission: "submit_service_requests", flagKey: "service-requests" },
  { href: "/messages",         label: "Messages",             icon: MessageSquare,   roles: ["client"],               permission: "send_property_messages",  flagKey: "messages" },
  { href: "/kb",               label: "Knowledge Base",       icon: BookOpen,        roles: ["client"],               permission: "view_faq" },
  { href: "/signal-flares",    label: "Signal Flares",        icon: Flame,           roles: ["client"] },
  { href: "/billing",          label: "Billing",              icon: CreditCard,      roles: ["client"],               permission: "view_billing",          flagKey: "billing" },
  { href: "/quotes",           label: "Quotes",               icon: FileText,        roles: ["client"],                                                   flagKey: "quotes" },
  { href: "/account",          label: "My Account",           icon: User,            roles: ["client"] },
  { href: "/referral",         label: "Refer a Friend",       icon: Gift,            roles: ["client"] },
  // Vendor
  { href: "/dashboard",        label: "Vendor Portal",        icon: LayoutDashboard, roles: ["vendor"],                                                   flagKey: "dashboard" },
];

const adminActionItems: NavItem[] = [
  { href: "/properties/assign",      label: "Assign Work Order",   icon: ClipboardPlus, roles: ["admin", "supervisor"], permission: "assign_techs" },
  { href: "/properties/request-doc", label: "Request Document",    icon: FilePlus,      roles: ["admin", "supervisor"], permission: "approve_documents" },
];

// ─── Nav Flags types ──────────────────────────────────────────────────────────
type Severity = "critical" | "attention" | "info";
interface FlagEntry { count: number; severity: Severity }
type FlagsMap = Record<string, FlagEntry>;

// ─── Flag Badge Component ─────────────────────────────────────────────────────
function NavFlagBadge({ entry }: { entry: FlagEntry }) {
  const color = SEVERITY_COLOR[entry.severity] ?? TERRACOTTA;
  const bg    = SEVERITY_BG[entry.severity]    ?? "rgba(192,90,67,0.18)";
  return (
    <span
      className="flex items-center justify-center ml-auto flex-shrink-0 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full"
      style={{ background: bg, color, minWidth: "18px", letterSpacing: "0.01em" }}
    >
      {entry.count > 99 ? "99+" : entry.count}
    </span>
  );
}

// ─── Nav Link (with flag badge) ───────────────────────────────────────────────
function NavLink({
  item,
  location,
  onClick,
  flags,
}: {
  item: NavItem;
  location: string;
  onClick?: () => void;
  flags?: FlagsMap;
}) {
  const isActive =
    location === item.href ||
    (
      item.href !== "/" &&
      item.href !== "/dashboard" &&
      item.href !== "/portal" &&
      item.href !== "/vendor" &&
      location.startsWith(item.href)
    );

  const flagEntry = item.flagKey ? flags?.[item.flagKey] : undefined;
  const hasFlag = flagEntry && flagEntry.count > 0;

  const baseStyle: React.CSSProperties = isActive
    ? {
        backgroundColor: "rgba(192, 90, 67, 0.18)",
        color: TERRACOTTA,
        fontWeight: 600,
        borderLeft: `3px solid ${TERRACOTTA}`,
        paddingLeft: "13px",
      }
    : { borderLeft: "3px solid transparent", paddingLeft: "13px" };

  return (
    <Link
      href={item.href}
      onClick={onClick}
      style={{ ...baseStyle, color: isActive ? TERRACOTTA : "rgba(245,240,234,0.7)" } as React.CSSProperties}
      className="flex items-center gap-3 rounded-md py-2 pr-3 text-sm transition-colors hover:bg-white/5"
    >
      <span className="relative flex-shrink-0">
        <item.icon className="w-4 h-4" />
        {/* Dot on icon — always shows even if label is truncated */}
        {hasFlag && !isActive && (
          <span
            className="absolute -top-1 -right-1 rounded-full"
            style={{
              width: "7px",
              height: "7px",
              background: SEVERITY_COLOR[flagEntry!.severity] ?? TERRACOTTA,
              boxShadow: `0 0 0 1.5px ${SIDEBAR_BG}`,
            }}
          />
        )}
      </span>
      <span className="truncate flex-1">{item.label}</span>
      {hasFlag && <NavFlagBadge entry={flagEntry!} />}
    </Link>
  );
}

// ─── useNavFlags hook ────────────────────────────��────────────────────────────
function useNavFlags() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [location] = useLocation();
  const prevLocation = useRef(location);

  const { data } = useQuery<{ flags: FlagsMap }>({
    queryKey: ["nav-flags"],
    queryFn: () => apiRequest("GET", "/api/nav-flags").then(r => r.json()),
    // Poll every 60s
    refetchInterval: 60_000,
    // Don't use stale cache — always want fresh counts
    staleTime: 0,
    enabled: !!user,
  });

  // Invalidate on route change so counts refresh when user navigates to a section
  useEffect(() => {
    if (location !== prevLocation.current) {
      prevLocation.current = location;
      qc.invalidateQueries({ queryKey: ["nav-flags"] });
    }
  }, [location, qc]);

  return data?.flags ?? {};
}

// ─── SidebarContent ───────────────────────────────────────────────────────────
function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const [location] = useLocation();
  const { user, logout, can, permissions } = useAuth();
  const role = user?.role ?? "client";
  const permissionsLoaded = Object.keys(permissions).length > 0;
  const flags = useNavFlags();

  // Filter nav by role AND permission
  const mainItems = allNavItems.filter(i => {
    if (i.roles && !i.roles.includes(role)) return false;
    if (i.permission && permissionsLoaded && !can(i.permission)) return false;
    return true;
  });
  const showAdminActions = (role === "admin" || role === "supervisor") &&
    (!permissionsLoaded || adminActionItems.some(i => !i.permission || can(i.permission)));

  return (
    <div className="flex flex-col h-full" style={{ background: SIDEBAR_BG }}>
      {/* Logo */}
      <div className="flex items-center px-4 py-4 flex-shrink-0">
        <img src={logoLight} alt="Standing Rock Stewardship Co." style={{ height: "52px", width: "auto" }} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        <p className="text-[10px] uppercase tracking-widest px-3 mb-2" style={{ color: "rgba(245,240,234,0.3)" }}>
          Navigation
        </p>
        {mainItems.map(item => (
          <NavLink
            key={item.href + item.label}
            item={item}
            location={location}
            onClick={onNavClick}
            flags={flags}
          />
        ))}

        {showAdminActions && (
          <>
            <p className="text-[10px] uppercase tracking-widest px-3 mt-4 mb-2" style={{ color: "rgba(245,240,234,0.3)" }}>
              Admin Actions
            </p>
            {adminActionItems
              .filter(i => !i.permission || can(i.permission))
              .map(item => (
                <NavLink key={item.href + item.label} item={item} location={location} onClick={onNavClick} flags={flags} />
              ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-4" style={{ borderTop: `1px solid ${BORDER_CLR}` }}>
        <p className="text-sm font-semibold leading-tight" style={{ color: "#F5F0EA" }}>{user?.name}</p>
        <p className="text-xs capitalize mb-3" style={{ color: SAGE }}>
          {user?.role?.replace(/_/g, " ")}
        </p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs w-full rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
          style={{ color: "rgba(245,240,234,0.6)" }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Drawer */}
      <div
        className="absolute left-0 top-0 bottom-0 w-60 shadow-2xl"
        style={{ background: SIDEBAR_BG, borderRight: `1px solid ${BORDER_CLR}` }}
      >
        <SidebarContent onNavClick={onClose} />
      </div>
    </div>
  );
}

// ─── Notification Bell (header) ─────────────────────────────────────────────
function NotificationBell() {
  const { user } = useAuth();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["notif-unread-count"],
    queryFn: () => apiRequest("GET", "/api/notifications/unread-count").then(r => r.json()),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const count = data?.count ?? 0;
  return (
    <a
      href="#/notifications"
      title={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      style={{
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 8,
        background: "transparent", border: "none", cursor: "pointer",
        color: count > 0 ? TERRACOTTA : "rgba(245,240,234,0.55)",
        textDecoration: "none",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)")}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      <Bell size={17} />
      {count > 0 && (
        <span style={{
          position: "absolute", top: 2, right: 2,
          width: 16, height: 16, borderRadius: "50%",
          background: TERRACOTTA, color: "#fff",
          fontSize: 9, fontWeight: 700, fontFamily: "var(--font-sans)",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
        }}>
          {count > 9 ? "9+" : count}
        </span>
      )}
    </a>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
type AppLayoutProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl+K global search shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Active flare badge count (poll every 30s) — kept for header pulse indicator
  const { user } = useAuth();
  const { data: flareCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/signal-flares/count/open"],
    queryFn: async () => (await apiRequest("GET", "/api/signal-flares/count/open")).json(),
    refetchInterval: 30000,
    enabled: !!user && user.role !== "vendor",
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Desktop Sidebar (always visible lg+) ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 h-full"
        style={{ width: "15rem", background: SIDEBAR_BG, borderRight: `1px solid ${BORDER_CLR}` }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer ── */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0 sticky top-0 z-40"
          style={{ background: "#1a1a1a", borderBottom: `1px solid ${BORDER_CLR}` }}
        >
          {/* Hamburger — only shown on mobile */}
          <button
            data-testid="button-sidebar-toggle"
            className="lg:hidden rounded-lg p-1.5 hover:bg-white/10 transition-colors"
            style={{ color: "rgba(245,240,234,0.6)" }}
            onClick={() => setDrawerOpen(v => !v)}
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1 min-w-0">
            {title && (
              <h1
                className="text-base font-bold truncate"
                style={{ fontFamily: "var(--font-serif)", color: "#F5F0EA" }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs truncate" style={{ color: SAGE }}>{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Active flare badge — shown when there are open flares, for non-vendor roles */}
            {!!flareCountData?.count && flareCountData.count > 0 && user?.role !== "vendor" && (
              <a href={`#/signal-flares`}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold animate-pulse"
                style={{ background: "#3A1010", border: "1px solid #C0392B", color: "#F87171" }}>
                <Flame size={11} style={{ color: "#C0392B" }} />
                {flareCountData.count}
              </a>
            )}

            {/* Global Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              title="Search (Ctrl+K)"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors"
              style={{ color: "rgba(245,240,234,0.55)", fontSize: 12, fontFamily: "var(--font-sans)" }}
            >
              <Search size={15} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline" style={{
                fontSize: 10, padding: "1px 5px",
                background: "rgba(255,255,255,0.08)", borderRadius: 4,
                border: "1px solid rgba(245,240,234,0.15)", color: "rgba(245,240,234,0.4)",
              }}>⌘K</kbd>
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Search modal */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// Re-export AppSidebar as a no-op shim so existing imports don't break
export function AppSidebar() { return null; }
