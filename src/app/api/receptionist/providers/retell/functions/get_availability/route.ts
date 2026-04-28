import { NextResponse } from 'next/server';
import { getAvailabilityForAgent } from '@/lib/receptionist/agent-context';
import {
  auditTool,
  readRetellToolJson,
  toolJsonError,
  toolJsonOk,
  verifyRetellToolSecret,
} from '@/lib/receptionist/retell-tool-common';

export async function POST(request: Request) {
  if (!verifyRetellToolSecret(request)) {
    return NextResponse.json(toolJsonError('Unauthorized', 'unauthorized'), { status: 401 });
  }
  const body = await readRetellToolJson(request, 'get_availability');
  await auditTool(undefined, 'get_availability', body, { ok: true }, 'ok');
  const availability = await getAvailabilityForAgent();
  return NextResponse.json(toolJsonOk({ availability }));
}
