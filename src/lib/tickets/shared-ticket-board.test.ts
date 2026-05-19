import { describe, expect, it } from 'vitest';
import {
  normalizeTicketCreateInput,
  normalizeTicketUpdateInput,
  TICKET_TITLE_MAX_LENGTH,
} from './shared-ticket-board';
import { signHermesRouterPayload } from './agent-router';

describe('normalizeTicketCreateInput', () => {
  it('requires a ticket name', () => {
    expect(normalizeTicketCreateInput({ title: '   ' })).toEqual({
      ok: false,
      error: 'Ticket name is required.',
    });
  });

  it('normalizes a valid create payload', () => {
    expect(
      normalizeTicketCreateInput({
        title: '  Update homepage copy  ',
        description: '  Add client-requested changes.  ',
        priority: 'HIGH',
        dueDate: '2026-05-21',
      }),
    ).toEqual({
      ok: true,
      title: 'Update homepage copy',
      description: 'Add client-requested changes.',
      priority: 'high',
      dueDate: '2026-05-21',
    });
  });

  it('rejects invalid urgency and due dates', () => {
    expect(normalizeTicketCreateInput({ title: 'Ticket', priority: 'wild' })).toEqual({
      ok: false,
      error: 'Urgency must be low, normal, high, or urgent.',
    });
    expect(normalizeTicketCreateInput({ title: 'Ticket', dueDate: 'tomorrow' })).toEqual({
      ok: false,
      error: 'Date needed by must be a valid date.',
    });
    expect(normalizeTicketCreateInput({ title: 'Ticket', dueDate: '2026-02-31' })).toEqual({
      ok: false,
      error: 'Date needed by must be a valid date.',
    });
  });

  it('limits ticket names', () => {
    expect(normalizeTicketCreateInput({ title: 'x'.repeat(TICKET_TITLE_MAX_LENGTH + 1) })).toEqual({
      ok: false,
      error: `Ticket name must be ${TICKET_TITLE_MAX_LENGTH.toLocaleString()} characters or fewer.`,
    });
  });

  it('requires a status when updating a ticket', () => {
    expect(normalizeTicketUpdateInput({ title: 'Ticket', bucketId: '' })).toEqual({
      ok: false,
      error: 'Status is required.',
    });
    expect(normalizeTicketUpdateInput({ title: 'Ticket', bucketId: 'bucket-1' })).toEqual({
      ok: true,
      title: 'Ticket',
      description: null,
      priority: 'normal',
      dueDate: null,
      bucketId: 'bucket-1',
    });
  });
});

describe('signHermesRouterPayload', () => {
  it('signs the timestamp and raw body for the Mac mini router', () => {
    expect(
      signHermesRouterPayload(
        '{"ticket_id":"t1"}',
        '2026-05-19T00:00:00.000Z',
        'secret',
      ),
    ).toBe('6579f87260ad150c51cd8124d5533f89789109f9de36bc956a7ab904603969df');
  });
});
