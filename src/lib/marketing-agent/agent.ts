import { awpBusinessProfile, pipelineLabel, sourceFromSlug } from '@/lib/awp/config';
import { ensureAwpDemoData } from '@/lib/awp/seed';
import { sql } from '@/lib/db';
import { createOpenRouterChatCompletion } from '@/lib/ai/openrouter';
import { estimateAssistantCostUsd, normalizeAssistantModelId } from '@/lib/ai/models';
import { parseJsonSafely } from '@/lib/ops';

export type MarketingAgentToolName =
  | 'create_audience_list'
  | 'create_campaign_draft'
  | 'create_email_asset'
  | 'create_csv_export'
  | 'create_table_artifact'
  | 'create_client_document'
  | 'create_approval_draft'
  | 'create_marketing_task'
  | 'propose_lead_update'
  | 'save_memory';

export type MarketingAgentToolCall = {
  tool?: MarketingAgentToolName;
  reason?: string;
  input?: Record<string, unknown>;
};

type MarketingAgentPlan = {
  reply?: string;
  objective?: string;
  toolCalls?: MarketingAgentToolCall[];
  nextActions?: string[];
};

export type MarketingAgentMessage = {
  id: string;
  role: string;
  content: string;
  model?: string;
  createdAt?: unknown;
  contextSnapshot?: Record<string, unknown> | null;
};

type ContactRecord = {
  id: string;
  recordType: 'lead' | 'customer';
  name: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  audienceType: string;
  location: string;
  notes: string;
  score: number;
  valueCents: number;
  emailOptIn: boolean;
  nextFollowUpAt: unknown;
};

type GrowthRecord = {
  id: string;
  type: string;
  title: string;
  status: string;
  owner: string;
  payload: Record<string, unknown>;
  updatedAt: unknown;
};

type MarketingAgentMemory = {
  id: string;
  memoryType: string;
  title: string;
  body: string;
  confidence: string;
  source: string;
  metadata: Record<string, unknown>;
  updatedAt: unknown;
};

type MarketingAgentActionDraft = {
  id: string;
  actionType: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: unknown;
};

type MarketingAgentToolEvent = {
  id: string;
  toolName: string;
  status: string;
  reason: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  createdAt: unknown;
};

export type MarketingAgentSnapshot = {
  summary: {
    leads: number;
    marketableLeads: number;
    customers: number;
    campaigns: number;
    leadLists: number;
    artifacts: number;
    memories: number;
    pendingApprovals: number;
    followUpsDue: number;
  };
  pipeline: { stage: string; label: string; count: number; valueCents: number }[];
  contacts: ContactRecord[];
  campaigns: GrowthRecord[];
  leadLists: GrowthRecord[];
  artifacts: GrowthRecord[];
  memories: MarketingAgentMemory[];
  actionDrafts: MarketingAgentActionDraft[];
  toolEvents: MarketingAgentToolEvent[];
  conversations: { id: string; title: string; selectedModel: string; updatedAt: unknown }[];
};

export type MarketingAgentToolResult = {
  tool: MarketingAgentToolName;
  status: 'succeeded' | 'failed' | 'skipped';
  title: string;
  description: string;
  href?: string;
  recordId?: string;
  output?: Record<string, unknown>;
};

const MARKETING_CONVERSATION_TYPE = 'marketing_agent';

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function compact(value: unknown, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text;
}

function uuidOrNull(value: unknown) {
  const text = textValue(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function parsePayload(value: unknown) {
  return parseJsonSafely<Record<string, unknown>>(String(value || '')) || {};
}

function cleanJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeContacts(value: unknown, fallback: ContactRecord[] = []) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source.slice(0, 60).map((item) => {
    const row = cleanJsonObject(item);
    return {
      id: textValue(row.id),
      recordType: textValue(row.recordType || row.type || 'lead'),
      name: textValue(row.name || row.businessName || row.company || 'Contact'),
      businessName: textValue(row.businessName || row.company),
      email: textValue(row.email),
      phone: textValue(row.phone),
      location: textValue(row.location || row.address),
      contactType: textValue(row.contactType || row.audienceType || row.type),
      outreachStatus: textValue(row.outreachStatus || 'Not Contacted'),
      source: textValue(row.source),
      notes: textValue(row.notes || row.reason),
    };
  });
}

function normalizeRows(value: unknown, fallback: Record<string, unknown>[] = []) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  return source
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .slice(0, 250)
    .map((row) => row as Record<string, unknown>);
}

