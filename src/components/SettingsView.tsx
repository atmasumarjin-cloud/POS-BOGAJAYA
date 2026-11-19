import React, { useState } from 'react';
import {
  Bluetooth,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Cloud,
  LogOut,
  Printer,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { BranchName, CostingMethod } from '../utils/accounting';
import { RoleAccessPanel } from './RoleAccessPanel';

const BRANCH_OPTIONS: BranchName[] = ['Pusat Genteng', 'Cabang Rungkut', 'Gudang Sidoarjo'];

export function SettingsView() {
  const {
    user,
    cloudConnected,
    cloudSyncedCount,
    signIn,
    signOut,
    settings,
    updateSettings,
    printerName,
    printerError,
    connectPrinter,
  } = useStore();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [openGuideId, setOpenGuideId] = useState<string | null>('rbac');

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (err: any) {
      setAuthError(
        err?.message || 'Gagal masuk dengan Google. Pastikan pop-up browser diizinkan.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* POS Operator Accounts, Roles & Granular Feature Permissions */}
      <RoleAccessPanel />

      {/* Cloud Firestore & Google Account Sync */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-red-800 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Sinkronisasi Cloud &amp; Akun Google Workspace
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Simpan dan sinkronkan transaksi kasir, stok multi-gudang, jurnal Accurate, serta integrasi Google Contacts secara real-time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border ${
                cloudConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-stone-100 text-stone-700 border-stone-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {cloudConnected ? 'Cloud Firestore Terhubung' : 'Mode Offline Lokal'}
            </span>
          </div>
        </div>

        {user ? (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-stone-900">
                {user.displayName || 'Pemilik Toko Bogajaya'}
              </div>
              <div className="text-xs font-mono text-stone-600">{user.email}</div>
              <div className="text-xs text-emerald-700 font-medium">
                Sinkronisasi real-time aktif · {cloudSyncedCount} pembaruan tersinkron
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Keluar Akun
            </button>
          </div>
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-sm font-semibold text-stone-900">
                Hubungkan Akun Google untuk Sinkronisasi Cloud &amp; Kontak
              </div>
              <p className="text-xs text-stone-600">
                Mode kasir lokal tetap berfungsi penuh setiap saat. Masuk dengan akun Google untuk mencadangkan data antar cabang dan mengimpor daftar pelanggan Google Contacts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button shrink-0"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          </div>
        )}

        {authError && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {authError}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store & Printer Settings */}
        <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-red-800" />
            <h2 className="text-base font-bold text-stone-900">
              Operasional Outlet &amp; Printer Thermal Bluetooth
            </h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="store-name-input" className="block text-xs font-semibold text-stone-700">
                Nama Toko pada Struk &amp; Laporan
              </label>
              <input
                id="store-name-input"
                type="text"
                value={settings.storeName}
                onChange={(e) => updateSettings({ storeName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="branch-select" className="block text-xs font-semibold text-stone-700">
                Cabang Kasir / Gudang Default
              </label>
              <select
                id="branch-select"
                value={settings.activeBranch}
                onChange={(e) => updateSettings({ activeBranch: e.target.value as BranchName })}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="paper-width" className="block text-xs font-semibold text-stone-700">
                  Lebar Kertas Thermal
                </label>
                <select
                  id="paper-width"
                  value={settings.printerPaperWidth}
                  onChange={(e) =>
                    updateSettings({ printerPaperWidth: e.target.value as '58mm' | '80mm' })
                  }
                  className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
                >
                  <option value="58mm">58mm (32 kolom)</option>
                  <option value="80mm">80mm (42 kolom)</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => connectPrinter().catch(() => {})}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Bluetooth className="w-4 h-4" />
                  {printerName ? `Terhubung: ${printerName}` : 'Pasangkan Printer BLE'}
                </button>
              </div>
            </div>

            {printerError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {printerError}
              </p>
            )}

            <div className="space-y-2.5 pt-2 border-t border-stone-200">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-medium text-stone-800 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-stone-500" />
                  Cetak struk Bluetooth otomatis setelah bayar tunai
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoPrintReceipt}
                  onChange={(e) => updateSettings({ autoPrintReceipt: e.target.checked })}
                  className="w-4 h-4 accent-red-800"
                />
              </label>

              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs font-medium text-stone-800">
                  Siapkan notifikasi struk WhatsApp otomatis setiap transaksi selesai
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoWhatsappReceipt}
                  onChange={(e) => updateSettings({ autoWhatsappReceipt: e.target.checked })}
                  className="w-4 h-4 accent-red-800"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Accurate ERP & Vercel Cloud Architecture */}
        <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-800" />
            <h2 className="text-base font-bold text-stone-900">
              Kebijakan Akuntansi Accurate &amp; Infrastruktur Vercel
            </h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="costing-select" className="block text-xs font-semibold text-stone-700">
                Metode Penilaian Persediaan (HPP)
              </label>
              <select
                id="costing-select"
                value={settings.costingMethod}
                onChange={(e) =>
                  updateSettings({ costingMethod: e.target.value as CostingMethod })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
              >
                <option value="FIFO">FIFO (First-In, First-Out)</option>
                <option value="AVERAGE">Average (Rata-Rata Bergerak)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tax-rate-select" className="block text-xs font-semibold text-stone-700">
                Tarif PPN Kasir &amp; Smart Link Tax
              </label>
              <select
                id="tax-rate-select"
                value={String(settings.taxRatePercent)}
                onChange={(e) => updateSettings({ taxRatePercent: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg"
              >
                <option value="0">0% — Harga Sudah Termasuk / UMKM Non-PKP</option>
                <option value="11">11% — PPN Standar Terpisah (PKP)</option>
              </select>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-stone-900">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-red-800 shrink-0" />
                  Panduan Penggunaan Pengaturan (Pilih Topik Dropdown)
                </span>
              </div>

              <div className="space-y-1.5">
                {[
                  {
                    id: 'rbac',
                    title: '1. Pengaturan Akun Login, Role & Izin Fitur',
                    steps: [
                      'Buka panel "Template Izin Akses Role" di bagian atas, pilih tab Karyawan atau Manajer, lalu centang fitur yang diizinkan sebagai standar role.',
                      'Klik "Terapkan Template ke Semua Akun" apabila ingin menyamakan izin akses seluruh akun pada role tersebut.',
                      'Untuk menambah akun baru, isi Username (huruf kecil min. 3 karakter), Nama Lengkap, Role, PIN 4–6 digit, dan Cabang tugas, lalu sesuaikan centang izin khusus per akun jika diperlukan.',
                      'Pada "Daftar Akun Operator Login", gunakan "Ubah Izin & PIN" untuk reset PIN/hak akses, "Nonaktifkan" untuk membekukan akses sementara, atau "Hapus" untuk menghapus akun.',
                    ],
                  },
                  {
                    id: 'printer',
                    title: '2. Printer Thermal Bluetooth & Notifikasi WhatsApp',
                    steps: [
                      'Nyalakan printer thermal Bluetooth (protokol ESC/POS BLE) dan pastikan menggunakan browser Chrome atau Edge.',
                      'Pilih ukuran kertas di "Lebar Kertas Thermal": 58mm (32 kolom) untuk printer mini portabel atau 80mm (42 kolom) untuk meja kasir utama.',
                      'Klik "Pasangkan Printer BLE" lalu pilih perangkat printer Anda dari daftar pairing browser hingga status berubah menjadi Terhubung.',
                      'Centang "Cetak struk Bluetooth otomatis" agar struk langsung tercetak setelah bayar tunai, serta aktifkan opsi WhatsApp untuk menyiapkan pesan struk digital ke pelanggan.',
                    ],
                  },
                  {
                    id: 'accounting',
                    title: '3. Operasional Outlet, Metode HPP & Tarif PPN Accurate',
                    steps: [
                      'Isi "Nama Toko pada Struk & Laporan" untuk menyesuaikan header nota cetak, lalu pilih "Cabang Kasir / Gudang Default" sesuai lokasi outlet aktif.',
                      'Pada "Metode Penilaian Persediaan (HPP)", pilih FIFO untuk menghitung harga pokok dari stok masuk paling awal (disarankan untuk produk kue & makanan) atau Average untuk rata-rata biaya beli.',
                      'Pada "Tarif PPN Kasir & Smart Link Tax", gunakan 0% bila harga jual sudah final (UMKM Non-PKP), atau pilih 11% (PKP) untuk memisahkan PPN Keluaran di struk dan ekspor e-Faktur Accurate.',
                    ],
                  },
                  {
                    id: 'cloud',
                    title: '4. Sinkronisasi Cloud Firestore & Google Contacts',
                    steps: [
                      'Aplikasi tetap menyimpan transaksi kasir, stok gudang, dan jurnal Accurate secara lokal sehingga kasir tetap berjalan normal walau internet tidak stabil.',
                      'Klik "Sign in with Google" pada kartu Sinkronisasi Cloud untuk menghubungkan penyimpanan real-time ke Cloud Firestore antar perangkat dan cabang.',
                      'Setelah login Google aktif, buka menu "Pelanggan Setia" untuk mengimpor daftar nomor pelanggan langsung dari Google Contacts guna mempercepat pengiriman struk WhatsApp.',
                    ],
                  },
                ].map((guide) => {
                  const isOpen = openGuideId === guide.id;
                  return (
                    <div
                      key={guide.id}
                      className="bg-white border border-stone-200 rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenGuideId(isOpen ? null : guide.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
                      >
                        <span>{guide.title}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-stone-500 shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <ol className="px-4 pb-3 pt-1.5 border-t border-stone-100 text-[11px] text-stone-600 space-y-1.5 list-decimal pl-7 leading-relaxed">
                          {guide.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
