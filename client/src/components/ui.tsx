/**
 * src/components/ui.tsx  (Brick 10d)
 *
 * Shared micro-components used across widgets and pages.
 * Centralises skeleton + empty-state patterns so all widgets are visually consistent.
 */

import type { ReactNode } from "react";

// ── Skeleton lines ─────────────────────────────────────────────────────────────

interface SkeletonProps {
  /** Number of skeleton rows to render. Default 2. */
  rows?: number;
}

export function Skeleton({ rows = 2 }: SkeletonProps) {
  return (
    <div className="widget-loading" aria-label="Loading…" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="widget-skeleton" />
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  message: string;
  hint?: string;
}

export function EmptyState({ icon = "📭", message, hint }: EmptyStateProps) {
  return (
    <div className="widget-empty" role="status" aria-label={message}>
      <span className="widget-empty-icon" aria-hidden="true">{icon}</span>
      <span>{message}</span>
      {hint && <span className="widget-empty-hint">{hint}</span>}
    </div>
  );
}

// ── Inline error ───────────────────────────────────────────────────────────────

interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps) {
  return (
    <div className="widget-error" role="alert" aria-live="assertive">
      {message}
    </div>
  );
}

// ── Page loading spinner (used by RequireAuth while /me is in flight) ──────────

export function PageSpinner() {
  return (
    <div className="page-spinner" role="status" aria-label="Loading…">
      <div className="page-spinner-ring" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ── Screen-reader only text ───────────────────────────────────────────────────

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
