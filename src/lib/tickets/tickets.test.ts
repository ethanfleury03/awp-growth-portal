import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require('node:os');
  const dbPath = p.join(o.tmpdir(), `awp-tickets-${process.pid}.db`);
  try {
    f.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  process.env.SQLITE_PATH = dbPath;
});

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import {
  addTicketComment,
  createTicket,
  getTicket,
  listTickets,
  normalizeTicketCreateInput,
  updateTicket,
} from './tickets';

const viewerUser = {
  id: 'viewer-user',
  name: 'Viewer User',
  email: 'viewer@example.com',
  role: 'viewer' as const,
};

const staffUser = {
  id: 'staff-user',
  name: 'Staff User',
  email: 'staff@example.com',
  role: 'staff' as const,
};

async function resetData() {
  resetSqliteSingletonForTests();
  await sql`DELETE FROM ticket_comments`;
  await sql`DELETE FROM tickets`;
  await sql`DELETE FROM companies`;
  await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-a', 'Tenant A', 'a@example.com')`;
  await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-b', 'Tenant B', 'b@example.com')`;
}

describe('ticket input normalization', () => {
  it('requires a title and details', () => {
    expect(normalizeTicketCreateInput({ title: ' ', description: 'Help' })).toEqual({
      ok: false,
      error: 'Ticket title is required.',
    });
    expect(normalizeTicketCreateInput({ title: 'Help', description: ' ' })).toEqual({
      ok: false,
      error: 'Ticket details are required.',
    });
  });

  it('normalizes optional category and priority values', () => {
    expect(
      normalizeTicketCreateInput({
        title: '  Need access  ',
        description: '  Please add me.  ',
        category: 'access',
        priority: 'URGENT',
      }),
    ).toEqual({
      ok: true,
      value: {
        title: 'Need access',
        description: 'Please add me.',
        category: 'access',
        priority: 'urgent',
      },
    });
  });
});

describe('ticket persistence', () => {
  afterEach(() => {
    resetSqliteSingletonForTests();
  });

  it('creates, lists, and comments only inside the selected tenant', async () => {
    await resetData();

    const ticket = await createTicket({
      companyId: 'tenant-a',
      branchId: null,
      user: viewerUser,
      title: 'Client ticket',
      description: 'The client needs help.',
      category: 'general',
      priority: 'normal',
    });
    await addTicketComment({
      companyId: 'tenant-a',
      ticketId: ticket.id,
      user: viewerUser,
      body: 'Adding more detail.',
    });

    const tenantAList = await listTickets({ companyId: 'tenant-a' });
    const tenantBList = await listTickets({ companyId: 'tenant-b' });
    const detail = await getTicket({ companyId: 'tenant-a', ticketId: ticket.id });

    expect(tenantAList.stats.total).toBe(1);
    expect(tenantAList.tickets[0].comment_count).toBe(1);
    expect(tenantBList.stats.total).toBe(0);
    expect(detail?.comments).toHaveLength(1);
  });

  it('limits workflow updates to staff users', async () => {
    await resetData();

    const ticket = await createTicket({
      companyId: 'tenant-a',
      branchId: null,
      user: viewerUser,
      title: 'Workflow ticket',
      description: 'Needs a status update.',
      category: 'general',
      priority: 'normal',
    });

    await expect(
      updateTicket({
        companyId: 'tenant-a',
        ticketId: ticket.id,
        user: viewerUser,
        patch: { status: 'in_progress' },
      }),
    ).rejects.toThrow(/Only staff/);

    const updated = await updateTicket({
      companyId: 'tenant-a',
      ticketId: ticket.id,
      user: staffUser,
      patch: { status: 'in_progress', priority: 'high' },
    });

    expect(updated.status).toBe('in_progress');
    expect(updated.priority).toBe('high');
  });
});
