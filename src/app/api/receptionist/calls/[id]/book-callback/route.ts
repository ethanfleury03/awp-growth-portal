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
    const result = await receptionistService.bookCallbackFromCall(id, { skipIssueClarificationGuard: true });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
