import React, { useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Barcode, Boxes, ClipboardCheck, PackagePlus } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  findProductByBarcodeOrSku,
  formatIDR,
  getBranchStock,
  getTotalStock,
  type BranchName,
} from '../utils/accounting';

const BRANCHES: BranchName[] = ['Pusat Genteng', 'Cabang Rungkut', 'Gudang Sidoarjo'];

export function WarehouseView() {
  const { products, stockMovements, inventoryValuation, settings, adjustWarehouseStock } =
    useStore();

  const [scanCode, setScanCode] = useState('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'TRANSFER' | 'OPNAME'>('IN');
  const [warehouse, setWarehouse] = useState<BranchName>(settings.activeBranch);
  const [targetWarehouse, setTargetWarehouse] = useState<BranchName>('Cabang Rungkut');
  const [quantityInput, setQuantityInput] = useState('10');
  const [noteInput, setNoteInput] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [filterLowOnly, setFilterLowOnly] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);

  const scannedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  const handleScanLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const found = findProductByBarcodeOrSku(products, scanCode);
    if (!found) {
      setStatusMsg({
        type: 'err',
        text: `Barcode / SKU "${scanCode}" tidak ditemukan di database gudang.`,
      });
      return;
    }
    setSelectedProductId(found.id);
    setStatusMsg({
      type: 'ok',
      text: `Produk ditemukan: ${found.name} (Stok ${warehouse}: ${getBranchStock(found, warehouse)})`,
    });
    setScanCode('');
  };

  const handleApplyMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedProduct) return;
    const qty = Number(quantityInput);
    if (!Number.isFinite(qty) || (movementType !== 'OPNAME' && qty <= 0) || qty < 0) {
      setStatusMsg({ type: 'err', text: 'Masukkan jumlah stok yang valid.' });
      return;
    }
    if (movementType === 'TRANSFER' && targetWarehouse === warehouse) {
      setStatusMsg({ type: 'err', text: 'Gudang tujuan mutasi harus berbeda dengan gudang asal.' });
      return;
    }

    try {
      await adjustWarehouseStock({
        product: scannedProduct,
        warehouse,
        movementType,
        quantity: Math.round(qty),
        targetWarehouse: movementType === 'TRANSFER' ? targetWarehouse : undefined,
        note: noteInput.trim() || `${movementType} Gudang (${scannedProduct.sku})`,
      });
      setStatusMsg({
        type: 'ok',
        text: `Berhasil mencatat ${movementType} ${qty} ${scannedProduct.unit} untuk ${scannedProduct.name}. Stok & jurnal Accurate diperbarui.`,
      });
      setNoteInput('');
      scanRef.current?.focus();
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Gagal memperbarui stok.' });
    }
  };

  const displayedProducts = useMemo(() => {
    if (!filterLowOnly) return products.slice(0, 40);
    return products.filter((p) => p.stockPusat <= p.minStock || p.stockRungkut <= 5);
  }, [products, filterLowOnly]);

  return (
    <div className="space-y-6">
      {/* Top 4 Inventory KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-stone-500">Total Unit Tersedia (3 Gudang)</div>
          <div className="text-2xl font-mono font-bold text-stone-900 tabular-nums">
            {inventoryValuation.totalUnits.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-stone-500">{products.length} SKU aktif</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-stone-500">
            Nilai Persediaan ({settings.costingMethod})
          </div>
          <div className="text-2xl font-mono font-bold text-stone-900 tabular-nums">
            {formatIDR(inventoryValuation.totalCostValue)}
          </div>
          <div className="text-[11px] text-stone-500">HPP terakumulasi</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-stone-500">Potensi Nilai Jual Ritel</div>
          <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums">
            {formatIDR(inventoryValuation.totalRetailValue)}
          </div>
          <div className="text-[11px] text-stone-500">
            Estimasi margin {formatIDR(inventoryValuation.potentialGrossProfit)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-1">
          <div className="text-xs text-stone-500">Peringatan Stok Menipis</div>
          <div className="text-2xl font-mono font-bold text-red-800 tabular-nums">
            {inventoryValuation.lowStockCount} SKU
          </div>
          <div className="text-[11px] text-stone-500">Di bawah batas minimum stok</div>
        </div>
      </div>

      {/* Fast Warehouse Barcode Input & Stock Adjustment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
            <Barcode className="w-5 h-5 text-red-800" />
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                Pemindai Barcode Gudang Cepat
              </h2>
              <p className="text-xs text-stone-500">
                Scan EAN-13 atau ketik SKU untuk input barang masuk, keluar, mutasi, &amp; opname
              </p>
            </div>
          </div>

          <form onSubmit={handleScanLookup} className="flex gap-2">
            <label htmlFor="wh-barcode-scan" className="sr-only">
              Scan barcode gudang
            </label>
            <input
              ref={scanRef}
              id="wh-barcode-scan"
              type="text"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Scan barcode atau SKU (mis. 551, 936)..."
              className="flex-1 px-3 py-2 text-sm font-mono bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg whitespace-nowrap"
            >
              Cari SKU
            </button>
          </form>

          {statusMsg && (
            <div
              role="status"
              className={`text-xs px-3 py-2 rounded-lg border ${
                statusMsg.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <form onSubmit={handleApplyMovement} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label htmlFor="wh-product-select" className="font-medium text-stone-700 block">
                Produk Terpilih
              </label>
              <select
                id="wh-product-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (Total: {getTotalStock(p)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-stone-100 rounded-lg">
              {(
                [
                  { id: 'IN', label: 'Masuk' },
                  { id: 'OUT', label: 'Keluar' },
                  { id: 'TRANSFER', label: 'Mutasi' },
                  { id: 'OPNAME', label: 'Opname' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setMovementType(mode.id)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors ${
                    movementType === mode.id
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="wh-branch-select" className="font-medium text-stone-700 block">
                  {movementType === 'TRANSFER' ? 'Gudang Asal' : 'Lokasi Gudang'}
                </label>
                <select
                  id="wh-branch-select"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value as BranchName)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {movementType === 'TRANSFER' ? (
                <div className="space-y-1">
                  <label htmlFor="wh-target-select" className="font-medium text-stone-700 block">
                    Gudang Tujuan
                  </label>
                  <select
                    id="wh-target-select"
                    value={targetWarehouse}
                    onChange={(e) => setTargetWarehouse(e.target.value as BranchName)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label htmlFor="wh-qty-input" className="font-medium text-stone-700 block">
                    {movementType === 'OPNAME' ? 'Stok Fisik Aktual' : 'Jumlah (Qty)'}
                  </label>
                  <input
                    id="wh-qty-input"
                    type="number"
                    min={0}
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            {movementType === 'TRANSFER' && (
              <div className="space-y-1">
                <label htmlFor="wh-transfer-qty" className="font-medium text-stone-700 block">
                  Jumlah Barang Ditransfer
                </label>
                <input
                  id="wh-transfer-qty"
                  type="number"
                  min={1}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-white border border-stone-300 rounded-lg"
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="wh-note-input" className="font-medium text-stone-700 block">
                Catatan / No. Surat Jalan
              </label>
              <input
                id="wh-note-input"
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Mis. Restok pabrik pagi / hasil opname rak A"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
            >
              {movementType === 'IN' && <PackagePlus className="w-4 h-4" />}
              {movementType === 'TRANSFER' && <ArrowRightLeft className="w-4 h-4" />}
              {movementType === 'OPNAME' && <ClipboardCheck className="w-4 h-4" />}
              {movementType === 'OUT' && <Boxes className="w-4 h-4" />}
              Simpan Pergerakan Stok
            </button>
          </form>
        </div>

        {/* Right 7 cols: Multi-Warehouse Stock & Movement History */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  Sinkronisasi Stok Multi-Gudang Real-Time
                </h3>
                <p className="text-xs text-stone-500">
                  Pusat Genteng · Cabang Rungkut · Gudang Sidoarjo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilterLowOnly((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  filterLowOnly
                    ? 'bg-red-800 text-white border-red-800'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                }`}
              >
                {filterLowOnly ? 'Tampilkan Semua' : 'Filter Stok Menipis'}
              </button>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 text-stone-600">
                  <tr>
                    <th className="py-2.5 px-4">SKU / Nama Barang</th>
                    <th className="py-2.5 px-3 text-right">Genteng</th>
                    <th className="py-2.5 px-3 text-right">Rungkut</th>
                    <th className="py-2.5 px-3 text-right">Sidoarjo</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {displayedProducts.map((p) => {
                    const isLow = p.stockPusat <= p.minStock;
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-stone-50 cursor-pointer"
                        onClick={() => setSelectedProductId(p.id)}
                      >
                        <td className="py-2 px-4">
                          <div className="font-medium text-stone-900 truncate max-w-xs">{p.name}</div>
                          <div className="text-[11px] font-mono text-stone-400">
                            SKU {p.sku} · {p.barcode}
                          </div>
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums ${
                            isLow ? 'text-red-700 font-bold' : 'text-stone-700'
                          }`}
                        >
                          {p.stockPusat}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-700 tabular-nums">
                          {p.stockRungkut}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-700 tabular-nums">
                          {p.stockSidoarjo}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-stone-900 tabular-nums">
                          {getTotalStock(p)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Stock Movements */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-900">
                Riwayat Kartu Stok &amp; Audit Gudang
              </h3>
            </div>
            <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
              {stockMovements.slice(0, 20).map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 truncate">
                      {m.productName}
                    </p>
                    <p className="text-[11px] text-stone-500 truncate">
                      {m.movementType} · {m.warehouse} · {m.note}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        m.quantityDelta >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </span>
                    <div className="text-[10px] font-mono text-stone-400">
                      {new Date(m.createdAtIso).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
