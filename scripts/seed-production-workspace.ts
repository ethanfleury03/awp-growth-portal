import 'dotenv/config';
import { sql } from '../src/lib/db';
import { MODULE_CATALOG } from '../src/lib/modules/catalog';
import { getIndustryPreset } from '../src/lib/modules/presets';

const wny = {
  name: process.env.SEED_WNY_COMPANY_NAME || 'WNY Automation',
  email: (process.env.SEED_WNY_COMPANY_EMAIL || 'hello@wnyautomation.com').toLowerCase(),
  phone: process.env.SEED_WNY_COMPANY_PHONE || null,
};

function requiredSeedEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`[seed-production-workspace] ${key} is required. Refusing to seed sample production data.`);
  }
  return value;
}

const sampleClient = {
  name: requiredSeedEnv('SEED_CLIENT_COMPANY_NAME'),
  email: requiredSeedEnv('SEED_CLIENT_COMPANY_EMAIL').toLowerCase(),
  phone: process.env.SEED_CLIENT_COMPANY_PHONE || null,
  industry: process.env.SEED_CLIENT_INDUSTRY || 'generic',
};

const superAdmin = {
  email: (process.env.SEED_SUPER_ADMIN_EMAIL || 'ethan@wnyautomation.com').toLowerCase(),
  name: process.env.SEED_SUPER_ADMIN_NAME || 'Ethan Fleury',
};

const clientAdmin = {
  email: requiredSeedEnv('SEED_CLIENT_ADMIN_EMAIL').toLowerCase(),
  name: requiredSeedEnv('SEED_CLIENT_ADMIN_NAME'),
};

async function upsertCompany(company: { name: string; email: string; phone?: string | null; industry?: string }) {
  const existing = await sql`SELECT id FROM companies WHERE lower(email) = ${company.email} LIMIT 1`;
  let id = String((existing[0] as { id?: string } | undefined)?.id || '');
  if (id) {
    await sql`
      UPDATE companies
      SET name = ${company.name}, phone = ${company.phone || null}, updated_at = datetime('now')
      WHERE id = ${id}
    `;
  } else {
    const inserted = await sql`
      INSERT INTO companies (name, email, phone)
      VALUES (${company.name}, ${company.email}, ${company.phone || null})
      RETURNING id
    `;
    id = String((inserted[0] as { id?: string }).id);
  }
  await sql`
    INSERT INTO company_settings (company_id, display_name, legal_name, industry, timezone, portal_title, workspace_label)
    VALUES (
      ${id},
      ${company.name},
      ${company.name},
      ${company.industry || 'generic'},
      'America/New_York',
      ${`${company.name} Portal`},
      ${`${company.name} workspace`}
    )
    ON CONFLICT (company_id) DO UPDATE SET
      display_name = excluded.display_name,
      legal_name = excluded.legal_name,
      industry = excluded.industry,
      updated_at = datetime('now')
  `;
  return id;
}

async function upsertUser(user: { email: string; name: string }, companyId: string, role: string) {
  const existing = await sql`SELECT id FROM portal_users WHERE lower(email) = ${user.email} LIMIT 1`;
  let id = String((existing[0] as { id?: string } | undefined)?.id || '');
  if (id) {
    await sql`
      UPDATE portal_users
      SET company_id = ${companyId}, name = ${user.name}, role = ${role}, is_active = true, updated_at = datetime('now')
      WHERE id = ${id}
    `;
  } else {
    const inserted = await sql`
      INSERT INTO portal_users (company_id, email, name, hashed_pw, role, is_active)
      VALUES (${companyId}, ${user.email}, ${user.name}, '', ${role}, true)
      RETURNING id
    `;
    id = String((inserted[0] as { id?: string }).id);
  }
  const membership = await sql`
    SELECT user_id FROM user_memberships
    WHERE user_id = ${id} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (membership[0]) {
    await sql`
      UPDATE user_memberships
      SET role = ${role}, status = 'active', updated_at = datetime('now')
      WHERE user_id = ${id} AND company_id = ${companyId}
    `;
  } else {
    await sql`
      INSERT INTO user_memberships (user_id, company_id, role, status)
      VALUES (${id}, ${companyId}, ${role}, 'active')
    `;
  }
  return id;
}

async function seedModules(companyId: string, industry: string) {
  const preset = getIndustryPreset(industry);
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

async function ensurePrimaryBranch(companyId: string, name: string) {
  await sql`
    INSERT INTO branches (company_id, name, is_primary)
    SELECT ${companyId}, ${name}, true
    WHERE NOT EXISTS (
      SELECT 1 FROM branches WHERE company_id = ${companyId}
    )
  `;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[seed-production-workspace] DATABASE_URL is required. Refusing to seed the local SQLite fallback from a production seed command.',
    );
  }
  const wnyCompanyId = await upsertCompany({ ...wny, industry: 'agency' });
  const clientCompanyId = await upsertCompany(sampleClient);
  await ensurePrimaryBranch(wnyCompanyId, 'WNY Automation');
  await ensurePrimaryBranch(clientCompanyId, 'Main');
  await seedModules(wnyCompanyId, 'agency');
  await seedModules(clientCompanyId, sampleClient.industry);
  await upsertUser(superAdmin, wnyCompanyId, 'super_admin');
  await upsertUser(clientAdmin, clientCompanyId, 'admin');
  console.log('[seed-production-workspace] Seed complete');
  console.log({ wnyCompanyId, clientCompanyId, superAdmin: superAdmin.email, clientAdmin: clientAdmin.email });
}

main().catch((error) => {
  console.error('[seed-production-workspace] Failed', error);
  process.exit(1);
});
