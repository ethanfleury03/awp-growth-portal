const DEFAULT_ADMIN_PORTAL_URL = 'https://admin.wnyautomation.com';
const DEFAULT_ADMIN_EMAILS = ['ethan@wnyautomation.com'];
const PRODUCTION_PORTAL_HOSTS = new Set([
  'app.wnyautomation.com',
  'admin.wnyautomation.com',
  'awp.wnyautomation.com',
]);

function normalizedAdminBaseUrl(): string {
  const configured =
    process.env.ADMIN_PORTAL_URL ||
    process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL ||
    '';

  if (process.env.APP_ENV === 'staging') {
    if (!configured) {
      throw new Error('NEXT_PUBLIC_ADMIN_PORTAL_URL is required when APP_ENV=staging.');
    }
    const url = new URL(configured);
    if (PRODUCTION_PORTAL_HOSTS.has(url.hostname)) {
      throw new Error('NEXT_PUBLIC_ADMIN_PORTAL_URL must not point at production when APP_ENV=staging.');
    }
    return url.toString().replace(/\/$/, '');
  }

  return (configured || DEFAULT_ADMIN_PORTAL_URL).replace(/\/+$/, '');
}

export function getAdminPortalUrl(path = '/admin'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedAdminBaseUrl()}${normalizedPath}`;
}

export function configuredAdminEmails(): Set<string> {
  return new Set(
    [
      ...DEFAULT_ADMIN_EMAILS,
      ...(process.env.ADMIN_EMAILS || process.env.PORTAL_ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ],
  );
}

export function isConfiguredAdminEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && configuredAdminEmails().has(normalized));
}
