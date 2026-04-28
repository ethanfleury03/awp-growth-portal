import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

function runtimeSetupEnabled() {
  return process.env.ALLOW_RUNTIME_SETUP === 'true' && process.env.NODE_ENV !== 'production';
}

export async function POST(request: Request) {
  try {
    if (!runtimeSetupEnabled()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const expectedToken =
      process.env.WNY_AUTOMATION_SETUP_TOKEN?.trim() ||
      process.env.PLUMBEROS_SETUP_TOKEN?.trim();
    const providedToken =
      request.headers.get('x-wny-automation-setup-token')?.trim() ||
      request.headers.get('x-plumberos-setup-token')?.trim();
    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const dataDir = path.join(process.cwd(), 'data');
    const schema = fs.readFileSync(path.join(dataDir, 'schema.sqlite.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(dataDir, 'seed.sqlite.sql'), 'utf8');
    db.exec(schema);
    db.exec(seed);

    return NextResponse.json({
      success: true,
      message: 'SQLite schema and seed applied (idempotent).',
    });
  } catch (error: unknown) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
