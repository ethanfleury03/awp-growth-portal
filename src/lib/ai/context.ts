import { awpBusinessProfile, pipelineLabel, sourceFromSlug } from '@/lib/awp/config';
import { sql } from '@/lib/db';
import { parseJsonSafely } from '@/lib/ops';

export type KnowledgeMatch = {
  id: string;
  title: string;
  itemType: string;
  body: string;
  url: string;
  tags: string[];
};

function words(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 20);
}

function parseTags(value: unknown): string[] {
  const parsed = parseJsonSafely<unknown[]>(typeof value === 'string' ? value : '');
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export async function findKnowledgeMatches(companyId: string, query: string, limit = 8): Promise<KnowledgeMatch[]> {
  const rows = await sql`
    SELECT id, title, item_type, body, url, tags_json, is_pinned, updated_at
    FROM knowledge_items
    WHERE company_id = ${companyId} AND status != 'Archived'
    ORDER BY is_pinned DESC, updated_at DESC
    LIMIT 80
  `;

  const terms = words(query);
  return rows
    .map((row) => {
      const haystack = [row.title, row.item_type, row.body, row.url, row.tags_json].join(' ').toLowerCase();
      const score = Number(row.is_pinned ? 5 : 0) + terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { row, score };
    })
    .filter((item) => item.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({
      id: String(row.id),
      title: String(row.title || ''),
      itemType: String(row.item_type || 'Other'),
      body: String(row.body || ''),
      url: String(row.url || ''),
      tags: parseTags(row.tags_json),
    }));
}

export async function buildAwpAgentContext(companyId: string, query: string) {
  const [leadRows, growthRows, knowledge] = await Promise.all([
    sql`
      SELECT l.id, l.issue, l.source, l.status, l.ai_score, l.estimated_value_cents, c.name AS customer_name
      FROM leads l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.company_id = ${companyId}
      ORDER BY l.created_at DESC
      LIMIT 30
    `,
    sql`
      SELECT record_type, title, status, payload_json
      FROM growth_records
      WHERE company_id = ${companyId}
      ORDER BY updated_at DESC
      LIMIT 40
    `,
    findKnowledgeMatches(companyId, query),
  ]);

  const leads = leadRows.map((lead) => ({
    name: String(lead.customer_name || 'Lead'),
    interest: String(lead.issue || ''),
    source: sourceFromSlug(String(lead.source || '')),
    stage: pipelineLabel(String(lead.status || '')),
    score: lead.ai_score ?? null,
    value: lead.estimated_value_cents ?? null,
  }));

  const growth = growthRows.map((record) => ({
    type: String(record.record_type || ''),
    title: String(record.title || ''),
    status: String(record.status || ''),
    payload: parseJsonSafely<Record<string, unknown>>(String(record.payload_json || '')) || {},
  }));

  return {
    business: awpBusinessProfile,
    leads,
    growth,
    knowledge,
  };
}

export function buildSystemPrompt(context: Awaited<ReturnType<typeof buildAwpAgentContext>>) {
  return [
    `You are the AI Growth Assistant inside ${context.business.productName}.`,
    `Business: ${context.business.businessName} (${context.business.shortName}).`,
    `Core offer: ${context.business.coreOffer}. Region: ${context.business.primaryRegion}.`,
    `Use these differentiators: ${context.business.differentiators.join(', ')}.`,
    context.business.aiGuardrail,
    '',
    'You help with leads, outreach, marketing, website/SEO, case studies, reports, and internal planning.',
    'You are not a phone receptionist or voice automation assistant.',
    'Never directly mutate CRM data. If a change is useful, include it as a draft action only.',
    '',
    'Return strict JSON with this shape:',
    '{"reply":"helpful markdown answer","actionDrafts":[{"actionType":"follow_up_email|lead_summary|outreach_campaign|marketing_task|seo_task|report_draft|lead_status_update","title":"short title","payload":{}}]}',
    'If no action draft is needed, return an empty actionDrafts array.',
    '',
    `Knowledge matches: ${JSON.stringify(context.knowledge)}`,
    `Recent leads: ${JSON.stringify(context.leads.slice(0, 15))}`,
    `Growth records: ${JSON.stringify(context.growth.slice(0, 20))}`,
  ].join('\n');
}
