import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import { patchSettingsSchema } from '@/lib/receptionist/validation';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET() {
  try {
    const settings = await receptionistService.getSettings();
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

async function applySettingsUpdate(request: Request) {
  const body = await request.json();
  const parsed = patchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const settings = await receptionistService.updateSettings(parsed.data);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  try {
    return await applySettingsUpdate(request);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    return await applySettingsUpdate(request);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
