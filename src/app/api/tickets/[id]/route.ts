import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { getCompanyTicketDetail } from '@/lib/tickets/shared-ticket-board';

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
