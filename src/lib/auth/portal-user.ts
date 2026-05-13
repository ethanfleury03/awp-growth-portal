import { auth, currentUser } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import {
  getGatewayAccessConfig,
  verifyGatewayPortalAccess,
  type GatewayAccessAllowed,
} from '@/lib/auth/gateway-access';
import type { SessionUser, UserRole } from '@/lib/auth/types';

/**
 * Portal user for API routes and `/api/auth/me` — Clerk session plus optional
 * `portal_users` row matched by email for company/role.
 */
export async function getPortalUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email =
    user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
  if (!email) return null;

  const meta = user.publicMetadata as Record<string, unknown> | undefined;
  const roleMeta = meta?.role as SessionUser['role'] | undefined;
  const companyMeta = meta?.companyId as string | undefined;
  const branchMeta = meta?.branchId as string | undefined;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    email;

  let companyId = companyMeta?.trim() || '';
  let branchId = branchMeta?.trim() || '';
  let role: SessionUser['role'] = roleMeta || 'staff';
  let portalRowId: string | null = null;
  let gatewayDenied = false;

  const rows = await sql`
    SELECT id, company_id, role FROM portal_users
    WHERE clerk_user_id = ${userId} OR lower(email) = ${email.toLowerCase()}
    ORDER BY (clerk_user_id = ${userId}) DESC
    LIMIT 1
  `;
  const row = rows[0] as { id?: string; company_id?: string; role?: string } | undefined;
  if (row) {
    portalRowId = String(row.id);
    if (row.company_id) companyId = String(row.company_id);
    if (row.role) role = row.role as SessionUser['role'];
  }

  const gatewayConfig = getGatewayAccessConfig();
  if (gatewayConfig.configured) {
    const gatewayAccess = await verifyGatewayPortalAccess({ clerkUserId: userId, email });
    if (gatewayAccess.configured && gatewayAccess.allowed) {
      const gatewayCompanyId = await resolveGatewayLocalCompanyId(gatewayAccess);
      if (gatewayCompanyId) {
        companyId = gatewayCompanyId;
        role = normalizeGatewayRole(gatewayAccess.role);
        portalRowId = await upsertGatewayPortalUser({
          clerkUserId: userId,
          email,
          name,
          companyId,
          role,
        });
      } else {
        gatewayDenied = true;
      }
    } else {
      gatewayDenied = true;
    }
  }

  if (portalRowId && companyId && !gatewayDenied) {
    const memberships = await sql`
      SELECT branch_id, role
      FROM user_memberships
      WHERE user_id = ${portalRowId}
        AND company_id = ${companyId}
        AND status = 'active'
      ORDER BY CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END, created_at ASC
      LIMIT 1
    `;
    const membership = memberships[0] as { branch_id?: string; role?: string } | undefined;
    if (membership?.branch_id) branchId = String(membership.branch_id);
    if (membership?.role) role = membership.role as SessionUser['role'];
  }

  if (!branchId && companyId && !gatewayDenied) {
    await ensurePrimaryBranch(companyId);
    const branches = await sql`
      SELECT id
      FROM branches
      WHERE company_id = ${companyId}
      ORDER BY is_primary DESC, created_at ASC
      LIMIT 1
    `;
    branchId = String((branches[0] as { id?: string } | undefined)?.id || '');
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || email.slice(0, 2).toUpperCase();

  if (gatewayDenied) {
    companyId = '';
    branchId = '';
  }

  if (!companyId) {
    await recordUnassignedPortalUser({
      email,
      clerkUserId: userId,
      name,
    }).catch((error) => console.warn('[auth] failed to record unassigned user', error));
  }

  return {
    id: portalRowId || userId,
    email,
    name,
    role,
    companyId,
    branchId: branchId || null,
    avatarInitials: initials,
  };
}

function normalizeGatewayRole(role: string): UserRole {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'owner' || normalized === 'super_admin') return 'admin';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'dispatcher') return 'dispatcher';
  if (normalized === 'tech') return 'tech';
  if (normalized === 'viewer') return 'viewer';
  return 'staff';
}

async function localCompanyExists(companyId: string) {
  if (!companyId) return false;
  const rows = await sql`SELECT id FROM companies WHERE id = ${companyId} LIMIT 1`;
  return Boolean(rows[0]);
}

