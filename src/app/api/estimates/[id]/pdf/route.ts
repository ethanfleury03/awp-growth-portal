import { NextResponse } from 'next/server';
import { buildEstimatePdfBytes } from '@/lib/estimates/pdf-document';
import { buildEstimatePresentation } from '@/lib/estimates/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const presentation = await buildEstimatePresentation(id, { internal: true });
    if (!presentation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const bytes = await buildEstimatePdfBytes({
      estimate: presentation.estimate as Record<string, unknown>,
      lineItems: presentation.lineItems as Record<string, unknown>[],
      branding: presentation.branding as Record<string, unknown>,
    });
    const num = String((presentation.estimate as Record<string, unknown>).estimate_number || id).replace(/[^\w.-]+/g, '_');
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="estimate-${num}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
