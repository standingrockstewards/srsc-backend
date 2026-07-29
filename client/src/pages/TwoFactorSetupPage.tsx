/**
 * src/pages/TwoFactorSetupPage.tsx  (Brick 10f)
 *
 * Two-step enrollment flow:
 *   Step 1 — POST /auth/2fa/setup → show QR + manual-entry secret
 *   Step 2 — POST /auth/2fa/verify → confirm code → show one-time backup codes
 *
 * Accessed from Account / Settings.
 * Role-aware: staff are encouraged; clients see opt-out link.
 */

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Step = "idle" | "loading-setup" | "scan" | "done" | "error";

interface SetupData {
  qrDataUri:    string;
  otpauthUri:   string;
  secretBase32: string;
}

export function TwoFactorSetupPage() {
  const { role } = useAuth();

  const [step,        setStep]        = useState<Step>("idle");
  const [setupData,   setSetupData]   = useState<SetupData | null>(null);
  const [code,        setCode]        = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error,       setError]       = useState<string | null>(null);
  const [optOutDone,  setOptOutDone]  = useState(false);
  const [verifying,   setVerifying]   = useState(false);

  const isStaff = role === "admin" || role === "supervisor" || role === "field_tech";

  // ── Step 1: request setup ────────────────────────────────────────────────────
  async function handleBeginSetup() {
    setStep("loading-setup");
    setError(null);
    try {
      const data = await apiFetch("/auth/2fa/setup", { method: "POST" });
      setSetupData(data as SetupData);
      setStep("scan");
    } catch (err: any) {
      setError(err?.message ?? "Setup failed. Try again.");
      setStep("error");
    }
  }

  // ── Step 2: verify first code ────────────────────────────────────────────────
  async function handleVerify() {
    setVerifying(true);
    setError(null);
    try {
      const data = await apiFetch("/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.replace(/\s/g, "") }),
      }) as { backupCodes: string[] };
      setBackupCodes(data.backupCodes ?? []);
      setStep("done");
    } catch (err: any) {
      setError(err?.message ?? "Invalid code. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  // ── Client opt-out ───────────────────────────────────────────────────────────
  async function handleOptOut() {
    setError(null);
    try {
      await apiFetch("/auth/2fa/opt-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledge: true }),
      });
      setOptOutDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Opt-out failed.");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (optOutDone) {
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title">2FA Opt-Out Recorded</div>
          <p className="tfa-body">
            Your decision to skip two-factor authentication has been noted.
            You can enable it at any time from this page.
          </p>
        </div>
      </div>
    );
  }

  if (step === "done") {
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
              Each code can be used once if you lose access to your authenticator app.
              Store them somewhere safe (password manager, printed copy).
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "scan" && setupData) {
    return (
      <div className="tfa-page">
        <div className="tfa-card">
          <div className="tfa-title">Set Up Two-Factor Authentication</div>

          <div className="tfa-step-label">Step 1 — Scan this QR code</div>
          <div className="tfa-qr-wrapper">
            <img
              src={setupData.qrDataUri}
              alt="TOTP QR code for authenticator app"
              className="tfa-qr"
              width={200}
              height={200}
            />
          </div>

          <div className="tfa-manual-entry">
            <span className="tfa-manual-label">Or enter manually:</span>
            <code className="tfa-manual-secret">{setupData.secretBase32}</code>
          </div>

          <div className="tfa-step-label tfa-step-label--spaced">Step 2 — Enter the 6-digit code</div>

          {error && (
            <div className="tfa-error" role="alert">{error}</div>
          )}

          <input
            className="tfa-code-input"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) handleVerify(); }}
            aria-label="6-digit authenticator code"
            autoComplete="one-time-code"
          />

          <button
            className="tfa-btn tfa-btn--primary"
            onClick={handleVerify}
            disabled={code.length !== 6 || verifying}
            aria-busy={verifying}
          >
            {verifying ? "Verifying…" : "Verify & Enable 2FA"}
          </button>
        </div>
      </div>
    );
  }

  // idle / error / loading-setup
  return (
    <div className="tfa-page">
      <div className="tfa-card">
        <div className="tfa-title">Two-Factor Authentication</div>
        <p className="tfa-body">
          Protect your account with a time-based one-time code from Google Authenticator,
          Authy, or any RFC 6238 compatible app.
        </p>

        {isStaff && (
          <div className="tfa-policy-note" role="note">
            Staff accounts are required to use 2FA to access confidential operations data.
          </div>
        )}

        {error && (
          <div className="tfa-error" role="alert">{error}</div>
        )}

        <button
          className="tfa-btn tfa-btn--primary"
          onClick={handleBeginSetup}
          disabled={step === "loading-setup"}
          aria-busy={step === "loading-setup"}
        >
          {step === "loading-setup" ? "Setting up…" : "Set Up 2FA"}
        </button>

        {!isStaff && (
          <button
            className="tfa-btn tfa-btn--ghost"
            onClick={handleOptOut}
          >
            Skip for now (record opt-out)
          </button>
        )}
      </div>
    </div>
  );
}
