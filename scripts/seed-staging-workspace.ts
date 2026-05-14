import 'dotenv/config';
import { sql } from '../src/lib/db';
import { ensureAwpDemoData } from '../src/lib/awp/seed';
import { MODULE_CATALOG } from '../src/lib/modules/catalog';
import { getIndustryPreset } from '../src/lib/modules/presets';

const CONFIRM_VALUE = 'seed-staging-data';
const AWP_COMPANY_ID = '00000000-0000-4000-8000-000000000201';
const AWP_BRANCH_ID = '00000000-0000-4000-8000-000000000202';
const AWP_ADMIN_ID = '00000000-0000-4000-8000-000000000402';
const AWP_VIEWER_ID = '00000000-0000-4000-8000-000000000403';

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

async function main() {
  requireStaging();

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

  console.log('[seed-staging-workspace] Seed complete');
  console.log({ companyId, branchId });
}

main().catch((error) => {
  console.error('[seed-staging-workspace] Failed', error);
  process.exit(1);
});
