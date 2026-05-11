import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, X, Navigation, Loader2, ArrowUpDown, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Portfoy } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface Stop {
  id: string;
  portfoy?: Portfoy;
  address: string;
}

export default function RotaPlanlayici() {
  const { effectiveUser } = useAuth();
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('portfoyler').select('id, isim, bolge, il, ilce, mahalle, ada, parsel, fiyat, para_birimi, tip').order('created_at', { ascending: false });
    if (effectiveUser?.rol === 'danisan' || effectiveUser?.rol === 'kıdemli_danisan') {
      q = q.eq('eklendi_user_id', effectiveUser.username);
    }
    const { data } = await q;
    setPortfoyler((data || []) as Portfoy[]);
    setLoading(false);
  }, [effectiveUser]);

  useEffect(() => { load(); }, [load]);

  const buildAddress = (p: Portfoy): string => {
    // Build a real address: mahalle + ilce + il preferred; fall back to bolge then isim
    const parts = [p.mahalle, p.ilce, p.il].filter(Boolean);
    if (parts.length >= 2) return parts.join(', ');
    if (p.bolge) return [p.bolge, p.il || 'İzmir'].filter(Boolean).join(', ');
    return `${p.isim}, Çeşme, İzmir`;
  };

  const addStop = (p: Portfoy) => {
    if (stops.some(s => s.portfoy?.id === p.id)) return;
    setStops(prev => [...prev, { id: crypto.randomUUID(), portfoy: p, address: buildAddress(p) }]);
    setSearch('');
  };

  const removeStop = (id: string) => setStops(prev => prev.filter(s => s.id !== id));

  const moveStop = (idx: number, dir: -1 | 1) => {
    setStops(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const buildRouteUrl = () => {
    if (stops.length === 0) return '#';
    // Last stop is destination; everything before it becomes waypoints
    const destination = encodeURIComponent(stops[stops.length - 1].address);
    const waypointAddresses = stops.slice(0, -1).map(s => encodeURIComponent(s.address)).join('|');
    // Omit origin so Google Maps uses the device's current location
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    if (waypointAddresses) url += `&waypoints=${waypointAddresses}`;
    return url;
  };

  const filtered = portfoyler.filter(p => {
    if (!search.trim()) return false;
    const q = search.toLowerCase();
    return p.isim.toLowerCase().includes(q) || p.bolge?.toLowerCase().includes(q) || p.mahalle?.toLowerCase().includes(q);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #F6D9A8', background: 'white' }}>
        <div className="flex items-center gap-3">
          <Navigation size={20} style={{ color: '#D4AF37' }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: '#1A1A18' }}>Akıllı Rota Planlayıcı</h1>
            <p className="text-xs" style={{ color: '#8B7355' }}>Portföy ziyaret rotanızı optimize edin</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
        {/* Info banner */}
        <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <MapPin size={16} className="shrink-0 mt-0.5" style={{ color: '#22c55e' }} />
          <p className="text-sm" style={{ color: 'rgba(34,197,94,0.9)' }}>
            Rota <strong>mevcut konumunuzdan</strong> başlar. Google Maps uygulaması otomatik olarak cihazınızın konumunu kullanır.
          </p>
        </div>

        {/* Portföy search */}
        <div className="card p-4 space-y-3">
          <label className="label flex items-center gap-2"><Plus size={13} />Portföy Ekle</label>
          <input
            className="input"
            placeholder="Portföy ara: isim, bölge, mahalle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #F6D9A8' }}>
              {loading ? (
                <div className="flex items-center justify-center py-4 text-dark-400"><Loader2 className="animate-spin mr-2" size={16} />Yükleniyor...</div>
              ) : filtered.length === 0 ? (
                <div className="py-4 text-center text-dark-400 text-sm">Portföy bulunamadı</div>
              ) : filtered.slice(0, 8).map(p => (
                <button
                  key={p.id}
                  onClick={() => addStop(p)}
                  disabled={stops.some(s => s.portfoy?.id === p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all text-sm"
                  style={{
                    borderBottom: '1px solid #F6D9A8',
                    background: stops.some(s => s.portfoy?.id === p.id) ? 'rgba(212,175,55,0.05)' : 'transparent',
                    color: stops.some(s => s.portfoy?.id === p.id) ? 'rgba(212,175,55,0.5)' : '#1A1A18',
                  }}
                >
                  <Building2 size={15} style={{ color: '#D4AF37', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.isim}</p>
                    <p className="text-xs text-dark-400 truncate">{[p.mahalle, p.ilce].filter(Boolean).join(', ')}</p>
                  </div>
                  {stops.some(s => s.portfoy?.id === p.id) && <span className="text-xs" style={{ color: '#D4AF37' }}>Eklendi</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stops list */}
        {stops.length > 0 && (
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1A1A18' }}>
              <MapPin size={14} style={{ color: '#D4AF37' }} />
              Duraklar ({stops.length})
            </h3>
            <div className="space-y-2">
              {stops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #C8A020)', color: '#fff' }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    {stop.portfoy && <p className="text-sm font-medium truncate" style={{ color: '#1A1A18' }}>{stop.portfoy.isim}</p>}
                    <p className="text-xs text-dark-400 truncate">{stop.address}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => moveStop(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-stone-200 transition-all disabled:opacity-30"
                      style={{ color: '#8B7355' }}
                    >
                      <ArrowUpDown size={13} className="rotate-180" />
                    </button>
                    <button
                      onClick={() => moveStop(idx, 1)}
                      disabled={idx === stops.length - 1}
                      className="p-1 rounded hover:bg-stone-200 transition-all disabled:opacity-30"
                      style={{ color: '#8B7355' }}
                    >
                      <ArrowUpDown size={13} />
                    </button>
                    <button
                      onClick={() => removeStop(stop.id)}
                      className="p-1 rounded hover:bg-red-500/10 transition-all"
                      style={{ color: 'rgba(239,68,68,0.6)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <a
              href={buildRouteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #C8A020)', color: '#fff', boxShadow: '0 4px 20px rgba(212,175,55,0.3)' }}
            >
              <Navigation size={16} />
              Google Maps'ta Rotayı Aç
            </a>
          </div>
        )}

        {stops.length === 0 && !search && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: '#8B7355' }}>
            <Navigation size={40} />
            <p className="text-sm">Rota oluşturmak için portföy ekleyin</p>
          </div>
        )}
      </div>
    </div>
  );
}
