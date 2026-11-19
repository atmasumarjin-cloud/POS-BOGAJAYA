import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  auth,
  db,
  getWorkspaceAccessToken,
  handleFirestoreError,
  OperationType,
  signInWithGoogleWorkspace,
  signOutAccount,
  subscribeAuth,
  testFirestoreConnection,
} from '../lib/firebase';
import { BOGAJAYA_INITIAL_CATALOG, type BogajayaProduct } from '../data/bogajayaCatalog';
import {
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_FIXED_ASSETS,
  INITIAL_JOURNALS,
  INITIAL_PURCHASES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_TRANSACTIONS,
  type CustomerRecord,
} from '../data/seedData';
import {
  buildPurchaseInvoiceJournals,
  buildRestockJournal,
  buildSaleJournals,
  buildSalesReturnJournals,
  calculateCheckoutTotals,
  calculateInventoryValuation,
  calculateMonthlyDepreciation,
  calculateMonthlySales,
  calculateProfitAndLoss,
  calculateTrialBalance,
  getBranchStock,
  type AccurateJournalEntry,
  type BranchName,
  type CartItem,
  type CostingMethod,
  type FixedAssetRecord,
  type HeldOrderRecord,
  type MonthlySalesRow,
  type OperatingExpense,
  type PaymentMethod,
  type PosTransactionRecord,
  type ProfitAndLossSummary,
  type PurchaseInvoiceRecord,
  type StockMovementRecord,
  type TrialBalanceRow,
} from '../utils/accounting';
import {
  buildEscPosReceiptBytes,
  connectBluetoothThermalPrinter,
  writeEscPosToCharacteristic,
} from '../utils/printer';
import {
  ALL_FEATURE_PERMISSIONS,
  authenticateOperator,
  DEFAULT_ROLE_PERMISSIONS,
  ensureDefaultAdminPresent,
  normalizeUsername,
  validateOperatorInput,
  type FeaturePermission,
  type OperatorRole,
  type PosOperator,
  type RolePermissionsMap,
} from '../utils/rbac';
import {
  validateAndBuildNewProduct,
  type NewCatalogProductInput,
} from '../utils/catalog';

interface StoreSettingsState {
  storeName: string;
  activeBranch: BranchName;
  taxRatePercent: number;
  printerPaperWidth: '58mm' | '80mm';
  autoPrintReceipt: boolean;
  autoWhatsappReceipt: boolean;
  costingMethod: CostingMethod;
}

interface StoreContextValue {
  // Auth & Cloud Sync
  user: User | null;
  authReady: boolean;
  cloudConnected: boolean;
  cloudSyncedCount: number;
  workspaceToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;

  // POS Operator Login & RBAC
  operators: PosOperator[];
  rolePermissions: RolePermissionsMap;
  currentOperator: PosOperator | null;
  loginOperator: (
    username: string,
    pin: string
  ) => { ok: true; operator: PosOperator } | { ok: false; error: string };
  logoutOperator: () => void;
  addOperator: (input: {
    username: string;
    fullName: string;
    role: OperatorRole;
    pin: string;
    branch: BranchName;
    permissions: FeaturePermission[];
  }) => { ok: true; operator: PosOperator } | { ok: false; error: string };
  updateOperator: (
    id: string,
    patch: {
      fullName?: string;
      role?: OperatorRole;
      pin?: string;
      branch?: BranchName;
      permissions?: FeaturePermission[];
      active?: boolean;
    }
  ) => { ok: true } | { ok: false; error: string };
  deleteOperator: (id: string) => void;
  updateRolePermissions: (
    role: OperatorRole,
    permissions: FeaturePermission[],
    applyToExisting?: boolean
  ) => void;

  // Core Data
  products: BogajayaProduct[];
  addCatalogProduct: (
    input: NewCatalogProductInput
  ) => { ok: true; product: BogajayaProduct } | { ok: false; error: string };
  transactions: PosTransactionRecord[];
  customers: CustomerRecord[];
  journals: AccurateJournalEntry[];
  stockMovements: StockMovementRecord[];
  expenses: OperatingExpense[];
  purchases: PurchaseInvoiceRecord[];
  fixedAssets: FixedAssetRecord[];
  heldOrders: HeldOrderRecord[];
  settings: StoreSettingsState;
  updateSettings: (patch: Partial<StoreSettingsState>) => void;

  // Derived Accurate ERP Analytics
  pnl: ProfitAndLossSummary;
  monthlySales: MonthlySalesRow[];
  inventoryValuation: ReturnType<typeof calculateInventoryValuation>;
  trialBalance: {
    rows: TrialBalanceRow[];
    totalDebit: number;
    totalCredit: number;
  };

  // Cart & POS Actions
  cart: CartItem[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  addToCart: (product: BogajayaProduct, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  holdCurrentCart: (label: string, orderDiscount: number) => void;
  resumeHeldOrder: (heldId: string) => number;
  deleteHeldOrder: (heldId: string) => void;
  completeSale: (params: {
    paymentMethod: PaymentMethod;
    cashReceived: number;
    orderDiscount: number;
    customerPhoneOverride?: string;
  }) => Promise<PosTransactionRecord>;
  voidOrReturnSale: (txId: string) => void;
  settleReceivable: (txId: string, method: 'Tunai' | 'QRIS' | 'Transfer Bank') => void;
  lastCompletedTx: PosTransactionRecord | null;
  setLastCompletedTx: (tx: PosTransactionRecord | null) => void;
  markWhatsappSent: (txId: string) => void;

  // Warehouse & Accurate ERP Accounting Actions
  adjustWarehouseStock: (params: {
    product: BogajayaProduct;
    warehouse: BranchName;
    movementType: 'IN' | 'OUT' | 'TRANSFER' | 'OPNAME';
    quantity: number;
    targetWarehouse?: BranchName;
    note: string;
  }) => Promise<void>;
  recordExpense: (params: {
    category: string;
    description: string;
    amount: number;
    branch: BranchName;
  }) => Promise<void>;
  createPurchaseInvoice: (params: {
    supplierName: string;
    branch: BranchName;
    product: BogajayaProduct;
    qty: number;
    unitCost: number;
    includePpn: boolean;
    paymentType: 'Tunai' | 'Kredit';
  }) => Promise<PurchaseInvoiceRecord>;
  settlePurchaseInvoice: (poId: string, payAccount: '1101 - Kas Kasir Tunai' | '1103 - Bank Mandiri Operasional') => void;
  addFixedAsset: (params: {
    name: string;
    category: FixedAssetRecord['category'];
    branch: BranchName;
    acquisitionCost: number;
    salvageValue: number;
    usefulLifeMonths: number;
  }) => void;
  runMonthlyDepreciation: () => { count: number; totalDepreciation: number };
  addCustomer: (customer: Omit<CustomerRecord, 'id' | 'points' | 'totalSpent' | 'visitCount'>) => Promise<CustomerRecord>;
  importGoogleContactsCustomers: (contacts: Array<{ name: string; phone: string; email: string; address: string }>) => Promise<number>;

  // Bluetooth Thermal Printer
  printerName: string | null;
  printerError: string | null;
  connectPrinter: () => Promise<void>;
  printReceipt: (tx: PosTransactionRecord) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const LOCAL_STORAGE_KEY = 'bogajaya_pos_erp_state_v3';
const OPERATOR_SESSION_KEY = 'bogajaya_pos_operator_session_v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [cloudSyncedCount, setCloudSyncedCount] = useState(0);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);

  const loadInitial = () => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore parse errors
    }
    return null;
  };

