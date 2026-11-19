import { BOGAJAYA_INITIAL_CATALOG } from './bogajayaCatalog';
import {
  buildPurchaseInvoiceJournals,
  buildSaleJournals,
  type AccurateJournalEntry,
  type FixedAssetRecord,
  type OperatingExpense,
  type PosTransactionRecord,
  type PurchaseInvoiceRecord,
  type StockMovementRecord,
} from '../utils/accounting';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: 'Reguler' | 'Silver' | 'Gold' | 'VIP';
  points: number;
  totalSpent: number;
  visitCount: number;
  address: string;
  notes: string;
}

export interface StoreBranch {
  id: string;
  name: 'Pusat Genteng' | 'Cabang Rungkut' | 'Gudang Sidoarjo';
  address: string;
  phone: string;
  lat: number;
  lng: number;
  hours: string;
  manager: string;
}

export const BOGAJAYA_BRANCHES: StoreBranch[] = [
  {
    id: 'branch-genteng',
    name: 'Pusat Genteng',
    address: 'Jl. Genteng Besar No. 69, Genteng, Kec. Genteng, Surabaya, Jawa Timur 60275',
    phone: '0858-1689-4196',
    lat: -7.2591,
    lng: 112.7418,
    hours: '07.00 - 21.30 WIB',
    manager: 'Rania Kusuma',
  },
  {
    id: 'branch-rungkut',
    name: 'Cabang Rungkut',
    address: 'Jl. Raya Rungkut Madya No. 112, Rungkut Kidul, Surabaya, Jawa Timur 60293',
    phone: '0822-3071-3138',
    lat: -7.3315,
    lng: 112.7798,
    hours: '08.00 - 21.00 WIB',
    manager: 'Indah Permata',
  },
  {
    id: 'branch-sidoarjo',
    name: 'Gudang Sidoarjo',
    address: 'Jl. Raya Bandara Juanda KM 4, Gedangan, Kab. Sidoarjo, Jawa Timur 61254',
    phone: '031-8554-1976',
    lat: -7.3765,
    lng: 112.7623,
    hours: '07.30 - 18.00 WIB',
    manager: 'Hendra Wijaya',
  },
];

export const INITIAL_CUSTOMERS: CustomerRecord[] = [
  {
    id: 'cust-umum',
    name: 'Pelanggan Umum (Walk-In)',
    phone: '',
    email: '',
    tier: 'Reguler',
    points: 0,
    totalSpent: 0,
    visitCount: 0,
    address: 'Surabaya',
    notes: 'Transaksi tunai cepat tanpa member',
  },
  {
    id: 'cust-1',
    name: 'Ibu Ratna Dewi',
    phone: '081234567801',
    email: 'ratna.dewi@surabayacorp.id',
    tier: 'VIP',
    points: 1850,
    totalSpent: 4650000,
    visitCount: 14,
    address: 'Jl. Darmo Permai Selatan No. 28, Surabaya',
    notes: 'Langganan paket oleh-oleh instansi & Sambal Cakalang',
  },
  {
    id: 'cust-2',
    name: 'Bapak Arif Nugroho',
    phone: '085712349988',
    email: 'arif.nugroho@gmail.com',
    tier: 'Gold',
    points: 920,
    totalSpent: 2150000,
    visitCount: 8,
    address: 'Perumahan Citraland Cluster North Emerald Blok C-12, Surabaya',
    notes: 'Favorit Kue Blinjo Boyya 500g & Almond Crispy',
  },
  {
    id: 'cust-3',
    name: 'Sari Wulandari (PT Pelindo)',
    phone: '081330112244',
    email: 'sari.w@pelindo-sby.co.id',
    tier: 'Silver',
    points: 430,
    totalSpent: 980000,
    visitCount: 4,
    address: 'Jl. Perak Timur No. 610, Surabaya',
    notes: 'Pesan hampers kantor bulanan (Tempo 14 Hari)',
  },
];

const p0 = BOGAJAYA_INITIAL_CATALOG[0];
const p1 = BOGAJAYA_INITIAL_CATALOG[1];
const p2 = BOGAJAYA_INITIAL_CATALOG[2];
const p5 = BOGAJAYA_INITIAL_CATALOG[5] || BOGAJAYA_INITIAL_CATALOG[0];
const p10 = BOGAJAYA_INITIAL_CATALOG[10] || BOGAJAYA_INITIAL_CATALOG[1];

