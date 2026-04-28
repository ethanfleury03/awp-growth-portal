import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import {
  auditTool,
  readRetellToolJson,
  resolvePlumberCallIdFromToolBody,
  toolJsonError,
  toolJsonOk,
  unknownRetellCallMessage,
  verifyRetellToolSecret,
} from '@/lib/receptionist/retell-tool-common';

export async function POST(request: Request) {
  if (!verifyRetellToolSecret(request)) {
    return NextResponse.json(toolJsonError('Unauthorized', 'unauthorized'), { status: 401 });
  }
  const body = await readRetellToolJson(request, 'mark_spam');
  const callId = await resolvePlumberCallIdFromToolBody(body, 'mark_spam');
  if (!callId) {
    return NextResponse.json(toolJsonError(unknownRetellCallMessage(body), 'bad_request'), { status: 400 });
  }
  try {
    await receptionistService.markSpam(callId);
    await auditTool(callId, 'mark_spam', body, { ok: true }, 'ok');
    return NextResponse.json(toolJsonOk({ marked: true }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    await auditTool(callId, 'mark_spam', body, { error: msg }, 'error');
    return NextResponse.json(toolJsonError(msg, 'tool_error'), { status: 400 });
  }
}
