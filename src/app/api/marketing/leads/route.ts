import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { consumePublicRateLimit, publicRateLimitConfig } from '@/lib/public-rate-limit';
import { getPortalUser } from '@/lib/auth/portal-user';
import {
  insertMarketingLead,
  ipHash,
  notifyLeadEmail,
  notifyLeadSlack,
  type MarketingLeadKind,
} from '@/lib/marketing/leads';

const leadSchema = z.object({
  kind: z.enum(['demo', 'contact', 'waitlist', 'general']),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  company: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  trade: z.string().max(80).optional(),
  message: z.string().max(4000).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  referrer: z.string().max(500).optional(),
  website: z.string().optional(), // honeypot
});

function readIp(request: Request): string {
  const xf = request.headers.get('x-forwarded-for');
  const first = xf?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function parseCookie(name: string, cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (!part.startsWith(`${name}=`)) continue;
    return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

function isValidCsrf(request: Request): boolean {
  const header = request.headers.get('x-csrf-token')?.trim();
  const cookie = parseCookie('pos_csrf', request.headers.get('cookie'));
  return Boolean(header && cookie && header.length >= 16 && cookie.length >= 16 && header === cookie);
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = leadSchema.parse(json);
    if ((body.website || '').trim().length > 0) {
      return NextResponse.json({ ok: true }, { status: 202 });
    }
    if (!isValidCsrf(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token.' }, { status: 403 });
    }

    const ip = readIp(request);
    const { max, windowMs } = publicRateLimitConfig();
    const key = `marketing-lead:${body.kind}:${ip}`;
    const limited = consumePublicRateLimit(key, Math.min(max, 12), windowMs);
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many submissions. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } },
      );
    }

    const { userId } = await auth();
    const portal = userId ? await getPortalUser().catch(() => null) : null;

    const leadId = await insertMarketingLead({
      kind: body.kind as MarketingLeadKind,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      company: body.company?.trim() || null,
      phone: body.phone?.trim() || null,
      trade: body.trade?.trim() || null,
      message: body.message?.trim() || null,
      utmSource: body.utmSource?.trim() || null,
      utmMedium: body.utmMedium?.trim() || null,
      utmCampaign: body.utmCampaign?.trim() || null,
      referrer: body.referrer?.trim() || request.headers.get('referer') || null,
      userAgent: request.headers.get('user-agent') || null,
      ipHash: ipHash(ip),
      companyId: portal?.companyId || null,
    });

    const notifyInput = {
      kind: body.kind as MarketingLeadKind,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      company: body.company?.trim() || null,
      phone: body.phone?.trim() || null,
      trade: body.trade?.trim() || null,
      message: body.message?.trim() || null,
      utmSource: body.utmSource?.trim() || null,
      utmMedium: body.utmMedium?.trim() || null,
      utmCampaign: body.utmCampaign?.trim() || null,
    };

    await Promise.allSettled([
      notifyLeadSlack(notifyInput, leadId),
      notifyLeadEmail(notifyInput, leadId),
    ]);

    return NextResponse.json({ ok: true, id: leadId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid form payload.' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not submit lead.' },
      { status: 500 },
    );
  }
}
