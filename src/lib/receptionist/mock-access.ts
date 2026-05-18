import { NextResponse } from 'next/server';
import { isProductionEnvironment } from '@/lib/staging/config';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);
const NON_PROD_APP_ENVS = new Set(['development', 'dev', 'test', 'staging', 'preview']);
const NON_PROD_VERCEL_ENVS = new Set(['development', 'preview']);

function cleanFlag(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

export function isReceptionistMockAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionEnvironment(env)) return false;
  const explicit = cleanFlag(env.RECEPTIONIST_MOCK_CALLS_ENABLED);
  if (explicit && FALSE_VALUES.has(explicit)) return false;
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
): NextResponse | null {
  if (isReceptionistMockAllowed(env)) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
