/**
 * src/pages/LoginPage.tsx
 *
 * Login form — POSTs to /api/v2/auth/login via the auth context.
 * On success, the session cookie is set by the browser automatically.
 * The context stores role + customerId in localStorage and React state.
 * After login, redirects to the page the user was trying to reach (or /dashboard).
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

  // If already authenticated, skip to dashboard
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";
  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
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

        {/* Error */}
        {error && <div className="error-banner">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="on">
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
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading || !username || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
