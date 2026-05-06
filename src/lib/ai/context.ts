import fs from 'fs/promises';
import { awpBusinessProfile, pipelineLabel, sourceFromSlug, sourceToSlug } from '@/lib/awp/config';
import { isLocalAttachmentKey, localAttachmentPath, publicUrlFor, r2ConfigFromEnv } from '@/lib/attachments/r2';
import { sql } from '@/lib/db';
import { parseJsonSafely } from '@/lib/ops';

export type KnowledgeAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  url: string | null;
  contentStatus: 'metadata_only' | 'text_snippet' | 'unreadable';
  contentSnippet?: string;
};

export type KnowledgeMatch = {
  id: string;
  title: string;
  itemType: string;
  body: string;
  url: string;
  tags: string[];
  sourceMetadata: Record<string, unknown>;
  attachments: KnowledgeAttachment[];
};

export type SourceReferenceKind =
  | 'portal_summary'
  | 'pipeline'
  | 'lead'
  | 'customer'
  | 'estimate'
  | 'invoice'
  | 'growth_record'
  | 'knowledge_item'
  | 'attachment';

export type SourceReference = {
  id: string;
  kind: SourceReferenceKind;
  title: string;
  subtitle: string;
  href: string;
  sourceArea: string;
  evidence: string;
  parentId?: string;
};

export type PortalSummary = {
  company: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  counts: {
    leads: number;
    customers: number;
    estimates: number;
    invoices: number;
    growthRecords: number;
    knowledgeItems: number;
    reusableArchitecture: number;
    attachments: number;
    openActionDrafts: number;
  };
};

type PipelineContextRecord = {
  id: string;
  title: string;
  status: string;
  color: string;
  count: number;
  valueCents: number;
};

type LeadContextRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  interest: string;
  description: string;
  source: string;
  stage: string;
  score: unknown;
  value: unknown;
  nextFollowUpAt: unknown;
  context: Record<string, unknown>;
};

type CustomerContextRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

type EstimateContextRecord = {
  id: string;
  number: string;
  title: string;
  status: string;
  customerName: string;
  totalCents: number;
  expirationDate: unknown;
};

type InvoiceContextRecord = {
  id: string;
  number: string;
  serviceType: string;
  status: string;
  customerName: string;
  totalCents: number;
  dueDate: unknown;
  paidDate: unknown;
};

type GrowthContextRecord = {
  id: string;
  type: string;
  title: string;
  status: string;
  owner: string;
  relatedRecordId: unknown;
  isDemo: boolean;
  payload: Record<string, unknown>;
};

export type SourceContextInput = {
  query: string;
  summary: PortalSummary;
  pipeline: PipelineContextRecord[];
  leads: LeadContextRecord[];
  customers: CustomerContextRecord[];
  estimates: EstimateContextRecord[];
  invoices: InvoiceContextRecord[];
  growth: GrowthContextRecord[];
  knowledge: KnowledgeMatch[];
};

function num(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function words(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 20);
}

const SOURCE_STOPWORDS = new Set([
  'about',
  'also',
  'and',
  'are',
  'can',
  'could',
  'for',
  'from',
  'how',
  'into',
  'our',
  'please',
  'should',
  'that',
  'the',
  'this',
  'what',
  'when',
  'where',
  'who',
  'why',
  'with',
  'would',
  'you',
]);

const BROAD_SOURCE_TERMS = new Set([
  'activity',
  'assistant',
  'crm',
  'dashboard',
  'growth',
  'overview',
  'pipeline',
  'portal',
  'recommend',
  'report',
  'reports',
  'summary',
  'summarize',
  'today',
  'week',
]);

function sourceTerms(input: string) {
  return words(input).filter((word) => !SOURCE_STOPWORDS.has(word));
}

