import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { addLeadNote, listLeadNotes, normalizeLeadNoteBody } from '@/lib/leads/notes';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const user = await requirePortalOrRespond();
  if (isPortalResponse(user)) return user;

  const { id } = await ctx.params;

  try {
    const notes = await listLeadNotes(id, user.companyId);
    if (!notes) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }
    return NextResponse.json({ notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load lead notes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const user = await requirePortalOrRespond();
  if (isPortalResponse(user)) return user;

  const { id } = await ctx.params;
  const payload = await request.json().catch(() => ({}));
  const parsed = normalizeLeadNoteBody((payload as { body?: unknown }).body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const note = await addLeadNote({
      leadId: id,
      companyId: user.companyId,
      authorUserId: user.id,
      authorRole: user.role,
      authorName: user.name,
      authorEmail: user.email,
      body: parsed.body,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add lead note.';
    const status = message === 'Lead not found.' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
