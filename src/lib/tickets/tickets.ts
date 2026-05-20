import { sql, withTenantContext } from '@/lib/db';
import { roleAtLeast, type SessionUser } from '@/lib/auth/types';

export const TICKET_TITLE_MAX_LENGTH = 160;
export const TICKET_BODY_MAX_LENGTH = 4000;

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_on_client', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TICKET_CATEGORIES = ['general', 'request', 'bug', 'access', 'billing', 'other'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type TicketRow = {
  id: string;
  company_id: string;
  branch_id: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  title: string;
  description: string;
  category: TicketCategory | string;
  priority: TicketPriority | string;
  status: TicketStatus | string;
  assigned_to_user_id: string | null;
  discord_message_id: string | null;
  notification_error: string | null;
  discord_notified_at: string | null;
  last_activity_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  last_comment_at?: string | null;
};

export type TicketCommentRow = {
  id: string;
  ticket_id: string;
  company_id: string;
  author_user_id: string | null;
  author_role: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  is_internal: boolean | number;
  created_at: string;
  updated_at: string;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function oneOf<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  const normalized = normalizeText(value).toLowerCase();
  return options.includes(normalized) ? normalized : fallback;
}

export function normalizeTicketCreateInput(input: unknown): ValidationResult<{
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}> {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const title = normalizeText(record.title);
  const description = normalizeText(record.description);

  if (!title) return { ok: false, error: 'Ticket title is required.' };
  if (title.length > TICKET_TITLE_MAX_LENGTH) {
    return { ok: false, error: `Ticket title must be ${TICKET_TITLE_MAX_LENGTH} characters or fewer.` };
  }
  if (!description) return { ok: false, error: 'Ticket details are required.' };
  if (description.length > TICKET_BODY_MAX_LENGTH) {
    return { ok: false, error: `Ticket details must be ${TICKET_BODY_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      category: oneOf(record.category, TICKET_CATEGORIES, 'general'),
      priority: oneOf(record.priority, TICKET_PRIORITIES, 'normal'),
    },
  };
}

export function normalizeTicketCommentInput(input: unknown): ValidationResult<{ body: string }> {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const body = normalizeText(record.body);
  if (!body) return { ok: false, error: 'Comment is required.' };
  if (body.length > TICKET_BODY_MAX_LENGTH) {
    return { ok: false, error: `Comment must be ${TICKET_BODY_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }
  return { ok: true, value: { body } };
}

export function normalizeTicketPatchInput(input: unknown): ValidationResult<{
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedToUserId?: string | null;
}> {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const patch: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedToUserId?: string | null;
  } = {};

  if (Object.prototype.hasOwnProperty.call(record, 'status')) {
    const status = normalizeText(record.status).toLowerCase();
    if (!TICKET_STATUSES.includes(status as TicketStatus)) {
      return { ok: false, error: 'Invalid ticket status.' };
    }
    patch.status = status as TicketStatus;
  }

  if (Object.prototype.hasOwnProperty.call(record, 'priority')) {
    const priority = normalizeText(record.priority).toLowerCase();
    if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) {
      return { ok: false, error: 'Invalid ticket priority.' };
    }
    patch.priority = priority as TicketPriority;
  }

  if (Object.prototype.hasOwnProperty.call(record, 'category')) {
    const category = normalizeText(record.category).toLowerCase();
    if (!TICKET_CATEGORIES.includes(category as TicketCategory)) {
      return { ok: false, error: 'Invalid ticket category.' };
    }
    patch.category = category as TicketCategory;
  }

  if (Object.prototype.hasOwnProperty.call(record, 'assignedToUserId')) {
    patch.assignedToUserId = normalizeText(record.assignedToUserId) || null;
  }

  return { ok: true, value: patch };
}

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTicketRow(row: Record<string, unknown>): TicketRow {
  return {
    ...(row as TicketRow),
    comment_count: toNumber(row.comment_count),
    last_comment_at: row.last_comment_at ? String(row.last_comment_at) : null,
  };
}

function canManageTicket(user: Pick<SessionUser, 'role'>) {
  return roleAtLeast(user.role, 'staff');
}

function getDiscordTicketWebhookUrl() {
  return (
    process.env.DISCORD_TICKETS_WEBHOOK_URL?.trim() ||
    process.env.DISCORD_TICKET_WEBHOOK_URL?.trim() ||
    ''
  );
}

