import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { isLocalAttachmentKey, localAttachmentPath, publicUrlFor, r2ConfigFromEnv } from '@/lib/attachments/r2';

export const runtime = 'nodejs';

const ALLOWED_ENTITY_TYPES = new Set([
  'estimate',
  'invoice',
  'job',
  'lead',
  'customer',
  'signature',
  'knowledge_item',
]);

function attachmentUrl(id: unknown, key: unknown) {
  const config = r2ConfigFromEnv();
  const fileKey = String(key || '');
  if (config && fileKey && !isLocalAttachmentKey(fileKey)) return publicUrlFor(config, fileKey);
  return `/api/attachments/${id}`;
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'upload';
}

async function ensureEntityAccess(companyId: string, entityType: string, entityId: string) {
  if (entityType === 'knowledge_item') {
    const rows = await sql`
      SELECT id FROM knowledge_items
      WHERE id = ${entityId} AND company_id = ${companyId}
      LIMIT 1
    `;
    return rows.length > 0;
  }
  return true;
}

export async function GET(request: Request) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const entityType = url.searchParams.get('entityType');
  const entityId = url.searchParams.get('entityId');
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType + entityId required' }, { status: 400 });
  }
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, file_key, file_name, mime_type, size_bytes, uploaded_by_user_id, created_at
    FROM attachments
    WHERE company_id = ${auth.companyId}
      AND entity_type = ${entityType}
      AND entity_id = ${entityId}
    ORDER BY created_at DESC
  `;

  const enriched = rows.map((r) => ({
    ...r,
    publicUrl: attachmentUrl(r.id, r.file_key),
  }));

  return NextResponse.json({ attachments: enriched });
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond('staff');
  if (isPortalResponse(auth)) return auth;

  const form = await request.formData();
  const entityType = String(form.get('entityType') || '');
  const entityId = String(form.get('entityId') || '');
  const fileEntry = form.get('file');

  if (!ALLOWED_ENTITY_TYPES.has(entityType) || !entityId || !fileEntry || typeof fileEntry === 'string') {
    return NextResponse.json({ error: 'Invalid upload input' }, { status: 400 });
  }
  if (fileEntry.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (50MB max)' }, { status: 400 });
  }
  if (!(await ensureEntityAccess(auth.companyId, entityType, entityId))) {
    return NextResponse.json({ error: 'Related record not found' }, { status: 404 });
  }

  const attachmentId = randomUUID();
  const name = safeFileName(fileEntry.name || 'upload');
  const key = `local/${auth.companyId}/${entityType}/${entityId}/${attachmentId}-${name}`;
  const filePath = localAttachmentPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(await fileEntry.arrayBuffer()));

  const result = await sql`
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
      ${fileEntry.name || name},
      ${fileEntry.type || null},
      ${fileEntry.size || null},
      ${auth.id}
    )
    RETURNING id, file_key, file_name, mime_type, size_bytes, uploaded_by_user_id, created_at
  `;

  return NextResponse.json({
    attachment: {
      ...result[0],
      publicUrl: attachmentUrl(result[0].id, result[0].file_key),
    },
  });
}
