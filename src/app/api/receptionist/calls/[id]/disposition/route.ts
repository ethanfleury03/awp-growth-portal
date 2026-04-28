import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import { dispositionBodySchema } from '@/lib/receptionist/validation';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = dispositionBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    await receptionistService.setDisposition(id, parsed.data.disposition);
    const detail = await receptionistService.getCallDetail(id);
    return NextResponse.json({ ok: true, ...detail });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
