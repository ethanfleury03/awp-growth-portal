import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET() {
  try {
    const scenarios = await receptionistService.listScenarios();
    return NextResponse.json({ scenarios });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
