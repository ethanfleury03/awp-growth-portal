import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  addTicketComment,
  getCompanyTicketDetail,
  listTicketComments,
  normalizeTicketCommentBody,
} from '@/lib/tickets/shared-ticket-board';
import { queueTicketAgentEvent } from '@/lib/tickets/agent-router';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const user = await requireModuleOrRespond('tickets');
  if (isPortalResponse(user)) return user;

  const { id } = await ctx.params;

  try {
    const detail = await getCompanyTicketDetail(id, user.companyId);
    if (!detail) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }
    return NextResponse.json({ comments: await listTicketComments(id, user.companyId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load comments.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await requireModuleOrRespond('tickets');
  if (isPortalResponse(user)) return user;

  const { id } = await ctx.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketCommentBody((payload as { body?: unknown }).body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const comment = await addTicketComment({
      ticketId: id,
      companyId: user.companyId,
      authorUserId: user.id,
      authorRole: user.role,
      authorName: user.name,
      authorEmail: user.email,
      body: parsed.body,
    });
    const detail = await getCompanyTicketDetail(id, user.companyId);
    if (detail?.ticket) {
      await queueTicketAgentEvent({ eventType: 'ticket.comment_added', user, ticket: detail.ticket, comment }).catch((queueError) => {
        console.error('[ticket-agent] failed to queue ticket.comment_added', queueError);
      });
    }
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add comment.';
    const status = message === 'Ticket not found.' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
