import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Users, X, Loader2, Eye, Flame, ShoppingCart, Brain, Clock, MessageSquare, Target, Phone, MapPin, Facebook } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Musteri, MusteriDurum, CESME_BOLGELERI } from '../types';
import { MusteriStatusBadge } from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import PriceInput, { Currency, displayPrice } from '../components/PriceInput';
import { callClaude } from '../lib/claude';
import EslestirmePanel from '../components/EslestirmePanel';
import { MusteriWhatsApp } from '../components/WhatsAppButton';
import { calcTags, calcTier } from '../lib/segmentation';

const DURUM_OPTIONS: { value: MusteriDurum; label: string }[] = [
  { value: 'sicak', label: 'Sıcak' },
  { value: 'satin_alacak', label: 'Satın Alacak' },
  { value: 'dusunuyor', label: 'Düşünüyor' },
  { value: 'kararsiz', label: 'Kararsız' },
  { value: 'gelmedi', label: 'No Show' },
  { value: 'soguk', label: 'Soğuk' },
];

type FormState = Omit<Musteri, 'id' | 'created_at'>;

function emptyForm(danisman: string, userId = '', userAd = ''): FormState {
  return {
    ad: '', soyad: '', telefon: '', email: '', muhit: '', butce: '',
    butce_min: '', butce_max: '', para_birimi: 'TL', bolge_esnek: false,
    olmaz_olmaz: '', kesin_istekler: '', aciklama: '', danisman,
    portfoy_tercihi: '', durum: 'kararsiz', kaynak: '', notlar: '',
    eklendi_user_id: userId, eklendi_user_ad: userAd,
    denize_yakin: false, deniz_manzarasi: false,
    yabanci_musteri: false, uyruk: '', pasaport_no: '', dil_tercihi: '',
    turkiye_kalis_suresi: '', vatandaslik_durumu: '', takas_acik: false,
  };
}

