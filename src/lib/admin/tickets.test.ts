import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const dbPath = path.join(os.tmpdir(), `admin-tickets-${process.pid}.sqlite`);
process.env.SQLITE_PATH = dbPath;

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import {
  addTicketComment,
  ensureAdminTicketBuckets,
  getTicketDetail,
  listTicketComments,
  normalizeTicketCommentBody,
} from '@/lib/admin/tickets';
import { POST as portalCreateTicket } from '@/app/api/tickets/route';

const companyId = '00000000-0000-4000-8000-000000000101';
const otherCompanyId = '00000000-0000-4000-8000-000000000202';
const ticketId = '00000000-0000-4000-8000-000000000303';

async function seedTicket() {
  await sql`
    INSERT INTO companies (id, name, email)
    VALUES
      (${companyId}, 'Ticket Co', 'ticket@example.com'),
      (${otherCompanyId}, 'Other Co', 'other-ticket@example.com')
  `;
  const [bucket] = await ensureAdminTicketBuckets();
  await sql`
    INSERT INTO admin_tickets (
      id,
      bucket_id,
      company_id,
      title,
      description,
      priority,
      requester_email,
      source,
      sort_order
    ) VALUES (
      ${ticketId},
      ${bucket.id},
      ${companyId},
      'Install tracking script',
      'Client needs launch checklist status.',
      'normal',
      'client@example.com',
      'admin',
      0
    )
  `;
}

describe('admin ticket comments', () => {
  beforeEach(() => {
    resetSqliteSingletonForTests();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* fresh test database */
    }
  });

  afterEach(() => {
    resetSqliteSingletonForTests();
  });

  it('stores shared admin and portal comments with latest-comment metadata', async () => {
    await seedTicket();

    await addTicketComment({
      ticketId,
      companyId,
      authorUserId: 'admin-user',
      authorRole: 'super_admin',
      authorName: 'Admin User',
      authorEmail: 'admin@example.com',
      body: 'Admin created the first update.',
    });
    await addTicketComment({
      ticketId,
      companyId,
      authorUserId: 'portal-user',
      authorRole: 'viewer',
      authorName: 'Portal User',
      authorEmail: 'client@example.com',
      body: 'Client replied with context.',
    });

    const comments = await listTicketComments(ticketId, companyId);
    expect(comments.map((comment) => comment.body)).toEqual([
      'Admin created the first update.',
      'Client replied with context.',
    ]);

    const detail = await getTicketDetail(ticketId, companyId);
    expect(detail).toMatchObject({
      id: ticketId,
      comment_count: 2,
      latest_comment_body: 'Client replied with context.',
    });
  });

  it('keeps company-scoped detail and comments isolated', async () => {
    await seedTicket();
    await addTicketComment({
      ticketId,
      companyId,
      authorUserId: 'admin-user',
      authorRole: 'super_admin',
      authorName: 'Admin User',
      authorEmail: 'admin@example.com',
      body: 'Private to the owning company.',
    });

    await expect(getTicketDetail(ticketId, otherCompanyId)).resolves.toBeNull();
    await expect(listTicketComments(ticketId, otherCompanyId)).resolves.toEqual([]);
  });

  it('validates comment bodies and keeps portal ticket creation disabled', async () => {
    expect(normalizeTicketCommentBody('  useful update  ')).toEqual({
      ok: true,
      body: 'useful update',
    });
    expect(normalizeTicketCommentBody('')).toEqual({
      ok: false,
      error: 'Comment body is required.',
    });
    expect(normalizeTicketCommentBody('x'.repeat(4001))).toEqual({
      ok: false,
      error: 'Comment body must be 4,000 characters or fewer.',
    });

    const response = await portalCreateTicket();
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: 'Client ticket creation is disabled. Tickets are created by the admin team.',
    });
  });
});
