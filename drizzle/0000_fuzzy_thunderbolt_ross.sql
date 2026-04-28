CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"phone" text,
	"address" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" text,
	"stripe_customer_id" text,
	"stripe_account_id" text,
	"stripe_connect_status" text DEFAULT 'pending',
	"stripe_onboarding_completed_at" timestamp with time zone,
	"subscription_tier" text DEFAULT 'free',
	"subscription_status" text DEFAULT 'active',
	"twilio_phone_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "company_payment_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"online_payments_enabled" boolean DEFAULT false NOT NULL,
	"estimate_deposits_enabled" boolean DEFAULT false NOT NULL,
	"invoice_payments_enabled" boolean DEFAULT false NOT NULL,
	"deposit_due_timing" text DEFAULT 'with_approval' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"label" text,
	"provider" text DEFAULT 'twilio',
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_phone_numbers_phone_e164_unique" UNIQUE("phone_e164")
);
--> statement-breakpoint
CREATE TABLE "estimate_number_sequences" (
	"company_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "estimate_number_sequences_company_id_year_pk" PRIMARY KEY("company_id","year")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"key" text NOT NULL,
	"value" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_number_sequences" (
	"company_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invoice_number_sequences_company_id_year_pk" PRIMARY KEY("company_id","year")
);
--> statement-breakpoint
CREATE TABLE "webhook_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_type" text,
	"external_event_id" text,
	"payload_json" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by_user_id" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"payload_json" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"provider" text NOT NULL,
	"external_account_id" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"config_json" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"hashed_pw" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"clerk_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"scope" text DEFAULT 'company' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"role" text DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"title" text NOT NULL,
	"color" text DEFAULT '#6b7280',
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"customer_id" uuid,
	"lead_id" uuid,
	"job_id" uuid,
	"customer_name" text,
	"phone_number" text NOT NULL,
	"duration_seconds" integer DEFAULT 0,
	"status" text DEFAULT 'completed',
	"transcript" text,
	"ai_summary" text,
	"outcome" text,
	"recording" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"address" text,
	"notes" text,
	"email_opt_in" boolean DEFAULT true NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"lead_id" uuid,
	"customer_id" uuid,
	"plumber_id" uuid,
	"status" text DEFAULT 'scheduled',
	"type" text NOT NULL,
	"description" text,
	"scheduled_date" text,
	"scheduled_time" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"estimated_price" real,
	"final_price" real,
	"notes" text,
	"source_estimate_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"customer_id" uuid,
	"plumber_id" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'new',
	"priority" integer DEFAULT 3,
	"issue" text NOT NULL,
	"description" text,
	"location" text,
	"ai_qualification" text,
	"ai_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plumbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'plumber',
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plumbers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"line_total_cents" integer DEFAULT 0 NOT NULL,
	"catalog_service_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"customer_id" uuid,
	"job_id" uuid,
	"invoice_number" text NOT NULL,
	"service_type" text,
	"status" text DEFAULT 'pending',
	"amount" real NOT NULL,
	"tax" real DEFAULT 0,
	"total" real NOT NULL,
	"amount_cents" integer,
	"tax_cents" integer,
	"total_cents" integer,
	"public_pay_token" text NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text,
	"paid_date" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoices_public_pay_token_unique" UNIQUE("public_pay_token")
);
--> statement-breakpoint
CREATE TABLE "estimate_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" text,
	"actor_type" text DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_catalog_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"delivery_type" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"body_snapshot" text,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category" text,
	"name" text NOT NULL,
	"description" text,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'ea' NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"total_price_cents" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"option_group" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"logo_url" text,
	"accent_color" text,
	"estimate_footer_text" text,
	"default_terms_text" text,
	"default_expiration_days" integer DEFAULT 30 NOT NULL,
	"default_tax_rate_basis_points" integer,
	"estimate_prefix" text DEFAULT 'EST' NOT NULL,
	"default_deposit_enabled" boolean DEFAULT false NOT NULL,
	"default_deposit_percent_basis_points" integer,
	"customer_signature_required" boolean DEFAULT false NOT NULL,
	"allow_customer_reject" boolean DEFAULT true NOT NULL,
	"public_approval_requires_token" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_settings_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"estimate_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"customer_id" uuid,
	"lead_id" uuid,
	"job_id" uuid,
	"receptionist_call_id" uuid,
	"source_type" text,
	"source_id" text,
	"created_by_plumber_id" uuid,
	"assigned_to_plumber_id" uuid,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_amount_cents" integer DEFAULT 0 NOT NULL,
	"discount_amount_cents" integer DEFAULT 0 NOT NULL,
	"tax_amount_cents" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"deposit_amount_cents" integer,
	"company_name_snapshot" text NOT NULL,
	"company_email_snapshot" text,
	"company_phone_snapshot" text,
	"company_address_snapshot" text,
	"customer_name_snapshot" text NOT NULL,
	"customer_email_snapshot" text,
	"customer_phone_snapshot" text,
	"service_address_snapshot" text,
	"notes_internal" text,
	"notes_customer" text,
	"expiration_date" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"converted_to_job_id" uuid,
	"deposit_status" text DEFAULT 'none' NOT NULL,
	"deposit_paid_at" timestamp with time zone,
	"customer_public_token" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"parent_estimate_id" uuid,
	"selected_option_group" text,
	"tax_rate_basis_points" integer,
	"signature_attachment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimates_estimate_number_unique" UNIQUE("estimate_number"),
	CONSTRAINT "estimates_customer_public_token_unique" UNIQUE("customer_public_token")
);
--> statement-breakpoint
CREATE TABLE "receptionist_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"booking_type" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_window_start" text,
	"requested_window_end" text,
	"scheduled_start" text,
	"scheduled_end" text,
	"notes" text,
	"assigned_to" text,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"branch_id" uuid,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_call_id" text,
	"twilio_call_sid" text,
	"provider_agent_id" text,
	"provider_status" text,
	"direction" text DEFAULT 'inbound' NOT NULL,
	"from_phone" text,
	"to_phone" text,
	"caller_name" text,
	"status" text DEFAULT 'mock' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0,
	"transcript_text" text,
	"ai_summary" text,
	"extracted_json" text,
	"recommended_next_step" text,
	"disposition" text,
	"urgency" text,
	"lead_id" uuid,
	"job_id" uuid,
	"appointment_id" text,
	"call_log_id" uuid,
	"recording_url" text,
	"raw_provider_payload_json" text,
	"mock_scenario_id" uuid,
	"current_transcript_index" integer DEFAULT 0 NOT NULL,
	"receptionist_meta_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" text,
	"source" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_mock_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"transcript_script_json" text NOT NULL,
	"expected_outcome" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"company_name" text,
	"greeting" text,
	"disclosure_enabled" boolean DEFAULT true NOT NULL,
	"recording_enabled" boolean DEFAULT false NOT NULL,
	"business_hours_json" text,
	"after_hours_mode" text DEFAULT 'message_and_callback',
	"allowed_actions_json" text,
	"emergency_keywords_json" text,
	"booking_rules_json" text,
	"default_call_outcome_rules_json" text,
	"provider_type" text DEFAULT 'mock' NOT NULL,
	"provider_config_json" text,
	"internal_instructions" text,
	"callback_booking_enabled" boolean DEFAULT true NOT NULL,
	"quote_visit_booking_enabled" boolean DEFAULT true NOT NULL,
	"retell_agent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_staff_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"details_json" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_to_plumber_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_tool_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"request_json" text,
	"response_json" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receptionist_transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"speaker" text NOT NULL,
	"text" text NOT NULL,
	"timestamp_ms" integer,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stripe_dispute_id" text NOT NULL,
	"payment_id" uuid,
	"amount_cents" integer NOT NULL,
	"reason" text,
	"status" text NOT NULL,
	"evidence_due_by" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_stripe_dispute_id_unique" UNIQUE("stripe_dispute_id")
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payment_id" uuid,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" text,
	CONSTRAINT "payment_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"stripe_account_id" text,
	"amount_cents" integer NOT NULL,
	"refunded_amount_cents" integer DEFAULT 0 NOT NULL,
	"application_fee_cents" integer DEFAULT 0,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_email" text,
	"payment_url" text,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"size_bytes" integer,
	"uploaded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"template_key" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"body" text,
	"provider" text,
	"provider_message_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"entity_type" text,
	"entity_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_contract_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"scheduled_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"materialized_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"cadence" text NOT NULL,
	"active" text DEFAULT 'true' NOT NULL,
	"last_materialized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_payment_settings" ADD CONSTRAINT "company_payment_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_phone_numbers" ADD CONSTRAINT "company_phone_numbers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_number_sequences" ADD CONSTRAINT "estimate_number_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_number_sequences" ADD CONSTRAINT "invoice_number_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buckets" ADD CONSTRAINT "buckets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_plumber_id_plumbers_id_fk" FOREIGN KEY ("plumber_id") REFERENCES "public"."plumbers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_plumber_id_plumbers_id_fk" FOREIGN KEY ("plumber_id") REFERENCES "public"."plumbers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plumbers" ADD CONSTRAINT "plumbers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plumbers" ADD CONSTRAINT "plumbers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_activity" ADD CONSTRAINT "estimate_activity_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_catalog_services" ADD CONSTRAINT "estimate_catalog_services_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_delivery" ADD CONSTRAINT "estimate_delivery_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_settings" ADD CONSTRAINT "estimate_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_created_by_plumber_id_plumbers_id_fk" FOREIGN KEY ("created_by_plumber_id") REFERENCES "public"."plumbers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_assigned_to_plumber_id_plumbers_id_fk" FOREIGN KEY ("assigned_to_plumber_id") REFERENCES "public"."plumbers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_converted_to_job_id_jobs_id_fk" FOREIGN KEY ("converted_to_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_bookings" ADD CONSTRAINT "receptionist_bookings_call_id_receptionist_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."receptionist_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_bookings" ADD CONSTRAINT "receptionist_bookings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_calls" ADD CONSTRAINT "receptionist_calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_calls" ADD CONSTRAINT "receptionist_calls_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_calls" ADD CONSTRAINT "receptionist_calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_calls" ADD CONSTRAINT "receptionist_calls_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_calls" ADD CONSTRAINT "receptionist_calls_call_log_id_call_logs_id_fk" FOREIGN KEY ("call_log_id") REFERENCES "public"."call_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_events" ADD CONSTRAINT "receptionist_events_call_id_receptionist_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."receptionist_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_mock_scenarios" ADD CONSTRAINT "receptionist_mock_scenarios_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_settings" ADD CONSTRAINT "receptionist_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_staff_tasks" ADD CONSTRAINT "receptionist_staff_tasks_call_id_receptionist_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."receptionist_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_staff_tasks" ADD CONSTRAINT "receptionist_staff_tasks_assigned_to_plumber_id_plumbers_id_fk" FOREIGN KEY ("assigned_to_plumber_id") REFERENCES "public"."plumbers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_tool_invocations" ADD CONSTRAINT "receptionist_tool_invocations_call_id_receptionist_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."receptionist_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptionist_transcript_segments" ADD CONSTRAINT "receptionist_transcript_segments_call_id_receptionist_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."receptionist_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contract_schedules" ADD CONSTRAINT "service_contract_schedules_contract_id_service_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."service_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_branches_company_id" ON "branches" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_branches_company_primary" ON "branches" USING btree ("company_id") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "idx_company_phone_numbers_company" ON "company_phone_numbers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feature_flags_company_key" ON "feature_flags" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "idx_webhook_failures_status" ON "webhook_failures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_failures_provider" ON "webhook_failures" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_api_keys_company_id" ON "api_keys" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_branch_id" ON "api_keys" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_company_id" ON "audit_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_branch_id" ON "audit_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_integration_connections_company_id" ON "integration_connections" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_integration_connections_branch_id" ON "integration_connections" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_portal_users_email" ON "portal_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_portal_users_clerk_user_id" ON "portal_users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_scope_unique" ON "role_permissions" USING btree ("role","permission","scope");--> statement-breakpoint
CREATE INDEX "idx_user_memberships_user_id" ON "user_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_memberships_company_id" ON "user_memberships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_buckets_company" ON "buckets" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_buckets_company_position" ON "buckets" USING btree ("company_id","position");--> statement-breakpoint
CREATE INDEX "idx_call_logs_company_id" ON "call_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_call_logs_created_at" ON "call_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_customers_company_id" ON "customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_customers_company_phone" ON "customers" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "idx_jobs_company_id" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_customer_id" ON "jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_lead_id" ON "jobs" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_leads_company_id" ON "leads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_leads_customer_id" ON "leads" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_leads_status" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_plumbers_company_id" ON "plumbers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_company_id" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_customer_id" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_job_id" ON "invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_estimate_activity_estimate" ON "estimate_activity" USING btree ("estimate_id");--> statement-breakpoint
CREATE INDEX "idx_estimate_catalog_services_company" ON "estimate_catalog_services" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_estimate_delivery_estimate" ON "estimate_delivery" USING btree ("estimate_id");--> statement-breakpoint
CREATE INDEX "idx_estimate_line_items_estimate" ON "estimate_line_items" USING btree ("estimate_id");--> statement-breakpoint
CREATE INDEX "idx_estimates_company" ON "estimates" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_estimates_status" ON "estimates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_estimates_customer" ON "estimates" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_estimates_lead" ON "estimates" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_estimates_job" ON "estimates" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_estimates_receptionist_call" ON "estimates" USING btree ("receptionist_call_id");--> statement-breakpoint
CREATE INDEX "idx_estimates_created" ON "estimates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_receptionist_bookings_call" ON "receptionist_bookings" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_receptionist_calls_company" ON "receptionist_calls" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_receptionist_calls_created_at" ON "receptionist_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_receptionist_calls_status" ON "receptionist_calls" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receptionist_calls_twilio_sid" ON "receptionist_calls" USING btree ("twilio_call_sid");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receptionist_calls_provider_call_id" ON "receptionist_calls" USING btree ("provider_call_id");--> statement-breakpoint
CREATE INDEX "idx_receptionist_events_call" ON "receptionist_events" USING btree ("call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receptionist_settings_company" ON "receptionist_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_receptionist_staff_tasks_call" ON "receptionist_staff_tasks" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_receptionist_staff_tasks_status" ON "receptionist_staff_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_receptionist_tool_call" ON "receptionist_tool_invocations" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_receptionist_segments_call" ON "receptionist_transcript_segments" USING btree ("call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receptionist_segments_call_seq" ON "receptionist_transcript_segments" USING btree ("call_id","seq");--> statement-breakpoint
CREATE INDEX "idx_disputes_company_id" ON "disputes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_payments_company_id" ON "payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_payments_source" ON "payments" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_payments_checkout_session" ON "payments" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_company" ON "attachments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_entity" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_company" ON "notifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_entity" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_status" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_contract_schedules_contract" ON "service_contract_schedules" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_service_contracts_company" ON "service_contracts" USING btree ("company_id");