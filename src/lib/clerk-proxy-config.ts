const productionHosts = new Set([
  'wnyautomation.com',
  'app.wnyautomation.com',
  'admin.wnyautomation.com',
  'awp.wnyautomation.com',
]);

const sharedClerkProxyUrl = 'https://wnyautomation.com/clerk-proxy';

export function getClerkProxyUrl() {
  if (process.env.APP_ENV === 'staging') return sharedClerkProxyUrl;

  const explicitProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim() || process.env.CLERK_PROXY_URL?.trim();
  if (explicitProxyUrl) return assertAllowedClerkProxyUrl('NEXT_PUBLIC_CLERK_PROXY_URL', explicitProxyUrl);

  return sharedClerkProxyUrl;
}

export function getClerkProxyVerificationUrl() {
  if (process.env.APP_ENV === 'staging') return sharedClerkProxyUrl;

  return (process.env.CLERK_PROXY_VERIFICATION_URL?.trim() || getClerkProxyUrl()).replace(/\/$/, '');
}

function assertAllowedClerkProxyUrl(name: string, value: string) {
  const normalizedValue = value.replace(/\/$/, '');
  if (process.env.APP_ENV !== 'staging') return normalizedValue;

  const url = new URL(normalizedValue);
  const isSharedProductionClerkProxy = url.hostname === 'wnyautomation.com' && url.pathname === '/clerk-proxy';
  if (productionHosts.has(url.hostname) && !isSharedProductionClerkProxy) {
    throw new Error(`${name} must not point at production when APP_ENV=staging.`);
  }
  return url.toString().replace(/\/$/, '');
}
