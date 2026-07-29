/**
 * src/components/AppShell.tsx
 *
 * Authenticated app shell: fixed sidebar + scrollable content pane.
 * All protected routes render inside <Outlet /> in the content pane.
 */

import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export function AppShell() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
