import React, { useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Navigation, Search } from 'lucide-react';
import { BOGAJAYA_BRANCHES, type StoreBranch } from '../data/seedData';
import { useStore } from '../context/StoreContext';

function BranchMarker({
  branch,
  isSelected,
  onSelect,
}: {
  branch: StoreBranch;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: branch.lat, lng: branch.lng }}
        onClick={onSelect}
        title={branch.name}
      >
        <Pin
          background={isSelected ? '#991B1B' : '#1C1917'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.25 : 1.05}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onSelect}>
          <div className="p-1 max-w-xs space-y-1 text-stone-900">
            <div className="font-bold text-sm">{branch.name}</div>
            <div className="text-xs text-stone-600">{branch.address}</div>
            <div className="text-xs font-mono text-stone-700">
              {branch.hours} · WA {branch.phone}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface GroundingChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: Array<{ content?: string }>;
    };
  };
}

export function BranchesMapView() {
  const { settings, updateSettings } = useStore();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(BOGAJAYA_BRANCHES[0].id);
  const [mapQuery, setMapQuery] = useState(
    'Rekomendasi rute pengiriman paket oleh-oleh sekitar Stasiun Gubeng dan Bandara Juanda Surabaya'
  );
  const [groundingResult, setGroundingResult] = useState<{
    text: string;
    groundingChunks: GroundingChunk[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const selectedBranch =
    BOGAJAYA_BRANCHES.find((b) => b.id === selectedBranchId) || BOGAJAYA_BRANCHES[0];

  const handleMapsGroundingQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      let lat = selectedBranch.lat;
      let lng = selectedBranch.lng;
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lng = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 2000 }
          );
        });
      }

      const res = await fetch('/api/gemini/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mapQuery.trim(), lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencari informasi lokasi.');
      setGroundingResult(data);
    } catch (err: any) {
      setSearchError(err?.message || 'Terjadi kesalahan saat mencari lokasi Google Maps.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            Peta Cabang Toko Bogajaya &amp; Pencarian Lokasi Pengiriman
          </h2>
          <p className="text-xs text-stone-500">
            Pantau titik outlet Surabaya/Sidoarjo, ganti cabang kasir aktif, dan cek area pengiriman dengan Google Maps Grounding
          </p>
        </div>
        <div className="text-xs text-stone-600">
          Cabang Kasir Aktif: <strong className="text-red-800">{settings.activeBranch}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Branch Cards */}
        <div className="lg:col-span-4 space-y-3">
          {BOGAJAYA_BRANCHES.map((branch) => {
            const active = branch.id === selectedBranchId;
            const isCurrentKasir = settings.activeBranch === branch.name;
            return (
              <div
                key={branch.id}
                className={`bg-white border rounded-xl p-4 space-y-2 transition-colors ${
                  active ? 'border-red-800' : 'border-stone-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBranchId(branch.id)}
                    className="text-left flex items-center gap-2 font-bold text-sm text-stone-900 hover:text-red-800"
                  >
                    <MapPin className="w-4 h-4 text-red-800 shrink-0" />
                    {branch.name}
                  </button>
                  {isCurrentKasir && (
                    <span className="text-[11px] font-semibold text-emerald-700">Aktif</span>
                  )}
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{branch.address}</p>
                <div className="text-[11px] text-stone-500 font-mono">
                  {branch.hours} · Kepala Cabang: {branch.manager}
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ activeBranch: branch.name })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isCurrentKasir
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                    }`}
                  >
                    {isCurrentKasir ? 'Cabang Kasir Aktif' : 'Gunakan di Kasir'}
                  </button>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Rute
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Interactive Google Map + Maps Grounding */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {mapsApiKey ? (
              <div className="w-full h-[380px]">
                <APIProvider apiKey={mapsApiKey} language="id" region="ID" libraries={['marker']}>
                  <GoogleMapView
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: -7.305, lng: 112.758 }}
                    defaultZoom={11}
                    gestureHandling="greedy"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {BOGAJAYA_BRANCHES.map((branch) => (
                      <BranchMarker
                        key={branch.id}
                        branch={branch}
                        isSelected={branch.id === selectedBranchId}
                        onSelect={() => setSelectedBranchId(branch.id)}
                      />
                    ))}
                  </GoogleMapView>
                </APIProvider>
              </div>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center bg-stone-50 p-6 text-center space-y-2">
                <MapPin className="w-8 h-8 text-red-800" />
                <p className="text-sm font-semibold text-stone-900">
                  Peta Interaktif Google Maps Siap
                </p>
                <p className="text-xs text-stone-500 max-w-md">
                  Tambahkan kunci <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> pada environment Vercel atau panel konfigurasi untuk merender peta interaktif, atau gunakan pencarian lokasi Maps Grounding di bawah ini.
                </p>
              </div>
            )}
          </div>

          {/* Google Maps Grounding Search */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-stone-900">
              Pencarian Lokasi &amp; Zona Pengiriman (Google Maps Grounding)
            </h3>
            <form onSubmit={handleMapsGroundingQuery} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <label htmlFor="maps-grounding-query" className="sr-only">
                  Tanya lokasi atau rute pengiriman Surabaya
                </label>
                <input
                  id="maps-grounding-query"
                  type="text"
                  value={mapQuery}
                  onChange={(e) => setMapQuery(e.target.value)}
                  placeholder="Cari landmark pengiriman, hotel, atau area Surabaya..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-800"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-800 hover:bg-red-900 rounded-lg whitespace-nowrap disabled:opacity-50"
              >
                {isSearching ? 'Mencari...' : 'Cari via Google Maps AI'}
              </button>
            </form>

            {searchError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {searchError}
              </p>
            )}

            {groundingResult && (
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {groundingResult.text}
                </div>
                {groundingResult.groundingChunks.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-stone-600">
                      Tautan Lokasi Terverifikasi Google Maps:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groundingResult.groundingChunks.map((chunk, idx) =>
                        chunk.maps?.uri ? (
                          <a
                            key={idx}
                            href={chunk.maps.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                          >
                            {chunk.maps.title || 'Buka di Google Maps'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
