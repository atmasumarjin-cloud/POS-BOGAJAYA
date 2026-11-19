import assert from 'node:assert/strict';
import test from 'node:test';
import { BOGAJAYA_INITIAL_CATALOG } from '../data/bogajayaCatalog.ts';
import {
  buildPurchaseInvoiceJournals,
  buildSaleJournals,
  buildSalesReturnJournals,
  calculateCheckoutTotals,
  calculateMonthlyDepreciation,
  calculateProfitAndLoss,
  calculateTrialBalance,
  findProductByBarcodeOrSku,
  type PurchaseInvoiceRecord,
} from './accounting.ts';
import { buildEscPosReceiptBytes } from './printer.ts';
import { buildWhatsAppReceiptMessage } from './whatsapp.ts';

test('BOGAJAYA catalog loaded all 128 authentic products with valid prices & images', () => {
  assert.equal(BOGAJAYA_INITIAL_CATALOG.length, 128);
  for (const p of BOGAJAYA_INITIAL_CATALOG) {
    assert.ok(p.name.length > 2);
    assert.ok(p.price >= 1000, `Unexpected low price for ${p.sku}: ${p.price}`);
    assert.ok(p.image.startsWith('/products/'));
    assert.equal(p.barcode.length, 13);
  }
});

test('barcode and SKU matching resolves exact product', () => {
  const sample = BOGAJAYA_INITIAL_CATALOG[0];
  assert.equal(findProductByBarcodeOrSku(BOGAJAYA_INITIAL_CATALOG, sample.barcode)?.id, sample.id);
  assert.equal(findProductByBarcodeOrSku(BOGAJAYA_INITIAL_CATALOG, sample.sku)?.id, sample.id);
  assert.equal(findProductByBarcodeOrSku(BOGAJAYA_INITIAL_CATALOG, '936')?.sku, '936');
});

test('cash checkout calculation computes subtotal, discount, PPN, COGS, and change accurately', () => {
  const p = BOGAJAYA_INITIAL_CATALOG[0];
  const totals = calculateCheckoutTotals(
    [{ product: p, quantity: 2, discountPerUnit: 0 }],
    5000,
    11,
    200000
  );
  const expectedBase = p.price * 2 - 5000;
  const expectedTax = Math.round(expectedBase * 0.11);
  assert.equal(totals.subtotal, p.price * 2);
  assert.equal(totals.taxAmount, expectedTax);
  assert.equal(totals.total, expectedBase + expectedTax);
  assert.equal(totals.changeAmount, 200000 - (expectedBase + expectedTax));
  assert.equal(totals.isCashSufficient, true);
});

test('Accurate double-entry journals, Trial Balance, AP Purchase, Depreciation, and Returns reconcile', () => {
  const p = BOGAJAYA_INITIAL_CATALOG[1];
  const tx = {
    id: 'tx-test-1',
    invoiceNo: 'BGJ-TEST-001',
    branch: 'Pusat Genteng' as const,
    customerName: 'Ibu Ratna',
    paymentMethod: 'Tunai' as const,
    subtotal: p.price * 2,
    discount: 0,
    taxAmount: 0,
    total: p.price * 2,
    totalCogs: p.costPrice * 2,
    cashReceived: 200000,
    changeAmount: 200000 - p.price * 2,
    itemCount: 2,
    itemsSummary: `${p.name} x2`,
    items: [],
    whatsappSent: false,
    status: 'completed' as const,
    createdAtIso: new Date().toISOString(),
  };

  const saleJournals = buildSaleJournals(tx);
  const po: PurchaseInvoiceRecord = {
    id: 'po-test-1',
    poNumber: 'PO-TEST-001',
    supplierName: 'Pabrik Kue Boyya',
    branch: 'Pusat Genteng',
    productId: p.id,
    sku: p.sku,
    productName: p.name,
    qty: 10,
    unitCost: p.costPrice,
    subtotal: p.costPrice * 10,
    taxPpnInput: Math.round(p.costPrice * 10 * 0.11),
    totalAmount: Math.round(p.costPrice * 10 * 1.11),
    paymentType: 'Kredit',
    status: 'belum_lunas',
    dueDateIso: new Date().toISOString(),
    createdAtIso: new Date().toISOString(),
  };
  const poJournals = buildPurchaseInvoiceJournals(po);
  const returnJournals = buildSalesReturnJournals(tx);

  const allJournals = [...saleJournals, ...poJournals, ...returnJournals];
  const tb = calculateTrialBalance(allJournals);
  assert.equal(tb.totalDebit, tb.totalCredit);

  const pnl = calculateProfitAndLoss([tx], [{ id: 'e1', category: 'Listrik', description: 'PLN', amount: 10000, branch: 'Pusat Genteng', createdAtIso: new Date().toISOString() }], allJournals, [po]);
  assert.equal(pnl.netSales, p.price * 2);
  assert.equal(pnl.taxInputPpn, po.taxPpnInput);
  assert.equal(pnl.grossProfit, p.price * 2 - p.costPrice * 2);

  const monthlyDep = calculateMonthlyDepreciation({
    id: 'ast-1',
    assetCode: 'AST-001',
    name: 'Freezer',
    category: 'Mesin Produksi',
    branch: 'Pusat Genteng',
    acquisitionDateIso: '2026-01-01T00:00:00.000Z',
    acquisitionCost: 12000000,
    salvageValue: 0,
    usefulLifeMonths: 48,
    accumulatedDepreciation: 0,
  });
  assert.equal(monthlyDep, 250000);
});

test('WhatsApp notification and Bluetooth ESC/POS receipt format cleanly', () => {
  const p = BOGAJAYA_INITIAL_CATALOG[0];
  const tx = {
    id: 'tx-test-2',
    invoiceNo: 'BGJ-WA-002',
    branch: 'Cabang Rungkut' as const,
    customerName: 'Bapak Arif',
    paymentMethod: 'Tunai' as const,
    subtotal: p.price,
    discount: 0,
    taxAmount: 0,
    total: p.price,
    totalCogs: p.costPrice,
    cashReceived: 100000,
    changeAmount: 100000 - p.price,
    itemCount: 1,
    itemsSummary: `${p.name} x1`,
    items: [
      {
        productId: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        qty: 1,
        unitPrice: p.price,
        unitCost: p.costPrice,
        lineTotal: p.price,
      },
    ],
    whatsappSent: false,
    status: 'completed' as const,
    createdAtIso: '2026-11-18T10:00:00.000Z',
  };

  const msg = buildWhatsAppReceiptMessage(tx);
  assert.ok(msg.includes('BGJ-WA-002'));
  assert.ok(msg.includes(p.name));

  const bytes = buildEscPosReceiptBytes(tx, '58mm');
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 80);
});