  const saved = useMemo(() => loadInitial(), []);

  const [products, setProducts] = useState<BogajayaProduct[]>(
    () => saved?.products || BOGAJAYA_INITIAL_CATALOG
  );
  const [transactions, setTransactions] = useState<PosTransactionRecord[]>(
    () => saved?.transactions || INITIAL_TRANSACTIONS
  );
  const [customers, setCustomers] = useState<CustomerRecord[]>(
    () => saved?.customers || INITIAL_CUSTOMERS
  );
  const [journals, setJournals] = useState<AccurateJournalEntry[]>(
    () => saved?.journals || INITIAL_JOURNALS
  );
  const [stockMovements, setStockMovements] = useState<StockMovementRecord[]>(
    () => saved?.stockMovements || INITIAL_STOCK_MOVEMENTS
  );
  const [expenses, setExpenses] = useState<OperatingExpense[]>(
    () => saved?.expenses || INITIAL_EXPENSES
  );
  const [purchases, setPurchases] = useState<PurchaseInvoiceRecord[]>(
    () => saved?.purchases || INITIAL_PURCHASES
  );
  const [fixedAssets, setFixedAssets] = useState<FixedAssetRecord[]>(
    () => saved?.fixedAssets || INITIAL_FIXED_ASSETS
  );
  const [heldOrders, setHeldOrders] = useState<HeldOrderRecord[]>(
    () => saved?.heldOrders || []
  );
  const [settings, setSettings] = useState<StoreSettingsState>(
    () =>
      saved?.settings || {
        storeName: 'TOKO BOGAJAYA SURABAYA',
        activeBranch: 'Pusat Genteng',
        taxRatePercent: 0,
        printerPaperWidth: '58mm',
        autoPrintReceipt: true,
        autoWhatsappReceipt: true,
        costingMethod: 'FIFO',
      }
  );

