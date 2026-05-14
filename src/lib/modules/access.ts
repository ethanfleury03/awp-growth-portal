import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getPortalUser } from '@/lib/auth/portal-user';
import type { SessionUser } from '@/lib/auth/types';
import { roleAtLeast } from '@/lib/auth/types';
import { getEnabledModules } from '@/lib/workspace/workspace';
import { MODULE_BY_KEY, type ModuleKey } from '@/lib/modules/catalog';
import { canAccessStaging, STAGING_SUPER_ADMIN_ONLY_REASON } from '@/lib/staging/access';

export type ModuleAccess =
  | { ok: true; user: SessionUser; module: ModuleKey }
  | { ok: false; status: 401 | 403; error: string; module: ModuleKey };

export async function getModuleAccess(
  user: SessionUser | null,
  moduleKey: ModuleKey,
): Promise<ModuleAccess> {
  if (!user?.companyId) {
    return { ok: false, status: 401, error: 'Unauthorized', module: moduleKey };
  }
  if (!canAccessStaging(user.role)) {
    return { ok: false, status: 403, error: STAGING_SUPER_ADMIN_ONLY_REASON, module: moduleKey };
  }
  if (user.role === 'super_admin') {
    return { ok: true, user, module: moduleKey };
  }
  const mod = MODULE_BY_KEY.get(moduleKey);
  if (mod && !roleAtLeast(user.role, mod.requiredRole)) {
    return { ok: false, status: 403, error: 'Forbidden', module: moduleKey };
  }
  const enabledModules = await getEnabledModules(user.companyId);
  if (!enabledModules.includes(moduleKey)) {
    return { ok: false, status: 403, error: 'Module not enabled', module: moduleKey };
  }
  return { ok: true, user, module: moduleKey };
}

export async function requireModuleOrRespond(moduleKey: ModuleKey): Promise<SessionUser | NextResponse> {
  const user = await getPortalUser().catch(() => null);
  const access = await getModuleAccess(user, moduleKey);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, module: access.module },
      { status: access.status },
    );
  }
  return access.user;
}

export async function requireModulePage(moduleKey: ModuleKey): Promise<void> {
  const user = await getPortalUser().catch(() => null);
  const access = await getModuleAccess(user, moduleKey);
  if (!access.ok) {
    const reason =
      access.error === 'Forbidden' || access.error === STAGING_SUPER_ADMIN_ONLY_REASON
        ? 'role'
        : access.error === 'Unauthorized'
          ? 'unassigned'
          : 'disabled';
    redirect(`/module-disabled?module=${encodeURIComponent(moduleKey)}&reason=${reason}`);
  }
}
