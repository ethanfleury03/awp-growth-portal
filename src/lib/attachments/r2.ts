/**
 * Minimal Cloudflare R2 presigned URL helper (S3-compatible, SigV4).
 *
 * We implement SigV4 in ~70 lines rather than pulling in the full AWS SDK
 * for attachments. Falls back to a local filesystem mode when R2 env vars are
 * absent (dev only).
 */

import crypto from 'crypto';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
}

export function r2ConfigFromEnv(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim() || undefined,
  };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/** Generates a presigned PUT URL for R2 (SigV4 query-string signing). */
export function presignPutUrl(args: {
  config: R2Config;
  key: string;
  contentType?: string;
  expiresSeconds?: number;
}): string {
  const { config, key } = args;
  const expires = args.expiresSeconds ?? 900;

  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const service = 's3';
  const region = 'auto';

  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, '')
    .slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;

  const canonicalUri = `/${encodeURIComponent(config.bucket)}/${key
    .split('/')
    .map(encodeRfc3986)
    .join('/')}`;
  const signedHeaders = 'host';

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  if (args.contentType) {
    // ContentType isn't signed as a header (we'd need to add it to signedHeaders),
    // so we leave it unsigned — caller sets Content-Type at PUT time.
  }

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    `host:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const key4 = signingKey(config.secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', key4).update(stringToSign).digest('hex');

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export function publicUrlFor(config: R2Config, key: string): string {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;
}
