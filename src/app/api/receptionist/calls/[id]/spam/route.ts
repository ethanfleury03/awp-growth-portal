import { NextResponse } from 'next/server';
import { isReceptionistAccessResponse, requireReceptionistCallAccessOrRespond } from '@/lib/receptionist/access';
import { receptionistService } from '@/lib/receptionist/service';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireReceptionistCallAccessOrRespond(id);
  if (isReceptionistAccessResponse(access)) return access;

  try {
    await receptionistService.markSpam(id);
    const detail = await receptionistService.getCallDetail(id, { companyId: access.auth.companyId });
    return NextResponse.json({ ok: true, ...detail });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
