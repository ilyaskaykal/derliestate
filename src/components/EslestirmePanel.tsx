import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Loader2, CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { EslestirmeGecmisi, Musteri, Portfoy } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const SONUC_CONFIG = {
  olumlu:   { label: 'Olumlu',    icon: CheckCircle, color: '#22A05A', bg: 'rgba(34,160,90,0.1)' },
  olumsuz:  { label: 'Olumsuz',   icon: XCircle,     color: '#FF3B2F', bg: 'rgba(255,59,47,0.1)' },
  dusunuyor:{ label: 'Düşünüyor', icon: HelpCircle,  color: '#E8A020', bg: 'rgba(232,160,32,0.1)' },
  bekliyor: { label: 'Bekliyor',  icon: Clock,       color: '#8B7355', bg: 'rgba(139,115,85,0.1)' },
} as const;

type SonucKey = keyof typeof SONUC_CONFIG;

interface Props {
  musteriId?: string;
  portfoyId?: string;
}

export default function EslestirmePanel({ musteriId, portfoyId }: Props) {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const [gecmis, setGecmis] = useState<EslestirmeGecmisi[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [options, setOptions] = useState<(Musteri | Portfoy)[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [notlar, setNotlar] = useState('');
  const [takipTarihi, setTakipTarihi] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('eslestirme_gecmisi').select('*').order('gosterildi_tarihi', { ascending: false });
    if (musteriId) q = q.eq('musteri_id', musteriId);
    if (portfoyId) q = q.eq('portfoy_id', portfoyId);
    const { data } = await q;
    setGecmis((data || []) as EslestirmeGecmisi[]);
    setLoading(false);
  }, [musteriId, portfoyId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = async () => {
    if (musteriId) {
      const { data } = await supabase.from('portfoyler').select('id, isim, bolge').order('isim');
      setOptions((data || []) as Portfoy[]);
    } else if (portfoyId) {
      const { data } = await supabase.from('musteriler').select('id, ad, soyad').order('ad');
      setOptions((data || []) as Musteri[]);
    }
    setSelectedId('');
    setNotlar('');
    setTakipTarihi('');
    setShowAdd(true);
  };

  const save = async () => {
    if (!selectedId) { toast('Lütfen seçim yapın.', 'error'); return; }
    setSaving(true);
    let musteri_ad: string | null = null;
    let portfoy_baslik: string | null = null;
    let payload_musteri_id = musteriId || null;
    let payload_portfoy_id = portfoyId || null;

    if (musteriId) {
      const p = options.find(o => o.id === selectedId) as Portfoy | undefined;
      portfoy_baslik = p ? (p as Portfoy).isim : null;
      payload_portfoy_id = selectedId;
      const { data: m } = await supabase.from('musteriler').select('ad, soyad').eq('id', musteriId).maybeSingle();
      musteri_ad = m ? `${m.ad} ${m.soyad}` : null;
    } else if (portfoyId) {
      const m = options.find(o => o.id === selectedId) as Musteri | undefined;
      musteri_ad = m ? `${(m as Musteri).ad} ${(m as Musteri).soyad}` : null;
      payload_musteri_id = selectedId;
      const { data: p } = await supabase.from('portfoyler').select('isim').eq('id', portfoyId).maybeSingle();
      portfoy_baslik = p?.isim || null;
    }

    const { error } = await supabase.from('eslestirme_gecmisi').insert({
      musteri_id: payload_musteri_id,
      portfoy_id: payload_portfoy_id,
      musteri_ad,
      portfoy_baslik,
      sonuc: 'bekliyor',
      notlar: notlar || null,
      takip_tarihi: takipTarihi || null,
      danisman: `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim() || null,
    });
    if (error) toast('Hata: ' + error.message, 'error');
    else { toast('Eşleştirme kaydedildi.'); setShowAdd(false); load(); }
    setSaving(false);
  };

  const updateSonuc = async (id: string, sonuc: SonucKey) => {
    await supabase.from('eslestirme_gecmisi').update({ sonuc }).eq('id', id);
    setGecmis(prev => prev.map(g => g.id === id ? { ...g, sonuc } : g));
  };

  const optionLabel = (o: Musteri | Portfoy) => {
    if ('isim' in o) return (o as Portfoy).isim;
    return `${(o as Musteri).ad} ${(o as Musteri).soyad}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: '#1A1A18' }}>
          {musteriId ? 'Gösterilen Portföyler' : 'İlgi Gösteren Müşteriler'}
          <span className="ml-1.5 text-xs" style={{ color: '#8B7355' }}>({gecmis.length})</span>
        </span>
        <button onClick={openAdd} className="btn-gold text-xs py-1.5 px-3">
          <Plus size={12} />
          {musteriId ? 'Portföy Göster' : 'Müşteri Ekle'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={16} style={{ color: '#8B7355' }} /></div>
      ) : gecmis.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: '#8B7355' }}>Kayıt yok</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {gecmis.map(g => {
            const sc = SONUC_CONFIG[g.sonuc as SonucKey] || SONUC_CONFIG.bekliyor;
            const SIcon = sc.icon;
            return (
              <div
                key={g.id}
                className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                style={{ background: '#F5F0E8', border: '0.5px solid #D4C9B8' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#1A1A18' }}>
                    {musteriId ? g.portfoy_baslik : g.musteri_ad}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#8B7355' }}>
                    {new Date(g.gosterildi_tarihi).toLocaleDateString('tr-TR')}
                    {g.takip_tarihi && ` · Takip: ${new Date(g.takip_tarihi).toLocaleDateString('tr-TR')}`}
                  </p>
                </div>
                <select
                  value={g.sonuc}
                  onChange={e => updateSonuc(g.id, e.target.value as SonucKey)}
                  className="text-[10px] rounded-lg px-1.5 py-1 focus:outline-none"
                  style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44` }}
                >
                  {Object.entries(SONUC_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <SIcon size={14} style={{ color: sc.color, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="modal-overlay" style={{ zIndex: 60 }}>
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: '#D4C9B8' }}>
              <h3 className="font-semibold text-sm" style={{ color: '#1A1A18' }}>
                {musteriId ? 'Portföy Gösterildi' : 'Müşteri Kaydı'}
              </h3>
              <button onClick={() => setShowAdd(false)} style={{ color: '#8B7355' }}><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="label">{musteriId ? 'Portföy' : 'Müşteri'} *</label>
                <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">Seçin...</option>
                  {options.map(o => <option key={o.id} value={o.id}>{optionLabel(o)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Takip Tarihi</label>
                <input type="date" className="input" value={takipTarihi} onChange={e => setTakipTarihi(e.target.value)} />
              </div>
              <div>
                <label className="label">Notlar</label>
                <textarea className="input h-16 resize-none text-xs" value={notlar} onChange={e => setNotlar(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost flex-1 justify-center">İptal</button>
              <button onClick={save} disabled={saving} className="btn-gold flex-1 justify-center">
                {saving ? <Loader2 className="animate-spin" size={14} /> : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
