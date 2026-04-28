import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type EstimatePdfPresentation = {
  estimate: Record<string, unknown>;
  lineItems: Record<string, unknown>[];
  branding: Record<string, unknown>;
};

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export async function buildEstimatePdfBytes(presentation: EstimatePdfPresentation): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const est = presentation.estimate as Record<string, unknown>;
  const branding = presentation.branding as Record<string, unknown>;

  const drawLine = (text: string, size: number, bold = false, color = rgb(0.12, 0.14, 0.18)) => {
    const f = bold ? fontBold : font;
    const lineH = size * 1.25;
    if (y < margin + lineH) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(truncate(text, 120), {
      x: margin,
      y: y - size,
      size,
      font: f,
      color,
    });
    y -= lineH;
  };

  drawLine(String(branding.companyName || 'Estimate'), 16, true);
  drawLine(`Estimate ${String(est.estimate_number)}`, 11);
  drawLine(String(est.title || ''), 13, true);
  y -= 6;
  drawLine(`Prepared for: ${String(est.customer_name_snapshot || '')}`, 10);
  if (est.service_address_snapshot) {
    drawLine(`Service location: ${String(est.service_address_snapshot)}`, 10);
  }
  if (est.expiration_date) {
    drawLine(`Valid through: ${String(est.expiration_date)}`, 10);
  }
  y -= 10;

  drawLine('Line items', 12, true);
  for (const li of presentation.lineItems) {
    const row = li as Record<string, unknown>;
    const og = row.option_group ? `[${String(row.option_group)}] ` : '';
    const name = `${og}${String(row.name)}`;
    const qty = Number(row.quantity);
    const total = money(Number(row.total_price_cents));
    drawLine(`• ${truncate(name, 80)}  ×${qty}  ${total}`, 9);
    if (row.description) {
      drawLine(`  ${truncate(String(row.description), 100)}`, 8, false, rgb(0.35, 0.38, 0.42));
    }
  }

  y -= 8;
  drawLine(`Subtotal: ${money(Number(est.subtotal_amount_cents))}`, 10);
  drawLine(`Discount: −${money(Number(est.discount_amount_cents))}`, 10);
  drawLine(`Tax: ${money(Number(est.tax_amount_cents))}`, 10);
  drawLine(`Total: ${money(Number(est.total_amount_cents))}`, 12, true);

  if (est.notes_customer) {
    y -= 12;
    drawLine('Notes', 11, true);
    for (const line of String(est.notes_customer).split('\n')) {
      if (line.trim()) drawLine(line, 9);
    }
  }

  if (branding.terms) {
    y -= 12;
    drawLine('Terms', 11, true);
    for (const line of String(branding.terms).split('\n')) {
      if (line.trim()) drawLine(line, 8, false, rgb(0.3, 0.32, 0.36));
    }
  }

  if (branding.footer) {
    y -= 14;
    drawLine(String(branding.footer), 8, false, rgb(0.45, 0.47, 0.5));
  }

  return doc.save();
}
