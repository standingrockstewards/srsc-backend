/**
 * src/components/TwoFactorChallenge.tsx  (Brick 10f)
 *
 * Shown on the LoginPage when the server returns { requiresTwoFactor: true }.
 * Prompts for TOTP code or backup code, POSTs to /auth/2fa/validate.
 * On success, calls onSuccess(userData) to complete the login flow.
 */

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface TwoFactorChallengeProps {
  onSuccess: (data: Record<string, unknown>) => void;
  onCancel:  () => void;
}

export function TwoFactorChallenge({ onSuccess, onCancel }: TwoFactorChallengeProps) {
  const [code,       setCode]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [useBackup,  setUseBackup]  = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/auth/2fa/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      onSuccess(data as Record<string, unknown>);
    } catch (err: any) {
      setError(err?.message ?? "Invalid code. Try again.");
      setLoading(false);
    }
  }

  const inputPlaceholder = useBackup ? "XXXXX-XXXXX" : "000000";
  const inputPattern     = useBackup ? undefined : "\\d{6}";
  const inputMode        = useBackup ? undefined : "numeric" as const;
  const maxLen           = useBackup ? 11 : 6;

  function handleCodeChange(v: string) {
    if (useBackup) {
      // Backup: XXXXX-XXXXX — allow hex chars + dash
      setCode(v.toUpperCase().replace(/[^A-F0-9-]/g, "").slice(0, 11));
    } else {
      setCode(v.replace(/\D/g, "").slice(0, 6));
    }
  }

  const isValid = useBackup ? code.replace(/-/g, "").length === 10 : code.length === 6;

  return (
    <div className="tfa-challenge">
      <div className="tfa-challenge-title">
        Two-Factor Authentication Required
      </div>
      <p className="tfa-challenge-body">
        {useBackup
          ? "Enter one of your backup codes (format: XXXXX-XXXXX)."
          : "Open your authenticator app and enter the 6-digit code."}
      </p>

      {error && (
        <div className="tfa-error" role="alert">{error}</div>
      )}

      <input
        className="tfa-code-input"
        type="text"
        inputMode={inputMode}
        pattern={inputPattern}
        maxLength={maxLen}
        placeholder={inputPlaceholder}
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleSubmit(); }}
        aria-label={useBackup ? "Backup code" : "6-digit authenticator code"}
        autoComplete="one-time-code"
        autoFocus
      />

      <button
        className="tfa-btn tfa-btn--primary"
        onClick={handleSubmit}
        disabled={!isValid || loading}
        aria-busy={loading}
      >
        {loading ? "Verifying…" : "Verify"}
      </button>

      <div className="tfa-challenge-footer">
        <button
          className="tfa-link-btn"
          onClick={() => { setUseBackup(!useBackup); setCode(""); setError(null); }}
        >
          {useBackup ? "Use authenticator app instead" : "Use a backup code"}
        </button>
        <button className="tfa-link-btn" onClick={onCancel}>
          Cancel — return to login
        </button>
      </div>
    </div>
  );
}
