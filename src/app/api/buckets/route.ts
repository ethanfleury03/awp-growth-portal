import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';
import { sourceToSlug } from '@/lib/awp/config';
import { ensureAwpPipeline } from '@/lib/awp/seed';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

type BucketRow = {
  id: string;
  title: string;
  color?: string | null;
  position: number;
};

function normalizeColor(value: unknown): string {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6b7280';
}

function validateBucketTitle(value: unknown): { title: string; error?: never } | { title?: never; error: string } {
  const title = String(value || '').trim();
  if (!title) return { error: 'Bucket title is required' };
  if (title.length > 64) return { error: 'Bucket title must be 64 characters or fewer.' };
  if (!sourceToSlug(title)) return { error: 'Bucket title needs at least one letter or number.' };
  return { title };
}

async function ensureCompanyBuckets(companyId: string) {
  await ensureAwpPipeline(companyId);
}

async function listBuckets(companyId: string): Promise<BucketRow[]> {
  await ensureCompanyBuckets(companyId);
  const buckets = await sql`
    SELECT id, title, color, position
    FROM buckets
    WHERE company_id = ${companyId}
    ORDER BY position ASC
  `;
  return buckets.map((bucket) => ({
    id: String(bucket.id),
    title: String(bucket.title),
    color: bucket.color ? String(bucket.color) : null,
    position: Number(bucket.position || 0),
  }));
}

async function titleConflicts(companyId: string, title: string, exceptId?: string) {
  const key = sourceToSlug(title);
  const buckets = await listBuckets(companyId);
  return buckets.some((bucket) => bucket.id !== exceptId && sourceToSlug(bucket.title) === key);
}

export async function GET() {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  try {
    return NextResponse.json({ buckets: await listBuckets(portal.companyId) });
  } catch (error: unknown) {
    console.error('Error fetching buckets:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const body = await request.json();
  const parsedTitle = validateBucketTitle(body.title);

  if ('error' in parsedTitle) {
    return NextResponse.json({ error: parsedTitle.error }, { status: 400 });
  }
  const title = parsedTitle.title;

  try {
    if (await titleConflicts(portal.companyId, title)) {
      return NextResponse.json({ error: 'A bucket with that name already exists.' }, { status: 400 });
    }

    const maxPos = await sql`
      SELECT COALESCE(MAX(position), 0) as max
      FROM buckets WHERE company_id = ${portal.companyId}
    `;
    const newPosition = Number(maxPos[0]?.max ?? 0) + 1;

    const result = await sql`
      INSERT INTO buckets (company_id, title, color, position)
      VALUES (${portal.companyId}, ${title}, ${normalizeColor(body.color)}, ${newPosition})
      RETURNING *
    `;

    return NextResponse.json({ bucket: result[0], buckets: await listBuckets(portal.companyId) });
  } catch (error: unknown) {
    console.error('Error creating bucket:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const body = await request.json();
  const { id, ...updates } = body;

  if (Array.isArray(body.order)) {
    try {
      const current = await listBuckets(portal.companyId);
      const currentIds = new Set(current.map((bucket) => bucket.id));
      const order = body.order.map((value: unknown) => String(value));
      if (order.length !== current.length || order.some((bucketId: string) => !currentIds.has(bucketId))) {
        return NextResponse.json({ error: 'Bucket order is invalid.' }, { status: 400 });
      }

      for (const [index, bucketId] of order.entries()) {
        await sql`
          UPDATE buckets
          SET position = ${-(index + 1)}, updated_at = datetime('now')
          WHERE id = ${bucketId} AND company_id = ${portal.companyId}
        `;
      }
      for (const [index, bucketId] of order.entries()) {
        await sql`
          UPDATE buckets
          SET position = ${index + 1}, updated_at = datetime('now')
          WHERE id = ${bucketId} AND company_id = ${portal.companyId}
        `;
      }

      return NextResponse.json({ buckets: await listBuckets(portal.companyId) });
    } catch (error: unknown) {
      console.error('Error reordering buckets:', error);
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const existingRows = await sql`
      SELECT id, title
      FROM buckets
      WHERE id = ${id} AND company_id = ${portal.companyId}
      LIMIT 1
    `;
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }

    const parsedTitle = updates.title !== undefined ? validateBucketTitle(updates.title) : { title: String(existing.title) };
    if ('error' in parsedTitle) {
      return NextResponse.json({ error: parsedTitle.error }, { status: 400 });
    }
    const nextTitle = parsedTitle.title;
    if (await titleConflicts(portal.companyId, nextTitle, String(id))) {
      return NextResponse.json({ error: 'A bucket with that name already exists.' }, { status: 400 });
    }

    const oldStatus = sourceToSlug(String(existing.title));
    const nextStatus = sourceToSlug(nextTitle);
    const result = await sql`
      UPDATE buckets 
      SET title = ${nextTitle},
          color = COALESCE(${updates.color !== undefined ? normalizeColor(updates.color) : null}, color),
          position = COALESCE(${updates.position ?? null}, position),
          updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${portal.companyId}
      RETURNING *
    `;

    if (oldStatus !== nextStatus) {
      await sql`
        UPDATE leads
        SET status = ${nextStatus}, updated_at = datetime('now')
        WHERE company_id = ${portal.companyId} AND status = ${oldStatus}
      `;
    }

    return NextResponse.json({ bucket: result[0], buckets: await listBuckets(portal.companyId) });
  } catch (error: unknown) {
    console.error('Error updating bucket:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const portal = await requireModuleOrRespond('crm');
  if (isPortalResponse(portal)) return portal;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const moveTo = searchParams.get('moveTo');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const buckets = await listBuckets(portal.companyId);
    const bucket = buckets.find((item) => item.id === id);
    if (!bucket) {
      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });
    }
    if (buckets.length <= 1) {
      return NextResponse.json({ error: 'Keep at least one CRM bucket.' }, { status: 400 });
    }

    const target = buckets.find((item) => item.id === moveTo && item.id !== id) || buckets.find((item) => item.id !== id);
    if (!target) {
      return NextResponse.json({ error: 'Choose another bucket before deleting this one.' }, { status: 400 });
    }

    await sql`
      UPDATE leads
      SET status = ${sourceToSlug(target.title)}, updated_at = datetime('now')
      WHERE company_id = ${portal.companyId} AND status = ${sourceToSlug(bucket.title)}
    `;
    await sql`DELETE FROM buckets WHERE id = ${id} AND company_id = ${portal.companyId}`;

    const remaining = await listBuckets(portal.companyId);
    for (const [index, item] of remaining.entries()) {
      await sql`
        UPDATE buckets
        SET position = ${index + 1}, updated_at = datetime('now')
        WHERE id = ${item.id} AND company_id = ${portal.companyId}
      `;
    }

    return NextResponse.json({ success: true, buckets: await listBuckets(portal.companyId) });
  } catch (error: unknown) {
    console.error('Error deleting bucket:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
