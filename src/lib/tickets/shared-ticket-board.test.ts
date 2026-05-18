import { describe, expect, it } from 'vitest';
import { normalizeTicketCreateInput, TICKET_TITLE_MAX_LENGTH } from './shared-ticket-board';

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
});
