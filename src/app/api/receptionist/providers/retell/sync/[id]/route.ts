import { NextResponse } from 'next/server';
import { syncRetellCallFromApi } from '@/lib/receptionist/receptionist-live';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const call = await syncRetellCallFromApi(id);
    return NextResponse.json({ call });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
