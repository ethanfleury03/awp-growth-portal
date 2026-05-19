import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql, withSuperAdminContext } from '@/lib/db';
import { applyTicketAgentLifecycleUpdate } from '@/lib/tickets/shared-ticket-board';

const MAX_ARTIFACTS = 20;

const AgentStatusPayload = z.object({
  ticket_id: z.string().trim().min(1),
  company_id: z.string().trim().optional(),
  task_id: z.string().trim().optional(),
  run_id: z.string().trim().optional(),
  status: z.string().trim().min(1).max(80),
  message: z.string().trim().max(8000).optional(),
  summary: z.string().trim().max(12000).optional(),
  result: z.string().trim().max(20000).optional(),
  result_summary: z.string().trim().max(12000).optional(),
  solution_summary: z.string().trim().max(12000).optional(),
  artifact_paths: z.array(z.string().trim().min(1).max(1200)).max(MAX_ARTIFACTS).optional(),
  artifact_urls: z.array(z.string().trim().min(1).max(1200)).max(MAX_ARTIFACTS).optional(),
  drive_links: z.array(z.string().trim().min(1).max(1200)).max(MAX_ARTIFACTS).optional(),
  file_links: z.array(z.string().trim().min(1).max(1200)).max(MAX_ARTIFACTS).optional(),
});

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

function configuredCallbackToken() {
  return (
    process.env.HERMES_AGENT_CALLBACK_TOKEN ||
    process.env.HERMES_ROUTER_DISPATCH_TOKEN ||
    process.env.WNY_INTERNAL_STATUS_TOKEN ||
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN ||
    ''
  ).trim();
}

function configuredHmacSecret() {
  return (
    process.env.HERMES_AGENT_CALLBACK_SECRET ||
    process.env.HERMES_ROUTER_WEBHOOK_SECRET ||
    ''
  ).trim();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hmacSignatureValid(request: Request, rawBody: string) {
  const secret = configuredHmacSecret();
  if (!secret) return false;

  const timestamp = request.headers.get('x-wny-timestamp')?.trim() || '';
  const signatureHeader = request.headers.get('x-wny-signature')?.trim() || '';
  const signature = signatureHeader.replace(/^sha256=/i, '');
  if (!timestamp || !signature) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return safeEqual(signature, expected);
}

function requestAuthorized(request: Request, rawBody: string) {
  const expectedToken = configuredCallbackToken();
  const token = bearerToken(request) || request.headers.get('x-gateway-service-token')?.trim() || '';
  if (expectedToken && token && safeEqual(token, expectedToken)) return true;
  return hmacSignatureValid(request, rawBody);
}

async function findTicketCompany(ticketId: string) {
  return withSuperAdminContext(async () => {
    const rows = await sql`
      SELECT id, company_id
      FROM admin_tickets
      WHERE id = ${ticketId}
      LIMIT 1
    `;
    return rows[0] as { id: string; company_id: string } | undefined;
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!requestAuthorized(request, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody || '{}');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = AgentStatusPayload.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid agent status payload.' }, { status: 400 });
  }

  const ticket = await findTicketCompany(parsed.data.ticket_id);
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  }
  if (parsed.data.company_id && parsed.data.company_id !== String(ticket.company_id)) {
    return NextResponse.json({ error: 'Ticket does not belong to that company.' }, { status: 409 });
  }

  try {
    const result = await applyTicketAgentLifecycleUpdate({
      ticketId: parsed.data.ticket_id,
      companyId: String(ticket.company_id),
      status: parsed.data.status,
      message: parsed.data.message,
      result: parsed.data.result || parsed.data.summary || parsed.data.result_summary || parsed.data.solution_summary,
      artifactPaths: parsed.data.artifact_paths || [],
      artifactUrls: [
        ...(parsed.data.artifact_urls || []),
        ...(parsed.data.drive_links || []),
        ...(parsed.data.file_links || []),
      ],
    });

    return NextResponse.json({
      ok: true,
      ticketId: parsed.data.ticket_id,
      taskId: parsed.data.task_id || null,
      runId: parsed.data.run_id || null,
      status: parsed.data.status,
      bucketMoved: result.bucketMoved,
      bucketName: result.bucketName,
      commentId: result.comment.id,
      ticket: result.ticket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to apply agent status.';
    const status = message === 'Ticket not found.' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
