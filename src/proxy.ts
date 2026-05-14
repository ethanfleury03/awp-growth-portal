import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAdminPortalHref, isAdminPortalHost } from '@/lib/auth/admin-portal';
import { PORTAL_APP_PATH, shouldRouteRootToPortalApp } from '@/lib/auth/portal-entry-host';

const clerkProxyUrl =
  process.env.NEXT_PUBLIC_CLERK_PROXY_URL || 'https://wnyautomation.com/clerk-proxy';

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
  '/estimate/(.*)',
  '/pay/(.*)',
  '/portal/(.*)',
  '/api/public/(.*)',
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

function adminHostAllowsPath(pathname: string) {
  return (
    pathname === '/super-admin' ||
    pathname.startsWith('/super-admin/') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/account-unassigned') ||
    pathname.startsWith('/module-disabled') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname === '/apple-icon' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/robots.txt' ||
    pathname === '/opengraph-image' ||
    pathname === '/twitter-image'
  );
}

export default clerkMiddleware(
  async (auth, req) => {
    const isAdminHost = isAdminPortalHost(req.nextUrl.hostname);
    if (isAdminHost && !adminHostAllowsPath(req.nextUrl.pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = '/super-admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (!isAdminHost && req.nextUrl.pathname.startsWith('/super-admin')) {
      return NextResponse.redirect(getAdminPortalHref(req.nextUrl.pathname + req.nextUrl.search));
    }

    if (shouldRouteRootToPortalApp(req.nextUrl.pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = PORTAL_APP_PATH;
      return NextResponse.redirect(url);
    }

    if (isPublicRoute(req)) {
      return NextResponse.next();
    }
    const { userId } = await auth();
    if (!userId) {
      const url = req.nextUrl.clone();
      if (url.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      url.pathname = '/sign-in';
      const returnPath = req.nextUrl.pathname + (req.nextUrl.search || '');
      url.searchParams.set('redirect_url', returnPath);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    proxyUrl: clerkProxyUrl,
  },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
