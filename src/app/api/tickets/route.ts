import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  createTicket,
  listCompanyTickets,
  normalizeTicketCreateInput,
} from '@/lib/tickets/shared-ticket-board';
import { queueTicketAgentEvent } from '@/lib/tickets/agent-router';

export async function GET() {
  const user = await requireModuleOrRespond('tickets');
  if (isPortalResponse(user)) return user;

  try {
    return NextResponse.json(await listCompanyTickets(user));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load tickets.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireModuleOrRespond('tickets');
  if (isPortalResponse(user)) return user;

  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketCreateInput({
    title: (payload as { title?: unknown }).title,
    description: (payload as { description?: unknown }).description,
    priority: (payload as { priority?: unknown }).priority,
    dueDate: (payload as { dueDate?: unknown; due_date?: unknown }).dueDate || (payload as { due_date?: unknown }).due_date,
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const ticket = await createTicket({
      user,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
    });
    await queueTicketAgentEvent({ eventType: 'ticket.created', user, ticket }).catch((queueError) => {
      console.error('[ticket-agent] failed to queue ticket.created', queueError);
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
