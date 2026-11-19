import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bluetooth,
  Cloud,
  LogOut,
  MapPin,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Sparkles,
  UserCheck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useStore } from './context/StoreContext';
import { PosView } from './components/PosView';
import { ReceiptModal } from './components/ReceiptModal';
import { LoginView } from './components/LoginView';
import {
  canAccessAppTab,
  getFirstAllowedTab,
  getRoleLabel,
  type AppTabId,
} from './utils/rbac';

const CatalogView = lazy(() =>
  import('./components/CatalogView').then((m) => ({ default: m.CatalogView })),
);
const WarehouseView = lazy(() =>
  import('./components/WarehouseView').then((m) => ({ default: m.WarehouseView })),
);
const AccurateErpView = lazy(() =>
  import('./components/AccurateErpView').then((m) => ({ default: m.AccurateErpView })),
);
const CustomersView = lazy(() =>
  import('./components/CustomersView').then((m) => ({ default: m.CustomersView })),
);
const BranchesMapView = lazy(() =>
  import('./components/BranchesMapView').then((m) => ({ default: m.BranchesMapView })),
);
const StudioAiView = lazy(() =>
  import('./components/StudioAiView').then((m) => ({ default: m.StudioAiView })),
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView })),
);

type AppTab = AppTabId;

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  mobileLabel: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'kasir', label: 'Kasir & POS', mobileLabel: 'Kasir', subtitle: 'Transaksi Tunai & Barcode', icon: ShoppingCart },
  { id: 'katalog', label: 'Katalog Produk', mobileLabel: 'Katalog', subtitle: 'Katalog Resmi Toko Bogajaya', icon: Package },
  { id: 'gudang', label: 'Gudang & Scan', mobileLabel: 'Gudang', subtitle: 'Stok & Mutasi Real-Time', icon: Warehouse },
  { id: 'accurate', label: 'Accurate ERP', mobileLabel: 'Accurate', subtitle: 'Laba Rugi, Hutang/Piutang & Aset', icon: BarChart3 },
  { id: 'pelanggan', label: 'Pelanggan Setia', mobileLabel: 'Pelanggan', subtitle: 'Loyalty & Google Contacts', icon: Users },
  { id: 'peta', label: 'Cabang & Maps', mobileLabel: 'Cabang', subtitle: 'Outlet & Zona Kirim', icon: MapPin },
  { id: 'studio', label: 'Analis AI & Studio', mobileLabel: 'Studio AI', subtitle: 'Audit CFO & Poster Promo', icon: Sparkles },
  { id: 'pengaturan', label: 'Pengaturan', mobileLabel: 'Setelan', subtitle: 'Printer, Role & Cloud Sync', icon: Settings },
];

const MOBILE_BAR_TABS: AppTab[] = ['kasir', 'katalog', 'gudang', 'accurate'];

function ViewLoadingFallback() {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
      <div className="w-7 h-7 border-2 border-red-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs font-semibold text-stone-700">Memuat modul Bogajaya ERP...</p>
    </div>
  );
}

