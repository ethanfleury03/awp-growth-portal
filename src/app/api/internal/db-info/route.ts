import { NextResponse } from 'next/server';
import { getDatabaseInfo } from '@/lib/health/db-info';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
}

function authorized(request: Request) {
  const token =
    bearerToken(request) ||
    request.headers.get('x-gateway-service-token') ||
    request.headers.get('x-internal-status-token') ||
    '';
  const allowed = [
    process.env.PORTAL_GATEWAY_SERVICE_TOKEN,
    process.env.WNY_INTERNAL_STATUS_TOKEN,
  ].filter((value): value is string => Boolean(value));

  return allowed.length > 0 && allowed.includes(token);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, database: await getDatabaseInfo() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read database info.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
