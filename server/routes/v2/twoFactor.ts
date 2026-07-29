/**
 * server/routes/v2/twoFactor.ts  (Brick 10f)
 *
 * TOTP 2FA endpoints mounted under /api/v2/auth/2fa/
 *
 * All routes require a valid v2 session (requireAuthV2 applied in auth router).
 *
 * Endpoints:
 *   POST /setup    — generate TOTP secret + QR. Fails closed if TOTP_ENCRYPTION_KEY unset.
 *   POST /verify   — confirm first code, enable 2FA, return one-time backup codes.
 *   POST /validate — submit code during login gate (partial session → full session).
 *   POST /disable  — re-auth + TOTP confirm required. Staff roles cannot opt out.
 *   POST /opt-out  — client only: record acknowledgment (totpOptOutAck=true).
 *
 * Rate-limiting:
 *   Code-submission endpoints (/verify, /validate, /disable) are rate-limited
 *   to 5 attempts per 15-minute window per userId. In-memory Map (sufficient for
 *   this prototype scale; swap for Redis when scaling horizontally).
 *
 * Security:
 *   - TOTP_ENCRYPTION_KEY must be set — setup/verify fail closed if absent.
 *   - Secrets never logged. Codes never logged. Backup plaintext returned only once.
 *   - Constant-time backup code compare (bcrypt in consumeBackupCode).
 *   - Partial-session flag v2TotpPending prevents full resource access until verified.
 */

import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import {
  generateTotpSetup,
  verifyTotpCode,
  generateBackupCodes,
  consumeBackupCode,
} from "../../services/totpService";

// ── Session type augmentation ────────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    v2TotpPending?: boolean;  // true = password OK but TOTP not yet verified
  }
}

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Keyed by userId (number). Resets after WINDOW_MS.
// 5 attempts per 15 minutes — enough for genuine typos, not enough for brute force.

interface RateLimitEntry {
  count:     number;
  resetAt:   number;
}
const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 min in ms
const rateLimitMap      = new Map<number, RateLimitEntry>();

