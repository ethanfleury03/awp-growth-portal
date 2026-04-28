import { sql } from '@/lib/db';

/**
 * Simple per-tenant feature-flag reader. Values are cached for 30 seconds in
 * the server process. Defaults to `defaultValue` if the flag row is missing.
 */

type CacheKey = `${string}:${string}`;
type CacheEntry = { enabled: boolean; expires: number };

const cache = new Map<CacheKey, CacheEntry>();
const TTL_MS = 30_000;

export async function isFeatureEnabled(
  companyId: string,
  flagKey: string,
  defaultValue = false,
): Promise<boolean> {
  const key: CacheKey = `${companyId}:${flagKey}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.enabled;

  let rows: Record<string, unknown>[] = [];
  try {
    rows = await sql`
      SELECT enabled FROM feature_flags
      WHERE company_id = ${companyId} AND flag_key = ${flagKey}
      LIMIT 1
    `;
  } catch {
    rows = [];
  }
  const row = rows[0] as { enabled?: number | boolean } | undefined;
  const enabled = row ? Boolean(row.enabled) : defaultValue;
  cache.set(key, { enabled, expires: now + TTL_MS });
  return enabled;
}

/** Called by super-admin UI to nuke the cache after a flag flip. */
export function clearFeatureFlagCache(companyId?: string) {
  if (!companyId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${companyId}:`)) cache.delete(key);
  }
}
