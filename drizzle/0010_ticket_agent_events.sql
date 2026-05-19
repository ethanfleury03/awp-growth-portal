DO $$
BEGIN
  IF to_regclass('public.admin_tickets') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS "ticket_agent_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "ticket_id" uuid NOT NULL REFERENCES "admin_tickets"("id") ON DELETE CASCADE,
      "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
      "event_type" text NOT NULL,
      "idempotency_key" text NOT NULL UNIQUE,
      "delivery_status" text NOT NULL DEFAULT 'pending',
      "attempt_count" integer NOT NULL DEFAULT 0,
      "payload_json" text NOT NULL,
      "last_error" text,
      "router_response_json" text,
      "delivered_at" timestamp with time zone,
      "next_attempt_at" timestamp with time zone,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "updated_at" timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "idx_ticket_agent_events_status"
      ON "ticket_agent_events" ("delivery_status", "next_attempt_at", "created_at");
    CREATE INDEX IF NOT EXISTS "idx_ticket_agent_events_ticket"
      ON "ticket_agent_events" ("ticket_id", "created_at");
    CREATE INDEX IF NOT EXISTS "idx_ticket_agent_events_company"
      ON "ticket_agent_events" ("company_id", "created_at");

    ALTER TABLE "ticket_agent_events" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ticket_agent_events" FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_select ON "ticket_agent_events";
    CREATE POLICY tenant_isolation_select ON "ticket_agent_events" FOR SELECT USING (
      app_is_super_admin() OR company_id = app_current_company()
    );

    DROP POLICY IF EXISTS tenant_isolation_mod ON "ticket_agent_events";
    CREATE POLICY tenant_isolation_mod ON "ticket_agent_events" FOR ALL USING (
      app_is_super_admin() OR company_id = app_current_company()
    ) WITH CHECK (
      app_is_super_admin() OR company_id = app_current_company()
    );
  END IF;
END
$$;
