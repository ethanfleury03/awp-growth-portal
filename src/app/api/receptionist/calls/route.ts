import { NextResponse } from 'next/server';
import { receptionistService } from '@/lib/receptionist/service';
import { listCallsQuerySchema } from '@/lib/receptionist/validation';
import { requirePortalUser } from '@/lib/auth/tenant';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: Request) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = listCallsQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { page, limit } = parsed.data;
    const { calls, total } = await receptionistService.listCalls(page, limit, {
      companyId: portal.companyId,
    });
    return NextResponse.json({ calls, total, page, limit });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
