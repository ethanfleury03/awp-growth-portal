import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';

vi.mock('@/lib/workspace/workspace', () => ({
  getEnabledModules: vi.fn(async () => ['dashboard', 'crm']),
}));

import { getModuleAccess } from '@/lib/modules/access';
import { getEnabledModules } from '@/lib/workspace/workspace';

const mockedGetEnabledModules = vi.mocked(getEnabledModules);

const user: SessionUser = {
  id: 'user_1',
  email: 'client@example.com',
  name: 'Client User',
  role: 'admin',
  companyId: 'company_1',
  branchId: null,
  avatarInitials: 'CU',
};

describe('module access', () => {
  it('rejects unassigned users', async () => {
    const access = await getModuleAccess({ ...user, companyId: '' }, 'crm');
    expect(access.ok).toBe(false);
    if (!access.ok) expect(access.status).toBe(401);
  });

  it('allows enabled modules', async () => {
    const access = await getModuleAccess(user, 'crm');
    expect(access.ok).toBe(true);
  });

  it('rejects disabled modules', async () => {
    const access = await getModuleAccess(user, 'receptionist');
    expect(access.ok).toBe(false);
    if (!access.ok) {
      expect(access.status).toBe(403);
      expect(access.error).toBe('Module not enabled');
    }
  });

  it('lets super admins through for preview/admin needs', async () => {
    const access = await getModuleAccess({ ...user, role: 'super_admin' }, 'receptionist');
    expect(access.ok).toBe(true);
  });

  it('blocks tenant users in the staging environment', async () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'staging';
    try {
      const access = await getModuleAccess(user, 'crm');
      expect(access.ok).toBe(false);
      if (!access.ok) {
        expect(access.status).toBe(403);
        expect(access.error).toBe('staging_super_admin_only');
      }
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });

  it('keeps staging-only modules unavailable outside staging', async () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'production';
    try {
      const access = await getModuleAccess({ ...user, role: 'super_admin' }, 'marketing');
      expect(access.ok).toBe(false);
      if (!access.ok) {
        expect(access.status).toBe(403);
        expect(access.error).toBe('Module not available');
      }
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });

  it('allows marketing when staging enables it', async () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'staging';
    mockedGetEnabledModules.mockResolvedValueOnce(['dashboard', 'crm', 'marketing']);
    try {
      const access = await getModuleAccess(user, 'marketing');
      expect(access.ok).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });
});
