-- Row-level security policies for tenant-scoped tables.
--
-- Enforced by `withTenant(companyId, fn)` in src/db/index.ts, which runs
--   SET LOCAL app.company_id = $1
-- at the start of every request transaction. Super-admin work runs through
-- `withSuperAdmin(fn)` which sets `app.role = 'super_admin'`.
--
-- Tables without `company_id` (e.g. payment_events, role_permissions) do not
-- get RLS; they either have no tenant data or are scoped by another column.

-- Helper: bypass for super-admin role.
CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.role', true), '') = 'super_admin';
$$ LANGUAGE sql STABLE;

-- Helper: current tenant (or NULL when unset).
CREATE OR REPLACE FUNCTION app_current_company() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'branches',
    'company_phone_numbers',
    'company_payment_settings',
    'invoice_number_sequences',
    'estimate_number_sequences',
    'feature_flags',
    'user_memberships',
    'audit_logs',
    'api_keys',
    'integration_connections',
    'plumbers',
    'customers',
    'buckets',
    'leads',
    'jobs',
    'call_logs',
    'invoices',
    'estimate_settings',
    'estimates',
    'estimate_catalog_services',
    'receptionist_settings',
    'receptionist_calls',
    'receptionist_mock_scenarios',
    'payments',
    'disputes',
    'attachments',
    'notifications',
    'service_contracts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_select ON %I;
       CREATE POLICY tenant_isolation_select ON %I FOR SELECT USING (
         app_is_super_admin() OR company_id = app_current_company()
       );',
      tbl, tbl
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation_mod ON %I;
       CREATE POLICY tenant_isolation_mod ON %I FOR ALL USING (
         app_is_super_admin() OR company_id = app_current_company()
       ) WITH CHECK (
         app_is_super_admin() OR company_id = app_current_company()
       );',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- Child tables scoped via a parent with company_id.
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_select ON invoice_line_items;
CREATE POLICY tenant_isolation_select ON invoice_line_items FOR SELECT USING (
  app_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.company_id = app_current_company()
  )
);
DROP POLICY IF EXISTS tenant_isolation_mod ON invoice_line_items;
CREATE POLICY tenant_isolation_mod ON invoice_line_items FOR ALL USING (
  app_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.company_id = app_current_company()
  )
) WITH CHECK (
  app_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.company_id = app_current_company()
  )
);

ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_select ON estimate_line_items;
CREATE POLICY tenant_isolation_select ON estimate_line_items FOR SELECT USING (
  app_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM estimates e
    WHERE e.id = estimate_line_items.estimate_id
      AND e.company_id = app_current_company()
  )
);
DROP POLICY IF EXISTS tenant_isolation_mod ON estimate_line_items;
CREATE POLICY tenant_isolation_mod ON estimate_line_items FOR ALL USING (
  app_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM estimates e
    WHERE e.id = estimate_line_items.estimate_id
      AND e.company_id = app_current_company()
  )
) WITH CHECK (
  app_is_super_admin()
  OR EXISTS (
    SELECT 1 FROM estimates e
    WHERE e.id = estimate_line_items.estimate_id
      AND e.company_id = app_current_company()
  )
);
