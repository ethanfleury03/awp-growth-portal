import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  normalizeTicketSolutionInput,
  recordTicketSolution,
} from '@/lib/tickets/tickets';

export const runtime = 'nodejs';

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function expectedHermesToken() {
  return (
    process.env.HERMES_TICKETS_API_TOKEN?.trim() ||
    process.env.HERMES_WEBHOOK_TOKEN?.trim() ||
    process.env.WNY_INTERNAL_STATUS_TOKEN?.trim() ||
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN?.trim() ||
    ''
  );
}

function requestToken(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || request.headers.get('x-hermes-ticket-token')?.trim() || '';
}

function tokensMatch(expected: string, actual: string) {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: Request) {
  const expected = expectedHermesToken();
  if (!expected) {
    return NextResponse.json({ error: 'Hermes ticket callback is not configured.' }, { status: 503 });
  }
  if (!tokensMatch(expected, requestToken(request))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeTicketSolutionInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await recordTicketSolution(parsed.value);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const message = messageFromError(error, 'Unable to record ticket solution.');
    return NextResponse.json({ error: message }, { status: message === 'Ticket not found.' ? 404 : 500 });
  }
}
