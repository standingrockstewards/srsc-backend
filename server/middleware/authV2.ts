/**
 * server/middleware/authV2.ts
 *
 * Auth + ownership guards for all /api/v2 routes.
 *
 * Identity model (v1 ↔ v2 bridge):
 *   - Identity lives in the existing v1 `users` table (SQLite / better-sqlite3).
 *   - v2 sessions store { userId, role } in express-session (server-side, cookie-backed).
 *   - v2 "customerId" in the Postgres `customers` table is linked via
 *     users.email === customers.email (email is the join key — no extra FK column needed).
 *   - Roles map directly: admin → full access, supervisor → full access,
 *     client → own records only, vendor → vendor-scoped only, field_tech → read-only.
 *
 * ID model:
 *   - ALL route params that represent IDs are text (nanoid/cuid2). No parseInt anywhere.
 *   - Ownership checks are string === string throughout.
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { customersRepo } from "../repositories/customers";
import { propertiesRepo } from "../repositories/properties";

// ─── Session type augmentation ────────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    v2UserId?:      number;   // v1 users.id (SQLite integer — internal only, never exposed as FK)
    v2Role?:        string;
    v2TotpPending?: boolean;  // Brick 10f: true = password OK but TOTP not yet verified
  }
}

// ─── Request augmentation ──────────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      v2UserId?:     number;       // v1 users.id (SQLite, internal only)
      v2Role?:       string;
      v2CustomerId?: string | null; // Postgres customers.id — text (nanoid/cuid2)
    }
  }
}

// ─── requireAuthV2 ─────────────────────────────────────────────────────────────
/**
 * Applied to ALL /api/v2 routes (except /api/v2/auth/login).
 * Rejects unauthenticated callers with 401.
 * Resolves v2CustomerId (text) by joining users.email → customers.email.
 */
export async function requireAuthV2(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = req.session;

  if (!session?.v2UserId || !session?.v2Role) {
    return res.status(401).json({ error: "Unauthenticated — please log in via /api/v2/auth/login" });
  }

  const user = storage.getUserById(session.v2UserId);
  if (!user || !user.active) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Session invalid — user not found or deactivated" });
  }

  // Brick 10f — partial-session guard
  // If password was verified but TOTP not yet confirmed, block all routes
  // except /auth/2fa/* (which completes the verification).
  if (session.v2TotpPending) {
    const path = req.path ?? "";
    const isTwoFactorPath = path.includes("/2fa/") || path.endsWith("/2fa");
    if (!isTwoFactorPath) {
      return res.status(403).json({
        error: "Two-factor authentication required. POST /api/v2/auth/2fa/validate to complete login.",
        requiresTwoFactor: true,
      });
    }
  }

  req.v2UserId = user.id;
  req.v2Role   = user.role;

  // Resolve v2 customerId (text) for client roles (join on email)
  if (user.role === "client") {
    const customer = await customersRepo.getByEmail(user.email);
    req.v2CustomerId = customer?.id ?? null;  // string | null
  } else {
    req.v2CustomerId = null; // staff have no customer record
  }

  return next();
}

// ─── requireAdminOrSupervisor ──────────────────────────────────────────────────
export function requireAdminOrSupervisor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();
  return res.status(403).json({ error: "Forbidden — admin or supervisor required" });
}

// ─── requireNotVendor ────────────────────────────────────────────────────────
/** Blocks vendors from any route that touches client-owned data. */
export function requireNotVendor(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.v2Role === "vendor") {
    return res.status(403).json({
      error: "Forbidden — vendors may not access client records",
    });
  }
  return next();
}

// ─── requireSelfOrAdmin (customer ownership) ──────────────────────────────────
/**
 * Ensures a client can only access their own customer record.
 * Admin / Supervisor pass through unconditionally.
 * Vendors are blocked (403).
 * All IDs are text — no parseInt.
 *
 * Usage:  router.get("/:customerId/...", requireSelfOrAdmin("customerId"), handler)
 */
export function requireSelfOrAdmin(paramName = "customerId") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.v2Role === "vendor") {
      return res.status(403).json({ error: "Forbidden — vendors may not access customer data" });
    }
    if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();

    const paramId = req.params[paramName];
    if (!paramId) return res.status(400).json({ error: "Invalid id" });

    if (req.v2CustomerId !== paramId) {
      return res.status(403).json({
        error: "Forbidden — you may only access your own records",
      });
    }
    return next();
  };
}

// ─── requirePropertyOwnerOrAdmin ──────────────────────────────────────────────
/**
 * For property-scoped routes: verifies the authenticated client owns the
 * property identified by req.params[paramName].
 * Admin / Supervisor bypass.
 * Vendors blocked (403).
 * All IDs are text — no parseInt.
 */
export function requirePropertyOwnerOrAdmin(paramName = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.v2Role === "vendor") {
      return res.status(403).json({ error: "Forbidden — vendors may not access property data" });
    }
    if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();

    const propertyId = req.params[paramName];
    if (!propertyId) return res.status(400).json({ error: "Invalid property id" });

    const property = await propertiesRepo.getById(propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    // Both are text (string) — straight equality
    if (property.customerId !== req.v2CustomerId) {
      return res.status(403).json({
        error: "Forbidden — you may only access your own properties",
      });
    }
    return next();
  };
}

// ─── requireVendorSelfOrAdmin ─────────────────────────────────────────────────
/**
 * Vendor-scoped routes: only the vendor themselves (or admin) can access.
 * Clients blocked — preserves the middleman model.
 */
export function requireVendorSelfOrAdmin(_paramName = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();

    if (req.v2Role === "client") {
      return res.status(403).json({
        error: "Forbidden — client accounts may not access vendor records directly",
      });
    }

    if (req.v2Role === "vendor") return next();

    // field_tech: read-only pass-through (route handlers decide)
    return next();
  };
}
