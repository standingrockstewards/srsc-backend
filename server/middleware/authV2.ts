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
 * Ownership check strategy:
 *   - Admin / Supervisor: bypass ownership — always allowed.
 *   - Client: req.v2CustomerId must equal the :customerId param (or property's owner).
 *   - Vendor: blocked from all customer-data endpoints; vendor-scoped routes only.
 *   - Field Tech: read-only on non-sensitive v2 endpoints (vendor list, etc.).
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { customersRepo } from "../repositories/customers";
import { propertiesRepo } from "../repositories/properties";

// ─── Session type augmentation ────────────────────────────────────────────────
declare module "express-session" {
  interface SessionData {
    v2UserId?: number;
    v2Role?:   string;
  }
}

// ─── Request augmentation ──────────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      v2UserId?:     number;
      v2Role?:       string;
      v2CustomerId?: number | null; // resolved Postgres customers.id (null if staff)
    }
  }
}

// ─── requireAuthV2 ─────────────────────────────────────────────────────────────
/**
 * Applied to ALL /api/v2 routes (except /api/v2/auth/login).
 * Rejects unauthenticated callers with 401.
 * Resolves v2CustomerId by joining users.email → customers.email.
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

  // Verify the user still exists in v1 store
  const user = storage.getUserById(session.v2UserId);
  if (!user || !user.active) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Session invalid — user not found or deactivated" });
  }

  req.v2UserId = user.id;
  req.v2Role   = user.role;

  // Resolve v2 customerId for client roles (join on email)
  if (user.role === "client") {
    const customer = await customersRepo.getByEmail(user.email);
    req.v2CustomerId = customer?.id ?? null;
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
 * Ensures that a client can only access their own customer record.
 * Admin / Supervisor pass through unconditionally.
 * Vendors are blocked (403).
 *
 * Usage:  router.get("/:customerId/...", requireSelfOrAdmin("customerId"), handler)
 */
export function requireSelfOrAdmin(paramName = "customerId") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.v2Role === "vendor") {
      return res.status(403).json({ error: "Forbidden — vendors may not access customer data" });
    }
    if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();

    const paramId = parseInt(req.params[paramName]);
    if (isNaN(paramId)) return res.status(400).json({ error: "Invalid id" });

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
 * property identified by req.params.id (or :propertyId).
 * Admin / Supervisor bypass.
 * Vendors blocked.
 */
export function requirePropertyOwnerOrAdmin(paramName = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.v2Role === "vendor") {
      return res.status(403).json({ error: "Forbidden — vendors may not access property data" });
    }
    if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();

    const propertyId = parseInt(req.params[paramName]);
    if (isNaN(propertyId)) return res.status(400).json({ error: "Invalid property id" });

    const property = await propertiesRepo.getById(propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    if (property.customerId !== req.v2CustomerId) {
      return res.status(403).json({
        error: "Forbidden — you may only access your own properties",
      });
    }
    return next();
  };
}

// ─── requireVendorSelf ────────────────────────────────────────────────────────
/**
 * Vendor-scoped routes: only the vendor themselves (or admin) can access.
 * Clients blocked — preserves the middleman model (clients never see vendor identity).
 */
export function requireVendorSelfOrAdmin(paramName = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.v2Role === "admin" || req.v2Role === "supervisor") return next();

    if (req.v2Role === "client") {
      return res.status(403).json({
        error: "Forbidden — client accounts may not access vendor records directly",
      });
    }

    // For vendors: they have no customerId, but their v2UserId maps to a vendor row
    // via users.email === vendors.email — enforced in the route handler for now.
    // Middleware just allows vendor role through for vendor-scoped routes.
    if (req.v2Role === "vendor") return next();

    // field_tech: read-only pass-through (route handlers decide)
    return next();
  };
}
