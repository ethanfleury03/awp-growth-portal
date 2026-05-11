import { NextResponse } from 'next/server';
import { isReceptionistAccessResponse, requireReceptionistCallAccessOrRespond } from '@/lib/receptionist/access';
import { receptionistService } from '@/lib/receptionist/service';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireReceptionistCallAccessOrRespond(id);
  if (isReceptionistAccessResponse(access)) return access;

  try {
    const detail = await receptionistService.getCallDetail(id, { companyId: access.auth.companyId });
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
