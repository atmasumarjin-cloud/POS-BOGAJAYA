import type { BogajayaProduct } from '../data/bogajayaCatalog';

export type BranchName = 'Pusat Genteng' | 'Cabang Rungkut' | 'Gudang Sidoarjo';
export type PaymentMethod = 'Tunai' | 'QRIS' | 'Transfer Bank' | 'Piutang / Tempo';
export type CostingMethod = 'FIFO' | 'AVERAGE';

export interface CartItem {
  product: BogajayaProduct;
  quantity: number;
  discountPerUnit: number;
}

export interface HeldOrderRecord {
  id: string;
  label: string;
  customerId: string;
  items: CartItem[];
  orderDiscount: number;
  createdAtIso: string;
}

export interface PosTransactionRecord {
  id: string;
  invoiceNo: string;
  branch: BranchName;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  totalCogs: number;
  cashReceived: number;
  changeAmount: number;
  paidAmount?: number;
  receivableStatus?: 'lunas' | 'belum_lunas';
  dueDateIso?: string;
  itemCount: number;
  itemsSummary: string;
  items: Array<{
    productId: string;
    sku: string;
    barcode: string;
    name: string;
    qty: number;
    unitPrice: number;
    unitCost: number;
    lineTotal: number;
  }>;
  whatsappSent: boolean;
  status: 'completed' | 'voided';
  createdAtIso: string;
}

export interface PurchaseInvoiceRecord {
  id: string;
  poNumber: string;
  supplierName: string;
  branch: BranchName;
  productId: string;
  sku: string;
  productName: string;
  qty: number;
  unitCost: number;
  subtotal: number;
  taxPpnInput: number;
  totalAmount: number;
  paymentType: 'Tunai' | 'Kredit';
  status: 'lunas' | 'belum_lunas';
  dueDateIso: string;
  createdAtIso: string;
}

export interface FixedAssetRecord {
  id: string;
  assetCode: string;
  name: string;
  category: 'Peralatan Toko' | 'Mesin Produksi' | 'Elektronik & Kasir' | 'Kendaraan';
  branch: BranchName;
  acquisitionDateIso: string;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  accumulatedDepreciation: number;
  lastDepreciatedMonth?: string;
}

export interface AccurateJournalEntry {
  id: string;
  journalNo: string;
  sourceType:
    | 'POS_SALE'
    | 'RESTOCK'
    | 'PURCHASE'
    | 'PAYMENT_AP'
    | 'PAYMENT_AR'
    | 'EXPENSE'
    | 'DEPRECIATION'
    | 'TAX_PAYMENT'
    | 'ADJUSTMENT'
    | 'SALES_RETURN';
  referenceNo: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  branch: BranchName;
  createdAtIso: string;
}

export interface StockMovementRecord {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  movementType: 'IN' | 'OUT' | 'TRANSFER' | 'OPNAME' | 'RETURN';
  warehouse: BranchName;
  quantityDelta: number;
  unitCost: number;
  note: string;
  createdAtIso: string;
}

export interface OperatingExpense {
  id: string;
  category: string;
  description: string;
  amount: number;
  branch: BranchName;
  createdAtIso: string;
}

export interface ProfitAndLossSummary {
  grossRevenue: number;
  totalDiscount: number;
  netSales: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  depreciationExpenses: number;
  ebitda: number;
  taxCollectedPpn: number;
  taxInputPpn: number;
  estimatedPphFinal: number;
  netProfit: number;
  netMarginPct: number;
  transactionCount: number;
}

export interface MonthlySalesRow {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  transactions: number;
  itemsSold: number;
}

export interface TrialBalanceRow {
  account: string;
  category: 'Aset' | 'Kewajiban' | 'Ekuitas' | 'Pendapatan' | 'HPP & Beban';
  debit: number;
  credit: number;
  netBalance: number;
}

export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function getBranchStock(product: BogajayaProduct, branch: BranchName): number {
  if (branch === 'Pusat Genteng') return product.stockPusat;
  if (branch === 'Cabang Rungkut') return product.stockRungkut;
  return product.stockSidoarjo;
}

export function getTotalStock(product: BogajayaProduct): number {
  return product.stockPusat + product.stockRungkut + product.stockSidoarjo;
}

