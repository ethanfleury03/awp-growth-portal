import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requirePortalUser } from '@/lib/auth/tenant';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET() {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const buckets = await sql`
      SELECT * FROM buckets
      WHERE company_id = ${portal.companyId} OR company_id IS NULL
      ORDER BY position ASC
    `;
    return NextResponse.json({ buckets });
  } catch (error: unknown) {
    console.error('Error fetching buckets:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const maxPos = await sql`
      SELECT COALESCE(MAX(position), 0) as max
      FROM buckets WHERE company_id = ${portal.companyId}
    `;
    const newPosition = Number(maxPos[0]?.max ?? 0) + 1;

    const result = await sql`
      INSERT INTO buckets (company_id, title, color, position)
      VALUES (${portal.companyId}, ${body.title}, ${body.color || '#6b7280'}, ${newPosition})
      RETURNING *
    `;

    return NextResponse.json({ bucket: result[0] });
  } catch (error: unknown) {
    console.error('Error creating bucket:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    const result = await sql`
      UPDATE buckets 
      SET title = COALESCE(${updates.title ?? null}, title),
          color = COALESCE(${updates.color ?? null}, color),
          position = COALESCE(${updates.position ?? null}, position),
          updated_at = datetime('now')
      WHERE id = ${id} AND company_id = ${portal.companyId}
      RETURNING *
    `;

    return NextResponse.json({ bucket: result[0] });
  } catch (error: unknown) {
    console.error('Error updating bucket:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM buckets WHERE id = ${id} AND company_id = ${portal.companyId}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting bucket:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
