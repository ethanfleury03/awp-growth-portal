import { describe, expect, it } from 'vitest';
import { normalizeCustomerPayload } from '@/lib/customers/validation';

describe('normalizeCustomerPayload', () => {
  it('trims editable customer fields and stores blank optional values as null', () => {
    const result = normalizeCustomerPayload({
      name: '  Pat Staging  ',
      email: '  PAT.STAGING@EXAMPLE.TEST  ',
      phone: '  (716) 555-0180  ',
      address: '  214 Test Harbor Rd  ',
      notes: '   ',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Pat Staging',
        email: 'pat.staging@example.test',
        phone: '(716) 555-0180',
        address: '214 Test Harbor Rd',
        notes: null,
      },
    });
  });

  it('requires the database-backed required fields', () => {
    const result = normalizeCustomerPayload({
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    });

    expect(result).toEqual({ ok: false, error: 'Customer name is required' });
  });

  it('rejects invalid email addresses', () => {
    const result = normalizeCustomerPayload({
      name: 'Pat Staging',
      email: 'not an email',
      phone: '(716) 555-0180',
      address: '',
      notes: '',
    });

    expect(result).toEqual({ ok: false, error: 'Enter a valid email address' });
  });
});
