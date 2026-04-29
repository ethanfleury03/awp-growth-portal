import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock } = vi.hoisted(() => ({ sqlMock: vi.fn() }));
vi.mock('@/lib/db', () => ({ sql: sqlMock }));

import { primaryEmail, syncClerkUser } from '@/lib/auth/clerk-sync';

describe('clerk sync', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('chooses the primary email address', () => {
    expect(primaryEmail({
      id: 'user_1',
      primary_email_address_id: 'em_2',
      email_addresses: [
        { id: 'em_1', email_address: 'first@example.com' },
        { id: 'em_2', email_address: 'primary@example.com' },
      ],
    })).toBe('primary@example.com');
  });

  it('records unknown Clerk users as unassigned instead of assigning a company', async () => {
    sqlMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await syncClerkUser({
      id: 'user_new',
      primary_email_address_id: 'em_1',
      email_addresses: [{ id: 'em_1', email_address: 'new@example.com' }],
      first_name: 'New',
      last_name: 'User',
    });

    expect(result).toEqual({ ok: true, unassigned: true, email: 'new@example.com' });
    expect(sqlMock).toHaveBeenCalledTimes(3);
    const allSql = sqlMock.mock.calls.map((call) => call[0].join(' ')).join(' ');
    expect(allSql).toContain('unassigned_portal_users');
    expect(allSql).not.toContain('ORDER BY datetime(created_at) ASC LIMIT 1');
  });

  it('links known portal users by email', async () => {
    sqlMock
      .mockResolvedValueOnce([{ id: 'portal_1', company_id: 'company_1' }])
      .mockResolvedValueOnce([]);

    const result = await syncClerkUser({
      id: 'user_known',
      primary_email_address_id: 'em_1',
      email_addresses: [{ id: 'em_1', email_address: 'known@example.com' }],
    });

    expect(result).toEqual({ ok: true, linked: true, email: 'known@example.com' });
    const allSql = sqlMock.mock.calls.map((call) => call[0].join(' ')).join(' ');
    expect(allSql).toContain('UPDATE portal_users');
  });
});