export function findProductByBarcodeOrSku(
  products: BogajayaProduct[],
  code: string
): BogajayaProduct | undefined {
  const q = code.trim().toLowerCase();
  if (!q) return undefined;
  return (
    products.find((p) => p.barcode.toLowerCase() === q) ??
    products.find((p) => p.sku.toLowerCase() === q) ??
    products.find((p) => p.id.toLowerCase() === q)
  );
}

export function calculateCheckoutTotals(
  items: CartItem[],
  orderDiscount: number,
  taxRatePercent: number,
  cashReceived: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const itemDiscounts = items.reduce(
    (sum, item) => sum + item.discountPerUnit * item.quantity,
    0
  );
  const totalDiscount = Math.min(subtotal, Math.max(0, itemDiscounts + orderDiscount));
  const taxableBase = Math.max(0, subtotal - totalDiscount);
  const taxAmount = Math.round((taxableBase * Math.max(0, taxRatePercent)) / 100);
  const total = taxableBase + taxAmount;
  const totalCogs = items.reduce(
    (sum, item) => sum + item.product.costPrice * item.quantity,
    0
  );
  const changeAmount = Math.max(0, cashReceived - total);
  const isCashSufficient = cashReceived >= total;

  return {
    subtotal,
    totalDiscount,
    taxableBase,
    taxAmount,
    total,
    totalCogs,
    changeAmount,
    isCashSufficient,
  };
}

export function getPaymentAccount(method: PaymentMethod): string {
  if (method === 'Tunai') return '1101 - Kas Kasir Tunai';
  if (method === 'QRIS') return '1102 - Bank BCA (Settlement QRIS)';
  if (method === 'Transfer Bank') return '1103 - Bank Mandiri Operasional';
  return '1201 - Piutang Usaha Pelanggan';
}

export function buildSaleJournals(tx: PosTransactionRecord): AccurateJournalEntry[] {
  const debitAccount = getPaymentAccount(tx.paymentMethod);

  const entries: AccurateJournalEntry[] = [
    {
      id: `${tx.id}-j1`,
      journalNo: `JV-${tx.invoiceNo}-1`,
      sourceType: 'POS_SALE',
      referenceNo: tx.invoiceNo,
      description: `Penjualan POS ${tx.paymentMethod} (${tx.customerName})`,
      debitAccount,
      creditAccount: '4101 - Penjualan Barang Dagang',
      amount: tx.subtotal - tx.discount,
      branch: tx.branch,
      createdAtIso: tx.createdAtIso,
    },
    {
      id: `${tx.id}-j2`,
      journalNo: `JV-${tx.invoiceNo}-2`,
      sourceType: 'POS_SALE',
      referenceNo: tx.invoiceNo,
      description: `Pengakuan HPP & Pengurangan Stok Otomatis (${tx.itemCount} item)`,
      debitAccount: '5101 - Harga Pokok Penjualan (HPP)',
      creditAccount: '1301 - Persediaan Barang Dagang',
      amount: tx.totalCogs,
      branch: tx.branch,
      createdAtIso: tx.createdAtIso,
    },
  ];

  if (tx.taxAmount > 0) {
    entries.push({
      id: `${tx.id}-j3`,
      journalNo: `JV-${tx.invoiceNo}-3`,
      sourceType: 'TAX_PAYMENT',
      referenceNo: tx.invoiceNo,
      description: `PPN Keluaran atas transaksi ${tx.invoiceNo}`,
      debitAccount,
      creditAccount: '2102 - Hutang PPN Keluaran',
      amount: tx.taxAmount,
      branch: tx.branch,
      createdAtIso: tx.createdAtIso,
    });
  }

  return entries;
}

