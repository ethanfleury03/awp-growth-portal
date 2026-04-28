export type DeliverySendInput = {
  estimateId: string;
  estimateNumber: string;
  customerName: string;
  title: string;
  totalCents: number;
  expirationDate: string | null;
  publicUrl: string;
  recipientEmail: string | null;
  recipientPhone?: string | null;
  /** When set (non-empty after trim), used instead of the default template for email providers. */
  emailSubject?: string | null;
  emailBody?: string | null;
};

export type DeliveryResult = {
  provider: string;
  provider_message_id: string | null;
  status: 'sent' | 'failed';
  error_message?: string;
  subject: string;
  body: string;
};

export interface EstimateDeliveryProvider {
  readonly name: string;
  send(input: DeliverySendInput): Promise<DeliveryResult>;
}

function formatMoney(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function buildEstimateEmailCopy(input: DeliverySendInput): { subject: string; body: string } {
  const subject = `Estimate ${input.estimateNumber} — ${input.title}`;
  const exp = input.expirationDate
    ? `This estimate is valid through ${input.expirationDate}.`
    : 'Please review the scope and pricing at your earliest convenience.';
  const body = `Hi ${input.customerName},

We've prepared an estimate for the work we discussed.

Estimate: ${input.estimateNumber}
Total: ${formatMoney(input.totalCents)}

${exp}

View and respond here:
${input.publicUrl}

If you have questions, reply to this email or call our office.

Thank you,
Your plumbing team`;
  return { subject, body };
}

export function resolveEmailContent(input: DeliverySendInput): { subject: string; body: string } {
  const built = buildEstimateEmailCopy(input);
  const subject =
    input.emailSubject != null && String(input.emailSubject).trim() !== ''
      ? String(input.emailSubject).trim()
      : built.subject;
  const body =
    input.emailBody != null && String(input.emailBody).trim() !== '' ? String(input.emailBody).trim() : built.body;
  return { subject, body };
}

export function buildEstimateSmsBody(input: DeliverySendInput): { subject: string; body: string } {
  const subject = `Estimate ${input.estimateNumber}`;
  const body = `Hi ${input.customerName}, your estimate ${input.estimateNumber} (${formatMoney(input.totalCents)}) is ready. View & approve: ${input.publicUrl}`;
  return { subject, body };
}

/** Logs to console; always "succeeds". For local/dev. */
export class ConsoleEstimateDeliveryProvider implements EstimateDeliveryProvider {
  readonly name = 'console';

  async send(input: DeliverySendInput): Promise<DeliveryResult> {
    const { subject, body } = resolveEmailContent(input);
    console.log('[estimate-delivery:console]\n', subject, '\n', body);
    return {
      provider: this.name,
      provider_message_id: `console-${Date.now()}`,
      status: 'sent',
      subject,
      body,
    };
  }
}

/** Mock / dev: no external I/O; records-ready payload. */
export class MockEstimateDeliveryProvider implements EstimateDeliveryProvider {
  readonly name = 'mock';

  async send(input: DeliverySendInput): Promise<DeliveryResult> {
    const { subject, body } = resolveEmailContent(input);
    return {
      provider: this.name,
      provider_message_id: `mock-${Date.now()}`,
      status: 'sent',
      subject,
      body,
    };
  }
}

/** Resend (https://resend.com). Set RESEND_API_KEY and ESTIMATE_FROM_EMAIL. */
export class ResendEstimateDeliveryProvider implements EstimateDeliveryProvider {
  readonly name = 'resend';

  async send(input: DeliverySendInput): Promise<DeliveryResult> {
    const { subject, body } = resolveEmailContent(input);
    if (!input.recipientEmail) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: 'No recipient email',
        subject,
        body,
      };
    }
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.ESTIMATE_FROM_EMAIL;
    if (!apiKey || !from) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: 'Missing RESEND_API_KEY or ESTIMATE_FROM_EMAIL',
        subject,
        body,
      };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.recipientEmail],
        subject,
        text: body,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: json.message || `Resend HTTP ${res.status}`,
        subject,
        body,
      };
    }
    return {
      provider: this.name,
      provider_message_id: json.id || null,
      status: 'sent',
      subject,
      body,
    };
  }
}

/** Twilio SMS. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (or TWILIO_FROM_NUMBER). */
export class TwilioSmsEstimateDeliveryProvider implements EstimateDeliveryProvider {
  readonly name = 'twilio_sms';

  async send(input: DeliverySendInput): Promise<DeliveryResult> {
    const { subject, body } = buildEstimateSmsBody(input);
    const to = input.recipientPhone?.trim();
    if (!to) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: 'No recipient phone number',
        subject,
        body,
      };
    }
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: 'Twilio env not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)',
        subject,
        body,
      };
    }
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(sid, token);
      const msg = await client.messages.create({ body, from, to });
      return {
        provider: this.name,
        provider_message_id: msg.sid,
        status: 'sent',
        subject,
        body,
      };
    } catch (e) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: e instanceof Error ? e.message : 'Twilio error',
        subject,
        body,
      };
    }
  }
}

/** Stub when email provider selected but Resend not configured. */
export class EmailEstimateDeliveryProviderStub implements EstimateDeliveryProvider {
  readonly name = 'email_stub';

  async send(input: DeliverySendInput): Promise<DeliveryResult> {
    const { subject, body } = resolveEmailContent(input);
    if (!input.recipientEmail) {
      return {
        provider: this.name,
        provider_message_id: null,
        status: 'failed',
        error_message: 'No recipient email configured',
        subject,
        body,
      };
    }
    return {
      provider: this.name,
      provider_message_id: null,
      status: 'failed',
      error_message:
        'Set RESEND_API_KEY and ESTIMATE_FROM_EMAIL, or use ESTIMATE_DELIVERY_PROVIDER=mock or console.',
      subject,
      body,
    };
  }
}

/** Email provider: Resend when configured, else stub for "email" mode, else mock. */
export function pickEmailProvider(): EstimateDeliveryProvider {
  const mode = (process.env.ESTIMATE_DELIVERY_PROVIDER || 'mock').toLowerCase();
  if (mode === 'console') return new ConsoleEstimateDeliveryProvider();
  if (process.env.RESEND_API_KEY && process.env.ESTIMATE_FROM_EMAIL) {
    return new ResendEstimateDeliveryProvider();
  }
  if (mode === 'email' || mode === 'email_stub' || mode === 'resend') {
    return new EmailEstimateDeliveryProviderStub();
  }
  return new MockEstimateDeliveryProvider();
}

export function getDeliveryProviderFromEnv(): EstimateDeliveryProvider {
  return pickEmailProvider();
}
