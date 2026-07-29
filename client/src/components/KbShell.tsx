/**
 * client/src/components/KbShell.tsx  (Brick 10k)
 *
 * Minimal public-facing layout wrapper for KB pages.
 * No AppSidebar — these pages are reachable without login.
 * Matches the dark theme CSS variables from index.css.
 */

import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

interface KbShellProps {
  children: ReactNode;
}

export function KbShell({ children }: KbShellProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-content, #161b27)",
        color: "var(--text-primary, #e8edf5)",
        fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          backgroundColor: "var(--bg-sidebar, #0f1117)",
          borderBottom: "1px solid var(--border, #242c3e)",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Branding */}
        <Link
          to="/kb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: "var(--accent, #2b9e8e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            SR
          </span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Standing Rock</span>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted, #525d6e)",
              marginLeft: 2,
            }}
          >
            Knowledge Base
          </span>
        </Link>

        {/* Login link */}
        <button
          onClick={() => navigate("/login")}
          style={{
            background: "none",
            border: "1px solid var(--border, #242c3e)",
            borderRadius: 6,
            color: "var(--text-secondary, #8b96a8)",
            fontSize: 13,
            padding: "5px 14px",
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
      </header>

      {/* Page content */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
        {children}
      </main>
    </div>
  );
}
