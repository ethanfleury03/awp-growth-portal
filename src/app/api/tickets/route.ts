import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import {
  getDefaultAdminTicketBucketId,
  nextTicketSortOrder,
  normalizePriority,
  projectBelongsToCompany,
} from '@/lib/admin/tickets';

export async function GET() {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const tickets = await sql`
    SELECT
      t.id,
      t.title,
      t.description,
      t.priority,
      t.requester_email,
      t.source,
      t.due_date,
      t.created_at,
      t.updated_at,
      b.name AS bucket_name,
      b.color AS bucket_color,
      p.title AS project_title
    FROM admin_tickets t
    JOIN admin_ticket_buckets b ON b.id = t.bucket_id
    LEFT JOIN growth_records p ON p.id = t.project_id
    WHERE t.company_id = ${auth.companyId}
    ORDER BY t.updated_at DESC
  `;

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim() || null;
  const projectId = String(body?.projectId || '').trim() || null;
  const priority = normalizePriority(body?.priority);

  if (!title) {
    return NextResponse.json({ error: 'Ticket title is required.' }, { status: 400 });
  }
  if (!(await projectBelongsToCompany(projectId, auth.companyId))) {
    return NextResponse.json({ error: 'Choose a valid project.' }, { status: 400 });
  }

  const bucketId = await getDefaultAdminTicketBucketId();
  const sortOrder = await nextTicketSortOrder(bucketId);
  const rows = await sql`
    INSERT INTO admin_tickets (
      bucket_id,
      company_id,
      project_id,
      title,
      description,
      priority,
      requester_email,
      source,
      sort_order,
      created_by_user_id,
      updated_by_user_id
    ) VALUES (
      ${bucketId},
      ${auth.companyId},
      ${projectId},
      ${title},
      ${description},
      ${priority},
      ${auth.email},
      'client_portal',
      ${sortOrder},
      ${auth.id},
      ${auth.id}
    )
    RETURNING id, title, priority, created_at
  `;

  return NextResponse.json({ ticket: rows[0] }, { status: 201 });
}
