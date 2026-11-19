import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_FEATURE_PERMISSIONS,
  authenticateOperator,
  canAccessAppTab,
  DEFAULT_ADMIN_OPERATOR,
  DEFAULT_ROLE_PERMISSIONS,
  ensureDefaultAdminPresent,
  getAllowedTabs,
  getFirstAllowedTab,
  hasPermission,
  validateOperatorInput,
  type PosOperator,
} from './rbac';

test('Default admin adminpusat with PIN 9999 authenticates with full permissions', () => {
  const ops = ensureDefaultAdminPresent([]);
  const res = authenticateOperator(ops, 'adminpusat', '9999');
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.operator.role, 'admin');
    assert.equal(hasPermission(res.operator, 'pengaturan'), true);
    assert.equal(hasPermission(res.operator, 'accurate_pnl'), true);
    assert.equal(getAllowedTabs(res.operator).length, 8);
  }
});

test('Wrong PIN or unknown username is rejected clearly', () => {
  const ops = [DEFAULT_ADMIN_OPERATOR];
  const wrongPin = authenticateOperator(ops, 'adminpusat', '1234');
  assert.equal(wrongPin.ok, false);

  const wrongUser = authenticateOperator(ops, 'kasir_hantu', '9999');
  assert.equal(wrongUser.ok, false);
});

test('Inactive operator cannot log in', () => {
  const inactiveStaff: PosOperator = {
    id: 'op-2',
    username: 'kasir_nonaktif',
    fullName: 'Kasir Nonaktif',
    role: 'karyawan',
    pin: '1122',
    branch: 'Pusat Genteng',
    permissions: ['pos_kasir'],
    active: false,
    createdAtIso: '2026-01-02T00:00:00.000Z',
  };
  const res = authenticateOperator([DEFAULT_ADMIN_OPERATOR, inactiveStaff], 'kasir_nonaktif', '1122');
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.error, /dinonaktifkan/i);
  }
});

test('Karyawan and Manajer custom feature permissions filter accessible tabs accurately', () => {
  const karyawan: PosOperator = {
    id: 'op-kasir',
    username: 'kasir_genteng',
    fullName: 'Sari Kasir',
    role: 'karyawan',
    pin: '1234',
    branch: 'Pusat Genteng',
    permissions: ['pos_kasir', 'katalog'],
    active: true,
    createdAtIso: '2026-01-02T00:00:00.000Z',
  };

  assert.equal(canAccessAppTab(karyawan, 'kasir'), true);
  assert.equal(canAccessAppTab(karyawan, 'katalog'), true);
  assert.equal(canAccessAppTab(karyawan, 'accurate'), false);
  assert.equal(canAccessAppTab(karyawan, 'pengaturan'), false);
  assert.equal(hasPermission(karyawan, 'pos_diskon_retur'), false);
  assert.deepEqual(getAllowedTabs(karyawan), ['kasir', 'katalog']);

  const manajer: PosOperator = {
    id: 'op-mgr',
    username: 'manajer_rungkut',
    fullName: 'Budi Manajer',
    role: 'manajer',
    pin: '2222',
    branch: 'Cabang Rungkut',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.manajer],
    active: true,
    createdAtIso: '2026-01-02T00:00:00.000Z',
  };

  assert.equal(canAccessAppTab(manajer, 'accurate'), true);
  assert.equal(canAccessAppTab(manajer, 'gudang'), true);
  assert.equal(canAccessAppTab(manajer, 'pengaturan'), false);
  assert.equal(getFirstAllowedTab(manajer), 'kasir');
});

test('validateOperatorInput catches duplicate username, invalid PIN, and empty permissions', () => {
  const existing = [DEFAULT_ADMIN_OPERATOR];
  assert.ok(
    validateOperatorInput(
      {
        username: 'adminpusat',
        fullName: 'Dup Admin',
        pin: '1234',
        role: 'manajer',
        permissions: ['pos_kasir'],
      },
      existing
    )
  );
  assert.ok(
    validateOperatorInput(
      {
        username: 'kasir_baru',
        fullName: 'Kasir Baru',
        pin: '12ab',
        role: 'karyawan',
        permissions: ['pos_kasir'],
      },
      existing
    )
  );
  assert.ok(
    validateOperatorInput(
      {
        username: 'kasir_baru',
        fullName: 'Kasir Baru',
        pin: '1234',
        role: 'karyawan',
        permissions: [],
      },
      existing
    )
  );
  assert.equal(
    validateOperatorInput(
      {
        username: 'kasir_baru',
        fullName: 'Kasir Baru',
        pin: '1234',
        role: 'karyawan',
        permissions: ALL_FEATURE_PERMISSIONS.slice(0, 2),
      },
      existing
    ),
    null
  );
});
