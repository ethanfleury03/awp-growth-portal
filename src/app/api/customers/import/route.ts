import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { isPortalResponse, requirePortalOrRespond } from '@/lib/auth/tenant';

/** Minimal RFC-4180 CSV parser (handles quoted fields + embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function POST(request: Request) {
  const auth = await requirePortalOrRespond('staff');
  if (isPortalResponse(auth)) return auth;

  const contentType = request.headers.get('content-type') || '';
  let csvText: string;
  if (contentType.includes('application/json')) {
    const body = await request.json();
    csvText = typeof body?.csv === 'string' ? body.csv : '';
  } else {
    csvText = await request.text();
  }
  if (!csvText.trim()) {
    return NextResponse.json({ error: 'Empty CSV' }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV must have a header row + ≥1 data row' }, { status: 400 });
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    name: header.indexOf('name'),
    email: header.indexOf('email'),
    phone: header.indexOf('phone'),
    address: header.indexOf('address'),
    notes: header.indexOf('notes'),
  };
  if (idx.name === -1) {
    return NextResponse.json({ error: 'CSV must have a "name" column' }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = (cells[idx.name] || '').trim();
    if (!name) {
      skipped++;
      continue;
    }
    const email = idx.email >= 0 ? (cells[idx.email] || '').trim() || null : null;
    const phone = idx.phone >= 0 ? (cells[idx.phone] || '').trim() || null : null;
    const address = idx.address >= 0 ? (cells[idx.address] || '').trim() || null : null;
    const notes = idx.notes >= 0 ? (cells[idx.notes] || '').trim() || null : null;

    if (phone) {
      const dup = await sql`
        SELECT 1 FROM customers WHERE company_id = ${auth.companyId} AND phone = ${phone} LIMIT 1
      `;
      if (dup.length) {
        skipped++;
        continue;
      }
    }

    try {
      await sql`
        INSERT INTO customers (id, company_id, branch_id, name, email, phone, address, notes)
        VALUES (
          ${randomUUID()},
          ${auth.companyId},
          ${auth.branchId ?? null},
          ${name},
          ${email},
          ${phone},
          ${address},
          ${notes}
        )
      `;
      inserted++;
    } catch (e) {
      errors.push({ row: r + 1, error: e instanceof Error ? e.message : 'insert failed' });
    }
  }

  return NextResponse.json({ inserted, skipped, errors });
}