  const [operators, setOperators] = useState<PosOperator[]>(() =>
    ensureDefaultAdminPresent(Array.isArray(saved?.operators) ? saved.operators : [])
  );
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap>(() => ({
    admin: [...ALL_FEATURE_PERMISSIONS],
    manajer: Array.isArray(saved?.rolePermissions?.manajer)
      ? saved.rolePermissions.manajer
      : [...DEFAULT_ROLE_PERMISSIONS.manajer],
    karyawan: Array.isArray(saved?.rolePermissions?.karyawan)
      ? saved.rolePermissions.karyawan
      : [...DEFAULT_ROLE_PERMISSIONS.karyawan],
  }));
  const [currentOperatorId, setCurrentOperatorId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(OPERATOR_SESSION_KEY);
    } catch {
      return null;
    }
  });

  const currentOperator = useMemo(() => {
    if (!currentOperatorId) return null;
    const found = operators.find((op) => op.id === currentOperatorId);
    return found && found.active ? found : null;
  }, [operators, currentOperatorId]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cust-umum');
  const [lastCompletedTx, setLastCompletedTx] = useState<PosTransactionRecord | null>(null);

  const printerCharRef = useRef<any>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [printerError, setPrinterError] = useState<string | null>(null);

  // Persist locally for instant resilience & reload continuity
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          products,
          transactions,
          customers,
          journals,
          stockMovements,
          expenses,
          purchases,
          fixedAssets,
          heldOrders,
          settings,
          operators,
          rolePermissions,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [
    products,
    transactions,
    customers,
    journals,
    stockMovements,
    expenses,
    purchases,
    fixedAssets,
    heldOrders,
    settings,
    operators,
    rolePermissions,
  ]);

  useEffect(() => {
    try {
      if (currentOperatorId) {
        localStorage.setItem(OPERATOR_SESSION_KEY, currentOperatorId);
      } else {
        localStorage.removeItem(OPERATOR_SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [currentOperatorId]);

  // Boot Firestore check & Auth subscription
  useEffect(() => {
    testFirestoreConnection().then((ok) => setCloudConnected(ok));
    const unsub = subscribeAuth((u) => {
      setUser(u);
      setWorkspaceToken(getWorkspaceAccessToken());
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const unsubs: Array<() => void> = [];

    const qProducts = query(collection(db, 'pos_products'), where('ownerUid', '==', uid));
    unsubs.push(
      onSnapshot(
        qProducts,
        (snap) => {
          if (!snap.empty) {
            const overrides: Record<string, any> = {};
            snap.docs.forEach((d) => {
              const data = d.data();
              overrides[data.productId] = data;
            });
            setProducts((prev) => {
              const updated = prev.map((p) => {
                const ov = overrides[p.id];
                if (!ov) return p;
                return {
                  ...p,
                  price: typeof ov.price === 'number' ? ov.price : p.price,
                  costPrice: typeof ov.costPrice === 'number' ? ov.costPrice : p.costPrice,
                  stockPusat: typeof ov.stockPusat === 'number' ? ov.stockPusat : p.stockPusat,
                  stockRungkut: typeof ov.stockRungkut === 'number' ? ov.stockRungkut : p.stockRungkut,
                  stockSidoarjo: typeof ov.stockSidoarjo === 'number' ? ov.stockSidoarjo : p.stockSidoarjo,
                  minStock: typeof ov.minStock === 'number' ? ov.minStock : p.minStock,
                };
              });
              const existingIds = new Set(updated.map((p) => p.id));
              const cloudOnly: BogajayaProduct[] = Object.values(overrides)
                .filter((ov) => ov?.productId && !existingIds.has(ov.productId))
                .map((ov) => ({
                  id: String(ov.productId),
                  sku: String(ov.sku || ov.productId),
                  barcode: String(ov.barcode || ''),
                  name: String(ov.name || 'Produk Bogajaya'),
                  category: String(ov.category || 'PRODUK BARU'),
                  categories: [String(ov.category || 'PRODUK BARU')],
                  price: typeof ov.price === 'number' ? ov.price : 0,
                  regularPrice: typeof ov.price === 'number' ? ov.price : 0,
                  costPrice: typeof ov.costPrice === 'number' ? ov.costPrice : 0,
                  image: '',
                  remoteImage: '',
                  shortDesc: `${String(ov.name || 'Produk Bogajaya')} — Produk Katalog Bogajaya.`,
                  description: `${String(ov.name || 'Produk Bogajaya')} — Produk Katalog Bogajaya.`,
                  permalink: '',
                  weightGrams: 250,
                  unit: 'Pcs',
                  isBundle: false,
                  stockPusat: typeof ov.stockPusat === 'number' ? ov.stockPusat : 0,
                  stockRungkut: typeof ov.stockRungkut === 'number' ? ov.stockRungkut : 0,
                  stockSidoarjo: typeof ov.stockSidoarjo === 'number' ? ov.stockSidoarjo : 0,
                  minStock: typeof ov.minStock === 'number' ? ov.minStock : 5,
                }));
              return cloudOnly.length > 0 ? [...cloudOnly, ...updated] : updated;
            });
            setCloudSyncedCount((c) => c + snap.size);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'pos_products')
      )
    );

    const qTx = query(collection(db, 'pos_transactions'), where('ownerUid', '==', uid));
    unsubs.push(
      onSnapshot(
        qTx,
        (snap) => {
          if (!snap.empty) {
            const cloudTxs: PosTransactionRecord[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                invoiceNo: data.invoiceNo,
                branch: data.branch,
                customerId: data.customerId,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                paymentMethod: data.paymentMethod,
                subtotal: data.subtotal,
                discount: data.discount,
                taxAmount: data.taxAmount,
                total: data.total,
                totalCogs: data.totalCogs,
                cashReceived: data.cashReceived,
                changeAmount: data.changeAmount,
                itemCount: data.itemCount,
                itemsSummary: data.itemsSummary,
                items: [],
                whatsappSent: Boolean(data.whatsappSent),
                status: data.status,
                createdAtIso:
                  data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
              };
            });
            setTransactions((prev) => {
              const existingMap: Record<string, PosTransactionRecord> = {};
              for (const t of prev) existingMap[t.id] = t;
              for (const ct of cloudTxs) {
                existingMap[ct.id] = {
                  ...ct,
                  items: existingMap[ct.id]?.items || [],
                };
              }
              return Object.values(existingMap).sort((a, b) =>
                b.createdAtIso.localeCompare(a.createdAtIso)
              );
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'pos_transactions')
      )
    );

    const qCust = query(collection(db, 'pos_customers'), where('ownerUid', '==', uid));
    unsubs.push(
      onSnapshot(
        qCust,
        (snap) => {
          if (!snap.empty) {
            const cloudCusts: CustomerRecord[] = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                name: data.name,
                phone: data.phone,
                email: data.email || '',
                tier: data.tier,
                points: data.points,
                totalSpent: data.totalSpent,
                visitCount: data.visitCount,
                address: data.address || '',
                notes: data.notes || '',
              };
            });
            setCustomers((prev) => {
              const map: Record<string, CustomerRecord> = {};
              for (const c of prev) map[c.id] = c;
              for (const cc of cloudCusts) map[cc.id] = cc;
              return Object.values(map);
            });
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'pos_customers')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user]);

  const signIn = useCallback(async () => {
    const res = await signInWithGoogleWorkspace();
    setUser(res.user);
    setWorkspaceToken(res.accessToken);
  }, []);

  const signOut = useCallback(async () => {
    await signOutAccount();
    setUser(null);
    setWorkspaceToken(null);
  }, []);

  const updateSettings = useCallback((patch: Partial<StoreSettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (auth.currentUser?.emailVerified) {
        const docId = auth.currentUser.uid;
        setDoc(
          doc(db, 'pos_settings', docId),
          {
            ownerUid: auth.currentUser.uid,
            storeName: next.storeName,
            activeBranch: next.activeBranch,
            taxRatePercent: next.taxRatePercent,
            printerPaperWidth: next.printerPaperWidth,
            autoPrintReceipt: next.autoPrintReceipt,
            autoWhatsappReceipt: next.autoWhatsappReceipt,
            costingMethod: next.costingMethod,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }
      return next;
    });
  }, []);

  const addToCart = useCallback((product: BogajayaProduct, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...prev, { product, quantity: qty, discountPerUnit: 0 }];
    });
  }, []);

  const updateCartQty = useCallback((productId: string, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((i) => i.product.id !== productId);
      return prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i));
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const holdCurrentCart = useCallback(
    (label: string, orderDiscount: number) => {
      if (cart.length === 0) return;
      const newHold: HeldOrderRecord = {
        id: `hold_${Date.now()}`,
        label: label.trim() || `Antrian #${heldOrders.length + 1}`,
        customerId: selectedCustomerId,
        items: cart,
        orderDiscount,
        createdAtIso: new Date().toISOString(),
      };
      setHeldOrders((prev) => [newHold, ...prev]);
      setCart([]);
      setSelectedCustomerId('cust-umum');
    },
    [cart, heldOrders.length, selectedCustomerId]
  );

  const resumeHeldOrder = useCallback(
    (heldId: string): number => {
      const found = heldOrders.find((h) => h.id === heldId);
      if (!found) return 0;
      setCart(found.items);
      setSelectedCustomerId(found.customerId || 'cust-umum');
      setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
      return found.orderDiscount;
    },
    [heldOrders]
  );

  const deleteHeldOrder = useCallback((heldId: string) => {
    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
  }, []);

  const connectPrinter = useCallback(async () => {
    setPrinterError(null);
    try {
      const res = await connectBluetoothThermalPrinter();
      printerCharRef.current = res.characteristic;
      setPrinterName(res.name);
    } catch (err: any) {
      setPrinterError(err?.message || 'Gagal menghubungkan printer Bluetooth.');
      throw err;
    }
  }, []);

  const printReceipt = useCallback(
    async (tx: PosTransactionRecord): Promise<boolean> => {
      if (!printerCharRef.current) {
        return false;
      }
      try {
        const bytes = buildEscPosReceiptBytes(tx, settings.printerPaperWidth);
        await writeEscPosToCharacteristic(printerCharRef.current, bytes);
        return true;
      } catch (err: any) {
        setPrinterError(err?.message || 'Gagal mengirim data ke printer Bluetooth.');
        return false;
      }
    },
    [settings.printerPaperWidth]
  );

  const syncProductToCloud = useCallback(async (p: BogajayaProduct) => {
    if (!auth.currentUser?.emailVerified) return;
    const uid = auth.currentUser.uid;
    const docId = `${uid}_${p.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    try {
      await setDoc(doc(db, 'pos_products', docId), {
        ownerUid: uid,
        productId: p.id,
        sku: p.sku.slice(0, 64),
        barcode: p.barcode.slice(0, 32),
        name: p.name.slice(0, 200),
        category: p.category.slice(0, 80),
        price: p.price,
        costPrice: p.costPrice,
        stockPusat: p.stockPusat,
        stockRungkut: p.stockRungkut,
        stockSidoarjo: p.stockSidoarjo,
        minStock: p.minStock,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pos_products/${docId}`);
    }
  }, []);

  const addCatalogProduct = useCallback(
    (
      input: NewCatalogProductInput
    ): { ok: true; product: BogajayaProduct } | { ok: false; error: string } => {
      const res = validateAndBuildNewProduct(input, products);
      if (!res.ok) {
        return res;
      }
      setProducts((prev) => [res.product, ...prev]);
      syncProductToCloud(res.product).catch(() => {});
      return res;
    },
    [products, syncProductToCloud]
  );

  const completeSale = useCallback(
    async ({
      paymentMethod,
      cashReceived,
      orderDiscount,
      customerPhoneOverride,
    }: {
      paymentMethod: PaymentMethod;
      cashReceived: number;
      orderDiscount: number;
      customerPhoneOverride?: string;
    }) => {
      if (cart.length === 0) {
        throw new Error('Keranjang belanja masih kosong.');
      }

      const totals = calculateCheckoutTotals(
        cart,
        orderDiscount,
        settings.taxRatePercent,
        paymentMethod === 'Tunai' ? cashReceived : Number.MAX_SAFE_INTEGER
      );

      if (paymentMethod === 'Tunai' && cashReceived < totals.total) {
        throw new Error('Nominal uang tunai kurang dari total tagihan.');
      }

      const customer =
        customers.find((c) => c.id === selectedCustomerId) || customers[0];
      const nowIso = new Date().toISOString();
      const txId = `tx_${Date.now()}`;
      const invoiceNo = `BGJ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(
        transactions.length + 1
      ).padStart(3, '0')}`;

      const items = cart.map((item) => ({
        productId: item.product.id,
        sku: item.product.sku,
        barcode: item.product.barcode,
        name: item.product.name,
        qty: item.quantity,
        unitPrice: item.product.price,
        unitCost: item.product.costPrice,
        lineTotal: item.product.price * item.quantity,
      }));

      const itemCount = items.reduce((s, i) => s + i.qty, 0);
      const itemsSummary = items
        .map((i) => `${i.name} x${i.qty}`)
        .join(', ')
        .slice(0, 950);

      const isTempo = paymentMethod === 'Piutang / Tempo';
      const dueDateIso = isTempo
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const newTx: PosTransactionRecord = {
        id: txId,
        invoiceNo,
        branch: settings.activeBranch,
        customerId: customer?.id,
        customerName: customer?.name || 'Pelanggan Umum (Walk-In)',
        customerPhone: customerPhoneOverride || customer?.phone || '',
        paymentMethod,
        subtotal: totals.subtotal,
        discount: totals.totalDiscount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        totalCogs: totals.totalCogs,
        cashReceived: paymentMethod === 'Tunai' ? cashReceived : isTempo ? 0 : totals.total,
        changeAmount: paymentMethod === 'Tunai' ? totals.changeAmount : 0,
        paidAmount: isTempo ? 0 : totals.total,
        receivableStatus: isTempo ? 'belum_lunas' : 'lunas',
        dueDateIso,
        itemCount,
        itemsSummary,
        items,
        whatsappSent: false,
        status: 'completed',
        createdAtIso: nowIso,
      };

      const updatedProductsList: BogajayaProduct[] = [];
      const newMovements: StockMovementRecord[] = [];
      const soldQtyMap = new Map<string, number>();
      for (const item of cart) {
        soldQtyMap.set(item.product.id, (soldQtyMap.get(item.product.id) || 0) + item.quantity);
      }

      products.forEach((p, idx) => {
        const qtySold = soldQtyMap.get(p.id);
        if (!qtySold) return;
        const next = { ...p };
        if (settings.activeBranch === 'Pusat Genteng') {
          next.stockPusat = Math.max(0, next.stockPusat - qtySold);
        } else if (settings.activeBranch === 'Cabang Rungkut') {
          next.stockRungkut = Math.max(0, next.stockRungkut - qtySold);
        } else {
          next.stockSidoarjo = Math.max(0, next.stockSidoarjo - qtySold);
        }
        updatedProductsList.push(next);
        newMovements.push({
          id: `mov_${Date.now()}_${idx}_${p.id}`,
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          movementType: 'OUT',
          warehouse: settings.activeBranch,
          quantityDelta: -qtySold,
          unitCost: p.costPrice,
          note: `Penjualan POS ${invoiceNo}`,
          createdAtIso: nowIso,
        });
      });

      setProducts((prev) =>
        prev.map((p) => {
          const qtySold = soldQtyMap.get(p.id);
          if (!qtySold) return p;
          const next = { ...p };
          if (settings.activeBranch === 'Pusat Genteng') {
            next.stockPusat = Math.max(0, next.stockPusat - qtySold);
          } else if (settings.activeBranch === 'Cabang Rungkut') {
            next.stockRungkut = Math.max(0, next.stockRungkut - qtySold);
          } else {
            next.stockSidoarjo = Math.max(0, next.stockSidoarjo - qtySold);
          }
          return next;
        })
      );

      const saleJournals = buildSaleJournals(newTx);
      setTransactions((prev) => [newTx, ...prev]);
      setJournals((prev) => [...saleJournals, ...prev]);
      setStockMovements((prev) => [...newMovements, ...prev]);

      if (customer && customer.id !== 'cust-umum') {
        const earnedPoints = Math.floor(totals.total / 10000) * 5;
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id !== customer.id) return c;
            const nextSpent = c.totalSpent + totals.total;
            const nextTier: CustomerRecord['tier'] =
              nextSpent >= 4000000
                ? 'VIP'
                : nextSpent >= 1500000
                  ? 'Gold'
                  : nextSpent >= 500000
                    ? 'Silver'
                    : 'Reguler';
            return {
              ...c,
              points: c.points + earnedPoints,
              totalSpent: nextSpent,
              visitCount: c.visitCount + 1,
              tier: nextTier,
            };
          })
        );
      }

      setCart([]);
      setLastCompletedTx(newTx);

      if (settings.autoPrintReceipt && printerCharRef.current) {
        await printReceipt(newTx);
      }

      if (auth.currentUser?.emailVerified) {
        const uid = auth.currentUser.uid;
        try {
          await setDoc(doc(db, 'pos_transactions', txId), {
            ownerUid: uid,
            invoiceNo: newTx.invoiceNo,
            branch: newTx.branch,
            customerId: (newTx.customerId || '').slice(0, 64),
            customerName: newTx.customerName.slice(0, 120),
            customerPhone: (newTx.customerPhone || '').slice(0, 32),
            paymentMethod: newTx.paymentMethod,
            subtotal: newTx.subtotal,
            discount: newTx.discount,
            taxAmount: newTx.taxAmount,
            total: newTx.total,
            totalCogs: newTx.totalCogs,
            cashReceived: newTx.cashReceived,
            changeAmount: newTx.changeAmount,
            itemCount: newTx.itemCount,
            itemsSummary: newTx.itemsSummary.slice(0, 1000),
            whatsappSent: newTx.whatsappSent,
            status: newTx.status,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          for (const j of saleJournals) {
            await setDoc(doc(db, 'pos_journals', j.id), {
              ownerUid: uid,
              journalNo: j.journalNo,
              sourceType: j.sourceType,
              referenceNo: j.referenceNo,
              description: j.description.slice(0, 300),
              debitAccount: j.debitAccount,
              creditAccount: j.creditAccount,
              amount: j.amount,
              branch: j.branch,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          for (const up of updatedProductsList) {
            await syncProductToCloud(up);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `pos_transactions/${txId}`);
        }
      }

      return newTx;
    },
    [
      cart,
      customers,
      printReceipt,
      products,
      selectedCustomerId,
      settings.activeBranch,
      settings.autoPrintReceipt,
      settings.taxRatePercent,
      syncProductToCloud,
      transactions.length,
    ]
  );

  const voidOrReturnSale = useCallback(
    (txId: string) => {
      const target = transactions.find((t) => t.id === txId);
      if (!target || target.status === 'voided') return;

      const returnMovements: StockMovementRecord[] = target.items.map((item, idx) => ({
        id: `mov_ret_${Date.now()}_${idx}_${item.productId}`,
        productId: item.productId,
        sku: item.sku,
        productName: item.name,
        movementType: 'RETURN',
        warehouse: target.branch,
        quantityDelta: item.qty,
        unitCost: item.unitCost,
        note: `Retur Penjualan ${target.invoiceNo}`,
        createdAtIso: new Date().toISOString(),
      }));

      const qtyByProduct = new Map<string, number>();
      for (const item of target.items) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + item.qty);
      }

      setProducts((prev) =>
        prev.map((p) => {
          const restored = qtyByProduct.get(p.id);
          if (!restored) return p;
          const next = { ...p };
          if (target.branch === 'Pusat Genteng') next.stockPusat += restored;
          else if (target.branch === 'Cabang Rungkut') next.stockRungkut += restored;
          else next.stockSidoarjo += restored;
          return next;
        })
      );

      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, status: 'voided' } : t))
      );
      if (returnMovements.length > 0) {
        setStockMovements((prev) => [...returnMovements, ...prev]);
      }
      const retJournals = buildSalesReturnJournals(target);
      setJournals((prev) => [...retJournals, ...prev]);
    },
    [transactions]
  );

  const settleReceivable = useCallback(
    (txId: string, method: 'Tunai' | 'QRIS' | 'Transfer Bank') => {
      const target = transactions.find((t) => t.id === txId);
      if (!target || target.receivableStatus === 'lunas' || target.status === 'voided') return;
      const debitAccount =
        method === 'Tunai'
          ? '1101 - Kas Kasir Tunai'
          : method === 'QRIS'
            ? '1102 - Bank BCA (Settlement QRIS)'
            : '1103 - Bank Mandiri Operasional';

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txId
            ? { ...t, paidAmount: t.total, receivableStatus: 'lunas' }
            : t
        )
      );

      const j: AccurateJournalEntry = {
        id: `j_ar_${Date.now()}`,
        journalNo: `JV-AR-${target.invoiceNo.slice(-4)}`,
        sourceType: 'PAYMENT_AR',
        referenceNo: target.invoiceNo,
        description: `Pelunasan Piutang ${target.customerName} (${method})`,
        debitAccount,
        creditAccount: '1201 - Piutang Usaha Pelanggan',
        amount: target.total,
        branch: target.branch,
        createdAtIso: new Date().toISOString(),
      };
      setJournals((prev) => [j, ...prev]);
    },
    [transactions]
  );

  const markWhatsappSent = useCallback((txId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, whatsappSent: true } : t))
    );
    setLastCompletedTx((prev) =>
      prev && prev.id === txId ? { ...prev, whatsappSent: true } : prev
    );
  }, []);

  const adjustWarehouseStock = useCallback(
    async ({
      product,
      warehouse,
      movementType,
      quantity,
      targetWarehouse,
      note,
    }: {
      product: BogajayaProduct;
      warehouse: BranchName;
      movementType: 'IN' | 'OUT' | 'TRANSFER' | 'OPNAME';
      quantity: number;
      targetWarehouse?: BranchName;
      note: string;
    }) => {
      if (quantity <= 0 && movementType !== 'OPNAME') {
        throw new Error('Jumlah barang harus lebih dari 0.');
      }

      const nowIso = new Date().toISOString();
      const movId = `mov_${Date.now()}`;
      let updatedProduct = { ...product };
      let delta = quantity;

      const applyBranch = (p: BogajayaProduct, b: BranchName, d: number) => {
        const copy = { ...p };
        if (b === 'Pusat Genteng') copy.stockPusat = Math.max(0, copy.stockPusat + d);
        else if (b === 'Cabang Rungkut') copy.stockRungkut = Math.max(0, copy.stockRungkut + d);
        else copy.stockSidoarjo = Math.max(0, copy.stockSidoarjo + d);
        return copy;
      };

      if (movementType === 'IN') {
        delta = quantity;
        updatedProduct = applyBranch(updatedProduct, warehouse, delta);
      } else if (movementType === 'OUT') {
        delta = -quantity;
        updatedProduct = applyBranch(updatedProduct, warehouse, delta);
      } else if (movementType === 'OPNAME') {
        const currentQty = getBranchStock(updatedProduct, warehouse);
        delta = quantity - currentQty;
        updatedProduct = applyBranch(updatedProduct, warehouse, delta);
      } else if (movementType === 'TRANSFER' && targetWarehouse && targetWarehouse !== warehouse) {
        delta = -quantity;
        updatedProduct = applyBranch(updatedProduct, warehouse, -quantity);
        updatedProduct = applyBranch(updatedProduct, targetWarehouse, quantity);
      }

      const movement: StockMovementRecord = {
        id: movId,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        movementType,
        warehouse,
        quantityDelta: delta,
        unitCost: product.costPrice,
        note: note || `${movementType} via Barcode Gudang`,
        createdAtIso: nowIso,
      };

      setProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProduct : p)));
      setStockMovements((prev) => [movement, ...prev]);

      let newJournal: AccurateJournalEntry | null = null;
      if (movementType === 'IN' && delta > 0) {
        newJournal = buildRestockJournal(movement, delta * product.costPrice);
        setJournals((prev) => [newJournal!, ...prev]);
      } else if (movementType === 'OPNAME' && delta !== 0) {
        newJournal = {
          id: `j_${movId}`,
          journalNo: `JV-OPN-${movId.slice(-6).toUpperCase()}`,
          sourceType: 'ADJUSTMENT',
          referenceNo: product.sku,
          description: `Stok Opname ${warehouse}: ${product.name} (${delta > 0 ? '+' : ''}${delta})`,
          debitAccount:
            delta > 0 ? '1301 - Persediaan Barang Dagang' : '5201 - Selisih Penyesuaian Stok',
          creditAccount:
            delta > 0 ? '5201 - Selisih Penyesuaian Stok' : '1301 - Persediaan Barang Dagang',
          amount: Math.abs(delta) * product.costPrice,
          branch: warehouse,
          createdAtIso: nowIso,
        };
        setJournals((prev) => [newJournal!, ...prev]);
      }

      if (auth.currentUser?.emailVerified) {
        const uid = auth.currentUser.uid;
        await syncProductToCloud(updatedProduct);
        try {
          await setDoc(doc(db, 'pos_stock_movements', movId), {
            ownerUid: uid,
            productId: movement.productId,
            sku: movement.sku,
            productName: movement.productName.slice(0, 200),
            movementType: movement.movementType,
            warehouse: movement.warehouse,
            quantityDelta: movement.quantityDelta,
            unitCost: movement.unitCost,
            note: movement.note.slice(0, 300),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          if (newJournal) {
            await setDoc(doc(db, 'pos_journals', newJournal.id), {
              ownerUid: uid,
              journalNo: newJournal.journalNo,
              sourceType: newJournal.sourceType,
              referenceNo: newJournal.referenceNo,
              description: newJournal.description.slice(0, 300),
              debitAccount: newJournal.debitAccount,
              creditAccount: newJournal.creditAccount,
              amount: newJournal.amount,
              branch: newJournal.branch,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `pos_stock_movements/${movId}`);
        }
      }
    },
    [syncProductToCloud]
  );

  const recordExpense = useCallback(
    async ({
      category,
      description,
      amount,
      branch,
    }: {
      category: string;
      description: string;
      amount: number;
      branch: BranchName;
    }) => {
      if (amount <= 0) throw new Error('Nominal beban harus lebih dari 0.');
      const nowIso = new Date().toISOString();
      const expId = `exp_${Date.now()}`;
      const newExpense: OperatingExpense = {
        id: expId,
        category,
        description,
        amount,
        branch,
        createdAtIso: nowIso,
      };
      const j: AccurateJournalEntry = {
        id: `j_${expId}`,
        journalNo: `JV-EXP-${expId.slice(-5).toUpperCase()}`,
        sourceType: 'EXPENSE',
        referenceNo: expId.toUpperCase(),
        description: `${category}: ${description}`,
        debitAccount: '6101 - Beban Operasional Toko',
        creditAccount: '1101 - Kas Kasir Tunai',
        amount,
        branch,
        createdAtIso: nowIso,
      };

      setExpenses((prev) => [newExpense, ...prev]);
      setJournals((prev) => [j, ...prev]);

      if (auth.currentUser?.emailVerified) {
        const uid = auth.currentUser.uid;
        try {
          await setDoc(doc(db, 'pos_journals', j.id), {
            ownerUid: uid,
            journalNo: j.journalNo,
            sourceType: j.sourceType,
            referenceNo: j.referenceNo,
            description: j.description.slice(0, 300),
            debitAccount: j.debitAccount,
            creditAccount: j.creditAccount,
            amount: j.amount,
            branch: j.branch,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `pos_journals/${j.id}`);
        }
      }
    },
    []
  );

  const createPurchaseInvoice = useCallback(
    async ({
      supplierName,
      branch,
      product,
      qty,
      unitCost,
      includePpn,
      paymentType,
    }: {
      supplierName: string;
      branch: BranchName;
      product: BogajayaProduct;
      qty: number;
      unitCost: number;
      includePpn: boolean;
      paymentType: 'Tunai' | 'Kredit';
    }): Promise<PurchaseInvoiceRecord> => {
      if (qty <= 0 || unitCost <= 0) {
        throw new Error('Qty dan HPP satuan pembelian wajib lebih dari 0.');
      }
      const nowIso = new Date().toISOString();
      const subtotal = qty * unitCost;
      const taxPpnInput = includePpn ? Math.round(subtotal * 0.11) : 0;
      const po: PurchaseInvoiceRecord = {
        id: `po_${Date.now()}`,
        poNumber: `PO-BGJ-${String(purchases.length + 1).padStart(4, '0')}`,
        supplierName: supplierName.trim() || 'Supplier Umum',
        branch,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        qty,
        unitCost,
        subtotal,
        taxPpnInput,
        totalAmount: subtotal + taxPpnInput,
        paymentType,
        status: paymentType === 'Tunai' ? 'lunas' : 'belum_lunas',
        dueDateIso: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAtIso: nowIso,
      };

      setPurchases((prev) => [po, ...prev]);

      // Add stock immediately to selected warehouse
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== product.id) return p;
          const next = { ...p, costPrice: unitCost };
          if (branch === 'Pusat Genteng') next.stockPusat += qty;
          else if (branch === 'Cabang Rungkut') next.stockRungkut += qty;
          else next.stockSidoarjo += qty;
          return next;
        })
      );

      setStockMovements((prev) => [
        {
          id: `mov_po_${Date.now()}`,
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          movementType: 'IN',
          warehouse: branch,
          quantityDelta: qty,
          unitCost,
          note: `Faktur Pembelian ${po.poNumber} (${po.supplierName})`,
          createdAtIso: nowIso,
        },
        ...prev,
      ]);

      const poJournals = buildPurchaseInvoiceJournals(po);
      setJournals((prev) => [...poJournals, ...prev]);

      return po;
    },
    [purchases.length]
  );

  const settlePurchaseInvoice = useCallback(
    (
      poId: string,
      payAccount: '1101 - Kas Kasir Tunai' | '1103 - Bank Mandiri Operasional'
    ) => {
      const target = purchases.find((p) => p.id === poId);
      if (!target || target.status === 'lunas') return;
      setPurchases((prev) =>
        prev.map((p) => (p.id === poId ? { ...p, status: 'lunas' } : p))
      );
      const j: AccurateJournalEntry = {
        id: `j_ap_${Date.now()}`,
        journalNo: `JV-AP-${target.poNumber.slice(-4)}`,
        sourceType: 'PAYMENT_AP',
        referenceNo: target.poNumber,
        description: `Pelunasan Hutang Supplier ${target.supplierName} (${target.poNumber})`,
        debitAccount: '2101 - Hutang Usaha Supplier',
        creditAccount: payAccount,
        amount: target.totalAmount,
        branch: target.branch,
        createdAtIso: new Date().toISOString(),
      };
      setJournals((prev) => [j, ...prev]);
    },
    [purchases]
  );

  const addFixedAsset = useCallback(
    (params: {
      name: string;
      category: FixedAssetRecord['category'];
      branch: BranchName;
      acquisitionCost: number;
      salvageValue: number;
      usefulLifeMonths: number;
    }) => {
      const nowIso = new Date().toISOString();
      const asset: FixedAssetRecord = {
        id: `ast_${Date.now()}`,
        assetCode: `FA-${String(fixedAssets.length + 1).padStart(3, '0')}`,
        name: params.name.trim(),
        category: params.category,
        branch: params.branch,
        acquisitionDateIso: nowIso,
        acquisitionCost: params.acquisitionCost,
        salvageValue: params.salvageValue,
        usefulLifeMonths: params.usefulLifeMonths,
        accumulatedDepreciation: 0,
      };
      setFixedAssets((prev) => [asset, ...prev]);
      const j: AccurateJournalEntry = {
        id: `j_ast_${Date.now()}`,
        journalNo: `JV-FA-${asset.assetCode}`,
        sourceType: 'ADJUSTMENT',
        referenceNo: asset.assetCode,
        description: `Perolehan Aset Tetap: ${asset.name}`,
        debitAccount: '1501 - Aset Tetap & Inventaris Toko',
        creditAccount: '1103 - Bank Mandiri Operasional',
        amount: asset.acquisitionCost,
        branch: asset.branch,
        createdAtIso: nowIso,
      };
      setJournals((prev) => [j, ...prev]);
    },
    [fixedAssets.length]
  );

  const runMonthlyDepreciation = useCallback(() => {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    let count = 0;
    let totalDepreciation = 0;
    const newJournals: AccurateJournalEntry[] = [];

    const updatedAssets = fixedAssets.map((asset, idx) => {
      if (asset.lastDepreciatedMonth === currentMonthKey) return asset;
      const dep = calculateMonthlyDepreciation(asset);
      if (dep <= 0) return asset;
      count++;
      totalDepreciation += dep;
      newJournals.push({
        id: `j_dep_${Date.now()}_${idx}`,
        journalNo: `JV-DEP-${currentMonthKey.replace('-', '')}-${idx + 1}`,
        sourceType: 'DEPRECIATION',
        referenceNo: asset.assetCode,
        description: `Penyusutan Bulanan (${currentMonthKey}): ${asset.name}`,
        debitAccount: '6201 - Beban Penyusutan Aset Tetap',
        creditAccount: '1502 - Akumulasi Penyusutan Aset Tetap',
        amount: dep,
        branch: asset.branch,
        createdAtIso: new Date().toISOString(),
      });
      return {
        ...asset,
        accumulatedDepreciation: asset.accumulatedDepreciation + dep,
        lastDepreciatedMonth: currentMonthKey,
      };
    });

    if (count > 0) {
      setFixedAssets(updatedAssets);
      setJournals((prev) => [...newJournals, ...prev]);
    }
    return { count, totalDepreciation };
  }, [fixedAssets]);

  const addCustomer = useCallback(
    async (
      input: Omit<CustomerRecord, 'id' | 'points' | 'totalSpent' | 'visitCount'>
    ): Promise<CustomerRecord> => {
      const custId = `cust_${Date.now()}`;
      const record: CustomerRecord = {
        id: custId,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        tier: input.tier,
        points: 50,
        totalSpent: 0,
        visitCount: 0,
        address: input.address.trim(),
        notes: input.notes.trim(),
      };
      setCustomers((prev) => [record, ...prev]);

      if (auth.currentUser?.emailVerified) {
        const uid = auth.currentUser.uid;
        try {
          await setDoc(doc(db, 'pos_customers', custId), {
            ownerUid: uid,
            name: record.name.slice(0, 120),
            phone: (record.phone || '0800000000').slice(0, 32),
            email: record.email.slice(0, 160),
            tier: record.tier,
            points: record.points,
            totalSpent: record.totalSpent,
            visitCount: record.visitCount,
            address: record.address.slice(0, 300),
            notes: record.notes.slice(0, 300),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `pos_customers/${custId}`);
        }
      }

      return record;
    },
    []
  );

  const importGoogleContactsCustomers = useCallback(
    async (
      contacts: Array<{ name: string; phone: string; email: string; address: string }>
    ): Promise<number> => {
      let added = 0;
      for (const c of contacts) {
        if (!c.name || (!c.phone && !c.email)) continue;
        const exists = customers.some(
          (ex) =>
            (c.phone && ex.phone === c.phone) ||
            (c.email && ex.email.toLowerCase() === c.email.toLowerCase())
        );
        if (!exists) {
          await addCustomer({
            name: c.name,
            phone: c.phone || '0800000000',
            email: c.email || '',
            tier: 'Silver',
            address: c.address || 'Surabaya',
            notes: 'Diimpor dari Google Contacts',
          });
          added++;
        }
      }
      return added;
    },
    [addCustomer, customers]
  );

  const loginOperator = useCallback(
    (username: string, pin: string) => {
      const res = authenticateOperator(operators, username, pin);
      if (res.ok) {
        setCurrentOperatorId(res.operator.id);
        setSettings((prev) => ({
          ...prev,
          activeBranch: res.operator.branch,
        }));
      }
      return res;
    },
    [operators]
  );

  const logoutOperator = useCallback(() => {
    setCurrentOperatorId(null);
  }, []);

  const addOperator = useCallback(
    (input: {
      username: string;
      fullName: string;
      role: OperatorRole;
      pin: string;
      branch: BranchName;
      permissions: FeaturePermission[];
    }): { ok: true; operator: PosOperator } | { ok: false; error: string } => {
      const validationErr = validateOperatorInput(input, operators);
      if (validationErr) {
        return { ok: false, error: validationErr };
      }
      const nextOp: PosOperator = {
        id: `op_${Date.now()}`,
        username: normalizeUsername(input.username),
        fullName: input.fullName.trim(),
        role: input.role,
        pin: input.pin.trim(),
        branch: input.branch,
        permissions:
          input.role === 'admin' ? [...ALL_FEATURE_PERMISSIONS] : [...input.permissions],
        active: true,
        createdAtIso: new Date().toISOString(),
      };
      setOperators((prev) => ensureDefaultAdminPresent([...prev, nextOp]));
      return { ok: true, operator: nextOp };
    },
    [operators]
  );

  const updateOperator = useCallback(
    (
      id: string,
      patch: {
        fullName?: string;
        role?: OperatorRole;
        pin?: string;
        branch?: BranchName;
        permissions?: FeaturePermission[];
        active?: boolean;
      }
    ): { ok: true } | { ok: false; error: string } => {
      const target = operators.find((op) => op.id === id);
      if (!target) {
        return { ok: false, error: 'Akun operator tidak ditemukan.' };
      }
      const nextRole = target.isProtectedAdmin ? 'admin' : (patch.role ?? target.role);
      const nextFullName = patch.fullName !== undefined ? patch.fullName : target.fullName;
      const nextPin = patch.pin !== undefined ? patch.pin : target.pin;
      const nextPerms =
        nextRole === 'admin'
          ? [...ALL_FEATURE_PERMISSIONS]
          : (patch.permissions ?? target.permissions);

      const validationErr = validateOperatorInput(
        {
          username: target.username,
          fullName: nextFullName,
          pin: nextPin,
          role: nextRole,
          permissions: nextPerms,
        },
        operators,
        target.id
      );
      if (validationErr) {
        return { ok: false, error: validationErr };
      }

      setOperators((prev) =>
        ensureDefaultAdminPresent(
          prev.map((op) =>
            op.id === id
              ? {
                  ...op,
                  fullName: nextFullName.trim(),
                  role: nextRole,
                  pin: nextPin.trim(),
                  branch: patch.branch ?? op.branch,
                  permissions: nextPerms,
                  active: op.isProtectedAdmin ? true : (patch.active ?? op.active),
                }
              : op
          )
        )
      );
      return { ok: true };
    },
    [operators]
  );

  const deleteOperator = useCallback((id: string) => {
    setOperators((prev) =>
      ensureDefaultAdminPresent(
        prev.filter((op) => op.id !== id || op.isProtectedAdmin)
      )
    );
    setCurrentOperatorId((cur) => (cur === id ? null : cur));
  }, []);

  const updateRolePermissions = useCallback(
    (role: OperatorRole, permissions: FeaturePermission[], applyToExisting = false) => {
      if (role === 'admin') return;
      const cleanPerms = Array.from(new Set(permissions));
      setRolePermissions((prev) => ({
        ...prev,
        [role]: cleanPerms,
      }));
      if (applyToExisting) {
        setOperators((prev) =>
          ensureDefaultAdminPresent(
            prev.map((op) =>
              op.role === role && !op.isProtectedAdmin
                ? { ...op, permissions: [...cleanPerms] }
                : op
            )
          )
        );
      }
    },
    []
  );

  const pnl = useMemo(
    () => calculateProfitAndLoss(transactions, expenses, journals, purchases),
    [transactions, expenses, journals, purchases]
  );
  const monthlySales = useMemo(
    () => calculateMonthlySales(transactions, expenses),
    [transactions, expenses]
  );
  const inventoryValuation = useMemo(
    () => calculateInventoryValuation(products, settings.costingMethod),
    [products, settings.costingMethod]
  );
  const trialBalance = useMemo(() => calculateTrialBalance(journals), [journals]);

  return (
    <StoreContext.Provider
      value={{
        user,
        authReady,
        cloudConnected,
        cloudSyncedCount,
        workspaceToken,
        signIn,
        signOut,
        operators,
        rolePermissions,
        currentOperator,
        loginOperator,
        logoutOperator,
        addOperator,
        updateOperator,
        deleteOperator,
        updateRolePermissions,
        products,
        addCatalogProduct,
        transactions,
        customers,
        journals,
        stockMovements,
        expenses,
        purchases,
        fixedAssets,
        heldOrders,
        settings,
        updateSettings,
        pnl,
        monthlySales,
        inventoryValuation,
        trialBalance,
        cart,
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
        voidOrReturnSale,
        settleReceivable,
        lastCompletedTx,
        setLastCompletedTx,
        markWhatsappSent,
        adjustWarehouseStock,
        recordExpense,
        createPurchaseInvoice,
        settlePurchaseInvoice,
        addFixedAsset,
        runMonthlyDepreciation,
        addCustomer,
        importGoogleContactsCustomers,
        printerName,
        printerError,
        connectPrinter,
        printReceipt,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
