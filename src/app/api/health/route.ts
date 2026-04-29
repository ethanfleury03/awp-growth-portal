import { NextResponse } from 'next/server';
import { configuredChecks } from '@/lib/health/checks';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let migrationsOk = false;
  try {
    const { sql } = await import('@/lib/db');
    const rows = await sql`SELECT 1 AS one`;
    dbOk = Array.isArray(rows) && rows.length === 1;
    const tableRows = await sql`
      SELECT 1 AS ok FROM company_settings LIMIT 1
    `;
    migrationsOk = Array.isArray(tableRows);
  } catch (err) {
    console.error('health check db failure', err);
  }
  const elapsedMs = Date.now() - started;
  const checks = {
    database: dbOk,
    migrations: migrationsOk,
    ...configuredChecks(),
  };
  const status = dbOk && migrationsOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbOk && migrationsOk,
      db: dbOk ? 'up' : 'down',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      elapsedMs,
      checks,
    },
    { status },
  );
}
