const DEFAULT_GATEWAY_URL = 'https://app.wnyautomation.com';

function cleanGatewayUrl(value: string | undefined) {
  return (value || '').trim().replace(/\/+$/, '');
}

export function getGatewayLoginUrl() {
  const gatewayUrl =
    cleanGatewayUrl(process.env.NEXT_PUBLIC_PORTAL_GATEWAY_URL) ||
    cleanGatewayUrl(process.env.PORTAL_GATEWAY_URL) ||
    DEFAULT_GATEWAY_URL;
  return `${gatewayUrl}/sign-in?redirect_url=/launch`;
}
