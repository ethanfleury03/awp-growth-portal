export type HealthChecks = {
  database: boolean;
  migrations: boolean;
  clerk: boolean;
  stripe: boolean;
  twilio: boolean;
  retell: boolean;
  r2: boolean;
  sentry: boolean;
};

export function configuredChecks(env: NodeJS.ProcessEnv = process.env): Omit<HealthChecks, 'database' | 'migrations'> {
  return {
    clerk: Boolean(env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    twilio: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
    retell: Boolean(env.RETELL_API_KEY),
    r2: Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET),
    sentry: Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN),
  };
}

export function missingConfiguredChecks(env: NodeJS.ProcessEnv = process.env): string[] {
  const checks = configuredChecks(env);
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
}
