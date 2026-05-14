import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { isPortalResponse, requireSuperAdmin } from '@/lib/auth/tenant';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { DEFAULT_ADMIN_TICKET_BUCKETS } from '@/lib/admin/tickets';

const COLOR_RE = /^#[0-9a-f]{6}$/i;

function normalizeColor(value: unknown) {
  const color = String(value || '').trim();
  return COLOR_RE.test(color) ? color : null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === 'undefined' ? null : String(body.name || '').trim();
  const color = typeof body?.color === 'undefined' ? null : normalizeColor(body.color);
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : null;

  if (name !== null && !name) {
    return NextResponse.json({ error: 'Bucket name is required.' }, { status: 400 });
  }
  if (typeof body?.color !== 'undefined' && !color) {
    return NextResponse.json({ error: 'Choose a valid bucket color.' }, { status: 400 });
  }

  const rows = await sql`
    UPDATE admin_ticket_buckets
    SET
      name = COALESCE(${name}, name),
      color = COALESCE(${color}, color),
      sort_order = COALESCE(${sortOrder}, sort_order),
      updated_at = datetime('now')
    WHERE id = ${id} AND is_active = true
    RETURNING *
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: 'Bucket not found.' }, { status: 404 });
  }

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket_bucket.update',
    entityType: 'admin_ticket_bucket',
    entityId: id,
    summary: `Updated ticket bucket ${rows[0].name}`,
    metadata: { name, color, sortOrder },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ bucket: rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const current = await sql`
    SELECT id, name
    FROM admin_ticket_buckets
    WHERE id = ${id} AND is_active = true
    LIMIT 1
  `;
  if (!current[0]) {
    return NextResponse.json({ error: 'Bucket not found.' }, { status: 404 });
  }

  let replacementId = String(body?.targetBucketId || '').trim();
  if (replacementId) {
    const replacement = await sql`
      SELECT id
      FROM admin_ticket_buckets
      WHERE id = ${replacementId} AND id <> ${id} AND is_active = true
      LIMIT 1
    `;
    if (!replacement[0]) replacementId = '';
  }
  if (!replacementId) {
    const fallback = await sql`
      SELECT id
      FROM admin_ticket_buckets
      WHERE id <> ${id} AND is_active = true
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 1
    `;
    replacementId = String(fallback[0]?.id || '');
  }
  if (!replacementId) {
    const defaultBucket = DEFAULT_ADMIN_TICKET_BUCKETS[0];
    const inserted = await sql`
      INSERT INTO admin_ticket_buckets (name, color, sort_order, is_active)
      VALUES (${defaultBucket.name}, ${defaultBucket.color}, 0, true)
      RETURNING id
    `;
    replacementId = String(inserted[0]?.id || '');
  }

  await sql`
    UPDATE admin_tickets
    SET bucket_id = ${replacementId}, updated_at = datetime('now')
    WHERE bucket_id = ${id}
  `;
  await sql`
    UPDATE admin_ticket_buckets
    SET is_active = false, updated_at = datetime('now')
    WHERE id = ${id}
  `;

  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'admin_ticket_bucket.delete',
    entityType: 'admin_ticket_bucket',
    entityId: id,
    summary: `Deleted ticket bucket ${current[0].name}`,
    metadata: { replacementId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, replacementId });
}
