import { NextResponse } from 'next/server';
import { isProductionEnvironment } from '@/lib/staging/config';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const NON_PROD_APP_ENVS = new Set(['development', 'dev', 'test', 'staging', 'preview']);
const NON_PROD_VERCEL_ENVS = new Set(['development', 'preview']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function cleanFlag(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function hostFromRequest(request?: Request): string | null {
  if (!request) return null;
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const headerHost = forwardedHost?.split(',')[0]?.trim().split(':')[0]?.toLowerCase();
  if (headerHost) return headerHost;
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isKnownNonProductionHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || host.startsWith('staging.') || host.includes('.staging.');
}

export function isReceptionistMockAllowed(
  env: NodeJS.ProcessEnv = process.env,
  request?: Request,
): boolean {
  const explicit = cleanFlag(env.RECEPTIONIST_MOCK_CALLS_ENABLED);
  if (explicit && FALSE_VALUES.has(explicit)) return false;
  const host = hostFromRequest(request);
  if (host) {
    if (!isKnownNonProductionHost(host)) return false;
    return explicit ? TRUE_VALUES.has(explicit) : true;
  }
  if (isProductionEnvironment(env)) return false;
  if (explicit) return TRUE_VALUES.has(explicit);
  const appEnv = cleanFlag(env.APP_ENV);
  if (appEnv) return NON_PROD_APP_ENVS.has(appEnv);
  const vercelEnv = cleanFlag(env.VERCEL_ENV);
  if (vercelEnv) return NON_PROD_VERCEL_ENVS.has(vercelEnv);
  if (env.VERCEL === '1') return false;
  return cleanFlag(env.NODE_ENV) !== 'production';
}

export function rejectReceptionistMockInProduction(
  env: NodeJS.ProcessEnv = process.env,
  request?: Request,
): NextResponse | null {
  if (isReceptionistMockAllowed(env, request)) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
