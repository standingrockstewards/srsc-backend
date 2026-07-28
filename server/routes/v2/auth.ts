/**
 * /api/v2/auth — login, logout, me
 *
 * Uses the existing v1 users table (SQLite via storage) for credential lookup.
 * On success, writes { v2UserId, v2Role } into the express-session.
 *
 * bcryptjs is used for password comparison. Since v1 stores passwords in
 * plaintext, we use bcryptjs.compareSync with a fallback to plain equality
 * so existing v1 credentials work immediately without a migration.
 *
 * Never log credentials or tokens.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import { customersRepo } from "../../repositories/customers";
import { getEffectivePermissions } from "../../permissions";
import { requireAuthV2 } from "../../middleware/authV2";

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

  // Resolve v2 customerId if this is a client
  let customerId: number | null = null;
  if (user.role === "client") {
    const customer = await customersRepo.getByEmail(user.email);
    customerId = customer?.id ?? null;
  }

  const { password: _pw, ...safeUser } = user;
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

  const { password: _pw, ...safeUser } = user;
  const permissions = getEffectivePermissions(user.id, user.role);

  // Resolve v2 customerId
  let customerId: number | null = null;
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

export default router;
