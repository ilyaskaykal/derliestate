import { useState, useEffect, useRef } from 'react';
import { Plus, Search, X, Edit2, Trash2, Building2, MapPin, Maximize, Bed, Eye, Download, QrCode, Share2, Loader2, Sparkles, Camera, ChevronDown, ChevronUp, Filter, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isAdminLevel } from '../types';
import { callClaude } from '../lib/claude';
import { CESME_BOLGELERI } from '../types';
import PriceInput, { displayPrice } from '../components/PriceInput';
import { PortfoyStatusBadge } from '../components/StatusBadge';
import { PortfoyWhatsApp } from '../components/WhatsAppButton';
import QRModal from '../components/QRModal';
import PhotoEnhancer from '../components/PhotoEnhancer';
import type { Portfoy, PortfoyDurum, PortfoyTip } from '../types';

const TIP_OPTIONS: PortfoyTip[] = ['daire', 'villa', 'arsa', 'ticari', 'yazlik', 'mustakil', 'rezidans', 'bina', 'ofis'];
const DURUM_OPTIONS: PortfoyDurum[] = ['aktif', 'pasif', 'satildi', 'kiralik', 'kiralandi', 'opsiyon'];

const EMPTY_FORM: Omit<Portfoy, 'id' | 'created_at'> = {
  isim: '', bolge: '', mahalle: '', ilce: '', il: 'İzmir',
  fiyat: '', para_birimi: 'TL', tip: 'daire', oda: '', metrekare: '',
  kat: '', toplam_kat: '', bina_yasi: '', isitma: '', banyo: '',
  portfoy_durum: 'aktif', aciklama: '', ozellikler: [],
  denize_yakin: false, deniz_manzarasi: false, havuz: false, bahce: false,
  garaj: false, asansor: false, guvenlik: false, ebeveyn_banyosu: false,
  foto_url: [], tapu_durumu: '', ada: '', parsel: '', pafta: '',
  eids_status: 'yok', eids_son_tarih: '',
  sahibi_ad: '', sahibi_telefon: '', sahibi_tc: '',
  komisyon_orani: '', portfoy_kodu: '', takas_acik: false,
};

