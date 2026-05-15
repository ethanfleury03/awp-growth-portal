import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { listCompanyTickets } from '@/lib/tickets/shared-ticket-board';

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

export async function POST() {
  return NextResponse.json(
    { error: 'Client ticket creation is disabled. Tickets are created by the admin team.' },
    { status: 405 },
  );
}
