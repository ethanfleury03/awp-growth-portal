import { NextResponse } from 'next/server';
import { z } from 'zod';
import { receptionistService } from '@/lib/receptionist/service';

const bodySchema = z.object({
  action: z.enum([
    'assign_on_call',
    'urgent_callback_task',
    'dispatch_review',
    'escalate_emergency',
    'mark_resolved',
    'mark_duplicate_no_action',
    'link_customer_ack',
  ]),
  plumberId: z.string().uuid().optional().nullable(),
  note: z.string().max(2000).optional(),
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const out = await receptionistService.applyStaffHandoff(id, parsed.data.action, {
      plumberId: parsed.data.plumberId ?? null,
      note: parsed.data.note,
    });
    return NextResponse.json(out);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
