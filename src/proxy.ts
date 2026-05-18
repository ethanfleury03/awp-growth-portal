import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminPortalUrl } from '@/lib/auth/admin-redirect';
import { getClerkProxyUrl } from '@/lib/clerk-proxy-config';
import { getGatewayLoginUrl } from '@/lib/auth/gateway-login';
import { PORTAL_APP_PATH, shouldRouteRootToPortalApp } from '@/lib/auth/portal-entry-host';

const GATEWAY_FALLBACK_COOKIE = 'awp_gateway_fallback';
const clerkProxyUrl = getClerkProxyUrl();
const clerkMiddlewareOptions = clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : undefined;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/gateway-fallback',
  '/account-unassigned(.*)',
  '/module-disabled(.*)',
  '/about(.*)',
  '/contact(.*)',
  '/features(.*)',
  '/industries(.*)',
  '/pricing(.*)',
  '/legal(.*)',
  '/clerk-proxy(.*)',
  '/estimate/(.*)',
  '/pay/(.*)',
  '/portal/(.*)',
  '/api/public/(.*)',
  '/api/internal/(.*)',
  '/api/marketing/(.*)',
  '/api/stripe/webhook',
  '/api/webhooks/(.*)',
  '/api/receptionist/providers/(.*)',
  '/api/receptionist/webhooks/(.*)',
  '/api/geocode',
  '/api/health',
  '/_next/(.*)',
  '/favicon.ico',
  '/icon.svg',
  '/icon',
  '/apple-icon',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/twitter-image',
]);

function requestHost(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return (forwardedHost?.split(',')[0]?.trim().split(':')[0] || req.nextUrl.hostname).toLowerCase();
}

function isKnownNonProductionHost(host: string) {
  return LOCAL_HOSTS.has(host) || host.startsWith('staging.') || host.includes('.staging.');
}

function shouldBlockProductionMockRoute(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (
    !pathname.startsWith('/api/receptionist/mock/') &&
    pathname !== '/api/receptionist/scenarios'
  ) {
    return false;
  }
  return !isKnownNonProductionHost(requestHost(req));
}

export default clerkMiddleware(
  async (auth, req) => {
    if (shouldBlockProductionMockRoute(req)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (
      req.nextUrl.pathname === '/admin' ||
      req.nextUrl.pathname.startsWith('/admin/') ||
      req.nextUrl.pathname === '/super-admin' ||
      req.nextUrl.pathname.startsWith('/super-admin/')
    ) {
      return NextResponse.redirect(getAdminPortalUrl('/admin'));
    }

    if (shouldRouteRootToPortalApp(req.nextUrl.pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = PORTAL_APP_PATH;
      return NextResponse.redirect(url);
    }

    if (isPublicRoute(req)) {
      if (req.nextUrl.pathname === '/sign-in' || req.nextUrl.pathname.startsWith('/sign-in/')) {
        return NextResponse.redirect(getGatewayLoginUrl(), 307);
      }
      if (req.nextUrl.pathname === '/sign-up' || req.nextUrl.pathname.startsWith('/sign-up/')) {
        return NextResponse.redirect(getGatewayLoginUrl(), 307);
      }
      return NextResponse.next();
    }

    if (req.cookies.has(GATEWAY_FALLBACK_COOKIE)) {
      return NextResponse.next();
    }

    const { userId } = await auth();
    if (!userId) {
      const url = req.nextUrl.clone();
      if (url.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(getGatewayLoginUrl(), 307);
    }
    return NextResponse.next();
  },
  clerkMiddlewareOptions,
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
