import { NextResponse } from 'next/server';
import { logReceptionistEvent } from '@/lib/receptionist/repository';
import {
  auditTool,
  logRetellToolDebug,
  notesFromRetellToolBody,
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
  const body = await readRetellToolJson(request, 'end_call_notes');
  const callId = await resolvePlumberCallIdFromToolBody(body, 'end_call_notes');
  if (!callId) {
    logRetellToolDebug('end_call_notes', request, {
      normalizedBody: body,
      message: 'resolvePlumberCallIdFromToolBody returned undefined',
    });
    return NextResponse.json(toolJsonError(unknownRetellCallMessage(body), 'bad_request'), { status: 400 });
  }
  const notes = notesFromRetellToolBody(body);
  await logReceptionistEvent(callId, 'end_call_notes', { notes }, 'retell');
  await auditTool(callId, 'end_call_notes', body, { ok: true }, 'ok');
  return NextResponse.json(toolJsonOk({ logged: true }));
}
