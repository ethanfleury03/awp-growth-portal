import { NextResponse } from 'next/server';
import { z } from 'zod';
import { receptionistService } from '@/lib/receptionist/service';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

const bodySchema = z.object({ callId: z.string().min(1) }).strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await receptionistService.advanceMockCall(parsed.data.callId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
