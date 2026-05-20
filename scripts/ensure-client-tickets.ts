import { sql, withSuperAdminContext } from '../src/lib/db';

async function ensureTicketSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
      branch_id uuid REFERENCES branches(id) ON DELETE set null,
      created_by_user_id text,
      created_by_name text,
      created_by_email text,
      title text NOT NULL,
      description text NOT NULL,
      category text DEFAULT 'general' NOT NULL,
      priority text DEFAULT 'normal' NOT NULL,
      status text DEFAULT 'open' NOT NULL,
      assigned_to_user_id text,
      discord_message_id text,
      notification_error text,
      discord_notified_at timestamp with time zone,
      solution_summary text,
      solution_details text,
      solution_source text,
      solution_external_id text,
      solution_reported_at timestamp with time zone,
      last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
      resolved_at timestamp with time zone,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution_summary text`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution_details text`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution_source text`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution_external_id text`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS solution_reported_at timestamp with time zone`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_company ON tickets(company_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_company_status ON tickets(company_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tickets_company_activity ON tickets(company_id, last_activity_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE cascade,
      company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
      author_user_id text,
      author_role text DEFAULT 'viewer' NOT NULL,
      author_name text,
      author_email text,
      body text NOT NULL,
      is_internal boolean DEFAULT false NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ticket_comments_company_ticket ON ticket_comments(company_id, ticket_id)`;
}

async function ensureTicketRls() {
  await sql`
    CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
      SELECT COALESCE(current_setting('app.role', true), '') = 'super_admin';
    $$ LANGUAGE sql STABLE
  `;
  await sql`
    CREATE OR REPLACE FUNCTION app_current_company() RETURNS uuid AS $$
      SELECT NULLIF(current_setting('app.company_id', true), '')::uuid;
    $$ LANGUAGE sql STABLE
  `;

  await sql`ALTER TABLE tickets ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE tickets FORCE ROW LEVEL SECURITY`;
  await sql`DROP POLICY IF EXISTS tenant_isolation_select ON tickets`;
  await sql`
    CREATE POLICY tenant_isolation_select ON tickets FOR SELECT USING (
      app_is_super_admin() OR company_id = app_current_company()
    )
  `;
  await sql`DROP POLICY IF EXISTS tenant_isolation_mod ON tickets`;
  await sql`
    CREATE POLICY tenant_isolation_mod ON tickets FOR ALL USING (
      app_is_super_admin() OR company_id = app_current_company()
    ) WITH CHECK (
      app_is_super_admin() OR company_id = app_current_company()
    )
  `;

  await sql`ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE ticket_comments FORCE ROW LEVEL SECURITY`;
  await sql`DROP POLICY IF EXISTS tenant_isolation_select ON ticket_comments`;
  await sql`
    CREATE POLICY tenant_isolation_select ON ticket_comments FOR SELECT USING (
      app_is_super_admin() OR company_id = app_current_company()
    )
  `;
  await sql`DROP POLICY IF EXISTS tenant_isolation_mod ON ticket_comments`;
  await sql`
    CREATE POLICY tenant_isolation_mod ON ticket_comments FOR ALL USING (
      app_is_super_admin() OR company_id = app_current_company()
    ) WITH CHECK (
      app_is_super_admin() OR company_id = app_current_company()
    )
  `;
}

async function enableTicketModule() {
  await sql`
    INSERT INTO feature_flags (company_id, key, value, flag_key, enabled, payload_json)
    SELECT id, 'module.tickets', 'true', 'module.tickets', true, NULL
    FROM companies
    ON CONFLICT (company_id, flag_key) DO UPDATE SET
      key = excluded.key,
      value = excluded.value,
      enabled = true,
      updated_at = datetime('now')
  `;
}

async function verifyTicketSchema() {
  const rows = await sql`
    SELECT
      to_regclass('public.tickets') AS tickets,
      to_regclass('public.ticket_comments') AS ticket_comments,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tickets'
          AND column_name = 'solution_reported_at'
      ) AS has_solution_columns
  `;
  const row = rows[0] as {
    tickets?: string | null;
    ticket_comments?: string | null;
    has_solution_columns?: boolean | number | null;
  } | undefined;
  if (!row?.tickets || !row?.ticket_comments || !row?.has_solution_columns) {
    throw new Error('Ticket schema verification failed.');
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for ticket schema setup.');
  }

  await withSuperAdminContext(async () => {
    await ensureTicketSchema();
    await ensureTicketRls();
    await enableTicketModule();
    await verifyTicketSchema();
  });

  console.log('[ensure-client-tickets] Ticket schema and module flag are ready.');
}

main().catch((error) => {
  console.error('[ensure-client-tickets] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
