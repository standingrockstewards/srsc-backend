/**
 * src/components/AppShell.tsx
 *
 * Authenticated app shell: fixed sidebar + scrollable content pane.
 * Badge counts are fetched here (once, after auth resolves) and:
 *   1. Passed to AppSidebar for nav badge rendering.
 *   2. Passed to child routes via React Router Outlet context so DashboardPage
 *      can reuse them without a second useBadges call.
 *
 * A failed badge fetch never breaks the nav or the dashboard.
 */

import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useBadges, type BadgeCounts } from "@/hooks/useBadges";

export function AppShell() {
  const badges = useBadges();

  return (
    <div className="app-shell">
      <AppSidebar badges={badges} />
      <main className="app-content">
        {/* Pass badges to all child routes via Outlet context */}
        <Outlet context={{ badges } satisfies { badges: BadgeCounts }} />
      </main>
    </div>
  );
}
