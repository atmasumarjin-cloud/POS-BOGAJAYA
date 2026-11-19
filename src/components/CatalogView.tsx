import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { BogajayaProduct } from '../data/bogajayaCatalog';
import { formatIDR, getTotalStock } from '../utils/accounting';
import {
  generateEan13Barcode,
  generateSuggestedSku,
  type NewCatalogProductInput,
} from '../utils/catalog';
import { ProductImage } from './ProductImage';

const PAGE_SIZE = 30;
const UNIT_OPTIONS = ['Pcs', 'Box', 'Pack', 'Toples', 'Botol', 'Kg'];
const CUSTOM_CATEGORY_VALUE = '__CUSTOM__';

function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('File gambar kosong.'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim));
        const width = Math.max(1, Math.round((img.width || maxDim) * scale));
        const height = Math.max(1, Math.round((img.height || maxDim) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function CatalogView({ onQuickAddPos }: { onQuickAddPos: (p: BogajayaProduct) => void }) {
  const { products, addCatalogProduct } = useStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedProduct, setSelectedProduct] = useState<BogajayaProduct | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Add Product Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formWeightGrams, setFormWeightGrams] = useState('250');
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formStockPusat, setFormStockPusat] = useState('20');
  const [formStockRungkut, setFormStockRungkut] = useState('10');
  const [formStockSidoarjo, setFormStockSidoarjo] = useState('10');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formImage, setFormImage] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, category]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ['Semua', ...Array.from(set).sort()];
  }, [products]);

  const productCategoriesOnly = useMemo(
    () => categories.filter((c) => c !== 'Semua'),
    [categories]
  );

  const openAddModal = () => {
    setFormError(null);
    setFormName('');
    setFormCategory(productCategoriesOnly[0] || 'OLEH OLEH KHAS');
    setCustomCategory('');
    setFormSku(generateSuggestedSku(products));
    setFormBarcode(generateEan13Barcode());
    setFormPrice('');
    setFormCostPrice('');
    setFormWeightGrams('250');
    setFormUnit('Pcs');
    setFormStockPusat('20');
    setFormStockRungkut('10');
    setFormStockSidoarjo('10');
    setFormMinStock('5');
    setFormImage('');
    setFormDescription('');
    setShowAddModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setFormImage(dataUrl);
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal memproses file foto produk.');
    }
  };

  const handleSubmitNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const resolvedCategory =
      formCategory === CUSTOM_CATEGORY_VALUE ? customCategory.trim() : formCategory.trim();

    const payload: NewCatalogProductInput = {
      name: formName,
      sku: formSku,
      barcode: formBarcode,
      category: resolvedCategory,
      price: Number(formPrice),
      costPrice: formCostPrice.trim() === '' ? 0 : Number(formCostPrice),
      weightGrams: Number(formWeightGrams) || 250,
      unit: formUnit,
      stockPusat: Number(formStockPusat) || 0,
      stockRungkut: Number(formStockRungkut) || 0,
      stockSidoarjo: Number(formStockSidoarjo) || 0,
      minStock: Number(formMinStock) || 5,
      image: formImage,
      description: formDescription,
    };

    const res = addCatalogProduct(payload);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }

    setShowAddModal(false);
    setSearch('');
    setCategory('Semua');
    setSuccessBanner(
      `Produk "${res.product.name}" (SKU ${res.product.sku}) berhasil ditambahkan ke Katalog Resmi Bogajaya.`
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = category === 'Semua' || p.category === category;
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [products, search, category]);

  const visibleRows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900">
            Katalog Resmi Toko Bogajaya ({products.length} SKU)
          </h2>
          <p className="text-xs text-stone-500">
            Foto asli, harga resmi, deskripsi, berat, SKU, &amp; barcode EAN-13 tokobogajaya.com
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative sm:w-52">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="catalog-search" className="sr-only">
              Cari katalog produk
            </label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk, SKU, barcode..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
            />
          </div>
          <select
            aria-label="Filter kategori katalog"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tambah Produk
          </button>
        </div>
      </div>

      {successBanner && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Tutup notifikasi sukses"
            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Compact List (< md) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:hidden">
        {visibleRows.map((p) => (
          <div
            key={p.id}
            className="bg-white border border-stone-200 rounded-xl p-2.5 flex items-center gap-3"
          >
            <div className="w-14 h-14 rounded-lg bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
              <ProductImage
                src={p.image}
                fallbackSrc={p.remoteImage}
                alt={p.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-[10px] font-mono text-stone-500">
                SKU {p.sku} · Stok {getTotalStock(p)}
              </div>
              <p className="text-xs font-semibold text-stone-900 line-clamp-1">{p.name}</p>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-xs font-mono font-bold text-red-800 tabular-nums">
                  {formatIDR(p.price)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="px-2 py-1 text-[11px] font-medium text-stone-700 bg-stone-100 rounded"
                  >
                    Detail
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickAddPos(p)}
                    className="px-2 py-1 text-[11px] font-semibold text-white bg-red-800 rounded"
                  >
                    + Kasir
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Compact Table (md+) */}
      <div className="hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600">
                <th className="py-2.5 px-4">Produk</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">SKU &amp; Barcode</th>
                <th className="py-2.5 px-3 text-right">Harga Jual</th>
                <th className="py-2.5 px-3 text-right">HPP</th>
                <th className="py-2.5 px-3 text-right">Total Stok</th>
                <th className="py-2.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {visibleRows.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
                        <ProductImage
                          src={p.image}
                          fallbackSrc={p.remoteImage}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 max-w-xs">
                        <p className="font-semibold text-stone-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {p.shortDesc || p.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-stone-600 whitespace-nowrap">{p.category}</td>
                  <td className="py-2 px-3 font-mono text-stone-700 whitespace-nowrap">
                    <div>{p.sku}</div>
                    <div className="text-[11px] text-stone-400">{p.barcode}</div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-red-800 tabular-nums whitespace-nowrap">
                    {formatIDR(p.price)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-stone-600 tabular-nums whitespace-nowrap">
                    {formatIDR(p.costPrice)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-stone-900 tabular-nums whitespace-nowrap">
                    {getTotalStock(p)} {p.unit}
                  </td>
                  <td className="py-2 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(p)}
                        className="px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
                      >
                        Detail
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickAddPos(p)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-800 hover:bg-red-900 rounded-md transition-colors"
                      >
                        + Kasir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {visibleCount < filtered.length && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-4 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg"
          >
            Muat 30 Produk Berikutnya ({filtered.length - visibleCount} tersisa)
          </button>
          <button
            type="button"
            onClick={() => setVisibleCount(filtered.length)}
            className="px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            Semua ({filtered.length})
          </button>
        </div>
      )}

      {/* Add New Catalog Product Modal */}
      {showAddModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-3 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-catalog-product-title"
          >
            <div className="bg-white border border-stone-200 rounded-xl max-w-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-stone-50 shrink-0">
                <div>
                  <h3
                    id="add-catalog-product-title"
                    className="text-sm sm:text-base font-bold text-stone-900"
                  >
                    Tambah Produk Katalog Baru
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Produk baru langsung tersedia di Katalog, Kasir POS, Gudang &amp; Accurate ERP
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Tutup form tambah produk"
                  className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/70"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitNewProduct} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-3.5 py-2.5 text-xs font-medium"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="new-prod-name"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Nama Produk *
                  </label>
                  <input
                    id="new-prod-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Spikoe Kismis Spesial Bogajaya 500g"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-prod-category"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Kategori Produk *
                  </label>
                  <select
                    id="new-prod-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                  >
                    {productCategoriesOnly.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>+ Kategori Baru Lainnya</option>
                  </select>
                </div>

                {formCategory === CUSTOM_CATEGORY_VALUE ? (
                  <div>
                    <label
                      htmlFor="new-prod-custom-category"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Nama Kategori Baru *
                    </label>
                    <input
                      id="new-prod-custom-category"
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Contoh: KUE BASAH PREMIUM"
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="new-prod-unit"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Satuan &amp; Berat (gram)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        id="new-prod-unit"
                        aria-label="Satuan produk"
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        className="px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <input
                        id="new-prod-weight"
                        aria-label="Berat dalam gram"
                        type="number"
                        min={1}
                        value={formWeightGrams}
                        onChange={(e) => setFormWeightGrams(e.target.value)}
                        placeholder="Gram"
                        className="px-2.5 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                      />
                    </div>
                  </div>
                )}

                {formCategory === CUSTOM_CATEGORY_VALUE && (
                  <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="new-prod-unit-alt"
                        className="block text-xs font-semibold text-stone-700 mb-1"
                      >
                        Satuan Produk
                      </label>
                      <select
                        id="new-prod-unit-alt"
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="new-prod-weight-alt"
                        className="block text-xs font-semibold text-stone-700 mb-1"
                      >
                        Berat (gram)
                      </label>
                      <input
                        id="new-prod-weight-alt"
                        type="number"
                        min={1}
                        value={formWeightGrams}
                        onChange={(e) => setFormWeightGrams(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="new-prod-sku"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Kode SKU *
                  </label>
                  <input
                    id="new-prod-sku"
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="BGJ-101129"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-prod-barcode"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Barcode EAN-13 *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="new-prod-barcode"
                      type="text"
                      required
                      value={formBarcode}
                      onChange={(e) => setFormBarcode(e.target.value)}
                      placeholder="8997014..."
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormBarcode(
                          generateEan13Barcode(Date.now() + Math.floor(Math.random() * 999))
                        )
                      }
                      title="Generate Barcode EAN-13 baru"
                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Acak
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-prod-price"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Harga Jual (Rp) *
                  </label>
                  <input
                    id="new-prod-price"
                    type="number"
                    min={1}
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="95000"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-prod-cost"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    HPP / Harga Modal (Rp)
                  </label>
                  <input
                    id="new-prod-cost"
                    type="number"
                    min={0}
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    placeholder="55000"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                  />
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-stone-800">
                  Stok Awal Cabang &amp; Batas Stok Minimum
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label
                      htmlFor="new-prod-stock-pusat"
                      className="block text-[11px] font-medium text-stone-600 mb-1"
                    >
                      Pusat Genteng
                    </label>
                    <input
                      id="new-prod-stock-pusat"
                      type="number"
                      min={0}
                      value={formStockPusat}
                      onChange={(e) => setFormStockPusat(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-prod-stock-rungkut"
                      className="block text-[11px] font-medium text-stone-600 mb-1"
                    >
                      Cabang Rungkut
                    </label>
                    <input
                      id="new-prod-stock-rungkut"
                      type="number"
                      min={0}
                      value={formStockRungkut}
                      onChange={(e) => setFormStockRungkut(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-prod-stock-sidoarjo"
                      className="block text-[11px] font-medium text-stone-600 mb-1"
                    >
                      Gudang Sidoarjo
                    </label>
                    <input
                      id="new-prod-stock-sidoarjo"
                      type="number"
                      min={0}
                      value={formStockSidoarjo}
                      onChange={(e) => setFormStockSidoarjo(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-prod-min-stock"
                      className="block text-[11px] font-medium text-stone-600 mb-1"
                    >
                      Stok Minimum
                    </label>
                    <input
                      id="new-prod-min-stock"
                      type="number"
                      min={0}
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                <div className="sm:col-span-2 space-y-2">
                  <label
                    htmlFor="new-prod-image-url"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Foto Produk (URL atau Upload File)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="new-prod-image-url"
                      type="text"
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      placeholder="https://... atau upload gambar di sebelah"
                      className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg cursor-pointer shrink-0">
                      <ImagePlus className="w-3.5 h-3.5" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <div>
                    <label
                      htmlFor="new-prod-desc"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Deskripsi Produk
                    </label>
                    <textarea
                      id="new-prod-desc"
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Komposisi, daya tahan kadaluarsa, atau catatan kemasan produk..."
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                    />
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[11px] font-medium text-stone-500 mb-1.5">
                    Pratinjau Foto
                  </span>
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                    <ProductImage
                      src={formImage}
                      alt={formName || 'Produk Baru'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
                >
                  Simpan Produk ke Katalog
                </button>
              </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Product Detail Drawer/Modal */}
      {selectedProduct &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
          >
            <div className="bg-white border border-stone-200 rounded-xl max-w-xl w-full overflow-hidden my-auto shadow-xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
              <h3 id="product-detail-title" className="text-sm sm:text-base font-bold text-stone-900 truncate pr-4">
                {selectedProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Tutup detail produk"
                className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="h-52 sm:aspect-square sm:h-auto rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                <ProductImage
                  src={selectedProduct.image}
                  fallbackSrc={selectedProduct.remoteImage}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-3 text-xs">
                <div className="text-stone-500">
                  {selectedProduct.category} · {selectedProduct.weightGrams}g · SKU {selectedProduct.sku}
                </div>
                <div className="text-xl font-mono font-bold text-red-800 tabular-nums">
                  {formatIDR(selectedProduct.price)}
                </div>
                <div className="grid grid-cols-3 gap-2 bg-stone-50 border border-stone-200 rounded-lg p-2.5 text-center">
                  <div>
                    <div className="text-[10px] text-stone-500">Genteng</div>
                    <div className="font-mono font-bold text-stone-900">{selectedProduct.stockPusat}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-stone-500">Rungkut</div>
                    <div className="font-mono font-bold text-stone-900">{selectedProduct.stockRungkut}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-stone-500">Sidoarjo</div>
                    <div className="font-mono font-bold text-stone-900">{selectedProduct.stockSidoarjo}</div>
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-stone-800 block mb-1">Barcode EAN-13</span>
                  <code className="font-mono text-xs bg-stone-100 px-2.5 py-1 rounded border border-stone-200 inline-block">
                    {selectedProduct.barcode}
                  </code>
                </div>
                <div>
                  <span className="font-semibold text-stone-800 block mb-1">Deskripsi Resmi</span>
                  <p className="text-stone-600 leading-relaxed max-h-28 overflow-y-auto">
                    {selectedProduct.description}
                  </p>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onQuickAddPos(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
                  >
                    Tambahkan ke Kasir POS
                  </button>
                  {selectedProduct.permalink && (
                    <a
                      href={selectedProduct.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 py-2 px-3 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
                    >
                      Web <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
