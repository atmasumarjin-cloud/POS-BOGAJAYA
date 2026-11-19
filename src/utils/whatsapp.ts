import { formatIDR, type PosTransactionRecord } from './accounting';

export function normalizeIndonesianPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function buildWhatsAppReceiptMessage(tx: PosTransactionRecord): string {
  const dateStr = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(tx.createdAtIso));

  const lines = tx.items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.name} (${item.qty}x @ ${formatIDR(item.unitPrice)}) = ${formatIDR(item.lineTotal)}`
    )
    .join('\n');

  return [
    `*TOKO BOGAJAYA SURABAYA*`,
    `Pusat Oleh-Oleh Khas Surabaya Sejak 1976`,
    `Cabang: ${tx.branch}`,
    `--------------------------------`,
    `No. Struk: *${tx.invoiceNo}*`,
    `Tanggal: ${dateStr}`,
    `Pelanggan: ${tx.customerName}`,
    `Pembayaran: ${tx.paymentMethod}`,
    `--------------------------------`,
    lines,
    `--------------------------------`,
    `Subtotal: ${formatIDR(tx.subtotal)}`,
    tx.discount > 0 ? `Diskon: -${formatIDR(tx.discount)}` : null,
    tx.taxAmount > 0 ? `PPN: ${formatIDR(tx.taxAmount)}` : null,
    `*TOTAL: ${formatIDR(tx.total)}*`,
    `Bayar (${tx.paymentMethod}): ${formatIDR(tx.cashReceived)}`,
    `Kembali: ${formatIDR(tx.changeAmount)}`,
    `--------------------------------`,
    `Terima kasih telah berbelanja di BOGAJAYA!`,
    `CS WhatsApp: 0858-1689-4196 | www.tokobogajaya.com`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeIndonesianPhone(phone);
  const encoded = encodeURIComponent(message);
  if (!normalized) {
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${normalized}?text=${encoded}`;
}
