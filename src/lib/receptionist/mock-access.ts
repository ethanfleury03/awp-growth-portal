import { NextResponse } from 'next/server';
import { isProductionEnvironment } from '@/lib/staging/config';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function cleanFlag(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

export function isReceptionistMockAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = cleanFlag(env.RECEPTIONIST_MOCK_CALLS_ENABLED);
  if (explicit) return TRUE_VALUES.has(explicit);
  return !isProductionEnvironment(env);
}

export function rejectReceptionistMockInProduction(
  env: NodeJS.ProcessEnv = process.env,
): NextResponse | null {
  if (isReceptionistMockAllowed(env)) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
