import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  deleteTicket,
  getCompanyTicketDetail,
  normalizeTicketUpdateInput,
  updateTicket,
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
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await requireModuleOrRespond('tickets');
  if (isPortalResponse(user)) return user;

  const { id } = await ctx.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketUpdateInput({
    title: (payload as { title?: unknown }).title,
    description: (payload as { description?: unknown }).description,
    priority: (payload as { priority?: unknown }).priority,
    dueDate: (payload as { dueDate?: unknown; due_date?: unknown }).dueDate || (payload as { due_date?: unknown }).due_date,
    bucketId: (payload as { bucketId?: unknown; bucket_id?: unknown }).bucketId || (payload as { bucket_id?: unknown }).bucket_id,
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const previousDetail = await getCompanyTicketDetail(id, user.companyId);
    const ticket = await updateTicket({
      user,
      ticketId: id,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      bucketId: parsed.bucketId,
    });
    await queueTicketAgentEvent({ eventType: 'ticket.updated', user, ticket, previousTicket: previousDetail?.ticket ?? null }).catch((queueError) => {
      console.error('[ticket-agent] failed to queue ticket.updated', queueError);
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update ticket.';
    const status = message === 'Ticket not found.' || message === 'Status not found.' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await requireModuleOrRespond('tickets');
  if (isPortalResponse(user)) return user;

  const { id } = await ctx.params;

  try {
    const deleted = await deleteTicket({ user, ticketId: id });
    if (!deleted) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
