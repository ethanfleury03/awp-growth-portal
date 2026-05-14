import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { ensureAdminTicketBuckets } from '@/lib/admin/tickets';

const COLOR_RE = /^#[0-9a-f]{6}$/i;

function normalizeColor(value: unknown) {
  const color = String(value || '').trim();
  return COLOR_RE.test(color) ? color : '#2f6b4f';
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  return NextResponse.json({ buckets: await ensureAdminTicketBuckets() });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const color = normalizeColor(body?.color);
  if (!name) {
    return NextResponse.json({ error: 'Bucket name is required.' }, { status: 400 });
  }

  const next = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
    FROM admin_ticket_buckets
    WHERE is_active = true
  `;
  const rows = await sql`
    INSERT INTO admin_ticket_buckets (name, color, sort_order, is_active)
    VALUES (${name}, ${color}, ${Number(next[0]?.next_order || 0)}, true)
    RETURNING *
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket_bucket.create',
    entityType: 'admin_ticket_bucket',
    entityId: String(rows[0]?.id || ''),
    summary: `Created ticket bucket ${name}`,
    metadata: { color },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ bucket: rows[0] }, { status: 201 });
}
