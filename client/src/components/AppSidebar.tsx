/**
 * src/components/AppSidebar.tsx  (Brick 10d — a11y pass + mobile support)
 *
 * Changes from 10b/10c:
 *   - <nav> + <ul>/<li> list semantics for screen readers.
 *   - NavLink wrapped in <li>; nav has aria-label="Main navigation".
 *   - Badge has aria-label with count for screen readers.
 *   - Logout button retains aria-label; focus ring improved.
 *   - Accepts id, isMobileOpen, onNavClick props from AppShell.
 *   - On mobile: positioned as a drawer (transform: translateX).
 *   - NavItems call onNavClick to close drawer after navigation.
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { BadgeCounts } from "@/hooks/useBadges";

// ── Icons (unchanged from 10b) ────────────────────────────────────────────────
const Icon = {
  Dashboard: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  Properties: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M2 7L8 2l6 5v7H2V7z" />
      <rect x="6" y="10" width="4" height="4" />
    </svg>
  ),
  Customers: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  ),
  FieldOps: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M8 1v14M1 8h14" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  ),
  Admin: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" />
    </svg>
  ),
  Calendar: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/>
      <path d="M1.5 6.5h13M5 1.5v2M11 1.5v2"/>
      <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none"/>
      <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none"/>
      <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  OpsMap: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5S12.5 9.75 12.5 6C12.5 3.515 10.485 1.5 8 1.5z"/>
      <circle cx="8" cy="6" r="1.5"/>
    </svg>
  ),
  KnowledgeBase: () => (
    <svg className="sidebar-item-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M3 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M5 5h4M5 7.5h4M5 10h2" />
      <path d="M11 2l2 2v9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" />
    </svg>
  ),
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  const label = count > 99 ? "more than 99" : String(count);
  return (
    <span
      className="sidebar-badge"
      aria-label={`${label} item${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onNavClick?: () => void;
}

function NavItem({ to, icon, label, badge = 0, onNavClick }: NavItemProps) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
        onClick={onNavClick}
        aria-current={undefined} /* NavLink sets aria-current="page" automatically */
      >
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
        <Badge count={badge} />
      </NavLink>
    </li>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface AppSidebarProps {
  id?: string;
  badges: BadgeCounts;
  isMobileOpen?: boolean;
  onNavClick?: () => void;
}

export function AppSidebar({
  id,
  badges,
  isMobileOpen = false,
  onNavClick,
}: AppSidebarProps) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const isStaff  = role === "admin" || role === "supervisor";
  const isVendor  = role === "vendor";
  // Ops Map visible to staff + field_tech; hidden from vendor and client
  const isOpsMap  = role === "admin" || role === "supervisor" || role === "field_tech";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "SR";

  return (
    <aside
      id={id}
      className={`app-sidebar${isMobileOpen ? " app-sidebar--open" : ""}`}
      aria-label="Site navigation"
    >
      {/* Logo / branding */}
      <div className="sidebar-logo" aria-hidden="true">
        <div className="sidebar-logo-mark">SR</div>
        <div>
          <div className="sidebar-logo-text">Standing Rock</div>
          <div className="sidebar-logo-sub">Stewardship Co.</div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="sidebar-nav">

        {/* Group: Overview */}
        <div className="sidebar-group">
          <span className="sidebar-group-label" aria-hidden="true">Overview</span>
          <ul role="list">
            <NavItem to="/dashboard" icon={<Icon.Dashboard />} label="Dashboard" onNavClick={onNavClick} />
          </ul>
        </div>

        {/* Group: Properties & People */}
        <div className="sidebar-group">
          <span className="sidebar-group-label" aria-hidden="true">Properties &amp; People</span>
          <ul role="list">
            <NavItem
              to="/properties"
              icon={<Icon.Properties />}
              label="Properties"
              badge={badges.lowBalanceProperties}
              onNavClick={onNavClick}
            />
            <NavItem
              to="/customers"
              icon={<Icon.Customers />}
              label="Customers"
              onNavClick={onNavClick}
            />
          </ul>
        </div>

        {/* Group: Field Operations — visible to admin, supervisor, field_tech */}
        <div className="sidebar-group">
          <span className="sidebar-group-label" aria-hidden="true">Field Operations</span>
          <ul role="list">
            <NavItem
              to="/field-ops"
              icon={<Icon.FieldOps />}
              label="Field Ops"
              badge={badges.openJobs}
              onNavClick={onNavClick}
            />
            {/* Calendar — scheduling; visible to admin/supervisor/field_tech */}
            {isOpsMap && (
              <NavItem
                to="/calendar"
                icon={<Icon.Calendar />}
                label="Calendar"
                onNavClick={onNavClick}
              />
            )}
            {/* Ops Map — confidential; hidden from vendor + client via isOpsMap */}
            {isOpsMap && (
              <NavItem
                to="/ops-map"
                icon={<Icon.OpsMap />}
                label="Ops Map"
                onNavClick={onNavClick}
              />
            )}
          </ul>
        </div>

        {/* Group: Resources — visible to all non-vendor (vendor blocked at route/API) */}
        {!isVendor && (
          <div className="sidebar-group">
            <span className="sidebar-group-label" aria-hidden="true">Resources</span>
            <ul role="list">
              <NavItem
                to="/kb"
                icon={<Icon.KnowledgeBase />}
                label="Knowledge Base"
                onNavClick={onNavClick}
              />
            </ul>
          </div>
        )}

        {/* Group: Admin/Staff */}
        {isStaff && (
          <div className="sidebar-group">
            <span className="sidebar-group-label" aria-hidden="true">Admin / Staff</span>
            <ul role="list">
              <NavItem
                to="/admin"
                icon={<Icon.Admin />}
                label="Admin Panel"
                badge={badges.pendingReferrals}
                onNavClick={onNavClick}
              />
            </ul>
          </div>
        )}

      </nav>

      {/* Footer: user identity + logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.username ?? "—"}</div>
            <div className="sidebar-user-role">{role ?? "—"}</div>
            {/* Brick 10f: quick link to 2FA setup */}
            <a href="/settings/2fa" className="sidebar-2fa-link">2FA Settings</a>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={handleLogout}
            aria-label={`Log out ${user?.username ?? ""}`}
            title="Log out"
          >
            <Icon.Logout />
          </button>
        </div>
      </div>
    </aside>
  );
}
