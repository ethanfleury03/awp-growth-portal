import { fapiUrlFromPublishableKey } from '@clerk/backend/proxy';
import {
  getClerkProxyVerificationUrl,
  getClerkPublishableKeyFrontendApi,
} from '@/lib/clerk-proxy-config';

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

function copyRequestHeaders(request: Request, clerkProxyUrl: string, targetHost: string) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const requestUrl = new URL(request.url);
  headers.set('Host', targetHost);
  headers.set('Accept-Encoding', 'identity');
  headers.set('Clerk-Proxy-Url', clerkProxyUrl);
  headers.set('Clerk-Secret-Key', process.env.CLERK_SECRET_KEY || '');
  headers.set('X-Forwarded-Host', requestUrl.host);
  headers.set('X-Forwarded-Proto', requestUrl.protocol.replace(':', ''));

  const clientIp = getClientIp(request);
  if (clientIp) headers.set('X-Forwarded-For', clientIp);

  return headers;
}

function getClerkFapiOrigin() {
  const host = getClerkPublishableKeyFrontendApi();
  if (!host) return '';
  return fapiUrlFromPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '');
}

function copyResponseHeaders(response: Response, clerkProxyUrl: string, fapiOrigin: string) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey) && !RESPONSE_HEADERS_TO_STRIP.has(lowerKey)) {
      headers.append(key, value);
    }
  });

  const location = response.headers.get('location');
  if (location) {
    const fapiHost = new URL(fapiOrigin).host;
    const locationUrl = new URL(location, fapiOrigin);
    if (locationUrl.host === fapiHost) {
      headers.set('Location', `${clerkProxyUrl}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`);
    }
  }

  return headers;
}

async function proxyClerkRequest(request: Request) {
  const clerkProxyUrl = getClerkProxyVerificationUrl();
  if (!clerkProxyUrl) {
    return Response.json({ error: 'Clerk proxy is not enabled for this environment.' }, { status: 404 });
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return Response.json({ error: 'Missing CLERK_SECRET_KEY' }, { status: 500 });
  }
  const fapiOrigin = getClerkFapiOrigin();
  if (!fapiOrigin) {
    return Response.json({ error: 'Missing or invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const targetPath = requestUrl.pathname.slice(CLERK_PROXY_PATH.length) || '/';
  const targetUrl = new URL(`${fapiOrigin}${targetPath}`);
  targetUrl.search = requestUrl.search;

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: copyRequestHeaders(request, clerkProxyUrl, targetUrl.host),
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  };
  if (hasBody) init.duplex = 'half';

  const response = await fetch(targetUrl.toString(), init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: copyResponseHeaders(response, clerkProxyUrl, fapiOrigin),
  });
}

export const GET = proxyClerkRequest;
export const POST = proxyClerkRequest;
export const PUT = proxyClerkRequest;
export const PATCH = proxyClerkRequest;
export const DELETE = proxyClerkRequest;