export function buildSalesReturnJournals(tx: PosTransactionRecord): AccurateJournalEntry[] {
  const creditAccount = getPaymentAccount(tx.paymentMethod);
  const netSale = Math.max(0, tx.subtotal - tx.discount);
  const entries: AccurateJournalEntry[] = [
    {
      id: `${tx.id}-ret-1`,
      journalNo: `JV-RET-${tx.invoiceNo}-1`,
      sourceType: 'SALES_RETURN',
      referenceNo: tx.invoiceNo,
      description: `Retur Penjualan ${tx.invoiceNo} (${tx.customerName})`,
      debitAccount: '4102 - Retur & Potongan Penjualan',
      creditAccount,
      amount: netSale,
      branch: tx.branch,
      createdAtIso: new Date().toISOString(),
    },
    {
      id: `${tx.id}-ret-2`,
      journalNo: `JV-RET-${tx.invoiceNo}-2`,
      sourceType: 'SALES_RETURN',
      referenceNo: tx.invoiceNo,
      description: `Pemulihan Persediaan atas Retur ${tx.invoiceNo}`,
      debitAccount: '1301 - Persediaan Barang Dagang',
      creditAccount: '5101 - Harga Pokok Penjualan (HPP)',
      amount: tx.totalCogs,
      branch: tx.branch,
      createdAtIso: new Date().toISOString(),
    },
  ];
  if (tx.taxAmount > 0) {
    entries.push({
      id: `${tx.id}-ret-3`,
      journalNo: `JV-RET-${tx.invoiceNo}-3`,
      sourceType: 'SALES_RETURN',
      referenceNo: tx.invoiceNo,
      description: `Pembalikan PPN Keluaran Retur ${tx.invoiceNo}`,
      debitAccount: '2102 - Hutang PPN Keluaran',
      creditAccount,
      amount: tx.taxAmount,
      branch: tx.branch,
      createdAtIso: new Date().toISOString(),
    });
  }
  return entries;
}

export function buildPurchaseInvoiceJournals(
  po: PurchaseInvoiceRecord
): AccurateJournalEntry[] {
  const creditAccount =
    po.paymentType === 'Tunai' ? '1101 - Kas Kasir Tunai' : '2101 - Hutang Usaha Supplier';
  const entries: AccurateJournalEntry[] = [
    {
      id: `${po.id}-j1`,
      journalNo: `JV-${po.poNumber}-1`,
      sourceType: 'PURCHASE',
      referenceNo: po.poNumber,
      description: `Pembelian Stok ${po.supplierName}: ${po.productName} (+${po.qty})`,
      debitAccount: '1301 - Persediaan Barang Dagang',
      creditAccount,
      amount: po.subtotal,
      branch: po.branch,
      createdAtIso: po.createdAtIso,
    },
  ];

  if (po.taxPpnInput > 0) {
    entries.push({
      id: `${po.id}-j2`,
      journalNo: `JV-${po.poNumber}-2`,
      sourceType: 'PURCHASE',
      referenceNo: po.poNumber,
      description: `PPN Masukan Faktur ${po.poNumber} (${po.supplierName})`,
      debitAccount: '1401 - PPN Masukan',
      creditAccount,
      amount: po.taxPpnInput,
      branch: po.branch,
      createdAtIso: po.createdAtIso,
    });
  }
  return entries;
}

export function buildRestockJournal(
  movement: StockMovementRecord,
  totalCost: number
): AccurateJournalEntry {
  return {
    id: `j-${movement.id}`,
    journalNo: `JV-STK-${movement.id.slice(-6).toUpperCase()}`,
    sourceType: 'RESTOCK',
    referenceNo: movement.sku,
    description: `Restok Gudang ${movement.warehouse}: ${movement.productName} (+${movement.quantityDelta})`,
    debitAccount: '1301 - Persediaan Barang Dagang',
    creditAccount: '2101 - Hutang Usaha Supplier',
    amount: totalCost,
    branch: movement.warehouse,
    createdAtIso: movement.createdAtIso,
  };
}

export function calculateMonthlyDepreciation(asset: FixedAssetRecord): number {
  const depreciable = Math.max(0, asset.acquisitionCost - asset.salvageValue);
  const remaining = Math.max(0, depreciable - asset.accumulatedDepreciation);
  if (remaining <= 0 || asset.usefulLifeMonths <= 0) return 0;
  const monthly = Math.round(depreciable / asset.usefulLifeMonths);
  return Math.min(remaining, monthly);
}

