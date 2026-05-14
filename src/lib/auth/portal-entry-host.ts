export const PORTAL_APP_PATH = '/app';

const PORTAL_APP_ENTRY_HOSTS = new Set(['awp.wnyautomation.com', 'staging.awp.wnyautomation.com']);

export function normalizeRequestHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0]?.trim().toLowerCase() ?? '';
}

export function shouldRouteRootToPortalApp(host: string | null | undefined, pathname: string): boolean {
  return pathname === '/' && PORTAL_APP_ENTRY_HOSTS.has(normalizeRequestHost(host));
}
