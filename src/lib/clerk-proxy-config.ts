const productionHosts = new Set([
  'wnyautomation.com',
  'app.wnyautomation.com',
  'admin.wnyautomation.com',
  'awp.wnyautomation.com',
]);

const productionClerkFrontendApiHosts = new Set(['clerk.wnyautomation.com']);

function clean(value: string | undefined) {
  return (value || '').trim();
}

export function getClerkProxyUrl() {
  const explicitProxyUrl = clean(process.env.NEXT_PUBLIC_CLERK_PROXY_URL) || clean(process.env.CLERK_PROXY_URL);
  if (explicitProxyUrl) return assertAllowedClerkProxyUrl('NEXT_PUBLIC_CLERK_PROXY_URL', explicitProxyUrl);

  if (process.env.APP_ENV === 'staging') {
    assertStagingClerkPublishableKey();
    const appBaseUrl = clean(process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL);
    if (!appBaseUrl) {
      throw new Error('NEXT_PUBLIC_APP_BASE_URL is required for the staging Clerk proxy.');
    }
    return `${assertStagingSafeUrl('NEXT_PUBLIC_APP_BASE_URL', appBaseUrl)}/clerk-proxy`;
  }

  return undefined;
}

export function getClerkProxyVerificationUrl() {
  const verificationUrl = clean(process.env.CLERK_PROXY_VERIFICATION_URL);
  if (process.env.APP_ENV === 'staging' && verificationUrl) {
    assertStagingClerkPublishableKey();
    return assertStagingSafeUrl('CLERK_PROXY_VERIFICATION_URL', verificationUrl);
  }
  const resolvedUrl = verificationUrl || getClerkProxyUrl();
  return resolvedUrl?.replace(/\/$/, '');
}

function assertAllowedClerkProxyUrl(name: string, value: string) {
  const normalizedValue = value.replace(/\/$/, '');
  if (process.env.APP_ENV !== 'staging') return normalizedValue;
  assertStagingClerkPublishableKey();
  return assertStagingSafeUrl(name, normalizedValue);
}

function assertStagingSafeUrl(name: string, value: string) {
  const normalizedValue = value.replace(/\/$/, '');
  const url = new URL(normalizedValue);
  if (productionHosts.has(url.hostname)) {
    throw new Error(`${name} must not point at production when APP_ENV=staging.`);
  }
  return url.toString().replace(/\/$/, '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return globalThis.atob(padded);
}

export function getClerkPublishableKeyFrontendApi(value = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  const key = clean(value);
  const match = key.match(/^pk_(?:test|live)_(.+)$/);
  if (!match) return '';

  try {
    return decodeBase64Url(match[1]).replace(/\$$/, '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function normalizedHost(value: string | undefined) {
  const trimmed = clean(value).toLowerCase();
  if (!trimmed) return '';
  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/\/.*$/, '');
  }
}

export function assertStagingClerkPublishableKey() {
  if (process.env.APP_ENV !== 'staging') return;

  const frontendApiHost = normalizedHost(getClerkPublishableKeyFrontendApi());
  if (!frontendApiHost) {
    throw new Error('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a valid Clerk publishable key when APP_ENV=staging.');
  }

  if (productionClerkFrontendApiHosts.has(frontendApiHost)) {
    throw new Error(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY points at the production Clerk host; use the dedicated staging Clerk app when APP_ENV=staging.',
    );
  }

  const expectedHost = normalizedHost(process.env.CLERK_EXPECTED_FAPI_HOST);
  if (expectedHost && frontendApiHost !== expectedHost) {
    throw new Error(
      `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY points at ${frontendApiHost}; expected staging Clerk host ${expectedHost}.`,
    );
  }
}

export function isClerkSatellite() {
  return process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === 'true' || process.env.APP_ENV === 'staging';
}

function getClerkSatelliteDomain() {
  if (!isClerkSatellite()) return '';

  const configuredDomain = clean(process.env.NEXT_PUBLIC_CLERK_DOMAIN || process.env.CLERK_DOMAIN);
  if (configuredDomain) return normalizedHost(configuredDomain);

  const appBaseUrl = clean(process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL);
  return normalizedHost(appBaseUrl);
}

function getGatewayAuthBaseUrl() {
  const configuredGatewayUrl = clean(process.env.NEXT_PUBLIC_PORTAL_GATEWAY_URL) || clean(process.env.PORTAL_GATEWAY_URL);
  if (process.env.APP_ENV === 'staging') {
    if (!configuredGatewayUrl) {
      throw new Error('PORTAL_GATEWAY_URL is required when APP_ENV=staging.');
    }
    return assertStagingSafeUrl('PORTAL_GATEWAY_URL', configuredGatewayUrl);
  }
  return configuredGatewayUrl || 'https://app.wnyautomation.com';
}

export function getClerkSignInUrl() {
  if (!isClerkSatellite()) return '/sign-in';
  return `${getGatewayAuthBaseUrl()}/sign-in?redirect_url=/launch`;
}

export function getClerkSignUpUrl() {
  if (!isClerkSatellite()) return '/sign-up';
  return `${getGatewayAuthBaseUrl()}/sign-up?redirect_url=/launch`;
}

export function getClerkRuntimeProps() {
  const proxyUrl = getClerkProxyUrl();
  const domain = getClerkSatelliteDomain();
  return {
    ...(proxyUrl ? { proxyUrl } : {}),
    ...(isClerkSatellite() ? { isSatellite: true, ...(domain ? { domain } : {}) } : {}),
  };
}