function formatBudgetShort(val: string, currency: string): string {
  const n = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return val;
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '₺';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M ${sym}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ${sym}`;
  return `${n} ${sym}`;
}

function calcLeadScore(m: Musteri): number {
  let score = 0;
  if (m.durum === 'satin_alacak') score += 40;
  else if (m.durum === 'sicak') score += 35;
  else if (m.durum === 'dusunuyor') score += 20;
  else if (m.durum === 'kararsiz') score += 10;
  else score += 0;

  const budget = parseFloat(String(m.butce_max || m.butce || '0').replace(/\D/g, ''));
  if (budget >= 35_000_000) score += 30;
  else if (budget >= 20_000_000) score += 20;
  else if (budget >= 10_000_000) score += 10;

  const days = Math.floor((Date.now() - new Date(m.created_at).getTime()) / 86400000);
  if (days <= 7) score += 15;
  else if (days <= 30) score += 10;
  else if (days <= 90) score += 5;

  if (m.denize_yakin) score += 5;
  if (m.deniz_manzarasi) score += 5;

  return Math.min(score, 100);
}

function LeadScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? '#DC2626' : score >= 50 ? '#D97706' : '#059669';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
      <div style={{ flex: 1, height: 4, background: '#F0E8D8', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 24 }}>{score}</span>
    </div>
  );
}

interface CallTiming {
  en_iyi_gun: string;
  en_iyi_saat: string;
  iletisim_yontemi: string;
  sebep: string;
}

interface CallCoaching {
  acilis_cumlesi: string;
  dikkat_edilecekler: string[];
  onerilen_yaklasim: string;
  kapatis_stratejisi: string;
}

interface Gezi {
  id: string;
  musteri_id: string;
  portfoy_id: string | null;
  musteri_ad: string | null;
  portfoy_ad: string | null;
  gezi_tarihi: string;
  musteri_dusuncesi: string | null;
  sonuc: string;
  danisman: string | null;
  created_at: string;
}

interface PortfoyMinimal {
  id: string;
  isim: string;
  bolge: string | null;
  fiyat: string;
  para_birimi: string | null;
  foto_url: string[] | null;
}

export default function Customers() {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
  const isAdminOrYonetici = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';

  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Musteri | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(danismanAdi, effectiveUser?.username || '', danismanAdi));
  const [saving, setSaving] = useState(false);
  const [selectedMusteri, setSelectedMusteri] = useState<Musteri | null>(null);
  const [filterDurum, setFilterDurum] = useState<MusteriDurum | 'tumu'>('tumu');
  const [filterTakas, setFilterTakas] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'gezi'>('info');
  const [geziler, setGeziler] = useState<Gezi[]>([]);
  const [geziLoading, setGeziLoading] = useState(false);
  const [showGeziAdd, setShowGeziAdd] = useState(false);
  const [portfoyList, setPortfoyList] = useState<PortfoyMinimal[]>([]);
  const [geziForm, setGeziForm] = useState({ portfoy_id: '', musteri_dusuncesi: '', sonuc: 'bekliyor' });
  const [geziSaving, setGeziSaving] = useState(false);

  // AI state
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiCallTimeLoading, setAiCallTimeLoading] = useState(false);
  const [aiCallTime, setAiCallTime] = useState<CallTiming | null>(null);
  const [aiCoachLoading, setAiCoachLoading] = useState(false);
  const [aiCoach, setAiCoach] = useState<CallCoaching | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('musteriler').select('*').order('created_at', { ascending: false });
    setMusteriler(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clear AI + gezi state when switching customers
  useEffect(() => {
    setAiSummary('');
    setAiCallTime(null);
    setAiCoach(null);
    setDetailTab('info');
    setGeziler([]);
    if (selectedMusteri?.musteri_ozeti) setAiSummary(selectedMusteri.musteri_ozeti);
    if (selectedMusteri?.takip_zamanlamasi) setAiCallTime(selectedMusteri.takip_zamanlamasi as CallTiming);
  }, [selectedMusteri?.id]);

  const loadGeziler = useCallback(async (musteriId: string) => {
    setGeziLoading(true);
    const { data } = await supabase
      .from('musteri_gezileri')
      .select('*')
      .eq('musteri_id', musteriId)
      .order('gezi_tarihi', { ascending: false });
    setGeziler(data || []);
    setGeziLoading(false);
  }, []);

  useEffect(() => {
    if (detailTab === 'gezi' && selectedMusteri) {
      loadGeziler(selectedMusteri.id);
      supabase.from('portfoyler').select('id,isim,bolge,fiyat,para_birimi,foto_url').eq('portfoy_durum', 'aktif').order('isim').limit(50).then(({ data }) => setPortfoyList(data || []));
    }
  }, [detailTab, selectedMusteri?.id]);

  const saveGezi = async () => {
    if (!selectedMusteri || !geziForm.portfoy_id) return;
    setGeziSaving(true);
    const portfoy = portfoyList.find(p => p.id === geziForm.portfoy_id);
    const { error } = await supabase.from('musteri_gezileri').insert({
      musteri_id: selectedMusteri.id,
      portfoy_id: geziForm.portfoy_id,
      musteri_ad: `${selectedMusteri.ad} ${selectedMusteri.soyad}`,
      portfoy_ad: portfoy?.isim || '',
      gezi_tarihi: new Date().toISOString(),
      musteri_dusuncesi: geziForm.musteri_dusuncesi,
      sonuc: geziForm.sonuc,
      danisman: danismanAdi,
    });
    if (error) toast(error.message, 'error');
    else {
      toast('Gezi kaydedildi!', 'success');
      setShowGeziAdd(false);
      setGeziForm({ portfoy_id: '', musteri_dusuncesi: '', sonuc: 'bekliyor' });
      loadGeziler(selectedMusteri.id);
    }
    setGeziSaving(false);
  };

  const updateGeziSonuc = async (geziId: string, sonuc: string) => {
    await supabase.from('musteri_gezileri').update({ sonuc }).eq('id', geziId);
    setGeziler(prev => prev.map(g => g.id === geziId ? { ...g, sonuc } : g));
  };

  const updateGeziNot = async (geziId: string, not: string) => {
    await supabase.from('musteri_gezileri').update({ musteri_dusuncesi: not }).eq('id', geziId);
  };

  const filtered = useMemo(() => {
    let list = musteriler;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.ad.toLowerCase().includes(q) ||
        m.soyad.toLowerCase().includes(q) ||
        m.telefon.includes(q) ||
        m.muhit.toLowerCase().includes(q)
      );
    }
    if (filterDurum !== 'tumu') list = list.filter(m => m.durum === filterDurum);
    if (filterTakas) list = list.filter(m => m.takas_acik);
    return list;
  }, [musteriler, search, filterDurum]);

  const stats = {
    total: musteriler.length,
    sicak: musteriler.filter(m => m.durum === 'sicak').length,
    satin_alacak: musteriler.filter(m => m.durum === 'satin_alacak').length,
  };

  const openAdd = () => {
    setForm(emptyForm(danismanAdi, effectiveUser?.username || '', danismanAdi));
    setEditItem(null);
    setShowForm(true);
  };

  const openEdit = (m: Musteri) => {
    setForm({ ...m } as FormState);
    setEditItem(m);
    setShowForm(true);
  };

  const canEdit = (m: Musteri) => isAdminOrYonetici || m.eklendi_user_id === effectiveUser?.username || !m.eklendi_user_id;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editItem) {
      const { error } = await supabase.from('musteriler').update({ ...form }).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else toast('Müşteri güncellendi.');
    } else {
      const { error } = await supabase.from('musteriler').insert({ ...form });
      if (error) toast('Hata oluştu.', 'error'); else toast('Müşteri eklendi.');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Bu müşteriyi silmek istediğinizden emin misiniz?')) return;
    await supabase.from('musteriler').delete().eq('id', id);
    toast('Müşteri silindi.');
    load();
    if (selectedMusteri?.id === id) setSelectedMusteri(null);
  };

  // AI: YZ Özet
  const generateSummary = async () => {
    if (!selectedMusteri) return;
    setAiSummaryLoading(true);
    try {
      const daysSince = Math.floor((Date.now() - new Date(selectedMusteri.created_at).getTime()) / 86400000);
      const prompt = `Emlak müşterisini 2-3 cümlede özetle:
Ad: ${selectedMusteri.ad} ${selectedMusteri.soyad}
Süredir arıyor: ${daysSince} gün
Bütçe: ${selectedMusteri.butce_min || ''} - ${selectedMusteri.butce_max || selectedMusteri.butce || 'Belirtilmemiş'}
Bölge: ${selectedMusteri.muhit || 'Belirtilmemiş'}
Durum: ${selectedMusteri.durum}
Denize yakın: ${selectedMusteri.denize_yakin ? 'İstiyor' : 'Şart değil'}
Deniz manzarası: ${selectedMusteri.deniz_manzarasi ? 'İstiyor' : 'Şart değil'}
Notlar: ${selectedMusteri.notlar || 'Yok'}

2-3 cümle Türkçe özet yaz.`;
      const result = await callClaude(prompt, 300, 'Sen DerliEstate Pro emlak asistanısın. Türkçe cevap ver.');
      setAiSummary(result);
      // Persist to DB
      await supabase.from('musteriler').update({ musteri_ozeti: result }).eq('id', selectedMusteri.id);
    } catch (err) {
      toast('AI özet üretilemedi: ' + String(err), 'error');
    }
    setAiSummaryLoading(false);
  };

  // AI: En İyi Arama Saati
  const analyzeCallTime = async () => {
    if (!selectedMusteri) return;
    setAiCallTimeLoading(true);
    try {
      const prompt = `Emlak müşterisi için en iyi iletişim zamanını öner.
Meslek/Notlar: ${selectedMusteri.notlar || 'Yok'}
Bütçe: ${selectedMusteri.butce_max || selectedMusteri.butce || 'Belirtilmemiş'}
Durum: ${selectedMusteri.durum}

Sadece JSON döndür, başka hiçbir şey yazma:
{"en_iyi_gun":"Salı-Perşembe","en_iyi_saat":"14:00-17:00","iletisim_yontemi":"WhatsApp","sebep":"kısa açıklama"}`;
      const raw = await callClaude(prompt, 300, 'Sen DerliEstate Pro emlak asistanısın. Sadece JSON döndür.');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON parse hatası');
      const result: CallTiming = JSON.parse(jsonMatch[0]);
      setAiCallTime(result);
      await supabase.from('musteriler').update({ takip_zamanlamasi: result }).eq('id', selectedMusteri.id);
    } catch (err) {
      toast('Zaman analizi yapılamadı: ' + String(err), 'error');
    }
    setAiCallTimeLoading(false);
  };

  // AI: Görüşme Koçu
  const generateCoaching = async () => {
    if (!selectedMusteri) return;
    setAiCoachLoading(true);
    try {
      const prompt = `Satış koçu olarak bu müşteri için görüşme hazırlık notu yaz.
Müşteri: ${selectedMusteri.ad} ${selectedMusteri.soyad}
Durum: ${selectedMusteri.durum}
Bütçe: ${selectedMusteri.butce_max || selectedMusteri.butce || 'Belirtilmemiş'}
Bölge: ${selectedMusteri.muhit || 'Belirtilmemiş'}
Notlar: ${selectedMusteri.notlar || 'Yok'}

Sadece JSON döndür:
{"acilis_cumlesi":"...","dikkat_edilecekler":["...","..."],"onerilen_yaklasim":"...","kapatis_stratejisi":"..."}`;
      const raw = await callClaude(prompt, 400, 'Sen DerliEstate Pro emlak asistanısın. Sadece JSON döndür.');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON parse hatası');
      const result: CallCoaching = JSON.parse(jsonMatch[0]);
      setAiCoach(result);
    } catch (err) {
      toast('Koçluk notu üretilemedi: ' + String(err), 'error');
    }
    setAiCoachLoading(false);
  };

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A18' }}>Müşteriler</h1>
          <p style={{ fontSize: 13, color: '#8B7355' }}>{stats.total} kayıt · {stats.sicak} sıcak · {stats.satin_alacak} satın alacak</p>
        </div>
        <button onClick={openAdd} className="btn-gold">
          <Plus size={16} /> Müşteri Ekle
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Toplam', value: stats.total, icon: Users, color: '#534AB7' },
          { label: 'Sıcak', value: stats.sicak, icon: Flame, color: '#FF3B2F' },
          { label: 'Satın Alacak', value: stats.satin_alacak, icon: ShoppingCart, color: '#22A05A' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '2px solid #F6D9A8', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8B7355' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8B7355' }} />
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <select
          value={filterDurum}
          onChange={e => setFilterDurum(e.target.value as MusteriDurum | 'tumu')}
          className="input w-40"
        >
          <option value="tumu">Tüm Durumlar</option>
          {DURUM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={() => setFilterTakas(v => !v)}
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${filterTakas ? '#534AB7' : '#E8D9B8'}`, background: filterTakas ? '#534AB7' : '#fff', color: filterTakas ? '#fff' : '#8B7355', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        >
          Takas
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '2px solid #F6D9A8', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} className="mobile-card-table">
          <thead className="table-header-row">
            <tr>
              {['Ad Soyad', 'Telefon', 'Tercih Bölge', 'Bütçe', 'Lead', 'Durum', 'İşlemler'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}><Loader2 size={20} className="animate-spin" style={{ color: '#D4AF37', display: 'inline-block' }} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#8B7355', fontSize: 13 }}>Kayıt bulunamadı</td></tr>
            ) : filtered.map(m => {
              const score = calcLeadScore(m);
              const tags = calcTags(m);
              const tier = calcTier(m);
              const cur = (m.para_birimi as Currency) || 'TL';
              const budgetDisplay = (m.butce_min || m.butce_max)
                ? [m.butce_min, m.butce_max].filter(Boolean).map(v => formatBudgetShort(v!, cur)).join(' – ')
                : m.butce ? formatBudgetShort(m.butce, cur) : null;
              return (
                <tr key={m.id} className="table-row-hover" style={{ borderBottom: '1px solid #F6D9A8' }}>
                  <td style={{ padding: '10px 14px' }} data-label="Ad Soyad">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {tier.label !== 'Normal' && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: tier.bg, color: tier.color, padding: '1px 6px', borderRadius: 99 }}>{tier.label}</span>
                        )}
                        {m.takas_acik && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: '#534AB7', color: '#fff', padding: '1px 6px', borderRadius: 99 }}>Takas</span>
                        )}
                        {m.kaynak === 'facebook_lead' && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: '#1877F2', color: '#fff', padding: '1px 6px', borderRadius: 99 }}>FB</span>
                        )}
                        {m.kaynak === 'instagram_lead' && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: 'linear-gradient(135deg,#E1306C,#833AB4)', color: '#fff', padding: '1px 6px', borderRadius: 99 }}>IG</span>
                        )}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#1A1A18' }}>{m.ad} {m.soyad}</span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {tags.slice(0, 2).map(t => (
                          <span key={t.key} style={{ fontSize: 9, background: t.bg, color: t.color, padding: '1px 5px', borderRadius: 99, fontWeight: 600 }}>{t.label}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#1A1A18' }} data-label="Telefon">
                    {m.telefon || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#1A1A18' }} data-label="Tercih Bölge">
                    {m.muhit || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#5D4037' }} data-label="Bütçe">
                    {budgetDisplay || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', minWidth: 70 }} data-label="Lead">
                    <LeadScoreBar score={score} />
                  </td>
                  <td style={{ padding: '10px 14px' }} data-label="Durum">
                    <MusteriStatusBadge durum={m.durum} />
                  </td>
                  <td style={{ padding: '10px 14px' }} data-label="İşlemler">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setSelectedMusteri(m)}
                        style={{ background: '#F5F0E8', border: '1px solid #D4C9B8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
                        title="Detay"
                      >
                        <Eye size={14} />
                      </button>
                      {canEdit(m) && (
                        <button
                          onClick={() => openEdit(m)}
                          style={{ background: '#F5F0E8', border: '1px solid #D4C9B8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}
                          title="Düzenle"
                        >
                          Düzenle
                        </button>
                      )}
                      <MusteriWhatsApp musteri={m} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold text-lg" style={{ color: '#1A1A18' }}>{editItem ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body p-4 grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div>
                  <label className="label">Ad *</label>
                  <input className="input" required value={form.ad} onChange={e => setF({ ad: e.target.value })} />
                </div>
                <div>
                  <label className="label">Soyad *</label>
                  <input className="input" required value={form.soyad} onChange={e => setF({ soyad: e.target.value })} />
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input className="input" value={form.telefon} onChange={e => setF({ telefon: e.target.value })} />
                </div>
                <div>
                  <label className="label">E-posta</label>
                  <input className="input" type="email" value={form.email} onChange={e => setF({ email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Tercih Bölge</label>
                  <select className="input" value={form.muhit} onChange={e => setF({ muhit: e.target.value })}>
                    <option value="">Seçin...</option>
                    {CESME_BOLGELERI.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Portföy Tercihi</label>
                  <input className="input" value={form.portfoy_tercihi} onChange={e => setF({ portfoy_tercihi: e.target.value })} />
                </div>
                <div>
                  <label className="label">Bütçe Min</label>
                  <PriceInput
                    value={form.butce_min}
                    currency={(form.para_birimi as Currency) || 'TL'}
                    onValueChange={v => setF({ butce_min: v })}
                    onCurrencyChange={c => setF({ para_birimi: c })}
                  />
                </div>
                <div>
                  <label className="label">Bütçe Max</label>
                  <PriceInput
                    value={form.butce_max}
                    currency={(form.para_birimi as Currency) || 'TL'}
                    onValueChange={v => setF({ butce_max: v })}
                    onCurrencyChange={c => setF({ para_birimi: c })}
                  />
                </div>
                <div>
                  <label className="label">Durum</label>
                  <select className="input" value={form.durum} onChange={e => setF({ durum: e.target.value as MusteriDurum })}>
                    {DURUM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Kaynak</label>
                  <input className="input" value={form.kaynak} onChange={e => setF({ kaynak: e.target.value })} />
                </div>
                <div>
                  <label className="label">Danışman</label>
                  <input className="input" value={form.danisman} onChange={e => setF({ danisman: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 20, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.denize_yakin || false} onChange={e => setF({ denize_yakin: e.target.checked })} />
                    Denize Yakın
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.deniz_manzarasi || false} onChange={e => setF({ deniz_manzarasi: e.target.checked })} />
                    Deniz Manzarası
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.takas_acik || false} onChange={e => setF({ takas_acik: e.target.checked })} style={{ accentColor: '#534AB7' }} />
                    <span style={{ color: '#534AB7', fontWeight: 600 }}>Takasa Acik</span>
                  </label>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Açıklama</label>
                  <textarea className="input" rows={2} value={form.aciklama} onChange={e => setF({ aciklama: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Notlar</label>
                  <textarea className="input" rows={2} value={form.notlar} onChange={e => setF({ notlar: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn-gold flex-1" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Kaydet'}
                </button>
                {editItem && (
                  <button
                    type="button"
                    onClick={() => { remove(editItem.id); setShowForm(false); }}
                    style={{ background: '#FFF0EE', color: '#FF3B2F', border: '1px solid #FF3B2F', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
                  >
                    Sil
                  </button>
                )}
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedMusteri && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedMusteri(null)}>
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <div>
                <h2 className="font-bold text-lg" style={{ color: '#1A1A18' }}>
                  {selectedMusteri.ad} {selectedMusteri.soyad}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <MusteriStatusBadge durum={selectedMusteri.durum} />
                  <span style={{ fontSize: 11, color: '#8B7355' }}>Lead Skoru:</span>
                  <LeadScoreBar score={calcLeadScore(selectedMusteri)} />
                </div>
              </div>
              <button onClick={() => setSelectedMusteri(null)}><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #F6D9A8', background: '#FAF6EF' }}>
              {[
                { id: 'info', label: 'Bilgiler' },
                { id: 'gezi', label: 'Gezi Takibi' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id as 'info' | 'gezi')}
                  style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: detailTab === tab.id ? '#1A1A18' : '#8B7355', borderBottom: detailTab === tab.id ? '2px solid #D4AF37' : '2px solid transparent', transition: 'all 0.15s' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="modal-body p-4">

              {detailTab === 'info' && (<>
              {/* AI Summary — shown at top if exists */}
              {aiSummary && (
                <div style={{ marginBottom: 14, padding: '10px 14px', background: 'linear-gradient(135deg, #FAF6EF, #F5EDD8)', borderRadius: 8, border: '1px solid #E8D9B8', fontStyle: 'italic', fontSize: 13, color: '#5A4A3A', lineHeight: 1.6 }}>
                  <span style={{ fontStyle: 'normal', fontWeight: 700, color: '#D4AF37', marginRight: 6 }}>YZ:</span>
                  {aiSummary}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Telefon', value: selectedMusteri.telefon },
                  { label: 'E-posta', value: selectedMusteri.email },
                  { label: 'Tercih Bölge', value: selectedMusteri.muhit },
                  { label: 'Portföy Tercihi', value: selectedMusteri.portfoy_tercihi },
                  { label: 'Bütçe Min', value: selectedMusteri.butce_min ? displayPrice(selectedMusteri.butce_min, (selectedMusteri.para_birimi as Currency) || 'TL') : null },
                  { label: 'Bütçe Max', value: selectedMusteri.butce_max ? displayPrice(selectedMusteri.butce_max, (selectedMusteri.para_birimi as Currency) || 'TL') : null },
                  { label: 'Danışman', value: selectedMusteri.danisman },
                  { label: 'Kaynak', value: selectedMusteri.kaynak },
                ].map(f => f.value && (
                  <div key={f.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#1A1A18' }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {selectedMusteri.aciklama && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Açıklama</div>
                  <p style={{ fontSize: 13, color: '#1A1A18', lineHeight: 1.6 }}>{selectedMusteri.aciklama}</p>
                </div>
              )}
              {selectedMusteri.notlar && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Notlar</div>
                  <p style={{ fontSize: 13, color: '#1A1A18', lineHeight: 1.6 }}>{selectedMusteri.notlar}</p>
                </div>
              )}

              {/* AI Tools Row */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, padding: '12px 14px', background: '#FAF6EF', borderRadius: 10, border: '1px solid #F0E8D8' }}>
                <button onClick={generateSummary} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} disabled={aiSummaryLoading}>
                  {aiSummaryLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                  YZ Ozet
                </button>
                <button onClick={analyzeCallTime} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} disabled={aiCallTimeLoading}>
                  {aiCallTimeLoading ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                  En Iyi Arama Saati
                </button>
                <button onClick={generateCoaching} className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} disabled={aiCoachLoading}>
                  {aiCoachLoading ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
                  Gorusme Kocu
                </button>
              </div>

              {/* Call Timing Result */}
              {aiCallTime && (
                <div style={{ marginBottom: 14, padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={12} /> En Iyi Arama Saati
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Gun', value: aiCallTime.en_iyi_gun },
                      { label: 'Saat', value: aiCallTime.en_iyi_saat },
                      { label: 'Yontem', value: aiCallTime.iletisim_yontemi },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {aiCallTime.sebep && <p style={{ fontSize: 12, color: '#374151', marginTop: 6, fontStyle: 'italic' }}>{aiCallTime.sebep}</p>}
                </div>
              )}

              {/* Coaching Result */}
              {aiCoach && (
                <div style={{ marginBottom: 14, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <MessageSquare size={12} /> Gorusme Kocu
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>Acilis Cumlesi</div>
                    <div style={{ fontSize: 12, color: '#1A1A18', fontStyle: 'italic', background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #D1FAE5' }}>"{aiCoach.acilis_cumlesi}"</div>
                  </div>
                  {aiCoach.dikkat_edilecekler?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>Dikkat Edilecekler</div>
                      {aiCoach.dikkat_edilecekler.map((d, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 3 }}>
                          <span style={{ color: '#15803D', flexShrink: 0, marginTop: 1 }}>•</span> {d}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>Onerilen Yaklasim</div>
                    <div style={{ fontSize: 12, color: '#374151' }}>{aiCoach.onerilen_yaklasim}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>Kapatis Stratejisi</div>
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{aiCoach.kapatis_stratejisi}</div>
                  </div>
                </div>
              )}

              <EslestirmePanel musteriId={selectedMusteri.id} />
              </>)}

              {detailTab === 'gezi' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>Gösterilen Portföyler</span>
                    <button onClick={() => setShowGeziAdd(v => !v)} className="btn-gold" style={{ fontSize: 12, padding: '6px 12px' }}>
                      <Plus size={13} /> Portföy Ekle
                    </button>
                  </div>

                  {showGeziAdd && (
                    <div style={{ marginBottom: 16, padding: 14, background: '#FAF6EF', borderRadius: 10, border: '1px solid #F0E8D8' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <label className="label">Portföy Seç *</label>
                          <select className="input" value={geziForm.portfoy_id} onChange={e => setGeziForm(f => ({ ...f, portfoy_id: e.target.value }))}>
                            <option value="">Portföy seçin...</option>
                            {portfoyList.map(p => <option key={p.id} value={p.id}>{p.isim} {p.bolge ? `(${p.bolge})` : ''}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Müşteri Düşüncesi</label>
                          <textarea className="input" rows={2} value={geziForm.musteri_dusuncesi} onChange={e => setGeziForm(f => ({ ...f, musteri_dusuncesi: e.target.value }))} placeholder="Müşterinin bu portföy hakkındaki görüşü..." />
                        </div>
                        <div>
                          <label className="label">Sonuç</label>
                          <select className="input" value={geziForm.sonuc} onChange={e => setGeziForm(f => ({ ...f, sonuc: e.target.value }))}>
                            <option value="bekliyor">Bekliyor</option>
                            <option value="begendi">Beğendi</option>
                            <option value="begenmedı">Beğenmedi</option>
                            <option value="dusunuyor">Düşünüyor</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={saveGezi} className="btn-gold" disabled={geziSaving || !geziForm.portfoy_id} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                            {geziSaving ? <Loader2 size={13} className="animate-spin" /> : 'Kaydet'}
                          </button>
                          <button onClick={() => setShowGeziAdd(false)} className="btn-ghost" style={{ fontSize: 12 }}>İptal</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {geziLoading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}><Loader2 size={20} className="animate-spin" color="#D4AF37" style={{ display: 'inline-block' }} /></div>
                  ) : geziler.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#8B7355', fontSize: 13 }}>
                      <MapPin size={28} color="#D4C9B8" style={{ margin: '0 auto 8px' }} />
                      <p>Henüz portföy gösterilmedi</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {geziler.map(g => (
                        <div key={g.id} style={{ border: '1px solid #F0E8D8', borderRadius: 10, padding: 12, background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>{g.portfoy_ad}</div>
                              <div style={{ fontSize: 11, color: '#8B7355' }}>{new Date(g.gezi_tarihi).toLocaleDateString('tr-TR')} · {g.danisman}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(['begendi', 'begenmedı', 'dusunuyor', 'bekliyor'] as const).map(s => {
                                const labels: Record<string, string> = { begendi: '✓', begenmedı: '✗', dusunuyor: '?', bekliyor: '...' };
                                const colors: Record<string, string> = { begendi: '#059669', begenmedı: '#DC2626', dusunuyor: '#D97706', bekliyor: '#9CA3AF' };
                                return (
                                  <button
                                    key={s}
                                    onClick={() => updateGeziSonuc(g.id, s)}
                                    style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${g.sonuc === s ? colors[s] : '#F0E8D8'}`, background: g.sonuc === s ? colors[s] + '20' : 'transparent', color: colors[s], cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                                    title={s}
                                  >
                                    {labels[s]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {g.musteri_dusuncesi && (
                            <p style={{ fontSize: 12, color: '#5A4A3A', fontStyle: 'italic', margin: 0 }}>{g.musteri_dusuncesi}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
