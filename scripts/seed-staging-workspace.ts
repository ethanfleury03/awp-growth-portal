import 'dotenv/config';
import { sql, withSuperAdminContext } from '../src/lib/db';
import { ensureAwpDemoData } from '../src/lib/awp/seed';
import { MODULE_CATALOG } from '../src/lib/modules/catalog';
import { getIndustryPreset } from '../src/lib/modules/presets';

const CONFIRM_VALUE = 'seed-staging-data';
const AWP_COMPANY_ID = '00000000-0000-4000-8000-000000000201';
const AWP_BRANCH_ID = '00000000-0000-4000-8000-000000000202';
const AWP_ADMIN_ID = '00000000-0000-4000-8000-000000000402';
const AWP_VIEWER_ID = '00000000-0000-4000-8000-000000000403';
const AWP_CUSTOMER_ID = '00000000-0000-4000-8000-000000000501';
const AWP_LEAD_ID = '00000000-0000-4000-8000-000000000502';
const AWP_JOB_ID = '00000000-0000-4000-8000-000000000503';
const AWP_CALL_SCENARIO_ID = '00000000-0000-4000-8000-000000000504';
const AWP_CALL_ID = '00000000-0000-4000-8000-000000000505';
const AWP_ESTIMATE_ID = '00000000-0000-4000-8000-000000000506';
const AWP_CRM_COMPANY_ID = '00000000-0000-4000-8000-000000000507';
const AWP_CRM_CONTACT_ID = '00000000-0000-4000-8000-000000000508';

