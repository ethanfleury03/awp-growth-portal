import { randomUUID } from 'node:crypto';
import { sql, withTenantContext } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';

export const TICKET_COMMENT_MAX_LENGTH = 4000;
export const TICKET_TITLE_MAX_LENGTH = 160;
export const TICKET_DESCRIPTION_MAX_LENGTH = 4000;

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

const VALID_TICKET_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

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

export function normalizeTicketCreateInput(input: {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
}):
  | {
      ok: true;
      title: string;
      description: string | null;
      priority: TicketPriority;
      dueDate: string | null;
    }
  | { ok: false; error: string } {
  const title = String(input.title || '').trim();
  if (!title) return { ok: false, error: 'Ticket name is required.' };
  if (title.length > TICKET_TITLE_MAX_LENGTH) {
    return { ok: false, error: `Ticket name must be ${TICKET_TITLE_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }

  const description = String(input.description || '').trim();
  if (description.length > TICKET_DESCRIPTION_MAX_LENGTH) {
    return { ok: false, error: `Description must be ${TICKET_DESCRIPTION_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }

  const priority = String(input.priority || 'normal').trim().toLowerCase();
  if (!VALID_TICKET_PRIORITIES.has(priority)) {
    return { ok: false, error: 'Urgency must be low, normal, high, or urgent.' };
  }

  const dueDate = String(input.dueDate || '').trim();
  if (dueDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
    const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (
      !match ||
      !parsed ||
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== Number(match[1]) ||
      parsed.getUTCMonth() !== Number(match[2]) - 1 ||
      parsed.getUTCDate() !== Number(match[3])
    ) {
      return { ok: false, error: 'Date needed by must be a valid date.' };
    }
  }

  return {
    ok: true,
    title,
    description: description || null,
    priority: priority as TicketPriority,
    dueDate: dueDate || null,
  };
}

export function normalizeTicketUpdateInput(input: {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  bucketId?: unknown;
}):
  | {
      ok: true;
      title: string;
      description: string | null;
      priority: TicketPriority;
      dueDate: string | null;
      bucketId: string;
    }
  | { ok: false; error: string } {
  const parsed = normalizeTicketCreateInput(input);
  if (!parsed.ok) return parsed;

  const bucketId = String(input.bucketId || '').trim();
  if (!bucketId) return { ok: false, error: 'Status is required.' };

  return {
    ...parsed,
    bucketId,
  };
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

export async function createTicket(input: {
  user: SessionUser;
  title: string;
  description: string | null;
  priority: TicketPriority;
  dueDate: string | null;
}) {
  return withTenantContext(input.user.companyId, async () => {
    const buckets = await listTicketBuckets();
    const bucket = buckets[0];
    if (!bucket) {
      throw new Error('No active ticket bucket is configured.');
    }

    const orderRows = await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM admin_tickets
      WHERE company_id = ${input.user.companyId}
        AND bucket_id = ${bucket.id}
    `;
    const nextSortOrder = Number(orderRows[0]?.max_sort_order || 0) + 1;
    const ticketId = randomUUID();

    const rows = await sql`
      INSERT INTO admin_tickets (
        id,
        company_id,
        bucket_id,
        title,
        description,
        priority,
        requester_email,
        source,
        due_date,
        sort_order,
        created_by_user_id,
        updated_by_user_id
      ) VALUES (
        ${ticketId},
        ${input.user.companyId},
        ${bucket.id},
        ${input.title},
        ${input.description},
        ${input.priority},
        ${input.user.email},
        ${'portal'},
        ${input.dueDate},
        ${nextSortOrder},
        ${input.user.id},
        ${input.user.id}
      )
      RETURNING *
    `;

    const ticket = rows[0];
    return {
      ...ticket,
      bucket_name: bucket.name,
      bucket_color: bucket.color,
      project_title: null,
      project_status: null,
      comment_count: 0,
      latest_comment_body: null,
      latest_comment_at: null,
      commented_by_current_user: 0,
    };
  });
}

export async function updateTicket(input: {
  user: SessionUser;
  ticketId: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  dueDate: string | null;
  bucketId: string;
}) {
  return withTenantContext(input.user.companyId, async () => {
    const bucketRows = await sql`
      SELECT id, name, color, sort_order, is_active
      FROM admin_ticket_buckets
      WHERE id = ${input.bucketId}
        AND is_active = true
      LIMIT 1
    `;
    if (!bucketRows[0]) {
      throw new Error('Status not found.');
    }

    const existingRows = await sql`
      SELECT id, bucket_id, sort_order
      FROM admin_tickets
      WHERE id = ${input.ticketId}
        AND company_id = ${input.user.companyId}
      LIMIT 1
    `;
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Ticket not found.');
    }

    let sortOrder = Number(existing.sort_order || 0);
    if (String(existing.bucket_id) !== input.bucketId) {
      const orderRows = await sql`
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM admin_tickets
        WHERE company_id = ${input.user.companyId}
          AND bucket_id = ${input.bucketId}
      `;
      sortOrder = Number(orderRows[0]?.max_sort_order || 0) + 1;
    }

    await sql`
      UPDATE admin_tickets
      SET bucket_id = ${input.bucketId},
          title = ${input.title},
          description = ${input.description},
          priority = ${input.priority},
          due_date = ${input.dueDate},
          sort_order = ${sortOrder},
          updated_by_user_id = ${input.user.id},
          updated_at = NOW()
      WHERE id = ${input.ticketId}
        AND company_id = ${input.user.companyId}
      RETURNING *
    `;

    const detail = await getCompanyTicketDetail(input.ticketId, input.user.companyId);
    if (!detail) {
      throw new Error('Ticket not found.');
    }
    return detail.ticket;
  });
}

export async function deleteTicket(input: {
  user: SessionUser;
  ticketId: string;
}) {
  return withTenantContext(input.user.companyId, async () => {
    const existingRows = await sql`
      SELECT id
      FROM admin_tickets
      WHERE id = ${input.ticketId}
        AND company_id = ${input.user.companyId}
      LIMIT 1
    `;
    if (!existingRows[0]) {
      return false;
    }

    await sql`
      DELETE FROM admin_ticket_comments
      WHERE ticket_id = ${input.ticketId}
        AND company_id = ${input.user.companyId}
    `;

    const deletedRows = await sql`
      DELETE FROM admin_tickets
      WHERE id = ${input.ticketId}
        AND company_id = ${input.user.companyId}
      RETURNING id
    `;
    return Boolean(deletedRows[0]);
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

export type TicketAgentLifecycleStatus =
  | 'started'
  | 'in_progress'
  | 'blocked'
  | 'needs_info'
  | 'completed'
  | 'ready_for_review'
  | 'done'
  | 'failed'
  | string;

export type TicketAgentLifecycleResult = {
  ticket: Record<string, unknown>;
  comment: TicketComment;
  bucketMoved: boolean;
  bucketName: string | null;
};

function normalizeLifecycleStatus(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function lifecycleBucketCandidates(status: string) {
  const normalized = normalizeLifecycleStatus(status);
  if (['started', 'start', 'in_progress', 'working', 'running', 'picked_up'].includes(normalized)) {
    return ['In progress'];
  }
  if (['blocked', 'needs_info', 'needs_information', 'waiting_on_client', 'waiting'].includes(normalized)) {
    return ['Waiting on client'];
  }
  if (['completed', 'complete', 'ready_for_review', 'review', 'done', 'finished', 'success'].includes(normalized)) {
    return ['Ready for review', 'Done'];
  }
  if (['failed', 'error'].includes(normalized)) {
    return ['Waiting on client'];
  }
  return [];
}

function defaultAgentLifecycleMessage(status: string) {
  const normalized = normalizeLifecycleStatus(status);
  if (['started', 'start', 'in_progress', 'working', 'running', 'picked_up'].includes(normalized)) {
    return 'AWP Growth Agent started working on this.';
  }
  if (['blocked', 'needs_info', 'needs_information', 'waiting_on_client', 'waiting'].includes(normalized)) {
    return 'AWP Growth Agent is blocked and needs more information.';
  }
  if (['failed', 'error'].includes(normalized)) {
    return 'AWP Growth Agent hit an issue while working on this ticket.';
  }
  return 'AWP Growth Agent finished this ticket and it is ready for review.';
}

function buildAgentLifecycleComment(input: {
  status: string;
  message?: string | null;
  result?: string | null;
  artifactPaths?: string[];
  artifactUrls?: string[];
}) {
  const message = String(input.message || '').trim() || defaultAgentLifecycleMessage(input.status);
  const result = String(input.result || '').trim();
  const artifactPaths = (input.artifactPaths || []).map((item) => item.trim()).filter(Boolean);
  const artifactUrls = (input.artifactUrls || []).map((item) => item.trim()).filter(Boolean);

  const lines = [message];
  if (result && result !== message) {
    lines.push('', 'Summary', result);
  }
  if (artifactPaths.length || artifactUrls.length) {
    lines.push('', 'Linked files');
    for (const path of artifactPaths) lines.push(`- ${path}`);
    for (const url of artifactUrls) lines.push(`- ${url}`);
  }

  const body = lines.join('\n');
  if (body.length <= TICKET_COMMENT_MAX_LENGTH) return body;
  return `${body.slice(0, TICKET_COMMENT_MAX_LENGTH - 68).trimEnd()}\n\n[Agent update truncated to fit the ticket conversation.]`;
}

async function resolveLifecycleBucket(status: string): Promise<TicketBucket | null> {
  const candidates = lifecycleBucketCandidates(status).map((name) => name.toLowerCase());
  if (candidates.length === 0) return null;

  const buckets = await listTicketBuckets();
  for (const candidate of candidates) {
    const bucket = buckets.find((item) => item.name.trim().toLowerCase() === candidate);
    if (bucket) return bucket;
  }
  return null;
}

async function moveTicketToBucket(input: {
  ticketId: string;
  companyId: string;
  bucket: TicketBucket;
}) {
  return withTenantContext(input.companyId, async () => {
    const existingRows = await sql`
      SELECT id, bucket_id
      FROM admin_tickets
      WHERE id = ${input.ticketId}
        AND company_id = ${input.companyId}
      LIMIT 1
    `;
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Ticket not found.');
    }
    if (String(existing.bucket_id) === input.bucket.id) {
      return false;
    }

    const orderRows = await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
      FROM admin_tickets
      WHERE company_id = ${input.companyId}
        AND bucket_id = ${input.bucket.id}
    `;
    const nextSortOrder = Number(orderRows[0]?.max_sort_order || 0) + 1;

    await sql`
      UPDATE admin_tickets
      SET bucket_id = ${input.bucket.id},
          sort_order = ${nextSortOrder},
          updated_by_user_id = NULL,
          updated_at = NOW()
      WHERE id = ${input.ticketId}
        AND company_id = ${input.companyId}
    `;
    return true;
  });
}

export async function applyTicketAgentLifecycleUpdate(input: {
  ticketId: string;
  companyId: string;
  status: TicketAgentLifecycleStatus;
  message?: string | null;
  result?: string | null;
  artifactPaths?: string[];
  artifactUrls?: string[];
}): Promise<TicketAgentLifecycleResult> {
  const status = String(input.status || '').trim();
  if (!status) throw new Error('Agent status is required.');

  const bucket = await resolveLifecycleBucket(status);
  const bucketMoved = bucket
    ? await moveTicketToBucket({ ticketId: input.ticketId, companyId: input.companyId, bucket })
    : false;
  const comment = await addTicketComment({
    ticketId: input.ticketId,
    companyId: input.companyId,
    authorUserId: null,
    authorRole: 'agent',
    authorName: 'AWP Growth Agent',
    authorEmail: 'awp-agent@wnyautomation.local',
    body: buildAgentLifecycleComment(input),
  });
  const detail = await getCompanyTicketDetail(input.ticketId, input.companyId);
  if (!detail) throw new Error('Ticket not found.');
  return {
    ticket: detail.ticket,
    comment,
    bucketMoved,
    bucketName: bucket?.name || null,
  };
}
