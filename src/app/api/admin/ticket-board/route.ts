import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { ensureAdminTicketBuckets } from '@/lib/admin/tickets';

function parsePayloadJson(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const buckets = await ensureAdminTicketBuckets();
  const tenants = await sql`
    SELECT
      c.id,
      c.name,
      c.email,
      s.display_name,
      s.primary_color,
      s.accent_color
    FROM companies c
    LEFT JOIN company_settings s ON s.company_id = c.id
    ORDER BY COALESCE(s.display_name, c.name) ASC
  `;
  const projects = await sql`
    SELECT
      g.id,
      g.company_id,
      g.title,
      g.status,
      g.payload_json,
      c.name AS company_name,
      s.display_name AS company_display_name
    FROM growth_records g
    JOIN companies c ON c.id = g.company_id
    LEFT JOIN company_settings s ON s.company_id = g.company_id
    WHERE g.record_type = 'project'
    ORDER BY COALESCE(s.display_name, c.name) ASC, g.title ASC
  `;
  const tickets = await sql`
    SELECT
      t.*,
      b.name AS bucket_name,
      b.color AS bucket_color,
      c.name AS company_name,
      c.email AS company_email,
      s.display_name AS company_display_name,
      s.primary_color AS company_primary_color,
      s.accent_color AS company_accent_color,
      p.title AS project_title,
      p.status AS project_status,
      (
        SELECT COUNT(*)
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
      ) AS comment_count,
      (
        SELECT tc.body
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
        ORDER BY tc.created_at DESC
        LIMIT 1
      ) AS latest_comment_body,
      (
        SELECT tc.created_at
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
        ORDER BY tc.created_at DESC
        LIMIT 1
      ) AS latest_comment_at
    FROM admin_tickets t
    JOIN admin_ticket_buckets b ON b.id = t.bucket_id
    JOIN companies c ON c.id = t.company_id
    LEFT JOIN company_settings s ON s.company_id = t.company_id
    LEFT JOIN growth_records p ON p.id = t.project_id
    ORDER BY t.sort_order ASC, t.updated_at DESC
  `;

  return NextResponse.json({
    buckets,
    tenants,
    projects: projects.map((project) => ({
      ...project,
      payload: parsePayloadJson(project.payload_json),
    })),
    tickets,
  });
}
