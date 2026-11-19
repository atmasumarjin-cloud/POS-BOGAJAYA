import type { BranchName } from './accounting';

export type OperatorRole = 'admin' | 'manajer' | 'karyawan';

export type FeaturePermission =
  | 'pos_kasir'
  | 'pos_diskon_retur'
  | 'katalog'
  | 'gudang'
  | 'accurate_pnl'
  | 'accurate_pembelian_aset'
  | 'pelanggan'
  | 'peta'
  | 'studio'
  | 'pengaturan';

export type AppTabId =
  | 'kasir'
  | 'katalog'
  | 'gudang'
  | 'accurate'
  | 'pelanggan'
  | 'peta'
  | 'studio'
  | 'pengaturan';

export interface PermissionOptionMeta {
  id: FeaturePermission;
  label: string;
  description: string;
  group: 'Operasional Kasir & Gudang' | 'Akuntansi Accurate ERP' | 'Pelanggan, AI & Sistem';
}

export const FEATURE_PERMISSION_OPTIONS: PermissionOptionMeta[] = [
  {
    id: 'pos_kasir',
    label: 'Kasir & Transaksi POS',
    description: 'Buka layar kasir, scan barcode, antrian tunda, dan terima pembayaran',
    group: 'Operasional Kasir & Gudang',
  },
  {
    id: 'pos_diskon_retur',
    label: 'Diskon Kasir, Retur & Void',
    description: 'Beri diskon manual di kasir serta proses retur/pembatalan faktur',
    group: 'Operasional Kasir & Gudang',
  },
  {
    id: 'katalog',
    label: 'Katalog Produk Bogajaya',
    description: 'Lihat daftar 128 produk, SKU, barcode, dan tambah cepat ke kasir',
    group: 'Operasional Kasir & Gudang',
  },
  {
    id: 'gudang',
    label: 'Gudang, Barcode & Mutasi Stok',
    description: 'Input stok masuk/keluar, transfer antar cabang, dan stock opname',
    group: 'Operasional Kasir & Gudang',
  },
  {
    id: 'accurate_pnl',
    label: 'Accurate ERP: Laba Rugi & Laporan',
    description: 'Lihat Laba Rugi real-time, Laporan Bulanan, Piutang, Buku Besar & Neraca',
    group: 'Akuntansi Accurate ERP',
  },
  {
    id: 'accurate_pembelian_aset',
    label: 'Accurate ERP: Pembelian, Hutang & Aset',
    description: 'Buat faktur pembelian supplier, pelunasan hutang, beban & penyusutan aset',
    group: 'Akuntansi Accurate ERP',
  },
  {
    id: 'pelanggan',
    label: 'Pelanggan Setia & Kontak',
    description: 'Kelola data member, poin loyalitas, WhatsApp, dan Google Contacts',
    group: 'Pelanggan, AI & Sistem',
  },
  {
    id: 'peta',
    label: 'Cabang & Google Maps',
    description: 'Lihat lokasi cabang Bogajaya dan radius pengiriman',
    group: 'Pelanggan, AI & Sistem',
  },
  {
    id: 'studio',
    label: 'Analis AI & Studio Poster',
    description: 'Akses asisten audit bisnis dan generator poster promo',
    group: 'Pelanggan, AI & Sistem',
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan Toko, Printer & Manajemen Akun',
    description: 'Ubah setelan toko, printer Bluetooth, kebijakan HPP, dan kelola role operator',
    group: 'Pelanggan, AI & Sistem',
  },
];

export const ALL_FEATURE_PERMISSIONS: FeaturePermission[] = FEATURE_PERMISSION_OPTIONS.map(
  (opt) => opt.id
);

export type RolePermissionsMap = Record<OperatorRole, FeaturePermission[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMap = {
  admin: [...ALL_FEATURE_PERMISSIONS],
  manajer: [
    'pos_kasir',
    'pos_diskon_retur',
    'katalog',
    'gudang',
    'accurate_pnl',
    'accurate_pembelian_aset',
    'pelanggan',
    'peta',
    'studio',
  ],
  karyawan: ['pos_kasir', 'katalog', 'pelanggan'],
};

export interface PosOperator {
  id: string;
  username: string;
  fullName: string;
  role: OperatorRole;
  pin: string;
  branch: BranchName;
  permissions: FeaturePermission[];
  active: boolean;
  isProtectedAdmin?: boolean;
  createdAtIso: string;
}

export const DEFAULT_ADMIN_OPERATOR: PosOperator = {
  id: 'op-adminpusat',
  username: 'adminpusat',
  fullName: 'Administrator Pusat Bogajaya',
  role: 'admin',
  pin: '9999',
  branch: 'Pusat Genteng',
  permissions: [...ALL_FEATURE_PERMISSIONS],
  active: true,
  isProtectedAdmin: true,
  createdAtIso: '2026-01-01T08:00:00.000Z',
};

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function getRoleLabel(role: OperatorRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'manajer':
      return 'Manajer';
    case 'karyawan':
      return 'Karyawan';
  }
}