export function calculateProfitAndLoss(
  transactions: PosTransactionRecord[],
  expenses: OperatingExpense[],
  journals: AccurateJournalEntry[] = [],
  purchases: PurchaseInvoiceRecord[] = []
): ProfitAndLossSummary {
  const validTx = transactions.filter((t) => t.status === 'completed');
  const grossRevenue = validTx.reduce((sum, t) => sum + t.subtotal, 0);
  const totalDiscount = validTx.reduce((sum, t) => sum + t.discount, 0);
  const netSales = Math.max(0, grossRevenue - totalDiscount);
  const totalCogs = validTx.reduce((sum, t) => sum + t.totalCogs, 0);
  const grossProfit = netSales - totalCogs;
  const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const depreciationExpenses = journals
    .filter((j) => j.sourceType === 'DEPRECIATION')
    .reduce((sum, j) => sum + j.amount, 0);

  const ebitda = grossProfit - operatingExpenses;
  const taxCollectedPpn = validTx.reduce((sum, t) => sum + t.taxAmount, 0);
  const taxInputPpn = purchases.reduce((sum, p) => sum + p.taxPpnInput, 0);
  // UMKM Final PPh 0.5% of net sales
  const estimatedPphFinal = Math.round(netSales * 0.005);
  const netProfit = ebitda - depreciationExpenses - estimatedPphFinal;
  const netMarginPct = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  return {
    grossRevenue,
    totalDiscount,
    netSales,
    totalCogs,
    grossProfit,
    grossMarginPct,
    operatingExpenses,
    depreciationExpenses,
    ebitda,
    taxCollectedPpn,
    taxInputPpn,
    estimatedPphFinal,
    netProfit,
    netMarginPct,
    transactionCount: validTx.length,
  };
}

export function calculateMonthlySales(
  transactions: PosTransactionRecord[],
  expenses: OperatingExpense[]
): MonthlySalesRow[] {
  const buckets: Record<string, MonthlySalesRow> = {};
  const monthFormatter = new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: 'numeric',
  });

  for (const tx of transactions) {
    if (tx.status !== 'completed') continue;
    const d = new Date(tx.createdAtIso);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) {
      buckets[key] = {
        monthKey: key,
        monthLabel: monthFormatter.format(d),
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
        transactions: 0,
        itemsSold: 0,
      };
    }
    const netSale = tx.subtotal - tx.discount;
    buckets[key].revenue += netSale;
    buckets[key].cogs += tx.totalCogs;
    buckets[key].grossProfit += netSale - tx.totalCogs;
    buckets[key].transactions += 1;
    buckets[key].itemsSold += tx.itemCount;
  }

  for (const exp of expenses) {
    const d = new Date(exp.createdAtIso);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) {
      buckets[key] = {
        monthKey: key,
        monthLabel: monthFormatter.format(d),
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
        transactions: 0,
        itemsSold: 0,
      };
    }
    buckets[key].expenses += exp.amount;
  }

  return Object.values(buckets)
    .map((row) => ({
      ...row,
      netProfit: row.grossProfit - row.expenses - Math.round(row.revenue * 0.005),
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function calculateInventoryValuation(
  products: BogajayaProduct[],
  costingMethod: CostingMethod
) {
  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let lowStockCount = 0;

  for (const p of products) {
    const qty = getTotalStock(p);
    totalUnits += qty;
    const unitValuation =
      costingMethod === 'FIFO' ? p.costPrice : Math.round(p.costPrice * 0.985);
    totalCostValue += qty * unitValuation;
    totalRetailValue += qty * p.price;
    if (p.stockPusat <= p.minStock || p.stockRungkut <= 5) {
      lowStockCount++;
    }
  }

  return {
    totalUnits,
    totalCostValue,
    totalRetailValue,
    potentialGrossProfit: totalRetailValue - totalCostValue,
    lowStockCount,
  };
}

function classifyAccount(account: string): TrialBalanceRow['category'] {
  if (account.startsWith('1')) return 'Aset';
  if (account.startsWith('2')) return 'Kewajiban';
  if (account.startsWith('3')) return 'Ekuitas';
  if (account.startsWith('4')) return 'Pendapatan';
  return 'HPP & Beban';
}

export function calculateTrialBalance(journals: AccurateJournalEntry[]): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
} {
  const map: Record<string, { debit: number; credit: number }> = {};

  for (const j of journals) {
    if (!map[j.debitAccount]) map[j.debitAccount] = { debit: 0, credit: 0 };
    if (!map[j.creditAccount]) map[j.creditAccount] = { debit: 0, credit: 0 };
    map[j.debitAccount].debit += j.amount;
    map[j.creditAccount].credit += j.amount;
  }

  const rows: TrialBalanceRow[] = Object.entries(map)
    .map(([account, vals]) => {
      const category = classifyAccount(account);
      const isDebitNormal = category === 'Aset' || category === 'HPP & Beban';
      return {
        account,
        category,
        debit: vals.debit,
        credit: vals.credit,
        netBalance: isDebitNormal ? vals.debit - vals.credit : vals.credit - vals.debit,
      };
    })
    .sort((a, b) => a.account.localeCompare(b.account));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { rows, totalDebit, totalCredit };
}
