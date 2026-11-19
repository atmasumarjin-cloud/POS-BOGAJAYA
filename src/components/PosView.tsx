import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode,
  Banknote,
  Clock,
  Minus,
  PauseCircle,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  calculateCheckoutTotals,
  findProductByBarcodeOrSku,
  formatIDR,
  getBranchStock,
  type PaymentMethod,
} from '../utils/accounting';
import { hasPermission } from '../utils/rbac';
import { ProductImage } from './ProductImage';

const PAGE_SIZE = 30;

export function PosView() {
  const {
    products,
    customers,
    settings,
    cart,
    heldOrders,
    selectedCustomerId,
    setSelectedCustomerId,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    holdCurrentCart,
    resumeHeldOrder,
    deleteHeldOrder,
    completeSale,
    currentOperator,
  } = useStore();

  const canGiveDiscount = hasPermission(currentOperator, 'pos_diskon_retur');

  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [cashInput, setCashInput] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [customerPhoneOverride, setCustomerPhoneOverride] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    const el = checkoutRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCheckoutVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px 0px 100px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return ['Semua', ...Object.keys(counts).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const catMatch =
        selectedCategory === 'Semua' ||
        p.category === selectedCategory ||
        p.categories.includes(selectedCategory);
      if (!catMatch) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const orderDiscount = Math.max(0, Number(discountInput) || 0);
  const parsedCash = Number(cashInput) || 0;

  const totals = useMemo(
    () =>
      calculateCheckoutTotals(
        cart,
        orderDiscount,
        settings.taxRatePercent,
        paymentMethod === 'Tunai' ? parsedCash : Number.MAX_SAFE_INTEGER
      ),
    [cart, orderDiscount, settings.taxRatePercent, paymentMethod, parsedCash]
  );

  const totalCartUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const found = findProductByBarcodeOrSku(products, code);
    if (!found) {
      setFeedback({
        type: 'err',
        text: `Barcode atau SKU "${code}" tidak ditemukan di katalog Bogajaya.`,
      });
      return;
    }
    addToCart(found, 1);
    setBarcodeInput('');
    setFeedback({
      type: 'ok',
      text: `Ditambahkan: ${found.name} (${formatIDR(found.price)})`,
    });
    barcodeRef.current?.focus();
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const activeCust = customers.find((c) => c.id === selectedCustomerId);
    const label =
      activeCust && activeCust.id !== 'cust-umum'
        ? activeCust.name
        : `Antrian ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    holdCurrentCart(label, orderDiscount);
    setDiscountInput('0');
    setCashInput('');
    setFeedback({ type: 'ok', text: `Pesanan "${label}" disimpan ke daftar antrian tunda.` });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Keranjang masih kosong. Pilih atau scan produk terlebih dahulu.',
      });
      return;
    }
    if (paymentMethod === 'Tunai' && parsedCash < totals.total) {
      setFeedback({
        type: 'err',
        text: `Uang tunai kurang ${formatIDR(totals.total - parsedCash)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const tx = await completeSale({
        paymentMethod,
        cashReceived: paymentMethod === 'Tunai' ? parsedCash : totals.total,
        orderDiscount,
        customerPhoneOverride: customerPhoneOverride.trim() || undefined,
      });
      setCashInput('');
      setDiscountInput('0');
      setCustomerPhoneOverride('');
      setFeedback({
        type: 'ok',
        text: `Transaksi ${tx.invoiceNo} selesai (${formatIDR(tx.total)}). Stok & Laporan Laba Rugi diperbarui.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Gagal memproses transaksi.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
      {/* Left 8 cols: Barcode Scanner + Compact Filter + Compact Product Grid */}
      <div className="lg:col-span-8 space-y-3.5">
        {/* Held Orders Bar (if any) */}
        {heldOrders.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mr-1">
              <Clock className="w-3.5 h-3.5" />
              Antrian Tunda ({heldOrders.length}):
            </span>
            {heldOrders.map((h) => (
              <div
                key={h.id}
                className="inline-flex items-center gap-1 bg-white border border-amber-300 rounded-lg pl-2.5 pr-1 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    const disc = resumeHeldOrder(h.id);
                    setDiscountInput(String(disc));
                  }}
                  className="font-medium text-stone-800 hover:text-red-800"
                >
                  {h.label} ({h.items.reduce((s, i) => s + i.quantity, 0)} item)
                </button>
                <button
                  type="button"
                  onClick={() => deleteHeldOrder(h.id)}
                  aria-label={`Hapus antrian ${h.label}`}
                  className="p-0.5 text-stone-400 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Fast Barcode Scanner & Search Bar */}
        <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 space-y-2.5">
          <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="pos-barcode-input" className="sr-only">
                Scan Barcode atau Masukkan SKU Produk
              </label>
              <input
                ref={barcodeRef}
                id="pos-barcode-input"
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan Barcode EAN-13 atau ketik SKU (mis. 936, 551, 370)..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-mono bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Scan / Tambah SKU
            </button>
          </form>

          {feedback && (
            <div
              role="status"
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Product search & category filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
            <div className="relative sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="pos-product-search" className="sr-only">
                Cari nama produk Bogajaya
              </label>
              <input
                id="pos-product-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari sambal, kue, kerupuk..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              />
            </div>

            <div className="sm:hidden">
              <select
                aria-label="Pilih kategori produk"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    Kategori: {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:flex flex-wrap items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Count summary */}
        <div className="flex items-center justify-between text-[11px] text-stone-500 px-0.5">
          <span>
            Menampilkan <strong className="text-stone-800 tabular-nums">{visibleProducts.length}</strong> dari{' '}
            <strong className="text-stone-800 tabular-nums">{filteredProducts.length}</strong> produk
          </span>
          <span>
            Cabang: <strong className="text-stone-800">{settings.activeBranch}</strong>
          </span>
        </div>

        {/* Compact High-Density Product Tiles */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-1.5">
            <p className="text-sm font-medium text-stone-800">Produk tidak ditemukan</p>
            <p className="text-xs text-stone-500">Coba kata kunci lain atau pilih kategori Semua.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {visibleProducts.map((product) => {
                const branchStock = getBranchStock(product, settings.activeBranch);
                const inCart = cart.find((c) => c.product.id === product.id);

                return (
                  <div
                    key={product.id}
                    className={`bg-white border rounded-xl overflow-hidden flex flex-col justify-between transition-colors ${
                      inCart ? 'border-red-800 bg-red-50/20' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => branchStock > 0 && addToCart(product, 1)}
                      disabled={branchStock <= 0}
                      className="text-left flex-1 flex flex-col focus:outline-none disabled:opacity-50"
                    >
                      <div className="w-full h-20 sm:h-24 bg-stone-100 overflow-hidden relative shrink-0">
                        <ProductImage
                          src={product.image}
                          fallbackSrc={product.remoteImage}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2 space-y-1 flex-1">
                        <div className="text-[10px] text-stone-500 flex items-center justify-between gap-1 font-mono">
                          <span className="truncate">#{product.sku}</span>
                          <span className={branchStock <= product.minStock ? 'text-red-700 font-semibold' : ''}>
                            Stok {branchStock}
                          </span>
                        </div>
                        <h3 className="text-[11px] font-semibold text-stone-900 leading-snug line-clamp-2 min-h-[1.85rem]">
                          {product.name}
                        </h3>
                      </div>
                    </button>

                    <div className="px-2 pb-2 pt-0.5 flex items-center justify-between gap-1.5">
                      <span className="text-xs font-mono font-bold text-red-800 tabular-nums truncate">
                        {formatIDR(product.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => addToCart(product, 1)}
                        disabled={branchStock <= 0}
                        aria-label={`Tambah ${product.name} ke keranjang`}
                        className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                          inCart
                            ? 'bg-red-800 text-white'
                            : 'bg-stone-900 hover:bg-red-800 text-white'
                        }`}
                      >
                        {inCart ? `×${inCart.quantity}` : '+'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleCount < filteredProducts.length && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-4 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors"
                >
                  Muat 30 Produk Berikutnya ({filteredProducts.length - visibleCount} tersisa)
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredProducts.length)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
                >
                  Tampilkan Semua
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right 4 cols: Sticky Checkout & Cash Tendered Panel */}
      <aside
        id="pos-checkout-panel"
        ref={checkoutRef}
        className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-3.5 sm:p-4 space-y-2.5 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4.75rem)] lg:overflow-y-auto scroll-mt-16 scroll-mb-24 lg:scroll-mb-0"
      >
        <div className="flex items-center justify-between border-b border-stone-200 pb-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-red-800" />
            <h2 className="text-sm font-bold text-stone-900">
              Keranjang Kasir ({totalCartUnits})
            </h2>
          </div>
          {cart.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHoldCart}
                title="Simpan pesanan sementara ke antrian"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:text-amber-950"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Tunda
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] font-medium text-stone-500 hover:text-red-800 transition-colors"
              >
                Kosongkan
              </button>
            </div>
          )}
        </div>

        {/* Loyal Customer Selector */}
        <div className="space-y-1">
          <label
            htmlFor="pos-customer-select"
            className="flex items-center gap-1.5 text-xs font-medium text-stone-700"
          >
            <UserCheck className="w-3.5 h-3.5 text-stone-500" />
            Pelanggan Setia / Member
          </label>
          <select
            id="pos-customer-select"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.tier !== 'Reguler' ? `(${c.tier} · ${c.points} pts)` : ''}
              </option>
            ))}
          </select>
          {(!activeCustomer?.phone || activeCustomer.id === 'cust-umum') && (
            <input
              type="tel"
              value={customerPhoneOverride}
              onChange={(e) => setCustomerPhoneOverride(e.target.value)}
              placeholder="No. WA struk otomatis (opsional, mis. 0812...)"
              aria-label="Nomor WhatsApp struk"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          )}
        </div>

        {/* Cart Items List */}
        {cart.length === 0 ? (
          <div className="py-5 text-center border border-dashed border-stone-200 rounded-lg space-y-1">
            <p className="text-xs font-medium text-stone-700">Belum ada produk dipilih</p>
            <p className="text-[11px] text-stone-500">
              Scan barcode atau ketuk produk Bogajaya.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-28 sm:max-h-40 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-start justify-between gap-2 pb-1.5 border-b border-stone-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-stone-900 truncate">{item.product.name}</p>
                  <p className="text-[11px] font-mono text-stone-500 tabular-nums">
                    {formatIDR(item.product.price)} × {item.quantity} ={' '}
                    <span className="font-semibold text-stone-800">
                      {formatIDR(item.product.price * item.quantity)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                    aria-label={`Kurangi ${item.product.name}`}
                    className="p-1 text-stone-600 hover:bg-stone-100 rounded border border-stone-200"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-mono tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                    aria-label={`Tambah ${item.product.name}`}
                    className="p-1 text-stone-600 hover:bg-stone-100 rounded border border-stone-200"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    aria-label={`Hapus ${item.product.name}`}
                    className="p-1 text-stone-400 hover:text-red-700 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Discount & Totals */}
        <div className="space-y-1 pt-2 border-t border-stone-200 text-xs">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="pos-discount-input" className="text-stone-600">
              Diskon Transaksi (Rp)
              {!canGiveDiscount && (
                <span className="block text-[10px] text-amber-700">
                  Butuh izin Diskon/Retur
                </span>
              )}
            </label>
            <input
              id="pos-discount-input"
              type="number"
              min={0}
              step={500}
              disabled={!canGiveDiscount}
              value={canGiveDiscount ? discountInput : '0'}
              onChange={(e) => setDiscountInput(e.target.value)}
              className="w-28 px-2.5 py-1 text-right font-mono bg-stone-50 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex justify-between text-stone-600">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatIDR(totals.subtotal)}</span>
          </div>
          {totals.totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Diskon</span>
              <span className="font-mono tabular-nums">-{formatIDR(totals.totalDiscount)}</span>
            </div>
          )}
          {settings.taxRatePercent > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>PPN ({settings.taxRatePercent}%)</span>
              <span className="font-mono tabular-nums">{formatIDR(totals.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-stone-900 pt-1.5 border-t border-stone-200">
            <span>Total Tagihan</span>
            <span className="font-mono text-red-800 tabular-nums">{formatIDR(totals.total)}</span>
          </div>
        </div>

        {/* Payment Method & Cash Tendered */}
        <div className="space-y-2 pt-0.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1 p-1 bg-stone-100 rounded-lg">
            {(['Tunai', 'QRIS', 'Transfer Bank', 'Piutang / Tempo'] as PaymentMethod[]).map(
              (method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1 px-2 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
                    paymentMethod === method
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {method}
                </button>
              )
            )}
          </div>

          {paymentMethod === 'Tunai' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="pos-cash-input" className="text-xs font-medium text-stone-700">
                  Uang Tunai Diterima (Rp)
                </label>
                <button
                  type="button"
                  onClick={() => setCashInput(String(totals.total))}
                  className="text-[11px] font-medium text-red-800 hover:underline"
                >
                  Uang Pas
                </button>
              </div>
              <input
                id="pos-cash-input"
                type="number"
                min={0}
                step={1000}
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                placeholder="Masukkan nominal tunai..."
                className="w-full px-2.5 py-1.5 text-sm font-mono font-semibold bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[50000, 100000, 200000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCashInput(String(amt))}
                    className="py-1 text-[11px] font-mono font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md transition-colors tabular-nums"
                  >
                    {amt / 1000}rb
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="text-stone-600">Kembalian</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    parsedCash >= totals.total ? 'text-emerald-700' : 'text-stone-400'
                  }`}
                >
                  {parsedCash >= totals.total ? formatIDR(totals.changeAmount) : 'Rp 0'}
                </span>
              </div>
            </div>
          )}

          {paymentMethod === 'Piutang / Tempo' && (
            <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Faktur otomatis dicatat ke <strong>1201 - Piutang Usaha</strong> dengan jatuh tempo 14 hari pada Accurate ERP.
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || cart.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors disabled:opacity-50 lg:sticky lg:bottom-0 lg:z-10 lg:shadow-[0_-6px_12px_rgba(255,255,255,0.95)]"
          >
            <Banknote className="w-4 h-4" />
            {isSubmitting ? 'Menyimpan...' : `Proses Transaksi ${paymentMethod}`}
          </button>
        </div>
      </aside>

      {/* Mobile Floating Cart Summary Jump Bar (hidden while checkout panel is visible) */}
      {cart.length > 0 && !isCheckoutVisible && (
        <div className="fixed bottom-16 left-3 right-3 z-30 lg:hidden">
          <button
            type="button"
            onClick={() =>
              checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
            }
            className="w-full flex items-center justify-between px-4 py-3 bg-stone-900 text-white rounded-xl shadow-lg text-xs font-semibold"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-red-400" />
              {totalCartUnits} item dipilih
            </span>
            <span className="font-mono font-bold tabular-nums">
              {formatIDR(totals.total)} · Bayar →
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
