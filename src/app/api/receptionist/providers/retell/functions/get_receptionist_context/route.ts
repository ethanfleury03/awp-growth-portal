import { NextResponse } from 'next/server';
import { getReceptionistContextForAgent } from '@/lib/receptionist/agent-context';
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
  const body = await readRetellToolJson(request, 'get_receptionist_context');
  await auditTool(undefined, 'get_receptionist_context', body, { ok: true }, 'ok');
  const context = await getReceptionistContextForAgent();
  return NextResponse.json(toolJsonOk({ context }));
}