function requireStaging() {
  if (process.env.APP_ENV !== 'staging') {
    throw new Error('Refusing to seed: APP_ENV must be exactly "staging".');
  }
  if (process.env.STAGING_SEED_CONFIRM !== CONFIRM_VALUE) {
    throw new Error(`Refusing to seed: STAGING_SEED_CONFIRM must be "${CONFIRM_VALUE}".`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('Refusing to seed: DATABASE_URL is required for the shared staging database.');
  }
}

async function upsertAwpCompany() {
  const email = (process.env.STAGING_AWP_COMPANY_EMAIL || 'staging-awp@wnyautomation.test').toLowerCase();
  const existing = await sql`
    SELECT id FROM companies
    WHERE id = ${AWP_COMPANY_ID} OR lower(email) = ${email}
    LIMIT 1
  `;
  const id = String((existing[0] as { id?: string } | undefined)?.id || AWP_COMPANY_ID);

  if (existing[0]) {
    await sql`
      UPDATE companies
      SET
        name = ${process.env.STAGING_AWP_COMPANY_NAME || 'AWP Staging'},
        email = ${email},
        phone = ${process.env.STAGING_AWP_COMPANY_PHONE || null},
        status = 'active',
        updated_at = datetime('now')
      WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO companies (id, name, email, phone, status)
      VALUES (
        ${id},
        ${process.env.STAGING_AWP_COMPANY_NAME || 'AWP Staging'},
        ${email},
        ${process.env.STAGING_AWP_COMPANY_PHONE || null},
        'active'
      )
    `;
  }

  await sql`
    INSERT INTO company_settings (company_id, display_name, legal_name, industry, timezone, portal_title, workspace_label, default_route)
    VALUES (
      ${id},
      ${process.env.STAGING_AWP_COMPANY_NAME || 'AWP Staging'},
      ${process.env.STAGING_AWP_COMPANY_NAME || 'AWP Staging'},
      'generic',
      'America/Toronto',
      'AWP Growth Portal',
      'AWP staging workspace',
      '/app'
    )
    ON CONFLICT (company_id) DO UPDATE SET
      display_name = excluded.display_name,
      legal_name = excluded.legal_name,
      industry = excluded.industry,
      timezone = excluded.timezone,
      portal_title = excluded.portal_title,
      workspace_label = excluded.workspace_label,
      default_route = excluded.default_route,
      updated_at = datetime('now')
  `;

  return id;
}

async function ensurePrimaryBranch(companyId: string) {
  const existing = await sql`
    SELECT id
    FROM branches
    WHERE id = ${AWP_BRANCH_ID} OR company_id = ${companyId}
    ORDER BY CASE WHEN id = ${AWP_BRANCH_ID} THEN 0 WHEN is_primary = true THEN 1 ELSE 2 END
    LIMIT 1
  `;
  const branchId = String((existing[0] as { id?: string } | undefined)?.id || AWP_BRANCH_ID);

  if (existing[0]) {
    await sql`
      UPDATE branches
      SET name = 'AWP Staging', code = 'AWP-STG', is_primary = true, updated_at = datetime('now')
      WHERE id = ${branchId}
    `;
  } else {
    await sql`
      INSERT INTO branches (id, company_id, name, code, is_primary)
      VALUES (${branchId}, ${companyId}, 'AWP Staging', 'AWP-STG', true)
    `;
  }

  return branchId;
}

async function upsertUser(input: {
  id: string;
  companyId: string;
  branchId: string;
  email: string;
  name: string;
  role: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await sql`
    SELECT id FROM portal_users
    WHERE id = ${input.id} OR lower(email) = ${email}
    LIMIT 1
  `;
  const id = String((existing[0] as { id?: string } | undefined)?.id || input.id);

  if (existing[0]) {
    await sql`
      UPDATE portal_users
      SET company_id = ${input.companyId}, email = ${email}, name = ${input.name}, role = ${input.role}, is_active = true, updated_at = datetime('now')
      WHERE id = ${id}
    `;
  } else {
    await sql`
      INSERT INTO portal_users (id, company_id, email, name, hashed_pw, role, is_active)
      VALUES (${id}, ${input.companyId}, ${email}, ${input.name}, '', ${input.role}, true)
    `;
  }

  await sql`
    INSERT INTO user_memberships (user_id, company_id, branch_id, role, status)
    VALUES (${id}, ${input.companyId}, ${input.branchId}, ${input.role}, 'active')
    ON CONFLICT (user_id, company_id) DO UPDATE SET
      branch_id = excluded.branch_id,
      role = excluded.role,
      status = 'active',
      updated_at = datetime('now')
  `;
}

async function seedModules(companyId: string) {
  const preset = getIndustryPreset('generic');
  for (const mod of MODULE_CATALOG) {
    const enabled = preset.modules.includes(mod.key);
    await sql`
      INSERT INTO feature_flags (company_id, key, value, flag_key, enabled, payload_json)
      VALUES (${companyId}, ${mod.flagKey}, ${enabled ? 'true' : 'false'}, ${mod.flagKey}, ${enabled}, null)
      ON CONFLICT (company_id, flag_key) DO UPDATE SET
        enabled = excluded.enabled,
        value = excluded.value,
        updated_at = datetime('now')
    `;
  }
}

async function seedOperationalMockData(companyId: string, branchId: string) {
  await sql`
    INSERT INTO customers (id, company_id, branch_id, name, email, phone, address, notes, email_opt_in, sms_opt_in)
    VALUES (
      ${AWP_CUSTOMER_ID},
      ${companyId},
      ${branchId},
      'Pat Staging',
      'pat.staging@example.test',
      '(716) 555-0180',
      '214 Test Harbor Rd, Buffalo, NY',
      'Deterministic fake customer for AWP staging.',
      true,
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      branch_id = excluded.branch_id,
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      address = excluded.address,
      notes = excluded.notes,
      email_opt_in = excluded.email_opt_in,
      sms_opt_in = excluded.sms_opt_in,
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO leads (
      id,
      company_id,
      branch_id,
      customer_id,
      source,
      status,
      priority,
      issue,
      description,
      location,
      ai_qualification,
      ai_score,
      lead_context_json,
      estimated_value_cents
    )
    VALUES (
      ${AWP_LEAD_ID},
      ${companyId},
      ${branchId},
      ${AWP_CUSTOMER_ID},
      'staging-receptionist',
      'qualified',
      1,
      'Basement drain backup',
      'Fake staging lead generated by the mock receptionist workflow.',
      'Buffalo, NY',
      'High-fit emergency service request with clear contact info.',
      91,
      ${JSON.stringify({ source: 'staging-seed', urgency: 'high', trade: 'plumbing' })},
      125000
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      branch_id = excluded.branch_id,
      customer_id = excluded.customer_id,
      source = excluded.source,
      status = excluded.status,
      priority = excluded.priority,
      issue = excluded.issue,
      description = excluded.description,
      location = excluded.location,
      ai_qualification = excluded.ai_qualification,
      ai_score = excluded.ai_score,
      lead_context_json = excluded.lead_context_json,
      estimated_value_cents = excluded.estimated_value_cents,
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO jobs (
      id,
      company_id,
      branch_id,
      lead_id,
      customer_id,
      status,
      type,
      description,
      scheduled_date,
      scheduled_time,
      estimated_price,
      notes
    )
    VALUES (
      ${AWP_JOB_ID},
      ${companyId},
      ${branchId},
      ${AWP_LEAD_ID},
      ${AWP_CUSTOMER_ID},
      'scheduled',
      'Drain assessment',
      'Fake staging job for validating dashboard, job detail, and estimate conversion flows.',
      '2026-05-20',
      '09:30',
      850,
      'Seeded staging job. Safe to edit or delete.'
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      branch_id = excluded.branch_id,
      lead_id = excluded.lead_id,
      customer_id = excluded.customer_id,
      status = excluded.status,
      type = excluded.type,
      description = excluded.description,
      scheduled_date = excluded.scheduled_date,
      scheduled_time = excluded.scheduled_time,
      estimated_price = excluded.estimated_price,
      notes = excluded.notes,
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO receptionist_mock_scenarios (
      id,
      company_id,
      name,
      description,
      transcript_script_json,
      expected_outcome,
      is_default
    )
    VALUES (
      ${AWP_CALL_SCENARIO_ID},
      ${companyId},
      'Staging emergency drain call',
      'Fake inbound call used to test receptionist triage without Retell or Twilio.',
      ${JSON.stringify([
        { speaker: 'caller', text: 'My basement drain is backing up and I need help today.' },
        { speaker: 'assistant', text: 'I can help with that. Are you at the service address now?' },
        { speaker: 'caller', text: 'Yes. The address is 214 Test Harbor Road in Buffalo.' },
      ])},
      'Create urgent lead, recommend same-day callback, and draft an estimate.',
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      name = excluded.name,
      description = excluded.description,
      transcript_script_json = excluded.transcript_script_json,
      expected_outcome = excluded.expected_outcome,
      is_default = excluded.is_default
  `;

  await sql`
    INSERT INTO receptionist_calls (
      id,
      company_id,
      branch_id,
      provider,
      provider_call_id,
      direction,
      from_phone,
      to_phone,
      caller_name,
      status,
      started_at,
      ended_at,
      duration_seconds,
      transcript_text,
      ai_summary,
      extracted_json,
      recommended_next_step,
      disposition,
      urgency,
      lead_id,
      job_id,
      mock_scenario_id,
      receptionist_meta_json
    )
    VALUES (
      ${AWP_CALL_ID},
      ${companyId},
      ${branchId},
      'mock',
      'staging-call-001',
      'inbound',
      '+17165550180',
      '+17165550100',
      'Pat Staging',
      'completed',
      '2026-05-14T14:00:00Z',
      '2026-05-14T14:04:00Z',
      240,
      'Caller reports a basement drain backup at 214 Test Harbor Rd and wants a same-day callback.',
      'Urgent drain backup lead with full contact details.',
      ${JSON.stringify({ issue: 'basement drain backup', city: 'Buffalo', source: 'staging-seed' })},
      'Dispatch same-day callback and prepare drain assessment estimate.',
      'qualified_lead',
      'high',
      ${AWP_LEAD_ID},
      ${AWP_JOB_ID},
      ${AWP_CALL_SCENARIO_ID},
      ${JSON.stringify({ seeded: true, provider: 'mock' })}
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      branch_id = excluded.branch_id,
      provider = excluded.provider,
      provider_call_id = excluded.provider_call_id,
      direction = excluded.direction,
      from_phone = excluded.from_phone,
      to_phone = excluded.to_phone,
      caller_name = excluded.caller_name,
      status = excluded.status,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      duration_seconds = excluded.duration_seconds,
      transcript_text = excluded.transcript_text,
      ai_summary = excluded.ai_summary,
      extracted_json = excluded.extracted_json,
      recommended_next_step = excluded.recommended_next_step,
      disposition = excluded.disposition,
      urgency = excluded.urgency,
      lead_id = excluded.lead_id,
      job_id = excluded.job_id,
      mock_scenario_id = excluded.mock_scenario_id,
      receptionist_meta_json = excluded.receptionist_meta_json,
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO estimates (
      id,
      company_id,
      branch_id,
      estimate_number,
      status,
      title,
      description,
      customer_id,
      lead_id,
      job_id,
      receptionist_call_id,
      source_type,
      source_id,
      subtotal_amount_cents,
      tax_amount_cents,
      total_amount_cents,
      deposit_amount_cents,
      company_name_snapshot,
      company_email_snapshot,
      customer_name_snapshot,
      customer_email_snapshot,
      customer_phone_snapshot,
      service_address_snapshot,
      notes_customer,
      expiration_date,
      sent_at,
      customer_public_token
    )
    VALUES (
      ${AWP_ESTIMATE_ID},
      ${companyId},
      ${branchId},
      'STG-AWP-1001',
      'sent',
      'Staging drain assessment',
      'Fake estimate for validating AWP staging estimate views and payment-disabled flows.',
      ${AWP_CUSTOMER_ID},
      ${AWP_LEAD_ID},
      ${AWP_JOB_ID},
      ${AWP_CALL_ID},
      'receptionist',
      'staging-call-001',
      85000,
      7425,
      92425,
      0,
      'AWP Staging',
      'staging-awp@wnyautomation.test',
      'Pat Staging',
      'pat.staging@example.test',
      '(716) 555-0180',
      '214 Test Harbor Rd, Buffalo, NY',
      'This is fake staging data. No payment or dispatch should be triggered.',
      '2026-06-14',
      '2026-05-14T14:10:00Z',
      'staging-public-token-awp-1001'
    )
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      branch_id = excluded.branch_id,
      estimate_number = excluded.estimate_number,
      status = excluded.status,
      title = excluded.title,
      description = excluded.description,
      customer_id = excluded.customer_id,
      lead_id = excluded.lead_id,
      job_id = excluded.job_id,
      receptionist_call_id = excluded.receptionist_call_id,
      source_type = excluded.source_type,
      source_id = excluded.source_id,
      subtotal_amount_cents = excluded.subtotal_amount_cents,
      tax_amount_cents = excluded.tax_amount_cents,
      total_amount_cents = excluded.total_amount_cents,
      deposit_amount_cents = excluded.deposit_amount_cents,
      company_name_snapshot = excluded.company_name_snapshot,
      company_email_snapshot = excluded.company_email_snapshot,
      customer_name_snapshot = excluded.customer_name_snapshot,
      customer_email_snapshot = excluded.customer_email_snapshot,
      customer_phone_snapshot = excluded.customer_phone_snapshot,
      service_address_snapshot = excluded.service_address_snapshot,
      notes_customer = excluded.notes_customer,
      expiration_date = excluded.expiration_date,
      sent_at = excluded.sent_at,
      customer_public_token = excluded.customer_public_token,
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO crm_companies (id, provider, external_id, name, domain, website, raw_json)
    VALUES (
      ${AWP_CRM_COMPANY_ID},
      'hubspot',
      'staging-awp-crm-company',
      'Pat Staging Property Services',
      'example.test',
      'https://example.test/pat-staging',
      ${JSON.stringify({ seeded: true, source: 'staging' })}
    )
    ON CONFLICT (id) DO UPDATE SET
      provider = excluded.provider,
      external_id = excluded.external_id,
      name = excluded.name,
      domain = excluded.domain,
      website = excluded.website,
      raw_json = excluded.raw_json,
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO crm_contacts (
      id,
      provider,
      external_id,
      email,
      name,
      first_name,
      last_name,
      phone,
      job_title,
      company_external_id,
      company_name,
      lifecycle_stage,
      raw_json
    )
    VALUES (
      ${AWP_CRM_CONTACT_ID},
      'hubspot',
      'staging-awp-crm-contact',
      'pat.staging@example.test',
      'Pat Staging',
      'Pat',
      'Staging',
      '(716) 555-0180',
      'Facilities Manager',
      'staging-awp-crm-company',
      'Pat Staging Property Services',
      'lead',
      ${JSON.stringify({ seeded: true, source: 'staging' })}
    )
    ON CONFLICT (id) DO UPDATE SET
      provider = excluded.provider,
      external_id = excluded.external_id,
      email = excluded.email,
      name = excluded.name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      job_title = excluded.job_title,
      company_external_id = excluded.company_external_id,
      company_name = excluded.company_name,
      lifecycle_stage = excluded.lifecycle_stage,
      raw_json = excluded.raw_json,
      updated_at = datetime('now')
  `;
}

async function main() {
  requireStaging();

  await withSuperAdminContext(async () => {
    const companyId = await upsertAwpCompany();
    const branchId = await ensurePrimaryBranch(companyId);

    await upsertUser({
      id: AWP_ADMIN_ID,
      companyId,
      branchId,
      email: process.env.STAGING_AWP_ADMIN_EMAIL || 'staging.awp.admin@wnyautomation.test',
      name: 'AWP Staging Admin',
      role: 'admin',
    });
    await upsertUser({
      id: AWP_VIEWER_ID,
      companyId,
      branchId,
      email: 'staging.awp.viewer@wnyautomation.test',
      name: 'AWP Staging Viewer',
      role: 'viewer',
    });

    await seedModules(companyId);
    await ensureAwpDemoData(companyId, branchId);
    await seedOperationalMockData(companyId, branchId);

    console.log('[seed-staging-workspace] Seed complete');
    console.log({ companyId, branchId });
  });
}

main().catch((error) => {
  console.error('[seed-staging-workspace] Failed', error);
  process.exit(1);
});
