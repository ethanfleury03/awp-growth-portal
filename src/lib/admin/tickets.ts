import { sql } from '@/lib/db';

export const ADMIN_TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type AdminTicketPriority = (typeof ADMIN_TICKET_PRIORITIES)[number];

export const DEFAULT_ADMIN_TICKET_BUCKETS = [
  { name: 'Inbox', color: '#64748b' },
  { name: 'In progress', color: '#2f6b4f' },
  { name: 'Waiting on client', color: '#cb891c' },
  { name: 'Done', color: '#1f9b6d' },
] as const;

export type AdminTicketBucketRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
};

export function normalizePriority(value: unknown): AdminTicketPriority {
  const priority = String(value || 'normal').trim().toLowerCase();
  return ADMIN_TICKET_PRIORITIES.includes(priority as AdminTicketPriority)
    ? (priority as AdminTicketPriority)
    : 'normal';
}

export async function ensureAdminTicketBuckets(): Promise<AdminTicketBucketRow[]> {
  const existing = await sql`
    SELECT COUNT(*) AS count
    FROM admin_ticket_buckets
    WHERE is_active = true
  `;
  const count = Number(existing[0]?.count || 0);
  if (count === 0) {
    for (const [idx, bucket] of DEFAULT_ADMIN_TICKET_BUCKETS.entries()) {
      await sql`
        INSERT INTO admin_ticket_buckets (name, color, sort_order, is_active)
        VALUES (${bucket.name}, ${bucket.color}, ${idx}, true)
      `;
    }
  }

  return (await sql`
    SELECT *
    FROM admin_ticket_buckets
    WHERE is_active = true
    ORDER BY sort_order ASC, created_at ASC
  `) as AdminTicketBucketRow[];
}

export async function getDefaultAdminTicketBucketId(): Promise<string> {
  const buckets = await ensureAdminTicketBuckets();
  return String(buckets[0]?.id || '');
}

export async function companyExists(companyId: string): Promise<boolean> {
  const rows = await sql`
    SELECT id
    FROM companies
    WHERE id = ${companyId}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function projectBelongsToCompany(projectId: string | null, companyId: string): Promise<boolean> {
  if (!projectId) return true;
  const rows = await sql`
    SELECT id
    FROM growth_records
    WHERE id = ${projectId}
      AND company_id = ${companyId}
      AND record_type = 'project'
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function nextTicketSortOrder(bucketId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
    FROM admin_tickets
    WHERE bucket_id = ${bucketId}
  `;
  return Number(rows[0]?.next_order || 0);
}