function inferColumns(rows: Record<string, unknown>[], explicit?: unknown) {
  if (Array.isArray(explicit) && explicit.length) return explicit.map(String).slice(0, 24);
  const columns = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return [...columns].slice(0, 24);
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildMarketingAgentCsv(columns: string[], rows: Record<string, unknown>[]) {
  return [
    columns.map(csvEscape).join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}

function rowsFromContacts(contacts: ReturnType<typeof normalizeContacts>) {
  return contacts.map((contact) => ({
    name: contact.name,
    businessName: contact.businessName,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    contactType: contact.contactType,
    outreachStatus: contact.outreachStatus,
    notes: contact.notes,
  }));
}

function contactPipelineFromContacts(contacts: ReturnType<typeof normalizeContacts>, stage = 'Drafted') {
  return contacts.map((contact, index) => ({
    ...contact,
    outreachStage: textValue((contact as Record<string, unknown>).outreachStage, stage),
    currentStep: 1,
    lastTouch: '',
    nextTouch: '',
    sortOrder: index,
  }));
}

function pickContacts(snapshot: MarketingAgentSnapshot, input: Record<string, unknown>) {
  const audience = textValue(input.audienceType || input.audience || input.segment).toLowerCase();
  const terms = audience
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const marketable = snapshot.contacts.filter((contact) => contact.email && contact.emailOptIn);
  const filtered = terms.length
    ? marketable.filter((contact) => {
        const haystack = [
          contact.audienceType,
          contact.source,
          contact.stage,
          contact.location,
          contact.notes,
          contact.name,
        ].join(' ').toLowerCase();
        return terms.some((term) => haystack.includes(term) || haystack.includes(term.replace(/s$/, '')));
      })
    : marketable;

  return filtered.slice(0, 35);
}

function normalizePlan(content: string): MarketingAgentPlan {
  const strict = parseJsonSafely<MarketingAgentPlan>(content);
  if (strict && (strict.reply || Array.isArray(strict.toolCalls))) return strict;

  const fenced = content.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = parseJsonSafely<MarketingAgentPlan>(fenced[1]);
    if (parsed && (parsed.reply || Array.isArray(parsed.toolCalls))) return parsed;
  }

  const objectStart = content.indexOf('{');
  const objectEnd = content.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    const parsed = parseJsonSafely<MarketingAgentPlan>(content.slice(objectStart, objectEnd + 1));
    if (parsed && (parsed.reply || Array.isArray(parsed.toolCalls))) return parsed;
  }

  return { reply: content, toolCalls: [] };
}

function mapConversation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title || 'Marketing mission'),
    selectedModel: String(row.selected_model || ''),
    updatedAt: row.updated_at,
  };
}

function mapGrowthRecord(row: Record<string, unknown>): GrowthRecord {
  return {
    id: String(row.id),
    type: String(row.record_type || ''),
    title: String(row.title || ''),
    status: String(row.status || ''),
    owner: String(row.owner || ''),
    payload: parsePayload(row.payload_json),
    updatedAt: row.updated_at,
  };
}

function mapActionDraft(row: Record<string, unknown>): MarketingAgentActionDraft {
  return {
    id: String(row.id),
    actionType: String(row.action_type || ''),
    title: String(row.title || ''),
    status: String(row.status || 'Draft'),
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  };
}

function mapMemory(row: Record<string, unknown>): MarketingAgentMemory {
  return {
    id: String(row.id),
    memoryType: String(row.memory_type || 'Strategy'),
    title: String(row.title || ''),
    body: String(row.body || ''),
    confidence: String(row.confidence || 'Working'),
    source: String(row.source || 'Marketing Agent'),
    metadata: parsePayload(row.metadata_json),
    updatedAt: row.updated_at,
  };
}

function mapToolEvent(row: Record<string, unknown>): MarketingAgentToolEvent {
  return {
    id: String(row.id),
    toolName: String(row.tool_name || ''),
    status: String(row.status || ''),
    reason: String(row.reason || ''),
    input: parsePayload(row.input_json),
    output: parsePayload(row.output_json),
    createdAt: row.created_at,
  };
}

function contactFromLead(row: Record<string, unknown>): ContactRecord {
  const context = parsePayload(row.lead_context_json);
  return {
    id: String(row.id),
    recordType: 'lead',
    name: String(row.customer_name || context.name || 'Lead'),
    email: String(row.customer_email || context.email || ''),
    phone: String(row.customer_phone || context.phone || ''),
    source: sourceFromSlug(String(row.source || '')),
    stage: pipelineLabel(String(row.status || '')),
    audienceType: String(context.leadType || context.contactType || row.source || ''),
    location: String(row.location || context.location || ''),
    notes: compact([row.issue, row.description, context.notes, context.aiSummary].filter(Boolean).join(' / '), 260),
    score: numberValue(row.ai_score),
    valueCents: numberValue(row.estimated_value_cents),
    emailOptIn: Boolean(row.email_opt_in ?? true),
    nextFollowUpAt: row.next_follow_up_at || null,
  };
}

function contactFromCustomer(row: Record<string, unknown>): ContactRecord {
  return {
    id: String(row.id),
    recordType: 'customer',
    name: String(row.name || 'Customer'),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    source: 'Customer',
    stage: 'Customer',
    audienceType: 'Past Customers',
    location: String(row.address || ''),
    notes: compact(row.notes, 260),
    score: 0,
    valueCents: 0,
    emailOptIn: Boolean(row.email_opt_in ?? true),
    nextFollowUpAt: null,
  };
}

