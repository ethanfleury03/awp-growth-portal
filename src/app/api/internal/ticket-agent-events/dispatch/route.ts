import { NextResponse } from 'next/server';
import { dispatchPendingTicketAgentEvents } from '@/lib/tickets/agent-router';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

function configuredToken() {
  return (
    process.env.HERMES_ROUTER_DISPATCH_TOKEN ||
    process.env.WNY_INTERNAL_STATUS_TOKEN ||
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN ||
    ''
  ).trim();
}

export async function POST(request: Request) {
  const expected = configuredToken();
  const token = bearerToken(request) || request.headers.get('x-gateway-service-token') || '';
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const limit = Number((payload as { limit?: unknown }).limit || 10);
  try {
    const events = await dispatchPendingTicketAgentEvents(limit);
    return NextResponse.json({
      ok: true,
      dispatched: events.length,
      events: events.map((event) => ({
        id: event.id,
        ticketId: event.ticket_id,
        eventType: event.event_type,
        status: event.delivery_status,
        attempts: Number(event.attempt_count || 0),
        lastError: event.last_error,
        deliveredAt: event.delivered_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to dispatch ticket agent events.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
