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
import healthRouter            from "./health";
import authRouter              from "./auth";
import customersRouter         from "./customers";
import propertiesRouter        from "./properties";
import referralsRouter         from "./referrals";
import vendorsRouter           from "./vendors";
import legalDocumentsRouter    from "./legalDocuments";
import customerSignaturesRouter from "./customerSignatures";
import eventsRouter            from "./monitoringEvents";  // Brick 6: mounted at /events
import retainerRouter          from "./retainer";
import creditsRouter           from "./credits";

const v2 = Router();

// ── Public routes (no auth required) ──────────────────────────────────────────
v2.use("/health", healthRouter);   // GET /api/v2/health
v2.use("/auth",   authRouter);     // POST /api/v2/auth/login, /logout, GET /me

// ── Protected routes (all require a valid v2 session) ─────────────────────────
v2.use(requireAuthV2);

v2.use("/customers",   customersRouter);          // CRUD + ownership
v2.use("/properties",  propertiesRouter);          // CRUD + retainer + lat/lng/shoreline
                                                   // Brick 6: /:propertyId/events (POST log, GET list)
v2.use("/referrals",   referralsRouter);           // create (admin) + vest + list
v2.use("/vendors",     vendorsRouter);             // CRUD + reviews + scorecard
v2.use("/legal",       legalDocumentsRouter);      // Brick 4: GET :docType/active, GET :docType/versions, POST
v2.use("/signatures",  customerSignaturesRouter);  // Brick 4: POST capture, GET list (ownership gated)
v2.use("/events",      eventsRouter);              // Brick 6: GET /:id, POST /system, PATCH /:id/acknowledge
v2.use("/retainer",    retainerRouter);            // Brick 5: ledger, balance, low-balance, statements, dunning
v2.use("/credits",     creditsRouter);             // Brick 5: issue + apply credits

export default v2;
