import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { presignPutUrl, publicUrlFor, r2ConfigFromEnv } from '@/lib/attachments/r2';

const ALLOWED_ENTITY_TYPES = new Set([
  'estimate',
  'invoice',
  'job',
  'lead',
  'customer',
  'signature',
  'knowledge_item',
]);

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const entityType = String(body?.entityType || '');
  const entityId = String(body?.entityId || '');
  const fileName = String(body?.fileName || '');
  const mimeType = body?.mimeType ? String(body.mimeType) : null;
  const sizeBytes =
    typeof body?.sizeBytes === 'number' && body.sizeBytes > 0 ? body.sizeBytes : null;

  if (!ALLOWED_ENTITY_TYPES.has(entityType) || !entityId || !fileName) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  if (sizeBytes && sizeBytes > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (50MB max)' }, { status: 400 });
  }

  const config = r2ConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      { error: 'File uploads are not configured on this environment (set R2_* env vars).' },
      { status: 503 },
    );
  }

  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  const attachmentId = randomUUID();
  const key = `${auth.companyId}/${entityType}/${entityId}/${attachmentId}-${safeName}`;

  const uploadUrl = presignPutUrl({
    config,
    key,
    contentType: mimeType || undefined,
    expiresSeconds: 900,
  });

  await sql`
    INSERT INTO attachments (
      id, company_id, branch_id, entity_type, entity_id,
      file_key, file_name, mime_type, size_bytes, uploaded_by_user_id
    ) VALUES (
      ${attachmentId},
      ${auth.companyId},
      ${auth.branchId ?? null},
      ${entityType},
      ${entityId},
      ${key},
      ${fileName},
      ${mimeType},
      ${sizeBytes},
      ${auth.id}
    )
  `;

  return NextResponse.json({
    id: attachmentId,
    uploadUrl,
    publicUrl: publicUrlFor(config, key),
    key,
    expiresInSeconds: 900,
  });
}
