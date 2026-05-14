export const PORTAL_APP_PATH = '/app';

export function shouldRouteRootToPortalApp(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return (
    normalized === '/' ||
    normalized === '/about' ||
    normalized === '/contact' ||
    normalized === '/features' ||
    normalized === '/industries' ||
    normalized === '/pricing' ||
    normalized === '/website-growth'
  );
}
