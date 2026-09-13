import { COMPANY } from '../../common/company';

export interface InvoiceTemplateData {
  number: string;
  orgName: string;
  amount: number;
  taxAmount: number;
  currency: string;
  status: string;
  dueDate?: Date | null;
  paidAt?: Date | null;
  lineItems?: { description: string; quantity: number; unitPrice: number }[];
}

/**
 * Plain-text invoice document used for the PDF/email invoice template.
 * The company name, email and phone MUST appear on every generated invoice
 * (spec Section 27, "Invoice / PDF template" row).
 */
export function renderInvoice(invoice: InvoiceTemplateData): string {
  const fmt = (n: number) => `${invoice.currency} ${n.toFixed(2)}`;
  const lines: string[] = [];

  lines.push('='.repeat(64));
  lines.push(`${COMPANY.name} — INVOICE`);
  lines.push('='.repeat(64));
  lines.push(`${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}`);
  lines.push('');
  lines.push(`Invoice:  ${invoice.number}`);
  lines.push(`Billed to: ${invoice.orgName}`);
  lines.push(`Status:   ${invoice.status}`);
  if (invoice.dueDate) lines.push(`Due:      ${new Date(invoice.dueDate).toLocaleDateString()}`);
  if (invoice.paidAt) lines.push(`Paid:     ${new Date(invoice.paidAt).toLocaleDateString()}`);
  lines.push('-'.repeat(64));
  lines.push('Items');
  lines.push('-'.repeat(64));
  for (const item of invoice.lineItems ?? []) {
    const line = `${item.description} x${item.quantity}`;
    const amount = fmt(item.quantity * item.unitPrice);
    lines.push(`${line.padEnd(44, '.')} ${amount}`);
  }
  if (!invoice.lineItems || invoice.lineItems.length === 0) {
    lines.push(`Services rendered${'.'.padEnd(43, '.')} ${fmt(invoice.amount)}`);
  }
  lines.push('-'.repeat(64));
  lines.push(`${'Subtotal'.padEnd(48, '.')} ${fmt(invoice.amount)}`);
  lines.push(`${'Tax'.padEnd(48, '.')} ${fmt(invoice.taxAmount)}`);
  lines.push(`${'TOTAL'.padEnd(48, '.')} ${fmt(invoice.amount + invoice.taxAmount)}`);
  lines.push('='.repeat(64));
  lines.push(`Questions about this invoice? ${COMPANY.email} · ${COMPANY.phone}`);
  lines.push(`Thank you for building with ${COMPANY.name}.`);

  return lines.join('\n');
}
