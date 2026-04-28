import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let dbOk = false;
  try {
    const rows = await sql`SELECT 1 AS one`;
    dbOk = Array.isArray(rows) && rows.length === 1;
  } catch (err) {
    console.error('health check db failure', err);
  }
  const elapsedMs = Date.now() - started;
  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbOk,
      db: dbOk ? 'up' : 'down',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      elapsedMs,
    },
    { status },
  );
}
