/**
 * v2 API router — mounted at /api/v2 in server/routes.ts
 */

import { Router } from "express";
import healthRouter    from "./health";
import customersRouter from "./customers";
import propertiesRouter from "./properties";
import referralsRouter from "./referrals";
import vendorsRouter   from "./vendors";

const v2 = Router();

v2.use("/",           healthRouter);      // GET /api/v2/health
v2.use("/customers",  customersRouter);   // CRUD
v2.use("/properties", propertiesRouter);  // CRUD + retainer sub-routes
v2.use("/referrals",  referralsRouter);   // create + vest
v2.use("/vendors",    vendorsRouter);     // CRUD + reviews + scorecard

export default v2;
