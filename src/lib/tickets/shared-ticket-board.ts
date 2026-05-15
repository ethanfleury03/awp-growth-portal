import { sql, withTenantContext } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';

export const TICKET_COMMENT_MAX_LENGTH = 4000;

export type TicketBucket = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean | number;
};

export type TicketComment = {
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

export function normalizeTicketCommentBody(value: unknown):
  | { ok: true; body: string }
  | { ok: false; error: string } {
  const body = String(value || '').trim();
  if (!body) return { ok: false, error: 'Comment body is required.' };
  if (body.length > TICKET_COMMENT_MAX_LENGTH) {
    return { ok: false, error: `Comment body must be ${TICKET_COMMENT_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }
  return { ok: true, body };
}

export async function listTicketBuckets(): Promise<TicketBucket[]> {
  const rows = await sql`
    SELECT id, name, color, sort_order, is_active
    FROM admin_ticket_buckets
    WHERE is_active = true
    ORDER BY sort_order ASC, created_at ASC
  `;
  return rows as TicketBucket[];
}

export async function listCompanyTickets(user: SessionUser) {
  return withTenantContext(user.companyId, async () => {
    const tickets = await sql`
      SELECT
        t.*,
        b.name AS bucket_name,
        b.color AS bucket_color,
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
        ) AS latest_comment_at,
        (
          SELECT COUNT(*)
          FROM admin_ticket_comments tc
          WHERE tc.ticket_id = t.id
            AND LOWER(COALESCE(tc.author_email, '')) = LOWER(${user.email})
        ) AS commented_by_current_user
      FROM admin_tickets t
      JOIN admin_ticket_buckets b ON b.id = t.bucket_id
      LEFT JOIN growth_records p ON p.id = t.project_id
      WHERE t.company_id = ${user.companyId}
      ORDER BY b.sort_order ASC, t.sort_order ASC, t.updated_at DESC
    `;

    return {
      buckets: await listTicketBuckets(),
      tickets,
      currentUserEmail: user.email,
    };
  });
}

export async function getCompanyTicketDetail(ticketId: string, companyId: string) {
  return withTenantContext(companyId, async () => {
    const rows = await sql`
      SELECT
        t.*,
        b.name AS bucket_name,
        b.color AS bucket_color,
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
      LEFT JOIN growth_records p ON p.id = t.project_id
      WHERE t.id = ${ticketId}
        AND t.company_id = ${companyId}
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return {
      ticket: rows[0],
      comments: await listTicketComments(ticketId, companyId),
    };
  });
}

export async function listTicketComments(ticketId: string, companyId: string): Promise<TicketComment[]> {
  const rows = await sql`
    SELECT *
    FROM admin_ticket_comments
    WHERE ticket_id = ${ticketId}
      AND company_id = ${companyId}
    ORDER BY created_at ASC
  `;
  return rows as TicketComment[];
}

export async function addTicketComment(input: {
  ticketId: string;
  companyId: string;
  authorUserId: string | null;
  authorRole: string;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
}): Promise<TicketComment> {
  const parsed = normalizeTicketCommentBody(input.body);
  if (!parsed.ok) throw new Error(parsed.error);

  return withTenantContext(input.companyId, async () => {
    const detail = await getCompanyTicketDetail(input.ticketId, input.companyId);
    if (!detail) throw new Error('Ticket not found.');

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

    return rows[0] as TicketComment;
  });
}
