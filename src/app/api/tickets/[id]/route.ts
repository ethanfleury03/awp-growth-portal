import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { roleAtLeast } from '@/lib/auth/types';
import {
  getTicket,
  normalizeTicketPatchInput,
  updateTicket,
} from '@/lib/tickets/tickets';

type Ctx = { params: Promise<{ id: string }> };

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function GET(_request: Request, ctx: Ctx) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;

  const { id } = await ctx.params;

  try {
    const result = await getTicket({
      companyId: portal.companyId,
      ticketId: id,
      includeInternal: roleAtLeast(portal.role, 'staff'),
    });
    if (!result) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[tickets] load failed', error);
    return NextResponse.json({ error: messageFromError(error, 'Unable to load ticket.') }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;

  const { id } = await ctx.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketPatchInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const ticket = await updateTicket({
      companyId: portal.companyId,
      ticketId: id,
      user: portal,
      patch: parsed.value,
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    const message = messageFromError(error, 'Unable to update ticket.');
    const status = message === 'Ticket not found.' ? 404 : message.includes('Only staff') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
