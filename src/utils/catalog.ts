import type { BogajayaProduct } from '../data/bogajayaCatalog';

export interface NewCatalogProductInput {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  weightGrams: number;
  unit: string;
  stockPusat: number;
  stockRungkut: number;
  stockSidoarjo: number;
  minStock: number;
  image: string;
  description: string;
}

export function generateEan13Barcode(seedNumber = Date.now()): string {
  const numericSeed = Math.abs(Math.floor(seedNumber)) % 100000;
  const base12 = `8997014${String(numericSeed).padStart(5, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(base12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base12}${checkDigit}`;
}

export function generateSuggestedSku(existingProducts: BogajayaProduct[]): string {
  const num = 101000 + existingProducts.length + 1;
  return `BGJ-${num}`;
}

export function validateAndBuildNewProduct(
  input: NewCatalogProductInput,
  existingProducts: BogajayaProduct[]
): { ok: true; product: BogajayaProduct } | { ok: false; error: string } {
  const name = input.name.trim();
  const sku = input.sku.trim();
  const barcode = input.barcode.trim();
  const category = input.category.trim().toUpperCase();
  const unit = input.unit.trim() || 'Pcs';

  if (name.length < 2) {
    return { ok: false, error: 'Nama produk minimal 2 karakter.' };
  }
  if (!sku) {
    return { ok: false, error: 'Kode SKU wajib diisi.' };
  }
  if (existingProducts.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
    return { ok: false, error: `SKU "${sku}" sudah digunakan oleh produk lain.` };
  }
  if (barcode.length < 4 || barcode.length > 32) {
    return { ok: false, error: 'Barcode minimal 4 karakter (contoh EAN-13).' };
  }
  if (existingProducts.some((p) => p.barcode.toLowerCase() === barcode.toLowerCase())) {
    return { ok: false, error: `Barcode "${barcode}" sudah terdaftar pada produk lain.` };
  }
  if (!category) {
    return { ok: false, error: 'Pilih atau masukkan kategori produk.' };
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: 'Harga jual harus lebih besar dari Rp 0.' };
  }
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) {
    return { ok: false, error: 'HPP / Harga modal tidak boleh negatif.' };
  }

  const stockPusat = Math.max(0, Math.floor(input.stockPusat || 0));
  const stockRungkut = Math.max(0, Math.floor(input.stockRungkut || 0));
  const stockSidoarjo = Math.max(0, Math.floor(input.stockSidoarjo || 0));
  const minStock = Math.max(0, Math.floor(input.minStock || 5));
  const weightGrams = Math.max(1, Math.floor(input.weightGrams || 250));

  const cleanId = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const desc = input.description.trim() || `${name} — Produk resmi Toko Bogajaya Surabaya.`;
  const img = input.image.trim();

  const product: BogajayaProduct = {
    id: cleanId,
    sku,
    barcode,
    name: name.toUpperCase(),
    category,
    categories: [category],
    price: Math.round(input.price),
    regularPrice: Math.round(input.price),
    costPrice: Math.round(input.costPrice),
    image: img,
    remoteImage: img.startsWith('http') ? img : '',
    shortDesc: desc.slice(0, 180),
    description: desc,
    permalink: '',
    weightGrams,
    unit,
    isBundle: category.includes('PAKET'),
    stockPusat,
    stockRungkut,
    stockSidoarjo,
    minStock,
  };

  return { ok: true, product };
}