export const INITIAL_TRANSACTIONS: PosTransactionRecord[] = [
  {
    id: 'tx-seed-1',
    invoiceNo: 'BGJ-202609-001',
    branch: 'Pusat Genteng',
    customerId: 'cust-1',
    customerName: 'Ibu Ratna Dewi',
    customerPhone: '081234567801',
    paymentMethod: 'Tunai',
    subtotal: p0.price * 4 + p1.price * 2,
    discount: 0,
    taxAmount: 0,
    total: p0.price * 4 + p1.price * 2,
    totalCogs: p0.costPrice * 4 + p1.costPrice * 2,
    cashReceived: 350000,
    changeAmount: 350000 - (p0.price * 4 + p1.price * 2),
    paidAmount: p0.price * 4 + p1.price * 2,
    receivableStatus: 'lunas',
    itemCount: 6,
    itemsSummary: `${p0.name} x4, ${p1.name} x2`,
    items: [
      { productId: p0.id, sku: p0.sku, barcode: p0.barcode, name: p0.name, qty: 4, unitPrice: p0.price, unitCost: p0.costPrice, lineTotal: p0.price * 4 },
      { productId: p1.id, sku: p1.sku, barcode: p1.barcode, name: p1.name, qty: 2, unitPrice: p1.price, unitCost: p1.costPrice, lineTotal: p1.price * 2 },
    ],
    whatsappSent: true,
    status: 'completed',
    createdAtIso: '2026-09-14T10:15:00.000Z',
  },
  {
    id: 'tx-seed-2',
    invoiceNo: 'BGJ-202610-002',
    branch: 'Cabang Rungkut',
    customerId: 'cust-2',
    customerName: 'Bapak Arif Nugroho',
    customerPhone: '085712349988',
    paymentMethod: 'Tunai',
    subtotal: p2.price * 5 + p5.price * 3,
    discount: 10000,
    taxAmount: 0,
    total: p2.price * 5 + p5.price * 3 - 10000,
    totalCogs: p2.costPrice * 5 + p5.costPrice * 3,
    cashReceived: 500000,
    changeAmount: 500000 - (p2.price * 5 + p5.price * 3 - 10000),
    paidAmount: p2.price * 5 + p5.price * 3 - 10000,
    receivableStatus: 'lunas',
    itemCount: 8,
    itemsSummary: `${p2.name} x5, ${p5.name} x3`,
    items: [
      { productId: p2.id, sku: p2.sku, barcode: p2.barcode, name: p2.name, qty: 5, unitPrice: p2.price, unitCost: p2.costPrice, lineTotal: p2.price * 5 },
      { productId: p5.id, sku: p5.sku, barcode: p5.barcode, name: p5.name, qty: 3, unitPrice: p5.price, unitCost: p5.costPrice, lineTotal: p5.price * 3 },
    ],
    whatsappSent: true,
    status: 'completed',
    createdAtIso: '2026-10-21T14:30:00.000Z',
  },
  {
    id: 'tx-seed-3',
    invoiceNo: 'BGJ-202611-003',
    branch: 'Pusat Genteng',
    customerId: 'cust-3',
    customerName: 'Sari Wulandari (PT Pelindo)',
    customerPhone: '081330112244',
    paymentMethod: 'Piutang / Tempo',
    subtotal: p10.price * 4 + p2.price * 2,
    discount: 0,
    taxAmount: 0,
    total: p10.price * 4 + p2.price * 2,
    totalCogs: p10.costPrice * 4 + p2.costPrice * 2,
    cashReceived: 0,
    changeAmount: 0,
    paidAmount: 0,
    receivableStatus: 'belum_lunas',
    dueDateIso: '2026-12-02T00:00:00.000Z',
    itemCount: 6,
    itemsSummary: `${p10.name} x4, ${p2.name} x2`,
    items: [
      { productId: p10.id, sku: p10.sku, barcode: p10.barcode, name: p10.name, qty: 4, unitPrice: p10.price, unitCost: p10.costPrice, lineTotal: p10.price * 4 },
      { productId: p2.id, sku: p2.sku, barcode: p2.barcode, name: p2.name, qty: 2, unitPrice: p2.price, unitCost: p2.costPrice, lineTotal: p2.price * 2 },
    ],
    whatsappSent: true,
    status: 'completed',
    createdAtIso: '2026-11-16T09:45:00.000Z',
  },
];

export const INITIAL_EXPENSES: OperatingExpense[] = [
  {
    id: 'exp-1',
    category: 'Gaji Karyawan & Kasir',
    description: 'Gaji Tim Toko Genteng & Rungkut',
    amount: 45000,
    branch: 'Pusat Genteng',
    createdAtIso: '2026-09-25T10:00:00.000Z',
  },
  {
    id: 'exp-2',
    category: 'Kemasan & Bubble Wrap',
    description: 'Pembelian kardus fragile & bubble wrap gratis',
    amount: 35000,
    branch: 'Cabang Rungkut',
    createdAtIso: '2026-10-15T11:00:00.000Z',
  },
  {
    id: 'exp-3',
    category: 'Listrik & Operasional Toko',
    description: 'Tagihan PLN & Wi-Fi Kasir Cloud',
    amount: 40000,
    branch: 'Pusat Genteng',
    createdAtIso: '2026-11-10T10:00:00.000Z',
  },
];

