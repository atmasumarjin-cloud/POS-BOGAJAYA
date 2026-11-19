import test from 'node:test';
import assert from 'node:assert/strict';
import { BOGAJAYA_INITIAL_CATALOG } from '../data/bogajayaCatalog';
import {
  generateEan13Barcode,
  generateSuggestedSku,
  validateAndBuildNewProduct,
} from './catalog';

test('generateEan13Barcode produces valid 13-digit numeric code', () => {
  const code = generateEan13Barcode(12345);
  assert.match(code, /^\d{13}$/);
  assert.equal(code.startsWith('8997014'), true);
});

test('validateAndBuildNewProduct validates unique SKU/barcode and builds valid BogajayaProduct', () => {
  const existing = BOGAJAYA_INITIAL_CATALOG;
  const dupSku = validateAndBuildNewProduct(
    {
      name: 'Sambal Baru',
      sku: existing[0].sku,
      barcode: '8997014999991',
      category: 'SAMBAL SUROBOYO',
      price: 45000,
      costPrice: 28000,
      weightGrams: 250,
      unit: 'Pcs',
      stockPusat: 20,
      stockRungkut: 10,
      stockSidoarjo: 5,
      minStock: 5,
      image: '',
      description: 'Sambal kemasan baru',
    },
    existing
  );
  assert.equal(dupSku.ok, false);

  const sku = generateSuggestedSku(existing);
  const barcode = generateEan13Barcode(777);
  const okRes = validateAndBuildNewProduct(
    {
      name: 'Spikoe Kismis Bogajaya',
      sku,
      barcode,
      category: 'CAKE & COOKIES',
      price: 95000,
      costPrice: 60000,
      weightGrams: 500,
      unit: 'Box',
      stockPusat: 25,
      stockRungkut: 12,
      stockSidoarjo: 8,
      minStock: 5,
      image: '',
      description: 'Kue spikoe kismis lembut khas Surabaya',
    },
    existing
  );
  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.product.name, 'SPIKOE KISMIS BOGAJAYA');
    assert.equal(okRes.product.price, 95000);
    assert.equal(okRes.product.stockPusat, 25);
    assert.equal(okRes.product.unit, 'Box');
  }
});
