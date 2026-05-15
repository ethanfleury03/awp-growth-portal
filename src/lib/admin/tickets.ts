import { sql } from '@/lib/db';

export const ADMIN_TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type AdminTicketPriority = (typeof ADMIN_TICKET_PRIORITIES)[number];
export const ADMIN_TICKET_COMMENT_MAX_LENGTH = 4000;

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

export type AdminTicketCommentRow = {
  id: string;
  ticket_id: string;
  company_id: string;
  author_user_id: string | null;
  author_role: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: string;
};

export function normalizePriority(value: unknown): AdminTicketPriority {
  const priority = String(value || 'normal').trim().toLowerCase();
  return ADMIN_TICKET_PRIORITIES.includes(priority as AdminTicketPriority)
    ? (priority as AdminTicketPriority)
    : 'normal';
}

export function normalizeTicketCommentBody(value: unknown):
  | { ok: true; body: string }
  | { ok: false; error: string } {
  const body = String(value || '').trim();
  if (!body) return { ok: false, error: 'Comment body is required.' };
  if (body.length > ADMIN_TICKET_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Comment body must be ${ADMIN_TICKET_COMMENT_MAX_LENGTH.toLocaleString()} characters or fewer.`,
    };
  }
  return { ok: true, body };
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

export async function getTicketDetail(ticketId: string, companyId?: string) {
  const companyScope = companyId ? sql`AND t.company_id = ${companyId}` : sql``;
  const rows = await sql`
    SELECT
      t.*,
      b.name AS bucket_name,
      b.color AS bucket_color,
      c.name AS company_name,
      c.email AS company_email,
      s.display_name AS company_display_name,
      s.primary_color AS company_primary_color,
      s.accent_color AS company_accent_color,
      p.title AS project_title,
      p.status AS project_status,
      (
        SELECT COUNT(*)
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
      ) AS comment_count,
      (
        SELECT tc.body
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
        ORDER BY tc.created_at DESC
        LIMIT 1
      ) AS latest_comment_body,
      (
        SELECT tc.created_at
        FROM admin_ticket_comments tc
        WHERE tc.ticket_id = t.id
        ORDER BY tc.created_at DESC
        LIMIT 1
      ) AS latest_comment_at
    FROM admin_tickets t
    JOIN admin_ticket_buckets b ON b.id = t.bucket_id
    JOIN companies c ON c.id = t.company_id
    LEFT JOIN company_settings s ON s.company_id = t.company_id
    LEFT JOIN growth_records p ON p.id = t.project_id
    WHERE t.id = ${ticketId}
      ${companyScope}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listTicketComments(
  ticketId: string,
  companyId?: string,
): Promise<AdminTicketCommentRow[]> {
  const companyScope = companyId ? sql`AND company_id = ${companyId}` : sql``;
  const rows = await sql`
    SELECT *
    FROM admin_ticket_comments
    WHERE ticket_id = ${ticketId}
      ${companyScope}
    ORDER BY created_at ASC
  `;
  return rows as AdminTicketCommentRow[];
}

export async function addTicketComment(input: {
  ticketId: string;
  companyId: string;
  authorUserId: string | null;
  authorRole: string;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
}): Promise<AdminTicketCommentRow> {
  const parsed = normalizeTicketCommentBody(input.body);
  if (!parsed.ok) throw new Error(parsed.error);

  const rows = await sql`
    INSERT INTO admin_ticket_comments (
      ticket_id,
      company_id,
      author_user_id,
      author_role,
      author_name,
      author_email,
      body
    ) VALUES (
      ${input.ticketId},
      ${input.companyId},
      ${input.authorUserId},
      ${input.authorRole},
      ${input.authorName},
      ${input.authorEmail},
      ${parsed.body}
    )
    RETURNING *
  `;

  await sql`
    UPDATE admin_tickets
    SET updated_at = datetime('now')
    WHERE id = ${input.ticketId}
      AND company_id = ${input.companyId}
  `;

  return rows[0] as AdminTicketCommentRow;
}