function truncateForDiscord(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

async function companyName(companyId: string): Promise<string> {
  const rows = await sql`SELECT name FROM companies WHERE id = ${companyId} LIMIT 1`;
  return String(rows[0]?.name || 'Client workspace');
}

export async function listTickets(input: {
  companyId: string;
  status?: string | null;
  search?: string | null;
  limit?: number;
}): Promise<{ tickets: TicketRow[]; stats: Record<TicketStatus | 'total', number> }> {
  const limit = Math.min(Math.max(Number(input.limit || 100), 1), 200);
  const status = normalizeText(input.status);
  const search = normalizeText(input.search);

  return withTenantContext(input.companyId, async () => {
    let query = sql`
      SELECT
        t.*,
        COALESCE(c.comment_count, 0) AS comment_count,
        c.last_comment_at AS last_comment_at
      FROM tickets t
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) AS comment_count, MAX(created_at) AS last_comment_at
        FROM ticket_comments
        WHERE company_id = ${input.companyId}
          AND is_internal = ${false}
        GROUP BY ticket_id
      ) c ON c.ticket_id = t.id
      WHERE t.company_id = ${input.companyId}
    `;

    if (status && status !== 'all') {
      if (!TICKET_STATUSES.includes(status as TicketStatus)) {
        return { tickets: [], stats: await ticketStats(input.companyId) };
      }
      query = sql`${query} AND t.status = ${status}`;
    }

    if (search) {
      const like = `%${search}%`;
      query = sql`${query} AND (t.title ILIKE ${like} OR t.description ILIKE ${like} OR t.category ILIKE ${like})`;
    }

    const rows = await sql`
      ${query}
      ORDER BY t.last_activity_at DESC, t.created_at DESC
      LIMIT ${limit}
    `;

    return {
      tickets: rows.map(normalizeTicketRow),
      stats: await ticketStats(input.companyId),
    };
  });
}

export async function ticketStats(companyId: string): Promise<Record<TicketStatus | 'total', number>> {
  const stats: Record<TicketStatus | 'total', number> = {
    total: 0,
    open: 0,
    in_progress: 0,
    waiting_on_client: 0,
    resolved: 0,
    closed: 0,
  };
  const rows = await sql`
    SELECT status, COUNT(*) AS count
    FROM tickets
    WHERE company_id = ${companyId}
    GROUP BY status
  `;
  for (const row of rows) {
    const status = String(row.status || '') as TicketStatus;
    const count = toNumber(row.count);
    if (TICKET_STATUSES.includes(status)) stats[status] = count;
    stats.total += count;
  }
  return stats;
}

export async function getTicket(input: {
  companyId: string;
  ticketId: string;
  includeInternal?: boolean;
}): Promise<{ ticket: TicketRow; comments: TicketCommentRow[] } | null> {
  return withTenantContext(input.companyId, async () => {
    const rows = await sql`
      SELECT
        t.*,
        COALESCE(c.comment_count, 0) AS comment_count,
        c.last_comment_at AS last_comment_at
      FROM tickets t
      LEFT JOIN (
        SELECT ticket_id, COUNT(*) AS comment_count, MAX(created_at) AS last_comment_at
        FROM ticket_comments
        WHERE company_id = ${input.companyId}
        GROUP BY ticket_id
      ) c ON c.ticket_id = t.id
      WHERE t.id = ${input.ticketId}
        AND t.company_id = ${input.companyId}
      LIMIT 1
    `;
    if (!rows[0]) return null;

    let commentsQuery = sql`
      SELECT *
      FROM ticket_comments
      WHERE ticket_id = ${input.ticketId}
        AND company_id = ${input.companyId}
    `;
    if (!input.includeInternal) {
      commentsQuery = sql`${commentsQuery} AND is_internal = ${false}`;
    }
    const comments = await sql`${commentsQuery} ORDER BY created_at ASC`;
    return {
      ticket: normalizeTicketRow(rows[0]),
      comments: comments as TicketCommentRow[],
    };
  });
}

export async function createTicket(input: {
  companyId: string;
  branchId: string | null;
  user: Pick<SessionUser, 'id' | 'name' | 'email' | 'role'>;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}): Promise<TicketRow> {
  return withTenantContext(input.companyId, async () => {
    const rows = await sql`
      INSERT INTO tickets (
        company_id,
        branch_id,
        created_by_user_id,
        created_by_name,
        created_by_email,
        title,
        description,
        category,
        priority,
        status
      )
      VALUES (
        ${input.companyId},
        ${input.branchId},
        ${input.user.id},
        ${input.user.name},
        ${input.user.email},
        ${input.title},
        ${input.description},
        ${input.category},
        ${input.priority},
        'open'
      )
      RETURNING *
    `;
    return normalizeTicketRow(rows[0]);
  });
}

export async function addTicketComment(input: {
  companyId: string;
  ticketId: string;
  user: Pick<SessionUser, 'id' | 'name' | 'email' | 'role'>;
  body: string;
  isInternal?: boolean;
}): Promise<TicketCommentRow> {
  return withTenantContext(input.companyId, async () => {
    const ticket = await sql`
      SELECT id, status
      FROM tickets
      WHERE id = ${input.ticketId}
        AND company_id = ${input.companyId}
      LIMIT 1
    `;
    if (!ticket[0]) throw new Error('Ticket not found.');

    const rows = await sql`
      INSERT INTO ticket_comments (
        ticket_id,
        company_id,
        author_user_id,
        author_role,
        author_name,
        author_email,
        body,
        is_internal
      )
      VALUES (
        ${input.ticketId},
        ${input.companyId},
        ${input.user.id},
        ${input.user.role},
        ${input.user.name},
        ${input.user.email},
        ${input.body},
        ${Boolean(input.isInternal)}
      )
      RETURNING *
    `;

    const shouldReopen = !canManageTicket(input.user) && String(ticket[0].status) === 'waiting_on_client';
    if (shouldReopen) {
      await sql`
        UPDATE tickets
        SET status = 'open', last_activity_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ${input.ticketId}
          AND company_id = ${input.companyId}
      `;
    } else {
      await sql`
        UPDATE tickets
        SET last_activity_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ${input.ticketId}
          AND company_id = ${input.companyId}
      `;
    }

    return rows[0] as TicketCommentRow;
  });
}

export async function updateTicket(input: {
  companyId: string;
  ticketId: string;
  user: Pick<SessionUser, 'role'>;
  patch: {
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedToUserId?: string | null;
  };
}): Promise<TicketRow> {
  if (!canManageTicket(input.user)) {
    throw new Error('Only staff can update ticket workflow fields.');
  }

  return withTenantContext(input.companyId, async () => {
    const existing = await sql`
      SELECT id
      FROM tickets
      WHERE id = ${input.ticketId}
        AND company_id = ${input.companyId}
      LIMIT 1
    `;
    if (!existing[0]) throw new Error('Ticket not found.');

    const { patch } = input;
    if (patch.status) {
      const resolvedAt = patch.status === 'resolved' || patch.status === 'closed' ? new Date().toISOString() : null;
      await sql`
        UPDATE tickets
        SET status = ${patch.status},
            resolved_at = ${resolvedAt},
            last_activity_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ${input.ticketId}
          AND company_id = ${input.companyId}
      `;
    }
    if (patch.priority) {
      await sql`
        UPDATE tickets
        SET priority = ${patch.priority}, updated_at = datetime('now')
        WHERE id = ${input.ticketId}
          AND company_id = ${input.companyId}
      `;
    }
    if (patch.category) {
      await sql`
        UPDATE tickets
        SET category = ${patch.category}, updated_at = datetime('now')
        WHERE id = ${input.ticketId}
          AND company_id = ${input.companyId}
      `;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'assignedToUserId')) {
      await sql`
        UPDATE tickets
        SET assigned_to_user_id = ${patch.assignedToUserId ?? null}, updated_at = datetime('now')
        WHERE id = ${input.ticketId}
          AND company_id = ${input.companyId}
      `;
    }

    const result = await getTicket({
      companyId: input.companyId,
      ticketId: input.ticketId,
      includeInternal: true,
    });
    if (!result) throw new Error('Ticket not found.');
    return result.ticket;
  });
}

