import { describe, expect, it } from 'vitest';
import {
  assertSqliteSafeForRuntime,
  getDatabaseMode,
  requiresManagedPostgres,
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
});
