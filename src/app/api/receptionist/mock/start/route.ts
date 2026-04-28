import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import { startMockSchema } from '@/lib/receptionist/validation';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = startMockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { call, scenario } = await receptionistService.startMockCall(parsed.data.scenarioId);
    return NextResponse.json({ call, scenarioId: scenario.id, turnCount: scenario.turns.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
