import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { MODULE_CATALOG, type ModuleKey, expandModuleDependencies } from '@/lib/modules/catalog';
import type { CompanyWorkspace } from '@/lib/workspace/types';

const DEFAULT_BRANDING = {
  displayName: 'WNY Automation',
  legalName: null,
  logoUrl: null,
  primaryColor: '#f26a1f',
  accentColor: '#2563eb',
  portalTitle: 'WNY Automation Portal',
  workspaceLabel: 'Automation workspace',
};

function parseEnabled(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['true', '1', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

export async function getEnabledModules(companyId: string): Promise<ModuleKey[]> {
  const rows = await sql`
    SELECT flag_key, enabled
    FROM feature_flags
    WHERE company_id = ${companyId}
      AND flag_key LIKE 'module.%'
  `;
  const byFlag = new Map(rows.map((r) => [String(r.flag_key), parseEnabled(r.enabled)]));
  const enabled = MODULE_CATALOG.filter((mod) => {
    const stored = byFlag.get(mod.flagKey);
    return stored ?? mod.defaultEnabled;
  }).map((mod) => mod.key);
  return expandModuleDependencies(enabled);
}

export async function ensureCompanySettings(companyId: string): Promise<void> {
  await sql`
    INSERT INTO company_settings (company_id, display_name, legal_name)
    SELECT id, name, name FROM companies WHERE id = ${companyId}
    ON CONFLICT (company_id) DO NOTHING
  `;
}

export async function getCompanyWorkspace(user: SessionUser): Promise<CompanyWorkspace> {
  if (!user.companyId) {
    return {
      assigned: false,
      companyId: null,
      companyName: null,
      branchId: null,
      role: user.role ?? null,
      industry: 'generic',
      timezone: 'America/New_York',
      defaultRoute: '/account-unassigned',
      branding: DEFAULT_BRANDING,
      enabledModules: [],
    };
  }

  await ensureCompanySettings(user.companyId);
  const rows = await sql`
    SELECT
      c.name,
      s.display_name,
      s.legal_name,
      s.industry,
      s.timezone,
      s.logo_url,
      s.primary_color,
      s.accent_color,
      s.portal_title,
      s.workspace_label,
      s.default_route
    FROM companies c
    LEFT JOIN company_settings s ON s.company_id = c.id
    WHERE c.id = ${user.companyId}
    LIMIT 1
  `;
  const row = rows[0] ?? {};
  const enabledModules = await getEnabledModules(user.companyId);
  const displayName = String(row.display_name || row.name || DEFAULT_BRANDING.displayName);
  return {
    assigned: true,
    companyId: user.companyId,
    companyName: String(row.name || displayName),
    branchId: user.branchId,
    role: user.role,
    industry: String(row.industry || 'generic'),
    timezone: String(row.timezone || 'America/New_York'),
    defaultRoute: String(row.default_route || '/app'),
    branding: {
      displayName,
      legalName: row.legal_name ? String(row.legal_name) : null,
      logoUrl: row.logo_url ? String(row.logo_url) : null,
      primaryColor: String(row.primary_color || DEFAULT_BRANDING.primaryColor),
      accentColor: String(row.accent_color || DEFAULT_BRANDING.accentColor),
      portalTitle: String(row.portal_title || DEFAULT_BRANDING.portalTitle),
      workspaceLabel: String(row.workspace_label || DEFAULT_BRANDING.workspaceLabel),
    },
    enabledModules,
  };
}
