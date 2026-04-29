import { describe, expect, it } from 'vitest';
import { configuredChecks, missingConfiguredChecks } from '@/lib/health/checks';

describe('health checks', () => {
  it('reports configured service categories without exposing secrets', () => {
    const checks = configuredChecks({
      CLERK_SECRET_KEY: 'sk',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk',
      STRIPE_SECRET_KEY: 'stripe',
      STRIPE_WEBHOOK_SECRET: 'wh',
      TWILIO_ACCOUNT_SID: 'sid',
      TWILIO_AUTH_TOKEN: 'token',
      RETELL_API_KEY: 'retell',
      R2_ACCOUNT_ID: 'r2',
      R2_ACCESS_KEY_ID: 'r2key',
      R2_SECRET_ACCESS_KEY: 'r2secret',
      R2_BUCKET: 'bucket',
      SENTRY_DSN: 'dsn',
    } as unknown as NodeJS.ProcessEnv);

    expect(checks).toEqual({
      clerk: true,
      stripe: true,
      twilio: true,
      retell: true,
      r2: true,
      sentry: true,
    });
  });

  it('lists missing optional/required categories', () => {
    expect(missingConfiguredChecks({ CLERK_SECRET_KEY: 'sk' } as unknown as NodeJS.ProcessEnv)).toContain('clerk');
  });
});
