import { NextResponse } from 'next/server';
import { sql, withSuperAdminContext } from '@/lib/db';
import { getTwilioWebhookUrlForSignature, verifyTwilioRequest } from '@/lib/receptionist/receptionist-live';

/**
 * Twilio inbound SMS webhook. We only care about keyword compliance
 * (STOP / UNSTOP / START) here — conversational SMS lives in the
 * receptionist pipeline.
 *
 * Twilio posts application/x-www-form-urlencoded. We reply with the
 * TwiML <Response> so Twilio sends the confirmation text.
 */

function twiml(body?: string): NextResponse {
  const xml = body ? `<Response><Message>${body}</Message></Response>` : '<Response/>';
  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function formDataToParamRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}

async function resolveCompanyIdForInboundSms(toPhone: string): Promise<string | null> {
  const normalized = toPhone.trim();
  if (!normalized) return null;

  try {
    const phoneRows = await sql`
      SELECT company_id FROM company_phone_numbers
      WHERE phone_e164 = ${normalized}
      LIMIT 1
    `;
    if (phoneRows.length > 0) {
      return String((phoneRows[0] as Record<string, unknown>).company_id);
    }
  } catch {
    // Older local DBs may not have the multi-number table yet.
  }

  const companyRows = await sql`
    SELECT id FROM companies
    WHERE twilio_phone_number = ${normalized}
    LIMIT 1
  `;
  return companyRows[0]?.id ? String(companyRows[0].id) : null;
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return twiml();

  const formParams = formDataToParamRecord(form);
  const signature = request.headers.get('x-twilio-signature');
  const signedUrl = getTwilioWebhookUrlForSignature(request);
  if (!verifyTwilioRequest(signature, signedUrl, formParams)) {
    return twiml();
  }

  const from = String(formParams.From || '').trim();
  const to = String(formParams.To || '').trim();
  const body = String(formParams.Body || '').trim().toUpperCase();
  if (!from || !to) return twiml();

  return withSuperAdminContext(async () => {
  const companyId = await resolveCompanyIdForInboundSms(to);
  if (!companyId) return twiml();

  const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
  const START_WORDS = new Set(['START', 'UNSTOP', 'YES']);

  if (STOP_WORDS.has(body)) {
    await sql`
      UPDATE customers SET sms_opt_in = 0, sms_opt_out_at = datetime('now'), updated_at = datetime('now')
      WHERE company_id = ${companyId} AND phone = ${from}
    `;
    const reply = 'You have been unsubscribed from SMS notifications. Reply START to resubscribe.';
    return twiml(reply);
  }

  if (START_WORDS.has(body)) {
    await sql`
      UPDATE customers SET sms_opt_in = 1, sms_opt_out_at = NULL, updated_at = datetime('now')
      WHERE company_id = ${companyId} AND phone = ${from}
    `;
    const reply = 'You are resubscribed. Reply STOP at any time to opt out.';
    return twiml(reply);
  }

  // Unhandled inbound — empty response so Twilio doesn't retry.
  return twiml();
  });
}
