/**
 * v2 API router — mounted at /api/v2 in server/routes.ts
 *
 * Auth flow:
 *   /api/v2/auth/*          — public (login/logout; /me checks its own auth)
 *   /api/v2/health          — public
 *   /api/v2/integrations/*  — public-with-verification (webhook; no session required)
 *   everything else         — gated by requireAuthV2 (session cookie)
 */

import { Router } from "express";
import { requireAuthV2 } from "../../middleware/authV2";

// Public / pre-auth routers
import healthRouter             from "./health";
import authRouter               from "./auth";
import integrationsRouter       from "./integrations";       // Brick 8: webhook ingest (public+sig)

// Protected routers
import customersRouter          from "./customers";
import propertiesRouter         from "./properties";
import referralsRouter          from "./referrals";
import vendorsRouter            from "./vendors";
import legalDocumentsRouter     from "./legalDocuments";
import customerSignaturesRouter from "./customerSignatures";
import eventsRouter             from "./monitoringEvents";   // Brick 6: /events/:id, /events/system
import retainerRouter           from "./retainer";           // Brick 5
import creditsRouter            from "./credits";            // Brick 5
import vendorPaymentsRouter     from "./vendorPayments";     // Brick 7
import integrationSourcesRouter from "./integrationSources"; // Brick 8: provider registry
import jobsRouter               from "./jobs";               // Brick 8: stewardship jobs
import markersRouter            from "./markers";             // Brick 10e-prereq: shoreline markers
import visitsRouter             from "./visits";              // Brick 10g: scheduled visits
import calendarRouter           from "./calendar";             // Brick 10g: merged calendar feed
import kbRouter                 from "./kb";                   // Brick 10i: knowledge base

const v2 = Router();

// ── Public routes ──────────────────────────────────────────────────────────────
v2.use("/health",       healthRouter);
v2.use("/auth",         authRouter);
v2.use("/integrations", integrationsRouter);   // POST /api/v2/integrations/:provider

// ── Protected routes (require valid v2 session) ────────────────────────────────
v2.use(requireAuthV2);

v2.use("/customers",            customersRouter);
v2.use("/properties",           propertiesRouter);
  // ↳ also serves:
  //   Brick 6:  /:propertyId/events  (POST log visit, GET list)
  //   Brick 8:  /:propertyId/jobs    (GET list, client owner-or-admin)
v2.use("/referrals",            referralsRouter);
v2.use("/vendors",              vendorsRouter);
v2.use("/legal",                legalDocumentsRouter);
v2.use("/signatures",           customerSignaturesRouter);
v2.use("/events",               eventsRouter);
v2.use("/retainer",             retainerRouter);
v2.use("/credits",              creditsRouter);
v2.use("/",                     vendorPaymentsRouter);       // /payout-batches, /vendor-payments/:id/*
v2.use("/integration-sources",  integrationSourcesRouter);  // Brick 8: provider registry CRUD
v2.use("/jobs",                 jobsRouter);                 // Brick 8: stewardship jobs CRUD
v2.use("/markers",              markersRouter);              // Brick 10e-prereq: shoreline markers
v2.use("/visits",               visitsRouter);               // Brick 10g: scheduled visits CRUD
v2.use("/calendar",             calendarRouter);             // Brick 10g: merged calendar feed
v2.use("/kb",                   kbRouter);                    // Brick 10i: knowledge base

export default v2;
