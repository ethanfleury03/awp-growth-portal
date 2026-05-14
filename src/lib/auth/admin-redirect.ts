const DEFAULT_ADMIN_PORTAL_URL = 'https://admin.wnyautomation.com';
const DEFAULT_ADMIN_EMAILS = ['ethan@wnyautomation.com'];

function normalizedAdminBaseUrl(): string {
  return (
    process.env.ADMIN_PORTAL_URL ||
    process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL ||
    DEFAULT_ADMIN_PORTAL_URL
  ).replace(/\/+$/, '');
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