export default function App() {
  const {
    settings,
    products,
    transactions,
    addToCart,
    lastCompletedTx,
    setLastCompletedTx,
    printerName,
    connectPrinter,
    cloudConnected,
    user,
    currentOperator,
    logoutOperator,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AppTab>('kasir');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [quotaBannerDismissed, setQuotaBannerDismissed] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  useEffect(() => {
    if (currentOperator && !canAccessAppTab(currentOperator, activeTab)) {
      setActiveTab(getFirstAllowedTab(currentOperator));
    }
  }, [currentOperator, activeTab]);

  if (!currentOperator) {
    return <LoginView />;
  }

  const allowedNavItems = NAV_ITEMS.filter((item) =>
    canAccessAppTab(currentOperator, item.id)
  );
  const allowedMobileTabs = MOBILE_BAR_TABS.filter((id) =>
    canAccessAppTab(currentOperator, id)
  );
  const currentNav =
    allowedNavItems.find((n) => n.id === activeTab) ||
    allowedNavItems[0] ||
    NAV_ITEMS[0];

  const handleSelectTab = (tab: AppTab) => {
    if (!canAccessAppTab(currentOperator, tab)) return;
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col">
      {quotaExceeded && !quotaBannerDismissed && (
        <div
          role="alert"
          className="sticky top-0 z-50 bg-amber-50 border-b border-amber-300 px-4 py-2.5 text-xs text-amber-950 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Notice: Demo key quota reached or Maps key authorization failed. Set a custom{' '}
              <code>VITE_GOOGLE_MAPS_API_KEY</code> or check usage limits at{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                Google Maps Platform AI Studio Guide
              </a>
              .
            </span>
          </div>
          <button
            type="button"
            onClick={() => setQuotaBannerDismissed(true)}
            aria-label="Tutup pemberitahuan kuota Google Maps"
            className="p-1 rounded hover:bg-amber-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-w-0">
        <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-white border-r border-stone-200 sticky top-0 h-screen">
          <div className="px-4 py-3.5 border-b border-stone-200 flex flex-col items-start gap-1">
            <img
              src="/assets/bogajaya-logo.png"
              alt="Logo Bogajaya"
              className="h-9 w-auto object-contain"
              decoding="async"
            />
            <div className="text-[11px] font-semibold text-stone-500 tracking-wide">
              POS &amp; Accurate ERP
            </div>
          </div>

          <nav aria-label="Menu Utama" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-red-800 text-white font-semibold'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3.5 border-t border-stone-200 space-y-2.5 bg-stone-50">
            <div className="bg-white border border-stone-200 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-900 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-red-800 shrink-0" />
                  {currentOperator.username}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 shrink-0">
                  {getRoleLabel(currentOperator.role)}
                </span>
              </div>
              <div className="text-[11px] text-stone-500 truncate">
                {currentOperator.fullName}
              </div>
              <button
                type="button"
                onClick={logoutOperator}
                className="w-full mt-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Keluar / Ganti Akun
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-600">
              <span>Cabang Aktif</span>
              <span className="font-semibold text-stone-900">{settings.activeBranch}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-600">
              <span>Sinkronisasi</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <Cloud className="w-3 h-3" />
                {user ? 'Cloud Aktif' : cloudConnected ? 'Lokal + Siap' : 'Lokal'}
              </span>
            </div>
          </div>
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-stone-950/50"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative z-10 w-64 max-w-[82vw] bg-white h-full flex flex-col border-r border-stone-200">
              <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between gap-2">
                <img
                  src="/assets/bogajaya-logo.png"
                  alt="Logo Bogajaya"
                  className="h-7 w-auto object-contain"
                  decoding="async"
                />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Tutup menu navigasi"
                  className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav aria-label="Menu Mobile" className="flex-1 p-3 space-y-1 overflow-y-auto">
                {allowedNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs whitespace-nowrap ${
                        isActive
                          ? 'bg-red-800 text-white font-semibold'
                          : 'text-stone-700 hover:bg-stone-100 font-medium'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-stone-200 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-stone-900 truncate">
                    {currentOperator.username}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">
                    {getRoleLabel(currentOperator.role)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    logoutOperator();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-stone-800 bg-white border border-stone-300 rounded-lg"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar / Ganti Operator
                </button>
              </div>
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-200 px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Buka menu navigasi"
                className="lg:hidden p-1.5 -ml-1 text-stone-700 hover:bg-stone-100 rounded-lg shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <img
                src="/assets/bogajaya-logo.png"
                alt="Bogajaya"
                className="lg:hidden h-6 w-auto object-contain shrink-0"
                decoding="async"
              />
              <div className="min-w-0">
                <h1 className="text-sm lg:text-base font-bold text-stone-900 truncate">
                  {currentNav.label}
                </h1>
                <p className="hidden sm:block text-[11px] text-stone-500 truncate">
                  {currentNav.subtitle} · {products.length} SKU
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={logoutOperator}
                title={`Keluar dari ${currentOperator.username}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-600" />
                <span className="hidden md:inline font-mono">{currentOperator.username}</span>
                <span className="text-[10px] font-semibold text-red-800">
                  ({getRoleLabel(currentOperator.role)})
                </span>
              </button>

              <button
                type="button"
                onClick={() => connectPrinter().catch(() => {})}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg whitespace-nowrap shrink-0"
              >
                <Bluetooth className="w-3.5 h-3.5 text-red-800" />
                {printerName ? printerName : 'Printer BLE'}
              </button>

              {transactions[0] && (
                <button
                  type="button"
                  onClick={() => setLastCompletedTx(transactions[0])}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Struk Terakhir</span>
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 max-w-[1440px] w-full mx-auto">
            {activeTab === 'kasir' && canAccessAppTab(currentOperator, 'kasir') && <PosView />}
            {activeTab !== 'kasir' && (
              <Suspense fallback={<ViewLoadingFallback />}>
                {activeTab === 'katalog' && canAccessAppTab(currentOperator, 'katalog') && (
                  <CatalogView
                    onQuickAddPos={(p) => {
                      addToCart(p, 1);
                      if (canAccessAppTab(currentOperator, 'kasir')) {
                        setActiveTab('kasir');
                      }
                    }}
                  />
                )}
                {activeTab === 'gudang' && canAccessAppTab(currentOperator, 'gudang') && <WarehouseView />}
                {activeTab === 'accurate' && canAccessAppTab(currentOperator, 'accurate') && <AccurateErpView />}
                {activeTab === 'pelanggan' && canAccessAppTab(currentOperator, 'pelanggan') && <CustomersView />}
                {activeTab === 'peta' && canAccessAppTab(currentOperator, 'peta') && <BranchesMapView />}
                {activeTab === 'studio' && canAccessAppTab(currentOperator, 'studio') && <StudioAiView />}
                {activeTab === 'pengaturan' && canAccessAppTab(currentOperator, 'pengaturan') && <SettingsView />}
              </Suspense>
            )}
          </main>
        </div>
      </div>

      <nav
        aria-label="Navigasi Cepat Mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 flex items-stretch justify-around h-14 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      >
        {allowedMobileTabs.map((tabId) => {
          const item = NAV_ITEMS.find((n) => n.id === tabId)!;
          const Icon = item.icon;
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => handleSelectTab(tabId)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-red-800' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.mobileLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            !allowedMobileTabs.includes(activeTab)
              ? 'text-red-800'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Menu className="w-4 h-4 shrink-0" />
          <span className="truncate">Lainnya</span>
        </button>
      </nav>

      <ReceiptModal
        transaction={lastCompletedTx}
        onClose={() => setLastCompletedTx(null)}
      />
    </div>
  );
}
