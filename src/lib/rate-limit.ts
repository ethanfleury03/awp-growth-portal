/**
 * In-memory rate limiter for authenticated mutation routes. Shares the same
 * sliding-window core as `public-rate-limit`, but keyed by (companyId, userId,
 * action) so a single tenant can't fan out thousands of writes and each user
 * gets their own bucket.
 */

import { NextResponse } from 'next/server';
import { consumePublicRateLimit } from '@/lib/public-rate-limit';
import type { SessionUser } from '@/lib/auth/types';

export interface AuthedRateLimitOpts {
  user: Pick<SessionUser, 'id' | 'companyId'>;
  action: string;
  /** Max requests per window. Default 60. */
  max?: number;
  /** Window size in ms. Default 60s. */
  windowMs?: number;
}

export function consumeAuthedRateLimit(opts: AuthedRateLimitOpts) {
  const max = opts.max ?? 60;
  const windowMs = opts.windowMs ?? 60_000;
  const key = `authed:${opts.action}:${opts.user.companyId}:${opts.user.id}`;
  return consumePublicRateLimit(key, max, windowMs);
}

export function enforceAuthedRateLimit(opts: AuthedRateLimitOpts): NextResponse | null {
  const result = consumeAuthedRateLimit(opts);
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests', retryAfterSec: result.retryAfterSec },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } },
  );
}
