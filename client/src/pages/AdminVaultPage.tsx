/**
 * client/src/pages/AdminVaultPage.tsx  (Brick 10Z)
 *
 * Admin-only vault secrets list.
 *
 * Features:
 *   - Lists all vault_secrets rows (id, label, customerId) with values masked.
 *   - Per-row "Reveal" button: calls POST /api/admin/vault/:id/reveal.
 *   - On success: shows plaintext for 30 seconds then auto-re-masks.
 *   - On 503: shows toast "Vault temporarily unavailable — contact ops".
 *   - On other errors: shows error toast with opaque message.
 *   - Route is hidden from non-admin roles (enforced both in AppSidebar and RequireRole).
 *
 * The plaintext value is held in component state only during the 30s window.
 * It is never written to localStorage, sessionStorage, or any other durable store.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth }    from "@/context/AuthContext";
import { useToast }   from "@/context/ToastContext";
import { apiFetch }   from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VaultSecretRow {
  id:         string;
  label:      string;
  customerId: string | null;
}

interface RevealedValue {
  secretId:  string;
  value:     string;
  expiresAt: number;   // Date.now() + 30_000
}

interface RevealResponse {
  id:    string;
  label: string;
  value: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MASK_CHARS    = "••••••";
const REVEAL_TTL_MS = 30_000;  // 30 seconds

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminVaultPage() {
  const { role }        = useAuth();
  const { showToast }   = useToast();

  // Guard — this page must only render for admins.
  // RequireRole in App.tsx handles the route redirect, but a belt+suspenders
  // check here prevents a race where role hasn't loaded yet.
  if (role && role !== "admin") {
    return (
      <div className="page-shell">
        <div className="page-error-state">
          Access denied — admin role required.
        </div>
      </div>
    );
  }

  const [secrets,  setSecrets]  = useState<VaultSecretRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // Map of secretId → RevealedValue (only populated during the 30s window)
  const [revealed,  setRevealed]  = useState<Map<string, RevealedValue>>(new Map());

  // Track per-row loading state to disable the button during in-flight requests
  const [revealing, setRevealing] = useState<Set<string>>(new Set());

  // Timer refs so we can clean them up on unmount
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Fetch secret list ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<VaultSecretRow[]>("/api/admin/vault");
        if (!cancelled) {
          setSecrets(rows);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load vault secrets.";
          setFetchErr(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Cleanup timers on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      timers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // ── Reveal handler ─────────────────────────────────────────────────────────
  const handleReveal = useCallback(async (secretId: string) => {
    setRevealing(prev => new Set(prev).add(secretId));

    try {
      const data = await apiFetch<RevealResponse>(
        `/api/admin/vault/${secretId}/reveal`,
        { method: "POST" },
      );

      const expiresAt = Date.now() + REVEAL_TTL_MS;

      setRevealed(prev => {
        const next = new Map(prev);
        next.set(secretId, { secretId, value: data.value, expiresAt });
        return next;
      });

      // Cancel any existing timer for this row (re-reveal resets the clock)
      const existing = timers.current.get(secretId);
      if (existing) clearTimeout(existing);

      const t = setTimeout(() => {
        setRevealed(prev => {
          const next = new Map(prev);
          next.delete(secretId);
          return next;
        });
        timers.current.delete(secretId);
      }, REVEAL_TTL_MS);

      timers.current.set(secretId, t);

    } catch (err: unknown) {
      // 503 → specific "contact ops" message per spec
      if (err instanceof Error && err.message.includes("503")) {
        showToast("error", "Vault temporarily unavailable — contact ops.");
      } else if (err instanceof Error && err.message.includes("503")) {
        showToast("error", "Vault temporarily unavailable — contact ops.");
      } else {
        const msg = err instanceof Error ? err.message : "Reveal failed.";
        // Check status from ApiError
        const status = (err as { status?: number }).status;
        if (status === 503) {
          showToast("error", "Vault temporarily unavailable — contact ops.");
        } else {
          showToast("error", `Reveal failed: ${msg}`);
        }
      }
    } finally {
      setRevealing(prev => {
        const next = new Set(prev);
        next.delete(secretId);
        return next;
      });
    }
  }, [showToast]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Encrypted Vault</h1>
        <p className="page-subtitle">
          Admin-only. Reveal a secret to view its plaintext for 30 seconds — every access is audited.
        </p>
      </div>

      {loading && (
        <div className="vault-state-msg">Loading secrets…</div>
      )}

      {!loading && fetchErr && (
        <div className="vault-state-msg vault-state-err">
          Failed to load vault: {fetchErr}
        </div>
      )}

      {!loading && !fetchErr && secrets.length === 0 && (
        <div className="vault-state-msg">
          No secrets found in the vault.
        </div>
      )}

      {!loading && !fetchErr && secrets.length > 0 && (
        <div className="vault-table-wrap">
          <table className="vault-table" aria-label="Vault secrets">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Label</th>
                <th scope="col">Customer</th>
                <th scope="col">Value</th>
                <th scope="col" style={{ width: "120px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map(s => {
                const rv        = revealed.get(s.id);
                const isVisible = !!rv;
                const inFlight  = revealing.has(s.id);

                // Compute time remaining for the countdown badge
                const secsLeft = isVisible
                  ? Math.max(0, Math.ceil((rv.expiresAt - Date.now()) / 1000))
                  : 0;

                return (
                  <VaultRow
                    key={s.id}
                    secret={s}
                    plaintext={rv?.value ?? null}
                    isVisible={isVisible}
                    secsLeft={secsLeft}
                    inFlight={inFlight}
                    onReveal={() => handleReveal(s.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── VaultRow sub-component ────────────────────────────────────────────────────
// Extracted so it can manage its own 1-second countdown re-render without
// forcing the entire table to re-render every second.

interface VaultRowProps {
  secret:    VaultSecretRow;
  plaintext: string | null;
  isVisible: boolean;
  secsLeft:  number;
  inFlight:  boolean;
  onReveal:  () => void;
}

function VaultRow({ secret, plaintext, isVisible, inFlight, onReveal }: VaultRowProps) {
  // Local countdown state — ticks every second while revealed
  const [secs, setSecs] = useState(REVEAL_TTL_MS / 1000);

  useEffect(() => {
    if (!isVisible) {
      setSecs(REVEAL_TTL_MS / 1000);
      return;
    }
    setSecs(REVEAL_TTL_MS / 1000);
    const interval = setInterval(() => {
      setSecs(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <tr className={`vault-row${isVisible ? " vault-row--revealed" : ""}`}>
      <td className="vault-cell vault-cell-id">
        <code>{secret.id}</code>
      </td>
      <td className="vault-cell">
        {secret.label}
      </td>
      <td className="vault-cell vault-cell-customer">
        {secret.customerId
          ? <code className="vault-cuid">{secret.customerId}</code>
          : <span className="vault-none">—</span>}
      </td>
      <td className="vault-cell vault-cell-value">
        {isVisible ? (
          <span className="vault-plaintext" aria-live="polite">
            {plaintext}
            <span className="vault-countdown" aria-label={`Masks in ${secs} seconds`}>
              {secs}s
            </span>
          </span>
        ) : (
          <span className="vault-mask" aria-label="Masked secret value">
            {MASK_CHARS}
          </span>
        )}
      </td>
      <td className="vault-cell vault-cell-action">
        <button
          className={`vault-reveal-btn${isVisible ? " vault-reveal-btn--active" : ""}`}
          onClick={onReveal}
          disabled={inFlight}
          aria-label={isVisible ? `Re-reveal secret ${secret.label}` : `Reveal secret ${secret.label}`}
        >
          {inFlight ? "…" : isVisible ? "Re-reveal" : "Reveal"}
        </button>
      </td>
    </tr>
  );
}