function destinationEmail(destinationKey: string) {
  const safeKey = destinationKey
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safeKey || 'portal'}@gateway.local`;
}

async function resolveGatewayLocalCompanyId(access: GatewayAccessAllowed) {
  const configuredCompanyId = (process.env.PORTAL_GATEWAY_LOCAL_COMPANY_ID || '').trim();
  if (configuredCompanyId && (await localCompanyExists(configuredCompanyId))) {
    return configuredCompanyId;
  }

  if (await localCompanyExists(access.companyId)) {
    return access.companyId;
  }

  const existingCompanies = await sql`
    SELECT id
    FROM companies
    ORDER BY created_at ASC
    LIMIT 2
  `;
  if (existingCompanies.length === 1) {
    return String((existingCompanies[0] as { id?: string }).id || '');
  }
  if (existingCompanies.length > 1) {
    return '';
  }

  const companyName = access.companyName.trim() || 'AWP Growth Portal';
  const inserted = await sql`
    INSERT INTO companies (name, email)
    VALUES (${companyName}, ${destinationEmail(access.destinationKey)})
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = datetime('now')
    RETURNING id
  `;
  const companyId = String((inserted[0] as { id?: string } | undefined)?.id || '');
  if (companyId) {
    await sql`
      INSERT INTO company_settings (company_id, display_name, legal_name, industry, timezone, portal_title, workspace_label)
      VALUES (
        ${companyId},
        ${companyName},
        ${companyName},
        'agency',
        'America/New_York',
        ${`${companyName} Portal`},
        ${`${companyName} workspace`}
      )
      ON CONFLICT (company_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        legal_name = EXCLUDED.legal_name,
        industry = EXCLUDED.industry,
        updated_at = datetime('now')
    `;
    await ensurePrimaryBranch(companyId, companyName);
  }
  return companyId;
}

async function ensurePrimaryBranch(companyId: string, companyName = 'Main') {
  await sql`
    INSERT INTO branches (company_id, name, is_primary)
    SELECT ${companyId}, ${companyName}, true
    WHERE NOT EXISTS (
      SELECT 1 FROM branches WHERE company_id = ${companyId}
    )
  `;
}

async function upsertGatewayPortalUser({
  clerkUserId,
  email,
  name,
  companyId,
  role,
}: {
  clerkUserId: string;
  email: string;
  name: string;
  companyId: string;
  role: UserRole;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await sql`
    SELECT id
    FROM portal_users
    WHERE clerk_user_id = ${clerkUserId} OR lower(email) = ${normalizedEmail}
    ORDER BY (clerk_user_id = ${clerkUserId}) DESC
    LIMIT 1
  `;
  let id = String((existing[0] as { id?: string } | undefined)?.id || '');
  if (id) {
    await sql`
      UPDATE portal_users
      SET
        clerk_user_id = ${clerkUserId},
        email = ${normalizedEmail},
        name = ${name},
        company_id = ${companyId},
        role = ${role},
        is_active = true,
        updated_at = datetime('now')
      WHERE id = ${id}
    `;
  } else {
    const inserted = await sql`
      INSERT INTO portal_users (clerk_user_id, email, name, company_id, role, hashed_pw, is_active)
      VALUES (${clerkUserId}, ${normalizedEmail}, ${name}, ${companyId}, ${role}, '', true)
      RETURNING id
    `;
    id = String((inserted[0] as { id?: string } | undefined)?.id || '');
  }

  if (id) {
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
  }

  return id || null;
}

export async function recordUnassignedPortalUser({
  email,
  clerkUserId,
  name,
}: {
  email: string;
  clerkUserId: string;
  name: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  await sql`
    INSERT INTO unassigned_portal_users (email, clerk_user_id, name, metadata_json)
    VALUES (${normalizedEmail}, ${clerkUserId || null}, ${name || null}, ${JSON.stringify({ source: 'portal_auth' })})
    ON CONFLICT (email) DO UPDATE SET
      clerk_user_id = COALESCE(EXCLUDED.clerk_user_id, unassigned_portal_users.clerk_user_id),
      name = COALESCE(EXCLUDED.name, unassigned_portal_users.name),
      last_seen_at = datetime('now')
  `;
}
