import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { getTicketDetail, listTicketComments } from '@/lib/admin/tickets';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const portal = await requireModuleOrRespond('tickets');
  if (isPortalResponse(portal)) return portal;
  const { id } = await params;

  const ticket = await getTicketDetail(id, portal.companyId);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }

  const comments = await listTicketComments(id, portal.companyId);
  return NextResponse.json({ ticket, comments, currentUserEmail: portal.email });
}
