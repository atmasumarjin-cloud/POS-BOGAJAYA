import React, { useEffect, useState } from 'react';
import { Bluetooth, CheckCircle2, MessageCircle, Printer, Send, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatIDR, type PosTransactionRecord } from '../utils/accounting';
import { buildReceiptLines } from '../utils/printer';
import { buildWhatsAppReceiptMessage, buildWhatsAppUrl } from '../utils/whatsapp';

interface ReceiptModalProps {
  transaction: PosTransactionRecord | null;
  onClose: () => void;
}

export function ReceiptModal({ transaction, onClose }: ReceiptModalProps) {
  const {
    settings,
    printerName,
    printerError,
    connectPrinter,
    printReceipt,
    markWhatsappSent,
  } = useStore();

  const [phoneInput, setPhoneInput] = useState('');
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (transaction) {
      setPhoneInput(transaction.customerPhone || '');
      setPrintStatus(null);
    }
  }, [transaction]);

  if (!transaction) return null;

  const receiptLines = buildReceiptLines(transaction, settings.printerPaperWidth);
  const waMessage = buildWhatsAppReceiptMessage(transaction);
  const waUrl = buildWhatsAppUrl(phoneInput, waMessage);

  const handleBluetoothPrint = async () => {
    setIsPrinting(true);
    setPrintStatus(null);
    try {
      if (!printerName) {
        await connectPrinter();
      }
      const ok = await printReceipt(transaction);
      if (ok) {
        setPrintStatus('Struk berhasil dicetak ke printer Bluetooth ESC/POS.');
      } else {
        setPrintStatus('Gunakan tombol Cetak Browser jika perangkat Bluetooth tidak terhubung.');
      }
    } catch (err: any) {
      setPrintStatus(err?.message || 'Gagal mencetak via Bluetooth.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendWhatsApp = () => {
    markWhatsappSent(transaction.id);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="bg-white border border-stone-200 rounded-xl w-full max-w-4xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <h2 id="receipt-modal-title" className="text-base font-bold text-stone-900">
                Transaksi Berhasil — {transaction.invoiceNo}
              </h2>
              <p className="text-xs text-stone-500">
                Stok &amp; Jurnal Laba Rugi Accurate otomatis diperbarui secara real-time
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal struk"
            className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {/* Left: Thermal Receipt Preview & Bluetooth Printer Controls */}
          <div className="p-6 space-y-4 bg-stone-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">
                Pratinjau Struk Thermal ({settings.printerPaperWidth})
              </h3>
              <span className="text-xs font-mono text-stone-600">
                {printerName ? `BLE: ${printerName}` : 'Printer BLE Siap'}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg p-4 overflow-x-auto space-y-2">
              <div className="flex justify-center pb-1">
                <img
                  src="/assets/bogajaya-logo.png"
                  alt="Logo Toko Bogajaya"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <pre className="font-mono text-xs leading-relaxed text-stone-800 whitespace-pre">
                {receiptLines.join('\n')}
              </pre>
            </div>

            {(printStatus || printerError) && (
              <p className="text-xs text-stone-700 bg-stone-100 border border-stone-200 rounded-lg px-3 py-2">
                {printStatus || printerError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBluetoothPrint}
                disabled={isPrinting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
              >
                <Bluetooth className="w-4 h-4" />
                {isPrinting ? 'Mencetak...' : printerName ? 'Cetak Bluetooth' : 'Hubung & Cetak BLE'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                Cetak PDF / OS
              </button>
            </div>
          </div>

          {/* Right: Automated WhatsApp Receipt Notification */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">
                Notifikasi Struk WhatsApp Pelanggan
              </h3>
              <span className="text-xs font-medium text-emerald-700">
                {transaction.whatsappSent ? 'Terkirim' : 'Siap Dikirim'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wa-phone-input" className="block text-xs font-medium text-stone-700">
                Nomor WhatsApp Pelanggan (Format 08... atau 628...)
              </label>
              <input
                id="wa-phone-input"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-stone-700">
                Pesan Otomatis Struk Belanja
              </span>
              <pre className="font-mono text-xs leading-relaxed text-stone-700 bg-stone-50 border border-stone-200 rounded-lg p-3 max-h-56 overflow-y-auto whitespace-pre-wrap">
                {waMessage}
              </pre>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 flex items-center justify-between text-xs">
              <span className="text-stone-600">Total Dibayar ({transaction.paymentMethod})</span>
              <span className="font-mono font-bold text-stone-900 tabular-nums">
                {formatIDR(transaction.total)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                Kirim Notifikasi WhatsApp
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(waMessage);
                  markWhatsappSent(transaction.id);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                Salin Teks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
