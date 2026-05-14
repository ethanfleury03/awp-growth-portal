export const PORTAL_APP_PATH = '/app';

export function shouldRouteRootToPortalApp(pathname: string): boolean {
  return pathname === '/';
}
