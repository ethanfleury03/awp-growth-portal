import { NextResponse } from 'next/server';
import { ensureAwpDemoData } from '@/lib/awp/seed';
import { sql, withSuperAdminContext } from '@/lib/db';

const CONFIRM_VALUE = 'seed-staging-data';
const AWP_COMPANY_ID = '00000000-0000-4000-8000-000000000201';
const AWP_BRANCH_ID = '00000000-0000-4000-8000-000000000202';

export const dynamic = 'force-dynamic';

async function upsertStagingCompany() {
  await sql`
    INSERT INTO companies (id, name, email, phone, status)
    VALUES (${AWP_COMPANY_ID}, 'AWP Staging', 'staging-awp@wnyautomation.test', null, 'active')
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      phone = excluded.phone,
      status = 'active',
      updated_at = datetime('now')
  `;

  await sql`
    INSERT INTO company_settings (company_id, display_name, legal_name, industry, timezone, portal_title, workspace_label, default_route)
    VALUES (${AWP_COMPANY_ID}, 'AWP Staging', 'AWP Staging', 'generic', 'America/Toronto', 'AWP Growth Portal', 'AWP staging workspace', '/app')
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

  await sql`
    INSERT INTO branches (id, company_id, name, code, is_primary)
    VALUES (${AWP_BRANCH_ID}, ${AWP_COMPANY_ID}, 'AWP Staging', 'AWP-STG', true)
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      name = excluded.name,
      code = excluded.code,
      is_primary = true,
      updated_at = datetime('now')
  `;
}

export async function GET(request: Request) {
  if (process.env.APP_ENV !== 'staging') {
    return NextResponse.json({ error: 'This seed endpoint only runs in staging.' }, { status: 403 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('confirm') !== CONFIRM_VALUE) {
    return NextResponse.json({ error: `Missing confirm=${CONFIRM_VALUE}.` }, { status: 400 });
  }

  await withSuperAdminContext(async () => {
    await upsertStagingCompany();
    await ensureAwpDemoData(AWP_COMPANY_ID, AWP_BRANCH_ID);
  });

  return NextResponse.json({
    ok: true,
    companyId: AWP_COMPANY_ID,
    branchId: AWP_BRANCH_ID,
  });
}
