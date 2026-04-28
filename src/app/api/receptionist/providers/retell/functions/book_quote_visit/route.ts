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
  const body = await readRetellToolJson(request, 'book_quote_visit');
  const callId = await resolvePlumberCallIdFromToolBody(body, 'book_quote_visit');
  if (!callId) {
    logRetellToolDebug('book_quote_visit', request, {
      normalizedBody: body,
      message: 'resolvePlumberCallIdFromToolBody returned undefined',
    });
    return NextResponse.json(toolJsonError(unknownRetellCallMessage(body), 'bad_request'), { status: 400 });
  }
  try {
    await mergeRetellToolConfirmationsOntoCall(callId, body);
    await mergeExtractedOntoCall(callId, partialExtractedFromToolArgs(body));
    const out = await receptionistService.bookQuoteVisitFromCall(callId);
    await auditTool(callId, 'book_quote_visit', body, out, 'ok');
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
    await auditTool(callId, 'book_quote_visit', body, { error: msg }, 'error');
    logReceptionistHardening('book_quote_visit_tool_failed', { callId, reason: msg.slice(0, 200) });
    try {
      await receptionistService.createLeadFromCall(callId);
      await mergeReceptionistMetaPartial(callId, {
        internalOutcome: 'booking_failed_fallback_lead_created',
        lastToolError: { tool: 'book_quote_visit', message: msg, at: new Date().toISOString() },
        toolFallbacks: [{ tool: 'book_quote_visit', action: 'create_lead_fallback', reason: msg.slice(0, 120) }],
      });
      logReceptionistHardening('book_quote_fallback_lead_ok', { callId });
    } catch {
      await receptionistService.recordToolFailureFallback(
        callId,
        'book_quote_visit',
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
