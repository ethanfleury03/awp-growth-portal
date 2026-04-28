import { clerkClient } from '@clerk/nextjs/server';
import type { DeliveryResult, DeliverySendInput } from '@/lib/estimates/delivery';
import { resolveEmailContent } from '@/lib/estimates/delivery';

function base64UrlEncodeUtf8(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function gmailProfileEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { emailAddress?: string };
  return j.emailAddress || null;
}

async function sendGmailApi(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const rfc822 = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');
  const raw = base64UrlEncodeUtf8(rfc822);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  const j = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok) {
    return { ok: false, error: j.error?.message || `Gmail HTTP ${res.status}` };
  }
  return { ok: true, id: j.id };
}

async function graphSendMail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (res.ok) return { ok: true };
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return { ok: false, error: j.error?.message || `Graph HTTP ${res.status}` };
}

/**
 * Sends estimate email via the signed-in user's Google or Microsoft account (Clerk OAuth tokens).
 * Returns failed with a message when no provider token / scope — caller should fall back to Resend.
 */
export async function sendEstimateViaClerkMailbox(
  clerkUserId: string,
  input: DeliverySendInput,
): Promise<DeliveryResult> {
  const { subject, body } = resolveEmailContent(input);
  const to = input.recipientEmail?.trim();
  if (!to) {
    return {
      provider: 'clerk_mailbox',
      provider_message_id: null,
      status: 'failed',
      error_message: 'No recipient email',
      subject,
      body,
    };
  }

  const client = await clerkClient();

  try {
    const googleRes = await client.users.getUserOauthAccessToken(clerkUserId, 'google');
    const googleTok = googleRes.data[0]?.token;
    if (googleTok) {
      const from = await gmailProfileEmail(googleTok);
      if (!from) {
        return {
          provider: 'clerk_gmail',
          provider_message_id: null,
          status: 'failed',
          error_message: 'Could not read Gmail profile (check gmail.send scope in Clerk Dashboard).',
          subject,
          body,
        };
      }
      const sent = await sendGmailApi(googleTok, from, to, subject, body);
      if (sent.ok) {
        return {
          provider: 'clerk_gmail',
          provider_message_id: sent.id || null,
          status: 'sent',
          subject,
          body,
        };
      }
      return {
        provider: 'clerk_gmail',
        provider_message_id: null,
        status: 'failed',
        error_message: sent.error || 'Gmail send failed',
        subject,
        body,
      };
    }
  } catch {
    // No Google connection or token API error — try Microsoft.
  }

  try {
    const msRes = await client.users.getUserOauthAccessToken(clerkUserId, 'microsoft');
    const msTok = msRes.data[0]?.token;
    if (msTok) {
      const sent = await graphSendMail(msTok, to, subject, body);
      if (sent.ok) {
        return {
          provider: 'clerk_microsoft',
          provider_message_id: null,
          status: 'sent',
          subject,
          body,
        };
      }
      return {
        provider: 'clerk_microsoft',
        provider_message_id: null,
        status: 'failed',
        error_message: sent.error || 'Microsoft send failed',
        subject,
        body,
      };
    }
  } catch {
    // No Microsoft token
  }

  return {
    provider: 'clerk_mailbox',
    provider_message_id: null,
    status: 'failed',
    error_message:
      'No Google or Microsoft mailbox connected. Sign in with Google/Microsoft or add Mail scopes in Clerk, then reconnect the account.',
    subject,
    body,
  };
}
