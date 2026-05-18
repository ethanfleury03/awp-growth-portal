import { NextResponse } from 'next/server';
import { GATEWAY_FALLBACK_COOKIE } from '@/lib/auth/gateway-fallback';
import { SESSION_COOKIE } from '@/lib/auth/constants';
import { getGatewayLoginUrl, getGatewayLogoutUrl } from '@/lib/auth/gateway-login';

export async function POST(request: Request) {
  const fallbackCookie = request.headers.get('cookie')?.includes(`${GATEWAY_FALLBACK_COOKIE}=`) ?? false;
  const mode = process.env.APP_ENV === 'staging' && fallbackCookie ? 'gateway-fallback' : 'clerk';
  const response = NextResponse.json({
    ok: true,
    mode,
    redirectUrl: mode === 'gateway-fallback' ? getGatewayLogoutUrl() : getGatewayLoginUrl(),
  });

  for (const name of [GATEWAY_FALLBACK_COOKIE, SESSION_COOKIE]) {
    response.cookies.set({
      name,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
