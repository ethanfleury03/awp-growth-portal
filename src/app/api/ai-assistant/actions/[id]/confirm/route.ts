import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { sql } from '@/lib/db';
import { sourceToSlug, type GrowthRecordType } from '@/lib/awp/config';
import { parseJsonSafely } from '@/lib/ops';
import { requireModuleOrRespond } from '@/lib/modules/access';

function textFromPayload(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function growthRecordForAction(actionType: string): { type: GrowthRecordType; status: string; owner: string; payloadType: string } {
  if (actionType === 'outreach_campaign') {
    return { type: 'campaign', status: 'Drafting', owner: 'Outreach', payloadType: 'AI Campaign Draft' };
  }
  if (actionType === 'seo_task') {
    return { type: 'seo_task', status: 'Idea', owner: 'Marketing', payloadType: 'AI SEO Task' };
  }
  if (actionType === 'marketing_task') {
    return { type: 'project', status: 'Planned', owner: 'Marketing', payloadType: 'AI Marketing Task' };
  }
  if (actionType === 'report_draft') {
    return { type: 'asset', status: 'Draft', owner: 'Reports', payloadType: 'AI Report Draft' };
  }
  if (actionType === 'follow_up_email') {
    return { type: 'asset', status: 'Draft', owner: 'Sales', payloadType: 'AI Follow-up Email' };
  }
  return { type: 'asset', status: 'Draft', owner: 'Sales', payloadType: 'AI Lead Summary' };
}

async function applyLeadStatusUpdate(companyId: string, payload: Record<string, unknown>, relatedRecordId: unknown) {
  const leadId = textFromPayload(payload, ['leadId', 'lead_id', 'id']) || (relatedRecordId ? String(relatedRecordId) : '');
  const rawStatus = textFromPayload(payload, ['status', 'newStatus', 'stage', 'bucket']);
  if (!leadId || !rawStatus) {
    throw new Error('Lead status updates require payload.leadId and payload.status.');
  }

  const status = rawStatus.includes('_') ? rawStatus : sourceToSlug(rawStatus);
  const existing = await sql`
    SELECT id FROM leads
    WHERE id = ${leadId} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (!existing.length) {
    throw new Error('Lead not found for this company.');
  }

  await sql`
    UPDATE leads
    SET
      status = ${status},
      ai_qualification = COALESCE(${textFromPayload(payload, ['reason', 'summary', 'notes']) || null}, ai_qualification),
      updated_at = datetime('now')
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;

  return { type: 'lead', id: leadId, status };
}

async function applyGrowthRecord(companyId: string, actionType: string, title: string, payload: Record<string, unknown>, relatedRecordId: unknown) {
  const mapping = growthRecordForAction(actionType);
  const recordTitle = title || textFromPayload(payload, ['title', 'subject']) || mapping.payloadType;
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
    ) VALUES (
      ${companyId},
      ${mapping.type},
      ${recordTitle},
      ${textFromPayload(payload, ['status']) || mapping.status},
      ${textFromPayload(payload, ['owner']) || mapping.owner},
      ${textFromPayload(payload, ['relatedRecordId', 'leadId', 'lead_id']) || relatedRecordId || null},
      ${JSON.stringify({ ...payload, source: mapping.payloadType, createdFrom: 'ai_action_draft' })},
      ${false},
      ${0}
    )
    RETURNING id, record_type, title, status
  `;

  return {
    type: String(result[0].record_type),
    id: String(result[0].id),
    title: String(result[0].title),
    status: String(result[0].status),
  };
}

async function applyDraft(companyId: string, draft: Record<string, unknown>) {
  const actionType = String(draft.action_type || '');
  const title = String(draft.title || '');
  const payload = parseJsonSafely<Record<string, unknown>>(String(draft.payload_json || '')) || {};
  if (actionType === 'lead_status_update') {
    return applyLeadStatusUpdate(companyId, payload, draft.related_record_id);
  }
  return applyGrowthRecord(companyId, actionType, title, payload, draft.related_record_id);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleOrRespond('ai-assistant');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const existing = await sql`
    SELECT id, status, action_type, title, payload_json, related_record_type, related_record_id
    FROM ai_action_drafts
    WHERE id = ${id} AND company_id = ${auth.companyId}
    LIMIT 1
  `;
  if (!existing.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (String(existing[0].status || '') === 'Confirmed') {
    return NextResponse.json({ ok: true, message: 'Draft was already confirmed.' });
  }

  const appliedResult = await applyDraft(auth.companyId, existing[0]);
  const payload = parseJsonSafely<Record<string, unknown>>(String(existing[0].payload_json || '')) || {};

  await sql`
    UPDATE ai_action_drafts
    SET
      status = 'Confirmed',
      payload_json = ${JSON.stringify({ ...payload, appliedResult })},
      updated_at = datetime('now')
    WHERE id = ${id} AND company_id = ${auth.companyId}
  `;

  return NextResponse.json({
    ok: true,
    appliedResult,
    message: 'Draft confirmed and applied to portal records.',
  });
}
