/**
 * schema-v2.ts — Drizzle schema for Render Postgres (v2)
 *
 * ALL primary keys are text (cuid2/nanoid), generated server-side via nanoid().
 * ALL foreign keys are text to match.
 * No serial/integer PKs anywhere in this file.
 */

import {
  pgTable, varchar, text, decimal, integer,
  boolean, timestamp, date, pgEnum, numeric, index, jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "nanoid";

// ─── ID helper ────────────────────────────────────────────────────────────────
// All tables use this for their PK. nanoid() is called at insert time.
export const id = () => text("id").primaryKey().$defaultFn(() => nanoid());

// ─── Enums ────────────────────────────────────────────────────────────────────
export const referralStatusEnum = pgEnum("referral_status", [
  "pending", "vested", "forfeited", "applied",
]);

export const creditSourceEnum = pgEnum("credit_source", [
  "referral", "refund", "adjustment",
]);

// retainer_type is plain text in the live DB (no pg enum).
export const RETAINER_ENTRY_TYPES = ["topup", "charge", "credit_applied", "adjustment"] as const;
export type RetainerEntryType = typeof RETAINER_ENTRY_TYPES[number];

// vendor_payment_status is plain text in the live DB (no pg enum).
// Allowed values enforced in TypeScript only.
export const VENDOR_PAYMENT_STATUSES = ["pending", "scheduled", "paid", "failed"] as const;
export type VendorPaymentStatus = typeof VENDOR_PAYMENT_STATUSES[number];

// ── Money helper ─────────────────────────────────────────────────────────────
// numeric(10,2) — matches the live DB money columns.
export const money = (col: string) => numeric(col, { precision: 10, scale: 2 });

// ─── customers ────────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id:                  id(),
  name:                varchar("name", { length: 255 }).notNull(),
  email:               varchar("email", { length: 255 }).notNull().unique(),
  phone:               varchar("phone", { length: 50 }),
  creditBalance:       decimal("credit_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  activePropertyCount: integer("active_property_count").notNull().default(0),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ─── properties ──────────────────────────────────────────────────────────────
export const propertiesV2 = pgTable("properties", {
  id:                       id(),
  customerId:               text("customer_id").notNull().references(() => customers.id),
  nickname:                 varchar("nickname", { length: 255 }).notNull(),
  address:                  text("address").notNull(),
  city:                     varchar("city", { length: 100 }),
  state:                    varchar("state", { length: 2 }).default("OK"),
  zip:                      varchar("zip", { length: 10 }),
  serviceTier:              varchar("service_tier", { length: 50 }),
  targetRetainerAmount:     decimal("target_retainer_amount", { precision: 10, scale: 2 }).notNull(),
  lowBalanceAlertPct:       integer("low_balance_alert_pct").notNull().default(25),
  discountTierPct:          integer("discount_tier_pct").notNull().default(0),
  active:                   boolean("active").notNull().default(true),
  // Brick 3.5 — Map + Monitoring foundation (nullable, additive)
  latitude:                 numeric("latitude", { precision: 9, scale: 6 }),
  longitude:                numeric("longitude", { precision: 9, scale: 6 }),
  nearestShorelineMarker:   text("nearest_shoreline_marker"),
  // Brick 5 — Dunning state
  billingState:             text("billing_state").notNull().default("current"),
  createdAt:                timestamp("created_at").notNull().defaultNow(),
  updatedAt:                timestamp("updated_at").notNull().defaultNow(),
});

export const insertPropertyV2Schema = createInsertSchema(propertiesV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPropertyV2 = z.infer<typeof insertPropertyV2Schema>;
export type PropertyV2 = typeof propertiesV2.$inferSelect;

// ─── retainer_ledger ─────────────────────────────────────────────────────────
export const retainerLedger = pgTable("retainer_ledger", {
  id:           id(),
  propertyId:   text("property_id").notNull().references(() => propertiesV2.id),
  type:         text("type").notNull(), // topup | charge | credit_applied | adjustment
  amount:       decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  note:         text("note"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const insertRetainerLedgerSchema = createInsertSchema(retainerLedger).omit({ id: true, createdAt: true });
export type InsertRetainerLedger = z.infer<typeof insertRetainerLedgerSchema>;
export type RetainerLedger = typeof retainerLedger.$inferSelect;

// ─── billing_state_log (append-only, Brick 5) ────────────────────────────────
export const billingStateLog = pgTable(
  "billing_state_log",
  {
    id:         id(),
    propertyId: text("property_id").notNull().references(() => propertiesV2.id),
    fromState:  text("from_state").notNull(),
    toState:    text("to_state").notNull(),
    reason:     text("reason"),
    createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    propCreatedIdx: index("billing_state_log_property_created_idx").on(t.propertyId, t.createdAt),
  }),
);

export type BillingStateLog = typeof billingStateLog.$inferSelect;

// ─── referrals ────────────────────────────────────────────────────────────────
export const referrals = pgTable("referrals", {
  id:                  id(),
  referrerCustomerId:  text("referrer_customer_id").notNull().references(() => customers.id),
  referredCustomerId:  text("referred_customer_id").notNull().references(() => customers.id),
  status:              referralStatusEnum("status").notNull().default("pending"),
  bonusCreditAmount:   decimal("bonus_credit_amount", { precision: 10, scale: 2 }).notNull(),
  vestsAt:             timestamp("vests_at"),
  createdAt:           timestamp("created_at").notNull().defaultNow(),
  updatedAt:           timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// ─── account_credits ──────────────────────────────────────────────────────────
export const accountCredits = pgTable("account_credits", {
  id:         id(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  amount:     decimal("amount", { precision: 10, scale: 2 }).notNull(),
  source:     creditSourceEnum("source").notNull(),
  applied:    boolean("applied").notNull().default(false),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const insertAccountCreditSchema = createInsertSchema(accountCredits).omit({ id: true, createdAt: true });
export type InsertAccountCredit = z.infer<typeof insertAccountCreditSchema>;
export type AccountCredit = typeof accountCredits.$inferSelect;

// ─── vendors ─────────────────────────────────────────────────────────────────
export const vendors = pgTable("vendors", {
  id:                    id(),
  name:                  varchar("name", { length: 255 }).notNull(),
  email:                 varchar("email", { length: 255 }),
  phone:                 varchar("phone", { length: 50 }),
  specialty:             varchar("specialty", { length: 255 }),
  publicScore:           decimal("public_score", { precision: 3, scale: 2 }),
  reviewCount:           integer("review_count").notNull().default(0),
  minReviewsForDisplay:  integer("min_reviews_for_display").notNull().default(3),
  active:                boolean("active").notNull().default(true),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

// ─── vendor_reviews ──────────────────────────────────────────────────────────
export const vendorReviews = pgTable("vendor_reviews", {
  id:                   id(),
  vendorId:             text("vendor_id").notNull().references(() => vendors.id),
  jobId:                text("job_id"),
  clientId:             text("client_id").notNull().references(() => customers.id),
  ratingQuality:        integer("rating_quality").notNull(),
  ratingTimeliness:     integer("rating_timeliness").notNull(),
  ratingCommunication:  integer("rating_communication").notNull(),
  ratingCleanup:        integer("rating_cleanup").notNull(),
  overall:              decimal("overall", { precision: 3, scale: 2 }).notNull(),
  comment:              text("comment"),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
});

export const insertVendorReviewSchema = createInsertSchema(vendorReviews).omit({ id: true, createdAt: true });
export type InsertVendorReview = z.infer<typeof insertVendorReviewSchema>;
export type VendorReview = typeof vendorReviews.$inferSelect;

// ─── vendor_payments ─────────────────────────────────────────────────────────
// vendor_payments — live schema verified 2026-07-28:
//   id text, vendor_id text, batch_id text, amount numeric(10,2),
//   status text, scheduled_for timestamptz, paid_at timestamptz,
//   stripe_transfer_id text
//   NO created_at / updated_at columns in the live table.
export const vendorPayments = pgTable("vendor_payments", {
  id:               id(),
  vendorId:         text("vendor_id").notNull().references(() => vendors.id),
  batchId:          text("batch_id"),
  amount:           money("amount").notNull(),
  status:           text("status").notNull().default("pending"),
  scheduledFor:     timestamp("scheduled_for", { withTimezone: true }),
  paidAt:           timestamp("paid_at",       { withTimezone: true }),
  stripeTransferId: text("stripe_transfer_id"),
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({ id: true });
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type VendorPayment = typeof vendorPayments.$inferSelect;

// ─── legal_documents ─────────────────────────────────────────────────────────
// id is text (cuid2/nanoid) — live DB confirmed.
export const legalDocuments = pgTable("legal_documents", {
  id:            id(),
  docType:       varchar("doc_type", { length: 50 }).notNull(),
  version:       varchar("version", { length: 20 }).notNull(),
  bodyMd:        text("body_md").notNull(),
  effectiveDate: date("effective_date").notNull(),
  active:        boolean("active").notNull().default(false),
});

export const insertLegalDocumentSchema = createInsertSchema(legalDocuments).omit({ id: true });
export type InsertLegalDocument = z.infer<typeof insertLegalDocumentSchema>;
export type LegalDocument = typeof legalDocuments.$inferSelect;

// ─── customer_signatures ─────────────────────────────────────────────────────
// legalDocumentId added in Brick 4 via psql ALTER TABLE (text FK).
export const customerSignatures = pgTable("customer_signatures", {
  id:               id(),
  customerId:       text("customer_id").notNull().references(() => customers.id),
  legalDocumentId:  text("legal_document_id").references(() => legalDocuments.id),
  signatureSvg:     text("signature_svg").notNull(),
  signedDocument:   varchar("signed_document", { length: 100 }).notNull(),
  signedAt:         timestamp("signed_at").notNull().defaultNow(),
  ipAddress:        varchar("ip_address", { length: 45 }),
  userAgent:        text("user_agent"),
});

export const insertCustomerSignatureSchema = createInsertSchema(customerSignatures).omit({ id: true, signedAt: true });
export type InsertCustomerSignature = z.infer<typeof insertCustomerSignatureSchema>;
export type CustomerSignature = typeof customerSignatures.$inferSelect;

// ─── monitoring_events (append-only) ─────────────────────────────────────────
export const monitoringEvents = pgTable(
  "monitoring_events",
  {
    id:             id(),
    propertyId:     text("property_id").notNull().references(() => propertiesV2.id),
    source:         text("source").notNull(),
    severity:       text("severity").notNull(),
    category:       text("category").notNull(),
    payload:        text("payload"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Brick 6 — Stewardship visit columns (added via psql ALTER TABLE)
    visitType:      text("visit_type"),
    note:           text("note"),
    latitude:       numeric("latitude",  { precision: 10, scale: 6 }),
    longitude:      numeric("longitude", { precision: 10, scale: 6 }),
    visitAt:        timestamp("visit_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    propertyCreatedIdx: index("monitoring_events_property_created_idx").on(
      t.propertyId,
      t.createdAt,
    ),
  }),
);

export const insertMonitoringEventSchema = createInsertSchema(monitoringEvents).omit({ id: true, createdAt: true });
export type InsertMonitoringEvent = z.infer<typeof insertMonitoringEventSchema>;
export type MonitoringEvent = typeof monitoringEvents.$inferSelect;

// ─── Brick 8 constants ────────────────────────────────────────────────────────
// All status/type/priority columns are plain text in the live DB.
// TS unions enforce allowed values; NO pgEnum used.

export const JOB_STATUSES = [
  "pending", "scheduled", "dispatched", "in_progress", "completed", "cancelled",
] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export const JOB_PRIORITIES = ["low", "normal", "urgent"] as const;
export type JobPriority = typeof JOB_PRIORITIES[number];

export const JOB_TRIGGER_TYPES = [
  "anchor_watch", "shipshape", "signal_flare", "weather", "manual",
] as const;
export type JobTriggerType = typeof JOB_TRIGGER_TYPES[number];

export const JOB_TYPES = ["visit", "inspection", "response"] as const;
export type JobType = typeof JOB_TYPES[number];

// ─── integration_sources ─────────────────────────────────────────────────────
// Live schema verified 2026-07-28 (10 columns).
// property_id is nullable (a source can be global or per-property).
// config is jsonb — rule engine reads thresholds etc. from here at runtime.
export const integrationSources = pgTable("integration_sources", {
  id:              id(),
  propertyId:      text("property_id").references(() => propertiesV2.id),   // nullable
  provider:        text("provider").notNull(),
  displayName:     text("display_name"),
  enabled:         boolean("enabled").notNull().default(true),
  config:          jsonb("config").notNull().default({}),
  autoCreateJob:   boolean("auto_create_job").notNull().default(true),
  defaultPriority: text("default_priority").notNull().default("normal"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationSourceSchema = createInsertSchema(integrationSources).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertIntegrationSource = z.infer<typeof insertIntegrationSourceSchema>;
export type IntegrationSource = typeof integrationSources.$inferSelect;

// ─── stewardship_jobs ─────────────────────────────────────────────────────────
// Live schema verified 2026-07-28 (17 columns).
// assigned_to is a nullable text ID with no hard FK — the type of the assignee
// (vendor, field_tech, internal, etc.) is stored in assigned_to_type so the
// app layer can resolve it without a DB enum.
// source_event_id links back to monitoring_events.id (soft reference, nullable).
export const stewardshipJobs = pgTable("stewardship_jobs", {
  id:             id(),
  propertyId:     text("property_id").notNull().references(() => propertiesV2.id),
  sourceEventId:  text("source_event_id"),                         // soft ref to monitoring_events.id
  triggerType:    text("trigger_type").notNull(),                   // JOB_TRIGGER_TYPES
  jobType:        text("job_type").notNull(),                       // JOB_TYPES
  status:         text("status").notNull().default("pending"),      // JOB_STATUSES
  priority:       text("priority").notNull().default("normal"),     // JOB_PRIORITIES
  assignedTo:     text("assigned_to"),                             // nullable text ID (no hard FK)
  assignedToType: text("assigned_to_type"),                        // "vendor"|"field_tech"|"internal"
  scheduledFor:   timestamp("scheduled_for",  { withTimezone: true }),
  dueBy:          timestamp("due_by",         { withTimezone: true }),
  notes:          text("notes"),
  metadata:       jsonb("metadata").notNull().default({}),
  dispatchedAt:   timestamp("dispatched_at",  { withTimezone: true }),
  completedAt:    timestamp("completed_at",   { withTimezone: true }),
  createdAt:      timestamp("created_at",     { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at",     { withTimezone: true }).notNull().defaultNow(),
});

export const insertStewardshipJobSchema = createInsertSchema(stewardshipJobs).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertStewardshipJob = z.infer<typeof insertStewardshipJobSchema>;
export type StewardshipJob = typeof stewardshipJobs.$inferSelect;
