import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const needle = `%${q}%`;

  const [leads, customers, estimates, growthRecords] = await Promise.all([
    sql`
      SELECT l.id, l.issue, l.source, c.name AS customer_name, c.phone AS phone
      FROM leads l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.company_id = ${auth.companyId}
        AND (c.name LIKE ${needle} OR c.phone LIKE ${needle} OR l.issue LIKE ${needle} OR l.location LIKE ${needle})
      ORDER BY l.created_at DESC
      LIMIT 10
    `,
    sql`
      SELECT id, name, phone, email FROM customers
      WHERE company_id = ${auth.companyId}
        AND (name LIKE ${needle} OR phone LIKE ${needle} OR email LIKE ${needle})
      ORDER BY created_at DESC
      LIMIT 8
    `,
    sql`
      SELECT id, estimate_number, title, status FROM estimates
      WHERE company_id = ${auth.companyId}
        AND (estimate_number LIKE ${needle} OR title LIKE ${needle} OR description LIKE ${needle})
      ORDER BY created_at DESC
      LIMIT 8
    `,
    sql`
      SELECT id, record_type, title, status FROM growth_records
      WHERE company_id = ${auth.companyId}
        AND (title LIKE ${needle} OR status LIKE ${needle} OR payload_json LIKE ${needle})
      ORDER BY updated_at DESC
      LIMIT 12
    `,
  ]);

  const results = [
    ...leads.map((r: Record<string, unknown>) => ({
      type: 'lead',
      id: String(r.id),
      title: String(r.customer_name || 'Lead'),
      subtitle: [r.issue, r.phone].filter(Boolean).join(' • '),
      href: `/crm/leads/${r.id}`,
    })),
    ...customers.map((r: Record<string, unknown>) => ({
      type: 'customer',
      id: String(r.id),
      title: String(r.name || ''),
      subtitle: [r.phone, r.email].filter(Boolean).join(' • '),
      href: `/customers/${r.id}`,
    })),
    ...estimates.map((r: Record<string, unknown>) => ({
      type: 'estimate',
      id: String(r.id),
      title: `Estimate ${r.estimate_number}`,
      subtitle: String(r.status || ''),
      href: `/estimates/${r.id}`,
    })),
    ...growthRecords.map((r: Record<string, unknown>) => ({
      type: 'growth',
      id: String(r.id),
      title: String(r.title || 'Growth record'),
      subtitle: [r.record_type, r.status].filter(Boolean).join(' • '),
      href: growthRecordHref(String(r.record_type || '')),
    })),
  ];

  return NextResponse.json({ results });
}

function growthRecordHref(recordType: string) {
  if (recordType === 'campaign') return '/outreach?tab=campaigns';
  if (recordType === 'lead_list') return '/outreach?tab=lists';
  if (recordType === 'asset') return '/marketing?tab=assets';
  if (recordType === 'seo_task') return '/marketing?tab=seo';
  if (recordType === 'project') return '/marketing?tab=projects';
  if (recordType === 'ai_prompt_template') return '/ai-assistant';
  return '/app';
}
