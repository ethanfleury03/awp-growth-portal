const DEFAULT_ADMIN_PORTAL_URL = 'https://admin.wnyautomation.com';

export function getAdminPortalUrl(env: NodeJS.ProcessEnv = process.env) {
  return (env.NEXT_PUBLIC_ADMIN_PORTAL_URL || env.ADMIN_PORTAL_URL || DEFAULT_ADMIN_PORTAL_URL)
    .trim()
    .replace(/\/+$/, '');
}

export function getAdminPortalHost(env: NodeJS.ProcessEnv = process.env) {
  return new URL(getAdminPortalUrl(env)).hostname;
}

export function isAdminPortalHost(hostname: string, env: NodeJS.ProcessEnv = process.env) {
  return hostname.toLowerCase() === getAdminPortalHost(env).toLowerCase();
}

export function getAdminPortalHref(path = '', env: NodeJS.ProcessEnv = process.env) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getAdminPortalUrl(env)}${normalizedPath === '/' ? '' : normalizedPath}`;
}
