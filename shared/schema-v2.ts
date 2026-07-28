// v2/brick-1 schema — Postgres via Drizzle ORM
import {
  pgTable, text, integer, boolean, timestamp, numeric, index,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

const id = () => text('id').primaryKey().$defaultFn(() => createId());
const money = (name: string) => numeric(name, { precision: 10, scale: 2 });
const score = (name: string) => numeric(name, { precision: 3, scale: 2 });

export const customers = pgTable('customers', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('client'),
  creditBalance: money('credit_balance').notNull().default('0'),
  activePropertyCount: integer('active_property_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable('properties', {
  id: id(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  name: text('name').notNull(),
  address: text('address').notNull(),
  targetRetainerAmount: money('target_retainer_amount').notNull(),
  lowBalanceAlertPct: integer('low_balance_alert_pct').notNull().default(25),
  discountTierPct: integer('discount_tier_pct').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerSignatures = pgTable('customer_signatures', {
  id: id(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  signatureSvg: text('signature_svg').notNull(),
  signedDocument: text('signed_document').notNull(),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export const referrals = pgTable('referrals', {
  id: id(),
  referrerCustomerId: text('referrer_customer_id').notNull().references(() => customers.id),
  referredCustomerId: text('referred_customer_id').notNull().references(() => customers.id),
  status: text('status').notNull().default('pending'),
  bonusCreditAmount: money('bonus_credit_amount').notNull(),
  vestsAt: timestamp('vests_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byReferrerStatus: index('referrals_referrer_status_idx').on(t.referrerCustomerId, t.status),
}));

export const accountCredits = pgTable('account_credits', {
  id: id(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  amount: money('amount').notNull(),
  source: text('source').notNull(),
  applied: boolean('applied').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  publicScore: score('public_score'),
  reviewCount: integer('review_count').notNull().default(0),
  minReviewsForDisplay: integer('min_reviews_for_display').notNull().default(3),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendorReviews = pgTable('vendor_reviews', {
  id: id(),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  jobId: text('job_id'),
  clientId: text('client_id').notNull(),
  ratingQuality: integer('rating_quality').notNull(),
  ratingTimeliness: integer('rating_timeliness').notNull(),
  ratingCommunication: integer('rating_communication').notNull(),
  ratingCleanup: integer('rating_cleanup').notNull(),
  overall: score('overall').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byVendor: index('vendor_reviews_vendor_idx').on(t.vendorId),
}));

export const vendorPayments = pgTable('vendor_payments', {
  id: id(),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  batchId: text('batch_id').notNull(),
  amount: money('amount').notNull(),
  status: text('status').notNull().default('pending'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  stripeTransferId: text('stripe_transfer_id'),
}, (t) => ({
  byBatchStatus: index('vendor_payments_batch_status_idx').on(t.batchId, t.status),
}));

export const retainerLedger = pgTable('retainer_ledger', {
  id: id(),
  propertyId: text('property_id').notNull().references(() => properties.id),
  type: text('type').notNull(),
  amount: money('amount').notNull(),
  balanceAfter: money('balance_after').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byPropertyTime: index('retainer_ledger_property_time_idx').on(t.propertyId, t.createdAt),
}));

export const legalDocuments = pgTable('legal_documents', {
  id: id(),
  docType: text('doc_type').notNull(),
  version: text('version').notNull(),
  bodyMd: text('body_md').notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  active: boolean('active').notNull().default(false),
});
