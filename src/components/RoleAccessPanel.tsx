import React, { useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  KeyRound,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { BranchName } from '../utils/accounting';
import {
  ALL_FEATURE_PERMISSIONS,
  FEATURE_PERMISSION_OPTIONS,
  getRoleLabel,
  type FeaturePermission,
  type OperatorRole,
  type PosOperator,
} from '../utils/rbac';

const BRANCH_OPTIONS: BranchName[] = ['Pusat Genteng', 'Cabang Rungkut', 'Gudang Sidoarjo'];
const PERMISSION_GROUPS: Array<
  'Operasional Kasir & Gudang' | 'Akuntansi Accurate ERP' | 'Pelanggan, AI & Sistem'
> = [
  'Operasional Kasir & Gudang',
  'Akuntansi Accurate ERP',
  'Pelanggan, AI & Sistem',
];

export function RoleAccessPanel() {
  const {
    operators,
    rolePermissions,
    currentOperator,
    addOperator,
    updateOperator,
    deleteOperator,
    updateRolePermissions,
  } = useStore();

  // Template role editor state
  const [templateRole, setTemplateRole] = useState<'manajer' | 'karyawan'>('karyawan');
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);

  // New operator form state
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<OperatorRole>('karyawan');
  const [newPin, setNewPin] = useState('');
  const [newBranch, setNewBranch] = useState<BranchName>('Pusat Genteng');
  const [newPermissions, setNewPermissions] = useState<FeaturePermission[]>(
    () => [...rolePermissions.karyawan]
  );
  const [formFeedback, setFormFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Edit operator modal/inline state
  const [editingOp, setEditingOp] = useState<PosOperator | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<OperatorRole>('karyawan');
  const [editPin, setEditPin] = useState('');
  const [editBranch, setEditBranch] = useState<BranchName>('Pusat Genteng');
  const [editPermissions, setEditPermissions] = useState<FeaturePermission[]>([]);
  const [editFeedback, setEditFeedback] = useState<string | null>(null);

  const activeTemplatePerms = rolePermissions[templateRole];

  const handleToggleTemplatePerm = (perm: FeaturePermission) => {
    setTemplateFeedback(null);
    const exists = activeTemplatePerms.includes(perm);
    const next = exists
      ? activeTemplatePerms.filter((p) => p !== perm)
      : [...activeTemplatePerms, perm];
    updateRolePermissions(templateRole, next, false);
  };

  const handleApplyTemplateToExisting = () => {
    updateRolePermissions(templateRole, activeTemplatePerms, true);
    setTemplateFeedback(
      `Template izin ${getRoleLabel(templateRole)} berhasil diterapkan ke seluruh akun ${getRoleLabel(templateRole)} yang ada.`
    );
  };

  const handleNewRoleChange = (role: OperatorRole) => {
    setNewRole(role);
    setNewPermissions([...rolePermissions[role]]);
  };

  const toggleNewPerm = (perm: FeaturePermission) => {
    setNewPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleAddOperator = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);
    const res = addOperator({
      username: newUsername,
      fullName: newFullName,
      role: newRole,
      pin: newPin,
      branch: newBranch,
      permissions: newRole === 'admin' ? ALL_FEATURE_PERMISSIONS : newPermissions,
    });
    if (!res.ok) {
      setFormFeedback({ type: 'err', text: res.error });
      return;
    }
    setFormFeedback({
      type: 'ok',
      text: `Akun ${getRoleLabel(res.operator.role)} "${res.operator.username}" (${res.operator.permissions.length} izin fitur) siap digunakan untuk login.`,
    });
    setNewUsername('');
    setNewFullName('');
    setNewPin('');
    setNewPermissions([...rolePermissions[newRole]]);
  };

  const startEditing = (op: PosOperator) => {
    setEditingOp(op);
    setEditFullName(op.fullName);
    setEditRole(op.role);
    setEditPin(op.pin);
    setEditBranch(op.branch);
    setEditPermissions([...op.permissions]);
    setEditFeedback(null);
  };

  const toggleEditPerm = (perm: FeaturePermission) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOp) return;
    setEditFeedback(null);
    const res = updateOperator(editingOp.id, {
      fullName: editFullName,
      role: editRole,
      pin: editPin,
      branch: editBranch,
      permissions: editRole === 'admin' ? ALL_FEATURE_PERMISSIONS : editPermissions,
    });
    if (!res.ok) {
      setEditFeedback(res.error);
      return;
    }
    setEditingOp(null);
  };

  return (
    <section
      id="manajemen-role-akses"
      className="bg-white border border-stone-200 rounded-xl p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-red-800 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Manajemen Login Operator, Role &amp; Izin Akses Fitur
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Tambahkan akun login untuk <strong>Karyawan</strong> dan <strong>Manajer</strong>, serta tentukan fitur apa saja yang boleh diakses oleh setiap role atau akun.
            </p>
          </div>
        </div>
        {currentOperator && (
          <div className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 shrink-0">
            Aktif:{' '}
            <strong className="font-mono text-stone-900">{currentOperator.username}</strong>{' '}
            <span className="text-red-800 font-semibold">
              ({getRoleLabel(currentOperator.role)})
            </span>
          </div>
        )}
      </div>

      {/* Role Default Permission Matrix + Create Account Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 cols: Default Role Feature Permission Configurator */}
        <div className="lg:col-span-5 bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-800" />
              <h3 className="text-sm font-bold text-stone-900">
                Template Izin Akses Role
              </h3>
            </div>
            <div className="inline-flex rounded-lg bg-white border border-stone-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTemplateRole('karyawan');
                  setTemplateFeedback(null);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  templateRole === 'karyawan'
                    ? 'bg-red-800 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Karyawan
              </button>
              <button
                type="button"
                onClick={() => {
                  setTemplateRole('manajer');
                  setTemplateFeedback(null);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  templateRole === 'manajer'
                    ? 'bg-red-800 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Manajer
              </button>
            </div>
          </div>

          <p className="text-[11px] text-stone-600">
            Centang fitur yang otomatis diberikan saat membuat akun baru dengan role{' '}
            <strong>{getRoleLabel(templateRole)}</strong> ({activeTemplatePerms.length}/
            {ALL_FEATURE_PERMISSIONS.length} fitur aktif). Role <strong>Admin</strong> selalu memiliki akses penuh.
          </p>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group} className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  {group}
                </div>
                {FEATURE_PERMISSION_OPTIONS.filter((o) => o.group === group).map((opt) => {
                  const checked = activeTemplatePerms.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className="flex items-start gap-2.5 p-2 bg-white border border-stone-200 rounded-lg cursor-pointer hover:border-stone-300"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleTemplatePerm(opt.id)}
                        className="mt-0.5 w-4 h-4 accent-red-800 shrink-0"
                      />
                      <span className="text-xs leading-snug">
                        <span className="font-semibold text-stone-800 block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-stone-500">{opt.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          {templateFeedback && (
            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {templateFeedback}
            </p>
          )}

          <button
            type="button"
            onClick={handleApplyTemplateToExisting}
            className="w-full py-2 px-3 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors"
          >
            Terapkan Template ke Semua Akun {getRoleLabel(templateRole)}
          </button>
        </div>

        {/* Right 7 cols: Add New Karyawan / Manajer Login Form */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
            <UserPlus className="w-4 h-4 text-red-800" />
            <h3 className="text-sm font-bold text-stone-900">
              Tambah Login Karyawan / Manajer Baru
            </h3>
          </div>

          <form onSubmit={handleAddOperator} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label
                  htmlFor="op-new-username"
                  className="block font-semibold text-stone-700"
                >
                  Username Login
                </label>
                <input
                  id="op-new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="mis. kasir_genteng"
                  className="w-full px-3 py-2 font-mono bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="op-new-fullname"
                  className="block font-semibold text-stone-700"
                >
                  Nama Lengkap Operator
                </label>
                <input
                  id="op-new-fullname"
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="mis. Sari Wulandari"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="op-new-role"
                  className="block font-semibold text-stone-700"
                >
                  Pilih Role
                </label>
                <select
                  id="op-new-role"
                  value={newRole}
                  onChange={(e) => handleNewRoleChange(e.target.value as OperatorRole)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                >
                  <option value="karyawan">Karyawan (Kasir / Staff)</option>
                  <option value="manajer">Manajer (Kepala Toko / Supervisor)</option>
                  <option value="admin">Admin (Akses Penuh)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor="op-new-pin"
                    className="block font-semibold text-stone-700"
                  >
                    PIN (4–6 digit)
                  </label>
                  <input
                    id="op-new-pin"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="1234"
                    className="w-full px-3 py-2 font-mono bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="op-new-branch"
                    className="block font-semibold text-stone-700"
                  >
                    Cabang
                  </label>
                  <select
                    id="op-new-branch"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value as BranchName)}
                    className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-lg"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Custom Feature Permissions Selector */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-800">
                  Pilihan Izin Akses Fitur Akun Ini ({newRole === 'admin' ? ALL_FEATURE_PERMISSIONS.length : newPermissions.length} dipilih)
                </span>
                {newRole !== 'admin' && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setNewPermissions([...rolePermissions[newRole]])}
                      className="text-stone-600 hover:text-stone-900 underline"
                    >
                      Ikuti Template {getRoleLabel(newRole)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPermissions([...ALL_FEATURE_PERMISSIONS])}
                      className="text-red-800 hover:underline font-medium"
                    >
                      Centang Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPermissions(['pos_kasir'])}
                      className="text-stone-500 hover:underline"
                    >
                      Kasir Saja
                    </button>
                  </div>
                )}
              </div>

              {newRole === 'admin' ? (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Role Admin otomatis memiliki akses penuh ke seluruh 10 fitur POS &amp; Accurate ERP.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEATURE_PERMISSION_OPTIONS.map((opt) => {
                    const checked = newPermissions.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-red-50/50 border-red-200 text-stone-900'
                            : 'bg-stone-50 border-stone-200 text-stone-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleNewPerm(opt.id)}
                          className="mt-0.5 w-3.5 h-3.5 accent-red-800 shrink-0"
                        />
                        <span className="font-medium leading-tight">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {formFeedback && (
              <div
                role="status"
                className={`text-xs px-3 py-2 rounded-lg border ${
                  formFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {formFeedback.text}
              </div>
            )}

            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Simpan Akun Login {getRoleLabel(newRole)}
            </button>
          </form>
        </div>
      </div>

      {/* Operator Accounts Table */}
      <div className="border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
            Daftar Akun Operator Login ({operators.length} Akun)
          </h3>
          <span className="text-[11px] text-stone-500">
            Akun dapat dipakai langsung di layar Login POS
          </span>
        </div>

        <div className="divide-y divide-stone-200">
          {operators.map((op) => {
            const isEditing = editingOp?.id === op.id;
            return (
              <div key={op.id} className="p-4 space-y-3 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-stone-900">
                        {op.username}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                          op.role === 'admin'
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : op.role === 'manajer'
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {getRoleLabel(op.role)}
                      </span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                          op.active
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-stone-200 text-stone-600'
                        }`}
                      >
                        {op.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {op.isProtectedAdmin && (
                        <span className="text-[11px] text-stone-500 font-medium">
                          (Admin Utama)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-600">
                      {op.fullName} · Cabang: <strong>{op.branch}</strong> · PIN:{' '}
                      <code className="font-mono bg-stone-100 px-1.5 py-0.5 rounded">
                        {op.isProtectedAdmin ? '••••' : op.pin}
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {op.permissions.map((perm) => {
                        const meta = FEATURE_PERMISSION_OPTIONS.find((m) => m.id === perm);
                        return (
                          <span
                            key={perm}
                            className="text-[10px] font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded"
                          >
                            {meta?.label || perm}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => (isEditing ? setEditingOp(null) : startEditing(op))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-lg"
                    >
                      {isEditing ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          Batal
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          Ubah Izin &amp; PIN
                        </>
                      )}
                    </button>

                    {!op.isProtectedAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateOperator(op.id, { active: !op.active })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg"
                        >
                          {op.active ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-amber-700" />
                              Nonaktifkan
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                              Aktifkan
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteOperator(op.id)}
                          aria-label={`Hapus akun ${op.username}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Edit Drawer */}
                {isEditing && (
                  <form
                    onSubmit={handleSaveEdit}
                    className="mt-3 pt-3 border-t border-stone-200 bg-stone-50 rounded-xl p-4 space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700 block">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700 block">Role</label>
                        <select
                          value={editRole}
                          disabled={op.isProtectedAdmin}
                          onChange={(e) => {
                            const r = e.target.value as OperatorRole;
                            setEditRole(r);
                            setEditPermissions([...rolePermissions[r]]);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg disabled:bg-stone-100"
                        >
                          <option value="karyawan">Karyawan</option>
                          <option value="manajer">Manajer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700 block flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> PIN Baru
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={editPin}
                          onChange={(e) =>
                            setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          className="w-full px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-stone-700 block">Cabang</label>
                        <select
                          value={editBranch}
                          onChange={(e) => setEditBranch(e.target.value as BranchName)}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg"
                        >
                          {BRANCH_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {editRole !== 'admin' && !op.isProtectedAdmin && (
                      <div className="space-y-1.5">
                        <span className="font-semibold text-stone-700 block">
                          Izin Akses Fitur ({editPermissions.length} aktif):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {FEATURE_PERMISSION_OPTIONS.map((opt) => (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={editPermissions.includes(opt.id)}
                                onChange={() => toggleEditPerm(opt.id)}
                                className="w-3.5 h-3.5 accent-red-800 shrink-0"
                              />
                              <span className="truncate font-medium text-stone-800">
                                {opt.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {editFeedback && (
                      <p className="text-red-700 font-medium">{editFeedback}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Simpan Perubahan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOp(null)}
                        className="px-3 py-1.5 font-medium text-stone-600 hover:text-stone-900"
                      >
                        Tutup
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
