import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import {
  addTicketComment,
  normalizeTicketCommentInput,
} from '@/lib/tickets/tickets';

type Ctx = { params: Promise<{ id: string }> };

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: Request, ctx: Ctx) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;

  const { id } = await ctx.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketCommentInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const comment = await addTicketComment({
      companyId: portal.companyId,
      ticketId: id,
      user: portal,
      body: parsed.value.body,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = messageFromError(error, 'Unable to add comment.');
    return NextResponse.json({ error: message }, { status: message === 'Ticket not found.' ? 404 : 500 });
  }
}
