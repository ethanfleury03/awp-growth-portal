import { randomUUID } from 'node:crypto';
import { sql, withTenantContext } from '@/lib/db';

export const LEAD_NOTE_MAX_LENGTH = 4000;

export type LeadNote = {
  id: string;
  lead_id: string;
  company_id: string;
  author_user_id: string | null;
  author_role: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: string;
};

type LeadContext = Record<string, unknown>;

export function normalizeLeadNoteBody(value: unknown):
  | { ok: true; body: string }
  | { ok: false; error: string } {
  const body = String(value || '').trim();
  if (!body) return { ok: false, error: 'Note body is required.' };
  if (body.length > LEAD_NOTE_MAX_LENGTH) {
    return { ok: false, error: `Note body must be ${LEAD_NOTE_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }
  return { ok: true, body };
}

function parseLeadContext(value: unknown): LeadContext {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as LeadContext)
      : {};
  } catch {
    return {};
  }
}

function normalizeLeadNotes(value: unknown): LeadNote[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((note): note is LeadNote => {
      if (!note || typeof note !== 'object') return false;
      const candidate = note as Partial<LeadNote>;
      return typeof candidate.id === 'string' && typeof candidate.body === 'string';
    })
    .map((note) => ({
      id: note.id,
      lead_id: String(note.lead_id || ''),
      company_id: String(note.company_id || ''),
      author_user_id: note.author_user_id || null,
      author_role: note.author_role || 'staff',
      author_name: note.author_name || null,
      author_email: note.author_email || null,
      body: note.body,
      created_at: note.created_at || new Date(0).toISOString(),
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

async function getCompanyLeadContext(leadId: string, companyId: string): Promise<LeadContext | null> {
  const rows = await sql`
    SELECT lead_context_json
    FROM leads
    WHERE id = ${leadId}
      AND company_id = ${companyId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return parseLeadContext(rows[0].lead_context_json);
}

export async function listLeadNotes(leadId: string, companyId: string): Promise<LeadNote[] | null> {
  return withTenantContext(companyId, async () => {
    const context = await getCompanyLeadContext(leadId, companyId);
    if (!context) return null;
    return normalizeLeadNotes(context.leadNotes);
  });
}

export async function addLeadNote(input: {
  leadId: string;
  companyId: string;
  authorUserId: string | null;
  authorRole: string;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
}): Promise<LeadNote> {
  const parsed = normalizeLeadNoteBody(input.body);
  if (!parsed.ok) throw new Error(parsed.error);

  return withTenantContext(input.companyId, async () => {
    const context = await getCompanyLeadContext(input.leadId, input.companyId);
    if (!context) {
      throw new Error('Lead not found.');
    }

    const note: LeadNote = {
      id: randomUUID(),
      lead_id: input.leadId,
      company_id: input.companyId,
      author_user_id: input.authorUserId,
      author_role: input.authorRole,
      author_name: input.authorName,
      author_email: input.authorEmail,
      body: parsed.body,
      created_at: new Date().toISOString(),
    };

    const leadNotes = [...normalizeLeadNotes(context.leadNotes), note];
    const nextContext = JSON.stringify({
      ...context,
      leadNotes,
    });

    await sql`
      UPDATE leads
      SET
        lead_context_json = ${nextContext},
        updated_at = datetime('now')
      WHERE id = ${input.leadId}
        AND company_id = ${input.companyId}
    `;

    return note;
  });
}
