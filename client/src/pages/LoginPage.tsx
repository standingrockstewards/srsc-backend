/**
 * src/pages/LoginPage.tsx  (Brick 10d — returnTo param for session-expiry redirect)
 *
 * Login form — POSTs to /api/v2/auth/login via the auth context.
 * On success, redirects to the intended destination:
 *   1. location.state.from  — RequireAuth guard sets this on initial auth check
 *   2. ?returnTo=<path>     — global 401 handler sets this on session expiry
 *   3. /dashboard           — default
 *
 * No token in localStorage. The session cookie is httpOnly — never touched in JS.
 */

import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  // Resolve redirect destination:
  //   state.from  → set by RequireAuth on unauthenticated access
  //   ?returnTo=  → set by 401 handler on session expiry (Brick 10d)
  //   /dashboard  → default
  const stateFrom  = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const queryReturn = new URLSearchParams(location.search).get("returnTo");
  const redirectTo = stateFrom ?? queryReturn ?? "/dashboard";

  // If already authenticated, skip login page
  if (isAuthenticated) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  // Show session-expired notice when landing here from a 401 redirect
  const isSessionExpired = !!queryReturn && !stateFrom;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
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

        {/* Session-expired notice */}
        {isSessionExpired && !error && (
          <div className="info-banner" role="status">
            Your session expired. Please sign in again.
          </div>
        )}

        {/* Error */}
        {error && <div className="error-banner" role="alert">{error}</div>}

        {/* Form */}
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
