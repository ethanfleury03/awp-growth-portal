import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { isLocalAttachmentKey, localAttachmentPath, publicUrlFor, r2ConfigFromEnv } from '@/lib/attachments/r2';

export const runtime = 'nodejs';

function contentDisposition(fileName: unknown) {
  const name = String(fileName || 'attachment').replace(/["\r\n]/g, '_');
  return `inline; filename="${name}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT id, file_key, file_name, mime_type
    FROM attachments
    WHERE id = ${id} AND company_id = ${auth.companyId}
    LIMIT 1
  `;
  const attachment = rows[0];
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const key = String(attachment.file_key || '');
  const config = r2ConfigFromEnv();
  if (config && key && !isLocalAttachmentKey(key)) {
    return NextResponse.redirect(publicUrlFor(config, key));
  }

  try {
    const file = await fs.readFile(localAttachmentPath(key));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': String(attachment.mime_type || 'application/octet-stream'),
        'Content-Disposition': contentDisposition(attachment.file_name),
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT id, file_key FROM attachments WHERE id = ${id} AND company_id = ${auth.companyId} LIMIT 1
  `;
  const attachment = rows[0];
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await sql`DELETE FROM attachments WHERE id = ${id} AND company_id = ${auth.companyId}`;
  const key = String(attachment.file_key || '');
  if (isLocalAttachmentKey(key)) {
    await fs.unlink(localAttachmentPath(key)).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
