import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { sql } from '@/lib/db';
import { parseJsonSafely } from '@/lib/ops';
import { buildMarketingAgentCsv } from '@/lib/marketing-agent/agent';

function safeFileName(value: string, extension: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'marketing-agent-artifact';
  return `${base}.${extension}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleOrRespond('marketing');
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT title, payload_json
    FROM growth_records
    WHERE id = ${id}
      AND company_id = ${auth.companyId}
      AND record_type = 'asset'
    LIMIT 1
  `;
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const title = String(rows[0].title || 'Marketing Agent Artifact');
  const payload = parseJsonSafely<Record<string, unknown>>(String(rows[0].payload_json || '')) || {};
  const assetType = String(payload.assetType || '');

  if (assetType === 'Client Document') {
    const markdown = String(payload.markdown || payload.body || '');
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFileName(title, 'md')}"`,
      },
    });
  }

  const columns = Array.isArray(payload.columns) ? payload.columns.map(String) : [];
  const artifactRows = Array.isArray(payload.rows)
    ? payload.rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown>[]
    : [];
  const csv = String(payload.csv || '') || buildMarketingAgentCsv(columns, artifactRows);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFileName(title, 'csv')}"`,
    },
  });
}