export function authenticateOperator(
  operators: PosOperator[],
  usernameInput: string,
  pinInput: string
): { ok: true; operator: PosOperator } | { ok: false; error: string } {
  const uname = normalizeUsername(usernameInput);
  const pin = pinInput.trim();

  if (!uname || !pin) {
    return { ok: false, error: 'Masukkan username dan PIN terlebih dahulu.' };
  }

  const found = operators.find((op) => normalizeUsername(op.username) === uname);
  if (!found || found.pin !== pin) {
    return {
      ok: false,
      error: 'Username atau PIN tidak sesuai. Periksa kembali kredensial login Anda.',
    };
  }

  if (!found.active) {
    return {
      ok: false,
      error: 'Akun operator ini sedang dinonaktifkan. Hubungi Admin Pusat.',
    };
  }

  return { ok: true, operator: found };
}

export function hasPermission(
  operator: PosOperator | null | undefined,
  permission: FeaturePermission
): boolean {
  if (!operator || !operator.active) return false;
  if (operator.role === 'admin' && operator.isProtectedAdmin) return true;
  return operator.permissions.includes(permission);
}

export function canAccessAppTab(
  operator: PosOperator | null | undefined,
  tab: AppTabId
): boolean {
  if (!operator || !operator.active) return false;
  switch (tab) {
    case 'kasir':
      return hasPermission(operator, 'pos_kasir');
    case 'katalog':
      return hasPermission(operator, 'katalog');
    case 'gudang':
      return hasPermission(operator, 'gudang');
    case 'accurate':
      return (
        hasPermission(operator, 'accurate_pnl') ||
        hasPermission(operator, 'accurate_pembelian_aset')
      );
    case 'pelanggan':
      return hasPermission(operator, 'pelanggan');
    case 'peta':
      return hasPermission(operator, 'peta');
    case 'studio':
      return hasPermission(operator, 'studio');
    case 'pengaturan':
      return hasPermission(operator, 'pengaturan');
  }
}

const ORDERED_TABS: AppTabId[] = [
  'kasir',
  'katalog',
  'gudang',
  'accurate',
  'pelanggan',
  'peta',
  'studio',
  'pengaturan',
];

export function getAllowedTabs(operator: PosOperator | null | undefined): AppTabId[] {
  return ORDERED_TABS.filter((tab) => canAccessAppTab(operator, tab));
}

export function getFirstAllowedTab(operator: PosOperator | null | undefined): AppTabId {
  const allowed = getAllowedTabs(operator);
  return allowed[0] || 'kasir';
}

export function validateOperatorInput(
  input: {
    username: string;
    fullName: string;
    pin: string;
    role: OperatorRole;
    permissions: FeaturePermission[];
  },
  existingOperators: PosOperator[],
  editingId?: string
): string | null {
  const uname = normalizeUsername(input.username);
  if (!/^[a-z0-9._-]{3,32}$/.test(uname)) {
    return 'Username minimal 3 karakter (huruf kecil, angka, titik, atau garis bawah).';
  }
  const duplicate = existingOperators.some(
    (op) => op.id !== editingId && normalizeUsername(op.username) === uname
  );
  if (duplicate) {
    return `Username "${uname}" sudah digunakan oleh operator lain.`;
  }
  if (input.fullName.trim().length < 2) {
    return 'Nama lengkap operator minimal 2 karakter.';
  }
  if (!/^\d{4,6}$/.test(input.pin.trim())) {
    return 'PIN harus berupa 4 sampai 6 digit angka.';
  }
  if (input.role !== 'admin' && input.permissions.length === 0) {
    return 'Pilih minimal 1 izin akses fitur untuk operator ini.';
  }
  return null;
}

export function ensureDefaultAdminPresent(operators: PosOperator[]): PosOperator[] {
  const hasAdminPusat = operators.some(
    (op) => normalizeUsername(op.username) === 'adminpusat'
  );
  if (hasAdminPusat) {
    return operators.map((op) =>
      normalizeUsername(op.username) === 'adminpusat'
        ? {
            ...op,
            role: 'admin',
            active: true,
            isProtectedAdmin: true,
            permissions: [...ALL_FEATURE_PERMISSIONS],
          }
        : op
    );
  }
  return [DEFAULT_ADMIN_OPERATOR, ...operators];
}
