import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, X, Loader2, CheckSquare, Clock, AlertTriangle, ChevronDown,
  User, Building2, Calendar, Flag, CheckCircle2, Circle, Timer, GripVertical,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Gorev, GorevOncelik, GorevDurum, Musteri, Portfoy } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const ONCELIK_CONFIG: Record<GorevOncelik, { label: string; color: string; bg: string; border: string; dot: string }> = {
  acil:    { label: 'Acil',    color: '#FF3B2F', bg: 'rgba(255,59,47,0.12)',   border: 'rgba(255,59,47,0.3)',   dot: '#FF3B2F' },
  yuksek:  { label: 'Yüksek', color: '#E8A020', bg: 'rgba(232,160,32,0.12)',  border: 'rgba(232,160,32,0.3)',  dot: '#E8A020' },
  orta:    { label: 'Orta',   color: '#D4AF37', bg: 'rgba(212,175,55,0.1)',   border: 'rgba(212,175,55,0.25)', dot: '#D4AF37' },
  dusuk:   { label: 'Düşük',  color: '#22A05A', bg: 'rgba(34,160,90,0.1)',    border: 'rgba(34,160,90,0.25)',  dot: '#22A05A' },
};

const DURUM_CONFIG: Record<GorevDurum, { label: string; icon: React.ElementType; color: string }> = {
  bekliyor:    { label: 'Bekliyor',       icon: Circle,        color: '#94a3b8' },
  devam:       { label: 'Devam Ediyor',   icon: Timer,         color: '#534AB7' },
  tamamlandi:  { label: 'Tamamlandı',     icon: CheckCircle2,  color: '#22A05A' },
};

type FilterKey = 'bugun' | 'hafta' | 'tumu' | 'gecmis';

function isToday(d: string | null) {
  if (!d) return false;
  return new Date(d).toDateString() === new Date().toDateString();
}
function isThisWeek(d: string | null) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - now.getDay());
  const end   = new Date(start); end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}
