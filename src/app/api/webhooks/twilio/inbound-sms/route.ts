import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * Twilio inbound SMS webhook. We only care about keyword compliance
 * (STOP / UNSTOP / START) here — conversational SMS lives in the
 * receptionist pipeline.
 *
 * Twilio posts application/x-www-form-urlencoded. We reply with the
 * TwiML <Response> so Twilio sends the confirmation text.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return new NextResponse('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } });

  const from = String(form.get('From') || '').trim();
  const body = String(form.get('Body') || '').trim().toUpperCase();
  if (!from) return new NextResponse('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } });

  const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
  const START_WORDS = new Set(['START', 'UNSTOP', 'YES']);

  if (STOP_WORDS.has(body)) {
    await sql`
      UPDATE customers SET sms_opt_in = 0, sms_opt_out_at = datetime('now'), updated_at = datetime('now')
      WHERE phone = ${from}
    `;
    const reply = 'You have been unsubscribed from SMS notifications. Reply START to resubscribe.';
    return new NextResponse(`<Response><Message>${reply}</Message></Response>`, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  if (START_WORDS.has(body)) {
    await sql`
      UPDATE customers SET sms_opt_in = 1, sms_opt_out_at = NULL, updated_at = datetime('now')
      WHERE phone = ${from}
    `;
    const reply = 'You are resubscribed. Reply STOP at any time to opt out.';
    return new NextResponse(`<Response><Message>${reply}</Message></Response>`, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Unhandled inbound — empty response so Twilio doesn't retry.
  return new NextResponse('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
}
