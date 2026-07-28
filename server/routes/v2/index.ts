/**
 * v2 API router — mounted at /api/v2 in server/routes.ts
 *
 * Auth flow:
 *   /api/v2/auth/*  — public (login/logout/me handles its own requireAuthV2 on /me)
 *   /api/v2/health  — public (infrastructure health check)
 *   everything else — gated by requireAuthV2 applied as router-level middleware
 */

import { Router } from "express";
import { requireAuthV2 } from "../../middleware/authV2";
import healthRouter    from "./health";
import authRouter      from "./auth";
import customersRouter from "./customers";
import propertiesRouter from "./properties";
import referralsRouter from "./referrals";
import vendorsRouter   from "./vendors";

const v2 = Router();

// ── Public routes (no auth required) ──────────────────────────────────────────
v2.use("/health", healthRouter);   // GET /api/v2/health
v2.use("/auth",   authRouter);     // POST /api/v2/auth/login, /logout, GET /me

// ── Protected routes (all require a valid v2 session) ─────────────────────────
v2.use(requireAuthV2);

v2.use("/customers",  customersRouter);   // CRUD + ownership
v2.use("/properties", propertiesRouter);  // CRUD + retainer sub-routes + ownership
v2.use("/referrals",  referralsRouter);   // create (admin) + vest (admin) + list (self/admin)
v2.use("/vendors",    vendorsRouter);     // CRUD + reviews + scorecard

export default v2;