function isOverdue(g: Gorev) {
  if (!g.son_tarih || g.durum === 'tamamlandi') return false;
  return new Date(g.son_tarih) < new Date();
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface GorevFormState {
  baslik: string;
  aciklama: string;
  son_tarih: string;
  saat: string;
  oncelik: GorevOncelik;
  durum: GorevDurum;
  musteri_id: string;
  portfoy_id: string;
  atanan_user: string;
}

function emptyForm(username: string): GorevFormState {
  return {
    baslik: '', aciklama: '', son_tarih: '', saat: '', oncelik: 'orta',
    durum: 'bekliyor', musteri_id: '', portfoy_id: '', atanan_user: username,
  };
}

export default function GorevlerPage() {
  const { toast } = useToast();
  const { effectiveUser, user } = useAuth();
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';

  const [gorevler, setGorevler]     = useState<Gorev[]>([]);
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [kullanicilar, setKullanicilar] = useState<{ username: string; ad: string; soyad: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState<Gorev | null>(null);
  const [form, setForm]             = useState<GorevFormState>(emptyForm(effectiveUser?.username || ''));
  const [saving, setSaving]         = useState(false);
  const [filter, setFilter]         = useState<FilterKey>('tumu');
  const [sortBy, setSortBy]         = useState<'oncelik' | 'tarih'>('tarih');
  const dragGorevItem = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, m, p, k] = await Promise.all([
      supabase.from('gorevler').select('*').order('son_tarih', { ascending: true }),
      supabase.from('musteriler').select('id, ad, soyad'),
      supabase.from('portfoyler').select('id, isim, bolge'),
      supabase.from('kullanicilar').select('username, ad, soyad'),
    ]);
    let rows = (g.data || []) as Gorev[];
    if (!isAdmin && effectiveUser?.username) {
      rows = rows.filter(r => r.atanan_user === effectiveUser.username || r.olusturan_user === effectiveUser.username);
    }
    setGorevler(rows);
    setMusteriler((m.data || []) as Musteri[]);
    setPortfoyler((p.data || []) as Portfoy[]);
    setKullanicilar((k.data || []) as { username: string; ad: string; soyad: string }[]);
    setLoading(false);
  }, [isAdmin, effectiveUser?.username]);

  useEffect(() => { load(); }, [load]);

  // Realtime: new task assigned to me
  useEffect(() => {
    if (!effectiveUser?.username) return;
    const ch = supabase.channel('gorevler-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gorevler' }, payload => {
        const g = payload.new as Gorev;
        if (g.atanan_user === effectiveUser.username && g.olusturan_user !== effectiveUser.username) {
          toast(`Yeni görev atandı: ${g.baslik}`, 'success');
          load();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [effectiveUser?.username, load, toast]);

  const filtered = gorevler.filter(g => {
    if (filter === 'bugun') return isToday(g.son_tarih);
    if (filter === 'hafta') return isThisWeek(g.son_tarih);
    if (filter === 'gecmis') return isOverdue(g);
    return true;
  }).sort((a, b) => {
    if (sortBy === 'oncelik') {
      const order: Record<GorevOncelik, number> = { acil: 0, yuksek: 1, orta: 2, dusuk: 3 };
      return order[a.oncelik] - order[b.oncelik];
    }
    const da = a.son_tarih ? new Date(a.son_tarih).getTime() : 9e15;
    const db = b.son_tarih ? new Date(b.son_tarih).getTime() : 9e15;
    return da - db;
  });

  const todayCount   = gorevler.filter(g => isToday(g.son_tarih) && g.durum !== 'tamamlandi').length;
  const overdueCount = gorevler.filter(isOverdue).length;

  const openAdd  = () => { setForm(emptyForm(effectiveUser?.username || '')); setEditItem(null); setShowForm(true); };
  const openEdit = (g: Gorev) => {
    setForm({
      baslik: g.baslik, aciklama: g.aciklama || '', son_tarih: g.son_tarih?.split('T')[0] || '',
      saat: g.saat || '', oncelik: g.oncelik, durum: g.durum,
      musteri_id: g.musteri_id || '', portfoy_id: g.portfoy_id || '', atanan_user: g.atanan_user || '',
    });
    setEditItem(g);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      baslik: form.baslik,
      aciklama: form.aciklama || null,
      son_tarih: form.son_tarih ? new Date(form.son_tarih + 'T' + (form.saat || '09:00')).toISOString() : null,
      saat: form.saat || null,
      oncelik: form.oncelik,
      durum: form.durum,
      musteri_id: form.musteri_id || null,
      portfoy_id: form.portfoy_id || null,
      atanan_user: form.atanan_user || null,
      olusturan_user: editItem?.olusturan_user ?? effectiveUser?.username ?? null,
    };
    if (editItem) {
      const { error } = await supabase.from('gorevler').update(payload).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else toast('Görev güncellendi.');
    } else {
      const { error } = await supabase.from('gorevler').insert(payload);
      if (error) toast('Hata oluştu.', 'error'); else toast('Görev eklendi.');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const quickDurum = async (id: string, durum: GorevDurum) => {
    await supabase.from('gorevler').update({ durum }).eq('id', id);
    setGorevler(prev => prev.map(g => g.id === id ? { ...g, durum } : g));
    toast('Durum güncellendi.');
  };

  const remove = async (id: string) => {
    if (!confirm('Bu görevi silmek istiyor musunuz?')) return;
    await supabase.from('gorevler').delete().eq('id', id);
    toast('Görev silindi.');
    load();
  };

  const handleGorevDragStart = (id: string) => { dragGorevItem.current = id; };
  const handleGorevDrop = async (targetId: string) => {
    if (!dragGorevItem.current || dragGorevItem.current === targetId) return;
    const fromIdx = filtered.findIndex(g => g.id === dragGorevItem.current);
    const toIdx = filtered.findIndex(g => g.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...filtered];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setGorevler(prev => {
      const ids = new Set(reordered.map(g => g.id));
      const others = prev.filter(g => !ids.has(g.id));
      return [...others, ...reordered.map((g, i) => ({ ...g, sira: i }))];
    });
    await Promise.all(reordered.map((g, i) => supabase.from('gorevler').update({ sira: i }).eq('id', g.id)));
    dragGorevItem.current = null;
  };

  const musteri = (id: string | null) => musteriler.find(m => m.id === id);
  const portfoy = (id: string | null) => portfoyler.find(p => p.id === id);
  const kullanici = (u: string | null) => kullanicilar.find(k => k.username === u);
  const kullaniciAd = (u: string | null) => {
    const k = kullanici(u);
    return k ? `${k.ad} ${k.soyad}` : (u || '—');
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#FDF3E3' }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'white', borderBottom: '0.5px solid #F6D9A8' }}
      >
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>
            <CheckSquare size={18} style={{ color: '#D4AF37' }} />
            Görevler
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            {todayCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                Bugün {todayCount} görev
              </span>
            )}
            {overdueCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(255,59,47,0.15)', color: '#FF3B2F' }}>
                <AlertTriangle size={11} />
                {overdueCount} gecikmiş
              </span>
            )}
          </div>
        </div>
        <button onClick={openAdd} className="btn-gold">
          <Plus size={16} /> Görev Ekle
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="px-6 py-2.5 shrink-0 flex items-center gap-2 flex-wrap"
        style={{ background: 'white', borderBottom: '0.5px solid #F6D9A8' }}
      >
        {([
          { key: 'tumu',   label: 'Tümü' },
          { key: 'bugun',  label: 'Bugün' },
          { key: 'hafta',  label: 'Bu Hafta' },
          { key: 'gecmis', label: 'Gecikmiş' },
        ] as { key: FilterKey; label: string }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filter === f.key
              ? { background: '#1A1A18', color: '#D4AF37', border: '1px solid #D4AF37' }
              : { background: 'white', color: '#8B7355', border: '0.5px solid #F6D9A8' }
            }
          >
            {f.key === 'gecmis' && overdueCount > 0 ? `${f.label} (${overdueCount})` : f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs" style={{ color: '#8B7355' }}>Sırala:</span>
          {(['tarih', 'oncelik'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-all"
              style={sortBy === s
                ? { background: '#1A1A18', color: '#D4AF37', border: '1px solid #D4AF37' }
                : { color: '#8B7355', border: '0.5px solid #F6D9A8' }
              }
            >
              {s === 'tarih' ? 'Tarih' : 'Öncelik'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: '#8B7355' }}>
            <CheckSquare size={32} />
            {filter === 'gecmis' ? 'Gecikmiş görev yok.' : 'Bu filtrede görev bulunamadı.'}
          </div>
        ) : filtered.map(g => {
          const onc    = ONCELIK_CONFIG[g.oncelik];
          const durCfg = DURUM_CONFIG[g.durum];
          const DurIcon = durCfg.icon;
          const overdue = isOverdue(g);
          const today = isToday(g.son_tarih);
          const m = musteri(g.musteri_id);
          const p = portfoy(g.portfoy_id);

          return (
            <div
              key={g.id}
              draggable
              onDragStart={() => handleGorevDragStart(g.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleGorevDrop(g.id)}
              className="rounded-xl p-4 transition-all"
              style={{ cursor: 'grab',
                background: g.durum === 'tamamlandi'
                  ? '#F5F0E8'
                  : 'white',
                border: overdue
                  ? '1px solid rgba(255,59,47,0.4)'
                  : today
                  ? '1px solid #D4AF37'
                  : '0.5px solid #F6D9A8',
                opacity: g.durum === 'tamamlandi' ? 0.6 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <GripVertical size={14} className="shrink-0 mt-1" style={{ color: '#D4C9B8' }} />
                {/* Quick complete toggle */}
                <button
                  onClick={() => quickDurum(g.id, g.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi')}
                  className="mt-0.5 shrink-0 transition-all"
                  title={g.durum === 'tamamlandi' ? 'Yeniden aç' : 'Tamamlandı işaretle'}
                >
                  <DurIcon size={20} style={{ color: durCfg.color }} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: onc.bg, color: onc.color, border: `1px solid ${onc.border}` }}
                    >
                      {onc.label}
                    </span>
                    {overdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(255,59,47,0.12)', color: '#FF3B2F', border: '1px solid rgba(255,59,47,0.3)' }}>
                        <AlertTriangle size={9} /> Gecikti!
                      </span>
                    )}
                    {today && !overdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
                        Bugün
                      </span>
                    )}
                  </div>

                  <p className="font-medium text-sm" style={{ color: '#1A1A18', textDecoration: g.durum === 'tamamlandi' ? 'line-through' : undefined }}>
                    {g.baslik}
                  </p>

                  {g.aciklama && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#8B7355' }}>{g.aciklama}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {g.son_tarih && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: overdue ? '#FF3B2F' : '#8B7355' }}>
                        <Clock size={11} />
                        {fmtDate(g.son_tarih)}{g.saat ? ` • ${g.saat}` : ''}
                      </span>
                    )}
                    {m && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#534AB7' }}>
                        <User size={11} />{m.ad} {m.soyad}
                      </span>
                    )}
                    {p && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#D4AF37' }}>
                        <Building2 size={11} />{p.isim}
                      </span>
                    )}
                    {g.atanan_user && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#22A05A' }}>
                        <Flag size={11} />{kullaniciAd(g.atanan_user)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {/* Durum cycle */}
                  <select
                    value={g.durum}
                    onChange={e => quickDurum(g.id, e.target.value as GorevDurum)}
                    className="text-xs rounded-lg px-2 py-1 focus:outline-none"
                    style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}
                  >
                    <option value="bekliyor">Bekliyor</option>
                    <option value="devam">Devam</option>
                    <option value="tamamlandi">Tamamlandı</option>
                  </select>
                  <button onClick={() => openEdit(g)} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: '#1A1A18', background: 'white', border: '0.5px solid #F6D9A8' }}>Düzenle</button>
                  <button onClick={() => remove(g.id)} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: 'white', background: '#FF3B2F' }}>Sil</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-lg" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{editItem ? 'Görevi Düzenle' : 'Yeni Görev'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div>
                  <label className="label">Başlık *</label>
                  <input className="input" placeholder="Görev başlığı" value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Açıklama</label>
                  <textarea className="input h-20 resize-none" placeholder="Detaylar..." value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Son Tarih</label>
                    <input type="date" className="input" value={form.son_tarih} onChange={e => setForm(f => ({ ...f, son_tarih: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Saat</label>
                    <input type="time" className="input" value={form.saat} onChange={e => setForm(f => ({ ...f, saat: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Öncelik</label>
                    <select className="input" value={form.oncelik} onChange={e => setForm(f => ({ ...f, oncelik: e.target.value as GorevOncelik }))}>
                      <option value="acil">🔴 Acil</option>
                      <option value="yuksek">🟠 Yüksek</option>
                      <option value="orta">🟡 Orta</option>
                      <option value="dusuk">🟢 Düşük</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Durum</label>
                    <select className="input" value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value as GorevDurum }))}>
                      <option value="bekliyor">Bekliyor</option>
                      <option value="devam">Devam Ediyor</option>
                      <option value="tamamlandi">Tamamlandı</option>
                    </select>
                  </div>
                </div>
                {isAdmin && (
                  <div>
                    <label className="label">Atanan Kişi</label>
                    <select className="input" value={form.atanan_user} onChange={e => setForm(f => ({ ...f, atanan_user: e.target.value }))}>
                      <option value="">Seçin...</option>
                      {kullanicilar.map(k => (
                        <option key={k.username} value={k.username}>{k.ad} {k.soyad}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Müşteri (opsiyonel)</label>
                  <select className="input" value={form.musteri_id} onChange={e => setForm(f => ({ ...f, musteri_id: e.target.value }))}>
                    <option value="">Seçin...</option>
                    {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad} {m.soyad}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Portföy (opsiyonel)</label>
                  <select className="input" value={form.portfoy_id} onChange={e => setForm(f => ({ ...f, portfoy_id: e.target.value }))}>
                    <option value="">Seçin...</option>
                    {portfoyler.map(p => <option key={p.id} value={p.id}>{p.isim}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ background: '#F5F0E8', borderTop: '1px solid #F6D9A8' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : (editItem ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
