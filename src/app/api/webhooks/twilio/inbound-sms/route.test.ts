import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require('node:os');
  const dbPath = p.join(o.tmpdir(), `plumber-sms-webhook-${process.pid}.db`);
  try {
    f.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  process.env.SQLITE_PATH = dbPath;
});

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import { POST } from './route';

const originalTwilioVerify = process.env.TWILIO_VERIFY_SIGNATURES;
const originalTwilioToken = process.env.TWILIO_AUTH_TOKEN;

function smsRequest(body: Record<string, string>) {
  return new Request('https://example.com/api/webhooks/twilio/inbound-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
}

async function resetData() {
  resetSqliteSingletonForTests();
  await sql`DELETE FROM customers`;
  await sql`DELETE FROM company_phone_numbers`;
  await sql`DELETE FROM companies`;
  await sql`INSERT INTO companies (id, name, email, twilio_phone_number) VALUES ('tenant-a', 'Tenant A', 'a@example.com', '+15550000001')`;
  await sql`INSERT INTO companies (id, name, email, twilio_phone_number) VALUES ('tenant-b', 'Tenant B', 'b@example.com', '+15550000002')`;
  await sql`
    INSERT INTO company_phone_numbers (id, company_id, phone_e164)
    VALUES ('phone-a', 'tenant-a', '+15550000001')
  `;
  await sql`
    INSERT INTO customers (id, company_id, name, phone, sms_opt_in)
    VALUES ('cust-a', 'tenant-a', 'Alice', '+15551234567', 1)
  `;
  await sql`
    INSERT INTO customers (id, company_id, name, phone, sms_opt_in)
    VALUES ('cust-b', 'tenant-b', 'Bob', '+15551234567', 1)
  `;
}

describe('Twilio inbound SMS webhook', () => {
  afterEach(() => {
    if (originalTwilioVerify === undefined) delete process.env.TWILIO_VERIFY_SIGNATURES;
    else process.env.TWILIO_VERIFY_SIGNATURES = originalTwilioVerify;
    if (originalTwilioToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalTwilioToken;
  });

  it('updates STOP only for the tenant resolved from To number', async () => {
    await resetData();
    process.env.TWILIO_VERIFY_SIGNATURES = 'false';

    await POST(
      smsRequest({
        From: '+15551234567',
        To: '+15550000001',
        Body: 'STOP',
      }),
    );

    const rows = await sql`
      SELECT id, sms_opt_in FROM customers
      WHERE phone = '+15551234567'
      ORDER BY id ASC
    `;
    expect(rows).toMatchObject([
      { id: 'cust-a', sms_opt_in: 0 },
      { id: 'cust-b', sms_opt_in: 1 },
    ]);

    resetSqliteSingletonForTests();
  });

  it('does not mutate when Twilio signature validation fails', async () => {
    await resetData();
    process.env.TWILIO_VERIFY_SIGNATURES = 'true';
    delete process.env.TWILIO_AUTH_TOKEN;

    await POST(
      smsRequest({
        From: '+15551234567',
        To: '+15550000001',
        Body: 'STOP',
      }),
    );

    const rows = await sql`
      SELECT id, sms_opt_in FROM customers
      WHERE phone = '+15551234567'
      ORDER BY id ASC
    `;
    expect(rows).toMatchObject([
      { id: 'cust-a', sms_opt_in: 1 },
      { id: 'cust-b', sms_opt_in: 1 },
    ]);

    resetSqliteSingletonForTests();
  });
});
