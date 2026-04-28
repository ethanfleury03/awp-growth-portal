import { NextResponse } from 'next/server';
import { getTwilioWebhookUrlForSignature, handleTwilioInboundVoice } from '@/lib/receptionist/receptionist-live';

/** Twilio signs the webhook using the full form body; validation must receive every field. */
function formDataToParamRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}

function twimlServerErrorSay(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, something went wrong. Please try again later.</Say><Hangup/></Response>`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const formParams = formDataToParamRecord(form);
    const signature = request.headers.get('x-twilio-signature');
    const webhookUrlForSignature = getTwilioWebhookUrlForSignature(request);

    const result = await handleTwilioInboundVoice({
      twilioCallSid: formParams.CallSid ?? '',
      from: formParams.From ?? '',
      to: formParams.To ?? '',
      signature,
      webhookUrlForSignature,
      formParams,
    });

    return new NextResponse(result.twiml, {
      status: result.status,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  } catch (e) {
    console.error('[twilio/voice] unhandled error', e);
    return new NextResponse(twimlServerErrorSay(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }
}
