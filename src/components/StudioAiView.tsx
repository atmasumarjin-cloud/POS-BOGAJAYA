import React, { useMemo, useRef, useState } from 'react';
import { Download, Sparkles, Wand2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatIDR, getBranchStock } from '../utils/accounting';
import { ProductImage } from './ProductImage';

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 (Feed IG)', w: 1080, h: 1080 },
  { id: '2:3', label: '2:3 (Poster Vertikal)', w: 1000, h: 1500 },
  { id: '3:2', label: '3:2 (Banner Meja)', w: 1500, h: 1000 },
  { id: '3:4', label: '3:4 (Katalog IG)', w: 1080, h: 1440 },
  { id: '4:3', label: '4:3 (Layar Kasir)', w: 1440, h: 1080 },
  { id: '9:16', label: '9:16 (Story / WA Status)', w: 1080, h: 1920 },
  { id: '16:9', label: '16:9 (Layar TV Toko)', w: 1920, h: 1080 },
  { id: '21:9', label: '21:9 (Spanduk Lebar)', w: 2100, h: 900 },
] as const;

const CFO_PRESETS = [
  'Analisis margin produk terlaris & rekomendasi paket bundling oleh-oleh Surabaya',
  'Evaluasi stok gudang yang hampir habis dan prioritas restok antar cabang',
  'Strategi optimasi laba bersih bulanan serta estimasi pajak UMKM 0.5%',
  'Ringkasan kesehatan kas tunai, HPP, dan perputaran persediaan saat ini',
];

