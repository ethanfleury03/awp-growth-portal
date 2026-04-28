from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent.parent / "data" / "plumberos.db"
NOW = "2026-04-21 09:00:00"


def ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON")

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS service_contracts (
          id TEXT PRIMARY KEY NOT NULL,
          company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          cadence TEXT NOT NULL,
          price_cents INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          next_due_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS service_contract_schedules (
          id TEXT PRIMARY KEY NOT NULL,
          contract_id TEXT NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
          scheduled_for TEXT NOT NULL,
          job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS company_payment_settings (
          company_id TEXT PRIMARY KEY NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          online_payments_enabled INTEGER NOT NULL DEFAULT 0,
          estimate_deposits_enabled INTEGER NOT NULL DEFAULT 0,
          invoice_payments_enabled INTEGER NOT NULL DEFAULT 0,
          deposit_due_timing TEXT NOT NULL DEFAULT 'with_approval',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY NOT NULL,
          company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          actor_user_id TEXT,
          actor_email TEXT,
          actor_role TEXT,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          summary TEXT,
          metadata TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    ensure_column(conn, "customers", "portal_token", "portal_token TEXT")
    ensure_column(conn, "customers", "email_opt_in", "email_opt_in INTEGER NOT NULL DEFAULT 1")
    ensure_column(conn, "customers", "sms_opt_in", "sms_opt_in INTEGER NOT NULL DEFAULT 1")
    ensure_column(conn, "customers", "sms_opt_out_at", "sms_opt_out_at TEXT")

    ensure_column(conn, "jobs", "scheduled_at", "scheduled_at TEXT")
    conn.execute(
        """
        UPDATE jobs
        SET scheduled_at = CASE
          WHEN scheduled_at IS NOT NULL THEN scheduled_at
          WHEN scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL THEN scheduled_date || ' ' || scheduled_time || ':00'
          WHEN scheduled_date IS NOT NULL THEN scheduled_date || ' 09:00:00'
          ELSE NULL
        END
        """
    )

    ensure_column(conn, "companies", "stripe_account_id", "stripe_account_id TEXT")
    ensure_column(conn, "companies", "stripe_connect_status", "stripe_connect_status TEXT DEFAULT 'pending'")
    ensure_column(conn, "companies", "stripe_onboarding_completed_at", "stripe_onboarding_completed_at TEXT")
    ensure_column(conn, "companies", "twilio_phone_number", "twilio_phone_number TEXT")

    ensure_column(conn, "payments", "stripe_account_id", "stripe_account_id TEXT")
    ensure_column(conn, "payments", "refunded_amount_cents", "refunded_amount_cents INTEGER NOT NULL DEFAULT 0")
    ensure_column(conn, "payments", "application_fee_cents", "application_fee_cents INTEGER")


def fetchone_value(conn: sqlite3.Connection, query: str, params: tuple = ()) -> str | None:
    row = conn.execute(query, params).fetchone()
    return None if row is None else row[0]


def get_or_create_company(conn: sqlite3.Connection) -> str:
    company_id = fetchone_value(conn, "SELECT id FROM companies ORDER BY created_at ASC LIMIT 1")
    if company_id:
        return company_id
    company_id = "demo-company-001"
    conn.execute(
        """
        INSERT INTO companies (
          id, name, email, phone, address, subscription_tier, subscription_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            company_id,
            "Demo Plumbing Co.",
            "demo@plumberos.com",
            "(555) 010-0000",
            "123 Main St, Brooklyn, NY",
            "pro",
            "active",
            NOW,
            NOW,
        ),
    )
    return company_id


def get_or_create_branch(conn: sqlite3.Connection, company_id: str) -> str:
    branch_id = fetchone_value(
        conn,
        "SELECT id FROM branches WHERE company_id = ? ORDER BY is_primary DESC, created_at ASC LIMIT 1",
        (company_id,),
    )
    if branch_id:
        return branch_id
    branch_id = "demo-branch-main"
    conn.execute(
        """
        INSERT INTO branches (
          id, company_id, name, code, phone, address, is_primary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            branch_id,
            company_id,
            "Main",
            "BK-01",
            "(555) 010-0000",
            "123 Main St, Brooklyn, NY",
            NOW,
            NOW,
        ),
    )
    return branch_id


def cleanup_old_demo_rows(conn: sqlite3.Connection) -> None:
    tables = [
        "service_contract_schedules",
        "service_contracts",
        "payment_events",
        "payments",
        "invoice_line_items",
        "invoices",
        "estimate_delivery",
        "estimate_activity",
        "estimate_line_items",
        "estimates",
        "estimate_catalog_services",
        "audit_events",
        "jobs",
        "leads",
        "customers",
        "plumbers",
    ]
    for table in tables:
        try:
            conn.execute(f"DELETE FROM {table} WHERE id LIKE 'demo-%'")
        except sqlite3.OperationalError:
            continue


def insert_many(conn: sqlite3.Connection, sql_text: str, rows: list[tuple]) -> None:
    conn.executemany(sql_text, rows)


def seed_company_settings(conn: sqlite3.Connection, company_id: str) -> None:
    conn.execute(
        """
        UPDATE companies
        SET
          phone = COALESCE(phone, '(555) 010-0000'),
          address = COALESCE(address, '123 Main St, Brooklyn, NY'),
          subscription_tier = COALESCE(subscription_tier, 'pro'),
          subscription_status = COALESCE(subscription_status, 'active'),
          stripe_account_id = COALESCE(stripe_account_id, 'acct_demo_plumberos'),
          stripe_connect_status = COALESCE(stripe_connect_status, 'ready'),
          stripe_onboarding_completed_at = COALESCE(stripe_onboarding_completed_at, '2026-04-10 10:15:00'),
          twilio_phone_number = COALESCE(twilio_phone_number, '+17163042922'),
          updated_at = ?
        WHERE id = ?
        """,
        (NOW, company_id),
    )
    conn.execute(
        """
        INSERT INTO company_payment_settings (
          company_id, online_payments_enabled, estimate_deposits_enabled,
          invoice_payments_enabled, deposit_due_timing, created_at, updated_at
        ) VALUES (?, 1, 1, 1, 'with_approval', ?, ?)
        ON CONFLICT(company_id) DO UPDATE SET
          online_payments_enabled = 1,
          estimate_deposits_enabled = 1,
          invoice_payments_enabled = 1,
          deposit_due_timing = 'with_approval',
          updated_at = excluded.updated_at
        """,
        (company_id, NOW, NOW),
    )


def seed_operational_data(conn: sqlite3.Connection, company_id: str, branch_id: str) -> None:
    plumbers = [
        ("demo-plumber-001", "Carlos Mendez", "carlos@plumberos.demo", "(718) 555-0131", "Drain Specialist"),
        ("demo-plumber-002", "Maya Patel", "maya@plumberos.demo", "(718) 555-0132", "Install Lead"),
        ("demo-plumber-003", "Derek Owens", "derek@plumberos.demo", "(718) 555-0133", "Service Tech"),
        ("demo-plumber-004", "Nina Park", "nina@plumberos.demo", "(718) 555-0134", "Water Heater Specialist"),
        ("demo-plumber-005", "Luis Romero", "luis@plumberos.demo", "(718) 555-0135", "Maintenance Tech"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO plumbers (
          id, company_id, name, email, phone, role, active, branch_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        """,
        [(pid, company_id, name, email, phone, role, branch_id, NOW, NOW) for pid, name, email, phone, role in plumbers],
    )

    customers = [
        ("demo-customer-001", "Sarah Bennett", "sarah.bennett@example.com", "(718) 555-0201", "182 Union St, Brooklyn, NY", "Annual maintenance plan customer.", "portal-sarah-bennett"),
        ("demo-customer-002", "Marcus Hill", "marcus.hill@example.com", "(718) 555-0202", "49 Ditmars Blvd, Astoria, NY", "Called twice about a leaking water heater.", "portal-marcus-hill"),
        ("demo-customer-003", "Priya Shah", "priya.shah@example.com", "(718) 555-0203", "5-21 46th Ave, Long Island City, NY", "Prefers text updates before arrival.", "portal-priya-shah"),
        ("demo-customer-004", "Elena Torres", "elena.torres@example.com", "(718) 555-0204", "117 Berry St, Brooklyn, NY", "Basement sewer smell after heavy rain.", "portal-elena-torres"),
        ("demo-customer-005", "Tom Gallagher", "tom.gallagher@example.com", "(718) 555-0205", "8143 3rd Ave, Brooklyn, NY", "Restaurant owner; morning windows only.", "portal-tom-gallagher"),
        ("demo-customer-006", "Naomi Carter", "naomi.carter@example.com", "(718) 555-0206", "110-15 72nd Rd, Forest Hills, NY", "Wants financing options mentioned on big tickets.", "portal-naomi-carter"),
        ("demo-customer-007", "Ben Alvarez", "ben.alvarez@example.com", "(718) 555-0207", "229 Franklin St, Brooklyn, NY", "Owns a two-family rental property.", "portal-ben-alvarez"),
        ("demo-customer-008", "Madison Reed", "madison.reed@example.com", "(718) 555-0208", "301 Court St, Brooklyn, NY", "Repeat faucet and shutoff valve work.", "portal-madison-reed"),
        ("demo-customer-009", "Henry Cole", "henry.cole@example.com", "(718) 555-0209", "31-08 87th St, Jackson Heights, NY", "Needs Saturday appointments when possible.", "portal-henry-cole"),
        ("demo-customer-010", "Olivia Brooks", "olivia.brooks@example.com", "(718) 555-0210", "441 7th Ave, Brooklyn, NY", "Condo board requires COI before work.", "portal-olivia-brooks"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO customers (
          id, company_id, name, email, phone, address, notes, portal_token,
          email_opt_in, sms_opt_in, branch_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
        """,
        [
            (cid, company_id, name, email, phone, address, notes, token, branch_id, NOW, NOW)
            for cid, name, email, phone, address, notes, token in customers
        ],
    )

    leads = [
        ("demo-lead-001", "demo-customer-002", None, "google", "booked", 1, "Water heater leak", "Leak from bottom seam; customer wants earliest same-day slot.", "49 Ditmars Blvd, Astoria, NY", "2026-04-21 07:12:00"),
        ("demo-lead-002", "demo-customer-003", None, "website", "new", 2, "Tankless descaling", "Annual maintenance request for tankless unit.", "5-21 46th Ave, Long Island City, NY", "2026-04-21 08:05:00"),
        ("demo-lead-003", "demo-customer-004", None, "ai_receptionist", "qualified", 2, "Sewer odor inspection", "Smell increases after rain; possible trap issue or vent problem.", "117 Berry St, Brooklyn, NY", "2026-04-20 16:40:00"),
        ("demo-lead-004", "demo-customer-005", None, "referral", "quoted", 3, "Commercial grease line cleanup", "Kitchen floor drain backing up before lunch rush.", "8143 3rd Ave, Brooklyn, NY", "2026-04-20 09:10:00"),
        ("demo-lead-005", "demo-customer-006", None, "thumbtack", "booked", 2, "Install customer-supplied faucet", "Customer already bought fixture and wants install this week.", "110-15 72nd Rd, Forest Hills, NY", "2026-04-19 13:45:00"),
        ("demo-lead-006", "demo-customer-007", None, "phone", "completed", 1, "Ceiling leak from upstairs bath", "Emergency call resolved into completed same-day repair.", "229 Franklin St, Brooklyn, NY", "2026-04-18 11:18:00"),
        ("demo-lead-007", "demo-customer-008", None, "google", "lost", 4, "Quoted shutoff valve replacement", "Customer decided to compare bids.", "301 Court St, Brooklyn, NY", "2026-04-17 15:05:00"),
        ("demo-lead-008", "demo-customer-009", None, "angi", "new", 3, "Toilet rebuild", "Master bath toilet runs constantly overnight.", "31-08 87th St, Jackson Heights, NY", "2026-04-21 06:55:00"),
        ("demo-lead-009", "demo-customer-010", None, "website", "completed", 2, "Boiler relief valve replacement", "Condo unit boiler dripping into pan.", "441 7th Ave, Brooklyn, NY", "2026-04-16 10:20:00"),
        ("demo-lead-010", "demo-customer-001", None, "referral", "quoted", 3, "Spring maintenance checklist", "Member plan upsell with fixture tune-up options.", "182 Union St, Brooklyn, NY", "2026-04-15 14:00:00"),
        ("demo-lead-011", "demo-customer-003", None, "phone", "booked", 1, "No hot water", "Tankless showing ignition code; family home, urgent.", "5-21 46th Ave, Long Island City, NY", "2026-04-20 19:12:00"),
        ("demo-lead-012", "demo-customer-004", None, "google", "new", 2, "Sump pump not cycling", "Basement taking on water during storm.", "117 Berry St, Brooklyn, NY", "2026-04-21 08:18:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO leads (
          id, company_id, customer_id, plumber_id, source, status, priority, issue,
          description, location, branch_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (lid, company_id, customer_id, plumber_id, source, status, priority, issue, description, location, branch_id, created_at, created_at)
            for lid, customer_id, plumber_id, source, status, priority, issue, description, location, created_at in leads
        ],
    )

    jobs = [
        ("demo-job-001", "demo-lead-001", "demo-customer-002", "demo-plumber-004", "scheduled", "Water Heater", "Confirm source of leak and quote repair or replacement.", "2026-04-21", "09:30", "2026-04-21 09:30:00", 225.0, None, "Bring 40-gallon gas WH parts book.", "2026-04-21 07:20:00"),
        ("demo-job-002", "demo-lead-011", "demo-customer-003", "demo-plumber-003", "in_progress", "Tankless Service", "Diagnose ignition code and restore hot water.", "2026-04-21", "10:00", "2026-04-21 10:00:00", 189.0, None, "Customer prefers text before arrival.", "2026-04-20 19:30:00"),
        ("demo-job-003", "demo-lead-005", "demo-customer-006", "demo-plumber-002", "scheduled", "Faucet Installation", "Install customer-supplied kitchen faucet and angle stops if needed.", "2026-04-21", "11:30", "2026-04-21 11:30:00", 325.0, None, "Check shutoff condition before disconnecting.", "2026-04-19 14:00:00"),
        ("demo-job-004", "demo-lead-004", "demo-customer-005", "demo-plumber-001", "scheduled", "Drain Cleaning", "Commercial kitchen floor drain cleaning before prep begins.", "2026-04-21", "13:00", "2026-04-21 13:00:00", 450.0, None, "Restaurant requests before 2 PM.", "2026-04-20 09:40:00"),
        ("demo-job-005", "demo-lead-012", "demo-customer-004", None, "scheduled", "Sump Pump", "Inspect failed sump pump and confirm discharge path.", "2026-04-21", "15:00", "2026-04-21 15:00:00", 245.0, None, "Unassigned pending crew availability.", "2026-04-21 08:25:00"),
        ("demo-job-006", "demo-lead-002", "demo-customer-003", None, "scheduled", "Maintenance", "Tankless descaling and flush for annual service.", "2026-04-22", "09:00", "2026-04-22 09:00:00", 275.0, None, "Can be bundled with diagnostics if needed.", "2026-04-21 08:15:00"),
        ("demo-job-007", "demo-lead-006", "demo-customer-007", "demo-plumber-001", "completed", "Leak Repair", "Open ceiling, repair tub drain leak, patch access panel.", "2026-04-18", "12:30", "2026-04-18 12:30:00", 680.0, 845.0, "Customer approved drywall patch add-on.", "2026-04-18 11:20:00"),
        ("demo-job-008", "demo-lead-009", "demo-customer-010", "demo-plumber-004", "completed", "Boiler Repair", "Replace relief valve and verify boiler pressure.", "2026-04-16", "14:00", "2026-04-16 14:00:00", 390.0, 390.0, "COI emailed to condo board.", "2026-04-16 10:30:00"),
        ("demo-job-009", None, "demo-customer-001", "demo-plumber-005", "scheduled", "Maintenance Plan Visit", "Spring membership tune-up and fixture inspection.", "2026-04-22", "13:30", "2026-04-22 13:30:00", 199.0, None, "Offer water filtration add-on if pressure issue persists.", "2026-04-20 08:00:00"),
        ("demo-job-010", None, "demo-customer-009", "demo-plumber-003", "completed", "Toilet Repair", "Replace fill valve, flapper, and supply line.", "2026-04-14", "09:00", "2026-04-14 09:00:00", 275.0, 275.0, "Customer requested Saturday slot.", "2026-04-13 16:00:00"),
        ("demo-job-011", None, "demo-customer-008", None, "scheduled", "Valve Replacement", "Replace seized shutoff valve under vanity sink.", "2026-04-22", "15:30", "2026-04-22 15:30:00", 210.0, None, "Could pair with faucet swap if crew free.", "2026-04-21 08:40:00"),
        ("demo-job-012", "demo-lead-003", "demo-customer-004", "demo-plumber-002", "scheduled", "Inspection", "Camera/vent inspection for recurring sewer odor.", "2026-04-23", "10:30", "2026-04-23 10:30:00", 325.0, None, "Bring smoke test kit if vent issue likely.", "2026-04-20 17:00:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO jobs (
          id, company_id, lead_id, customer_id, plumber_id, status, type, description,
          scheduled_date, scheduled_time, scheduled_at, estimated_price, final_price, notes,
          branch_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (jid, company_id, lead_id, customer_id, plumber_id, status, job_type, description, scheduled_date, scheduled_time, scheduled_at, estimated_price, final_price, notes, branch_id, created_at, created_at)
            for jid, lead_id, customer_id, plumber_id, status, job_type, description, scheduled_date, scheduled_time, scheduled_at, estimated_price, final_price, notes, created_at in jobs
        ],
    )

    # Backfill timestamps for completed / in-progress jobs.
    conn.execute("UPDATE jobs SET started_at = '2026-04-21 10:12:00' WHERE id = 'demo-job-002'")
    conn.execute("UPDATE jobs SET started_at = '2026-04-18 12:42:00', completed_at = '2026-04-18 16:20:00' WHERE id = 'demo-job-007'")
    conn.execute("UPDATE jobs SET started_at = '2026-04-16 14:07:00', completed_at = '2026-04-16 15:22:00' WHERE id = 'demo-job-008'")
    conn.execute("UPDATE jobs SET started_at = '2026-04-14 09:04:00', completed_at = '2026-04-14 10:11:00' WHERE id = 'demo-job-010'")

    invoices = [
        ("demo-invoice-001", "demo-customer-007", "demo-job-007", "INV-2026-0101", "Leak Repair", "paid", 84500, 6760, 91260, "2026-04-18", "2026-04-18", "2026-04-18", "Emergency ceiling leak repair", "paytok-demo-001", "2026-04-18 16:35:00"),
        ("demo-invoice-002", "demo-customer-010", "demo-job-008", "INV-2026-0102", "Boiler Repair", "paid", 39000, 3120, 42120, "2026-04-16", "2026-04-16", "2026-04-16", "Relief valve replacement", "paytok-demo-002", "2026-04-16 15:30:00"),
        ("demo-invoice-003", "demo-customer-009", "demo-job-010", "INV-2026-0103", "Toilet Repair", "paid", 27500, 2200, 29700, "2026-04-14", "2026-04-14", "2026-04-14", "Saturday service completion", "paytok-demo-003", "2026-04-14 10:20:00"),
        ("demo-invoice-004", "demo-customer-002", "demo-job-001", "INV-2026-0104", "Water Heater", "pending", 22500, 1800, 24300, "2026-04-21", "2026-04-28", None, "Diagnostic due after service window", "paytok-demo-004", "2026-04-21 09:40:00"),
        ("demo-invoice-005", "demo-customer-005", "demo-job-004", "INV-2026-0105", "Drain Cleaning", "overdue", 45000, 3600, 48600, "2026-04-10", "2026-04-17", None, "Commercial kitchen drain cleaning", "paytok-demo-005", "2026-04-10 14:00:00"),
        ("demo-invoice-006", "demo-customer-003", "demo-job-002", "INV-2026-0106", "Tankless Service", "pending", 18900, 1512, 20412, "2026-04-21", "2026-04-24", None, "Diagnostic visit awaiting final parts quote", "paytok-demo-006", "2026-04-21 10:15:00"),
        ("demo-invoice-007", "demo-customer-001", "demo-job-009", "INV-2026-0107", "Maintenance Plan Visit", "cancelled", 19900, 1592, 21492, "2026-04-20", "2026-04-20", None, "Canceled after membership credit applied", "paytok-demo-007", "2026-04-20 09:30:00"),
        ("demo-invoice-008", "demo-customer-008", None, "INV-2026-0108", "Valve Replacement", "pending", 21000, 1680, 22680, "2026-04-21", "2026-04-29", None, "Pre-billed once scope confirmed", "paytok-demo-008", "2026-04-21 08:45:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO invoices (
          id, company_id, customer_id, job_id, invoice_number, service_type, status,
          amount, tax, total, amount_cents, tax_cents, total_cents,
          issue_date, due_date, paid_date, notes, public_pay_token, branch_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                iid, company_id, customer_id, job_id, invoice_number, service_type, status,
                amount_cents / 100, tax_cents / 100, total_cents / 100, amount_cents, tax_cents, total_cents,
                issue_date, due_date, paid_date, notes, public_token, branch_id, created_at, created_at
            )
            for iid, customer_id, job_id, invoice_number, service_type, status, amount_cents, tax_cents, total_cents, issue_date, due_date, paid_date, notes, public_token, created_at in invoices
        ],
    )

    invoice_lines = [
        ("demo-invline-001", "demo-invoice-001", 0, "Emergency plumbing labor", 1, 52500),
        ("demo-invline-002", "demo-invoice-001", 1, "Tub drain repair materials", 1, 32000),
        ("demo-invline-003", "demo-invoice-002", 0, "Boiler relief valve replacement", 1, 39000),
        ("demo-invline-004", "demo-invoice-003", 0, "Toilet rebuild kit install", 1, 27500),
        ("demo-invline-005", "demo-invoice-004", 0, "Water heater diagnostic", 1, 22500),
        ("demo-invline-006", "demo-invoice-005", 0, "Commercial floor drain cleaning", 1, 45000),
        ("demo-invline-007", "demo-invoice-006", 0, "Tankless diagnostic", 1, 18900),
        ("demo-invline-008", "demo-invoice-007", 0, "Membership maintenance visit", 1, 19900),
        ("demo-invline-009", "demo-invoice-008", 0, "Shutoff valve replacement", 1, 21000),
    ]
    insert_many(
        conn,
        """
        INSERT INTO invoice_line_items (
          id, invoice_id, sort_order, name, quantity, unit_price_cents, line_total_cents, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (iid, invoice_id, sort_order, name, quantity, unit_price_cents, int(quantity * unit_price_cents), NOW)
            for iid, invoice_id, sort_order, name, quantity, unit_price_cents in invoice_lines
        ],
    )

    payments = [
        ("demo-payment-001", "invoice_payment", "demo-invoice-001", "pi_demo_001", "acct_demo_plumberos", 91260, 0, 4563, "usd", "paid", "ben.alvarez@example.com", "2026-04-18 16:38:00", None, None, "2026-04-18 16:38:00"),
        ("demo-payment-002", "invoice_payment", "demo-invoice-002", "pi_demo_002", "acct_demo_plumberos", 42120, 0, 2106, "usd", "paid", "olivia.brooks@example.com", "2026-04-16 15:33:00", None, None, "2026-04-16 15:33:00"),
        ("demo-payment-003", "invoice_payment", "demo-invoice-003", "pi_demo_003", "acct_demo_plumberos", 29700, 0, 1485, "usd", "paid", "henry.cole@example.com", "2026-04-14 10:25:00", None, None, "2026-04-14 10:25:00"),
        ("demo-payment-004", "invoice_payment", "demo-invoice-005", "pi_demo_004", "acct_demo_plumberos", 48600, 12150, 2430, "usd", "partial_refund", "tom.gallagher@example.com", "2026-04-11 08:10:00", None, "2026-04-15 12:00:00", "2026-04-11 08:10:00"),
        ("demo-payment-005", "invoice_payment", "demo-invoice-004", "pi_demo_005", "acct_demo_plumberos", 24300, 0, 1215, "usd", "pending", "marcus.hill@example.com", None, None, None, "2026-04-21 09:41:00"),
        ("demo-payment-006", "invoice_payment", "demo-invoice-007", "pi_demo_006", "acct_demo_plumberos", 21492, 21492, 1074, "usd", "refunded", "sarah.bennett@example.com", "2026-04-20 09:31:00", "2026-04-20 14:20:00", None, "2026-04-20 09:31:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO payments (
          id, company_id, source_type, source_id, stripe_payment_intent_id, stripe_account_id,
          amount_cents, refunded_amount_cents, application_fee_cents, currency, status,
          customer_email, paid_at, failed_at, refunded_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (pid, company_id, source_type, source_id, intent_id, stripe_account_id, amount_cents, refunded_cents, app_fee_cents, currency, status, customer_email, paid_at, failed_at, refunded_at, created_at, created_at)
            for pid, source_type, source_id, intent_id, stripe_account_id, amount_cents, refunded_cents, app_fee_cents, currency, status, customer_email, paid_at, failed_at, refunded_at, created_at in payments
        ],
    )

    contracts = [
        ("demo-contract-001", "demo-customer-001", "Home Care Membership", "annual", 19900, "Includes annual safety inspection and priority booking.", "2026-05-15 08:00:00"),
        ("demo-contract-002", "demo-customer-003", "Tankless Service Plan", "semiannual", 27500, "Flush, descale, and filter cleaning every 6 months.", "2026-10-21 09:00:00"),
        ("demo-contract-003", "demo-customer-005", "Restaurant Preventive Drain Plan", "quarterly", 45000, "Quarterly grease and floor drain maintenance.", "2026-07-01 06:00:00"),
        ("demo-contract-004", "demo-customer-007", "Rental Property Inspection Plan", "monthly", 15900, "Monthly leak/fixture check across duplex units.", "2026-05-01 11:00:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO service_contracts (
          id, company_id, customer_id, name, cadence, price_cents, notes, active,
          next_due_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        """,
        [
            (cid, company_id, customer_id, name, cadence, price_cents, notes, next_due_at, NOW, NOW)
            for cid, customer_id, name, cadence, price_cents, notes, next_due_at in contracts
        ],
    )
    insert_many(
        conn,
        """
        INSERT INTO service_contract_schedules (
          id, contract_id, scheduled_for, job_id, completed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("demo-schedule-001", "demo-contract-001", "2026-05-15 08:00:00", None, None, NOW),
            ("demo-schedule-002", "demo-contract-002", "2026-10-21 09:00:00", None, None, NOW),
            ("demo-schedule-003", "demo-contract-003", "2026-07-01 06:00:00", None, None, NOW),
            ("demo-schedule-004", "demo-contract-004", "2026-05-01 11:00:00", None, None, NOW),
        ],
    )

    catalog = [
        ("demo-catalog-001", "Drain cleaning - standard", "Kitchen, bath, and laundry line cleaning.", 14500, 0),
        ("demo-catalog-002", "Water heater diagnostic", "Leak/no-hot-water diagnostic and safety check.", 22500, 1),
        ("demo-catalog-003", "Tankless flush service", "Descale and flush service for tankless units.", 27500, 2),
        ("demo-catalog-004", "Toilet rebuild", "Fill valve, flapper, supply line, tune-up.", 27500, 3),
        ("demo-catalog-005", "Sewer camera inspection", "Camera inspection with findings summary.", 32500, 4),
        ("demo-catalog-006", "Faucet installation", "Install customer or supplied faucet.", 32500, 5),
    ]
    insert_many(
        conn,
        """
        INSERT INTO estimate_catalog_services (
          id, company_id, name, description, unit_price_cents, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (cid, company_id, name, desc, cents, order, NOW, NOW)
            for cid, name, desc, cents, order in catalog
        ],
    )

    estimates = [
        ("demo-estimate-001", "EST-2026-0101", "sent", "Water heater replacement options", "demo-customer-002", "demo-lead-001", None, "Multiple options for 40-gallon replacement.", 245000, 0, 19600, 264600, "Marcus Hill", "marcus.hill@example.com", "(718) 555-0202", "49 Ditmars Blvd, Astoria, NY", "2026-04-28", "est-public-001", "2026-04-21 08:10:00"),
        ("demo-estimate-002", "EST-2026-0102", "approved", "Commercial drain maintenance plan", "demo-customer-005", "demo-lead-004", "demo-job-004", "Quarterly PM add-on after initial cleanout.", 135000, 0, 10800, 145800, "Tom Gallagher", "tom.gallagher@example.com", "(718) 555-0205", "8143 3rd Ave, Brooklyn, NY", "2026-05-01", "est-public-002", "2026-04-20 10:00:00"),
        ("demo-estimate-003", "EST-2026-0103", "draft", "Sump pump replacement", "demo-customer-004", "demo-lead-012", None, "Draft estimate waiting on final equipment choice.", 95000, 5000, 7200, 97200, "Elena Torres", "elena.torres@example.com", "(718) 555-0204", "117 Berry St, Brooklyn, NY", "2026-05-05", "est-public-003", "2026-04-21 08:40:00"),
        ("demo-estimate-004", "EST-2026-0104", "viewed", "Tankless service and membership", "demo-customer-003", "demo-lead-002", "demo-job-006", "Bundle annual flush with service agreement.", 27500, 0, 2200, 29700, "Priya Shah", "priya.shah@example.com", "(718) 555-0203", "5-21 46th Ave, Long Island City, NY", "2026-04-30", "est-public-004", "2026-04-21 08:18:00"),
        ("demo-estimate-005", "EST-2026-0105", "sent", "Bathroom shutoff and faucet refresh", "demo-customer-008", None, "demo-job-011", "Customer asked for add-on option while valve is open.", 42000, 0, 3360, 45360, "Madison Reed", "madison.reed@example.com", "(718) 555-0208", "301 Court St, Brooklyn, NY", "2026-04-29", "est-public-005", "2026-04-21 08:52:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO estimates (
          id, company_id, estimate_number, status, title, description, customer_id, lead_id, job_id,
          source_type, source_id, currency, subtotal_amount_cents, discount_amount_cents,
          tax_amount_cents, total_amount_cents, company_name_snapshot, company_email_snapshot,
          company_phone_snapshot, company_address_snapshot, customer_name_snapshot,
          customer_email_snapshot, customer_phone_snapshot, service_address_snapshot,
          notes_customer, expiration_date, customer_public_token, deposit_status, branch_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, 'USD', ?, ?, ?, ?, 'Demo Plumbing Co.',
          'demo@plumberos.com', '(555) 010-0000', '123 Main St, Brooklyn, NY', ?, ?, ?, ?, ?, ?, ?, 'none', ?, ?, ?)
        """,
        [
            (
                est_id, company_id, est_no, status, title, description, customer_id, lead_id, job_id,
                customer_id, subtotal, discount, tax, total, cust_name, cust_email, cust_phone, service_address,
                description, expiration_date, public_token, branch_id, created_at, created_at
            )
            for est_id, est_no, status, title, customer_id, lead_id, job_id, description, subtotal, discount, tax, total, cust_name, cust_email, cust_phone, service_address, expiration_date, public_token, created_at in estimates
        ],
    )

    estimate_lines = [
        ("demo-estline-001", "demo-estimate-001", 0, "40-gallon gas water heater", 1, 185000, "Base replacement option", "standard"),
        ("demo-estline-002", "demo-estimate-001", 1, "Expansion tank + code upgrades", 1, 60000, "Required if pressure is above threshold", "standard"),
        ("demo-estline-003", "demo-estimate-002", 0, "Quarterly jetting visits", 4, 33750, "Four visits annually", None),
        ("demo-estline-004", "demo-estimate-003", 0, "Sump pump replacement", 1, 95000, "Primary pump with check valve", None),
        ("demo-estline-005", "demo-estimate-004", 0, "Tankless flush service", 1, 27500, "Annual maintenance visit", None),
        ("demo-estline-006", "demo-estimate-005", 0, "Shutoff valve replacement", 1, 21000, "Main scope", "base"),
        ("demo-estline-007", "demo-estimate-005", 1, "Customer-supplied faucet install", 1, 21000, "Optional add-on while water is isolated", "base"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO estimate_line_items (
          id, estimate_id, sort_order, name, description, quantity, unit, unit_price_cents,
          total_price_cents, option_group, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'ea', ?, ?, ?, ?, ?)
        """,
        [
            (lid, estimate_id, sort_order, name, description, quantity, unit_price_cents, int(quantity * unit_price_cents), option_group, NOW, NOW)
            for lid, estimate_id, sort_order, name, quantity, unit_price_cents, description, option_group in estimate_lines
        ],
    )

    estimate_activity = [
        ("demo-estactivity-001", "demo-estimate-001", "created", '{"by":"dispatcher"}', "staff", "2026-04-21 08:10:00"),
        ("demo-estactivity-002", "demo-estimate-001", "sent", '{"channel":"email"}', "staff", "2026-04-21 08:22:00"),
        ("demo-estactivity-003", "demo-estimate-002", "approved", '{"channel":"customer_portal"}', "customer", "2026-04-20 14:05:00"),
        ("demo-estactivity-004", "demo-estimate-004", "viewed", '{"channel":"email"}', "customer", "2026-04-21 08:35:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO estimate_activity (
          id, estimate_id, event_type, payload_json, actor_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        estimate_activity,
    )
    estimate_delivery = [
        ("demo-estdelivery-001", "demo-estimate-001", "email", "marcus.hill@example.com", "Water heater options from Demo Plumbing Co.", "mock", "sent", "2026-04-21 08:22:00"),
        ("demo-estdelivery-002", "demo-estimate-004", "sms", "(718) 555-0203", "Tankless service estimate ready", "mock", "sent", "2026-04-21 08:20:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO estimate_delivery (
          id, estimate_id, delivery_type, recipient, subject, provider, status, sent_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [(did, estimate_id, delivery_type, recipient, subject, provider, status, sent_at, sent_at) for did, estimate_id, delivery_type, recipient, subject, provider, status, sent_at in estimate_delivery],
    )

    audit_events = [
        ("demo-audit-001", "estimate.send", "estimate", "demo-estimate-001", "Estimate emailed to Marcus Hill", '{"recipient":"marcus.hill@example.com"}', "2026-04-21 08:22:00"),
        ("demo-audit-002", "dispatch.assign", "job", "demo-job-001", "Assigned Marcus Hill water heater leak to Nina Park", '{"plumberId":"demo-plumber-004"}', "2026-04-21 08:30:00"),
        ("demo-audit-003", "payment.refund", "payment", "demo-payment-004", "Partial refund issued for commercial drain visit", '{"amountCents":12150}', "2026-04-15 12:01:00"),
        ("demo-audit-004", "invoice.create", "invoice", "demo-invoice-004", "Created diagnostic invoice for Marcus Hill", '{"invoiceNumber":"INV-2026-0104"}', "2026-04-21 09:40:00"),
        ("demo-audit-005", "service_contract.create", "service_contract", "demo-contract-003", "Created quarterly drain maintenance plan", '{"cadence":"quarterly"}', "2026-04-20 11:10:00"),
    ]
    insert_many(
        conn,
        """
        INSERT INTO audit_events (
          id, company_id, actor_user_id, actor_email, actor_role, action, entity_type,
          entity_id, summary, metadata, ip_address, user_agent, created_at
        ) VALUES (?, ?, 'demo-user-admin', 'owner@plumberos.demo', 'admin', ?, ?, ?, ?, ?, '127.0.0.1', 'seed_demo_data.py', ?)
        """,
        [
            (aid, company_id, action, entity_type, entity_id, summary, metadata, created_at)
            for aid, action, entity_type, entity_id, summary, metadata, created_at in audit_events
        ],
    )


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        ensure_schema(conn)
        company_id = get_or_create_company(conn)
        branch_id = get_or_create_branch(conn, company_id)
        cleanup_old_demo_rows(conn)
        seed_company_settings(conn, company_id)
        seed_operational_data(conn, company_id, branch_id)
        conn.commit()

        counts = {
            "customers": conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0],
            "plumbers": conn.execute("SELECT COUNT(*) FROM plumbers").fetchone()[0],
            "leads": conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0],
            "jobs": conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0],
            "invoices": conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0],
            "payments": conn.execute("SELECT COUNT(*) FROM payments").fetchone()[0],
            "contracts": conn.execute("SELECT COUNT(*) FROM service_contracts").fetchone()[0],
            "estimates": conn.execute("SELECT COUNT(*) FROM estimates").fetchone()[0],
        }
        print("Demo data seeded successfully.")
        for key, value in counts.items():
            print(f"{key}: {value}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