export async function notifyTicketCreated(ticket: TicketRow): Promise<'sent' | 'skipped' | 'failed'> {
  const webhookUrl = getDiscordTicketWebhookUrl();
  if (!webhookUrl) return 'skipped';

  try {
    const workspace = await companyName(ticket.company_id);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `New portal ticket: ${ticket.title}`,
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: truncateForDiscord(ticket.title, 256),
            description: truncateForDiscord(ticket.description, 1000),
            color: ticket.priority === 'urgent' ? 0xdc3545 : ticket.priority === 'high' ? 0xf59e0b : 0x2563eb,
            fields: [
              { name: 'Workspace', value: truncateForDiscord(workspace, 120), inline: true },
              { name: 'Priority', value: ticket.priority, inline: true },
              { name: 'Category', value: ticket.category, inline: true },
              { name: 'Requested by', value: truncateForDiscord(ticket.created_by_name || ticket.created_by_email || 'Client user', 120), inline: false },
            ],
            footer: { text: `Ticket ${ticket.id}` },
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Discord webhook failed with ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`);
    }

    await sql`
      UPDATE tickets
      SET discord_notified_at = datetime('now'),
          notification_error = NULL,
          updated_at = datetime('now')
      WHERE id = ${ticket.id}
        AND company_id = ${ticket.company_id}
    `;
    return 'sent';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discord webhook failed.';
    await sql`
      UPDATE tickets
      SET notification_error = ${message.slice(0, 500)},
          updated_at = datetime('now')
      WHERE id = ${ticket.id}
        AND company_id = ${ticket.company_id}
    `;
    console.warn('[tickets] Discord notification failed', error);
    return 'failed';
  }
}
