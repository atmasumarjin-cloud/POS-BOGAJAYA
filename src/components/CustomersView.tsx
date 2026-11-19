import React, { useState } from 'react';
import { Contact, MessageCircle, Sparkles, UserPlus, Users } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { CustomerRecord } from '../data/seedData';
import { formatIDR } from '../utils/accounting';
import { buildWhatsAppUrl } from '../utils/whatsapp';

export function CustomersView() {
  const {
    customers,
    workspaceToken,
    signIn,
    addCustomer,
    importGoogleContactsCustomers,
  } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [tier, setTier] = useState<CustomerRecord['tier']>('Silver');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isImportingContacts, setIsImportingContacts] = useState(false);

  // Explicit confirmation modal before mutating Google Contacts (per workspace-integration mandate)
  const [contactToExport, setContactToExport] = useState<CustomerRecord | null>(null);
  const [isExportingContact, setIsExportingContact] = useState(false);

  // AI WhatsApp promo drafter
  const [draftTarget, setDraftTarget] = useState<CustomerRecord | null>(null);
  const [draftText, setDraftText] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setFeedback('Nama pelanggan dan nomor WhatsApp wajib diisi.');
      return;
    }
    await addCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      tier,
      address: address.trim(),
      notes: notes.trim(),
    });
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setFeedback('Pelanggan setia berhasil ditambahkan dan disinkronkan.');
  };

  const handleImportFromGoogleContacts = async () => {
    setFeedback(null);
    let token = workspaceToken;
    if (!token) {
      await signIn();
      return;
    }

    setIsImportingContacts(true);
    try {
      const res = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses,addresses&pageSize=30',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) {
        throw new Error(`Google Contacts merespons HTTP ${res.status}`);
      }
      const data = await res.json();
      const connections = Array.isArray(data.connections) ? data.connections : [];
      const mapped = connections.map((person: any) => ({
        name: person.names?.[0]?.displayName || '',
        phone: person.phoneNumbers?.[0]?.value || '',
        email: person.emailAddresses?.[0]?.value || '',
        address: person.addresses?.[0]?.formattedValue || '',
      }));
      const imported = await importGoogleContactsCustomers(mapped);
      setFeedback(
        imported > 0
          ? `Berhasil mengimpor ${imported} pelanggan dari Google Contacts Anda.`
          : 'Semua kontak yang relevan sudah ada di daftar pelanggan.'
      );
    } catch (err: any) {
      setFeedback(err?.message || 'Gagal membaca Google Contacts.');
    } finally {
      setIsImportingContacts(false);
    }
  };

  const handleConfirmExportToGoogleContacts = async () => {
    if (!contactToExport) return;
    if (!workspaceToken) {
      await signIn();
      return;
    }
    setIsExportingContact(true);
    try {
      const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${workspaceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          names: [{ givenName: contactToExport.name }],
          phoneNumbers: contactToExport.phone ? [{ value: contactToExport.phone, type: 'mobile' }] : [],
          emailAddresses: contactToExport.email ? [{ value: contactToExport.email }] : [],
          biographies: [{ value: `Pelanggan Setia BOGAJAYA (${contactToExport.tier}) - ${contactToExport.notes}` }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Gagal menyimpan ke Google Contacts (HTTP ${res.status})`);
      }
      setFeedback(`Kontak "${contactToExport.name}" berhasil disimpan ke Google Contacts Anda.`);
      setContactToExport(null);
    } catch (err: any) {
      setFeedback(err?.message || 'Gagal menyimpan ke Google Contacts.');
    } finally {
      setIsExportingContact(false);
    }
  };

  const handleGenerateWaDraft = async (customer: CustomerRecord) => {
    setDraftTarget(customer);
    setIsDrafting(true);
    setDraftText('');
    try {
      const res = await fetch('/api/gemini/whatsapp-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.name,
          tier: customer.tier,
          favoriteItems: customer.notes || 'Sambal Suroboyo & Kue Blinjo Boyya',
          promoNote: 'Paket Oleh-Oleh Hemat & Diskon Member Setia Bogajaya',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat draf.');
      setDraftText(data.message);
    } catch (err: any) {
      setDraftText(`Halo ${customer.name}, terima kasih telah menjadi pelanggan ${customer.tier} Toko Bogajaya Surabaya! Kami punya stok baru Sambal & Kue Blinjo resep kuno.`);
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            Manajemen Pelanggan Setia &amp; Integrasi Google Contacts
          </h2>
          <p className="text-xs text-stone-500">
            Kelola poin loyalti, riwayat belanja, sinkronisasi Google Contacts, dan pengiriman promo WhatsApp otomatis
          </p>
        </div>

        <button
          type="button"
          onClick={handleImportFromGoogleContacts}
          disabled={isImportingContacts}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors whitespace-nowrap"
        >
          <Contact className="w-4 h-4 text-red-800" />
          {isImportingContacts
            ? 'Mengimpor...'
            : workspaceToken
              ? 'Impor dari Google Contacts'
              : 'Hubungkan Google Contacts'}
        </button>
      </div>

      {feedback && (
        <div role="status" className="text-xs px-4 py-2.5 rounded-lg bg-stone-900 text-white">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add Loyal Customer Form */}
        <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
            <UserPlus className="w-4 h-4 text-red-800" />
            <h3 className="text-sm font-bold text-stone-900">Tambah Pelanggan Baru</h3>
          </div>
          <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label htmlFor="cust-name" className="font-medium text-stone-700 block">
                Nama Lengkap *
              </label>
              <input
                id="cust-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mis. Ibu Kartika Sari"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cust-phone" className="font-medium text-stone-700 block">
                Nomor WhatsApp *
              </label>
              <input
                id="cust-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full px-3 py-2 font-mono bg-white border border-stone-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cust-email" className="font-medium text-stone-700 block">
                  Email
                </label>
                <input
                  id="cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="cust-tier" className="font-medium text-stone-700 block">
                  Tier Member
                </label>
                <select
                  id="cust-tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as CustomerRecord['tier'])}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
                >
                  <option value="Reguler">Reguler</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="cust-addr" className="font-medium text-stone-700 block">
                Alamat Pengiriman
              </label>
              <input
                id="cust-addr"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Raya Gubeng, Surabaya"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cust-notes" className="font-medium text-stone-700 block">
                Produk Favorit / Catatan
              </label>
              <input
                id="cust-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sambal Cakalang, Kue Blinjo"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg transition-colors"
            >
              Simpan Data Pelanggan
            </button>
          </form>
        </div>

        {/* Customers Directory */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-stone-600" />
              <h3 className="text-sm font-bold text-stone-900">
                Daftar Pelanggan Setia ({customers.length})
              </h3>
            </div>
            <div className="divide-y divide-stone-100">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900">
                      {c.name}
                    </div>
                    <div className="text-xs text-stone-500 flex flex-wrap items-center gap-2">
                      <span>Tier {c.tier}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{c.points} poin</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Belanja {formatIDR(c.totalSpent)} ({c.visitCount}x)
                      </span>
                    </div>
                    {c.phone && (
                      <div className="text-[11px] font-mono text-stone-500">
                        WA: {c.phone} {c.address ? `· ${c.address}` : ''}
                      </div>
                    )}
                  </div>

                  {c.id !== 'cust-umum' && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleGenerateWaDraft(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Pesan WA
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactToExport(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors"
                      >
                        <Contact className="w-3.5 h-3.5" />
                        Simpan ke Contacts
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp AI Draft Preview Box */}
          {draftTarget && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-stone-900">
                  Draf WhatsApp untuk {draftTarget.name}
                </h4>
                <button
                  type="button"
                  onClick={() => setDraftTarget(null)}
                  className="text-xs text-stone-500 hover:text-stone-900"
                >
                  Tutup
                </button>
              </div>
              <textarea
                rows={4}
                value={isDrafting ? 'Menyusun pesan personal dengan Gemini AI...' : draftText}
                onChange={(e) => setDraftText(e.target.value)}
                aria-label="Isi pesan WhatsApp"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg"
              />
              <div className="flex justify-end">
                <a
                  href={buildWhatsAppUrl(draftTarget.phone, draftText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <MessageCircle className="w-4 h-4" />
                  Buka WhatsApp &amp; Kirim
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explicit Confirmation Modal before mutating Google Contacts */}
      {contactToExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-contact-title"
        >
          <div className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 id="confirm-contact-title" className="text-base font-bold text-stone-900">
              Konfirmasi Simpan ke Google Contacts
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Apakah Anda yakin ingin menambahkan kontak baru ke akun Google Contacts Anda dengan detail berikut?
            </p>
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs space-y-1">
              <div><strong>Nama:</strong> {contactToExport.name}</div>
              <div><strong>Telepon/WA:</strong> {contactToExport.phone || '-'}</div>
              <div><strong>Email:</strong> {contactToExport.email || '-'}</div>
              <div><strong>Tier:</strong> {contactToExport.tier}</div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContactToExport(null)}
                className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmExportToGoogleContacts}
                disabled={isExportingContact}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg disabled:opacity-50"
              >
                {isExportingContact ? 'Menyimpan...' : 'Konfirmasi & Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
