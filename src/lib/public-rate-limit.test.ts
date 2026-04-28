import { describe, expect, it } from 'vitest';
import { consumePublicRateLimit } from '@/lib/public-rate-limit';

describe('consumePublicRateLimit', () => {
  it('allows under limit and blocks after max', () => {
    const key = 'test:key';
    const now = 1_000_000;
    expect(consumePublicRateLimit(key, 2, 60_000, now + 0).ok).toBe(true);
    expect(consumePublicRateLimit(key, 2, 60_000, now + 1000).ok).toBe(true);
    const third = consumePublicRateLimit(key, 2, 60_000, now + 2000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after window', () => {
    const key = 'test:key2';
    const t0 = 2_000_000;
    expect(consumePublicRateLimit(key, 1, 1000, t0).ok).toBe(true);
    expect(consumePublicRateLimit(key, 1, 1000, t0 + 500).ok).toBe(false);
    expect(consumePublicRateLimit(key, 1, 1000, t0 + 1001).ok).toBe(true);
  });
});
