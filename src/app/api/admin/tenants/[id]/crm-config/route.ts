import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { getIndustryPreset } from '@/lib/modules/presets';

const ENTITY_TYPES = ['lead', 'customer', 'job', 'estimate'] as const;
const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'url'] as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const fields = await sql`
    SELECT * FROM company_custom_fields
    WHERE company_id = ${id}
    ORDER BY entity_type, sort_order, label
  `;
  const stages = await sql`
    SELECT * FROM company_pipeline_stages
    WHERE company_id = ${id}
    ORDER BY entity_type, sort_order, label
  `;
  return NextResponse.json({ fields, stages });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (body?.preset) {
    await applyPreset(id, String(body.preset));
  }
  const fields = Array.isArray(body?.fields) ? body.fields : [];
  const stages = Array.isArray(body?.stages) ? body.stages : [];
  for (const field of fields) {
    const entityType = String(field.entityType || '').trim();
    const fieldKey = String(field.fieldKey || '').trim();
    const label = String(field.label || '').trim();
    const fieldType = String(field.fieldType || 'text').trim();
    if (!ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
      return NextResponse.json({ error: 'Choose a valid custom field entity type.' }, { status: 400 });
    }
    if (!fieldKey || !label) {
      return NextResponse.json({ error: 'Custom fields need a label and key.' }, { status: 400 });
    }
    if (!FIELD_TYPES.includes(fieldType as (typeof FIELD_TYPES)[number])) {
      return NextResponse.json({ error: 'Choose a valid custom field type.' }, { status: 400 });
    }
  }
  for (const stage of stages) {
    const entityType = String(stage.entityType || '').trim();
    const stageKey = String(stage.stageKey || '').trim();
    const label = String(stage.label || '').trim();
    if (!ENTITY_TYPES.includes(entityType as (typeof ENTITY_TYPES)[number])) {
      return NextResponse.json({ error: 'Choose a valid pipeline stage entity type.' }, { status: 400 });
    }
    if (!stageKey || !label) {
      return NextResponse.json({ error: 'Pipeline stages need a label and key.' }, { status: 400 });
    }
  }

  for (const field of Array.isArray(body?.deleteFields) ? body.deleteFields : []) {
    await sql`
      UPDATE company_custom_fields
      SET is_active = false, updated_at = datetime('now')
      WHERE company_id = ${id} AND entity_type = ${field.entityType} AND field_key = ${field.fieldKey}
    `;
  }
  for (const stage of Array.isArray(body?.deleteStages) ? body.deleteStages : []) {
    await sql`
      UPDATE company_pipeline_stages
      SET is_active = false, updated_at = datetime('now')
      WHERE company_id = ${id} AND entity_type = ${stage.entityType} AND stage_key = ${stage.stageKey}
    `;
  }

  for (const [idx, field] of fields.entries()) {
    await sql`
      INSERT INTO company_custom_fields (
        company_id, entity_type, field_key, label, field_type, required, options_json, sort_order, is_active
      ) VALUES (
        ${id}, ${field.entityType}, ${field.fieldKey}, ${field.label}, ${field.fieldType || 'text'},
        ${Boolean(field.required)}, ${field.options ? JSON.stringify(field.options) : null},
        ${field.sortOrder ?? idx}, ${field.isActive !== false}
      )
      ON CONFLICT (company_id, entity_type, field_key) DO UPDATE SET
        label = excluded.label,
        field_type = excluded.field_type,
        required = excluded.required,
        options_json = excluded.options_json,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = datetime('now')
    `;
  }
  for (const [idx, stage] of stages.entries()) {
    await sql`
      INSERT INTO company_pipeline_stages (
        company_id, entity_type, stage_key, label, color, sort_order, is_active
      ) VALUES (
        ${id}, ${stage.entityType}, ${stage.stageKey}, ${stage.label}, ${stage.color || '#2563eb'},
        ${stage.sortOrder ?? idx}, ${stage.isActive !== false}
      )
      ON CONFLICT (company_id, entity_type, stage_key) DO UPDATE SET
        label = excluded.label,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        updated_at = datetime('now')
    `;
  }

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'tenant.crm_config.update',
    entityType: 'company',
    entityId: id,
    summary: 'Updated CRM configuration',
    metadata: { preset: body?.preset ?? null },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ ok: true });
}

async function applyPreset(companyId: string, presetKey: string) {
  const preset = getIndustryPreset(presetKey);
  for (const [idx, stage] of preset.leadStages.entries()) {
    await upsertStage(companyId, 'lead', stage.key, stage.label, stage.color, idx);
  }
  for (const [idx, stage] of preset.jobStages.entries()) {
    await upsertStage(companyId, 'job', stage.key, stage.label, stage.color, idx);
  }
  for (const [idx, field] of preset.customFields.entries()) {
    await sql`
      INSERT INTO company_custom_fields (
        company_id, entity_type, field_key, label, field_type, required, options_json, sort_order, is_active
      ) VALUES (
        ${companyId}, ${field.entityType}, ${field.fieldKey}, ${field.label}, ${field.fieldType},
        ${Boolean(field.required)}, ${field.options ? JSON.stringify(field.options) : null}, ${idx}, true
      )
      ON CONFLICT (company_id, entity_type, field_key) DO UPDATE SET
        label = excluded.label,
        field_type = excluded.field_type,
        required = excluded.required,
        options_json = excluded.options_json,
        is_active = true,
        updated_at = datetime('now')
    `;
  }
}

async function upsertStage(
  companyId: string,
  entityType: string,
  stageKey: string,
  label: string,
  color: string,
  sortOrder: number,
) {
  await sql`
    INSERT INTO company_pipeline_stages (
      company_id, entity_type, stage_key, label, color, sort_order, is_active
    ) VALUES (
      ${companyId}, ${entityType}, ${stageKey}, ${label}, ${color}, ${sortOrder}, true
    )
    ON CONFLICT (company_id, entity_type, stage_key) DO UPDATE SET
      label = excluded.label,
      color = excluded.color,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = datetime('now')
  `;
}
