import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { getIndustryPreset } from '@/lib/modules/presets';

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
  for (const [idx, field] of (Array.isArray(body?.fields) ? body.fields : []).entries()) {
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
  for (const [idx, stage] of (Array.isArray(body?.stages) ? body.stages : []).entries()) {
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
