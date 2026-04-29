import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { configuredChecks, missingConfiguredChecks } from '@/lib/health/checks';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const started = Date.now();
  const [dbRows, webhookFailures, unassignedUsers, auditEvents] = await Promise.all([
    sql`SELECT 1 AS one`,
    sql`SELECT COUNT(*) AS count FROM webhook_failures WHERE status != 'resolved'`,
    sql`SELECT COUNT(*) AS count FROM unassigned_portal_users WHERE assigned_at IS NULL`,
    sql`SELECT COUNT(*) AS count FROM audit_logs`,
  ]);
  return NextResponse.json({
    ok: dbRows.length === 1,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    elapsedMs: Date.now() - started,
    checks: configuredChecks(),
    missing: missingConfiguredChecks(),
    counts: {
      webhookFailures: Number(webhookFailures[0]?.count || 0),
      unassignedUsers: Number(unassignedUsers[0]?.count || 0),
      auditEvents: Number(auditEvents[0]?.count || 0),
    },
    lastDatabaseQueryAt: new Date().toISOString(),
  });
}
