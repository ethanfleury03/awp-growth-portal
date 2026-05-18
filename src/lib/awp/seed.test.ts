import { describe, expect, it } from 'vitest';
import { isAwpDemoSeedEnabled } from './seed';

function env(overrides: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...overrides } as NodeJS.ProcessEnv;
}

describe('AWP demo seed guard', () => {
  it('does not run demo seeding in production by default', () => {
    expect(isAwpDemoSeedEnabled(env({ APP_ENV: 'production' }))).toBe(false);
    expect(isAwpDemoSeedEnabled(env({ APP_ENV: 'prod' }))).toBe(false);
    expect(isAwpDemoSeedEnabled(env({ VERCEL_ENV: 'production', NODE_ENV: 'production' }))).toBe(false);
    expect(isAwpDemoSeedEnabled(env({ APP_ENV: 'staging', VERCEL_ENV: 'production' }))).toBe(false);
  });

  it('allows demo seeding in staging and preview environments', () => {
    expect(isAwpDemoSeedEnabled(env({ APP_ENV: 'staging', NODE_ENV: 'production' }))).toBe(true);
    expect(isAwpDemoSeedEnabled(env({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }))).toBe(true);
  });

  it('can be explicitly controlled outside production', () => {
    expect(isAwpDemoSeedEnabled(env({ AWP_DEMO_SEED_ENABLED: '1', APP_ENV: 'staging' }))).toBe(true);
    expect(isAwpDemoSeedEnabled(env({ AWP_DEMO_SEED_ENABLED: '1', APP_ENV: 'production' }))).toBe(false);
    expect(isAwpDemoSeedEnabled(env({ AWP_DEMO_SEED_ENABLED: '0', APP_ENV: 'staging' }))).toBe(false);
  });
});
