/**
 * src/components/AppShell.tsx  (Brick 10d — responsive hamburger + a11y)
 *
 * Desktop (≥ 768px): fixed 250px sidebar + scrollable content pane.
 * Mobile (< 768px):  top bar with hamburger button; sidebar slides in as an
 *                    overlay drawer; tap outside or press Escape to close.
 *
 * Sidebar overlay traps no focus (simple overlay, not a modal dialog) — the
 * nav items and close button are keyboard reachable in natural DOM order.
 *
 * Passes BadgeCounts to AppSidebar (nav badges) and to child routes via
 * Outlet context (DashboardPage StatCards reuse without double-fetch).
 */

import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useBadges, type BadgeCounts } from "@/hooks/useBadges";

const MOBILE_BP = 768; // px — must match CSS @media breakpoint

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BP);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function AppShell() {
  const badges   = useBadges();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change or desktop resize
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // Escape key closes drawer
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
  }, [drawerOpen]);
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-shell">
      {/* Mobile top bar — only visible on narrow viewports */}
      {isMobile && (
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
          >
            <span className="hamburger-icon" aria-hidden="true">
              {drawerOpen ? "✕" : "☰"}
            </span>
          </button>
          <span className="mobile-topbar-title">Standing Rock Stewardship</span>
        </div>
      )}

      {/* Overlay scrim for mobile drawer */}
      {isMobile && drawerOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — always in DOM; CSS controls visibility/position */}
      <AppSidebar
        id="app-sidebar"
        badges={badges}
        isMobileOpen={drawerOpen}
        onNavClick={() => setDrawerOpen(false)}
      />

      {/* Scrollable content pane */}
      <main
        className="app-content"
        id="main-content"
        tabIndex={-1}
        aria-label="Main content"
      >
        <Outlet context={{ badges } satisfies { badges: BadgeCounts }} />
      </main>
    </div>
  );
}
