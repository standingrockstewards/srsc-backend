/**
 * src/context/ToastContext.tsx  (Brick 10d)
 *
 * Non-blocking toast/banner context for network and server errors.
 * Toasts auto-dismiss after 5 seconds. Max 3 visible at once.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast("network", "You appear to be offline.");
 *   showToast("error",   "Server error (500). Try again.");
 *   showToast("info",    "Session expired. Please sign in again.");
 *
 * Toasts are announced via aria-live="polite" — screen readers read them
 * without stealing keyboard focus.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "error" | "network" | "info" | "warn";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((kind: ToastKind, message: string) => {
    const id = `toast-${++_seq}`;
    setToasts((prev) => {
      // Deduplicate by message (don't stack identical toasts)
      if (prev.some((t) => t.message === message)) return prev;
      // Cap at 3
      const next = [...prev.slice(-2), { id, kind, message }];
      return next;
    });
    // Auto-dismiss after 5 s
    setTimeout(() => dismissToast(id), 5_000);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Toast container ───────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      aria-live="polite"
      aria-atomic="false"
      role="status"
    >
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role="alert">
          <span className="toast-message">{t.message}</span>
          <button
            className="toast-dismiss"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
