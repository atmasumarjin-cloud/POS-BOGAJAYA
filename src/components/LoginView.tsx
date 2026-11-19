import React, { useState } from 'react';
import { Delete, Eye, EyeOff, KeyRound, Lock, ShieldCheck, User } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function LoginView() {
  const { loginOperator, settings, operators } = useStore();

  const [username, setUsername] = useState('adminpusat');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = loginOperator(username, pin);
    if (!res.ok) {
      setError(res.error);
    }
  };

  const handlePadDigit = (digit: string) => {
    setError(null);
    setPin((prev) => (prev.length < 6 ? prev + digit : prev));
  };

  const handlePadBackspace = () => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePadClear = () => {
    setError(null);
    setPin('');
  };

  const activeStaffCount = operators.filter((o) => o.active).length;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src="/assets/bogajaya-logo.png"
            alt="Logo Toko Bogajaya"
            className="h-12 w-auto object-contain"
            decoding="async"
          />
          <div>
            <h1 className="text-lg font-bold text-stone-900 tracking-tight">
              Login Kasir &amp; Accurate ERP
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {settings.storeName} · {activeStaffCount} operator aktif terdaftar
            </p>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-stone-700"
            >
              Username Operator
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setError(null);
                  setUsername(e.target.value);
                }}
                placeholder="Contoh: adminpusat"
                className="w-full pl-9 pr-3 py-2.5 text-sm font-medium bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800 focus:bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="login-pin"
              className="block text-xs font-semibold text-stone-700"
            >
              PIN Keamanan (4–6 Digit)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                autoComplete="current-password"
                value={pin}
                onChange={(e) => {
                  setError(null);
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(digitsOnly);
                }}
                placeholder="Masukkan PIN"
                className="w-full pl-9 pr-10 py-2.5 text-sm font-mono tracking-widest bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 rounded"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Touchscreen Numeric PIN Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1" aria-label="Papan angka PIN">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handlePadDigit(digit)}
                className="py-2.5 text-sm font-mono font-bold text-stone-800 bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200 rounded-lg transition-colors"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handlePadClear}
              className="py-2.5 text-xs font-semibold text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors"
            >
              Bersihkan
            </button>
            <button
              type="button"
              onClick={() => handlePadDigit('0')}
              className="py-2.5 text-sm font-mono font-bold text-stone-800 bg-stone-50 hover:bg-stone-100 active:bg-stone-200 border border-stone-200 rounded-lg transition-colors"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePadBackspace}
              aria-label="Hapus 1 digit PIN"
              className="py-2.5 flex items-center justify-center text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors"
            >
              <Delete className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
          >
            <Lock className="w-4 h-4" />
            Masuk ke Bogajaya POS
          </button>
        </form>

        {/* Official Internal Access Notice */}
        <div className="pt-4 border-t border-stone-200 flex items-start gap-2.5 text-xs text-stone-600">
          <ShieldCheck className="w-4 h-4 text-red-800 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-stone-800">Sistem Internal Resmi Toko Bogajaya</p>
            <p className="text-[11px] text-stone-500">
              Akses terbatas hanya bagi operator, manajer, dan administrator berwenang. Hubungi Admin Pusat untuk pembuatan akun baru atau pemulihan PIN akses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
