import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  addTicketComment,
  getTicketDetail,
  listTicketComments,
  normalizeTicketCommentBody,
} from '@/lib/admin/tickets';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;
  const { id } = await params;

  const ticket = await getTicketDetail(id, portal.companyId);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  const comments = await listTicketComments(id, portal.companyId);
  return NextResponse.json({ comments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = normalizeTicketCommentBody(body?.body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const ticket = await getTicketDetail(id, portal.companyId);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  const comment = await addTicketComment({
    ticketId: id,
    companyId: portal.companyId,
    authorUserId: portal.id,
    authorRole: portal.role,
    authorName: portal.name,
    authorEmail: portal.email,
    body: parsed.body,
  });
  const nextTicket = await getTicketDetail(id, portal.companyId);
  const comments = await listTicketComments(id, portal.companyId);

  return NextResponse.json({ ticket: nextTicket, comments, comment }, { status: 201 });
}
