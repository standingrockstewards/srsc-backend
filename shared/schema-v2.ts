/**
 * schema-v2.ts — Drizzle schema for Render Postgres (v2)
 * Matches the live srsc-db tables created in Brick #1 exactly.
 * DO NOT modify column names — they mirror the DB.
 */

import {
  pgTable, serial, varchar, text, decimal, integer,
  boolean, timestamp, date, pgEnum, numeric, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const referralStatusEnum = pgEnum("referral_status", [
  "pending", "vested", "forfeited", "applied",
]);

export const creditSourceEnum = pgEnum("credit_source", [
  "referral", "refund", "adjustment",
]);

export const retainerTypeEnum = pgEnum("retainer_type", [
  "deposit", "debit", "adjustment",
]);

export const vendorPaymentStatusEnum = pgEnum("vendor_payment_status", [
  "pending", "batched", "paid", "failed",
]);

// ─── customers ────────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id:                  serial("id").primaryKey(),
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
  id:                   serial("id").primaryKey(),
  customerId:           integer("customer_id").notNull().references(() => customers.id),
  nickname:             varchar("nickname", { length: 255 }).notNull(),
  address:              text("address").notNull(),
  city:                 varchar("city", { length: 100 }),
  state:                varchar("state", { length: 2 }).default("OK"),
  zip:                  varchar("zip", { length: 10 }),
  serviceTier:          varchar("service_tier", { length: 50 }),
  targetRetainerAmount: decimal("target_retainer_amount", { precision: 10, scale: 2 }).notNull(),
  lowBalanceAlertPct:   integer("low_balance_alert_pct").notNull().default(25),
  discountTierPct:      integer("discount_tier_pct").notNull().default(0),
  active:                   boolean("active").notNull().default(true),
  // Brick 3.5 — Map + Monitoring foundation (nullable, additive)
  latitude:                 numeric("latitude", { precision: 9, scale: 6 }),
  longitude:                numeric("longitude", { precision: 9, scale: 6 }),
  nearestShorelineMarker:   text("nearest_shoreline_marker"),
  createdAt:                timestamp("created_at").notNull().defaultNow(),
  updatedAt:                timestamp("updated_at").notNull().defaultNow(),
});

export const insertPropertyV2Schema = createInsertSchema(propertiesV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPropertyV2 = z.infer<typeof insertPropertyV2Schema>;
export type PropertyV2 = typeof propertiesV2.$inferSelect;

// ─── retainer_ledger ─────────────────────────────────────────────────────────
export const retainerLedger = pgTable("retainer_ledger", {
  id:           serial("id").primaryKey(),
  propertyId:   integer("property_id").notNull().references(() => propertiesV2.id),
  type:         retainerTypeEnum("type").notNull(),
  amount:       decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  note:         text("note"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const insertRetainerLedgerSchema = createInsertSchema(retainerLedger).omit({ id: true, createdAt: true });
export type InsertRetainerLedger = z.infer<typeof insertRetainerLedgerSchema>;
export type RetainerLedger = typeof retainerLedger.$inferSelect;

// ─── referrals ────────────────────────────────────────────────────────────────
export const referrals = pgTable("referrals", {
  id:                  serial("id").primaryKey(),
  referrerCustomerId:  integer("referrer_customer_id").notNull().references(() => customers.id),
  referredCustomerId:  integer("referred_customer_id").notNull().references(() => customers.id),
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
  id:         serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
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
  id:                    serial("id").primaryKey(),
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
  id:                   serial("id").primaryKey(),
  vendorId:             integer("vendor_id").notNull().references(() => vendors.id),
  jobId:                integer("job_id"),
  clientId:             integer("client_id").notNull().references(() => customers.id),
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
export const vendorPayments = pgTable("vendor_payments", {
  id:               serial("id").primaryKey(),
  vendorId:         integer("vendor_id").notNull().references(() => vendors.id),
  batchId:          varchar("batch_id", { length: 100 }),
  amount:           decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status:           vendorPaymentStatusEnum("status").notNull().default("pending"),
  scheduledFor:     date("scheduled_for"),
  paidAt:           timestamp("paid_at"),
  stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type VendorPayment = typeof vendorPayments.$inferSelect;

// ─── customer_signatures ─────────────────────────────────────────────────────
export const customerSignatures = pgTable("customer_signatures", {
  id:               serial("id").primaryKey(),
  customerId:       integer("customer_id").notNull().references(() => customers.id),
  signatureSvg:     text("signature_svg").notNull(),
  signedDocument:   varchar("signed_document", { length: 100 }).notNull(),
  signedAt:         timestamp("signed_at").notNull().defaultNow(),
  ipAddress:        varchar("ip_address", { length: 45 }),
  userAgent:        text("user_agent"),
});

export const insertCustomerSignatureSchema = createInsertSchema(customerSignatures).omit({ id: true, signedAt: true });
export type InsertCustomerSignature = z.infer<typeof insertCustomerSignatureSchema>;
export type CustomerSignature = typeof customerSignatures.$inferSelect;

// ─── legal_documents ─────────────────────────────────────────────────────────
export const legalDocuments = pgTable("legal_documents", {
  id:            serial("id").primaryKey(),
  docType:       varchar("doc_type", { length: 50 }).notNull(),
  version:       varchar("version", { length: 20 }).notNull(),
  bodyMd:        text("body_md").notNull(),
  effectiveDate: date("effective_date").notNull(),
  active:        boolean("active").notNull().default(false),
});

export type LegalDocument = typeof legalDocuments.$inferSelect;

// ─── monitoring_events (append-only) ───────────────────────────────────────────────────
// Used by Bricks 8 (Storm Response) and 9 (Operations Map).
// Append-only: no update/delete routes will ever be exposed.
// payload must NEVER include alarm codes, alarm_panel_location, access_notes,
// or any other high-sensitivity field (enforced at write time in service layer).
export const monitoringEvents = pgTable(
  "monitoring_events",
  {
    id:             serial("id").primaryKey(),
    propertyId:     integer("property_id").notNull().references(() => propertiesV2.id),
    source:         text("source").notNull(),           // 'anchorwatch' | 'shipshape' | 'signal_flare' | 'weather'
    severity:       text("severity").notNull(),          // 'info' | 'warning' | 'critical'
    category:       text("category").notNull(),
    payload:        text("payload"),                     // JSON string; high-sensitivity fields excluded
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
