import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { SessionUser } from '@/lib/auth/types';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock('@/lib/auth/tenant', () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
  isPortalResponse: (value: unknown) => value instanceof Response,
}));

const superAdmin: SessionUser = {
  id: 'user_1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'super_admin',
  companyId: 'company_1',
  branchId: null,
  avatarInitials: 'OW',
};

const originalEnv = process.env;

describe('GET /api/admin/staging', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    mocks.requireSuperAdmin.mockResolvedValue(superAdmin);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('passes through auth failures', async () => {
    mocks.requireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('passes through super-admin authorization failures', async () => {
    mocks.requireSuperAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    );

    const response = await GET();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns unconfigured state when staging URL is missing', async () => {
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.configured).toBe(false);
    expect(json.health.status).toBe('unconfigured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns healthy state from staging health check', async () => {
    process.env.STAGING_PORTAL_URL = 'https://staging.example.com';
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          db: 'up',
          version: 'abc1234',
          elapsedMs: 12,
          checks: { database: true },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const response = await GET();
    const json = await response.json();

    expect(json.configured).toBe(true);
    expect(json.stagingUrl).toBe('https://staging.example.com');
    expect(json.healthUrl).toBe('https://staging.example.com/api/health');
    expect(json.health).toMatchObject({
      ok: true,
      status: 'healthy',
      httpStatus: 200,
      db: 'up',
      version: 'abc1234',
    });
  });

  it('keeps the admin endpoint available when staging is unreachable', async () => {
    process.env.STAGING_PORTAL_URL = 'https://staging.example.com';
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.health.ok).toBe(false);
    expect(json.health.status).toBe('unreachable');
    expect(json.health.error).toBe('network down');
  });
});
