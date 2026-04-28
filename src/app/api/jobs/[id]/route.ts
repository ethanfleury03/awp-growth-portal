import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requirePortalUser } from '@/lib/auth/tenant';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const portal = await requirePortalUser().catch(() => null);
  if (!portal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const jobRows = await sql`
      SELECT
        j.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address,
        l.issue AS lead_issue
      FROM jobs j
      LEFT JOIN customers c ON j.customer_id = c.id
      LEFT JOIN leads l ON j.lead_id = l.id
      WHERE j.id = ${id} AND j.company_id = ${portal.companyId}
    `;
    if (jobRows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const job = jobRows[0] as Record<string, unknown>;
    const sourceId = job.source_estimate_id as string | null | undefined;
    let sourceEstimate: Record<string, unknown> | null = null;
    if (sourceId) {
      const se = await sql`
        SELECT id, estimate_number, title, status, total_amount_cents, customer_public_token
        FROM estimates WHERE id = ${sourceId} AND company_id = ${portal.companyId}
      `;
      sourceEstimate = (se[0] as Record<string, unknown>) ?? null;
    }
    const estimates = await sql`
      SELECT id, estimate_number, title, status, total_amount_cents, created_at, job_id, converted_to_job_id, customer_public_token
      FROM estimates
      WHERE (job_id = ${id} OR converted_to_job_id = ${id})
        AND company_id = ${portal.companyId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({
      job: jobRows[0],
      source_estimate: sourceEstimate,
      estimates,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
