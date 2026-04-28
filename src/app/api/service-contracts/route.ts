import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

const CADENCES = new Set(['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual']);

export async function GET() {
  const auth = await requirePortalOrRespond();
  if (isPortalResponse(auth)) return auth;

  const rows = await sql`
    SELECT sc.id, sc.name, sc.cadence, sc.price_cents, sc.active, sc.next_due_at,
           sc.notes, sc.customer_id, c.name AS customer_name, c.phone AS customer_phone
    FROM service_contracts sc
    LEFT JOIN customers c ON c.id = sc.customer_id
    WHERE sc.company_id = ${auth.companyId}
    ORDER BY datetime(sc.created_at) DESC
  `;
  return NextResponse.json({ contracts: rows });
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond('staff');
  if (isPortalResponse(auth)) return auth;

  const body = await request.json().catch(() => ({}));
  const customerId = String(body?.customerId || '');
  const name = String(body?.name || '').trim();
  const cadence = String(body?.cadence || '');
  const priceCents = Number(body?.priceCents || 0);
  const notes = body?.notes ? String(body.notes) : null;
  const nextDueAt = body?.nextDueAt ? String(body.nextDueAt) : null;

  if (!customerId || !name) return NextResponse.json({ error: 'customerId + name required' }, { status: 400 });
  if (!CADENCES.has(cadence)) return NextResponse.json({ error: 'Invalid cadence' }, { status: 400 });

  const cust = await sql`
    SELECT id FROM customers WHERE id = ${customerId} AND company_id = ${auth.companyId} LIMIT 1
  `;
  if (!cust.length) return NextResponse.json({ error: 'Customer not found in your company' }, { status: 400 });

  const id = randomUUID();
  await sql`
    INSERT INTO service_contracts (id, company_id, customer_id, name, cadence, price_cents, notes, next_due_at)
    VALUES (${id}, ${auth.companyId}, ${customerId}, ${name}, ${cadence}, ${priceCents}, ${notes}, ${nextDueAt})
  `;
  return NextResponse.json({ id, ok: true });
}
