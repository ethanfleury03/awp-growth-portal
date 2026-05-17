import { NextResponse } from 'next/server';
import {
  GATEWAY_FALLBACK_COOKIE,
  verifyGatewayFallbackToken,
} from '@/lib/auth/gateway-fallback';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const session = verifyGatewayFallbackToken(token);
  if (!session) return NextResponse.redirect(new URL('/account-unassigned', request.url), 303);

  const response = NextResponse.redirect(new URL(safeNextPath(url.searchParams.get('next')), request.url), 303);
  response.cookies.set({
    name: GATEWAY_FALLBACK_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
