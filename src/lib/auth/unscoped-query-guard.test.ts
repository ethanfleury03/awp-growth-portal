/**
 * Static check: every API route that queries tenant-scoped tables must
 * include a `company_id` filter in the same file. This is a crude heuristic
 * (substring match on table name + company_id) to catch regressions until
 * Postgres RLS is in place.
 *
 * To exempt a file, add its path (relative to repo root, using forward
 * slashes) to `EXEMPT_FILES`. Exemptions must be justified in a comment
 * above the entry.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TENANT_TABLES = [
  'customers',
  'leads',
  'jobs',
  'invoices',
  'estimates',
  'plumbers',
  'payments',
  'buckets',
  'call_logs',
  'receptionist_calls',
  'audit_logs',
];

const EXEMPT_FILES = new Set<string>([
  // Public token endpoints look up by token + confirm company via the row.
  'src/app/api/public/invoice/[token]/route.ts',
  'src/app/api/public/invoice/[token]/checkout/route.ts',
  'src/app/api/public/estimate/[token]/route.ts',
  'src/app/api/public/estimate/[token]/approve/route.ts',
  'src/app/api/public/estimate/[token]/reject/route.ts',
  'src/app/api/public/estimate/[token]/view/route.ts',
  'src/app/api/public/estimate/[token]/checkout-deposit/route.ts',
  // Webhooks verify the source and scope by payload metadata.
  'src/app/api/stripe/webhook/route.ts',
  'src/app/api/webhooks/clerk/route.ts',
  // Twilio inbound SMS (STOP/START keywords) — the caller identifies themselves
  // only via their phone number, which can't be mapped to a single tenant, so
  // the opt-out propagates across every tenant that stored that number.
  'src/app/api/webhooks/twilio/inbound-sms/route.ts',
  // Retell/Twilio provider callbacks — scoped via provider ids, not portal user.
  'src/app/api/receptionist/webhooks/twilio/voice/route.ts',
  'src/app/api/receptionist/webhooks/twilio/status/route.ts',
  'src/app/api/receptionist/providers/retell/webhook/route.ts',
  'src/app/api/receptionist/providers/retell/functions/book_callback/route.ts',
  'src/app/api/receptionist/providers/retell/functions/book_quote_visit/route.ts',
  'src/app/api/receptionist/providers/retell/functions/create_lead/route.ts',
  'src/app/api/receptionist/providers/retell/functions/end_call_notes/route.ts',
  'src/app/api/receptionist/providers/retell/functions/flag_emergency/route.ts',
  'src/app/api/receptionist/providers/retell/functions/get_availability/route.ts',
  'src/app/api/receptionist/providers/retell/functions/get_receptionist_context/route.ts',
  'src/app/api/receptionist/providers/retell/functions/mark_spam/route.ts',
  'src/app/api/receptionist/providers/retell/sync/[id]/route.ts',
  'src/app/api/receptionist/providers/twilio/voice/route.ts',
  'src/app/api/receptionist/providers/twilio/status/route.ts',
  // Setup is dev-only and gated by env token.
  'src/app/api/setup/route.ts',
  // Geocode has no tenant state.
  'src/app/api/geocode/route.ts',
]);

function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function fileReferencesTenantTable(contents: string): string[] {
  const hits: string[] = [];
  for (const table of TENANT_TABLES) {
    const re = new RegExp(`\\bFROM\\s+${table}\\b|\\bJOIN\\s+${table}\\b|\\bINTO\\s+${table}\\b|\\bUPDATE\\s+${table}\\b|\\bDELETE\\s+FROM\\s+${table}\\b`, 'i');
    if (re.test(contents)) hits.push(table);
  }
  return hits;
}

function hasCompanyGuard(contents: string): boolean {
  return /company_id/.test(contents) || /requirePortalUser|requireTenantContext|requirePortalOrRespond/.test(contents);
}

describe('unscoped query guard', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const apiDir = path.join(repoRoot, 'src', 'app', 'api');

  it('every tenant-table query in src/app/api has a company_id guard', () => {
    const files = walk(apiDir);
    const violations: { file: string; tables: string[] }[] = [];
    for (const absPath of files) {
      const relPath = normalize(path.relative(repoRoot, absPath));
      if (EXEMPT_FILES.has(relPath)) continue;
      const contents = fs.readFileSync(absPath, 'utf8');
      const tables = fileReferencesTenantTable(contents);
      if (tables.length > 0 && !hasCompanyGuard(contents)) {
        violations.push({ file: relPath, tables });
      }
    }
    expect(violations, `Unscoped tenant queries:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  });
});
