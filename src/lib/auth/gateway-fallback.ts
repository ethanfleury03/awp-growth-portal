import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const GATEWAY_FALLBACK_COOKIE = 'awp_gateway_fallback';

export type GatewayFallbackSession = {
  email: string;
  gatewayUserId?: string;
  name?: string;
  role?: string;
  destinationKey?: string;
  exp: number;
};

function fallbackSecret() {
  return (process.env.PORTAL_GATEWAY_FALLBACK_SECRET || '').trim();
}

export function isGatewayFallbackEnabled() {
  return Boolean(fallbackSecret());
}

function sign(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function verifyGatewayFallbackToken(token: string | undefined): GatewayFallbackSession | null {
  const secret = fallbackSecret();
  if (!token || !secret) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as GatewayFallbackSession;
    if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function readGatewayFallbackSession() {
  const cookieStore = await cookies();
  return verifyGatewayFallbackToken(cookieStore.get(GATEWAY_FALLBACK_COOKIE)?.value);
}
