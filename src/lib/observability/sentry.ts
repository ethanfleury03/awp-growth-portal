import * as Sentry from '@sentry/nextjs';

type Scope = {
  setTag: (key: string, value: string) => void;
  setUser: (user: { id?: string; email?: string } | null) => void;
  setContext: (name: string, ctx: Record<string, unknown>) => void;
};

interface SentryAPI {
  captureException: (error: unknown, scope?: (s: Scope) => void) => void;
  captureMessage: (message: string, scope?: (s: Scope) => void) => void;
  setTenantContext: (opts: { companyId?: string | null; userId?: string | null }) => void;
}

const enabled = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

export const sentry: SentryAPI = {
  captureException(error, cb) {
    if (!enabled) {
      console.error('[sentry-disabled]', error);
      return;
    }
    Sentry.withScope((scope) => {
      cb?.(scope as unknown as Scope);
      Sentry.captureException(error);
    });
  },
  captureMessage(message, cb) {
    if (!enabled) return;
    Sentry.withScope((scope) => {
      cb?.(scope as unknown as Scope);
      Sentry.captureMessage(message);
    });
  },
  setTenantContext({ companyId, userId }) {
    if (!enabled) return;
    if (companyId) Sentry.setTag('company_id', companyId);
    Sentry.setUser(userId ? { id: userId } : null);
  },
};
