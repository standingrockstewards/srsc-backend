/**
 * src/components/AppShell.tsx
 *
 * Authenticated app shell: fixed sidebar + scrollable content pane.
 * Badge counts are fetched here (once, after auth resolves) and passed
 * to AppSidebar. A failed badge fetch never breaks the nav.
 */

import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useBadges } from "@/hooks/useBadges";

export function AppShell() {
  const badges = useBadges();

  return (
    <div className="app-shell">
      <AppSidebar badges={badges} />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
