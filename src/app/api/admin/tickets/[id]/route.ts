import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import {
  companyExists,
  nextTicketSortOrder,
  normalizePriority,
  projectBelongsToCompany,
} from '@/lib/admin/tickets';

type TicketRow = {
  id: string;
  bucket_id: string;
  company_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  requester_email: string | null;
  source: string;
  due_date: string | null;
  sort_order: number;
};

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existingRows = await sql`
    SELECT *
    FROM admin_tickets
    WHERE id = ${id}
    LIMIT 1
  `;
  const existing = existingRows[0] as TicketRow | undefined;
  if (!existing) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  const nextTitle =
    typeof body?.title === 'undefined' ? existing.title : String(body.title || '').trim();
  if (!nextTitle) {
    return NextResponse.json({ error: 'Ticket title is required.' }, { status: 400 });
  }

  const nextCompanyId =
    typeof body?.companyId === 'undefined'
      ? existing.company_id
      : String(body.companyId || '').trim();
  if (!nextCompanyId || !(await companyExists(nextCompanyId))) {
    return NextResponse.json({ error: 'Choose a valid client.' }, { status: 400 });
  }

  const nextBucketId =
    typeof body?.bucketId === 'undefined'
      ? existing.bucket_id
      : String(body.bucketId || '').trim();
  const bucket = await sql`
    SELECT id
    FROM admin_ticket_buckets
    WHERE id = ${nextBucketId} AND is_active = true
    LIMIT 1
  `;
  if (!bucket[0]) {
    return NextResponse.json({ error: 'Choose a valid bucket.' }, { status: 400 });
  }

  const nextProjectId =
    typeof body?.projectId === 'undefined'
      ? existing.project_id
      : String(body.projectId || '').trim() || null;
  if (!(await projectBelongsToCompany(nextProjectId, nextCompanyId))) {
    return NextResponse.json({ error: 'Choose a project that belongs to this client.' }, { status: 400 });
  }

  const movedBuckets = nextBucketId !== existing.bucket_id;
  const explicitSortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : null;
  const nextSortOrder =
    explicitSortOrder ?? (movedBuckets ? await nextTicketSortOrder(nextBucketId) : Number(existing.sort_order || 0));
  const nextDescription =
    typeof body?.description === 'undefined'
      ? existing.description
      : String(body.description || '').trim() || null;
  const nextRequesterEmail =
    typeof body?.requesterEmail === 'undefined'
      ? existing.requester_email
      : String(body.requesterEmail || '').trim().toLowerCase() || null;
  const nextDueDate =
    typeof body?.dueDate === 'undefined' ? existing.due_date : String(body.dueDate || '').trim() || null;
  const nextPriority =
    typeof body?.priority === 'undefined' ? normalizePriority(existing.priority) : normalizePriority(body.priority);

  const rows = await sql`
    UPDATE admin_tickets
    SET
      bucket_id = ${nextBucketId},
      company_id = ${nextCompanyId},
      project_id = ${nextProjectId},
      title = ${nextTitle},
      description = ${nextDescription},
      priority = ${nextPriority},
      requester_email = ${nextRequesterEmail},
      due_date = ${nextDueDate},
      sort_order = ${nextSortOrder},
      updated_by_user_id = ${auth.id},
      updated_at = datetime('now')
    WHERE id = ${id}
    RETURNING *
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket.update',
    entityType: 'admin_ticket',
    entityId: id,
    summary: `Updated ticket ${nextTitle}`,
    metadata: { companyId: nextCompanyId, projectId: nextProjectId, bucketId: nextBucketId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ticket: rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const existing = await sql`
    SELECT id, title, company_id
    FROM admin_tickets
    WHERE id = ${id}
    LIMIT 1
  `;
  if (!existing[0]) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  await sql`DELETE FROM admin_tickets WHERE id = ${id}`;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket.delete',
    entityType: 'admin_ticket',
    entityId: id,
    summary: `Deleted ticket ${existing[0].title}`,
    metadata: { companyId: existing[0].company_id },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