function compactText(value: unknown, max = 140) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function formatDollarsFromCents(value: unknown) {
  const cents = num(value);
  if (!cents) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function isBroadSourceQuery(query: string) {
  const allTerms = words(query);
  if (!allTerms.length) return true;
  return allTerms.some((term) => BROAD_SOURCE_TERMS.has(term));
}

function mentionsAny(query: string, aliases: string[]) {
  const normalized = ` ${query.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return aliases.some((alias) => normalized.includes(` ${alias.toLowerCase()} `));
}

function matchesSourceQuery(query: string, parts: unknown[]) {
  const terms = sourceTerms(query);
  if (!terms.length) return false;
  const haystack = parts
    .map((part) => (typeof part === 'string' ? part : JSON.stringify(part || '')))
    .join(' ')
    .toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function uniquePush(sources: SourceReference[], source: SourceReference) {
  if (!sources.some((item) => item.id === source.id)) sources.push(source);
}

function pushCapped(
  sources: SourceReference[],
  candidates: SourceReference[],
  maxForGroup: number,
  maxTotal: number,
) {
  let added = 0;
  for (const candidate of candidates) {
    if (added >= maxForGroup || sources.length >= maxTotal) return;
    if (sources.some((item) => item.id === candidate.id)) continue;
    sources.push(candidate);
    added += 1;
  }
}

function sourceFromSummary(summary: PortalSummary): SourceReference {
  return {
    id: 'portal_summary:current',
    kind: 'portal_summary',
    title: summary.company.name || awpBusinessProfile.businessName,
    subtitle: 'Portal snapshot',
    href: '/app',
    sourceArea: 'Portal',
    evidence: compactText(
      `${summary.counts.leads} leads, ${summary.counts.customers} customers, ${summary.counts.estimates} estimates, ${summary.counts.invoices} invoices, ${summary.counts.growthRecords} growth records, ${summary.counts.knowledgeItems} KB items.`,
    ),
  };
}

function sourceFromPipeline(pipeline: PipelineContextRecord[]): SourceReference {
  const topBuckets = pipeline
    .slice(0, 5)
    .map((bucket) => `${bucket.title}: ${bucket.count}`)
    .join(', ');
  return {
    id: 'pipeline:crm',
    kind: 'pipeline',
    title: 'CRM Pipeline',
    subtitle: `${pipeline.length} buckets`,
    href: '/crm',
    sourceArea: 'CRM',
    evidence: compactText(topBuckets || 'Pipeline buckets and lead counts.'),
  };
}

function sourceFromKnowledge(item: KnowledgeMatch): SourceReference {
  const confidence = String(item.sourceMetadata?.confidence || '');
  const isArchitecture = item.itemType === 'Reusable Architecture';
  return {
    id: `knowledge_item:${item.id}`,
    kind: 'knowledge_item',
    title: item.title,
    subtitle: [item.itemType, confidence].filter(Boolean).join(' / '),
    href: '/settings',
    sourceArea: isArchitecture ? 'Reusable Architecture' : 'Knowledge Base',
    evidence: compactText(item.body || item.tags.join(', ') || 'Settings knowledge item.'),
  };
}

function sourceFromAttachment(attachment: KnowledgeAttachment, parentId: string): SourceReference {
  const contentLabel =
    attachment.contentStatus === 'text_snippet'
      ? 'Text snippet available'
      : attachment.contentStatus === 'unreadable'
        ? 'File metadata only; content unreadable'
        : 'File metadata only';
  return {
    id: `attachment:${attachment.id}`,
    kind: 'attachment',
    title: attachment.fileName || 'Uploaded file',
    subtitle: attachment.mimeType || contentLabel,
    href: attachment.url || `/api/attachments/${attachment.id}`,
    sourceArea: 'Knowledge Files',
    evidence: compactText(attachment.contentSnippet || contentLabel),
    parentId,
  };
}

function sourceFromLead(lead: LeadContextRecord): SourceReference {
  return {
    id: `lead:${lead.id}`,
    kind: 'lead',
    title: lead.name || 'Lead',
    subtitle: [lead.stage, lead.source, lead.score ? `Score ${lead.score}` : ''].filter(Boolean).join(' / '),
    href: `/crm/leads/${lead.id}`,
    sourceArea: 'CRM',
    evidence: compactText([lead.interest, lead.description, formatDollarsFromCents(lead.value)].filter(Boolean).join(' / ')),
  };
}

function sourceFromCustomer(customer: CustomerContextRecord): SourceReference {
  return {
    id: `customer:${customer.id}`,
    kind: 'customer',
    title: customer.name || 'Customer',
    subtitle: [customer.email, customer.phone].filter(Boolean).join(' / '),
    href: `/customers/${customer.id}`,
    sourceArea: 'Customers',
    evidence: compactText([customer.address, customer.notes].filter(Boolean).join(' / ') || 'Customer record.'),
  };
}

function sourceFromEstimate(estimate: EstimateContextRecord): SourceReference {
  return {
    id: `estimate:${estimate.id}`,
    kind: 'estimate',
    title: estimate.number ? `Estimate ${estimate.number}` : estimate.title || 'Estimate',
    subtitle: [estimate.status, estimate.customerName].filter(Boolean).join(' / '),
    href: `/estimates/${estimate.id}`,
    sourceArea: 'Estimates',
    evidence: compactText([estimate.title, formatDollarsFromCents(estimate.totalCents), estimate.expirationDate ? `Expires ${estimate.expirationDate}` : ''].filter(Boolean).join(' / ')),
  };
}

function sourceFromInvoice(invoice: InvoiceContextRecord): SourceReference {
  return {
    id: `invoice:${invoice.id}`,
    kind: 'invoice',
    title: invoice.number ? `Invoice ${invoice.number}` : invoice.serviceType || 'Invoice',
    subtitle: [invoice.status, invoice.customerName].filter(Boolean).join(' / '),
    href: '/invoices',
    sourceArea: 'Invoices',
    evidence: compactText([invoice.serviceType, formatDollarsFromCents(invoice.totalCents), invoice.dueDate ? `Due ${invoice.dueDate}` : ''].filter(Boolean).join(' / ')),
  };
}

function growthHref(record: GrowthContextRecord) {
  if (record.owner.toLowerCase().includes('report')) return '/reports';
  if (['campaign', 'list'].includes(record.type)) return '/outreach';
  if (['seo_task', 'project', 'asset'].includes(record.type)) return '/marketing';
  return '/ai-assistant';
}

function sourceFromGrowth(record: GrowthContextRecord): SourceReference {
  return {
    id: `growth_record:${record.id}`,
    kind: 'growth_record',
    title: record.title || 'Growth record',
    subtitle: [record.type, record.status, record.owner].filter(Boolean).join(' / '),
    href: growthHref(record),
    sourceArea: 'Growth Records',
    evidence: compactText(JSON.stringify(record.payload || {}), 160),
  };
}

export function buildDeterministicSources(input: SourceContextInput): SourceReference[] {
  const maxTotal = 16;
  const sources: SourceReference[] = [];
  const broad = isBroadSourceQuery(input.query);

  if (broad) {
    uniquePush(sources, sourceFromSummary(input.summary));
    if (input.pipeline.length) uniquePush(sources, sourceFromPipeline(input.pipeline));
  }

  const knowledgeSources = input.knowledge.map(sourceFromKnowledge);
  pushCapped(sources, knowledgeSources, 6, maxTotal);

  const attachmentSources = input.knowledge.flatMap((item) =>
    item.attachments.map((attachment) => sourceFromAttachment(attachment, `knowledge_item:${item.id}`)),
  );
  pushCapped(sources, attachmentSources, 6, maxTotal);

  const leadCandidates = input.leads
    .filter((lead) =>
      mentionsAny(input.query, ['lead', 'leads', 'crm', 'pipeline', 'follow', 'followup', 'followups']) ||
      matchesSourceQuery(input.query, [lead.name, lead.email, lead.phone, lead.interest, lead.description, lead.source, lead.stage, lead.context]),
    )
    .map(sourceFromLead);
  pushCapped(sources, leadCandidates, 2, maxTotal);

  const customerCandidates = input.customers
    .filter((customer) =>
      mentionsAny(input.query, ['customer', 'customers', 'client', 'clients']) ||
      matchesSourceQuery(input.query, [customer.name, customer.email, customer.phone, customer.address, customer.notes]),
    )
    .map(sourceFromCustomer);
  pushCapped(sources, customerCandidates, 2, maxTotal);

  const estimateCandidates = input.estimates
    .filter((estimate) =>
      mentionsAny(input.query, ['estimate', 'estimates', 'proposal', 'proposals', 'quote', 'quotes']) ||
      matchesSourceQuery(input.query, [estimate.number, estimate.title, estimate.status, estimate.customerName, estimate.totalCents]),
    )
    .map(sourceFromEstimate);
  pushCapped(sources, estimateCandidates, 2, maxTotal);

  const invoiceCandidates = input.invoices
    .filter((invoice) =>
      mentionsAny(input.query, ['invoice', 'invoices', 'payment', 'payments', 'paid', 'due']) ||
      matchesSourceQuery(input.query, [invoice.number, invoice.serviceType, invoice.status, invoice.customerName, invoice.totalCents]),
    )
    .map(sourceFromInvoice);
  pushCapped(sources, invoiceCandidates, 2, maxTotal);

  const growthCandidates = input.growth
    .filter((record) =>
      mentionsAny(input.query, ['growth', 'marketing', 'outreach', 'campaign', 'campaigns', 'seo', 'report', 'reports']) ||
      matchesSourceQuery(input.query, [record.type, record.title, record.status, record.owner, record.payload]),
    )
    .map(sourceFromGrowth);
  pushCapped(sources, growthCandidates, 2, maxTotal);

  if (!sources.some((source) => source.kind === 'portal_summary')) {
    uniquePush(sources, sourceFromSummary(input.summary));
  }

  return sources.slice(0, maxTotal);
}

function parseTags(value: unknown): string[] {
  const parsed = parseJsonSafely<unknown[]>(typeof value === 'string' ? value : '');
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function attachmentUrl(id: unknown, key: unknown) {
  const config = r2ConfigFromEnv();
  const fileKey = String(key || '');
  if (config && fileKey && !isLocalAttachmentKey(fileKey)) return publicUrlFor(config, fileKey);
  return `/api/attachments/${id}`;
}

function isTextLikeAttachment(fileName: string, mimeType: string) {
  const normalizedMime = mimeType.toLowerCase();
  const extension = fileName.toLowerCase().split('.').pop() || '';
  return (
    normalizedMime.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/yaml', 'application/x-yaml'].includes(normalizedMime) ||
    normalizedMime.includes('csv') ||
    normalizedMime.includes('markdown') ||
    ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log'].includes(extension)
  );
}

async function attachmentContent(key: unknown, fileName: string, mimeType: string) {
  const fileKey = String(key || '');
  if (!fileKey || !isLocalAttachmentKey(fileKey) || !isTextLikeAttachment(fileName, mimeType)) {
    return { contentStatus: 'metadata_only' as const };
  }

  try {
    const filePath = localAttachmentPath(fileKey);
    const stat = await fs.stat(filePath);
    const maxBytes = 64 * 1024;
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(Math.min(stat.size, maxBytes));
    try {
      await handle.read(buffer, 0, buffer.length, 0);
    } finally {
      await handle.close();
    }
    const suffix = stat.size > maxBytes ? '...' : '';
    const normalized = buffer
      .toString('utf8')
      .replace(/\u0000/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .trim()
      .slice(0, 6000);

    return {
      contentStatus: 'text_snippet' as const,
      contentSnippet: `${normalized}${suffix}`,
    };
  } catch {
    return { contentStatus: 'unreadable' as const };
  }
}

async function attachmentsForKnowledge(companyId: string, itemId: string): Promise<KnowledgeAttachment[]> {
  const rows = await sql`
    SELECT id, file_key, file_name, mime_type, size_bytes
    FROM attachments
    WHERE company_id = ${companyId}
      AND entity_type = 'knowledge_item'
      AND entity_id = ${itemId}
    ORDER BY created_at DESC
    LIMIT 12
  `;
  return Promise.all(
    rows.map(async (row) => {
      const fileName = String(row.file_name || '');
      const mimeType = String(row.mime_type || '');
      return {
        id: String(row.id),
        fileName,
        mimeType,
        sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
        url: attachmentUrl(row.id, row.file_key),
        ...(await attachmentContent(row.file_key, fileName, mimeType)),
      };
    }),
  );
}

export async function findKnowledgeMatches(companyId: string, query: string, limit = 8): Promise<KnowledgeMatch[]> {
  const rows = await sql`
    SELECT id, title, item_type, body, url, tags_json, source_metadata_json, is_pinned, updated_at
    FROM knowledge_items
    WHERE company_id = ${companyId} AND status = 'Active'
    ORDER BY is_pinned DESC, updated_at DESC
    LIMIT 80
  `;

  const terms = words(query);
  const matches = rows
    .map((row) => {
      const haystack = [row.title, row.item_type, row.body, row.url, row.tags_json, row.source_metadata_json].join(' ').toLowerCase();
      const score = Number(row.is_pinned ? 5 : 0) + terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { row, score };
    })
    .filter((item) => item.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return Promise.all(matches.map(async ({ row }) => ({
    id: String(row.id),
    title: String(row.title || ''),
    itemType: String(row.item_type || 'Other'),
    body: String(row.body || ''),
    url: String(row.url || ''),
    tags: parseTags(row.tags_json),
    sourceMetadata: parseJsonSafely<Record<string, unknown>>(String(row.source_metadata_json || '')) || {},
    attachments: await attachmentsForKnowledge(companyId, String(row.id)),
  })));
}

export async function buildAwpAgentContext(companyId: string, query: string) {
  const [
    companyRows,
    summaryRows,
    bucketRows,
    statusRows,
    leadRows,
    customerRows,
    estimateRows,
    invoiceRows,
    growthRows,
    knowledge,
  ] = await Promise.all([
    sql`
      SELECT name, email, phone, address
      FROM companies
      WHERE id = ${companyId}
      LIMIT 1
    `,
    sql`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE company_id = ${companyId}) AS lead_count,
        (SELECT COUNT(*) FROM customers WHERE company_id = ${companyId}) AS customer_count,
        (SELECT COUNT(*) FROM estimates WHERE company_id = ${companyId}) AS estimate_count,
        (SELECT COUNT(*) FROM invoices WHERE company_id = ${companyId}) AS invoice_count,
        (SELECT COUNT(*) FROM growth_records WHERE company_id = ${companyId}) AS growth_count,
        (SELECT COUNT(*) FROM knowledge_items WHERE company_id = ${companyId} AND status = 'Active') AS knowledge_count,
        (SELECT COUNT(*) FROM knowledge_items WHERE company_id = ${companyId} AND item_type = 'Reusable Architecture' AND status = 'Active') AS reusable_count,
        (SELECT COUNT(*) FROM attachments WHERE company_id = ${companyId}) AS attachment_count,
        (SELECT COUNT(*) FROM ai_action_drafts WHERE company_id = ${companyId} AND status = 'Draft') AS open_action_draft_count
    `,
    sql`
      SELECT id, title, color, position
      FROM buckets
      WHERE company_id = ${companyId}
      ORDER BY position ASC
      LIMIT 40
    `,
    sql`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(estimated_value_cents), 0) AS value_cents
      FROM leads
      WHERE company_id = ${companyId}
      GROUP BY status
    `,
    sql`
      SELECT
        l.id,
        l.issue,
        l.description,
        l.source,
        l.status,
        l.ai_score,
        l.estimated_value_cents,
        l.next_follow_up_at,
        l.lead_context_json,
        l.created_at,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone
      FROM leads l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.company_id = ${companyId}
      ORDER BY l.updated_at DESC, l.created_at DESC
      LIMIT 40
    `,
    sql`
      SELECT id, name, email, phone, address, notes, updated_at
      FROM customers
      WHERE company_id = ${companyId}
      ORDER BY updated_at DESC
      LIMIT 30
    `,
    sql`
      SELECT
        e.id,
        e.estimate_number,
        e.title,
        e.status,
        e.total_amount_cents,
        e.customer_name_snapshot,
        e.expiration_date,
        e.updated_at
      FROM estimates e
      WHERE e.company_id = ${companyId}
      ORDER BY e.updated_at DESC
      LIMIT 25
    `,
    sql`
      SELECT
        i.id,
        i.invoice_number,
        i.service_type,
        i.status,
        i.total_cents,
        i.amount_cents,
        i.total,
        i.due_date,
        i.paid_date,
        i.updated_at,
        c.name AS customer_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.company_id = ${companyId}
      ORDER BY i.updated_at DESC
      LIMIT 25
    `,
    sql`
      SELECT id, record_type, title, status, owner, related_record_id, payload_json, is_demo, updated_at
      FROM growth_records
      WHERE company_id = ${companyId}
      ORDER BY updated_at DESC
      LIMIT 80
    `,
    findKnowledgeMatches(companyId, query, 12),
  ]);

  const summarySource = summaryRows[0] || {};
  const company = companyRows[0] || {};
  const summary: PortalSummary = {
    company: {
      name: String(company.name || awpBusinessProfile.businessName),
      email: String(company.email || awpBusinessProfile.email),
      phone: String(company.phone || awpBusinessProfile.phone),
      address: String(company.address || awpBusinessProfile.address),
    },
    counts: {
      leads: num(summarySource.lead_count),
      customers: num(summarySource.customer_count),
      estimates: num(summarySource.estimate_count),
      invoices: num(summarySource.invoice_count),
      growthRecords: num(summarySource.growth_count),
      knowledgeItems: num(summarySource.knowledge_count),
      reusableArchitecture: num(summarySource.reusable_count),
      attachments: num(summarySource.attachment_count),
      openActionDrafts: num(summarySource.open_action_draft_count),
    },
  };

  const statusCounts = new Map(
    statusRows.map((row) => [
      String(row.status || ''),
      { count: num(row.count), valueCents: num(row.value_cents) },
    ]),
  );
  const pipeline = bucketRows.map((bucket) => {
    const status = sourceToSlug(String(bucket.title || ''));
    const stats = statusCounts.get(status) || { count: 0, valueCents: 0 };
    return {
      id: String(bucket.id),
      title: String(bucket.title || ''),
      status,
      color: String(bucket.color || ''),
      count: stats.count,
      valueCents: stats.valueCents,
    };
  });

  const leads = leadRows.map((lead) => ({
    id: String(lead.id),
    name: String(lead.customer_name || 'Lead'),
    email: String(lead.customer_email || ''),
    phone: String(lead.customer_phone || ''),
    interest: String(lead.issue || ''),
    description: String(lead.description || ''),
    source: sourceFromSlug(String(lead.source || '')),
    stage: pipelineLabel(String(lead.status || '')),
    score: lead.ai_score ?? null,
    value: lead.estimated_value_cents ?? null,
    nextFollowUpAt: lead.next_follow_up_at || null,
    context: parseJsonSafely<Record<string, unknown>>(String(lead.lead_context_json || '')) || {},
  }));

  const customers = customerRows.map((customer) => ({
    id: String(customer.id),
    name: String(customer.name || ''),
    email: String(customer.email || ''),
    phone: String(customer.phone || ''),
    address: String(customer.address || ''),
    notes: String(customer.notes || ''),
  }));

  const estimates = estimateRows.map((estimate) => ({
    id: String(estimate.id),
    number: String(estimate.estimate_number || ''),
    title: String(estimate.title || ''),
    status: String(estimate.status || ''),
    customerName: String(estimate.customer_name_snapshot || ''),
    totalCents: num(estimate.total_amount_cents),
    expirationDate: estimate.expiration_date || null,
  }));

  const invoices = invoiceRows.map((invoice) => ({
    id: String(invoice.id),
    number: String(invoice.invoice_number || ''),
    serviceType: String(invoice.service_type || ''),
    status: String(invoice.status || ''),
    customerName: String(invoice.customer_name || ''),
    totalCents: invoice.total_cents != null ? num(invoice.total_cents) : invoice.amount_cents != null ? num(invoice.amount_cents) : Math.round(num(invoice.total) * 100),
    dueDate: invoice.due_date || null,
    paidDate: invoice.paid_date || null,
  }));

  const growth = growthRows.map((record) => ({
    id: String(record.id),
    type: String(record.record_type || ''),
    title: String(record.title || ''),
    status: String(record.status || ''),
    owner: String(record.owner || ''),
    relatedRecordId: record.related_record_id || null,
    isDemo: Boolean(record.is_demo),
    payload: parseJsonSafely<Record<string, unknown>>(String(record.payload_json || '')) || {},
  }));

  const sources = buildDeterministicSources({
    query,
    summary,
    pipeline,
    leads,
    customers,
    estimates,
    invoices,
    growth,
    knowledge,
  });

  return {
    business: awpBusinessProfile,
    summary,
    pipeline,
    leads,
    customers,
    estimates,
    invoices,
    growth,
    knowledge,
    sources,
  };
}

export function buildSystemPrompt(
  context: Awaited<ReturnType<typeof buildAwpAgentContext>>,
  options: { mode?: 'text' | 'image' } = {},
) {
  const imageMode = options.mode === 'image';
  return [
    `You are the AI Growth Assistant inside ${context.business.productName}.`,
    `Business: ${context.business.businessName} (${context.business.shortName}).`,
    `Core offer: ${context.business.coreOffer}. Region: ${context.business.primaryRegion}.`,
    `Use these differentiators: ${context.business.differentiators.join(', ')}.`,
    context.business.aiGuardrail,
    '',
    'You help with leads, outreach, marketing, website/SEO, case studies, reports, and internal planning.',
    'You are not a phone receptionist or voice automation assistant.',
    'Never directly mutate CRM data. Do not tell the user that you saved, created, or applied a draft action.',
    'Answer from the portal data snapshot below. If the snapshot does not contain enough information, say what is missing and where the user should add it.',
    'The UI will show deterministic Used Sources from the portal context supplied to you. Do not invent source names, citations, or records in the reply.',
    'Treat Reusable Architecture knowledge items as durable client-specific decision rules. Respect confidence markers: Verified is strongest, Likely is usable with care, and Stale should be called out before relying on it.',
    'Uploaded files attached to knowledge items are supporting source artifacts. Use extracted text snippets when present. If an attachment is metadata_only or unreadable, use its name/link as evidence but do not claim to know its full contents.',
    '',
    imageMode
      ? 'This request is in image mode. Generate an image that follows the user prompt and the portal/company context. Reply with a concise plain-language caption, not JSON.'
      : 'Return strict JSON with this shape:',
    imageMode
      ? 'Do not create action drafts in image mode.'
      : '{"reply":"helpful markdown answer only; no raw JSON in this string","actionDrafts":[]}',
    imageMode ? '' : 'Return only JSON. Do not put markdown or prose before or after the JSON object. For now, actionDrafts should stay empty because the draft-action UI is hidden.',
    '',
    `Portal summary: ${JSON.stringify(context.summary)}`,
    `Source references shown by UI: ${JSON.stringify(context.sources)}`,
    `Pipeline buckets: ${JSON.stringify(context.pipeline)}`,
    `Knowledge matches: ${JSON.stringify(context.knowledge)}`,
    `Recent leads: ${JSON.stringify(context.leads.slice(0, 25))}`,
    `Recent customers: ${JSON.stringify(context.customers.slice(0, 20))}`,
    `Recent estimates: ${JSON.stringify(context.estimates.slice(0, 20))}`,
    `Recent invoices: ${JSON.stringify(context.invoices.slice(0, 20))}`,
    `Growth records: ${JSON.stringify(context.growth.slice(0, 50))}`,
  ].join('\n');
}
