/**
 * /api/v2/auth — login, logout, me, 2fa/*
 *
 * Uses the existing v1 users table (SQLite via storage) for credential lookup.
 * On success, writes { v2UserId, v2Role } into the express-session.
 *
 * Brick 10f — TOTP gate:
 *   If user.totpEnabled, login sets v2TotpPending=true and returns
 *   { requiresTwoFactor: true } instead of the full session payload.
 *   The client must POST /auth/2fa/validate with a valid code to promote
 *   the session to fully authenticated.
 *
 * Never log credentials or tokens.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import { customersRepo } from "../../repositories/customers";
import { getEffectivePermissions } from "../../permissions";
import { requireAuthV2 } from "../../middleware/authV2";
import twoFactorRouter from "./twoFactor";

const router = Router();

// POST /api/v2/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const user = storage.getUserByUsername(username as string);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Support both bcrypt hashes (future) and current plaintext (v1 legacy)
  const isHashedPassword = user.password?.startsWith("$2");
  const passwordValid = isHashedPassword
    ? bcrypt.compareSync(password as string, user.password)
    : user.password === password;

  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.active) {
    return res.status(403).json({ error: "Account is deactivated" });
  }

  // Stamp the session
  req.session.v2UserId = user.id;
  req.session.v2Role   = user.role;

  // Brick 10f — TOTP gate: if 2FA enabled, return partial session + challenge
  if ((user as any).totpEnabled) {
    req.session.v2TotpPending = true;
    return res.status(200).json({
      requiresTwoFactor: true,
      message: "Password verified. Submit your TOTP code to POST /api/v2/auth/2fa/validate.",
    });
  }

  // No 2FA — full session
  req.session.v2TotpPending = false;

  // Resolve v2 customerId if this is a client (text cuid2, not integer)
  let customerId: string | null = null;
  if (user.role === "client") {
    const customer = await customersRepo.getByEmail(user.email);
    customerId = customer?.id ?? null;
  }

  const { password: _pw, totpSecret: _ts, totpBackupCodes: _bc, ...safeUser } = user as any;
  const permissions = getEffectivePermissions(user.id, user.role);

  return res.json({
    user: safeUser,
    customerId,
    role: user.role,
    permissions,
  });
});

// POST /api/v2/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("[v2/auth] session destroy error:", err.message);
    }
    res.clearCookie("__Host-srsc-v2");
    return res.json({ ok: true });
  });
});

// GET /api/v2/auth/me — requires auth
router.get("/me", requireAuthV2, async (req, res) => {
  const user = storage.getUserById(req.v2UserId!);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Strip sensitive fields — never expose secret or backup code hashes
  const { password: _pw, totpSecret: _ts2, totpBackupCodes: _bc2, ...safeUser } = user as any;
  const permissions = getEffectivePermissions(user.id, user.role);

  // Resolve v2 customerId (text cuid2, not integer)
  let customerId: string | null = null;
  if (user.role === "client") {
    const customer = await customersRepo.getByEmail(user.email);
    customerId = customer?.id ?? null;
  }

  return res.json({
    user: safeUser,
    customerId,
    role: user.role,
    permissions,
  });
});

// ── 2FA sub-router ─────────────────────────────────────────────────────────────
// Mounted under /api/v2/auth/2fa/*
// requireAuthV2 is already applied to the /api/v2 router in index.ts,
// so all 2fa/* routes inherit the session check.
router.use("/2fa", twoFactorRouter);

export default router;
