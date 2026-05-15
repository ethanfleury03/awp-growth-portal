import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAdminPortalUrl } from '@/lib/auth/admin-redirect';
import { getClerkProxyUrl } from '@/lib/clerk-proxy-config';
import { getGatewayLoginUrl } from '@/lib/auth/gateway-login';
import { PORTAL_APP_PATH, shouldRouteRootToPortalApp } from '@/lib/auth/portal-entry-host';

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
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
  '/apple-icon',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/twitter-image',
]);

export default clerkMiddleware(
  async (auth, req) => {
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
  {
    proxyUrl: getClerkProxyUrl(),
  },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
