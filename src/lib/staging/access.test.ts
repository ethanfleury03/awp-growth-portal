import { describe, expect, it } from 'vitest';
import { canAccessStaging } from '@/lib/staging/access';
import {
  getConfiguredStagingPortalUrl,
  getStagingHealthUrl,
  isProductionEnvironment,
  isStagingEnvironment,
} from '@/lib/staging/config';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('staging environment helpers', () => {
  it('detects staging only from the app environment', () => {
    expect(isStagingEnvironment(env({ APP_ENV: 'staging' }))).toBe(true);
    expect(isStagingEnvironment(env({ VERCEL_ENV: 'preview' }))).toBe(false);
    expect(isStagingEnvironment(env({ APP_ENV: 'production' }))).toBe(false);
  });

  it('treats Vercel production as production even if APP_ENV is mis-set', () => {
    expect(isProductionEnvironment(env({ APP_ENV: 'staging', VERCEL_ENV: 'production' }))).toBe(true);
    expect(isProductionEnvironment(env({ APP_ENV: 'prod' }))).toBe(true);
    expect(isProductionEnvironment(env({ APP_ENV: 'main' }))).toBe(true);
    expect(isProductionEnvironment(env({ APP_ENV: 'staging', VERCEL_ENV: 'preview' }))).toBe(false);
  });

  it('allows active portal roles inside staging', () => {
    expect(canAccessStaging('super_admin', env({ APP_ENV: 'staging' }))).toBe(true);
    expect(canAccessStaging('admin', env({ APP_ENV: 'staging' }))).toBe(true);
    expect(canAccessStaging('viewer', env({ APP_ENV: 'staging' }))).toBe(true);
    expect(canAccessStaging(null, env({ APP_ENV: 'staging' }))).toBe(false);
    expect(canAccessStaging('admin', env({ APP_ENV: 'production' }))).toBe(true);
  });

  it('builds staging URLs from configured environment values', () => {
    const stagingEnv = env({ STAGING_PORTAL_URL: 'staging-awp.example.com' });
    expect(getConfiguredStagingPortalUrl(stagingEnv)).toBe('https://staging-awp.example.com');
    expect(getStagingHealthUrl(stagingEnv)).toBe('https://staging-awp.example.com/api/health');
    expect(
      getStagingHealthUrl(
        env({
          STAGING_PORTAL_URL: 'https://staging-awp.example.com',
          STAGING_HEALTH_URL: 'https://status.example.com/health',
        }),
      ),
    ).toBe('https://status.example.com/health');
  });
});
