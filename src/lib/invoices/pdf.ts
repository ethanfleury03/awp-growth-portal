import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sql } from '@/lib/db';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  amount_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  notes: string | null;
}
interface LineItem {
  name: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}
interface CompanyRow {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
}
interface CustomerRow {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export async function renderInvoicePdf(args: {
  invoiceId: string;
  companyId: string;
}): Promise<Buffer> {
  const invoiceRows = await sql`
    SELECT i.id, i.invoice_number, i.issue_date, i.due_date, i.status,
           i.amount_cents, i.tax_cents, i.total_cents, i.notes, i.customer_id
    FROM invoices i
    WHERE i.id = ${args.invoiceId} AND i.company_id = ${args.companyId}
    LIMIT 1
  `;
  const invoice = invoiceRows[0] as unknown as
    | (InvoiceRow & { customer_id: string | null })
    | undefined;
  if (!invoice) throw new Error('Invoice not found');

  const [companyRows, customerRows, lineRows] = await Promise.all([
    sql`SELECT name, email, phone, address FROM companies WHERE id = ${args.companyId} LIMIT 1`,
    invoice.customer_id
      ? sql`SELECT name, email, phone, address FROM customers WHERE id = ${invoice.customer_id} LIMIT 1`
      : Promise.resolve([]),
    sql`
      SELECT name, description, quantity, unit_price_cents, line_total_cents
      FROM invoice_line_items
      WHERE invoice_id = ${args.invoiceId}
      ORDER BY sort_order ASC, datetime(created_at) ASC
    `,
  ]);
  const company = companyRows[0] as unknown as CompanyRow;
  const customer = (customerRows[0] as unknown as CustomerRow | undefined) ?? null;
  const lineItems = lineRows as unknown as LineItem[];

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.12, 0.12, 0.12);
  const subtle = rgb(0.45, 0.45, 0.45);

  const fmtMoney = (cents: number | null) =>
    cents == null ? '—' : `$${(cents / 100).toFixed(2)}`;

  page.drawText(company.name, { x: 40, y: 750, size: 18, font: fontBold, color });
  const companyLines = [company.address, company.phone, company.email].filter(Boolean) as string[];
  companyLines.forEach((line, i) => {
    page.drawText(String(line), { x: 40, y: 732 - i * 12, size: 9, font, color: subtle });
  });

  page.drawText('INVOICE', { x: 440, y: 750, size: 22, font: fontBold, color });
  page.drawText(`#${invoice.invoice_number}`, {
    x: 440,
    y: 726,
    size: 11,
    font,
    color,
  });
  page.drawText(`Issued: ${invoice.issue_date}`, {
    x: 440,
    y: 710,
    size: 9,
    font,
    color: subtle,
  });
  if (invoice.due_date) {
    page.drawText(`Due: ${invoice.due_date}`, {
      x: 440,
      y: 698,
      size: 9,
      font,
      color: subtle,
    });
  }

  page.drawLine({
    start: { x: 40, y: 680 },
    end: { x: 572, y: 680 },
    thickness: 0.5,
    color: subtle,
  });

  page.drawText('Bill to', { x: 40, y: 660, size: 9, font: fontBold, color: subtle });
  if (customer) {
    page.drawText(customer.name, { x: 40, y: 645, size: 11, font: fontBold, color });
    const custLines = [customer.email, customer.phone, customer.address].filter(Boolean) as string[];
    custLines.forEach((line, i) => {
      page.drawText(String(line), { x: 40, y: 630 - i * 12, size: 9, font, color });
    });
  }

  let y = 580;
  page.drawText('Description', { x: 40, y, size: 9, font: fontBold, color: subtle });
  page.drawText('Qty', { x: 360, y, size: 9, font: fontBold, color: subtle });
  page.drawText('Unit', { x: 420, y, size: 9, font: fontBold, color: subtle });
  page.drawText('Line total', { x: 490, y, size: 9, font: fontBold, color: subtle });
  y -= 8;
  page.drawLine({
    start: { x: 40, y },
    end: { x: 572, y },
    thickness: 0.4,
    color: subtle,
  });
  y -= 14;

  for (const li of lineItems) {
    page.drawText(li.name, { x: 40, y, size: 10, font, color });
    if (li.description) {
      page.drawText(li.description.slice(0, 80), {
        x: 40,
        y: y - 11,
        size: 8,
        font,
        color: subtle,
      });
    }
    page.drawText(String(li.quantity), { x: 360, y, size: 10, font, color });
    page.drawText(fmtMoney(li.unit_price_cents), { x: 420, y, size: 10, font, color });
    page.drawText(fmtMoney(li.line_total_cents), { x: 490, y, size: 10, font, color });
    y -= li.description ? 28 : 18;
    if (y < 120) break;
  }

  y -= 10;
  page.drawLine({
    start: { x: 350, y },
    end: { x: 572, y },
    thickness: 0.4,
    color: subtle,
  });
  y -= 16;
  page.drawText('Subtotal', { x: 400, y, size: 10, font, color });
  page.drawText(fmtMoney(invoice.amount_cents), { x: 490, y, size: 10, font, color });
  y -= 14;
  page.drawText('Tax', { x: 400, y, size: 10, font, color });
  page.drawText(fmtMoney(invoice.tax_cents), { x: 490, y, size: 10, font, color });
  y -= 14;
  page.drawText('Total', { x: 400, y, size: 12, font: fontBold, color });
  page.drawText(fmtMoney(invoice.total_cents), { x: 490, y, size: 12, font: fontBold, color });

  if (invoice.notes) {
    page.drawText('Notes', { x: 40, y: 100, size: 9, font: fontBold, color: subtle });
    page.drawText(invoice.notes.slice(0, 400), {
      x: 40,
      y: 86,
      size: 9,
      font,
      color,
      maxWidth: 500,
    });
  }
  page.drawText('Thank you for your business.', {
    x: 40,
    y: 50,
    size: 9,
    font,
    color: subtle,
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
