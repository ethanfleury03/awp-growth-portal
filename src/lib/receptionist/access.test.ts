import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require('node:os');
  const dbPath = p.join(o.tmpdir(), `plumber-receptionist-access-${process.pid}.db`);
  try {
    f.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  process.env.SQLITE_PATH = dbPath;
});

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import {
  ensureReceptionistSettings,
  getReceptionistCallForCompany,
  updateReceptionistSettings,
} from '@/lib/receptionist/repository';

async function resetData() {
  resetSqliteSingletonForTests();
  await sql`DELETE FROM receptionist_staff_tasks`;
  await sql`DELETE FROM receptionist_tool_invocations`;
  await sql`DELETE FROM receptionist_bookings`;
  await sql`DELETE FROM receptionist_events`;
  await sql`DELETE FROM receptionist_transcript_segments`;
  await sql`DELETE FROM receptionist_calls`;
  await sql`DELETE FROM receptionist_settings`;
  await sql`DELETE FROM companies`;
}

describe('receptionist tenant access', () => {
  it('only returns calls for the owning company', async () => {
    await resetData();
    await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-a', 'Tenant A', 'a@example.com')`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-b', 'Tenant B', 'b@example.com')`;
    await sql`
      INSERT INTO receptionist_calls (id, company_id, provider, direction, status)
      VALUES ('call-a', 'tenant-a', 'mock', 'inbound', 'completed')
    `;

    expect(await getReceptionistCallForCompany('call-a', 'tenant-a')).toBeTruthy();
    expect(await getReceptionistCallForCompany('call-a', 'tenant-b')).toBeNull();

    resetSqliteSingletonForTests();
  });

  it('keeps receptionist settings updates scoped per company', async () => {
    await resetData();
    await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-a', 'Tenant A', 'a@example.com')`;
    await sql`INSERT INTO companies (id, name, email) VALUES ('tenant-b', 'Tenant B', 'b@example.com')`;

    await ensureReceptionistSettings('tenant-a');
    await ensureReceptionistSettings('tenant-b');
    await updateReceptionistSettings('tenant-a', { greeting: 'Tenant A greeting' });

    const a = await ensureReceptionistSettings('tenant-a');
    const b = await ensureReceptionistSettings('tenant-b');
    expect(a.greeting).toBe('Tenant A greeting');
    expect(b.greeting).not.toBe('Tenant A greeting');

    resetSqliteSingletonForTests();
  });
});
