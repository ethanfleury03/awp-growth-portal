/** Default post-auth destination for dashboard users. */
export const DEFAULT_POST_AUTH_PATH = '/app';

/**
 * Resolves a safe in-app redirect from URL search params.
 * Prefers `redirect_url`, then `next` (legacy), then default.
 * Rejects open redirects and non-path values.
 */
export function getSafeRedirectPath(sp: URLSearchParams): string {
  const raw = sp.get('redirect_url') ?? sp.get('next') ?? '';
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
  if (lower.includes('javascript:')) return DEFAULT_POST_AUTH_PATH;
  if (lower.includes('<')) return DEFAULT_POST_AUTH_PATH;
  if (lower.includes('\0')) return DEFAULT_POST_AUTH_PATH;

  return decoded || DEFAULT_POST_AUTH_PATH;
}
