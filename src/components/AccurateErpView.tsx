import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  calculateMonthlyDepreciation,
  formatIDR,
  type BranchName,
  type FixedAssetRecord,
} from '../utils/accounting';
import { hasPermission } from '../utils/rbac';

type AccurateTab =
  | 'pnl'
  | 'sales_ar'
  | 'purchases_ap'
  | 'assets'
  | 'monthly'
  | 'ledger'
  | 'tax_branch';

const ACCURATE_TABS: Array<{ id: AccurateTab; label: string }> = [
  { id: 'pnl', label: 'Laba Rugi' },
  { id: 'sales_ar', label: 'Penjualan & Piutang' },
  { id: 'purchases_ap', label: 'Pembelian & Hutang' },
  { id: 'assets', label: 'Aset Tetap' },
  { id: 'monthly', label: 'Laporan Bulanan' },
  { id: 'ledger', label: 'Buku Besar & Neraca' },
  { id: 'tax_branch', label: 'Kas, Pajak & Cabang' },
];

export function AccurateErpView() {
  const {
    products,
    pnl,
    monthlySales,
    journals,
    transactions,
    expenses,
    purchases,
    fixedAssets,
    inventoryValuation,
    trialBalance,
    settings,
    recordExpense,
    createPurchaseInvoice,
    settlePurchaseInvoice,
    settleReceivable,
    voidOrReturnSale,
    addFixedAsset,
    runMonthlyDepreciation,
    currentOperator,
  } = useStore();

  const canViewPnl = hasPermission(currentOperator, 'accurate_pnl');
  const canManageApAssets = hasPermission(currentOperator, 'accurate_pembelian_aset');
  const canReturnSale = hasPermission(currentOperator, 'pos_diskon_retur');

  const allowedAccurateTabs = ACCURATE_TABS.filter((t) => {
    if (t.id === 'purchases_ap' || t.id === 'assets') return canManageApAssets;
    return canViewPnl;
  });

  const [tab, setTab] = useState<AccurateTab>(() => allowedAccurateTabs[0]?.id || 'pnl');

  // Expense form state
  const [expCategory, setExpCategory] = useState('Listrik & Operasional Toko');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expBranch, setExpBranch] = useState<BranchName>(settings.activeBranch);
  const [expFeedback, setExpFeedback] = useState<string | null>(null);

  // Purchase Invoice form state
  const [poSupplier, setPoSupplier] = useState('UD Sumber Blinjo Sidoarjo');
  const [poBranch, setPoBranch] = useState<BranchName>(settings.activeBranch);
  const [poProductId, setPoProductId] = useState(() => products[0]?.id || '');
  const [poQty, setPoQty] = useState('20');
  const [poUnitCost, setPoUnitCost] = useState(() => String(products[0]?.costPrice || 25000));
  const [poIncludePpn, setPoIncludePpn] = useState(false);
  const [poPaymentType, setPoPaymentType] = useState<'Tunai' | 'Kredit'>('Kredit');
  const [poFeedback, setPoFeedback] = useState<string | null>(null);

  // Fixed Asset form state
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] =
    useState<FixedAssetRecord['category']>('Peralatan Toko');
  const [assetBranch, setAssetBranch] = useState<BranchName>(settings.activeBranch);
  const [assetCost, setAssetCost] = useState('');
  const [assetSalvage, setAssetSalvage] = useState('0');
  const [assetMonths, setAssetMonths] = useState('48');
  const [assetFeedback, setAssetFeedback] = useState<string | null>(null);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount);
    if (!expDesc.trim() || !Number.isFinite(amt) || amt <= 0) {
      setExpFeedback('Isi deskripsi dan nominal beban dengan benar.');
      return;
    }
    await recordExpense({
      category: expCategory,
      description: expDesc.trim(),
      amount: amt,
      branch: expBranch,
    });
    setExpDesc('');
    setExpAmount('');
    setExpFeedback('Beban dicatat & otomatis diposting ke Jurnal Umum dan Laba Rugi.');
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.id === poProductId);
    const qty = Number(poQty);
    const cost = Number(poUnitCost);
    if (!product || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost <= 0) {
      setPoFeedback('Pilih produk serta isi qty dan harga beli satuan dengan benar.');
      return;
    }
    const po = await createPurchaseInvoice({
      supplierName: poSupplier,
      branch: poBranch,
      product,
      qty,
      unitCost: cost,
      includePpn: poIncludePpn,
      paymentType: poPaymentType,
    });
    setPoFeedback(
      `Faktur ${po.poNumber} tersimpan. Stok ${po.branch} +${po.qty} & jurnal otomatis terbentuk.`
    );
  };

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(assetCost);
    const salvage = Math.max(0, Number(assetSalvage) || 0);
    const months = Math.max(1, Number(assetMonths) || 48);
    if (!assetName.trim() || !Number.isFinite(cost) || cost <= 0) {
      setAssetFeedback('Isi nama aset dan harga perolehan.');
      return;
    }
    addFixedAsset({
      name: assetName,
      category: assetCategory,
      branch: assetBranch,
      acquisitionCost: cost,
      salvageValue: salvage,
      usefulLifeMonths: months,
    });
    setAssetName('');
    setAssetCost('');
    setAssetSalvage('0');
    setAssetFeedback('Aset tetap terdaftar & jurnal perolehan otomatis diposting.');
  };

  const handleRunDepreciation = () => {
    const res = runMonthlyDepreciation();
    if (res.count === 0) {
      setAssetFeedback('Seluruh aset tetap sudah disusutkan untuk bulan berjalan.');
    } else {
      setAssetFeedback(
        `Penyusutan ${res.count} aset berhasil diposting (${formatIDR(res.totalDepreciation)}).`
      );
    }
  };

  const treasuryStats = useMemo(() => {
    const validTx = transactions.filter((t) => t.status === 'completed');
    const cashSales = validTx
      .filter((t) => t.paymentMethod === 'Tunai' || t.receivableStatus === 'lunas')
      .filter((t) => t.paymentMethod === 'Tunai')
      .reduce((s, t) => s + t.total, 0);
    const qrisSales = validTx
      .filter((t) => t.paymentMethod === 'QRIS')
      .reduce((s, t) => s + t.total, 0);
    const transferSales = validTx
      .filter((t) => t.paymentMethod === 'Transfer Bank')
      .reduce((s, t) => s + t.total, 0);
    const openReceivables = validTx
      .filter((t) => t.receivableStatus === 'belum_lunas')
      .reduce((s, t) => s + t.total, 0);
    const openPayables = purchases
      .filter((p) => p.status === 'belum_lunas')
      .reduce((s, p) => s + p.totalAmount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalAssetNetBook = fixedAssets.reduce(
      (s, a) => s + Math.max(0, a.acquisitionCost - a.accumulatedDepreciation),
      0
    );

    const byBranch = (['Pusat Genteng', 'Cabang Rungkut', 'Gudang Sidoarjo'] as BranchName[]).map(
      (b) => {
        const bTx = validTx.filter((t) => t.branch === b);
        const rev = bTx.reduce((s, t) => s + (t.subtotal - t.discount), 0);
        const cogs = bTx.reduce((s, t) => s + t.totalCogs, 0);
        const exp = expenses.filter((e) => e.branch === b).reduce((s, e) => s + e.amount, 0);
        return {
          branch: b,
          txCount: bTx.length,
          revenue: rev,
          grossProfit: rev - cogs,
          netProfit: rev - cogs - exp,
        };
      }
    );

    return {
      cashBalance: Math.max(0, cashSales - totalExpenses),
      bcaSettlement: qrisSales,
      mandiriBalance: transferSales,
      openReceivables,
      openPayables,
      totalAssetNetBook,
      byBranch,
    };
  }, [transactions, expenses, purchases, fixedAssets]);

  const handleExportMonthlyCsv = () => {
    const header =
      'Bulan,Omzet Bersih,HPP,Laba Kotor,Beban Operasional,Laba Bersih,Transaksi,Item Terjual\n';
    const rows = monthlySales
      .map(
        (r) =>
          `"${r.monthLabel}",${r.revenue},${r.cogs},${r.grossProfit},${r.expenses},${r.netProfit},${r.transactions},${r.itemsSold}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bogajaya-laporan-penjualan-bulanan.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTaxCsv = () => {
    const header = 'Tipe,Nomor Referensi,Tanggal,Lawan Transaksi,DPP,PPN,Cabang\n';
    const salesRows = transactions
      .filter((t) => t.status === 'completed')
      .map(
        (t) =>
          `"PPN Keluaran","${t.invoiceNo}","${t.createdAtIso.slice(0, 10)}","${t.customerName}",${t.subtotal - t.discount},${t.taxAmount},"${t.branch}"`
      );
    const poRows = purchases.map(
      (p) =>
        `"PPN Masukan","${p.poNumber}","${p.createdAtIso.slice(0, 10)}","${p.supplierName}",${p.subtotal},${p.taxPpnInput},"${p.branch}"`
    );
    const blob = new Blob([header + [...salesRows, ...poRows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bogajaya-smart-link-tax-efaktur.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxMonthlyVal = Math.max(
    1,
    ...monthlySales.map((m) => Math.max(m.revenue, m.netProfit, 100000))
  );

  return (
    <div className="space-y-5">
      {/* Header + Segmented Accurate Modules */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-stone-900">
              Accurate ERP &amp; Akuntansi Lengkap
            </h2>
            <p className="text-xs text-stone-500">
              Laba Rugi Real-Time, Penjualan &amp; Piutang, Pembelian &amp; Hutang Supplier, Aset Tetap, Buku Besar, Neraca &amp; Smart Link Tax
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg self-start sm:self-auto whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Neraca Seimbang ({journals.length} Jurnal)
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto max-w-full">
          {allowedAccurateTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === item.id
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="text-[11px] sm:text-xs text-stone-500">Penjualan Bersih</div>
          <div className="text-lg sm:text-2xl font-mono font-bold text-stone-900 tabular-nums truncate">
            {formatIDR(pnl.netSales)}
          </div>
          <div className="text-[11px] text-stone-500">{pnl.transactionCount} faktur selesai</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="text-[11px] sm:text-xs text-stone-500">Laba Bersih (Net Profit)</div>
          <div
            className={`text-lg sm:text-2xl font-mono font-bold tabular-nums truncate ${
              pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatIDR(pnl.netProfit)}
          </div>
          <div className="text-[11px] text-stone-500 tabular-nums">
            Margin: {pnl.netMarginPct.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="text-[11px] sm:text-xs text-stone-500">Piutang / Hutang Usaha</div>
          <div className="text-sm sm:text-base font-mono font-bold text-stone-900 tabular-nums truncate">
            Piutang: {formatIDR(treasuryStats.openReceivables)}
          </div>
          <div className="text-xs font-mono font-semibold text-red-800 tabular-nums truncate">
            Hutang: {formatIDR(treasuryStats.openPayables)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 sm:p-4 space-y-1">
          <div className="text-[11px] sm:text-xs text-stone-500">Nilai Persediaan &amp; Aset</div>
          <div className="text-lg sm:text-xl font-mono font-bold text-stone-900 tabular-nums truncate">
            {formatIDR(inventoryValuation.totalCostValue)}
          </div>
          <div className="text-[11px] text-stone-500 truncate">
            Aset Tetap: {formatIDR(treasuryStats.totalAssetNetBook)}
          </div>
        </div>
      </div>

      {/* TAB 1: Real-Time Profit & Loss Statement + Expense Form */}
      {tab === 'pnl' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                Laporan Laba Rugi (Profit &amp; Loss) — Real-Time
              </h3>
              <span className="text-xs font-mono text-stone-500">Mata Uang: IDR</span>
            </div>

            <div className="p-5 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-700">4101 · Pendapatan Penjualan Kotor</span>
                <span className="font-mono font-medium text-stone-900 tabular-nums">
                  {formatIDR(pnl.grossRevenue)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">4102 · Diskon &amp; Retur Penjualan</span>
                <span className="font-mono text-red-700 tabular-nums">
                  ({formatIDR(pnl.totalDiscount)})
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-200 font-semibold text-stone-900">
                <span>Total Penjualan Bersih</span>
                <span className="font-mono tabular-nums">{formatIDR(pnl.netSales)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">
                  5101 · Harga Pokok Penjualan (HPP / {settings.costingMethod})
                </span>
                <span className="font-mono text-red-700 tabular-nums">
                  ({formatIDR(pnl.totalCogs)})
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-stone-200 font-bold text-stone-900 bg-stone-50 px-3 rounded-lg">
                <span>Laba Kotor (Gross Profit · {pnl.grossMarginPct.toFixed(1)}%)</span>
                <span className="font-mono tabular-nums">{formatIDR(pnl.grossProfit)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">6101 · Beban Operasional Toko &amp; Kemasan</span>
                <span className="font-mono text-red-700 tabular-nums">
                  ({formatIDR(pnl.operatingExpenses)})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-700">Laba Operasional (EBITDA)</span>
                <span className="font-mono font-medium text-stone-900 tabular-nums">
                  {formatIDR(pnl.ebitda)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">6201 · Beban Penyusutan Aset Tetap</span>
                <span className="font-mono text-red-700 tabular-nums">
                  ({formatIDR(pnl.depreciationExpenses)})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-stone-100">
                <span className="text-stone-600">7101 · Estimasi PPh Final UMKM (0.5%)</span>
                <span className="font-mono text-red-700 tabular-nums">
                  ({formatIDR(pnl.estimatedPphFinal)})
                </span>
              </div>
              <div className="flex justify-between py-3 px-4 rounded-xl bg-stone-900 text-white font-bold text-sm sm:text-base mt-2">
                <span>Laba Bersih (Net Profit · {pnl.netMarginPct.toFixed(1)}%)</span>
                <span className="font-mono tabular-nums">{formatIDR(pnl.netProfit)}</span>
              </div>
            </div>
          </div>

          {/* Record Operating Expense */}
          <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <PlusCircle className="w-4 h-4 text-red-800" />
              <h3 className="text-sm font-bold text-stone-900">Catat Biaya Operasional</h3>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="exp-cat" className="font-medium text-stone-700 block">
                  Kategori Akun Beban
                </label>
                <select
                  id="exp-cat"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
                >
                  <option>Listrik &amp; Operasional Toko</option>
                  <option>Gaji Karyawan &amp; Kasir</option>
                  <option>Kemasan &amp; Bubble Wrap</option>
                  <option>Biaya Pengiriman / Kurir</option>
                  <option>Promosi &amp; Pemasaran</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="exp-branch" className="font-medium text-stone-700 block">
                  Cabang
                </label>
                <select
                  id="exp-branch"
                  value={expBranch}
                  onChange={(e) => setExpBranch(e.target.value as BranchName)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                >
                  <option value="Pusat Genteng">Pusat Genteng</option>
                  <option value="Cabang Rungkut">Cabang Rungkut</option>
                  <option value="Gudang Sidoarjo">Gudang Sidoarjo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="exp-desc" className="font-medium text-stone-700 block">
                  Keterangan
                </label>
                <input
                  id="exp-desc"
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Mis. Pembelian kertas struk thermal 58mm"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="exp-amt" className="font-medium text-stone-700 block">
                  Nominal (Rp)
                </label>
                <input
                  id="exp-amt"
                  type="number"
                  min={1000}
                  step={500}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                />
              </div>

              {expFeedback && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {expFeedback}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
              >
                Simpan &amp; Posting ke Jurnal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Penjualan, Retur & Piutang Usaha (AR) */}
      {tab === 'sales_ar' && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Faktur Penjualan, Pelunasan Piutang &amp; Retur Barang
              </h3>
              <p className="text-xs text-stone-500">
                Terima pembayaran piutang B2B/tempo atau proses retur penjualan dengan pemulihan stok otomatis
              </p>
            </div>
            <div className="text-xs font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
              Piutang Belum Lunas: {formatIDR(treasuryStats.openReceivables)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <th className="py-2.5 px-4">No. Faktur &amp; Tgl</th>
                  <th className="py-2.5 px-3">Pelanggan</th>
                  <th className="py-2.5 px-3">Pembayaran</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Tindakan Accurate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-stone-50">
                    <td className="py-2.5 px-4 font-mono whitespace-nowrap">
                      <div className="font-semibold text-stone-900">{tx.invoiceNo}</div>
                      <div className="text-[11px] text-stone-400">
                        {tx.createdAtIso.slice(0, 10)} · {tx.branch}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-stone-900">{tx.customerName}</div>
                      <div className="text-[11px] text-stone-500 truncate max-w-xs">
                        {tx.itemsSummary}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-stone-700">
                      {tx.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900 tabular-nums whitespace-nowrap">
                      {formatIDR(tx.total)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {tx.status === 'voided' ? (
                        <span className="text-[11px] font-semibold text-stone-500">Diretur / Void</span>
                      ) : tx.receivableStatus === 'belum_lunas' ? (
                        <span className="text-[11px] font-semibold text-amber-700">
                          Piutang Jatuh Tempo
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-700">Lunas</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {tx.status === 'completed' && tx.receivableStatus === 'belum_lunas' && (
                          <button
                            type="button"
                            onClick={() => settleReceivable(tx.id, 'Transfer Bank')}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                          >
                            Lunasi Piutang
                          </button>
                        )}
                        {tx.status === 'completed' && canReturnSale && (
                          <button
                            type="button"
                            onClick={() => voidOrReturnSale(tx.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retur
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Pembelian & Hutang Supplier (AP) */}
      {tab === 'purchases_ap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2.5">
              Buat Faktur Pembelian (PO Supplier)
            </h3>
            <form onSubmit={handleCreatePurchase} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="po-supplier" className="font-medium text-stone-700 block">
                  Nama Supplier / Pabrik
                </label>
                <input
                  id="po-supplier"
                  type="text"
                  value={poSupplier}
                  onChange={(e) => setPoSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="po-product" className="font-medium text-stone-700 block">
                  Produk Bogajaya
                </label>
                <select
                  id="po-product"
                  value={poProductId}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setPoProductId(e.target.value);
                    if (p) setPoUnitCost(String(p.costPrice));
                  }}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="po-qty" className="font-medium text-stone-700 block">
                    Qty Beli
                  </label>
                  <input
                    id="po-qty"
                    type="number"
                    min={1}
                    value={poQty}
                    onChange={(e) => setPoQty(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="po-cost" className="font-medium text-stone-700 block">
                    Harga Beli / Unit
                  </label>
                  <input
                    id="po-cost"
                    type="number"
                    min={500}
                    step={500}
                    value={poUnitCost}
                    onChange={(e) => setPoUnitCost(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="po-branch" className="font-medium text-stone-700 block">
                    Gudang Masuk
                  </label>
                  <select
                    id="po-branch"
                    value={poBranch}
                    onChange={(e) => setPoBranch(e.target.value as BranchName)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                  >
                    <option value="Pusat Genteng">Pusat Genteng</option>
                    <option value="Cabang Rungkut">Cabang Rungkut</option>
                    <option value="Gudang Sidoarjo">Gudang Sidoarjo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="po-term" className="font-medium text-stone-700 block">
                    Termin Pembayaran
                  </label>
                  <select
                    id="po-term"
                    value={poPaymentType}
                    onChange={(e) => setPoPaymentType(e.target.value as 'Tunai' | 'Kredit')}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                  >
                    <option value="Kredit">Kredit / Hutang (30 Hr)</option>
                    <option value="Tunai">Tunai Langsung</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={poIncludePpn}
                  onChange={(e) => setPoIncludePpn(e.target.checked)}
                  className="w-4 h-4 accent-red-800"
                />
                <span className="text-stone-700">Sertakan PPN Masukan 11% (Faktur Pajak)</span>
              </label>

              {poFeedback && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {poFeedback}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg"
              >
                Simpan Pembelian &amp; Tambah Stok
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                Daftar Faktur Pembelian &amp; Hutang Supplier
              </h3>
              <span className="text-xs font-mono font-semibold text-red-800">
                Sisa Hutang: {formatIDR(treasuryStats.openPayables)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-4">No. PO &amp; Supplier</th>
                    <th className="py-2.5 px-3">Produk</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Total Tagihan</th>
                    <th className="py-2.5 px-4 text-right">Status / Bayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {purchases.map((po) => (
                    <tr key={po.id} className="hover:bg-stone-50">
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-semibold text-stone-900">{po.poNumber}</div>
                        <div className="text-[11px] text-stone-500">{po.supplierName}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-stone-800">{po.productName}</div>
                        <div className="text-[11px] text-stone-400">{po.branch}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">+{po.qty}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900 tabular-nums">
                        {formatIDR(po.totalAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {po.status === 'lunas' ? (
                          <span className="text-[11px] font-semibold text-emerald-700">Lunas</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              settlePurchaseInvoice(po.id, '1103 - Bank Mandiri Operasional')
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-stone-900 hover:bg-red-800 rounded"
                          >
                            Lunasi Hutang
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Aset Tetap & Penyusutan Bulanan */}
      {tab === 'assets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2.5">
              Daftarkan Aset Tetap Toko
            </h3>
            <form onSubmit={handleAddAsset} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="ast-name" className="font-medium text-stone-700 block">
                  Nama Aset Tetap
                </label>
                <input
                  id="ast-name"
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Mis. Mobil Box Pengiriman Sidoarjo"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="ast-cat" className="font-medium text-stone-700 block">
                    Kategori
                  </label>
                  <select
                    id="ast-cat"
                    value={assetCategory}
                    onChange={(e) =>
                      setAssetCategory(e.target.value as FixedAssetRecord['category'])
                    }
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                  >
                    <option value="Peralatan Toko">Peralatan Toko</option>
                    <option value="Mesin Produksi">Mesin Produksi</option>
                    <option value="Elektronik & Kasir">Elektronik &amp; Kasir</option>
                    <option value="Kendaraan">Kendaraan</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="ast-branch" className="font-medium text-stone-700 block">
                    Cabang
                  </label>
                  <select
                    id="ast-branch"
                    value={assetBranch}
                    onChange={(e) => setAssetBranch(e.target.value as BranchName)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                  >
                    <option value="Pusat Genteng">Pusat Genteng</option>
                    <option value="Cabang Rungkut">Cabang Rungkut</option>
                    <option value="Gudang Sidoarjo">Gudang Sidoarjo</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label htmlFor="ast-cost" className="font-medium text-stone-700 block">
                    Harga Beli
                  </label>
                  <input
                    id="ast-cost"
                    type="number"
                    min={10000}
                    value={assetCost}
                    onChange={(e) => setAssetCost(e.target.value)}
                    placeholder="5000000"
                    className="w-full px-2.5 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ast-salvage" className="font-medium text-stone-700 block">
                    Nilai Sisa
                  </label>
                  <input
                    id="ast-salvage"
                    type="number"
                    min={0}
                    value={assetSalvage}
                    onChange={(e) => setAssetSalvage(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ast-months" className="font-medium text-stone-700 block">
                    Umur (Bln)
                  </label>
                  <input
                    id="ast-months"
                    type="number"
                    min={1}
                    value={assetMonths}
                    onChange={(e) => setAssetMonths(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              {assetFeedback && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {assetFeedback}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
              >
                Tambah Aset Tetap
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Daftar Aset Tetap &amp; Penyusutan Garis Lurus
                </h3>
                <p className="text-xs text-stone-500">
                  Nilai Buku Bersih: {formatIDR(treasuryStats.totalAssetNetBook)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunDepreciation}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg whitespace-nowrap"
              >
                Hitung Penyusutan Bulan Ini
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-4">Kode &amp; Nama Aset</th>
                    <th className="py-2.5 px-3 text-right">Harga Perolehan</th>
                    <th className="py-2.5 px-3 text-right">Susut / Bln</th>
                    <th className="py-2.5 px-3 text-right">Akumulasi Susut</th>
                    <th className="py-2.5 px-4 text-right">Nilai Buku</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {fixedAssets.map((a) => {
                    const monthly = calculateMonthlyDepreciation(a);
                    const bookValue = Math.max(0, a.acquisitionCost - a.accumulatedDepreciation);
                    return (
                      <tr key={a.id} className="hover:bg-stone-50">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-stone-900">{a.name}</div>
                          <div className="text-[11px] font-mono text-stone-500">
                            {a.assetCode} · {a.branch} ({a.usefulLifeMonths} bln)
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatIDR(a.acquisitionCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-stone-600 tabular-nums">
                          {formatIDR(monthly)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-red-700 tabular-nums">
                          ({formatIDR(a.accumulatedDepreciation)})
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                          {formatIDR(bookValue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Monthly Sales Report */}
      {tab === 'monthly' && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Laporan Penjualan Bulanan &amp; Tren Laba Bersih
              </h3>
              <p className="text-xs text-stone-500">
                Agregasi otomatis omzet, HPP, beban, dan laba bersih per bulan
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportMonthlyCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh CSV
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {monthlySales.map((m) => {
                const revWidth = Math.max(8, Math.round((m.revenue / maxMonthlyVal) * 100));
                const profitWidth = Math.max(
                  4,
                  Math.round((Math.max(0, m.netProfit) / maxMonthlyVal) * 100)
                );
                return (
                  <div
                    key={m.monthKey}
                    className="border border-stone-200 rounded-xl p-4 space-y-3 bg-stone-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-stone-900">{m.monthLabel}</span>
                      <span className="text-xs font-mono text-stone-500 tabular-nums">
                        {m.transactions} trx · {m.itemsSold} item
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Omzet</span>
                        <span className="font-mono font-semibold text-stone-900 tabular-nums">
                          {formatIDR(m.revenue)}
                        </span>
                      </div>
                      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-800 rounded-full"
                          style={{ width: `${revWidth}%` }}
                        />
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-stone-600">Laba Bersih</span>
                        <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                          {formatIDR(m.netProfit)}
                        </span>
                      </div>
                      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${profitWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-4">Periode</th>
                    <th className="py-2.5 px-3 text-right">Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Item</th>
                    <th className="py-2.5 px-3 text-right">Omzet Bersih</th>
                    <th className="py-2.5 px-3 text-right">HPP</th>
                    <th className="py-2.5 px-3 text-right">Beban</th>
                    <th className="py-2.5 px-4 text-right">Laba Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {monthlySales.map((m) => (
                    <tr key={m.monthKey} className="hover:bg-stone-50">
                      <td className="py-2.5 px-4 font-semibold text-stone-900">{m.monthLabel}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {m.transactions}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {m.itemsSold}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium tabular-nums">
                        {formatIDR(m.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-600 tabular-nums">
                        {formatIDR(m.cogs)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-stone-600 tabular-nums">
                        {formatIDR(m.expenses)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatIDR(m.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Buku Besar, Neraca Saldo & Jurnal Otomatis */}
      {tab === 'ledger' && (
        <div className="space-y-5">
          {/* Trial Balance / Neraca Saldo */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Neraca Saldo &amp; Buku Besar (Trial Balance Real-Time)
                </h3>
                <p className="text-xs text-stone-500">
                  Rekonsiliasi akun Aset, Kewajiban, Ekuitas, Pendapatan, HPP &amp; Beban
                </p>
              </div>
              <div className="text-xs font-mono font-semibold text-emerald-700">
                Total Debit = Kredit: {formatIDR(trialBalance.totalDebit)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-4">Kode &amp; Nama Akun</th>
                    <th className="py-2.5 px-3">Kelompok</th>
                    <th className="py-2.5 px-3 text-right">Mutasi Debit</th>
                    <th className="py-2.5 px-3 text-right">Mutasi Kredit</th>
                    <th className="py-2.5 px-4 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {trialBalance.rows.map((r) => (
                    <tr key={r.account} className="hover:bg-stone-50">
                      <td className="py-2 px-4 font-semibold text-stone-900">{r.account}</td>
                      <td className="py-2 px-3 text-stone-600">{r.category}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatIDR(r.debit)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatIDR(r.credit)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-stone-900 tabular-nums">
                        {formatIDR(r.netBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Double-Entry Journals */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">
                Jurnal Umum Otomatis ({journals.length} Entri Double-Entry)
              </h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 text-stone-600">
                  <tr>
                    <th className="py-2.5 px-4">No. Jurnal &amp; Ref</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3">Akun Debit</th>
                    <th className="py-2.5 px-3">Akun Kredit</th>
                    <th className="py-2.5 px-3">Cabang</th>
                    <th className="py-2.5 px-4 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {journals.map((j) => (
                    <tr key={j.id} className="hover:bg-stone-50">
                      <td className="py-2 px-4 font-mono whitespace-nowrap">
                        <div className="font-semibold text-stone-900">{j.journalNo}</div>
                        <div className="text-[11px] text-stone-400">{j.referenceNo}</div>
                      </td>
                      <td className="py-2 px-3 text-stone-700 max-w-xs">{j.description}</td>
                      <td className="py-2 px-3 text-emerald-800 font-medium">{j.debitAccount}</td>
                      <td className="py-2 px-3 text-red-800 font-medium">{j.creditAccount}</td>
                      <td className="py-2 px-3 text-stone-600 whitespace-nowrap">{j.branch}</td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-stone-900 tabular-nums whitespace-nowrap">
                        {formatIDR(j.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Kas & Bank, Smart Link Tax (e-Faktur CSV) & Multi-Cabang */}
      {tab === 'tax_branch' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
              <div className="text-xs text-stone-500">1101 · Kas Kasir Tunai</div>
              <div className="text-lg font-mono font-bold text-stone-900 tabular-nums">
                {formatIDR(treasuryStats.cashBalance)}
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
              <div className="text-xs text-stone-500">1102 · Bank BCA (QRIS)</div>
              <div className="text-lg font-mono font-bold text-stone-900 tabular-nums">
                {formatIDR(treasuryStats.bcaSettlement)}
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
              <div className="text-xs text-stone-500">1103 · Bank Mandiri</div>
              <div className="text-lg font-mono font-bold text-stone-900 tabular-nums">
                {formatIDR(treasuryStats.mandiriBalance)}
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
              <div className="text-xs text-stone-500">Smart Link Tax (PPN Netto &amp; PPh 0.5%)</div>
              <div className="text-sm font-mono font-bold text-red-800 tabular-nums">
                PPN Net: {formatIDR(pnl.taxCollectedPpn - pnl.taxInputPpn)}
              </div>
              <div className="text-xs font-mono text-stone-600 tabular-nums">
                PPh Final: {formatIDR(pnl.estimatedPphFinal)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-stone-900">
                Performa Laba Rugi Multi-Cabang &amp; Smart Link Tax
              </h3>
              <button
                type="button"
                onClick={handleExportTaxCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Ekspor e-Faktur CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <th className="py-2.5 px-4">Cabang / Gudang</th>
                    <th className="py-2.5 px-3 text-right">Transaksi</th>
                    <th className="py-2.5 px-3 text-right">Omzet Penjualan</th>
                    <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                    <th className="py-2.5 px-4 text-right">Kontribusi Laba Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {treasuryStats.byBranch.map((b) => (
                    <tr key={b.branch}>
                      <td className="py-3 px-4 font-semibold text-stone-900">{b.branch}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">{b.txCount}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatIDR(b.revenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatIDR(b.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatIDR(b.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
