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
      portfoy_baslik = p ? p.isim : null;
      payload_portfoy_id = selectedId;
      const { data: m } = await supabase.from('musteriler').select('ad, soyad').eq('id', musteriId).maybeSingle();
      musteri_ad = m ? `${m.ad} ${m.soyad}` : null;
    } else if (portfoyId) {
      const m = options.find(o => o.id === selectedId) as Musteri | undefined;
      musteri_ad = m ? `${m.ad} ${m.soyad}` : null;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>Eşleştirme Geçmişi</span>
        <button onClick={openAdd} className="btn-gold" style={{ padding: '4px 10px', fontSize: 12 }}>
          <Plus size={13} /> Ekle
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={20} className="animate-spin" style={{ color: '#D4AF37' }} /></div>
      ) : gecmis.length === 0 ? (
        <p style={{ fontSize: 12, color: '#8B7355', textAlign: 'center', padding: 12 }}>Henüz eşleştirme yok</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gecmis.map(g => {
            const cfg = SONUC_CONFIG[g.sonuc as SonucKey] || SONUC_CONFIG.bekliyor;
            const Icon = cfg.icon;
            return (
              <div key={g.id} style={{ border: '1px solid #F6D9A8', borderRadius: 8, padding: '8px 12px', background: '#FAFAFA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18' }}>
                      {g.musteri_ad || g.portfoy_baslik || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>
                      {new Date(g.gosterildi_tarihi || g.created_at).toLocaleDateString('tr-TR')}
                      {g.danisman && ` · ${g.danisman}`}
                    </div>
                    {g.notlar && <div style={{ fontSize: 11, color: '#5F5E5A', marginTop: 2 }}>{g.notlar}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(Object.keys(SONUC_CONFIG) as SonucKey[]).map(key => {
                      const c = SONUC_CONFIG[key];
                      const Ic = c.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => updateSonuc(g.id, key)}
                          style={{
                            background: g.sonuc === key ? c.bg : 'transparent',
                            border: `1px solid ${g.sonuc === key ? c.color : '#D4C9B8'}`,
                            borderRadius: 4,
                            padding: '2px 4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          title={c.label}
                        >
                          <Ic size={12} color={g.sonuc === key ? c.color : '#8B7355'} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-content" style={{ maxWidth: 380 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h3 className="font-bold" style={{ color: '#1A1A18' }}>Yeni Eşleştirme</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div className="modal-body p-4 flex flex-col gap-3">
              <div>
                <label className="label">{musteriId ? 'Portföy Seç' : 'Müşteri Seç'}</label>
                <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">Seçin...</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{optionLabel(o)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notlar</label>
                <textarea className="input" rows={2} value={notlar} onChange={e => setNotlar(e.target.value)} />
              </div>
              <div>
                <label className="label">Takip Tarihi</label>
                <input type="date" className="input" value={takipTarihi} onChange={e => setTakipTarihi(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={save} className="btn-gold flex-1" disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Kaydet'}
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-ghost">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
