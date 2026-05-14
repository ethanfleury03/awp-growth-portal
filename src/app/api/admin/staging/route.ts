import { NextResponse } from 'next/server';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import {
  getConfiguredStagingPortalUrl,
  getStagingBuildMetadata,
  getStagingHealthUrl,
} from '@/lib/staging/config';

export const dynamic = 'force-dynamic';

type HealthJson = {
  ok?: boolean;
  db?: string;
  version?: string;
  elapsedMs?: number;
  checks?: Record<string, unknown>;
};

async function readJsonSafely(response: Response): Promise<HealthJson | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json().catch(() => null) as Promise<HealthJson | null>;
}

async function checkStagingHealth(healthUrl: string | null) {
  const checkedAt = new Date().toISOString();
  if (!healthUrl) {
    return {
      ok: false,
      status: 'unconfigured' as const,
      checkedAt,
      error: 'STAGING_PORTAL_URL is not configured.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });
    const body = await readJsonSafely(response);
    const bodyOk = body?.ok !== false;
    return {
      ok: response.ok && bodyOk,
      status: response.ok && bodyOk ? ('healthy' as const) : ('degraded' as const),
      checkedAt,
      httpStatus: response.status,
      db: body?.db || null,
      version: body?.version || null,
      elapsedMs: body?.elapsedMs ?? null,
      checks: body?.checks || null,
    };
  } catch (error) {
    return {
      ok: false,
      status: error instanceof Error && error.name === 'AbortError' ? ('timeout' as const) : ('unreachable' as const),
      checkedAt,
      error: error instanceof Error ? error.message : 'Could not reach staging health check.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const stagingUrl = getConfiguredStagingPortalUrl();
  const healthUrl = getStagingHealthUrl();
  const health = await checkStagingHealth(healthUrl);

  return NextResponse.json({
    configured: Boolean(stagingUrl),
    stagingUrl,
    healthUrl,
    health,
    environment: getStagingBuildMetadata(),
  });
}
