/**
 * src/pages/AccountSecurityPage.tsx  (Brick 10Y)
 *
 * Route: /account/security  — RequireAuth (any logged-in role manages THEIR OWN 2FA)
 *
 * Shows current 2FA status and provides:
 *   Enable: POST /auth/2fa/setup → QR + manual key → POST /auth/2fa/verify
 *   Disable: confirmation gate → password + code → POST /auth/2fa/disable
 *
 * SECURITY CONTRACT:
 *   - secretBase32 / qrDataUri are held ONLY in local React state during enrollment.
 *   - They are NEVER written to localStorage, sessionStorage, the DOM data-*
 *     attribute, or any logging call.
 *   - After /verify succeeds the secret state is immediately nulled.
 *   - Backup codes are displayed once and then cleared from state on navigation.
 *   - Staff roles (admin/supervisor/field_tech) cannot disable 2FA; the disable
 *     button is hidden and the server returns 403 as a hard backstop.
 *
 * Status source:
 *   GET /api/v2/auth/me returns safeUser which includes totpEnabled (boolean)
 *   after stripping totpSecret + totpBackupCodes. We call /me on mount to get
 *   current status and after any mutating operation to stay in sync.
 *
 * No dedicated GET /auth/2fa/status endpoint exists (Brick 10f did not add one).
 * We use /me which is already authenticated and always available.
 */

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeResponse {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    active: boolean;
    totpEnabled: boolean;
    totpOptOutAck: boolean;
  };
  role: string;
}

interface SetupData {
  qrDataUri:    string;
  otpauthUri:   string;
  secretBase32: string;
}

// Roles that cannot disable 2FA per backend policy
const STAFF_ROLES = new Set(["admin", "supervisor", "field_tech"]);

// ── Main component ────────────────────────────────────────────────────────────

type PagePhase =
  | "loading"          // fetching /me
  | "status"           // showing current 2FA on/off status
  | "enabling-setup"   // POST /setup in flight
  | "enabling-scan"    // showing QR + waiting for code
  | "enabling-verify"  // POST /verify in flight
  | "backup-codes"     // showing one-time backup codes
  | "disabling-form"   // disable form (password + code)
  | "disabling-submit" // POST /disable in flight
  | "error";           // non-recoverable error fetching /me

