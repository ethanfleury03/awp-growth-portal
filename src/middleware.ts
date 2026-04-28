import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
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
]);

export default clerkMiddleware(async (auth, req) => {
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
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
