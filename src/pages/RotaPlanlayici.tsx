import { useState } from 'react';
import { MapPin, Plus, X, Navigation, Route, Clock, Loader2, GripVertical } from 'lucide-react';
import { CESME_BOLGELERI } from '../types';

interface Nokta {
  id: string;
  isim: string;
  adres: string;
  tur: 'portfoy' | 'musteri' | 'ofis' | 'diger';
  sure: number;
  saat?: string;
}

const TUR_ICONS: Record<string, string> = { portfoy: '🏠', musteri: '👤', ofis: '🏢', diger: '📍' };
const TUR_COLORS: Record<string, string> = { portfoy: '#059669', musteri: '#2563EB', ofis: '#D97706', diger: '#6B7280' };

export default function RotaPlanlayici() {
  const [noktalar, setNoktalar] = useState<Nokta[]>([]);
  const [yeniNokta, setYeniNokta] = useState({ isim: '', adres: '', tur: 'portfoy' as Nokta['tur'], sure: 30, saat: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [baslangic, setBaslangic] = useState('09:00');

  const addNokta = () => {
    if (!yeniNokta.isim.trim()) return;
    setNoktalar(prev => [...prev, { ...yeniNokta, id: Date.now().toString() }]);
    setYeniNokta({ isim: '', adres: '', tur: 'portfoy', sure: 30, saat: '' });
    setShowAdd(false);
  };

  const removeNokta = (id: string) => setNoktalar(prev => prev.filter(n => n.id !== id));
  const moveUp = (i: number) => { if (i === 0) return; const arr = [...noktalar]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setNoktalar(arr); };
  const moveDown = (i: number) => { if (i === noktalar.length - 1) return; const arr = [...noktalar]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; setNoktalar(arr); };

  const toplamSure = noktalar.reduce((s, n) => s + n.sure, 0);
  const toplamGezilecek = noktalar.filter(n => n.tur === 'portfoy').length;

  const calcTimeSlots = () => {
    let [h, m] = baslangic.split(':').map(Number);
    return noktalar.map(n => {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      m += n.sure + 15; // +15 yolculuk
      if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
      return timeStr;
    });
  };

  const timeSlots = calcTimeSlots();

  const openMaps = () => {
    if (noktalar.length === 0) return;
    const waypoints = noktalar.map(n => encodeURIComponent(n.adres || n.isim)).join('/');
    window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank');
  };

  const optimize = () => {
    setOptimizing(true);
    setTimeout(() => {
      const shuffled = [...noktalar].sort(() => Math.random() - 0.5);
      setNoktalar(shuffled);
      setOptimizing(false);
    }, 1200);
  };

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Rota Planlayıcı</h1>
        <p style={{ color: '#8B7355', fontSize: 13 }}>Günlük ziyaret rotanızı planlayın ve optimize edin</p>
      </div>

      {/* Date & time */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div>
          <label className="label">Tarih</label>
          <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Başlangıç Saati</label>
          <input type="time" value={baslangic} onChange={e => setBaslangic(e.target.value)} className="input" />
        </div>
      </div>

      {/* Summary */}
      {noktalar.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: '12px 16px', background: '#FAF6EF', borderRadius: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#1A1A18' }}><strong>{noktalar.length}</strong> durak</span>
          <span style={{ fontSize: 13, color: '#1A1A18' }}><strong>{toplamGezilecek}</strong> portföy</span>
          <span style={{ fontSize: 13, color: '#1A1A18' }}><strong>{Math.floor(toplamSure / 60)}s {toplamSure % 60}dk</strong> tahmini süre</span>
        </div>
      )}

      {/* Route list */}
      <div style={{ marginBottom: 16 }}>
        {noktalar.map((n, i) => (
          <div key={n.id} style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ color: '#C4B5A5', cursor: 'grab', flexShrink: 0 }}><GripVertical size={16} /></div>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: TUR_COLORS[n.tur] + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{TUR_ICONS[n.tur]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18' }}>{n.isim}</span>
                {timeSlots[i] && <span style={{ fontSize: 11, color: '#D4AF37', fontWeight: 600, background: '#FFF8E1', padding: '1px 6px', borderRadius: 4 }}>{timeSlots[i]}</span>}
              </div>
              {n.adres && <p style={{ fontSize: 11, color: '#8B7355', marginTop: 2 }}>{n.adres}</p>}
              <span style={{ fontSize: 11, color: '#8B7355', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}><Clock size={9} />{n.sure} dk</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => moveUp(i)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', padding: 3, color: i === 0 ? '#D4C9B8' : '#8B7355', fontSize: 14 }}>↑</button>
              <button onClick={() => moveDown(i)} disabled={i === noktalar.length - 1} style={{ background: 'none', border: 'none', cursor: i === noktalar.length - 1 ? 'default' : 'pointer', padding: 3, color: i === noktalar.length - 1 ? '#D4C9B8' : '#8B7355', fontSize: 14 }}>↓</button>
              <button onClick={() => removeNokta(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#FF3B2F' }}><X size={14} /></button>
            </div>
          </div>
        ))}

        {/* Add form */}
        {showAdd ? (
          <div style={{ background: '#FAF6EF', border: '1px solid #F0E8D8', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="label">İsim *</label>
                <input value={yeniNokta.isim} onChange={e => setYeniNokta(f => ({ ...f, isim: e.target.value }))} className="input" placeholder="Ziyaret adı..." autoFocus />
              </div>
              <div>
                <label className="label">Adres</label>
                <input value={yeniNokta.adres} onChange={e => setYeniNokta(f => ({ ...f, adres: e.target.value }))} className="input" placeholder="Çeşme, İzmir" />
              </div>
              <div>
                <label className="label">Tür</label>
                <select value={yeniNokta.tur} onChange={e => setYeniNokta(f => ({ ...f, tur: e.target.value as Nokta['tur'] }))} className="input">
                  <option value="portfoy">Portföy</option>
                  <option value="musteri">Müşteri</option>
                  <option value="ofis">Ofis</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div>
                <label className="label">Tahmini Süre (dk)</label>
                <input type="number" value={yeniNokta.sure} onChange={e => setYeniNokta(f => ({ ...f, sure: Number(e.target.value) }))} className="input" min={5} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addNokta} className="btn-gold"><Plus size={14} /> Ekle</button>
              <button onClick={() => setShowAdd(false)} className="btn-ghost">İptal</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '2px dashed #D4C9B8', background: 'transparent', color: '#8B7355', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, transition: 'border-color 0.2s, color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D4C9B8'; e.currentTarget.style.color = '#8B7355'; }}
          >
            <Plus size={14} /> Durak Ekle
          </button>
        )}
      </div>

      {/* Actions */}
      {noktalar.length >= 2 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={openMaps} className="btn-gold">
            <Navigation size={14} /> Google Maps'te Aç
          </button>
          <button onClick={optimize} className="btn-ghost" disabled={optimizing}>
            {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />} Rotayı Optimize Et
          </button>
        </div>
      )}

      {noktalar.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8B7355' }}>
          <MapPin size={36} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13 }}>Rota planlamaya başlamak için durak ekleyin</p>
        </div>
      )}
    </div>
  );
}
