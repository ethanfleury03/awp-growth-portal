import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import {
  auditTool,
  mergeExtractedOntoCall,
  partialExtractedFromToolArgs,
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
  const body = await readRetellToolJson(request, 'create_lead');
  const callId = await resolvePlumberCallIdFromToolBody(body, 'create_lead');
  if (!callId) {
    return NextResponse.json(toolJsonError(unknownRetellCallMessage(body), 'bad_request'), {
      status: 400,
    });
  }
  try {
    await mergeExtractedOntoCall(callId, partialExtractedFromToolArgs(body));
    const out = await receptionistService.createLeadFromCall(callId);
    await auditTool(callId, 'create_lead', body, out, 'ok');
    return NextResponse.json(
      toolJsonOk({
        leadId: out.leadId,
        alreadyLinked: out.alreadyLinked,
        ...(('crossCallMerged' in out && out.crossCallMerged) ? { crossCallMerged: true } : {}),
        ...(('idempotentReplay' in out && out.idempotentReplay) ? { idempotentReplay: true } : {}),
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    await auditTool(callId, 'create_lead', body, { error: msg }, 'error');
    return NextResponse.json(toolJsonError(msg, 'tool_error'), { status: 400 });
  }
}
