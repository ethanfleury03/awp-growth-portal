const productionHosts = new Set([
  'wnyautomation.com',
  'app.wnyautomation.com',
  'admin.wnyautomation.com',
  'awp.wnyautomation.com',
]);

export function getClerkProxyUrl() {
  const explicitProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim() || process.env.CLERK_PROXY_URL?.trim();
  if (explicitProxyUrl) return assertStagingSafeUrl('NEXT_PUBLIC_CLERK_PROXY_URL', explicitProxyUrl);

  if (process.env.APP_ENV === 'staging') {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim();
    if (!appBaseUrl) {
      throw new Error('NEXT_PUBLIC_APP_BASE_URL or APP_BASE_URL is required for the staging Clerk proxy.');
    }
    return `${assertStagingSafeUrl('NEXT_PUBLIC_APP_BASE_URL', appBaseUrl).replace(/\/$/, '')}/clerk-proxy`;
  }

  return 'https://wnyautomation.com/clerk-proxy';
}

export function getClerkProxyVerificationUrl() {
  return (process.env.CLERK_PROXY_VERIFICATION_URL?.trim() || getClerkProxyUrl()).replace(/\/$/, '');
}

function assertStagingSafeUrl(name: string, value: string) {
  if (process.env.APP_ENV !== 'staging') return value.replace(/\/$/, '');

  const url = new URL(value);
  if (productionHosts.has(url.hostname)) {
    throw new Error(`${name} must not point at production when APP_ENV=staging.`);
  }
  return url.toString().replace(/\/$/, '');
}
