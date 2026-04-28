import { NextResponse } from 'next/server';
import { handleRetellWebhook } from '@/lib/receptionist/receptionist-live';

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-retell-signature');
  const result = await handleRetellWebhook(raw, signature);
  if (!result.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: result.status });
  }
  return new NextResponse(null, { status: 204 });
}
