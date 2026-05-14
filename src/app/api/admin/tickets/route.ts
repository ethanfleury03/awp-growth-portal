import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import {
  companyExists,
  getDefaultAdminTicketBucketId,
  nextTicketSortOrder,
  normalizePriority,
  projectBelongsToCompany,
} from '@/lib/admin/tickets';

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim() || null;
  const companyId = String(body?.companyId || '').trim();
  const projectId = String(body?.projectId || '').trim() || null;
  const requesterEmail = String(body?.requesterEmail || '').trim().toLowerCase() || null;
  const dueDate = String(body?.dueDate || '').trim() || null;
  const priority = normalizePriority(body?.priority);
  let bucketId = String(body?.bucketId || '').trim();

  if (!title) {
    return NextResponse.json({ error: 'Ticket title is required.' }, { status: 400 });
  }
  if (!companyId || !(await companyExists(companyId))) {
    return NextResponse.json({ error: 'Choose a valid client.' }, { status: 400 });
  }
  if (!(await projectBelongsToCompany(projectId, companyId))) {
    return NextResponse.json({ error: 'Choose a project that belongs to this client.' }, { status: 400 });
  }
  if (bucketId) {
    const bucket = await sql`
      SELECT id
      FROM admin_ticket_buckets
      WHERE id = ${bucketId} AND is_active = true
      LIMIT 1
    `;
    if (!bucket[0]) bucketId = '';
  }
  if (!bucketId) bucketId = await getDefaultAdminTicketBucketId();

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
      due_date,
      sort_order,
      created_by_user_id,
      updated_by_user_id
    ) VALUES (
      ${bucketId},
      ${companyId},
      ${projectId},
      ${title},
      ${description},
      ${priority},
      ${requesterEmail},
      'admin',
      ${dueDate},
      ${sortOrder},
      ${auth.id},
      ${auth.id}
    )
    RETURNING *
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket.create',
    entityType: 'admin_ticket',
    entityId: String(rows[0]?.id || ''),
    summary: `Created ticket ${title}`,
    metadata: { companyId, projectId, priority, source: 'admin' },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ticket: rows[0] }, { status: 201 });
}
