/** Default post-auth destination for dashboard users. */
export const DEFAULT_POST_AUTH_PATH = '/app';

export type RedirectSearchParams = Record<string, string | string[] | undefined>;
type SearchParamsLike = Pick<URLSearchParams, 'get'> | RedirectSearchParams;

function hasGetMethod(sp: SearchParamsLike): sp is Pick<URLSearchParams, 'get'> {
  return typeof (sp as Pick<URLSearchParams, 'get'>).get === 'function';
}

function readSearchParam(sp: SearchParamsLike, key: string): string | null {
  if (hasGetMethod(sp)) return sp.get(key);

  const value = sp[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Resolves a safe in-app redirect from URL search params.
 * Prefers `redirect_url`, then `next` (legacy), then default.
 * Rejects open redirects and non-path values.
 */
export function getSafeRedirectPath(sp: SearchParamsLike): string {
  const raw = readSearchParam(sp, 'redirect_url') ?? readSearchParam(sp, 'next') ?? '';
  if (!raw || typeof raw !== 'string') return DEFAULT_POST_AUTH_PATH;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return DEFAULT_POST_AUTH_PATH;
  }

  if (!decoded.startsWith('/')) return DEFAULT_POST_AUTH_PATH;
  if (decoded.startsWith('//')) return DEFAULT_POST_AUTH_PATH;
  if (decoded.includes('@')) return DEFAULT_POST_AUTH_PATH;
  if (decoded.includes('://')) return DEFAULT_POST_AUTH_PATH;
  if (decoded.includes('\\')) return DEFAULT_POST_AUTH_PATH;

  const lower = decoded.toLowerCase();
  if (lower === '/login' || lower.startsWith('/login?')) return DEFAULT_POST_AUTH_PATH;
  if (lower === '/sign-in' || lower.startsWith('/sign-in/') || lower.startsWith('/sign-in?')) {
    return DEFAULT_POST_AUTH_PATH;
  }
  if (lower === '/sign-up' || lower.startsWith('/sign-up/') || lower.startsWith('/sign-up?')) {
    return DEFAULT_POST_AUTH_PATH;
  }
  if (lower.includes('javascript:')) return DEFAULT_POST_AUTH_PATH;
  if (lower.includes('<')) return DEFAULT_POST_AUTH_PATH;
  if (lower.includes('\0')) return DEFAULT_POST_AUTH_PATH;

  return decoded || DEFAULT_POST_AUTH_PATH;
}
