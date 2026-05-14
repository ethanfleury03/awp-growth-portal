import { describe, expect, it } from 'vitest';
import {
  assertSqliteSafeForRuntime,
  enterTenantContext,
  getDatabaseMode,
  getSqlRuntimeContext,
  prepareSqlRuntimeContext,
  requiresManagedPostgres,
  withSuperAdminContext,
} from '@/lib/db';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('database runtime mode guards', () => {
  it('detects Postgres mode from DATABASE_URL', () => {
    expect(getDatabaseMode(env({ DATABASE_URL: 'postgres://example' }))).toBe('postgres');
    expect(getDatabaseMode(env({}))).toBe('sqlite');
  });

  it('requires managed Postgres in production-like environments', () => {
    expect(requiresManagedPostgres(env({ NODE_ENV: 'production' }))).toBe(true);
    expect(requiresManagedPostgres(env({ VERCEL: '1' }))).toBe(true);
    expect(requiresManagedPostgres(env({ VERCEL_ENV: 'preview' }))).toBe(true);
    expect(requiresManagedPostgres(env({ NODE_ENV: 'test' }))).toBe(false);
  });

  it('refuses SQLite in hosted runtimes or when Postgres is configured', () => {
    expect(() => assertSqliteSafeForRuntime(env({ NODE_ENV: 'production' }))).toThrow(
      /DATABASE_URL is required/,
    );
    expect(() =>
      assertSqliteSafeForRuntime(env({ DATABASE_URL: 'postgres://example' })),
    ).toThrow(/SQLite-only/);
    expect(() => assertSqliteSafeForRuntime(env({ NODE_ENV: 'test' }))).not.toThrow();
  });

  it('preserves tenant context across an auth await boundary', async () => {
    const companyId = '56dc0e3d-2de0-4782-ac78-8f9b270ce776';

    async function resolvePortalUserLikeAuth() {
      prepareSqlRuntimeContext();
      await Promise.resolve();
      enterTenantContext(companyId);
      return { companyId };
    }

    async function routeHandlerLikeCaller() {
      const user = await resolvePortalUserLikeAuth();
      return {
        userCompanyId: user.companyId,
        contextCompanyId: getSqlRuntimeContext()?.companyId,
      };
    }

    await withSuperAdminContext(async () => {
      await expect(routeHandlerLikeCaller()).resolves.toEqual({
        userCompanyId: companyId,
        contextCompanyId: companyId,
      });
    });
  });
});
