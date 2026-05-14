import { NextResponse } from 'next/server';
import { withSuperAdminContext } from '@/lib/db';
import { handleTwilioStatusCallback } from '@/lib/receptionist/receptionist-live';

export async function POST(request: Request) {
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) {
    params.set(k, String(v));
  }
  await withSuperAdminContext(() => handleTwilioStatusCallback(params));
  return new NextResponse(null, { status: 204 });
}