export async function buildMarketingAgentSnapshot(companyId: string, branchId?: string | null): Promise<MarketingAgentSnapshot> {
  await ensureAwpDemoData(companyId, branchId ?? null);

  const [
    summaryRows,
    pipelineRows,
    leadRows,
    customerRows,
    campaignRows,
    listRows,
    artifactRows,
    memoryRows,
    draftRows,
    eventRows,
    conversationRows,
  ] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE company_id = ${companyId}) AS lead_count,
        (SELECT COUNT(*) FROM leads l LEFT JOIN customers c ON l.customer_id = c.id WHERE l.company_id = ${companyId} AND COALESCE(c.email, '') <> '' AND COALESCE(c.email_opt_in, true) <> false) AS marketable_lead_count,
        (SELECT COUNT(*) FROM customers WHERE company_id = ${companyId}) AS customer_count,
        (SELECT COUNT(*) FROM growth_records WHERE company_id = ${companyId} AND record_type = 'campaign') AS campaign_count,
        (SELECT COUNT(*) FROM growth_records WHERE company_id = ${companyId} AND record_type = 'lead_list') AS list_count,
        (SELECT COUNT(*) FROM growth_records WHERE company_id = ${companyId} AND record_type = 'asset' AND payload_json LIKE ${'%marketing_agent%'}) AS artifact_count,
        (SELECT COUNT(*) FROM marketing_agent_memories WHERE company_id = ${companyId} AND status = 'Active') AS memory_count,
        (SELECT COUNT(*) FROM ai_action_drafts WHERE company_id = ${companyId} AND status = 'Draft' AND action_type LIKE 'marketing_%') AS pending_approval_count,
        (SELECT COUNT(*) FROM leads WHERE company_id = ${companyId} AND next_follow_up_at IS NOT NULL) AS follow_up_count
    `,
    sql`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(estimated_value_cents), 0) AS value_cents
      FROM leads
      WHERE company_id = ${companyId}
      GROUP BY status
      ORDER BY count DESC
    `,
    sql`
      SELECT
        l.id,
        l.issue,
        l.description,
        l.source,
        l.status,
        l.location,
        l.ai_score,
        l.estimated_value_cents,
        l.next_follow_up_at,
        l.lead_context_json,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,
        c.email_opt_in
      FROM leads l
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE l.company_id = ${companyId}
      ORDER BY COALESCE(l.ai_score, 0) DESC, l.updated_at DESC, l.created_at DESC
      LIMIT 80
    `,
    sql`
      SELECT id, name, email, phone, address, notes, email_opt_in, updated_at
      FROM customers
      WHERE company_id = ${companyId}
      ORDER BY updated_at DESC
      LIMIT 60
    `,
    sql`
      SELECT *
      FROM growth_records
      WHERE company_id = ${companyId} AND record_type = 'campaign'
      ORDER BY updated_at DESC, title ASC
      LIMIT 40
    `,
    sql`
      SELECT *
      FROM growth_records
      WHERE company_id = ${companyId} AND record_type = 'lead_list'
      ORDER BY updated_at DESC, title ASC
      LIMIT 40
    `,
    sql`
      SELECT *
      FROM growth_records
      WHERE company_id = ${companyId}
        AND record_type = 'asset'
        AND payload_json LIKE ${'%marketing_agent%'}
      ORDER BY updated_at DESC, title ASC
      LIMIT 40
    `,
    sql`
      SELECT *
      FROM marketing_agent_memories
      WHERE company_id = ${companyId} AND status = 'Active'
      ORDER BY updated_at DESC
      LIMIT 30
    `,
    sql`
      SELECT *
      FROM ai_action_drafts
      WHERE company_id = ${companyId}
        AND action_type LIKE 'marketing_%'
      ORDER BY created_at DESC
      LIMIT 30
    `,
    sql`
      SELECT *
      FROM marketing_agent_tool_events
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
      LIMIT 40
    `,
    sql`
      SELECT id, title, selected_model, updated_at
      FROM ai_conversations
      WHERE company_id = ${companyId}
        AND COALESCE(conversation_type, 'assistant') = ${MARKETING_CONVERSATION_TYPE}
      ORDER BY updated_at DESC
      LIMIT 20
    `,
  ]);

  const summary = summaryRows[0] || {};
  const contactsByKey = new Map<string, ContactRecord>();
  for (const contact of [...leadRows.map(contactFromLead), ...customerRows.map(contactFromCustomer)]) {
    const key = contact.email ? `email:${contact.email.toLowerCase()}` : `${contact.recordType}:${contact.id}`;
    if (!contactsByKey.has(key)) contactsByKey.set(key, contact);
  }

  return {
    summary: {
      leads: numberValue(summary.lead_count),
      marketableLeads: numberValue(summary.marketable_lead_count),
      customers: numberValue(summary.customer_count),
      campaigns: numberValue(summary.campaign_count),
      leadLists: numberValue(summary.list_count),
      artifacts: numberValue(summary.artifact_count),
      memories: numberValue(summary.memory_count),
      pendingApprovals: numberValue(summary.pending_approval_count),
      followUpsDue: numberValue(summary.follow_up_count),
    },
    pipeline: pipelineRows.map((row) => ({
      stage: String(row.status || ''),
      label: pipelineLabel(String(row.status || '')),
      count: numberValue(row.count),
      valueCents: numberValue(row.value_cents),
    })),
    contacts: [...contactsByKey.values()].slice(0, 110),
    campaigns: campaignRows.map(mapGrowthRecord),
    leadLists: listRows.map(mapGrowthRecord),
    artifacts: artifactRows.map(mapGrowthRecord),
    memories: memoryRows.map(mapMemory),
    actionDrafts: draftRows.map(mapActionDraft),
    toolEvents: eventRows.map(mapToolEvent),
    conversations: conversationRows.map(mapConversation),
  };
}

export async function loadMarketingAgentConversation(companyId: string, conversationId: string) {
  const conversations = await sql`
    SELECT id, title, selected_model, updated_at
    FROM ai_conversations
    WHERE id = ${conversationId}
      AND company_id = ${companyId}
      AND COALESCE(conversation_type, 'assistant') = ${MARKETING_CONVERSATION_TYPE}
    LIMIT 1
  `;
  if (!conversations.length) return null;

  const messages = await sql`
    SELECT *
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
      AND company_id = ${companyId}
    ORDER BY created_at ASC
  `;

  return {
    conversation: mapConversation(conversations[0]),
    messages: messages.map((row) => ({
      id: String(row.id),
      role: String(row.role),
      content: String(row.content || ''),
      model: String(row.model || ''),
      createdAt: row.created_at,
      contextSnapshot: parsePayload(row.context_snapshot_json),
    })) satisfies MarketingAgentMessage[],
  };
}

export async function deleteMarketingAgentConversation(companyId: string, conversationId: string) {
  await sql`
    DELETE FROM ai_conversations
    WHERE id = ${conversationId}
      AND company_id = ${companyId}
      AND COALESCE(conversation_type, 'assistant') = ${MARKETING_CONVERSATION_TYPE}
  `;
}

async function ensureMarketingConversation(companyId: string, userId: string, conversationId: string | null, model: string, prompt: string) {
  if (conversationId) {
    const existing = await sql`
      SELECT id
      FROM ai_conversations
      WHERE id = ${conversationId}
        AND company_id = ${companyId}
        AND COALESCE(conversation_type, 'assistant') = ${MARKETING_CONVERSATION_TYPE}
      LIMIT 1
    `;
    if (existing.length) return conversationId;
  }

  const title = compact(prompt, 68) || 'Marketing mission';
  const result = await sql`
    INSERT INTO ai_conversations (
      company_id,
      title,
      selected_model,
      conversation_type,
      created_by_user_id
    )
    VALUES (
      ${companyId},
      ${title},
      ${model},
      ${MARKETING_CONVERSATION_TYPE},
      ${userId}
    )
    RETURNING id
  `;
  return String(result[0].id);
}

function buildMarketingAgentSystemPrompt(snapshot: MarketingAgentSnapshot) {
  return [
    `You are Marketing Agent, an autonomous AI growth operator inside ${awpBusinessProfile.productName}.`,
    `Business: ${awpBusinessProfile.businessName} (${awpBusinessProfile.shortName}).`,
    `Core offer: ${awpBusinessProfile.coreOffer}. Region: ${awpBusinessProfile.primaryRegion}.`,
    `Differentiators: ${awpBusinessProfile.differentiators.join(', ')}.`,
    awpBusinessProfile.aiGuardrail,
    '',
    'Primary mission: find and nurture customers for AWP Cabins through CRM-aware audience building, email campaign drafts, partner outreach planning, lead follow-up, sales assets, and repeatable marketing memory.',
    'Be agentic: when the user asks for a campaign, list, sequence, or plan, use tools to create concrete portal artifacts instead of only describing what could be done.',
    'Hard boundary: never claim you sent live email, SMS, phone calls, paid ads, or external outreach. Live sends require a future email/CRM integration and explicit approval. Use create_approval_draft for anything that would become external outreach.',
    'Prefer concise, executive-readable replies. Mention created records and approval needs plainly.',
    '',
    'Return only strict JSON with this shape:',
    JSON.stringify({
      reply: 'Markdown answer for the user.',
      objective: 'The mission you worked on.',
      toolCalls: [
        {
          tool: 'create_audience_list',
          reason: 'Why this artifact helps.',
          input: {
            title: 'Lead list title',
            audienceType: 'Realtors',
            source: 'CRM / manual research / imported list',
            notes: 'Criteria and caveats',
            contacts: [],
          },
        },
        {
          tool: 'create_csv_export',
          reason: 'Make a downloadable, sheet-ready client artifact.',
          input: {
            title: 'Campaign Contacts CSV',
            columns: ['name', 'email', 'phone', 'outreachStatus'],
            rows: [],
            notes: 'What this CSV is for.',
          },
        },
      ],
      nextActions: ['One suggested next action.'],
    }),
    '',
    'Allowed tools:',
    '- create_audience_list: creates a lead_list growth record. Use for prospect/customer segments. Input: title, audienceType, source, notes, contacts optional.',
    '- create_campaign_draft: creates a campaign growth record and per-contact email campaign board. Input: title, audience, goal, listId optional, contacts optional, sequence array, subjectLines array, nextAction, notes.',
    '- create_email_asset: creates an email template/asset growth record. Input: title, subject, body, audience, cta, notes.',
    '- create_csv_export: creates a downloadable CSV asset. Input: title, columns array, rows array, audience optional, notes optional. If rows are omitted, use matching CRM contacts.',
    '- create_table_artifact: creates a visual table artifact in the output pad. Input: title, columns array, rows array, summary, notes.',
    '- create_client_document: creates a client-facing document draft in the output pad. Input: title, documentType, markdown, summary, audience, notes.',
    '- create_approval_draft: creates a human approval item for outreach. Input: title, campaignId optional, listId optional, channel, recipientPreview, sequence, riskNotes.',
    '- create_marketing_task: creates a project growth record for follow-up work. Input: title, status, owner, notes, dueDate optional.',
    '- propose_lead_update: creates an approval draft for changing a lead stage or follow-up. Input: leadId, status, reason, nextFollowUpAt optional.',
    '- save_memory: saves a durable marketing memory. Input: title, body, memoryType, confidence, metadata.',
    '',
    'Snapshot:',
    JSON.stringify({
      summary: snapshot.summary,
      pipeline: snapshot.pipeline,
      marketableContacts: snapshot.contacts.filter((contact) => contact.email && contact.emailOptIn).slice(0, 35),
      campaigns: snapshot.campaigns.slice(0, 15),
      leadLists: snapshot.leadLists.slice(0, 15),
      artifacts: snapshot.artifacts.slice(0, 15),
      memories: snapshot.memories.slice(0, 15),
      pendingApprovals: snapshot.actionDrafts.filter((draft) => draft.status === 'Draft').slice(0, 15),
    }),
  ].join('\n');
}

async function recordToolEvent(input: {
  companyId: string;
  conversationId: string;
  messageId?: string | null;
  toolName: string;
  status: string;
  reason?: string;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  userId: string;
}) {
  await sql`
    INSERT INTO marketing_agent_tool_events (
      company_id,
      conversation_id,
      message_id,
      tool_name,
      status,
      reason,
      input_json,
      output_json,
      created_by_user_id
    )
    VALUES (
      ${input.companyId},
      ${input.conversationId},
      ${input.messageId || null},
      ${input.toolName},
      ${input.status},
      ${input.reason || null},
      ${JSON.stringify(input.inputJson || {})},
      ${JSON.stringify(input.outputJson || {})},
      ${input.userId}
    )
  `;
}

async function createGrowthRecord(input: {
  companyId: string;
  recordType: string;
  title: string;
  status: string;
  owner: string;
  relatedRecordId?: string | null;
  payload: Record<string, unknown>;
}) {
  const result = await sql`
    INSERT INTO growth_records (
      company_id,
      record_type,
      title,
      status,
      owner,
      related_record_id,
      payload_json,
      is_demo,
      sort_order
    )
    VALUES (
      ${input.companyId},
      ${input.recordType},
      ${input.title},
      ${input.status},
      ${input.owner},
      ${input.relatedRecordId || null},
      ${JSON.stringify(input.payload)},
      ${false},
      ${0}
    )
    RETURNING id, title, record_type, status
  `;
  return result[0];
}

async function createActionDraft(input: {
  companyId: string;
  conversationId: string;
  messageId?: string | null;
  userId: string;
  actionType: string;
  title: string;
  payload: Record<string, unknown>;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
}) {
  const result = await sql`
    INSERT INTO ai_action_drafts (
      company_id,
      conversation_id,
      message_id,
      action_type,
      title,
      payload_json,
      related_record_type,
      related_record_id,
      created_by_user_id
    )
    VALUES (
      ${input.companyId},
      ${input.conversationId},
      ${input.messageId || null},
      ${input.actionType},
      ${input.title},
      ${JSON.stringify(input.payload)},
      ${input.relatedRecordType || null},
      ${input.relatedRecordId || null},
      ${input.userId}
    )
    RETURNING id, title, status
  `;
  return result[0];
}

async function executeTool(input: {
  companyId: string;
  conversationId: string;
  messageId?: string | null;
  userId: string;
  call: MarketingAgentToolCall;
  snapshot: MarketingAgentSnapshot;
}): Promise<MarketingAgentToolResult> {
  const tool = input.call.tool;
  const args = cleanJsonObject(input.call.input);
  if (!tool) {
    return {
      tool: 'create_marketing_task',
      status: 'skipped',
      title: 'Skipped tool call',
      description: 'The model returned a tool call without a valid tool name.',
    };
  }

  if (tool === 'create_audience_list') {
    const pickedContacts = pickContacts(input.snapshot, args);
    const contacts = normalizeContacts(args.contacts, pickedContacts);
    const title = textValue(args.title, `${textValue(args.audienceType || args.audience || 'Marketing')} Audience`);
    const record = await createGrowthRecord({
      companyId: input.companyId,
      recordType: 'lead_list',
      title,
      status: textValue(args.status, contacts.length ? 'Ready' : 'Building'),
      owner: textValue(args.owner, 'Marketing Agent'),
      payload: {
        audienceType: textValue(args.audienceType || args.audience || args.segment, 'Other'),
        source: textValue(args.source, 'Marketing Agent'),
        numberOfContacts: contacts.length || numberValue(args.numberOfContacts),
        notes: textValue(args.notes || args.criteria),
        contacts,
        generatedBy: 'marketing_agent',
      },
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: `Created a lead list with ${contacts.length} contact${contacts.length === 1 ? '' : 's'}.`,
      href: '/outreach?tab=lists',
      recordId: String(record.id),
      output: { id: record.id, contacts: contacts.length },
    };
  }

  if (tool === 'create_campaign_draft') {
    const title = textValue(args.title, 'Marketing Agent Campaign Draft');
    const sequence = Array.isArray(args.sequence) ? args.sequence.slice(0, 6) : [];
    const relatedList = input.snapshot.leadLists.find((record) => record.id === textValue(args.listId));
    const listContacts = Array.isArray(relatedList?.payload.contacts) ? relatedList.payload.contacts : [];
    const contacts = normalizeContacts(args.contacts, listContacts.length ? listContacts as ContactRecord[] : pickContacts(input.snapshot, args));
    const contactPipeline = contactPipelineFromContacts(contacts, 'Drafted');
    const record = await createGrowthRecord({
      companyId: input.companyId,
      recordType: 'campaign',
      title,
      status: textValue(args.status, 'Drafting'),
      owner: textValue(args.owner, 'Marketing Agent'),
      relatedRecordId: uuidOrNull(args.listId),
      payload: {
        audience: textValue(args.audience || args.audienceType, 'Other'),
        goal: textValue(args.goal),
        numberOfContacts: contacts.length || numberValue(args.numberOfContacts),
        emailsSent: 0,
        opens: 0,
        clicks: 0,
        replies: 0,
        leadsGenerated: 0,
        relatedAssets: textValue(args.relatedAssets),
        relatedListId: textValue(args.listId),
        subjectLines: Array.isArray(args.subjectLines) ? args.subjectLines.slice(0, 8) : [],
        sequence,
        contacts,
        contactPipeline,
        boardStages: ['Drafted', 'Awaiting Approval', 'Ready', 'Sent', 'Opened', 'Replied', 'Interested', 'Converted'],
        nextAction: textValue(args.nextAction, 'Review and approve outreach draft.'),
        notes: textValue(args.notes),
        approvalRequired: true,
        generatedBy: 'marketing_agent',
      },
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: 'Created a campaign draft with approval required before any external outreach.',
      href: '/outreach?tab=campaigns',
      recordId: String(record.id),
      output: { id: record.id, sequenceSteps: sequence.length, contacts: contacts.length },
    };
  }

  if (tool === 'create_email_asset') {
    const title = textValue(args.title || args.subject, 'Marketing Agent Email Template');
    const record = await createGrowthRecord({
      companyId: input.companyId,
      recordType: 'asset',
      title,
      status: textValue(args.status, 'Draft'),
      owner: textValue(args.owner, 'Marketing Agent'),
      payload: {
        assetType: 'Email Template',
        audience: textValue(args.audience || args.audienceType),
        description: textValue(args.description || args.summary),
        subject: textValue(args.subject),
        body: textValue(args.body || args.emailBody),
        cta: textValue(args.cta),
        relatedCampaign: textValue(args.relatedCampaign || args.campaignId),
        notes: textValue(args.notes),
        generatedBy: 'marketing_agent',
      },
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: 'Created a draft email asset for review.',
      href: '/marketing?tab=assets',
      recordId: String(record.id),
      output: { id: record.id },
    };
  }

  if (tool === 'create_csv_export' || tool === 'create_table_artifact') {
    const pickedContacts = pickContacts(input.snapshot, args);
    const contactRows = rowsFromContacts(normalizeContacts(args.contacts, pickedContacts));
    const rows = normalizeRows(args.rows, contactRows);
    const columns = inferColumns(rows, args.columns);
    const csv = buildMarketingAgentCsv(columns, rows);
    const assetType = tool === 'create_csv_export' ? 'CSV Export' : 'Table';
    const title = textValue(args.title, tool === 'create_csv_export' ? 'Marketing Agent CSV Export' : 'Marketing Agent Table');
    const record = await createGrowthRecord({
      companyId: input.companyId,
      recordType: 'asset',
      title,
      status: textValue(args.status, 'Draft'),
      owner: textValue(args.owner, 'Marketing Agent'),
      payload: {
        assetType,
        description: textValue(args.summary || args.description),
        audience: textValue(args.audience || args.audienceType),
        columns,
        rows,
        csv,
        notes: textValue(args.notes),
        generatedBy: 'marketing_agent',
      },
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: `Created a ${assetType.toLowerCase()} artifact with ${rows.length} row${rows.length === 1 ? '' : 's'}.`,
      href: `/api/marketing-agent/artifacts/${record.id}/download`,
      recordId: String(record.id),
      output: { id: record.id, rows: rows.length, columns: columns.length },
    };
  }

  if (tool === 'create_client_document') {
    const title = textValue(args.title, 'Marketing Agent Client Document');
    const markdown = textValue(args.markdown || args.body || args.document);
    const record = await createGrowthRecord({
      companyId: input.companyId,
      recordType: 'asset',
      title,
      status: textValue(args.status, 'Draft'),
      owner: textValue(args.owner, 'Marketing Agent'),
      payload: {
        assetType: textValue(args.documentType, 'Client Document'),
        description: textValue(args.summary || args.description),
        audience: textValue(args.audience || args.audienceType),
        markdown,
        notes: textValue(args.notes),
        generatedBy: 'marketing_agent',
      },
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: 'Created a client-facing document draft in the output pad.',
      href: '/marketing?tab=assets',
      recordId: String(record.id),
      output: { id: record.id, documentType: textValue(args.documentType, 'Client Document') },
    };
  }

  if (tool === 'create_approval_draft') {
    const title = textValue(args.title, 'Approve Marketing Outreach');
    const draft = await createActionDraft({
      companyId: input.companyId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      userId: input.userId,
      actionType: 'marketing_outreach_approval',
      title,
      payload: {
        ...args,
        channel: textValue(args.channel, 'email'),
        requiresHumanApproval: true,
        liveSendEnabled: false,
      },
      relatedRecordType: textValue(args.campaignId) ? 'growth_record' : null,
      relatedRecordId: uuidOrNull(args.campaignId),
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: 'Created a human approval draft. No external message was sent.',
      recordId: String(draft.id),
      output: { id: draft.id, status: draft.status },
    };
  }

  if (tool === 'create_marketing_task') {
    const title = textValue(args.title, 'Marketing Agent Task');
    const record = await createGrowthRecord({
      companyId: input.companyId,
      recordType: 'project',
      title,
      status: textValue(args.status, 'Needs Info'),
      owner: textValue(args.owner, 'Marketing Agent'),
      payload: {
        projectType: 'Other',
        buildDescription: textValue(args.notes || args.description),
        dueDate: textValue(args.dueDate),
        nextAction: textValue(args.nextAction),
        generatedBy: 'marketing_agent',
      },
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: 'Created a marketing follow-up task.',
      href: '/marketing?tab=projects',
      recordId: String(record.id),
      output: { id: record.id },
    };
  }

  if (tool === 'propose_lead_update') {
    const leadId = textValue(args.leadId || args.id);
    const title = textValue(args.title, 'Approve Lead Update');
    const draft = await createActionDraft({
      companyId: input.companyId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      userId: input.userId,
      actionType: 'marketing_lead_update',
      title,
      payload: {
        leadId,
        status: textValue(args.status || args.stage),
        reason: textValue(args.reason || args.notes),
        nextFollowUpAt: textValue(args.nextFollowUpAt),
        requiresHumanApproval: true,
      },
      relatedRecordType: uuidOrNull(leadId) ? 'lead' : null,
      relatedRecordId: uuidOrNull(leadId),
    });
    return {
      tool,
      status: 'succeeded',
      title,
      description: 'Created an approval draft for the lead update.',
      recordId: String(draft.id),
      output: { id: draft.id, leadId },
    };
  }

  const memoryTitle = textValue(args.title, 'Marketing Memory');
  const memoryBody = textValue(args.body || args.memory || args.notes);
  if (!memoryBody) {
    return {
      tool,
      status: 'skipped',
      title: memoryTitle,
      description: 'Skipped memory write because the body was empty.',
    };
  }
  const result = await sql`
    INSERT INTO marketing_agent_memories (
      company_id,
      memory_type,
      title,
      body,
      confidence,
      source,
      metadata_json,
      created_by_user_id
    )
    VALUES (
      ${input.companyId},
      ${textValue(args.memoryType, 'Strategy')},
      ${memoryTitle},
      ${memoryBody},
      ${textValue(args.confidence, 'Working')},
      ${textValue(args.source, 'Marketing Agent')},
      ${JSON.stringify(cleanJsonObject(args.metadata))},
      ${input.userId}
    )
    RETURNING id, title
  `;
  return {
    tool,
    status: 'succeeded',
    title: memoryTitle,
    description: 'Saved a durable marketing memory for future agent runs.',
    recordId: String(result[0].id),
    output: { id: result[0].id },
  };
}

async function executeTools(input: {
  companyId: string;
  conversationId: string;
  messageId?: string | null;
  userId: string;
  calls: MarketingAgentToolCall[];
  snapshot: MarketingAgentSnapshot;
}) {
  const results: MarketingAgentToolResult[] = [];
  for (const call of input.calls.slice(0, 7)) {
    const toolName = call.tool || 'create_marketing_task';
    try {
      const result = await executeTool({ ...input, call });
      results.push(result);
      await recordToolEvent({
        companyId: input.companyId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        toolName,
        status: result.status,
        reason: call.reason,
        inputJson: cleanJsonObject(call.input),
        outputJson: result.output || { description: result.description, recordId: result.recordId },
        userId: input.userId,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Tool execution failed';
      results.push({
        tool: toolName,
        status: 'failed',
        title: String(toolName),
        description,
      });
      await recordToolEvent({
        companyId: input.companyId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        toolName,
        status: 'failed',
        reason: call.reason,
        inputJson: cleanJsonObject(call.input),
        outputJson: { error: description },
        userId: input.userId,
      });
    }
  }
  return results;
}

function appendToolSummary(reply: string, results: MarketingAgentToolResult[]) {
  if (!results.length) return reply;
  const successful = results.filter((result) => result.status === 'succeeded');
  const failed = results.filter((result) => result.status === 'failed');
  const lines = [
    reply.trim(),
    '',
    '### Agent work completed',
    ...successful.map((result) => `- ${result.description}`),
    ...failed.map((result) => `- Could not run ${result.tool}: ${result.description}`),
  ].filter(Boolean);
  return lines.join('\n');
}

export async function runMarketingAgent(input: {
  companyId: string;
  branchId?: string | null;
  userId: string;
  conversationId: string | null;
  prompt: string;
  model: string;
}) {
  const model = normalizeAssistantModelId(input.model);
  const conversationId = await ensureMarketingConversation(input.companyId, input.userId, input.conversationId, model, input.prompt);
  const snapshot = await buildMarketingAgentSnapshot(input.companyId, input.branchId);

  const previous = await sql`
    SELECT role, content
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
      AND company_id = ${input.companyId}
    ORDER BY created_at ASC
    LIMIT 20
  `;

  const userMessage = await sql`
    INSERT INTO ai_messages (company_id, conversation_id, role, content, model)
    VALUES (${input.companyId}, ${conversationId}, 'user', ${input.prompt}, ${model})
    RETURNING id
  `;

  const completion = await createOpenRouterChatCompletion({
    model,
    messages: [
      { role: 'system', content: buildMarketingAgentSystemPrompt(snapshot) },
      ...previous.map((row) => ({
        role: String(row.role) === 'assistant' ? 'assistant' as const : 'user' as const,
        content: String(row.content || ''),
      })),
      { role: 'user', content: input.prompt },
    ],
    temperature: 0.2,
  });

  const rawContent = completion.choices?.[0]?.message?.content || 'I could not generate a marketing-agent response.';
  const plan = normalizePlan(rawContent);
  const toolResults = await executeTools({
    companyId: input.companyId,
    conversationId,
    userId: input.userId,
    calls: Array.isArray(plan.toolCalls) ? plan.toolCalls : [],
    snapshot,
  });

  const usage = completion.usage || {};
  const estimatedCostUsd = estimateAssistantCostUsd(model, usage.prompt_tokens, usage.completion_tokens);
  const reply = appendToolSummary(plan.reply || rawContent, toolResults);

  const assistantMessage = await sql`
    INSERT INTO ai_messages (
      company_id,
      conversation_id,
      role,
      content,
      model,
      input_tokens,
      output_tokens,
      estimated_cost_usd,
      context_snapshot_json
    )
    VALUES (
      ${input.companyId},
      ${conversationId},
      'assistant',
      ${reply},
      ${model},
      ${usage.prompt_tokens ?? null},
      ${usage.completion_tokens ?? null},
      ${estimatedCostUsd ? estimatedCostUsd.toFixed(8) : null},
      ${JSON.stringify({
        marketingAgent: true,
        objective: plan.objective || '',
        summary: snapshot.summary,
        toolResults,
        nextActions: Array.isArray(plan.nextActions) ? plan.nextActions : [],
      })}
    )
    RETURNING id
  `;

  await sql`
    UPDATE marketing_agent_tool_events
    SET message_id = ${assistantMessage[0].id}
    WHERE conversation_id = ${conversationId}
      AND company_id = ${input.companyId}
      AND message_id IS NULL
  `;

  await sql`
    UPDATE ai_conversations
    SET selected_model = ${model}, updated_at = datetime('now')
    WHERE id = ${conversationId} AND company_id = ${input.companyId}
  `;

  const refreshedSnapshot = await buildMarketingAgentSnapshot(input.companyId, input.branchId);

  return {
    conversationId,
    userMessageId: String(userMessage[0].id),
    assistantMessage: {
      id: String(assistantMessage[0].id),
      role: 'assistant',
      content: reply,
      model,
      inputTokens: usage.prompt_tokens ?? null,
      outputTokens: usage.completion_tokens ?? null,
      estimatedCostUsd: estimatedCostUsd ? estimatedCostUsd.toFixed(8) : null,
      toolResults,
    },
    toolResults,
    context: refreshedSnapshot,
  };
}

export async function approveMarketingAgentDraft(companyId: string, draftId: string) {
  const existing = await sql`
    SELECT id, action_type, title, payload_json, related_record_type, related_record_id, status
    FROM ai_action_drafts
    WHERE id = ${draftId}
      AND company_id = ${companyId}
      AND action_type LIKE 'marketing_%'
    LIMIT 1
  `;
  if (!existing.length) return null;

  const draft = existing[0];
  const payload = parsePayload(draft.payload_json);
  if (String(draft.status || '') === 'Confirmed') {
    return { id: draftId, status: 'Confirmed', payload };
  }

  if (String(draft.related_record_type || '') === 'growth_record' && draft.related_record_id) {
    const recordRows = await sql`
      SELECT payload_json
      FROM growth_records
      WHERE id = ${draft.related_record_id} AND company_id = ${companyId}
      LIMIT 1
    `;
    const recordPayload = parsePayload(recordRows[0]?.payload_json);
    await sql`
      UPDATE growth_records
      SET
        status = CASE WHEN status = 'Drafting' THEN 'Ready' ELSE status END,
        payload_json = ${JSON.stringify({
          ...recordPayload,
          approvalStatus: 'Approved',
          approvedAt: new Date().toISOString(),
        })},
        updated_at = datetime('now')
      WHERE id = ${draft.related_record_id} AND company_id = ${companyId}
    `;
  }

  const approvedPayload = {
    ...payload,
    approvalStatus: 'Approved',
    approvedAt: new Date().toISOString(),
    liveSendEnabled: false,
    note: 'Approved inside the portal. External sending still requires an email provider integration.',
  };
  await sql`
    UPDATE ai_action_drafts
    SET
      status = 'Confirmed',
      payload_json = ${JSON.stringify(approvedPayload)},
      updated_at = datetime('now')
    WHERE id = ${draftId} AND company_id = ${companyId}
  `;

  return { id: draftId, status: 'Confirmed', payload: approvedPayload };
}
