import { describe, expect, it } from 'vitest';
import { LEAD_NOTE_MAX_LENGTH, normalizeLeadNoteBody } from './notes';

describe('normalizeLeadNoteBody', () => {
  it('requires a non-empty note body', () => {
    expect(normalizeLeadNoteBody('   ')).toEqual({
      ok: false,
      error: 'Note body is required.',
    });
  });

  it('trims valid note bodies', () => {
    expect(normalizeLeadNoteBody('  Call back Friday.  ')).toEqual({
      ok: true,
      body: 'Call back Friday.',
    });
  });

  it('rejects note bodies over the max length', () => {
    expect(normalizeLeadNoteBody('x'.repeat(LEAD_NOTE_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: `Note body must be ${LEAD_NOTE_MAX_LENGTH.toLocaleString()} characters or fewer.`,
    });
  });
});
