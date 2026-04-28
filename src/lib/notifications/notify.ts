/**
 * Notifications framework. Unifies email (Resend) + SMS (Twilio) sends behind
 * a single API and logs every attempt to the `notifications` table so we can:
 *   - Enforce customer consent (email_opt_in / sms_opt_in / sms_opt_out_at).
 *   - Show delivery history in the UI.
 *   - Replay / retry failed sends.
 *
 * Does NOT wrap receptionist SMS (that has its own lifecycle); this is the
 * general-purpose customer comms layer (invoices paid, estimate sent, appt
 * reminders, etc.).
 */

import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';

export type NotifyChannel = 'email' | 'sms';

export interface NotifyInput {
  companyId: string;
  branchId?: string | null;
  channel: NotifyChannel;
  /** Machine name of the template, e.g. 'invoice.paid', 'estimate.sent'. */
  template: string;
  /** Destination email or E.164 phone. */
  to: string;
  customerId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  subject?: string;
  body: string;
  /** Set true to bypass consent checks (e.g. transactional receipts). */
  transactional?: boolean;
}

export interface NotifyResult {
  id: string;
  status: 'queued' | 'sent' | 'failed' | 'suppressed';
  providerMessageId?: string;
  error?: string;
}

async function loadConsent(customerId: string): Promise<{
  emailOptIn: boolean;
  smsOptIn: boolean;
} | null> {
  const rows = await sql`
    SELECT email_opt_in, sms_opt_in, sms_opt_out_at FROM customers WHERE id = ${customerId} LIMIT 1
  `;
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    emailOptIn: Number(r.email_opt_in ?? 1) === 1,
    smsOptIn: Number(r.sms_opt_in ?? 1) === 1 && !r.sms_opt_out_at,
  };
}

async function logNotification(
  input: NotifyInput,
  status: NotifyResult['status'],
  providerMessageId: string | null,
  error: string | null,
): Promise<string> {
  const id = randomUUID();
  await sql`
    INSERT INTO notifications (
      id, company_id, branch_id, channel, template, to_address, customer_id,
      related_entity_type, related_entity_id, subject, body, status,
      provider_message_id, error_message, sent_at
    ) VALUES (
      ${id},
      ${input.companyId},
      ${input.branchId ?? null},
      ${input.channel},
      ${input.template},
      ${input.to},
      ${input.customerId ?? null},
      ${input.relatedEntityType ?? null},
      ${input.relatedEntityId ?? null},
      ${input.subject ?? null},
      ${input.body},
      ${status},
      ${providerMessageId},
      ${error},
      ${status === 'sent' ? new Date().toISOString() : null}
    )
  `;
  return id;
}

async function sendEmail(input: NotifyInput): Promise<{ providerMessageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ESTIMATE_FROM_EMAIL?.trim() || 'WNY Automation Portal <onboarding@resend.dev>';
  if (!apiKey) return { error: 'RESEND_API_KEY not set' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject || `Message from ${input.companyId}`,
        text: input.body,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { error: `resend ${res.status}: ${err.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { providerMessageId: json.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Email send failed' };
  }
}

async function sendSms(input: NotifyInput): Promise<{ providerMessageId?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim() || process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) return { error: 'Twilio not configured' };

  const body = new URLSearchParams({
    To: input.to,
    From: from,
    Body: input.body,
  });
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    if (!res.ok) {
      const err = await res.text();
      return { error: `twilio ${res.status}: ${err.slice(0, 200)}` };
    }
    const json = (await res.json()) as { sid?: string };
    return { providerMessageId: json.sid };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'SMS send failed' };
  }
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  // Consent enforcement — transactional messages (receipts, 2FA, STOP replies)
  // may bypass explicit opt-in per TCPA/CAN-SPAM transactional exemptions.
  if (!input.transactional && input.customerId) {
    const consent = await loadConsent(input.customerId);
    if (consent) {
      if (input.channel === 'email' && !consent.emailOptIn) {
        const id = await logNotification(input, 'suppressed', null, 'email_opt_in=false');
        return { id, status: 'suppressed', error: 'Customer has opted out of email' };
      }
      if (input.channel === 'sms' && !consent.smsOptIn) {
        const id = await logNotification(input, 'suppressed', null, 'sms_opt_in=false');
        return { id, status: 'suppressed', error: 'Customer has opted out of SMS' };
      }
    }
  }

  const result = input.channel === 'email' ? await sendEmail(input) : await sendSms(input);
  if (result.error) {
    const id = await logNotification(input, 'failed', null, result.error);
    return { id, status: 'failed', error: result.error };
  }
  const id = await logNotification(input, 'sent', result.providerMessageId ?? null, null);
  return { id, status: 'sent', providerMessageId: result.providerMessageId };
}

/**
 * Handle an inbound STOP/UNSUBSCRIBE for a phone number. Marks every customer
 * with that phone as opted out and records a `notifications` row for auditing.
 */
export async function handleSmsOptOut(args: {
  companyId: string;
  fromPhone: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await sql`
    UPDATE customers
    SET sms_opt_in = 0, sms_opt_out_at = ${now}, updated_at = datetime('now')
    WHERE company_id = ${args.companyId} AND phone = ${args.fromPhone}
  `;
  await sql`
    INSERT INTO notifications (
      id, company_id, channel, template, to_address, subject, body, status, sent_at
    ) VALUES (
      ${randomUUID()},
      ${args.companyId},
      'sms',
      'system.opt_out',
      ${args.fromPhone},
      ${'STOP received'},
      ${'Customer opted out via STOP keyword'},
      'sent',
      ${now}
    )
  `;
}
