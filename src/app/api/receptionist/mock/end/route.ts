import { NextResponse } from 'next/server';
import { z } from 'zod';
import { receptionistService } from '@/lib/receptionist/service';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

const bodySchema = z
  .object({
    callId: z.string().min(1),
    fastForwardRemaining: z.boolean().optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const call = await receptionistService.endMockCall(
      parsed.data.callId,
      parsed.data.fastForwardRemaining !== false,
    );
    return NextResponse.json({ call });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