export const INITIAL_PURCHASES: PurchaseInvoiceRecord[] = [
  {
    id: 'po-seed-1',
    poNumber: 'PO-BGJ-2611-01',
    supplierName: 'UD Sumber Blinjo Sidoarjo',
    branch: 'Gudang Sidoarjo',
    productId: p2.id,
    sku: p2.sku,
    productName: p2.name,
    qty: 25,
    unitCost: p2.costPrice,
    subtotal: p2.costPrice * 25,
    taxPpnInput: 0,
    totalAmount: p2.costPrice * 25,
    paymentType: 'Kredit',
    status: 'belum_lunas',
    dueDateIso: '2026-11-30T00:00:00.000Z',
    createdAtIso: '2026-11-15T08:00:00.000Z',
  },
];

export const INITIAL_FIXED_ASSETS: FixedAssetRecord[] = [
  {
    id: 'ast-1',
    assetCode: 'FA-GT-001',
    name: 'Etalase Kaca & Rak Display Jati Genteng',
    category: 'Peralatan Toko',
    branch: 'Pusat Genteng',
    acquisitionDateIso: '2025-01-10T00:00:00.000Z',
    acquisitionCost: 18000000,
    salvageValue: 2000000,
    usefulLifeMonths: 60,
    accumulatedDepreciation: 2666670,
    lastDepreciatedMonth: '2026-10',
  },
  {
    id: 'ast-2',
    assetCode: 'FA-SD-002',
    name: 'Chest Freezer & Vacuum Sealer Bandeng Asap',
    category: 'Mesin Produksi',
    branch: 'Gudang Sidoarjo',
    acquisitionDateIso: '2025-06-01T00:00:00.000Z',
    acquisitionCost: 12000000,
    salvageValue: 1200000,
    usefulLifeMonths: 48,
    accumulatedDepreciation: 1125000,
    lastDepreciatedMonth: '2026-10',
  },
  {
    id: 'ast-3',
    assetCode: 'FA-RK-003',
    name: 'Set Tablet Kasir + Scanner 2D & Printer BLE',
    category: 'Elektronik & Kasir',
    branch: 'Cabang Rungkut',
    acquisitionDateIso: '2026-01-15T00:00:00.000Z',
    acquisitionCost: 6500000,
    salvageValue: 500000,
    usefulLifeMonths: 36,
    accumulatedDepreciation: 666668,
    lastDepreciatedMonth: '2026-10',
  },
];

export const INITIAL_JOURNALS: AccurateJournalEntry[] = [
  {
    id: 'j-open-cap',
    journalNo: 'JV-OPEN-001',
    sourceType: 'ADJUSTMENT',
    referenceNo: 'MODAL-AWAL',
    description: 'Setoran Modal Awal Operasional & Persediaan Toko Bogajaya',
    debitAccount: '1101 - Kas Kasir Tunai',
    creditAccount: '3101 - Modal Pemilik Bogajaya',
    amount: 5000000,
    branch: 'Pusat Genteng',
    createdAtIso: '2026-09-01T08:00:00.000Z',
  },
  ...INITIAL_TRANSACTIONS.flatMap(buildSaleJournals),
  ...INITIAL_PURCHASES.flatMap(buildPurchaseInvoiceJournals),
  ...INITIAL_EXPENSES.map((e, idx) => ({
    id: `j-exp-${idx + 1}`,
    journalNo: `JV-EXP-00${idx + 1}`,
    sourceType: 'EXPENSE' as const,
    referenceNo: e.id.toUpperCase(),
    description: `${e.category}: ${e.description}`,
    debitAccount: '6101 - Beban Operasional Toko',
    creditAccount: '1101 - Kas Kasir Tunai',
    amount: e.amount,
    branch: e.branch,
    createdAtIso: e.createdAtIso,
  })),
];

export const INITIAL_STOCK_MOVEMENTS: StockMovementRecord[] = [
  {
    id: 'mov-seed-1',
    productId: p0.id,
    sku: p0.sku,
    productName: p0.name,
    movementType: 'IN',
    warehouse: 'Pusat Genteng',
    quantityDelta: 20,
    unitCost: p0.costPrice,
    note: 'Penerimaan batch produksi harian',
    createdAtIso: '2026-11-15T07:30:00.000Z',
  },
  {
    id: 'mov-seed-2',
    productId: p2.id,
    sku: p2.sku,
    productName: p2.name,
    movementType: 'TRANSFER',
    warehouse: 'Cabang Rungkut',
    quantityDelta: 15,
    unitCost: p2.costPrice,
    note: 'Mutasi stok dari Gudang Sidoarjo ke Cabang Rungkut',
    createdAtIso: '2026-11-17T08:15:00.000Z',
  },
];
