-- WNY Automation Portal SQLite schema (dev / committed DB)
-- uuid() is registered by the app via better-sqlite3 before queries run.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  stripe_customer_id TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  address TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_branches_company_id ON branches(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_company_primary
  ON branches(company_id)
  WHERE is_primary = 1;

CREATE TABLE IF NOT EXISTS user_memberships (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_company_id ON user_memberships(company_id);

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'company',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(role, permission, scope)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_by_user_id TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_branch_id ON api_keys(branch_id);

CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config_json TEXT,
  last_synced_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_company_id
  ON integration_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_branch_id
  ON integration_connections(branch_id);

CREATE TABLE IF NOT EXISTS invoice_number_sequences (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);

CREATE TABLE IF NOT EXISTS plumbers (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT DEFAULT 'plumber',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS buckets (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  priority INTEGER DEFAULT 3,
  issue TEXT NOT NULL,
  description TEXT,
  location TEXT,
  ai_qualification TEXT,
  ai_score INTEGER,
  lead_context_json TEXT,
  next_follow_up_at TEXT,
  last_contacted_at TEXT,
  estimated_value_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS growth_records (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  source_key TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idea',
  owner TEXT,
  related_record_id TEXT,
  payload_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_ticket_buckets (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2f6b4f',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_tickets (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  bucket_id TEXT NOT NULL REFERENCES admin_ticket_buckets(id) ON DELETE RESTRICT,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES growth_records(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  requester_email TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  due_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_ticket_comments (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  ticket_id TEXT NOT NULL REFERENCES admin_tickets(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_user_id TEXT,
  author_role TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'scheduled',
  type TEXT NOT NULL,
  description TEXT,
  scheduled_date TEXT,
  scheduled_time TEXT,
  started_at TEXT,
  completed_at TEXT,
  estimated_price REAL,
  final_price REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  service_type TEXT,
  status TEXT DEFAULT 'pending',
  amount REAL NOT NULL,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  amount_cents INTEGER,
  tax_cents INTEGER,
  total_cents INTEGER,
  public_pay_token TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))) UNIQUE,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  paid_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  catalog_service_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  customer_name TEXT,
  phone_number TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  transcript TEXT,
  ai_summary TEXT,
  outcome TEXT,
  recording INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_buckets_company ON buckets(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buckets_company_position ON buckets(company_id, position);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_growth_records_company_type ON growth_records(company_id, record_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_records_source_key
  ON growth_records(company_id, record_type, source_key)
  WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_ticket_buckets_active
  ON admin_ticket_buckets(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_admin_tickets_bucket_order
  ON admin_tickets(bucket_id, sort_order, updated_at);
CREATE INDEX IF NOT EXISTS idx_admin_tickets_company
  ON admin_tickets(company_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_admin_tickets_project
  ON admin_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_admin_ticket_comments_ticket_created
  ON admin_ticket_comments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_ticket_comments_company_created
  ON admin_ticket_comments(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_company_id ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);

-- AI Receptionist (see docs/RECEPTIONIST.md)
CREATE TABLE IF NOT EXISTS receptionist_mock_scenarios (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  transcript_script_json TEXT NOT NULL,
  expected_outcome TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receptionist_settings (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_name TEXT,
  greeting TEXT,
  disclosure_enabled INTEGER NOT NULL DEFAULT 1,
  recording_enabled INTEGER NOT NULL DEFAULT 0,
  business_hours_json TEXT,
  after_hours_mode TEXT DEFAULT 'message_and_callback',
  allowed_actions_json TEXT,
  emergency_keywords_json TEXT,
  booking_rules_json TEXT,
  default_call_outcome_rules_json TEXT,
  provider_type TEXT NOT NULL DEFAULT 'mock',
  provider_config_json TEXT,
  internal_instructions TEXT,
  callback_booking_enabled INTEGER NOT NULL DEFAULT 1,
  quote_visit_booking_enabled INTEGER NOT NULL DEFAULT 1,
  retell_agent_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receptionist_calls (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_call_id TEXT,
  twilio_call_sid TEXT,
  provider_agent_id TEXT,
  provider_status TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  from_phone TEXT,
  to_phone TEXT,
  caller_name TEXT,
  status TEXT NOT NULL DEFAULT 'mock',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_seconds INTEGER DEFAULT 0,
  transcript_text TEXT,
  ai_summary TEXT,
  extracted_json TEXT,
  recommended_next_step TEXT,
  disposition TEXT,
  urgency TEXT,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  appointment_id TEXT,
  call_log_id TEXT REFERENCES call_logs(id) ON DELETE SET NULL,
  recording_url TEXT,
  raw_provider_payload_json TEXT,
  mock_scenario_id TEXT,
  current_transcript_index INTEGER NOT NULL DEFAULT 0,
  receptionist_meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receptionist_transcript_segments (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp_ms INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(call_id, seq)
);

CREATE TABLE IF NOT EXISTS receptionist_events (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receptionist_tool_invocations (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  request_json TEXT,
  response_json TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receptionist_bookings (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  requested_window_start TEXT,
  requested_window_end TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  notes TEXT,
  assigned_to TEXT,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_receptionist_calls_created_at ON receptionist_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_receptionist_calls_status ON receptionist_calls(status);
CREATE INDEX IF NOT EXISTS idx_receptionist_segments_call ON receptionist_transcript_segments(call_id);
CREATE INDEX IF NOT EXISTS idx_receptionist_events_call ON receptionist_events(call_id);
CREATE INDEX IF NOT EXISTS idx_receptionist_bookings_call ON receptionist_bookings(call_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receptionist_calls_twilio_sid ON receptionist_calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receptionist_calls_provider_call_id ON receptionist_calls(provider_call_id) WHERE provider_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receptionist_tool_call ON receptionist_tool_invocations(call_id);

CREATE TABLE IF NOT EXISTS receptionist_staff_tasks (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  call_id TEXT NOT NULL REFERENCES receptionist_calls(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  details_json TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to_plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_receptionist_staff_tasks_call ON receptionist_staff_tasks(call_id);
CREATE INDEX IF NOT EXISTS idx_receptionist_staff_tasks_status ON receptionist_staff_tasks(status);

-- Estimates / Quotes (see docs/ESTIMATES.md)
CREATE TABLE IF NOT EXISTS estimate_number_sequences (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, year)
);

CREATE TABLE IF NOT EXISTS estimate_settings (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT,
  estimate_footer_text TEXT,
  default_terms_text TEXT,
  default_expiration_days INTEGER NOT NULL DEFAULT 30,
  default_tax_rate_basis_points INTEGER,
  estimate_prefix TEXT NOT NULL DEFAULT 'EST',
  default_deposit_enabled INTEGER NOT NULL DEFAULT 0,
  default_deposit_percent_basis_points INTEGER,
  customer_signature_required INTEGER NOT NULL DEFAULT 0,
  allow_customer_reject INTEGER NOT NULL DEFAULT 1,
  public_approval_requires_token INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estimates (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  receptionist_call_id TEXT REFERENCES receptionist_calls(id) ON DELETE SET NULL,
  source_type TEXT,
  source_id TEXT,
  created_by_plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
  assigned_to_plumber_id TEXT REFERENCES plumbers(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_amount_cents INTEGER NOT NULL DEFAULT 0,
  discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  deposit_amount_cents INTEGER,
  company_name_snapshot TEXT NOT NULL,
  company_email_snapshot TEXT,
  company_phone_snapshot TEXT,
  company_address_snapshot TEXT,
  customer_name_snapshot TEXT NOT NULL,
  customer_email_snapshot TEXT,
  customer_phone_snapshot TEXT,
  service_address_snapshot TEXT,
  notes_internal TEXT,
  notes_customer TEXT,
  expiration_date TEXT,
  sent_at TEXT,
  viewed_at TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  expired_at TEXT,
  converted_to_job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  deposit_status TEXT NOT NULL DEFAULT 'none',
  deposit_paid_at TEXT,
  customer_public_token TEXT NOT NULL UNIQUE,
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_estimate_id TEXT,
  selected_option_group TEXT,
  tax_rate_basis_points INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estimate_line_items (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  name TEXT NOT NULL,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'ea',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_price_cents INTEGER NOT NULL DEFAULT 0,
  is_optional INTEGER NOT NULL DEFAULT 0,
  is_taxable INTEGER NOT NULL DEFAULT 1,
  option_group TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estimate_activity (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estimate_delivery (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  estimate_id TEXT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body_snapshot TEXT,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  failed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estimate_catalog_services (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_estimate_catalog_services_company ON estimate_catalog_services(company_id);

CREATE INDEX IF NOT EXISTS idx_estimates_company ON estimates(company_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_lead ON estimates(lead_id);
CREATE INDEX IF NOT EXISTS idx_estimates_job ON estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_estimates_receptionist_call ON estimates(receptionist_call_id);
CREATE INDEX IF NOT EXISTS idx_estimates_created ON estimates(created_at);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate ON estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_activity_estimate ON estimate_activity(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_delivery_estimate ON estimate_delivery(estimate_id);

-- Online payments (Stripe Checkout; platform account — see docs/STRIPE_PAYMENTS_ROLLOUT.md)
CREATE TABLE IF NOT EXISTS company_payment_settings (
  company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  online_payments_enabled INTEGER NOT NULL DEFAULT 0,
  estimate_deposits_enabled INTEGER NOT NULL DEFAULT 0,
  invoice_payments_enabled INTEGER NOT NULL DEFAULT 0,
  deposit_due_timing TEXT NOT NULL DEFAULT 'with_approval',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  payment_url TEXT,
  paid_at TEXT,
  failed_at TEXT,
  refunded_at TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_session ON payments(stripe_checkout_session_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY NOT NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  clerk_user_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT,
  price_id TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'incomplete',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  trial_ends_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_company
  ON billing_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
  ON billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_usage_periods (
  id TEXT PRIMARY KEY DEFAULT (uuid()) NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT NOT NULL,
  stripe_invoice_id TEXT,
  stripe_invoice_item_id TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  provider_cost_usd TEXT NOT NULL DEFAULT '0',
  multiplier TEXT NOT NULL DEFAULT '2',
  charge_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stripe_subscription_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_company
  ON billing_usage_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_invoice
  ON billing_usage_periods(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_periods_status
  ON billing_usage_periods(status);
