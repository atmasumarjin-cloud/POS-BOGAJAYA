import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '2mb' }));

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'bogajaya-pos-accurate-erp', timestamp: new Date().toISOString() });
});

// Deep Thinking Financial & Inventory CFO Analyst (ThinkingLevel.HIGH)
apiRouter.post('/gemini/analyze', async (req, res) => {
  try {
    const { question, pnl, monthlySales, topLowStock, branch } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Pertanyaan analisis wajib diisi.' });
    }

    const ai = getAiClient();
    const prompt = [
      `Anda adalah Konsultan Akuntansi Accurate & CFO ritel senior untuk "TOKO BOGAJAYA SURABAYA" (Pusat Oleh-Oleh Khas Surabaya sejak 1976).`,
      `Jawab dalam bahasa Indonesia yang ringkas, terstruktur, dan berbasis angka nyata berikut:`,
      `Cabang Aktif: ${branch || 'Semua Cabang'}`,
      `Ringkasan Laba Rugi (P&L Real-Time): ${JSON.stringify(pnl || {})}`,
      `Tren Penjualan Bulanan: ${JSON.stringify(monthlySales || [])}`,
      `Produk Stok Menipis: ${JSON.stringify(topLowStock || [])}`,
      `Pertanyaan Pengguna: ${question}`,
    ].join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    res.json({
      analysis: response.text || 'Tidak ada hasil analisis.',
      model: 'gemini-4-hydrogen',
      thinkingLevel: 'HIGH',
    });
  } catch (err: any) {
    console.error('Gemini analyze error:', err);
    const status = err?.status === 429 ? 429 : err?.status === 403 ? 403 : 500;
    res.status(status).json({
      error: err?.message || 'Gagal menjalankan analisis AI.',
    });
  }
});

// Google Maps Grounding for Surabaya Storefront, Delivery Zones & Supplier Logistics
apiRouter.post('/gemini/maps', async (req, res) => {
  try {
    const { query, lat, lng } = req.body ?? {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query lokasi wajib diisi.' });
    }

    const ai = getAiClient();
    const latitude = typeof lat === 'number' ? lat : -7.2575; // Surabaya Pusat
    const longitude = typeof lng === 'number' ? lng : 112.7521;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Konteks Toko Oleh-Oleh Bogajaya Surabaya (Jl. Genteng Besar / Jl. Raya Rungkut / Sidoarjo). ${query}`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude,
            },
          },
        },
      },
    });

    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    res.json({
      text: response.text || '',
      groundingChunks,
    });
  } catch (err: any) {
    console.error('Gemini Maps grounding error:', err);
    res.status(500).json({
      error: err?.message || 'Gagal mengambil data grounding Google Maps.',
    });
  }
});

// Fast WhatsApp Campaign / Receipt Follow-up Copywriter
apiRouter.post('/gemini/whatsapp-draft', async (req, res) => {
  try {
    const { customerName, tier, favoriteItems, promoNote } = req.body ?? {};
    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Buatkan 1 pesan WhatsApp singkat, ramah, khas Surabaya/Indonesia dari Toko Bogajaya untuk pelanggan setia bernama "${customerName || 'Pelanggan Setia'}" (Tier: ${tier || 'Reguler'}). Item favorit/terakhir: ${favoriteItems || 'Sambal & Kue Blinjo'}. Catatan promo: ${promoNote || 'Gratis bubble wrap & paket oleh-oleh hemat'}. Langsung tulis teks pesannya saja tanpa penjelasan.`,
    });

    res.json({
      message: response.text?.trim() || '',
    });
  } catch (err: any) {
    console.error('Gemini whatsapp draft error:', err);
    res.status(500).json({
      error: err?.message || 'Gagal membuat draf pesan WhatsApp.',
    });
  }
});

// Fast Promo Studio Copy & Poster Generator (with aspect ratio support)
apiRouter.post('/gemini/studio-copy', async (req, res) => {
  try {
    const { productName, price, aspectRatio, campaignGoal } = req.body ?? {};
    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: `Buatkan judul promo singkat (maks 6 kata) dan subjudul persuasif (maks 14 kata) untuk poster promosi produk Toko Bogajaya "${productName}" seharga Rp ${price} dengan rasio ${aspectRatio} untuk tujuan "${campaignGoal || 'Promo Oleh-Oleh Surabaya'}". Format output JSON dengan key "headline" dan "subheadline" tanpa markdown.`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let parsed = { headline: `Promo ${productName}`, subheadline: 'Oleh-oleh khas Surabaya resep kuno sejak 1976.' };
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      // keep safe parsed fallback if model adds whitespace
    }
    res.json(parsed);
  } catch (err: any) {
    console.error('Gemini studio copy error:', err);
    res.status(500).json({
      error: err?.message || 'Gagal membuat teks promosi.',
    });
  }
});