export default function Portfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [portfolios, setPortfolios] = useState<Portfoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState<string>('');
  const [tipFilter, setTipFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Portfoy | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [qrPortfoy, setQrPortfoy] = useState<Portfoy | null>(null);
  const [enhancerUrl, setEnhancerUrl] = useState<string | null>(null);
  const [expandedOzellikler, setExpandedOzellikler] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'musteriler'>('info');
  const [portfoyGeziler, setPortfoyGeziler] = useState<{id:string;musteri_ad:string|null;gezi_tarihi:string;musteri_dusuncesi:string|null;sonuc:string;danisman:string|null}[]>([]);
  const [portfoyGezilerLoading, setPortfoyGezilerLoading] = useState(false);
  const [filterTakas, setFilterTakas] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [sahibindenUrl, setSahibindenUrl] = useState('');
  const [fetchingIlan, setFetchingIlan] = useState(false);
  const [filledFields, setFilledFields] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('portfoyler').select('*').order('created_at', { ascending: false });
    const { data } = await q;
    setPortfolios(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = portfolios.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.isim?.toLowerCase().includes(q) || p.bolge?.toLowerCase().includes(q) || p.mahalle?.toLowerCase().includes(q) || p.portfoy_kodu?.toLowerCase().includes(q);
    const matchDurum = !durumFilter || p.portfoy_durum === durumFilter;
    const matchTip = !tipFilter || p.tip === tipFilter;
    const matchTakas = !filterTakas || p.takas_acik;
    return matchSearch && matchDurum && matchTip && matchTakas;
  });

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setAiAnalysis(''); setSahibindenUrl(''); setFilledFields([]); setShowModal(true); };
  const openEdit = (p: Portfoy) => { setSahibindenUrl(''); setFilledFields([]); setEditing(p); setForm({ isim: p.isim || '', bolge: p.bolge || '', mahalle: p.mahalle || '', ilce: p.ilce || '', il: p.il || 'İzmir', fiyat: p.fiyat || '', para_birimi: p.para_birimi || 'TL', tip: p.tip || 'daire', oda: p.oda || '', metrekare: p.metrekare || '', kat: p.kat || '', toplam_kat: p.toplam_kat || '', bina_yasi: p.bina_yasi || '', isitma: p.isitma || '', banyo: p.banyo || '', portfoy_durum: p.portfoy_durum || 'aktif', aciklama: p.aciklama || '', ozellikler: p.ozellikler || [], denize_yakin: p.denize_yakin || false, deniz_manzarasi: p.deniz_manzarasi || false, havuz: p.havuz || false, bahce: p.bahce || false, garaj: p.garaj || false, asansor: p.asansor || false, guvenlik: p.guvenlik || false, ebeveyn_banyosu: p.ebeveyn_banyosu || false, foto_url: p.foto_url || [], tapu_durumu: p.tapu_durumu || '', ada: p.ada || '', parsel: p.parsel || '', pafta: p.pafta || '', eids_status: p.eids_status || 'yok', eids_son_tarih: p.eids_son_tarih || '', sahibi_ad: p.sahibi_ad || '', sahibi_telefon: p.sahibi_telefon || '', sahibi_tc: p.sahibi_tc || '', komisyon_orani: p.komisyon_orani || '', portfoy_kodu: p.portfoy_kodu || '', takas_acik: p.takas_acik || false }); setAiAnalysis(''); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.isim.trim()) { toast('Portföy adı zorunludur.', 'error'); return; }
    setSaving(true);
    const payload = { ...form, danismanid: user?.id };
    if (editing) {
      const { error } = await supabase.from('portfoyler').update(payload).eq('id', editing.id);
      if (error) toast(error.message, 'error');
      else { toast('Portföy güncellendi.', 'success'); setShowModal(false); load(); }
    } else {
      const { error } = await supabase.from('portfoyler').insert(payload);
      if (error) toast(error.message, 'error');
      else { toast('Portföy eklendi.', 'success'); setShowModal(false); load(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('portfoyler').delete().eq('id', deleteId);
    if (error) toast(error.message, 'error');
    else { toast('Portföy silindi.', 'success'); load(); }
    setDeleteId(null);
  };

  const fetchFromSahibinden = async () => {
    if (!sahibindenUrl.trim()) return;
    setFetchingIlan(true);
    setFilledFields([]);
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(sahibindenUrl.trim())}`;
      const res = await fetch(proxyUrl);
      const html = await res.text();
      const prompt = `Bu Sahibinden.com ilan HTML'inden bilgileri çıkar ve SADECE JSON döndür, başka hiçbir şey yazma:
{
  "baslik": "ilan başlığı",
  "fiyat": "sadece rakam yaz, nokta veya virgül olmadan",
  "metrekare": "sadece rakam",
  "oda": "örn: 3+1",
  "kat": "bulunduğu kat (sadece rakam)",
  "toplam_kat": "bina toplam kat sayısı (sadece rakam)",
  "isitma": "ısıtma tipi",
  "aciklama": "ilan açıklaması (max 500 karakter)",
  "mahalle": "mahalle adı",
  "ilce": "ilçe adı",
  "il": "il adı",
  "bina_yasi": "bina yaşı sadece rakam"
}

HTML (ilk 15000 karakter):
${html.substring(0, 15000)}`;
      const raw = await callClaude(prompt, 600);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON çıkarılamadı');
      const data = JSON.parse(jsonMatch[0]);
      const filled: string[] = [];
      setForm(f => {
        const next = { ...f };
        if (data.baslik) { next.isim = data.baslik; filled.push('isim'); }
        if (data.fiyat) { next.fiyat = data.fiyat; filled.push('fiyat'); }
        if (data.metrekare) { next.metrekare = data.metrekare; filled.push('metrekare'); }
        if (data.oda) { next.oda = data.oda; filled.push('oda'); }
        if (data.kat) { next.kat = data.kat; filled.push('kat'); }
        if (data.toplam_kat) { next.toplam_kat = data.toplam_kat; filled.push('toplam_kat'); }
        if (data.isitma) { next.isitma = data.isitma; filled.push('isitma'); }
        if (data.aciklama) { next.aciklama = data.aciklama; filled.push('aciklama'); }
        if (data.mahalle) { next.mahalle = data.mahalle; filled.push('mahalle'); }
        if (data.ilce) { next.ilce = data.ilce; filled.push('ilce'); }
        if (data.il) { next.il = data.il; filled.push('il'); }
        if (data.bina_yasi) { next.bina_yasi = data.bina_yasi; filled.push('bina_yasi'); }
        return next;
      });
      setFilledFields(filled);
      toast(`${filled.length} alan otomatik dolduruldu`, 'success');
    } catch (err: any) {
      toast('İlan çekilemedi, bilgileri manuel girin.', 'error');
    }
    setFetchingIlan(false);
  };

  const generateDescription = async () => {
    setAiDescLoading(true);
    const feats = [
      form.denize_yakin && 'denize yakın',
      form.deniz_manzarasi && 'deniz manzaralı',
      form.havuz && 'havuzlu',
      form.bahce && 'bahçeli',
      form.garaj && 'garajlı',
      form.asansor && 'asansörlü',
      form.guvenlik && 'güvenlikli',
    ].filter(Boolean).join(', ');
    const prompt = `Sahibinden.com için Türkçe profesyonel gayrimenkul ilan açıklaması yaz. Sadece açıklama metni yaz, başlık veya etiket ekleme.

Özellikler:
- Tip: ${form.tip}
- Bölge: ${[form.mahalle, form.bolge, form.ilce, form.il].filter(Boolean).join(', ')}
- Fiyat: ${form.fiyat} ${form.para_birimi}
- Oda: ${form.oda || 'belirtilmemiş'}
- m²: ${form.metrekare || 'belirtilmemiş'}
- Kat: ${form.kat || 'belirtilmemiş'}/${form.toplam_kat || 'belirtilmemiş'}
- Bina Yaşı: ${form.bina_yasi || 'belirtilmemiş'}
- Özellikler: ${feats || 'standart'}
${(form.ozellikler || []).length > 0 ? `- İç özellikler: ${form.ozellikler!.join(', ')}` : ''}

3-4 cümle, akıcı, satış odaklı, abartısız bir açıklama yaz.`;
    try {
      const text = await callClaude(prompt, 400, 'Sen deneyimli bir Türk gayrimenkul danışmanısın. Akıcı, gerçekçi ve satış odaklı ilan açıklamaları yazıyorsun.');
      setForm(f => ({ ...f, aciklama: text.trim() }));
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setAiDescLoading(false);
  };

  const runAiAnalysis = async () => {
    setAiLoading(true);
    const prompt = `Sen bir Türk gayrimenkul uzmanısın. Şu portföy için piyasa analizi yap:
İsim: ${form.isim}, Bölge: ${form.bolge} ${form.mahalle}, Tip: ${form.tip}, Fiyat: ${displayPrice(form.fiyat, form.para_birimi)}, Oda: ${form.oda}, m²: ${form.metrekare}, Durum: ${form.portfoy_durum}.
3-4 cümle, piyasa değerlendirmesi, güçlü/zayıf yönler, fiyat tavsiyesi.`;
    const answer = await callClaude(prompt, 300);
    setAiAnalysis(answer);
    setAiLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `portfolio/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('portfoy-fotolar').upload(fileName, file);
    if (error) { toast(error.message, 'error'); return; }
    const { data: urlData } = supabase.storage.from('portfoy-fotolar').getPublicUrl(fileName);
    setForm(f => ({ ...f, foto_url: [...(f.foto_url || []), urlData.publicUrl] }));
  };

  const detail = detailId ? portfolios.find(p => p.id === detailId) : null;

  const toggleOzellik = (key: string) => {
    setForm(f => {
      const arr = f.ozellikler || [];
      return { ...f, ozellikler: arr.includes(key) ? arr.filter(x => x !== key) : [...arr, key] };
    });
  };

  const OZELLIK_LIST = ['Beyaz Eşya', 'Ankastre', 'Amerikan Mutfak', 'Açık Otopark', 'Kapalı Otopark', 'Site İçi', 'Teras', 'Balkon', 'Jakuzi', 'Sauna', 'Spor Salonu', 'Çocuk Parkı', 'BBQ Alanı', 'Depo', 'Kiler'];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Portföyler</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>{portfolios.length} portföy</p>
        </div>
        <button onClick={openAdd} className="btn-gold"><Plus size={15} /> Yeni Portföy</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} color="#8B7355" />
          <input placeholder="Portföy ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
        </div>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="input" style={{ width: 140 }}>
          <option value="">Tüm Durumlar</option>
          {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={tipFilter} onChange={e => setTipFilter(e.target.value)} className="input" style={{ width: 140 }}>
          <option value="">Tüm Tipler</option>
          {TIP_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setFilterTakas(v => !v)}
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${filterTakas ? '#534AB7' : '#E8D9B8'}`, background: filterTakas ? '#534AB7' : '#fff', color: filterTakas ? '#fff' : '#8B7355', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
        >
          Takas
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8B7355' }}>
          <Building2 size={40} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
          <p>Portföy bulunamadı</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden', transition: 'box-shadow 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              {/* Photo */}
              <div style={{ height: 160, background: '#F5F0E8', position: 'relative', overflow: 'hidden' }}>
                {p.foto_url?.[0] ? (
                  <img src={p.foto_url[0]} alt={p.isim} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Building2 size={40} color="#D4C9B8" />
                  </div>
                )}
                <div style={{ position: 'absolute', top: 8, left: 8 }}>
                  <PortfoyStatusBadge status={p.portfoy_durum} />
                </div>
                {p.portfoy_kodu && (
                  <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(26,26,24,0.85)', color: '#D4AF37', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid rgba(212,175,55,0.4)' }}>
                    #{p.portfoy_kodu}
                  </div>
                )}
                {/* Price badge bottom-left */}
                <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(26,26,24,0.85)', color: '#D4AF37', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: '1px solid rgba(212,175,55,0.4)' }}>
                  {displayPrice(p.fiyat, p.para_birimi)}
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1A1A18', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.isim}</h3>
                  {p.takas_acik && <span style={{ fontSize: 10, fontWeight: 700, background: '#534AB7', color: '#fff', padding: '2px 6px', borderRadius: 99, flexShrink: 0 }}>🔄 Takas</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8B7355', fontSize: 12, marginBottom: 8 }}>
                  <MapPin size={11} /> {[p.mahalle, p.bolge].filter(Boolean).join(', ') || p.il}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#8B7355', marginBottom: 12 }}>
                  {p.oda && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Bed size={11} />{p.oda}</span>}
                  {p.metrekare && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Maximize size={11} />{p.metrekare}m²</span>}
                  {p.tip && <span style={{ background: '#F5F0E8', padding: '1px 6px', borderRadius: 4, textTransform: 'capitalize' }}>{p.tip}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setDetailId(p.id); setDetailTab('info'); }} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '6px 8px', fontSize: 12 }}><Eye size={13} /> Detay</button>
                  <button onClick={() => openEdit(p)} className="btn-ghost" style={{ padding: '6px 8px' }}><Edit2 size={13} /></button>
                  {p.foto_url?.[0] && <button onClick={() => setQrPortfoy(p)} className="btn-ghost" style={{ padding: '6px 8px' }}><QrCode size={13} /></button>}
                  <PortfoyWhatsApp portfoy={p} />
                  {isAdminLevel(user?.rol) && <button onClick={() => setDeleteId(p.id)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #FFD0CC', background: 'transparent', color: '#FF3B2F', cursor: 'pointer' }}><Trash2 size={13} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailId(null)}>
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold" style={{ color: '#1A1A18' }}>{detail.isim}</h2>
              <button onClick={() => setDetailId(null)}><X size={18} /></button>
            </div>
            {/* Detail tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #F6D9A8', background: '#FAF6EF' }}>
              {[{ id: 'info', label: 'Bilgiler' }, { id: 'musteriler', label: 'İlgilenen Müşteriler' }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setDetailTab(tab.id as 'info' | 'musteriler');
                    if (tab.id === 'musteriler' && detail) {
                      setPortfoyGezilerLoading(true);
                      supabase.from('musteri_gezileri').select('id,musteri_ad,gezi_tarihi,musteri_dusuncesi,sonuc,danisman').eq('portfoy_id', detail.id).order('gezi_tarihi', { ascending: false }).then(({ data }) => { setPortfoyGeziler(data || []); setPortfoyGezilerLoading(false); });
                    }
                  }}
                  style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: detailTab === tab.id ? '#1A1A18' : '#8B7355', borderBottom: detailTab === tab.id ? '2px solid #D4AF37' : '2px solid transparent', transition: 'all 0.15s' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="modal-body p-4">
              {detailTab === 'info' && (<>
              {detail.foto_url?.[0] && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {detail.foto_url.map((url, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={url} style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }} onClick={() => setEnhancerUrl(url)} />
                      <div style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2, cursor: 'pointer' }} onClick={() => setEnhancerUrl(url)}>
                        <Camera size={10} color="#fff" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Fiyat', displayPrice(detail.fiyat, detail.para_birimi)],
                  ['Tip', detail.tip],
                  ['Bölge', detail.bolge],
                  ['Mahalle', detail.mahalle],
                  ['İlçe/İl', `${detail.ilce || ''} ${detail.il || ''}`],
                  ['Oda', detail.oda],
                  ['m²', detail.metrekare ? `${detail.metrekare} m²` : ''],
                  ['Kat', detail.kat ? `${detail.kat}/${detail.toplam_kat}` : ''],
                  ['Bina Yaşı', detail.bina_yasi],
                  ['Isıtma', detail.isitma],
                  ['Banyo', detail.banyo],
                  ['Tapu', detail.tapu_durumu],
                  ['Sahibi', detail.sahibi_ad],
                  ['EİDS', detail.eids_status],
                  ['Kod', detail.portfoy_kodu],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string}>
                    <span style={{ fontSize: 11, color: '#8B7355' }}>{k}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{v}</div>
                  </div>
                ))}
              </div>
              {detail.aciklama && (
                <div style={{ marginTop: 12, padding: 12, background: '#FAF6EF', borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: '#5A4A3A' }}>{detail.aciklama}</p>
                </div>
              )}
              </>)}

              {detailTab === 'musteriler' && (
                <div>
                  {portfoyGezilerLoading ? (
                    <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="animate-spin" color="#D4AF37" style={{ display: 'inline-block' }} /></div>
                  ) : portfoyGeziler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#8B7355', fontSize: 13 }}>
                      <Users size={28} color="#D4C9B8" style={{ margin: '0 auto 8px' }} />
                      <p>Henüz bu portföy gösterilmedi</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {portfoyGeziler.map(g => {
                        const sonucColors: Record<string, string> = { begendi: '#059669', begenmedı: '#DC2626', dusunuyor: '#D97706', bekliyor: '#9CA3AF' };
                        const sonucLabels: Record<string, string> = { begendi: 'Beğendi', begenmedı: 'Beğenmedi', dusunuyor: 'Düşünüyor', bekliyor: 'Bekliyor' };
                        return (
                          <div key={g.id} style={{ border: '1px solid #F0E8D8', borderRadius: 10, padding: 12, background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>{g.musteri_ad}</div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: sonucColors[g.sonuc] || '#9CA3AF', background: (sonucColors[g.sonuc] || '#9CA3AF') + '20', padding: '2px 8px', borderRadius: 99 }}>{sonucLabels[g.sonuc] || g.sonuc}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#8B7355', marginBottom: g.musteri_dusuncesi ? 6 : 0 }}>{new Date(g.gezi_tarihi).toLocaleDateString('tr-TR')} · {g.danisman}</div>
                            {g.musteri_dusuncesi && <p style={{ fontSize: 12, color: '#5A4A3A', fontStyle: 'italic', margin: 0 }}>{g.musteri_dusuncesi}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => { setDetailId(null); openEdit(detail); }} className="btn-gold"><Edit2 size={14} /> Düzenle</button>
              <PortfoyWhatsApp portfoy={detail} />
              {detail.foto_url?.[0] && <button onClick={() => setQrPortfoy(detail)} className="btn-ghost"><QrCode size={14} /> QR</button>}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold" style={{ color: '#1A1A18' }}>{editing ? 'Portföy Düzenle' : 'Yeni Portföy'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body p-4">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Sahibinden auto-fill */}
                  <div style={{ background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', marginBottom: 8 }}>Sahibinden.com'dan Otomatik Doldur</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={sahibindenUrl}
                        onChange={e => setSahibindenUrl(e.target.value)}
                        placeholder="https://www.sahibinden.com/ilan/..."
                        className="input"
                        style={{ flex: 1, fontSize: 12 }}
                      />
                      <button
                        type="button"
                        onClick={fetchFromSahibinden}
                        disabled={fetchingIlan || !sahibindenUrl.trim()}
                        style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #2563EB', background: fetchingIlan ? '#EFF6FF' : '#2563EB', color: fetchingIlan ? '#2563EB' : '#fff', cursor: fetchingIlan ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {fetchingIlan ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {fetchingIlan ? 'Çekiliyor...' : 'İlanı Çek'}
                      </button>
                    </div>
                    {filledFields.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {filledFields.map(f => (
                          <span key={f} style={{ fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Basic info */}
                  <div>
                    <label className="label">Portföy Adı *</label>
                    <input value={form.isim} onChange={e => setForm(f => ({ ...f, isim: e.target.value }))} className="input" required placeholder="ör. Çeşme Deniz Manzaralı Villa" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Portföy Kodu</label>
                      <input value={form.portfoy_kodu} onChange={e => setForm(f => ({ ...f, portfoy_kodu: e.target.value }))} className="input" placeholder="ör. DE-001" />
                    </div>
                    <div>
                      <label className="label">Tip</label>
                      <select value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value as PortfoyTip }))} className="input">
                        {TIP_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <label className="label">Fiyat</label>
                    <PriceInput value={form.fiyat} currency={form.para_birimi} onChange={(v, c) => setForm(f => ({ ...f, fiyat: v, para_birimi: c }))} />
                  </div>

                  {/* Location */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Bölge</label>
                      <select value={form.bolge} onChange={e => setForm(f => ({ ...f, bolge: e.target.value }))} className="input">
                        <option value="">Seçin</option>
                        {CESME_BOLGELERI.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Mahalle</label>
                      <input value={form.mahalle} onChange={e => setForm(f => ({ ...f, mahalle: e.target.value }))} className="input" placeholder="Mahalle adı" />
                    </div>
                    <div>
                      <label className="label">İlçe</label>
                      <input value={form.ilce} onChange={e => setForm(f => ({ ...f, ilce: e.target.value }))} className="input" placeholder="ör. Çeşme" />
                    </div>
                    <div>
                      <label className="label">İl</label>
                      <input value={form.il} onChange={e => setForm(f => ({ ...f, il: e.target.value }))} className="input" placeholder="ör. İzmir" />
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <label className="label">Oda Sayısı</label>
                      <input value={form.oda} onChange={e => setForm(f => ({ ...f, oda: e.target.value }))} className="input" placeholder="ör. 3+1" />
                    </div>
                    <div>
                      <label className="label">m²</label>
                      <input type="number" value={form.metrekare} onChange={e => setForm(f => ({ ...f, metrekare: e.target.value }))} className="input" placeholder="120" />
                    </div>
                    <div>
                      <label className="label">Banyo</label>
                      <input type="number" value={form.banyo} onChange={e => setForm(f => ({ ...f, banyo: e.target.value }))} className="input" placeholder="2" />
                    </div>
                    <div>
                      <label className="label">Kat</label>
                      <input value={form.kat} onChange={e => setForm(f => ({ ...f, kat: e.target.value }))} className="input" placeholder="3" />
                    </div>
                    <div>
                      <label className="label">Toplam Kat</label>
                      <input value={form.toplam_kat} onChange={e => setForm(f => ({ ...f, toplam_kat: e.target.value }))} className="input" placeholder="8" />
                    </div>
                    <div>
                      <label className="label">Bina Yaşı</label>
                      <input type="number" value={form.bina_yasi} onChange={e => setForm(f => ({ ...f, bina_yasi: e.target.value }))} className="input" placeholder="5" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Isıtma</label>
                      <input value={form.isitma} onChange={e => setForm(f => ({ ...f, isitma: e.target.value }))} className="input" placeholder="ör. Doğalgaz" />
                    </div>
                    <div>
                      <label className="label">Durum</label>
                      <select value={form.portfoy_durum} onChange={e => setForm(f => ({ ...f, portfoy_durum: e.target.value as PortfoyDurum }))} className="input">
                        {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div>
                    <label className="label">Özellikler</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      {['denize_yakin', 'deniz_manzarasi', 'havuz', 'bahce', 'garaj', 'asansor', 'guvenlik', 'ebeveyn_banyosu'].map(key => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#1A1A18' }}>
                          <input type="checkbox" checked={!!form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} style={{ accentColor: '#D4AF37' }} />
                          {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </label>
                      ))}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={form.takas_acik || false} onChange={e => setForm(f => ({ ...f, takas_acik: e.target.checked }))} style={{ accentColor: '#534AB7', width: 16, height: 16 }} />
                        <span style={{ color: '#534AB7', fontWeight: 600 }}>Takasa Acik</span>
                      </label>
                    </div>
                    <button type="button" onClick={() => setExpandedOzellikler(v => !v)} style={{ fontSize: 11, color: '#8B7355', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {expandedOzellikler ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Ek özellikler
                    </button>
                    {expandedOzellikler && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        {OZELLIK_LIST.map(o => (
                          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#1A1A18', background: (form.ozellikler || []).includes(o) ? '#FFF3CD' : '#FAF6EF', padding: '3px 8px', borderRadius: 6, border: '1px solid ' + ((form.ozellikler || []).includes(o) ? '#D4AF37' : 'transparent') }}>
                            <input type="checkbox" checked={(form.ozellikler || []).includes(o)} onChange={() => toggleOzellik(o)} style={{ accentColor: '#D4AF37' }} />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Owner info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Mal Sahibi Adı</label>
                      <input value={form.sahibi_ad} onChange={e => setForm(f => ({ ...f, sahibi_ad: e.target.value }))} className="input" />
                    </div>
                    <div>
                      <label className="label">Mal Sahibi Telefon</label>
                      <input value={form.sahibi_telefon} onChange={e => setForm(f => ({ ...f, sahibi_telefon: e.target.value }))} className="input" placeholder="+90 532 xxx xxxx" />
                    </div>
                    <div>
                      <label className="label">Tapu Durumu</label>
                      <input value={form.tapu_durumu} onChange={e => setForm(f => ({ ...f, tapu_durumu: e.target.value }))} className="input" placeholder="ör. Kat mülkiyeti" />
                    </div>
                    <div>
                      <label className="label">Komisyon Oranı (%)</label>
                      <input type="number" value={form.komisyon_orani} onChange={e => setForm(f => ({ ...f, komisyon_orani: e.target.value }))} className="input" placeholder="3" />
                    </div>
                  </div>

                  {/* EİDS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">EİDS Durumu</label>
                      <select value={form.eids_status} onChange={e => setForm(f => ({ ...f, eids_status: e.target.value as any }))} className="input">
                        {['yok', 'bekliyor', 'isleniyor', 'tamamlandi', 'iptal', 'suresi_doldu'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">EİDS Son Tarih</label>
                      <input type="date" value={form.eids_son_tarih} onChange={e => setForm(f => ({ ...f, eids_son_tarih: e.target.value }))} className="input" />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="label" style={{ marginBottom: 0 }}>Açıklama</label>
                      <button type="button" onClick={generateDescription} disabled={aiDescLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid #D4AF37', background: aiDescLoading ? '#FAF6EF' : '#fff', color: '#B8860B', fontSize: 11, fontWeight: 700, cursor: aiDescLoading ? 'default' : 'pointer', transition: 'background 0.15s' }}>
                        {aiDescLoading ? <Loader2 size={12} className="animate-spin" color="#D4AF37" /> : <Sparkles size={12} color="#D4AF37" />}
                        Açıklama Yaz
                      </button>
                    </div>
                    <textarea value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} className="input" rows={3} style={{ resize: 'vertical' }} placeholder="Portföy hakkında detaylı bilgi..." />
                  </div>

                  {/* Photos */}
                  <div>
                    <label className="label">Fotoğraflar</label>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-ghost" style={{ marginBottom: 8 }}>
                      <Camera size={14} /> Fotoğraf Yükle
                    </button>
                    {(form.foto_url || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {form.foto_url!.map((url, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <img src={url} style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                            <button type="button" onClick={() => setForm(f => ({ ...f, foto_url: f.foto_url!.filter((_, j) => j !== i) }))} style={{ position: 'absolute', top: -4, right: -4, background: '#FF3B2F', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <X size={8} color="#fff" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Analysis */}
                  <div style={{ background: '#FAF6EF', borderRadius: 8, padding: 12, border: '1px solid #F0E8D8' }}>
                    <button type="button" onClick={runAiAnalysis} className="btn-ghost" style={{ marginBottom: aiAnalysis ? 8 : 0 }} disabled={aiLoading}>
                      {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} color="#D4AF37" />}
                      AI Piyasa Analizi
                    </button>
                    {aiAnalysis && <p style={{ fontSize: 12, color: '#5A4A3A', lineHeight: 1.6 }}>{aiAnalysis}</p>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn-gold flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Güncelle' : 'Kaydet')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 360 }}>
            <div className="p-6 text-center">
              <Trash2 size={32} color="#FF3B2F" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1A1A18', marginBottom: 8 }}>Portföyü Sil</h3>
              <p style={{ color: '#8B7355', fontSize: 13, marginBottom: 20 }}>Bu portföy kalıcı olarak silinecek.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleDelete} style={{ flex: 1, padding: '9px', background: '#FF3B2F', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Sil</button>
                <button onClick={() => setDeleteId(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {qrPortfoy && <QRModal value={`${window.location.origin}/portfoy/${qrPortfoy.id}`} title={qrPortfoy.isim} onClose={() => setQrPortfoy(null)} />}
      {enhancerUrl && <PhotoEnhancer imageUrl={enhancerUrl} onClose={() => setEnhancerUrl(null)} />}
    </div>
  );
}
