import { getClerkProxyUrl, getClerkProxyVerificationUrl } from '@/lib/clerk-proxy-config';

const CLERK_FAPI_ORIGIN = 'https://frontend-api.clerk.dev';
const CLERK_PROXY_PATH = '/clerk-proxy';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const RESPONSE_HEADERS_TO_STRIP = new Set(['content-encoding', 'content-length']);

export const dynamic = 'force-dynamic';

function getClientIp(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  );
}

function copyRequestHeaders(request: Request, targetHost: string) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const requestUrl = new URL(request.url);
  headers.set('Host', targetHost);
  headers.set('Accept-Encoding', 'identity');
  headers.set('Clerk-Proxy-Url', getClerkProxyVerificationUrl());
  headers.set('Clerk-Secret-Key', process.env.CLERK_SECRET_KEY || '');
  headers.set('X-Forwarded-Host', requestUrl.host);
  headers.set('X-Forwarded-Proto', requestUrl.protocol.replace(':', ''));

  const clientIp = getClientIp(request);
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  return headers;
}

function copyResponseHeaders(response: Response) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !RESPONSE_HEADERS_TO_STRIP.has(lowerKey)) {
      headers.append(key, value);
    }
  });

  const location = response.headers.get('location');
  if (location) {
    const fapiHost = new URL(CLERK_FAPI_ORIGIN).host;
    const locationUrl = new URL(location, CLERK_FAPI_ORIGIN);
    if (locationUrl.host === fapiHost) {
      headers.set('Location', `${getClerkProxyUrl()}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`);
    }
  }

  return headers;
}

async function proxyClerkRequest(request: Request) {
  if (!process.env.CLERK_SECRET_KEY) {
    return Response.json({ error: 'Missing CLERK_SECRET_KEY' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const targetPath = requestUrl.pathname.slice(CLERK_PROXY_PATH.length) || '/';
  const targetUrl = new URL(`${CLERK_FAPI_ORIGIN}${targetPath}`);
  targetUrl.search = requestUrl.search;

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: copyRequestHeaders(request, targetUrl.host),
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  };
  if (hasBody) init.duplex = 'half';

  const response = await fetch(targetUrl.toString(), init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: copyResponseHeaders(response),
  });
}

export const GET = proxyClerkRequest;
export const POST = proxyClerkRequest;
export const PUT = proxyClerkRequest;
export const PATCH = proxyClerkRequest;
export const DELETE = proxyClerkRequest;
