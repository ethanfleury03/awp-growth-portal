import { createHash, randomUUID } from 'crypto';
import { sql } from '@/lib/db';

export type MarketingLeadKind = 'demo' | 'contact' | 'waitlist' | 'general';

export interface MarketingLeadInput {
  kind: MarketingLeadKind;
  name: string;
  email: string;
  company?: string | null;
  phone?: string | null;
  trade?: string | null;
  message?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipHash?: string | null;
  companyId?: string | null;
}

export function ipHash(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex');
}

export async function ensureMarketingLeadsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS marketing_leads (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      trade TEXT,
      message TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_marketing_leads_kind ON marketing_leads(kind)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_marketing_leads_email ON marketing_leads(email)`;
}

export async function insertMarketingLead(input: MarketingLeadInput): Promise<string> {
  await ensureMarketingLeadsTable();
  const id = randomUUID();
  await sql`
    INSERT INTO marketing_leads (
      id, company_id, kind, name, email, company, phone, trade, message,
      utm_source, utm_medium, utm_campaign, referrer, user_agent, ip_hash,
      created_at, updated_at
    ) VALUES (
      ${id},
      ${input.companyId ?? null},
      ${input.kind},
      ${input.name},
      ${input.email},
      ${input.company ?? null},
      ${input.phone ?? null},
      ${input.trade ?? null},
      ${input.message ?? null},
      ${input.utmSource ?? null},
      ${input.utmMedium ?? null},
      ${input.utmCampaign ?? null},
      ${input.referrer ?? null},
      ${input.userAgent ?? null},
      ${input.ipHash ?? null},
      datetime('now'),
      datetime('now')
    )
  `;
  return id;
}

export async function notifyLeadSlack(input: MarketingLeadInput, leadId: string): Promise<void> {
  const webhook = process.env.SLACK_LEADS_WEBHOOK_URL?.trim();
  if (!webhook) return;
  const lines = [
    `*New ${input.kind} lead*`,
    `ID: ${leadId}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.company ? `Company: ${input.company}` : '',
    input.phone ? `Phone: ${input.phone}` : '',
    input.trade ? `Workflow: ${input.trade}` : '',
    input.message ? `Message: ${input.message}` : '',
    input.utmSource ? `UTM Source: ${input.utmSource}` : '',
    input.utmMedium ? `UTM Medium: ${input.utmMedium}` : '',
    input.utmCampaign ? `UTM Campaign: ${input.utmCampaign}` : '',
  ].filter(Boolean);
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: lines.join('\n') }),
  }).catch(() => undefined);
}

export async function notifyLeadEmail(input: MarketingLeadInput, leadId: string): Promise<void> {
  const to = process.env.SALES_NOTIFY_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!to || !apiKey) return;

  const from = process.env.ESTIMATE_FROM_EMAIL?.trim() || 'WNY Automation Portal <onboarding@resend.dev>';
  const text = [
    `New ${input.kind} lead`,
    `ID: ${leadId}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.company ? `Company: ${input.company}` : '',
    input.phone ? `Phone: ${input.phone}` : '',
    input.trade ? `Workflow: ${input.trade}` : '',
    input.message ? `Message: ${input.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `[WNY Automation Portal] New ${input.kind} lead`,
      text,
    }),
  }).catch(() => undefined);
}
