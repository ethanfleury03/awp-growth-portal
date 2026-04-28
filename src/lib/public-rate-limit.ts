/**
 * In-memory sliding-window rate limiter for unauthenticated public routes.
 * Resets on server restart; sufficient for modest abuse protection.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

function pruneBucket(hits: number[], now: number, windowMs: number): number[] {
  return hits.filter((t) => now - t < windowMs);
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function consumePublicRateLimit(
  key: string,
  maxInWindow: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const b = buckets.get(key);
  const prev = b?.hits ?? [];
  const hits = pruneBucket(prev, now, windowMs);
  if (hits.length >= maxInWindow) {
    const oldest = hits[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  buckets.set(key, { hits });
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) {
      const pruned = pruneBucket(v.hits, now, windowMs);
      if (pruned.length === 0) buckets.delete(k);
      else if (pruned !== v.hits) buckets.set(k, { hits: pruned });
    }
  }
  return { ok: true };
}

export function publicActionKey(request: Request, token: string, action: string): string {
  const xf = request.headers.get('x-forwarded-for');
  const raw = (xf?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown').trim();
  const ip = raw || 'unknown';
  return `${action}:${token}:${ip}`;
}

export function publicRateLimitConfig(): { max: number; windowMs: number } {
  const max = Math.max(
    5,
    parseInt(
      process.env.PUBLIC_ACTION_RATE_LIMIT_MAX ||
        process.env.PUBLIC_ESTIMATE_RATE_LIMIT_MAX ||
        '40',
      10,
    ),
  );
  const windowSec = Math.max(
    10,
    parseInt(
      process.env.PUBLIC_ACTION_RATE_LIMIT_WINDOW_SEC ||
        process.env.PUBLIC_ESTIMATE_RATE_LIMIT_WINDOW_SEC ||
        '60',
      10,
    ),
  );
  return { max, windowMs: windowSec * 1000 };
}
