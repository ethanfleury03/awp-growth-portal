import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { presignPutUrl, r2ConfigFromEnv } from '@/lib/attachments/r2';

/**
 * Pre-flight for a signature capture. Returns a presigned PUT URL the browser
 * can upload the PNG to, plus the attachment_id we wrote to the DB. The client
 * then calls POST /confirm to stamp `signature_attachment_id` on the estimate.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const estimate = await sql`
    SELECT id FROM estimates WHERE id = ${id} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!estimate.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const config = r2ConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      { error: 'Signature capture requires R2 configuration.' },
      { status: 503 },
    );
  }

  const attachmentId = randomUUID();
  const key = `${auth.companyId}/signature/${id}/${attachmentId}.png`;
  const uploadUrl = presignPutUrl({ config, key, contentType: 'image/png', expiresSeconds: 600 });

  await sql`
    INSERT INTO attachments (
      id, company_id, branch_id, entity_type, entity_id, file_key, file_name,
      mime_type, size_bytes, uploaded_by_user_id
    ) VALUES (
      ${attachmentId},
      ${auth.companyId},
      ${auth.branchId ?? null},
      ${'signature'},
      ${id},
      ${key},
      ${'signature.png'},
      ${'image/png'},
      ${null},
      ${auth.id}
    )
  `;

  return NextResponse.json({ attachmentId, uploadUrl, key, expiresInSeconds: 600 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const attachmentId = String(body?.attachmentId || '');
  if (!attachmentId) return NextResponse.json({ error: 'attachmentId required' }, { status: 400 });

  const owned = await sql`
    SELECT id FROM attachments
    WHERE id = ${attachmentId} AND company_id = ${auth.companyId}
      AND entity_type = 'signature' AND entity_id = ${id}
    LIMIT 1
  `;
  if (!owned.length) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  await sql`
    UPDATE estimates
    SET signature_attachment_id = ${attachmentId},
        signed_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ${id} AND company_id = ${auth.companyId}
  `;
  return NextResponse.json({ ok: true });
}