function checkRateLimit(userId: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function clearRateLimit(userId: number) {
  rateLimitMap.delete(userId);
}

// ── Staff roles that cannot opt out ──────────────────────────────────────────
const STAFF_ROLES = new Set(["admin", "supervisor", "field_tech"]);

// ── Router ────────────────────────────────────────────────────────────────────

const router = Router();

// ── POST /api/v2/auth/2fa/setup ───────────────────────────────────────────────
// Requires: active session (requireAuthV2 already applied upstream).
// Returns: qrDataUri, otpauthUri, secretBase32 (manual entry), encryptedSecret (for server storage).
// Does NOT enable 2FA — caller must POST /verify to confirm and enable.
// Fails closed: throws 500 if TOTP_ENCRYPTION_KEY is unset.
router.post("/setup", async (req: Request, res: Response) => {
  const userId = req.v2UserId;
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  const user = storage.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (user.totpEnabled) {
    return res.status(409).json({ error: "2FA is already enabled. Disable it first." });
  }

  try {
    const payload = await generateTotpSetup(user.username);

    // Persist the encrypted secret (not yet enabled — that requires /verify)
    storage.updateUser(userId, { totpSecret: payload.encryptedSecret } as any);

    // Return QR + manual-entry secret to the frontend. Never log these.
    return res.json({
      qrDataUri:   payload.qrDataUri,
      otpauthUri:  payload.otpauthUri,
      secretBase32: payload.secretBase32,
      message: "Scan the QR code or enter the secret manually, then POST /auth/2fa/verify with a valid code.",
    });
  } catch (err: any) {
    // Fail closed — TOTP_ENCRYPTION_KEY unset or key format error
    if (err.message?.includes("TOTP_ENCRYPTION_KEY")) {
      console.error("[2fa/setup] Encryption key not configured.");
      return res.status(503).json({
        error: "2FA setup is not available — server configuration incomplete.",
      });
    }
    return res.status(500).json({ error: "Setup failed" });
  }
});

// ── POST /api/v2/auth/2fa/verify ──────────────────────────────────────────────
// Confirm first TOTP code → enable 2FA → return one-time backup codes.
// Rate-limited: 5 attempts / 15 min.
router.post("/verify", async (req: Request, res: Response) => {
  const userId = req.v2UserId;
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  const rl = checkRateLimit(userId);
  if (!rl.allowed) {
    return res.status(429).json({
      error: "Too many attempts. Try again later.",
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    return res.status(400).json({ error: "code must be a 6-digit string" });
  }

  const user = storage.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (!user.totpSecret) {
    return res.status(409).json({ error: "No pending TOTP setup. Call /auth/2fa/setup first." });
  }
  if (user.totpEnabled) {
    return res.status(409).json({ error: "2FA is already enabled." });
  }

  const normalised = code.replace(/\s/g, "");
  let valid: boolean;
  try {
    valid = verifyTotpCode(normalised, user.totpSecret);
  } catch {
    return res.status(503).json({ error: "2FA verification unavailable — server configuration incomplete." });
  }

  if (!valid) {
    return res.status(401).json({ error: "Invalid code. Check your authenticator app and try again." });
  }

  // Code verified — generate backup codes and enable
  const bundle = await generateBackupCodes();
  storage.updateUser(userId, {
    totpEnabled:     true,
    totpBackupCodes: bundle.hashed,
  } as any);

  clearRateLimit(userId);

  // If this was called during the login gate (partial session), promote to full
  if (req.session.v2TotpPending) {
    req.session.v2TotpPending = false;
  }

  // Return backup codes plaintext — shown ONCE, never stored in plaintext
  return res.json({
    ok: true,
    message: "2FA enabled. Save these backup codes — they will not be shown again.",
    backupCodes: bundle.plaintext,  // 8 codes, plaintext, one-time display
  });
});

// ── POST /api/v2/auth/2fa/validate ────────────────────────────────────────────
// Login gate: called after password auth when session has v2TotpPending = true.
// Accepts TOTP code OR backup code.
// Rate-limited: 5 attempts / 15 min.
router.post("/validate", async (req: Request, res: Response) => {
  // This endpoint is used during the login gate — session may have v2TotpPending
  // but v2UserId is already set (password was verified).
  const userId = req.v2UserId;
  if (!userId) return res.status(401).json({ error: "Unauthenticated" });

  if (!req.session.v2TotpPending) {
    // Already fully authenticated or 2FA not required
    return res.status(409).json({ error: "No pending 2FA challenge for this session." });
  }

  const rl = checkRateLimit(userId);
  if (!rl.allowed) {
    return res.status(429).json({
      error: "Too many attempts. Try again later.",
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code is required" });
  }

  const user = storage.getUserById(userId);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return res.status(409).json({ error: "2FA is not enabled on this account." });
  }

  const normalised = code.replace(/\s/g, "");

  // Try TOTP first
  let valid = false;
  try {
    valid = verifyTotpCode(normalised, user.totpSecret);
  } catch {
    return res.status(503).json({ error: "2FA unavailable — server configuration incomplete." });
  }

  if (!valid && user.totpBackupCodes) {
    // Try backup code (constant-time)
    const result = await consumeBackupCode(normalised, user.totpBackupCodes);
    if (result.matched) {
      // Consume it — persist remaining codes
      storage.updateUser(userId, { totpBackupCodes: result.remainingHashed } as any);
      valid = true;
    }
  }

  if (!valid) {
    return res.status(401).json({ error: "Invalid code." });
  }

  // Promote session from partial to full
  req.session.v2TotpPending = false;
  clearRateLimit(userId);

  const { password: _pw, totpSecret: _ts, totpBackupCodes: _bc, ...safeUser } = user as any;
  return res.json({ ok: true, user: safeUser });
});

// ── POST /api/v2/auth/2fa/disable ─────────────────────────────────────────────
// Requires: re-auth (current password) + valid TOTP code.
// Staff roles (admin/supervisor/field_tech) cannot disable 2FA (confidential-data policy).
// Rate-limited: 5 attempts / 15 min.
router.post("/disable", async (req: Request, res: Response) => {
  const userId = req.v2UserId;
  const role   = req.v2Role;
  if (!userId || !role) return res.status(401).json({ error: "Unauthenticated" });

  // Staff opt-out blocked
  if (STAFF_ROLES.has(role)) {
    return res.status(403).json({
      error: "Staff accounts (admin, supervisor, field_tech) cannot disable 2FA. Contact your administrator.",
    });
  }

  const rl = checkRateLimit(userId);
  if (!rl.allowed) {
    return res.status(429).json({
      error: "Too many attempts. Try again later.",
      retryAfterMs: rl.retryAfterMs,
    });
  }

  const { password, code } = req.body as { password?: string; code?: string };
  if (!password || !code) {
    return res.status(400).json({ error: "password and code are required" });
  }

  const user = storage.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (!user.totpEnabled) {
    return res.status(409).json({ error: "2FA is not enabled." });
  }

  // Re-auth: verify current password
  const isHashed = user.password?.startsWith("$2");
  const passwordValid = isHashed
    ? bcrypt.compareSync(password, user.password)
    : user.password === password;

  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid password." });
  }

  // Verify TOTP code
  const normalised = code.replace(/\s/g, "");
  let valid = false;
  try {
    valid = verifyTotpCode(normalised, user.totpSecret!);
  } catch {
    return res.status(503).json({ error: "2FA unavailable — server configuration incomplete." });
  }

  if (!valid) {
    return res.status(401).json({ error: "Invalid 2FA code." });
  }

  // Disable: clear all TOTP data
  storage.updateUser(userId, {
    totpEnabled:     false,
    totpSecret:      null,
    totpBackupCodes: null,
    totpOptOutAck:   false,
  } as any);

  clearRateLimit(userId);
  return res.json({ ok: true, message: "2FA disabled." });
});

// ── POST /api/v2/auth/2fa/opt-out ─────────────────────────────────────────────
// Client only: records explicit opt-out acknowledgment (totpOptOutAck = true).
// Staff roles cannot opt out — 403.
// Does NOT require a TOTP code (user is declining to enroll).
router.post("/opt-out", (req: Request, res: Response) => {
  const userId = req.v2UserId;
  const role   = req.v2Role;
  if (!userId || !role) return res.status(401).json({ error: "Unauthenticated" });

  if (STAFF_ROLES.has(role)) {
    return res.status(403).json({
      error: "Staff accounts cannot opt out of 2FA.",
    });
  }

  const { acknowledge } = req.body as { acknowledge?: boolean };
  if (acknowledge !== true) {
    return res.status(400).json({
      error: "acknowledge: true is required to confirm opt-out.",
    });
  }

  const user = storage.getUserById(userId);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (user.totpEnabled) {
    return res.status(409).json({
      error: "2FA is currently enabled. Disable it via /auth/2fa/disable before opting out.",
    });
  }

  storage.updateUser(userId, { totpOptOutAck: true } as any);
  return res.json({ ok: true, message: "2FA opt-out recorded." });
});

export default router;
