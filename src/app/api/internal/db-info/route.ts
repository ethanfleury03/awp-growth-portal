import { NextResponse } from 'next/server';
import { getDatabaseInfo } from '@/lib/health/db-info';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

function configuredToken() {
  return (process.env.WNY_INTERNAL_STATUS_TOKEN || process.env.PORTAL_GATEWAY_SERVICE_TOKEN || '').trim();
}

export async function GET(request: Request) {
  const token = bearerToken(request) || request.headers.get('x-gateway-service-token') || '';
  const expected = configuredToken();
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, database: await getDatabaseInfo() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read database info.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
