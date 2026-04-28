import { NextResponse } from 'next/server';
import { logReceptionistHardening } from '@/lib/receptionist/hardening/heuristics';
import { mergeReceptionistMetaPartial } from '@/lib/receptionist/repository';
import { receptionistService } from '@/lib/receptionist/service';
import {
  auditTool,
  logRetellToolDebug,
  mergeExtractedOntoCall,
  mergeRetellToolConfirmationsOntoCall,
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
  const body = await readRetellToolJson(request, 'book_callback');
  const callId = await resolvePlumberCallIdFromToolBody(body, 'book_callback');
  if (!callId) {
    logRetellToolDebug('book_callback', request, {
      normalizedBody: body,
      message: 'resolvePlumberCallIdFromToolBody returned undefined',
    });
    return NextResponse.json(toolJsonError(unknownRetellCallMessage(body), 'bad_request'), { status: 400 });
  }
  try {
    await mergeRetellToolConfirmationsOntoCall(callId, body);
    await mergeExtractedOntoCall(callId, partialExtractedFromToolArgs(body));
    const out = await receptionistService.bookCallbackFromCall(callId);
    await auditTool(callId, 'book_callback', body, out, 'ok');
    return NextResponse.json(
      toolJsonOk({
        bookingId: out.bookingId,
        jobId: out.jobId,
        duplicate: out.duplicate,
        ...(('crossCallMerged' in out && out.crossCallMerged) ? { crossCallMerged: true } : {}),
        ...(('idempotentReplay' in out && out.idempotentReplay) ? { idempotentReplay: true } : {}),
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    await auditTool(callId, 'book_callback', body, { error: msg }, 'error');
    logReceptionistHardening('book_callback_tool_failed', { callId, reason: msg.slice(0, 200) });
    try {
      await receptionistService.createLeadFromCall(callId);
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_failed_fallback_lead_created',
        lastToolError: { tool: 'book_callback', message: msg, at: new Date().toISOString() },
        toolFallbacks: [{ tool: 'book_callback', action: 'create_lead_fallback', reason: msg.slice(0, 120) }],
      });
      logReceptionistHardening('book_callback_fallback_lead_ok', { callId });
    } catch {
      await receptionistService.recordToolFailureFallback(
        callId,
        'book_callback',
        msg,
        'booking_failed_follow_up_needed',
      );
    }
    return NextResponse.json(
      toolJsonOk({
        bookingFailed: true,
        reason: msg,
        humanFollowUp: true,
      }),
    );
  }
}