export function StudioAiView() {
  const { products, pnl, monthlySales, settings } = useStore();

  // Section 1: CFO & Inventory Thinking Analysis
  const [question, setQuestion] = useState(CFO_PRESETS[0]);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ model: string; thinkingLevel: string } | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Section 2: Promo Poster Studio
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(() => products[0]?.id || '');
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]['id']>('1:1');
  const [campaignGoal, setCampaignGoal] = useState('Promo Spesial Oleh-Oleh Khas Surabaya');
  const [headline, setHeadline] = useState(() => `Promo ${products[0]?.name || 'Bogajaya'}`);
  const [subheadline, setSubheadline] = useState(
    'Oleh-oleh legendaris Surabaya resep otentik sejak 1976. Pesan langsung di outlet atau WhatsApp!'
  );
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lowStockList = useMemo(() => {
    return products
      .filter((p) => getBranchStock(p, settings.activeBranch) <= p.minStock)
      .slice(0, 12)
      .map((p) => ({
        sku: p.sku,
        name: p.name,
        stock: getBranchStock(p, settings.activeBranch),
        minStock: p.minStock,
        price: p.price,
      }));
  }, [products, settings.activeBranch]);

  const filteredStudioProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [products, productQuery]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  const selectedRatioSpec =
    ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0];

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          branch: settings.activeBranch,
          pnl,
          monthlySales: monthlySales.slice(0, 6),
          topLowStock: lowStockList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menjalankan analisis AI.');
      }
      setAnalysisResult(data.analysis);
      setAnalysisMeta({ model: data.model, thinkingLevel: data.thinkingLevel });
    } catch (err: any) {
      setAnalysisError(err?.message || 'Layanan AI sedang sibuk, coba beberapa saat lagi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateCopy = async () => {
    if (!selectedProduct) return;
    setIsGeneratingCopy(true);
    setCopyError(null);
    try {
      const res = await fetch('/api/gemini/studio-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: selectedProduct.name,
          price: selectedProduct.price,
          aspectRatio,
          campaignGoal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat copywriting.');
      if (data.headline) setHeadline(data.headline);
      if (data.subheadline) setSubheadline(data.subheadline);
    } catch (err: any) {
      setCopyError(err?.message || 'Gagal menghasilkan teks promosi.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleDownloadPoster = async () => {
    if (!selectedProduct || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const { w, h } = selectedRatioSpec;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Warm cream background
    ctx.fillStyle = '#FAF9F6';
    ctx.fillRect(0, 0, w, h);

    // Top heritage crimson band
    const topBandH = Math.round(h * 0.12);
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(0, 0, w, topBandH);

    // Brand text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(Math.min(w, h) * 0.04)}px sans-serif`;
    ctx.fillText('TOKO BOGAJAYA · SURABAYA SEJAK 1976', Math.round(w * 0.05), Math.round(topBandH * 0.62));

    // Load product image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = selectedProduct.image;
    });

    const isWide = w > h;
    const pad = Math.round(Math.min(w, h) * 0.06);
    if (img.naturalWidth > 0) {
      if (isWide) {
        const imgBoxSize = Math.round(h - topBandH - pad * 2);
        ctx.drawImage(img, pad, topBandH + pad, imgBoxSize, imgBoxSize);
      } else {
        const imgBoxW = Math.round(w - pad * 2);
        const imgBoxH = Math.round(h * 0.44);
        const scale = Math.min(imgBoxW / img.naturalWidth, imgBoxH / img.naturalHeight);
        const drawW = img.naturalWidth * scale;
        const drawH = img.naturalHeight * scale;
        const drawX = (w - drawW) / 2;
        const drawY = topBandH + pad + (imgBoxH - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    }

    // Text coordinates
    const textX = isWide ? Math.round(pad * 2 + (h - topBandH - pad * 2)) : pad;
    const textMaxW = isWide ? w - textX - pad : w - pad * 2;
    let cursorY = isWide ? topBandH + pad * 1.6 : topBandH + pad + Math.round(h * 0.48) + pad;

    const wrapText = (text: string, fontSize: number, color: string, bold = false, lineHeight = 1.25) => {
      ctx.fillStyle = color;
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px sans-serif`;
      const words = text.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > textMaxW && line) {
          ctx.fillText(line, textX, cursorY);
          cursorY += Math.round(fontSize * lineHeight);
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ctx.fillText(line, textX, cursorY);
        cursorY += Math.round(fontSize * lineHeight);
      }
    };

    const baseUnit = Math.min(w, h);
    wrapText(headline, Math.round(baseUnit * 0.055), '#1C1917', true, 1.2);
    cursorY += Math.round(baseUnit * 0.015);
    wrapText(subheadline, Math.round(baseUnit * 0.032), '#57534E', false, 1.35);
    cursorY += Math.round(baseUnit * 0.03);

    // Price & SKU footer
    ctx.fillStyle = '#991B1B';
    ctx.font = `bold ${Math.round(baseUnit * 0.068)}px monospace`;
    ctx.fillText(formatIDR(selectedProduct.price), textX, cursorY);
    cursorY += Math.round(baseUnit * 0.045);

    ctx.fillStyle = '#78716C';
    ctx.font = `${Math.round(baseUnit * 0.025)}px monospace`;
    ctx.fillText(
      `SKU: ${selectedProduct.sku} · EAN-13: ${selectedProduct.barcode} · ${settings.activeBranch}`,
      textX,
      Math.min(h - pad / 2, cursorY)
    );

    const link = document.createElement('a');
    link.download = `poster-bogajaya-${selectedProduct.sku}-${aspectRatio.replace(':', 'x')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Deep Thinking Financial & Inventory CFO Analyst */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-800" />
              Analis Keuangan &amp; Stok AI (Mode Pemikiran Mendalam)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Mengaudit laporan Laba Rugi real-time, tren penjualan bulanan, dan stok menipis cabang {settings.activeBranch}.
            </p>
          </div>
          <div className="text-xs font-mono text-stone-600 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg">
            Laba Bersih Saat Ini: <strong className="text-emerald-700">{formatIDR(pnl.netProfit)}</strong>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CFO_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setQuestion(preset)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors text-left ${
                question === preset
                  ? 'bg-red-800 text-white border-red-800'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <form onSubmit={handleRunAnalysis} className="space-y-3">
          <label htmlFor="cfo-question" className="block text-xs font-semibold text-stone-700">
            Pertanyaan Analisis Keuangan / Stok Gudang
          </label>
          <textarea
            id="cfo-question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Tulis pertanyaan seputar laba rugi, HPP, restok cabang, atau pajak UMKM..."
            className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-stone-500">
              Data dikirim secara aman melalui route backend terenkripsi tanpa mengekspos API key ke browser.
            </span>
            <button
              type="submit"
              disabled={isAnalyzing || !question.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isAnalyzing ? 'Menganalisis Laporan...' : 'Jalankan Audit AI'}
            </button>
          </div>
        </form>

        {analysisError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {analysisError}
          </div>
        )}

        {analysisResult && (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 border-b border-stone-200 pb-2">
              <span>HASIL AUDIT KEUANGAN &amp; INVENTARIS BOGAJAYA</span>
              {analysisMeta && (
                <span>
                  {analysisMeta.model} · Thinking {analysisMeta.thinkingLevel}
                </span>
              )}
            </div>
            <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
              {analysisResult}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Studio Poster Promosi Produk (All 8 Aspect Ratios) */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-red-800" />
              Studio Poster Promosi Produk (Multi-Rasio)
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Buat materi promosi cetak maupun media sosial dari foto asli 128 produk Toko Bogajaya dalam 8 rasio standar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadPoster}
            disabled={!selectedProduct}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Unduh Poster PNG ({aspectRatio})
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="studio-product-search" className="block text-xs font-semibold text-stone-700">
                1. Cari &amp; Pilih Produk Bogajaya
              </label>
              <input
                id="studio-product-search"
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Ketik nama produk, SKU, atau barcode..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              />
              <select
                aria-label="Pilih Produk Promosi"
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const nextProd = products.find((p) => p.id === e.target.value);
                  setSelectedProductId(e.target.value);
                  if (nextProd) {
                    setHeadline(`Promo ${nextProd.name}`);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              >
                {filteredStudioProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatIDR(p.price)} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-stone-700">
                2. Pilih Rasio Aspek Poster
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ASPECT_RATIOS.map((ratio) => {
                  const active = ratio.id === aspectRatio;
                  return (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setAspectRatio(ratio.id)}
                      className={`px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-red-800 text-white border-red-800'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                      title={ratio.label}
                    >
                      {ratio.id}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-stone-500">
                Format aktif: <strong>{selectedRatioSpec.label}</strong> ({selectedRatioSpec.w} × {selectedRatioSpec.h} px)
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <label htmlFor="studio-goal" className="text-xs font-semibold text-stone-700">
                  3. Tema Kampanye &amp; Teks Poster
                </label>
                <button
                  type="button"
                  onClick={handleGenerateCopy}
                  disabled={isGeneratingCopy || !selectedProduct}
                  className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg whitespace-nowrap disabled:opacity-50"
                >
                  {isGeneratingCopy ? 'Menulis...' : 'Buat Copy AI'}
                </button>
              </div>
              <input
                id="studio-goal"
                type="text"
                value={campaignGoal}
                onChange={(e) => setCampaignGoal(e.target.value)}
                placeholder="Tujuan promo..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg"
              />
              <input
                type="text"
                aria-label="Judul Poster"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Judul utama poster"
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-stone-300 rounded-lg"
              />
              <textarea
                rows={2}
                aria-label="Subjudul Poster"
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                placeholder="Deskripsi singkat atau ajakan pembelian..."
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
              />
              {copyError && <p className="text-xs text-red-700">{copyError}</p>}
            </div>
          </div>

          {/* Live Poster Canvas Preview */}
          <div className="lg:col-span-7 bg-stone-100 border border-stone-200 rounded-xl p-6 flex items-center justify-center min-h-[380px]">
            {selectedProduct && (
              <div
                style={{
                  aspectRatio: aspectRatio.replace(':', ' / '),
                }}
                className="w-full max-w-md max-h-[480px] bg-[#FAF9F6] border border-stone-300 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm"
              >
                <div className="bg-red-800 text-white px-4 py-2 flex items-center justify-between text-[10px] font-bold tracking-wider uppercase shrink-0">
                  <div className="flex items-center gap-2">
                    <img
                      src="/assets/bogajaya-logo.png"
                      alt="Bogajaya"
                      className="h-5 w-auto object-contain"
                    />
                    <span>SURABAYA</span>
                  </div>
                  <span>{settings.activeBranch}</span>
                </div>

                <div className="flex-1 p-4 flex flex-col items-center justify-center gap-3 overflow-hidden">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden border border-stone-200 bg-white shrink-0">
                    <ProductImage
                      src={selectedProduct.image}
                      fallbackSrc={selectedProduct.remoteImage}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center space-y-1 max-w-xs">
                    <div className="text-sm sm:text-base font-bold text-stone-900 leading-tight line-clamp-2">
                      {headline}
                    </div>
                    <p className="text-[11px] text-stone-600 line-clamp-2">{subheadline}</p>
                    <div className="text-base sm:text-lg font-mono font-bold text-red-800 tabular-nums pt-0.5">
                      {formatIDR(selectedProduct.price)}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[10px] font-mono text-stone-500 shrink-0">
                  <span>SKU {selectedProduct.sku}</span>
                  <span>EAN {selectedProduct.barcode}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </section>
    </div>
  );
}
