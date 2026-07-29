/**
 * src/pages/LoginPage.tsx  (Brick 10f — TOTP challenge gate)
 *
 * Login form — POSTs to /api/v2/auth/login directly (bypassing AuthContext.login)
 * so we can inspect the raw response for { requiresTwoFactor: true }.
 *
 * Flow:
 *   Normal login   → server returns LoginResponse → sync AuthContext via /auth/me
 *   2FA required   → server returns { requiresTwoFactor: true } (HTTP 200)
 *                 → show TwoFactorChallenge
 *   TOTP verified  → POST /auth/2fa/validate succeeds → sync AuthContext via /auth/me
 *                 → navigate to redirectTo
 *
 * No token in localStorage. Session cookie is httpOnly — never touched in JS.
 */

import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
import { TwoFactorChallenge } from "@/components/TwoFactorChallenge";

export function LoginPage() {
  const { isAuthenticated, refreshMe } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username,    setUsername]    = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [totpPending, setTotpPending] = useState(false);

  const stateFrom   = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const queryReturn = new URLSearchParams(location.search).get("returnTo");
  const redirectTo  = stateFrom ?? queryReturn ?? "/dashboard";

  if (isAuthenticated) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  const isSessionExpired = !!queryReturn && !stateFrom;

  // ── Primary login ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch("/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: username.trim(), password }),
      }) as Record<string, unknown>;

      if (result.requiresTwoFactor === true) {
        // Partial session — password OK, TOTP required
        setTotpPending(true);
        setLoading(false);
        return;
      }

      // Full session — sync AuthContext state by re-fetching /auth/me
      await refreshMe();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "Invalid username or password."
            : err.status === 403
            ? "Your account is deactivated. Contact an administrator."
            : `Login failed: ${err.message}`,
        );
      } else {
        setError("Unable to reach the server. Check your network.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── TOTP challenge success ────────────────────────────────────────────────────
  const handleTotpSuccess = async () => {
    // /validate promoted the session — sync AuthContext
    await refreshMe();
    navigate(redirectTo, { replace: true });
  };

  // ── TOTP cancel ──────────────────────────────────────────────────────────────
  const handleTotpCancel = () => {
    setTotpPending(false);
    setUsername("");
    setPassword("");
  };

  // ── Render: TOTP challenge ────────────────────────────────────────────────────
  if (totpPending) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-mark">SR</div>
            <div>
              <div className="login-logo-text">Standing Rock</div>
              <div className="login-logo-sub">Stewardship Co.</div>
            </div>
          </div>
          <TwoFactorChallenge
            onSuccess={handleTotpSuccess}
            onCancel={handleTotpCancel}
          />
        </div>
      </div>
    );
  }

  // ── Render: login form ────────────────────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-logo">
          <div className="login-logo-mark">SR</div>
          <div>
            <div className="login-logo-text">Standing Rock</div>
            <div className="login-logo-sub">Stewardship Co.</div>
          </div>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Operations portal — authorized access only.</p>

        {isSessionExpired && !error && (
          <div className="info-banner" role="status">
            Your session expired. Please sign in again.
          </div>
        )}

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="on" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="form-input"
              type="text"
              autoComplete="username"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
              aria-required="true"
              aria-describedby={error ? "login-error" : undefined}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              aria-required="true"
            />
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading || !username || !password}
            aria-busy={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
