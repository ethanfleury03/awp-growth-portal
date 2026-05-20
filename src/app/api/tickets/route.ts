import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  createTicket,
  listTickets,
  normalizeTicketCreateInput,
  notifyTicketCreated,
} from '@/lib/tickets/tickets';

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(request: Request) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;

  const { searchParams } = new URL(request.url);

  try {
    const result = await listTickets({
      companyId: portal.companyId,
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      limit: Number(searchParams.get('limit') || 100),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[tickets] list failed', error);
    return NextResponse.json({ error: messageFromError(error, 'Unable to load tickets.') }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;

  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketCreateInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const ticket = await createTicket({
      companyId: portal.companyId,
      branchId: portal.branchId,
      user: portal,
      ...parsed.value,
    });
    const notification = await notifyTicketCreated(ticket);
    return NextResponse.json({ ticket, notification }, { status: 201 });
  } catch (error) {
    console.error('[tickets] create failed', error);
    return NextResponse.json({ error: messageFromError(error, 'Unable to create ticket.') }, { status: 500 });
  }
}
