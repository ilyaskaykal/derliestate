import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Loader2, Sparkles, Search, Phone, CheckCircle, Clock, AlertCircle, XCircle, Bell, ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TapuSorgulama } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { callClaude } from '../lib/claude';

const DURUM_OPTIONS = [
  { value: 'Aranmadı', label: 'Aranmadı', icon: Clock, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
  { value: 'Düşünüyor', label: 'Düşünüyor', icon: AlertCircle, color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)' },
  { value: 'Olumlu', label: 'Olumlu', icon: CheckCircle, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' },
  { value: 'Olumsuz', label: 'Olumsuz', icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
];

type FormState = Omit<TapuSorgulama, 'id' | 'created_at'>;

interface DuplicateInfo {
  id: string;
  ada: string | null;
  parsel: string | null;
  danisman: string | null;
  eklendi_user_id: string | null;
  created_at: string;
}

function emptyForm(danisman: string, userId = ''): FormState {
  return {
    ada: '', parsel: '',
    il: '', ilce: '', mahalle: '', tapu_alani: '', sahibinden_url: '',
    isim1: '', isim2: '', isim3: '', isim4: '',
    telefon1: '', telefon2: '', telefon3: '', telefon4: '',
    istenen_tarih: new Date().toISOString().split('T')[0],
    bilgi_geldi: false,
    arandi: false,
    aranma_tarihi: null,
    durum: 'Aranmadı',
    notlar: '',
    danisman,
    eklendi_user_id: userId,
  };
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function DurumBadge({ durum }: { durum: string }) {
  const opt = DURUM_OPTIONS.find(o => o.value === durum) || DURUM_OPTIONS[0];
  const Icon = opt.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ color: opt.color, background: opt.bg, border: `1px solid ${opt.border}` }}
    >
      <Icon size={11} />
      {opt.label}
    </span>
  );
}

export default function IceriVerilenlerPage() {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();

  const canSeeAll =
    effectiveUser?.rol === 'admin' ||
    effectiveUser?.rol === 'yonetici' ||
    effectiveUser?.username === 'superadmin';

  const [records, setRecords] = useState<TapuSorgulama[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TapuSorgulama | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(danismanAdi, effectiveUser?.username || ''));
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<TapuSorgulama | null>(null);
  const [search, setSearch] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiScripts, setAiScripts] = useState<Record<string, string>>({});

  // Admin advisor filter
  const [advisorFilter, setAdvisorFilter] = useState<string>('all');
  const advisorList = Array.from(
    new Map(records.map(r => [r.eklendi_user_id, r.danisman])).entries()
  ).filter(([id]) => id);

  // Duplicate warning modal
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [pendingPayload, setPendingPayload] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('tapu_sorgulama').select('*').order('created_at', { ascending: false });
    if (!canSeeAll && effectiveUser?.username) {
      query = query.eq('eklendi_user_id', effectiveUser.username);
    }
    const { data } = await query;
    setRecords(data || []);
    setLoading(false);
  }, [canSeeAll, effectiveUser?.username]);

  useEffect(() => { load(); }, [load]);

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const openAdd = () => {
    setForm(emptyForm(danismanAdi, effectiveUser?.username || ''));
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (r: TapuSorgulama) => {
    setForm({ ...r });
    setEditItem(r);
    setShowForm(true);
  };

  const checkDuplicate = async (ada: string, parsel: string): Promise<DuplicateInfo | null> => {
    const { data } = await supabase
      .from('tapu_sorgulama')
      .select('id, ada, parsel, danisman, eklendi_user_id, created_at')
      .eq('ada', ada.trim())
      .eq('parsel', parsel.trim())
      .maybeSingle();
    return data as DuplicateInfo | null;
  };

  const doSave = async (payload: FormState) => {
    setSaving(true);
    const { error } = await supabase.from('tapu_sorgulama').insert(payload);
    if (error) toast('Hata oluştu.', 'error'); else toast('Kayıt eklendi.');
    setSaving(false);
    setShowForm(false);
    setPendingPayload(null);
    setDuplicateInfo(null);
    load();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };

    if (editItem) {
      setSaving(true);
      const { error } = await supabase.from('tapu_sorgulama').update(payload).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else { toast('Kayıt güncellendi.'); setSelected(null); }
      setSaving(false);
      setShowForm(false);
      load();
      return;
    }

    // New record — check for duplicate ada+parsel
    if (payload.ada?.trim() && payload.parsel?.trim()) {
      const dup = await checkDuplicate(payload.ada, payload.parsel);
      if (dup) {
        setPendingPayload(payload);
        setDuplicateInfo(dup);
        return;
      }
    }

    doSave(payload);
  };

  const remove = async (id: string) => {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
    await supabase.from('tapu_sorgulama').delete().eq('id', id);
    toast('Kayıt silindi.');
    load();
    if (selected?.id === id) setSelected(null);
  };

  const quickUpdate = async (id: string, patch: Partial<TapuSorgulama>) => {
    await supabase.from('tapu_sorgulama').update(patch).eq('id', id);
    toast('Güncellendi.');
    load();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null);
  };

  const runAI = async (r: TapuSorgulama) => {
    setAiLoading(true);
    setAiResult('');
    const owners = [r.isim1, r.isim2, r.isim3, r.isim4].filter(Boolean).join(', ');
    const phones = [r.telefon1, r.telefon2, r.telefon3, r.telefon4].filter(Boolean).join(', ');
    const prompt = `Tapu sorgulama kaydını analiz et:

Ada/Parsel: ${r.ada || '-'}/${r.parsel || '-'}
Malikler: ${owners || 'Bilinmiyor'}
Telefonlar: ${phones || 'Yok'}
Bilgi Geldi mi: ${r.bilgi_geldi ? 'Evet' : 'Hayır'}
Arandı mı: ${r.arandi ? 'Evet' : 'Hayır'}
Son Arama: ${r.aranma_tarihi ? `${daysSince(r.aranma_tarihi)} gün önce` : 'Hiç aranmadı'}
Durum: ${r.durum}
Notlar: ${r.notlar || '-'}

1. Durumu değerlendir
2. En iyi takip zamanı ve yöntemi öner
3. Notlara göre sahip yaklaşım önerileri
4. Mevcut müşteri talepleriyle eşleşme potansiyeli
5. Kısa bir telefon açılış scripti yaz`;

    try {
      setAiResult(await callClaude(prompt));
    } catch (err) {
      setAiResult(`AI analizi hatası: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAiLoading(false);
  };

  const generateCallScript = async (r: TapuSorgulama) => {
    if (aiScripts[r.id]) return;
    const isim = r.isim1 || 'Sayın Malik';
    const ada = r.ada && r.parsel ? `${r.ada}/${r.parsel} parseli` : 'parseli';
    const prompt = `Kısa, nazik bir emlak danışmanı telefon açılış cümlesi yaz (max 2 cümle).
Malik adı: ${isim}, Ada/Parsel: ${ada}.
Türkçe, resmi ama sıcak. Sadece metni yaz, açıklama ekleme.`;
    try {
      const script = await callClaude(prompt);
      setAiScripts(prev => ({ ...prev, [r.id]: script.trim() }));
    } catch { /* silent */ }
  };

  const callAlerts = records.filter(r => r.durum !== 'Olumlu' && daysSince(r.aranma_tarihi) >= 2 && r.bilgi_geldi);
  const infoAlerts = records.filter(r => !r.bilgi_geldi && daysSince(r.istenen_tarih) >= 3);
  const alertIds = new Set([...callAlerts, ...infoAlerts].map(r => r.id));

  const filtered = records
    .filter(r => {
      if (canSeeAll && advisorFilter !== 'all' && r.eklendi_user_id !== advisorFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.ada || '').includes(q) ||
        (r.parsel || '').includes(q) ||
        (r.isim1 || '').toLowerCase().includes(q) ||
        (r.isim2 || '').toLowerCase().includes(q) ||
        (r.telefon1 || '').includes(q) ||
        (r.danisman || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aAlert = alertIds.has(a.id) ? 0 : 1;
      const bAlert = alertIds.has(b.id) ? 0 : 1;
      return aAlert - bAlert;
    });

  const stats = {
    total: filtered.length,
    olumlu: filtered.filter(r => r.durum === 'Olumlu').length,
    bilgiGeldi: filtered.filter(r => r.bilgi_geldi).length,
    aranmadi: filtered.filter(r => !r.arandi).length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 shrink-0" style={{ background: 'linear-gradient(135deg, #1A1A18, #2D1A10)', borderBottom: '1px solid #2C2C2A' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'white', fontFamily: '"Times New Roman", Times, serif' }}>İçeri Verilenler</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Tapu sorgulama ve takip kayıtları</p>
          </div>
          <button onClick={openAdd} className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all hover:opacity-90" style={{ background: '#C0392B', color: 'white', borderRadius: 8 }}>
            <Plus size={16} />
            Kayıt Ekle
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              className="pl-9 pr-3 py-2 text-sm w-full rounded-lg focus:outline-none"
              placeholder="Ada, parsel, isim, telefon ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
            />
          </div>

          {canSeeAll && (
            <div className="relative">
              <select
                value={advisorFilter}
                onChange={e => setAdvisorFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', minWidth: '170px', borderRadius: 8, padding: '8px 28px 8px 12px', fontSize: 14 }}
                className="focus:outline-none appearance-none"
              >
                <option value="all" style={{ background: '#1A1A18' }}>Tüm Danışmanlar</option>
                {advisorList.map(([id, name]) => (
                  <option key={id as string} value={id as string} style={{ background: '#1A1A18' }}>{name || id as string}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0" style={{ background: 'white', borderBottom: '1px solid #F6D9A8' }}>
        {[
          { label: 'Toplam', value: stats.total, color: '#534AB7', bg: 'rgba(83,74,183,0.08)' },
          { label: 'Olumlu', value: stats.olumlu, color: '#22A05A', bg: 'rgba(34,160,90,0.08)' },
          { label: 'Bilgi Geldi', value: stats.bilgiGeldi, color: '#E8A020', bg: 'rgba(232,160,32,0.08)' },
          { label: 'Aranmadı', value: stats.aranmadi, color: '#C0392B', bg: 'rgba(192,57,43,0.08)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
            <div>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium" style={{ color: '#8B7355' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Smart alerts banner */}
      {(callAlerts.length > 0 || infoAlerts.length > 0) && (
        <div className="px-6 py-2.5 flex gap-3 flex-wrap shrink-0" style={{ background: '#FFF3E0', borderBottom: '1px solid #F0D080' }}>
          {callAlerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.3)' }}>
              <Phone size={13} />
              {callAlerts.length} kişi 2+ gündür aranmadı
            </div>
          )}
          {infoAlerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(232,160,32,0.12)', color: '#C07020', border: '1px solid rgba(232,160,32,0.3)' }}>
              <Bell size={13} />
              {infoAlerts.length} ada/parsel 3+ gündür bilgi bekleniyor
            </div>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: '#8B7355' }}>
            <Search size={32} style={{ opacity: 0.4 }} />
            <p className="text-sm">{search ? 'Arama sonucu bulunamadı.' : 'Henüz kayıt eklenmemiş.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const isCallAlert = callAlerts.some(a => a.id === r.id);
              const owners = [r.isim1, r.isim2, r.isim3, r.isim4].filter(Boolean);
              const callDaysSince = daysSince(r.aranma_tarihi);
              const borderLeftColor = isCallAlert ? '#E8A020' : '#C0392B';
              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
                  style={{
                    background: 'white',
                    border: '1px solid #F6D9A8',
                    borderLeft: `4px solid ${borderLeftColor}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  onClick={() => { setSelected(r); setAiResult(''); }}
                >
                  <div className="flex items-start gap-4">
                    {/* Ada/Parsel badge */}
                    <div className="shrink-0 rounded-lg px-3 py-2 text-center min-w-[64px]" style={{ background: '#1A1A18' }}>
                      <p className="text-xs font-bold" style={{ color: '#D4AF37' }}>{r.ada || '—'}</p>
                      <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(212,175,55,0.6)' }}>{r.parsel || '—'}</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <DurumBadge durum={r.durum} />
                        {r.bilgi_geldi ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#22A05A', color: 'white' }}>Bilgi Geldi</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#E8A020', color: 'white' }}>Bilgi Bekleniyor</span>
                        )}
                        {isCallAlert && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#E8A020', color: 'white' }}>
                            Ara! ({callDaysSince}g)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium" style={{ color: '#1A1A18' }}>{owners[0] || '—'}</span>
                        {owners.length > 1 && (
                          <span className="text-xs" style={{ color: '#8B7355' }}>+{owners.length - 1} kişi</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        {r.telefon1 && (
                          <span className="flex items-center gap-1 text-xs font-mono" style={{ color: '#2055C0' }}>
                            <Phone size={10} />{r.telefon1}
                          </span>
                        )}
                        {canSeeAll && (
                          <span className="text-xs font-medium" style={{ color: '#534AB7', fontWeight: 500 }}>
                            {r.danisman}
                          </span>
                        )}
                        {r.istenen_tarih && (
                          <span className="text-xs font-medium" style={{ color: '#534AB7' }}>
                            Gelen: {new Date(r.istenen_tarih).toLocaleDateString('tr-TR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => quickUpdate(r.id, { arandi: !r.arandi, aranma_tarihi: !r.arandi ? new Date().toISOString().split('T')[0] : r.aranma_tarihi })}
                        className="p-1.5 rounded-lg transition-colors"
                        style={r.arandi ? { color: 'white', background: '#22A05A' } : { color: '#8B7355', background: '#FDF3E3' }}
                        title={r.arandi ? 'Arandı' : 'Aranmadı'}
                      >
                        <Phone size={14} />
                      </button>
                      <button
                        onClick={() => openEdit(r)}
                        className="px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium"
                        style={{ color: '#534AB7', background: 'rgba(83,74,183,0.1)', border: '1px solid rgba(83,74,183,0.2)' }}
                      >
                        Düzenle
                      </button>
                    </div>
                  </div>

                  {r.notlar && (
                    <p className="mt-2 text-xs line-clamp-1" style={{ color: '#8B7355' }}>{r.notlar}</p>
                  )}
                  {r.sahibinden_url && (
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      <a
                        href={r.sahibinden_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                        style={{ background: '#FF6000', color: 'white' }}
                      >
                        <ExternalLink size={11} />
                        Sahibinden'de Gör
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between p-5 shrink-0" style={{ background: 'linear-gradient(135deg, #1A1A18, #2D1A10)', borderBottom: '1px solid #2C2C2A' }}>
              <h2 className="font-semibold text-lg" style={{ color: 'white' }}>{editItem ? 'Kayıt Düzenle' : 'Yeni Kayıt — İçeri Verilenler'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-5">

                {/* Ada/Parsel */}
                <section>
                  <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-gold-400/40" />Ada & Parsel
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="label">Ada No</label><input className="input" placeholder="ör. 4234" value={form.ada || ''} onChange={e => setF({ ada: e.target.value })} /></div>
                    <div><label className="label">Parsel No</label><input className="input" placeholder="ör. 5" value={form.parsel || ''} onChange={e => setF({ parsel: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div><label className="label">İl</label><input className="input" placeholder="İzmir" value={form.il || ''} onChange={e => setF({ il: e.target.value })} /></div>
                    <div><label className="label">İlçe</label><input className="input" placeholder="Çeşme" value={form.ilce || ''} onChange={e => setF({ ilce: e.target.value })} /></div>
                    <div><label className="label">Mahalle</label><input className="input" placeholder="Mahalle" value={form.mahalle || ''} onChange={e => setF({ mahalle: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Tapu Alanı m²</label><input className="input" type="number" placeholder="ör. 250" value={form.tapu_alani || ''} onChange={e => setF({ tapu_alani: e.target.value })} /></div>
                    <div><label className="label">Sahibinden URL</label><input className="input" placeholder="https://www.sahibinden.com/ilan/..." value={form.sahibinden_url || ''} onChange={e => setF({ sahibinden_url: e.target.value })} /></div>
                  </div>
                </section>

                {/* Malikler */}
                <section>
                  <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-gold-400/40" />Malikler (en fazla 4)
                  </h3>
                  <div className="space-y-2">
                    {([1, 2, 3, 4] as const).map(n => (
                      <div key={n} className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">İsim Soyisim {n}</label>
                          <input
                            className="input"
                            placeholder={`Malik ${n}`}
                            value={(form[`isim${n}` as keyof FormState] as string) || ''}
                            onChange={e => setF({ [`isim${n}`]: e.target.value } as Partial<FormState>)}
                          />
                        </div>
                        <div>
                          <label className="label">Telefon {n}</label>
                          <input
                            className="input"
                            placeholder="0555 555 55 55"
                            value={(form[`telefon${n}` as keyof FormState] as string) || ''}
                            onChange={e => setF({ [`telefon${n}`]: e.target.value } as Partial<FormState>)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Sorgulama durumu */}
                <section>
                  <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-gold-400/40" />Sorgulama Durumu
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="label">İstenen Tarih (Orhan Bey'e sorulma)</label>
                      <input type="date" className="input" value={form.istenen_tarih || ''} onChange={e => setF({ istenen_tarih: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Gelen Tarih</label>
                      <input type="date" className="input" value={form.aranma_tarihi || ''} onChange={e => setF({ aranma_tarihi: e.target.value || null })} />
                    </div>
                  </div>

                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={`w-10 h-5 rounded-full transition-all relative ${form.bilgi_geldi ? 'bg-green-500' : 'bg-dark-600'}`}
                        onClick={() => setF({ bilgi_geldi: !form.bilgi_geldi })}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.bilgi_geldi ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-sm text-dark-200">Bilgi Geldi mi?</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={`w-10 h-5 rounded-full transition-all relative ${form.arandi ? 'bg-blue-500' : 'bg-dark-600'}`}
                        onClick={() => setF({ arandi: !form.arandi })}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.arandi ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-sm text-dark-200">Arandı mı?</span>
                    </label>
                  </div>

                  <div>
                    <label className="label">Durum</label>
                    <div className="grid grid-cols-2 gap-2">
                      {DURUM_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setF({ durum: opt.value })}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                          style={
                            form.durum === opt.value
                              ? { background: opt.bg, color: opt.color, border: `1px solid ${opt.border}`, transform: 'scale(1.02)' }
                              : { background: '#FDF3E3', color: '#8B7355', border: '1px solid #F6D9A8' }
                          }
                        >
                          <opt.icon size={15} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Notlar */}
                <div>
                  <label className="label">Notlar</label>
                  <textarea className="input h-24 resize-none" placeholder="Görüşme notları..." value={form.notlar || ''} onChange={e => setF({ notlar: e.target.value })} />
                </div>

                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                  <span className="text-xs" style={{ color: '#8B7355' }}>Danışman: </span><span style={{ color: '#1A1A18' }}>{form.danisman || danismanAdi}</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : (editItem ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Warning Modal */}
      {duplicateInfo && pendingPayload && (
        <div className="modal-overlay" style={{ zIndex: 60 }}>
          <div className="modal-content max-w-md">
            <div className="p-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)' }}
              >
                <AlertCircle size={24} style={{ color: '#FBBF24' }} />
              </div>
              <h3 className="font-bold text-lg text-center mb-1" style={{ color: '#1A1A18' }}>Bu Ada/Parsel Kullanımda!</h3>
              <p className="text-center text-sm mb-5" style={{ color: '#8B7355' }}>
                Bu ada/parsel kombinasyonu zaten kayıtlı
              </p>

              <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8B7355' }}>Ada / Parsel</span>
                  <span className="font-bold" style={{ color: '#FBBF24' }}>{duplicateInfo.ada} / {duplicateInfo.parsel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8B7355' }}>Danışman</span>
                  <span className="font-medium" style={{ color: '#1A1A18' }}>{duplicateInfo.danisman || duplicateInfo.eklendi_user_id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8B7355' }}>Tarih</span>
                  <span style={{ color: '#1A1A18' }}>{new Date(duplicateInfo.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>

              <p className="text-sm text-center mb-6" style={{ color: '#8B7355' }}>
                <strong style={{ color: duplicateInfo.danisman ? '#fff' : undefined }}>{duplicateInfo.danisman || duplicateInfo.eklendi_user_id}</strong> tarafından zaten sorgulanmış. Yine de eklemek istiyor musunuz?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => { setDuplicateInfo(null); setPendingPayload(null); }}
                  className="btn-ghost flex-1 justify-center"
                >
                  İptal
                </button>
                <button
                  onClick={() => doSave(pendingPayload)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.35)' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={14} /> : null}
                  Yine de Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5" style={{ background: 'linear-gradient(135deg, #1A1A18, #2D1A10)', borderBottom: '1px solid #2C2C2A' }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
                  <p className="text-base font-bold" style={{ color: '#D4AF37' }}>{selected.ada || '—'}/{selected.parsel || '—'}</p>
                </div>
                <DurumBadge durum={selected.durum} />
              </div>
              <button onClick={() => setSelected(null)} style={{ color: 'rgba(255,255,255,0.5)' }}><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Admin: show who added */}
              {canSeeAll && selected.danisman && (
                <div className="rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                  <span className="text-xs" style={{ color: '#8B7355' }}>Danışman:</span>
                  <span className="text-sm font-medium" style={{ color: '#534AB7' }}>{selected.danisman}</span>
                </div>
              )}

              {/* Owners */}
              <div className="grid grid-cols-1 gap-2">
                {([1, 2, 3, 4] as const).map(n => {
                  const isim = selected[`isim${n}` as keyof TapuSorgulama] as string;
                  const tel = selected[`telefon${n}` as keyof TapuSorgulama] as string;
                  if (!isim && !tel) return null;
                  return (
                    <div key={n} className="flex items-center justify-between rounded-xl p-3" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                      <div>
                        <p className="font-medium text-sm" style={{ color: '#1A1A18' }}>{isim || '—'}</p>
                        {tel && <p className="text-xs font-mono mt-0.5" style={{ color: 'rgba(0,212,255,0.7)' }}>{tel}</p>}
                      </div>
                      {tel && (
                        <a
                          href={`tel:${tel}`}
                          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                        >
                          <Phone size={12} />
                          Ara
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Location info */}
              {(selected.il || selected.ilce || selected.mahalle || selected.tapu_alani) && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selected.il && <div className="rounded-xl p-2.5" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}><p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>İl</p><p className="text-sm font-medium" style={{ color: '#1A1A18' }}>{selected.il}</p></div>}
                  {selected.ilce && <div className="rounded-xl p-2.5" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}><p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>İlçe</p><p className="text-sm font-medium" style={{ color: '#1A1A18' }}>{selected.ilce}</p></div>}
                  {selected.mahalle && <div className="rounded-xl p-2.5" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}><p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>Mahalle</p><p className="text-sm font-medium" style={{ color: '#1A1A18' }}>{selected.mahalle}</p></div>}
                  {selected.tapu_alani && <div className="rounded-xl p-2.5" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}><p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>Tapu Alanı</p><p className="text-sm font-medium" style={{ color: '#1A1A18' }}>{selected.tapu_alani} m²</p></div>}
                </div>
              )}

              {selected.sahibinden_url && (
                <a
                  href={selected.sahibinden_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: 'rgba(255,184,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,184,0,0.25)' }}
                >
                  <ExternalLink size={14} />
                  Sahibinden'de Gör
                </a>
              )}

              {/* Status row */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                {[
                  ['Bilgi Geldi', selected.bilgi_geldi ? 'Evet' : 'Hayır', selected.bilgi_geldi ? '#22c55e' : '#f87171'],
                  ['Arandı mı', selected.arandi ? 'Evet' : 'Hayır', selected.arandi ? '#22c55e' : '#94a3b8'],
                  ['Gelen Tarih', selected.aranma_tarihi ? new Date(selected.aranma_tarihi).toLocaleDateString('tr-TR') : '—', '#1A1A18'],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="rounded-xl p-2.5" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                    <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>{label as string}</p>
                    <p className="text-sm font-medium" style={{ color: color as string }}>{value as string}</p>
                  </div>
                ))}
              </div>

              {/* Dates */}
              {selected.istenen_tarih && (
                <div className="rounded-xl p-3" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>İstenen Tarih (Orhan Bey)</p>
                  <p style={{ color: '#1A1A18' }}>{new Date(selected.istenen_tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              )}

              {/* Notes */}
              {selected.notlar && (
                <div className="rounded-xl p-3" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                  <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Notlar</p>
                  <p className="text-sm text-dark-200 whitespace-pre-wrap">{selected.notlar}</p>
                </div>
              )}

              {/* Quick durum update */}
              <div>
                <label className="label mb-2">Durum Güncelle</label>
                <div className="grid grid-cols-2 gap-2">
                  {DURUM_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => quickUpdate(selected.id, { durum: opt.value })}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={
                        selected.durum === opt.value
                          ? { background: opt.bg, color: opt.color, border: `1px solid ${opt.border}`, transform: 'scale(1.02)' }
                          : { background: '#FDF3E3', color: '#8B7355', border: '0.5px solid #F6D9A8' }
                      }
                    >
                      <opt.icon size={14} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick toggles */}
              <div className="flex gap-4">
                <button
                  onClick={() => quickUpdate(selected.id, { bilgi_geldi: !selected.bilgi_geldi })}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={selected.bilgi_geldi
                    ? { background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }
                    : { background: '#FDF3E3', color: '#8B7355', border: '1px solid #F6D9A8' }}
                >
                  {selected.bilgi_geldi ? 'Bilgi Geldi' : 'Bilgi Bekleniyor'}
                </button>
                <button
                  onClick={() => quickUpdate(selected.id, { arandi: !selected.arandi, aranma_tarihi: !selected.arandi ? new Date().toISOString().split('T')[0] : selected.aranma_tarihi })}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={selected.arandi
                    ? { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }
                    : { background: '#FDF3E3', color: '#8B7355', border: '1px solid #F6D9A8' }}
                >
                  {selected.arandi ? 'Arandı' : 'Aranmadı'}
                </button>
              </div>

              {/* AI Script suggestion */}
              {!aiScripts[selected.id] && selected.isim1 && (
                <button
                  onClick={() => generateCallScript(selected)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'rgba(0,212,255,0.08)', color: 'rgba(0,212,255,0.8)', border: '1px solid rgba(0,212,255,0.2)' }}
                >
                  <Sparkles size={14} />
                  YZ Telefon Scripti Oluştur
                </button>
              )}
              {aiScripts[selected.id] && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)' }}>
                  <p className="text-xs mb-2" style={{ color: 'rgba(0,212,255,0.6)' }}>YZ Telefon Scripti</p>
                  <p className="text-sm text-dark-200 italic">{aiScripts[selected.id]}</p>
                </div>
              )}

              {/* Full AI analysis */}
              <div>
                <button
                  onClick={() => runAI(selected)}
                  disabled={aiLoading}
                  className="btn-gold w-full justify-center"
                >
                  {aiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {aiLoading ? 'Analiz yapılıyor...' : 'YZ Detay Analizi'}
                </button>
                {aiResult && (
                  <div className="mt-3 rounded-xl p-4 text-sm text-dark-200 whitespace-pre-wrap leading-relaxed" style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}>
                    {aiResult}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => { openEdit(selected); setSelected(null); }} className="btn-ghost flex-1 justify-center">Düzenle</button>
                <button onClick={() => remove(selected.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium px-4 py-2 rounded-lg transition-all text-sm flex items-center justify-center gap-2">Sil</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
