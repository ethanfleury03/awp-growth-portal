const DEFAULT_GATEWAY_URL = 'https://app.wnyautomation.com';
const PRODUCTION_PORTAL_HOSTS = new Set([
  'app.wnyautomation.com',
  'admin.wnyautomation.com',
  'awp.wnyautomation.com',
]);

function cleanGatewayUrl(value: string | undefined) {
  return (value || '').trim().replace(/\/+$/, '');
}

function requireStagingGatewayUrl(value: string): string {
  if (!value) {
    throw new Error('PORTAL_GATEWAY_URL is required when APP_ENV=staging.');
  }
  const url = new URL(value);
  if (PRODUCTION_PORTAL_HOSTS.has(url.hostname)) {
    throw new Error('PORTAL_GATEWAY_URL must not point at production when APP_ENV=staging.');
  }
  return url.toString().replace(/\/$/, '');
}

export function getGatewayLoginUrl() {
  return `${getGatewayBaseUrl()}/sign-in?redirect_url=/launch`;
}

export function getGatewayLogoutUrl() {
  return `${getGatewayBaseUrl()}/api/staging-logout`;
}

function getGatewayBaseUrl() {
  const configuredGatewayUrl =
    cleanGatewayUrl(process.env.NEXT_PUBLIC_PORTAL_GATEWAY_URL) ||
    cleanGatewayUrl(process.env.PORTAL_GATEWAY_URL);
  return (
    process.env.APP_ENV === 'staging'
      ? requireStagingGatewayUrl(configuredGatewayUrl)
      : configuredGatewayUrl || DEFAULT_GATEWAY_URL
  );
}
