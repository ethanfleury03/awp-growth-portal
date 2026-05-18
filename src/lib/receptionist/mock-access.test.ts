import { describe, expect, it } from 'vitest';
import { isReceptionistMockAllowed } from './mock-access';
import { getTelephonyProviderFromEnv } from './providers';

function env(overrides: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...overrides } as NodeJS.ProcessEnv;
}

describe('receptionist mock access guard', () => {
  it('allows mock call tooling outside production by default', () => {
    expect(isReceptionistMockAllowed(env({ APP_ENV: 'staging' }))).toBe(true);
    expect(isReceptionistMockAllowed(env({ VERCEL_ENV: 'preview' }))).toBe(true);
  });

  it('blocks mock call tooling in production by default', () => {
    expect(isReceptionistMockAllowed(env({ APP_ENV: 'production' }))).toBe(false);
    expect(isReceptionistMockAllowed(env({ VERCEL_ENV: 'production', NODE_ENV: 'production' }))).toBe(false);
    expect(isReceptionistMockAllowed(env({ VERCEL_ENV: 'production', RECEPTIONIST_MOCK_CALLS_ENABLED: '1' }))).toBe(false);
  });

  it('does not default the telephony provider to mock in production', () => {
    expect(getTelephonyProviderFromEnv(env({ APP_ENV: 'production' })).name).toBe('twilio');
    expect(() =>
      getTelephonyProviderFromEnv(env({ APP_ENV: 'production', RECEPTIONIST_PROVIDER: 'mock' })),
    ).toThrow('RECEPTIONIST_PROVIDER=mock is not allowed in production.');
  });
});
