import { NextResponse } from 'next/server';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';
import { refundPayment } from '@/lib/payments/payment-service';
import { auditFromRequest, writeAudit } from '@/lib/audit/audit';
import { enforceAuthedRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePortalOrRespond('admin');
  if (isPortalResponse(auth)) return auth;
  const limited = enforceAuthedRateLimit({ user: auth, action: 'payment.refund', max: 10, windowMs: 60_000 });
  if (limited) return limited;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const amountCents =
    typeof body?.amountCents === 'number' && body.amountCents > 0 ? body.amountCents : undefined;
  const reason =
    typeof body?.reason === 'string' &&
    ['duplicate', 'fraudulent', 'requested_by_customer'].includes(body.reason)
      ? (body.reason as 'duplicate' | 'fraudulent' | 'requested_by_customer')
      : undefined;

  const res = await refundPayment({
    paymentId: id,
    companyId: auth.companyId,
    amountCents,
    reason,
  });
  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  const meta = auditFromRequest(request);
  await writeAudit({
    actor: auth,
    action: 'payment.refund',
    entityType: 'payment',
    entityId: id,
    summary: `Refund ${amountCents ? `$${(amountCents / 100).toFixed(2)}` : 'full amount'}${reason ? ` (${reason})` : ''}`,
    metadata: { amountCents: amountCents ?? null, reason: reason ?? null, refundId: res.refundId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return NextResponse.json({ ok: true, refundId: res.refundId });
}
