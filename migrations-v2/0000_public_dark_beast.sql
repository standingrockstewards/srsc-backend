CREATE TABLE "account_credits" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"source" text NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_state_log" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"legal_document_id" text,
	"signature_svg" text NOT NULL,
	"signed_document" varchar(100) NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"credit_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"active_property_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "integration_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text,
	"provider" text NOT NULL,
	"display_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"auto_create_job" boolean DEFAULT true NOT NULL,
	"default_priority" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"asset_type" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kb_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_type" varchar(50) NOT NULL,
	"version" varchar(20) NOT NULL,
	"body_md" text NOT NULL,
	"effective_date" date NOT NULL,
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_events" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"source" text NOT NULL,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"payload" text,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visit_type" text,
	"note" text,
	"latitude" numeric(10, 6),
	"longitude" numeric(10, 6),
	"visit_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"nickname" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100),
	"state" varchar(2) DEFAULT 'OK',
	"zip" varchar(10),
	"service_tier" varchar(50),
	"target_retainer_amount" numeric(10, 2) NOT NULL,
	"low_balance_alert_pct" integer DEFAULT 25 NOT NULL,
	"discount_tier_pct" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"nearest_shoreline_marker" text,
	"billing_state" text DEFAULT 'current' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"alarm_code_enc" text,
	"gate_code_enc" text,
	"access_notes_enc" text,
	"key_location_enc" text,
	"address_enc" text,
	"sensitive_updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_customer_id" text NOT NULL,
	"referred_customer_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"bonus_credit_amount" numeric(10, 2) NOT NULL,
	"vests_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retainer_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"assigned_tech_id" text NOT NULL,
	"visit_type" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"follow_up_of" text,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shoreline_markers" (
	"id" text PRIMARY KEY NOT NULL,
	"marker_number" text NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"description" text,
	"lake" text DEFAULT 'Lake Eufaula' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stewardship_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"source_event_id" text,
	"trigger_type" text NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_to" text,
	"assigned_to_type" text,
	"scheduled_for" timestamp with time zone,
	"due_by" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dispatched_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_role" text NOT NULL,
	"fields_read" text[] NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "vault_reveal_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"secret_id" bigint NOT NULL,
	"revealed_by" text NOT NULL,
	"customer_id" text,
	"outcome" text NOT NULL,
	"ip" text,
	"revealed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_secrets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"customer_id" text,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"batch_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"stripe_transfer_id" text
);
--> statement-breakpoint
CREATE TABLE "vendor_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"job_id" text,
	"client_id" text NOT NULL,
	"rating_quality" integer NOT NULL,
	"rating_timeliness" integer NOT NULL,
	"rating_communication" integer NOT NULL,
	"rating_cleanup" integer NOT NULL,
	"overall" numeric(3, 2) NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"specialty" varchar(255),
	"public_score" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"min_reviews_for_display" integer DEFAULT 3 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_credits" ADD CONSTRAINT "account_credits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_state_log" ADD CONSTRAINT "billing_state_log_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_signatures" ADD CONSTRAINT "customer_signatures_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_signatures" ADD CONSTRAINT "customer_signatures_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_sources" ADD CONSTRAINT "integration_sources_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_category_id_kb_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kb_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_events" ADD CONSTRAINT "monitoring_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_customer_id_customers_id_fk" FOREIGN KEY ("referrer_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_customer_id_customers_id_fk" FOREIGN KEY ("referred_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainer_ledger" ADD CONSTRAINT "retainer_ledger_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_visits" ADD CONSTRAINT "scheduled_visits_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stewardship_jobs" ADD CONSTRAINT "stewardship_jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_access_log" ADD CONSTRAINT "vault_access_log_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_reveal_log" ADD CONSTRAINT "vault_reveal_log_secret_id_vault_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."vault_secrets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_client_id_customers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_state_log_property_created_idx" ON "billing_state_log" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_kb_art_cat" ON "kb_articles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_kb_art_status" ON "kb_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kb_art_updated" ON "kb_articles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "monitoring_events_property_created_idx" ON "monitoring_events" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sv_property" ON "scheduled_visits" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_sv_tech" ON "scheduled_visits" USING btree ("assigned_tech_id");--> statement-breakpoint
CREATE INDEX "idx_sv_scheduled" ON "scheduled_visits" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_sv_status" ON "scheduled_visits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shoreline_markers_marker_number_idx" ON "shoreline_markers" USING btree ("marker_number");--> statement-breakpoint
CREATE INDEX "shoreline_markers_lake_idx" ON "shoreline_markers" USING btree ("lake");--> statement-breakpoint
CREATE INDEX "idx_vl_property" ON "vault_access_log" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_vl_user" ON "vault_access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_vl_accessed" ON "vault_access_log" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "idx_vault_reveal_log_secret" ON "vault_reveal_log" USING btree ("secret_id");