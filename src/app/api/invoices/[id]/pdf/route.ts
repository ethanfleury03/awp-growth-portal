import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { renderInvoicePdf } from '@/lib/invoices/pdf';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;
  const { id } = await params;

  try {
    const pdf = await renderInvoicePdf({ invoiceId: id, companyId: auth.companyId });
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'PDF render failed' },
      { status: 500 },
    );
  }
}