export function AccountSecurityPage() {
  const { role } = useAuth();

  const [phase,       setPhase]       = useState<PagePhase>("loading");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [username,    setUsername]    = useState("");
  const [statusErr,   setStatusErr]   = useState<string | null>(null);

  // Enable flow
  // NOTE: setupData (secretBase32, qrDataUri) is held ONLY here — never persisted
  const [setupData,   setSetupData]   = useState<SetupData | null>(null);
  const [verifyCode,  setVerifyCode]  = useState("");
  const [enableErr,   setEnableErr]   = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable flow
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode,     setDisableCode]     = useState("");
  const [disableErr,      setDisableErr]      = useState<string | null>(null);
  const [disableConfirm,  setDisableConfirm]  = useState(false);

  const isStaff = STAFF_ROLES.has(role ?? "");

  // ── Fetch 2FA status from /me ───────────────────────────────────────────────

  async function loadStatus() {
    setPhase("loading");
    setStatusErr(null);
    try {
      const data = await apiFetch("/auth/me") as MeResponse;
      setTotpEnabled(Boolean(data.user.totpEnabled));
      setUsername(data.user.username ?? "");
      setPhase("status");
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message
                : err instanceof Error   ? err.message
                : "Failed to load account status.";
      setStatusErr(msg);
      setPhase("error");
    }
  }

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Enable: step 1 — POST /setup ───────────────────────────────────────────

  async function handleBeginSetup() {
    setPhase("enabling-setup");
    setEnableErr(null);
    try {
      const data = await apiFetch("/auth/2fa/setup", { method: "POST" }) as SetupData;
      // secretBase32 / qrDataUri stored ONLY in React state — never logged
      setSetupData(data);
      setVerifyCode("");
      setPhase("enabling-scan");
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message
                : err instanceof Error   ? err.message
                : "Setup failed. Try again.";
      setEnableErr(msg);
      setPhase("status");
    }
  }

  // ── Enable: step 2 — POST /verify ──────────────────────────────────────────

  async function handleVerify() {
    if (verifyCode.length !== 6) return;
    setPhase("enabling-verify");
    setEnableErr(null);
    try {
      const data = await apiFetch("/auth/2fa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: verifyCode.replace(/\s/g, "") }),
      }) as { backupCodes: string[] };

      // Secret is no longer needed — clear it from state immediately
      setSetupData(null);
      setVerifyCode("");

      setBackupCodes(data.backupCodes ?? []);
      setTotpEnabled(true);
      setPhase("backup-codes");
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message
                : err instanceof Error   ? err.message
                : "Invalid code. Try again.";
      setEnableErr(msg);
      setPhase("enabling-scan");
    }
  }

  // ── Disable: POST /disable ──────────────────────────────────────────────────

  async function handleDisable() {
    if (!disablePassword || disableCode.length !== 6) return;
    setPhase("disabling-submit");
    setDisableErr(null);
    try {
      await apiFetch("/auth/2fa/disable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          password: disablePassword,
          code:     disableCode.replace(/\s/g, ""),
        }),
      });
      // Reset disable form state
      setDisablePassword("");
      setDisableCode("");
      setDisableConfirm(false);
      // Re-fetch status from server — never optimistic
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message
                : err instanceof Error   ? err.message
                : "Disable failed. Try again.";
      setDisableErr(msg);
      setPhase("disabling-form");
    }
  }

  function cancelDisable() {
    setDisablePassword("");
    setDisableCode("");
    setDisableConfirm(false);
    setDisableErr(null);
    setPhase("status");
  }

  // ── Render: loading ─────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title">Account Security</div>
          <p className="tfa-body" role="status" aria-busy="true">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Render: /me fetch error ─────────────────────────────────────────────────

  if (phase === "error") {
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title">Account Security</div>
          <div className="tfa-error" role="alert">{statusErr ?? "An error occurred."}</div>
          <button className="tfa-btn tfa-btn--ghost" onClick={() => void loadStatus()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render: backup codes (one-time display after enable) ────────────────────

  if (phase === "backup-codes") {
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title tfa-title--success">2FA Enabled</div>
          <p className="tfa-body">
            Two-factor authentication is now active on your account.
          </p>
          <div className="tfa-backup-section">
            <div className="tfa-backup-header">
              Save these backup codes — they will <strong>not</strong> be shown again.
            </div>
            <div className="tfa-backup-grid">
              {backupCodes.map((c) => (
                <code key={c} className="tfa-backup-code">{c}</code>
              ))}
            </div>
            <div className="tfa-backup-note">
              Each code can be used once if you lose your authenticator app.
              Store them in a password manager or a printed copy in a safe place.
            </div>
          </div>
          <button
            className="tfa-btn tfa-btn--primary"
            style={{ marginTop: 20 }}
            onClick={() => {
              // Clear backup codes from state before navigating away
              setBackupCodes([]);
              setPhase("status");
            }}
          >
            Done — I've saved my backup codes
          </button>
        </div>
      </div>
    );
  }

  // ── Render: enable scan step (QR + code entry) ──────────────────────────────

  if ((phase === "enabling-scan" || phase === "enabling-verify") && setupData) {
    const verifying = phase === "enabling-verify";
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title">Set Up Two-Factor Authentication</div>

          <div className="tfa-step-label">Step 1 — Scan this QR code</div>
          <p className="tfa-body" style={{ marginBottom: 0 }}>
            Open Google Authenticator, Authy, or any RFC 6238 app and scan the code below.
          </p>
          <div className="tfa-qr-wrapper">
            {/* qrDataUri is a data: URI PNG — held in state only, never logged */}
            <img
              src={setupData.qrDataUri}
              alt="TOTP QR code — scan with your authenticator app"
              className="tfa-qr"
              width={200}
              height={200}
            />
          </div>

          <div className="tfa-manual-entry">
            <span className="tfa-manual-label">Or enter this key manually:</span>
            {/* secretBase32 shown only here, held in state, never logged */}
            <code className="tfa-manual-secret">{setupData.secretBase32}</code>
          </div>

          <div className="tfa-step-label tfa-step-label--spaced">
            Step 2 — Enter the 6-digit code from your app
          </div>

          {enableErr && (
            <div className="tfa-error" role="alert">{enableErr}</div>
          )}

          <input
            className="tfa-code-input"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && verifyCode.length === 6 && !verifying) {
                void handleVerify();
              }
            }}
            aria-label="6-digit authenticator code"
            autoComplete="one-time-code"
            disabled={verifying}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="tfa-btn tfa-btn--ghost"
              onClick={() => {
                // Cancel: clear secret from state immediately
                setSetupData(null);
                setVerifyCode("");
                setEnableErr(null);
                setPhase("status");
              }}
              disabled={verifying}
            >
              Cancel
            </button>
            <button
              className="tfa-btn tfa-btn--primary"
              onClick={() => void handleVerify()}
              disabled={verifyCode.length !== 6 || verifying}
              aria-busy={verifying}
            >
              {verifying ? "Verifying…" : "Verify & Enable 2FA"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: disable form ────────────────────────────────────────────────────

  if (phase === "disabling-form" || phase === "disabling-submit") {
    const submitting = phase === "disabling-submit";
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title">Disable Two-Factor Authentication</div>

          {!disableConfirm ? (
            /* Confirmation gate */
            <>
              <p className="tfa-body">
                Disabling 2FA removes an important layer of security from your account.
                Are you sure you want to proceed?
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="tfa-btn tfa-btn--ghost" onClick={cancelDisable}>
                  Cancel
                </button>
                <button
                  className="tfa-btn tfa-btn--primary"
                  style={{ background: "var(--status-err, #ef4444)" }}
                  onClick={() => setDisableConfirm(true)}
                >
                  Yes, disable 2FA
                </button>
              </div>
            </>
          ) : (
            /* Re-auth form: password + TOTP code */
            <>
              <p className="tfa-body">
                Enter your current password and the 6-digit code from your authenticator app
                to confirm.
              </p>

              {disableErr && (
                <div className="tfa-error" role="alert">{disableErr}</div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="disable-password">
                  Current password
                </label>
                <input
                  id="disable-password"
                  className="tfa-code-input"
                  style={{ textAlign: "left", letterSpacing: "normal", fontSize: 14 }}
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={submitting}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="disable-code">
                  Authenticator code (6 digits)
                </label>
                <input
                  id="disable-code"
                  className="tfa-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      disablePassword &&
                      disableCode.length === 6 &&
                      !submitting
                    ) {
                      void handleDisable();
                    }
                  }}
                  aria-label="6-digit authenticator code"
                  autoComplete="one-time-code"
                  disabled={submitting}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  className="tfa-btn tfa-btn--ghost"
                  onClick={cancelDisable}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="tfa-btn tfa-btn--primary"
                  style={{ background: "var(--status-err, #ef4444)" }}
                  onClick={() => void handleDisable()}
                  disabled={!disablePassword || disableCode.length !== 6 || submitting}
                  aria-busy={submitting}
                >
                  {submitting ? "Disabling…" : "Confirm Disable"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Render: status view (main state) ────────────────────────────────────────

  const setupInFlight = phase === "enabling-setup";

  return (
    <div className="tfa-page">
      <div className="tfa-card">
        <div className="tfa-title">Account Security</div>

        {/* 2FA Status indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          borderRadius: 8,
          marginBottom: 20,
          background: totpEnabled
            ? "rgba(34, 197, 94, 0.08)"
            : "rgba(239, 68, 68, 0.07)",
          border: `1px solid ${totpEnabled ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        }}>
          <span style={{ fontSize: 22 }} aria-hidden="true">
            {totpEnabled ? "🔒" : "🔓"}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              Two-Factor Authentication is{" "}
              <span style={{ color: totpEnabled ? "var(--status-ok, #22c55e)" : "var(--status-err, #ef4444)" }}>
                {totpEnabled ? "enabled" : "disabled"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)", marginTop: 2 }}>
              {totpEnabled
                ? "Your account is protected with a time-based one-time code."
                : "Add an extra layer of security with an authenticator app."}
            </div>
          </div>
        </div>

        {/* Staff policy note */}
        {isStaff && (
          <div className="tfa-policy-note" role="note">
            Staff accounts (admin, supervisor, field_tech) are required to use 2FA.
            You cannot disable it.
          </div>
        )}

        {/* Account info row */}
        <div style={{ fontSize: 13, color: "var(--text-muted, #6b7280)", marginBottom: 20 }}>
          Signed in as <strong style={{ color: "inherit" }}>{username}</strong>
          {role && <> · Role: <strong style={{ color: "inherit" }}>{role}</strong></>}
        </div>

        {enableErr && (
          <div className="tfa-error" role="alert">{enableErr}</div>
        )}

        {/* Enable button (shown when 2FA is off) */}
        {!totpEnabled && (
          <button
            className="tfa-btn tfa-btn--primary"
            onClick={() => void handleBeginSetup()}
            disabled={setupInFlight}
            aria-busy={setupInFlight}
          >
            {setupInFlight ? "Setting up…" : "Enable Two-Factor Authentication"}
          </button>
        )}

        {/* Disable button (shown when 2FA is on AND not a staff role) */}
        {totpEnabled && !isStaff && (
          <button
            className="tfa-btn tfa-btn--ghost"
            style={{
              border: "1px solid var(--status-err, #ef4444)",
              color: "var(--status-err, #ef4444)",
            }}
            onClick={() => {
              setDisableErr(null);
              setDisableConfirm(false);
              setPhase("disabling-form");
            }}
          >
            Disable Two-Factor Authentication
          </button>
        )}

        {/* Staff with 2FA on: no disable button, informational note already shown */}
      </div>
    </div>
  );
}
