import { NextResponse } from 'next/server';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import {
  addTicketComment,
  getTicketDetail,
  listTicketComments,
  normalizeTicketCommentBody,
} from '@/lib/admin/tickets';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const ticket = await getTicketDetail(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  const comments = await listTicketComments(id);
  return NextResponse.json({ ticket, comments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = normalizeTicketCommentBody(body?.body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const ticket = await getTicketDetail(id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  const comment = await addTicketComment({
    ticketId: id,
    companyId: String(ticket.company_id),
    authorUserId: auth.id,
    authorRole: auth.role,
    authorName: auth.name,
    authorEmail: auth.email,
    body: parsed.body,
  });

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket.comment',
    entityType: 'admin_ticket',
    entityId: id,
    summary: `Commented on ticket ${ticket.title}`,
    metadata: { companyId: ticket.company_id, commentId: comment.id },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const nextTicket = await getTicketDetail(id);
  const comments = await listTicketComments(id);
  return NextResponse.json({ ticket: nextTicket, comments, comment }, { status: 201 });
}
