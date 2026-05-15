import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { ensureAdminTicketBuckets } from '@/lib/admin/tickets';

export async function GET() {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;

  const buckets = await ensureAdminTicketBuckets();
  const tickets = await sql`
    SELECT
      t.id,
      t.bucket_id,
      t.company_id,
      t.project_id,
      t.title,
      t.description,
      t.priority,
      t.requester_email,
      t.source,
      t.due_date,
      t.sort_order,
      t.created_at,
      t.updated_at,
      b.name AS bucket_name,
      b.color AS bucket_color,
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
      ) AS latest_comment_at,
      EXISTS (
        SELECT 1
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
          AND (
            lower(COALESCE(tc.author_email, '')) = ${portal.email.toLowerCase()}
            OR tc.author_user_id = ${portal.id}
          )
      ) AS commented_by_current_user
    FROM admin_tickets t
    JOIN admin_ticket_buckets b ON b.id = t.bucket_id
    LEFT JOIN growth_records p ON p.id = t.project_id
    WHERE t.company_id = ${portal.companyId}
    ORDER BY b.sort_order ASC, t.sort_order ASC, t.updated_at DESC
  `;

  return NextResponse.json({
    buckets,
    tickets,
    currentUserEmail: portal.email,
  });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Client ticket creation is disabled. Tickets are created by the admin team.' },
    { status: 405, headers: { Allow: 'GET' } },
  );
}
