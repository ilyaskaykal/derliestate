import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2, Users, Trophy, Plus, CheckSquare, Calendar,
  ChevronRight, TrendingUp, Pencil, Trash2, X, Loader2, Camera, GripVertical,
  Phone, Eye, Zap, ClipboardList, AlertTriangle,
} from 'lucide-react';
import { MarketCommentary, WeeklyBriefingModal } from '../components/AIFeatures';
import { supabase } from '../lib/supabase';
import { Kullanici, Musteri, Portfoy, ROL_LABELS, isGuest } from '../types';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import type { Page } from '../App';

interface Props {
  onNavigate: (page: Page) => void;
  onAddMusteri?: () => void;
  onAddPortfoy?: () => void;
}

interface MatchResult {
  customer: Musteri;
  portfolio: Portfoy;
  score: number;
  reasons: string[];
}

function cleanNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/[^\d]/g, '')) || 0;
}

function calculateMatch(customer: Musteri, portfolio: Portfoy): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Budget (35 pts)
  const cMin = cleanNum(customer.butce_min);
  const cMax = cleanNum(customer.butce_max) || cleanNum(customer.butce);
  const pPrice = cleanNum(portfolio.fiyat);

  if (pPrice > 0 && cMax > 0) {
    if (pPrice >= cMin * 0.9 && pPrice <= cMax * 1.05) {
      score += 35;
      reasons.push('Butceye tam uyumlu');
    } else if (pPrice <= cMax * 1.15) {
      score += 20;
      reasons.push('Butce yakin');
    }
  }

  // Region (25 pts)
  const cRegions = [customer.muhit, customer.olmaz_olmaz]
    .filter(Boolean).map(s => s!.toLowerCase().trim());
  const pRegions = [portfolio.bolge, portfolio.mahalle, portfolio.ilce]
    .filter(Boolean).map(s => s!.toLowerCase().trim());
  const regionHit = cRegions.some(c => pRegions.some(p => p.includes(c) || c.includes(p)));
  if (regionHit) { score += 25; reasons.push('Bolge eslesti'); }

  // Sea proximity (15 pts)
  if (customer.denize_yakin === true && portfolio.denize_yakin === true) {
    score += 15; reasons.push('Denize yakin');
  }
  // Sea view (10 pts)
  if (customer.deniz_manzarasi === true && portfolio.deniz_manzarasi === true) {
    score += 10; reasons.push('Deniz manzarasi');
  }

  // Property type (10 pts)
  const cType = (customer.portfoy_tercihi || '').toLowerCase();
  const pType = (portfolio.tip || '').toLowerCase();
  if (cType && pType && (cType.includes(pType) || pType.includes(cType))) {
    score += 10; reasons.push('Tip eslesti');
  }

  // Status bonus (5 pts)
  if (customer.durum === 'sicak' || customer.durum === 'satin_alacak') score += 5;

  return { score: Math.min(score, 100), reasons: reasons.slice(0, 3) };
}

interface Stats {
  portfoy: number;
  musteri: number;
  satis: number;
  loaded: boolean;
}

interface EkipUyesi {
  id: string;
  ad_soyad: string;
  unvan: string | null;
  foto_url: string | null;
  aciklama: string | null;
  sira: number;
  created_at: string;
}

interface TeamCard {
  id: string;
  name: string;
  title: string;
  fotoUrl: string | null;
  aciklama: string | null;
  sira: number;
  source: 'kullanici' | 'ekip';
  dbId: string; // id in source table (same as id for ekip, kullanici id for kullanici)
  raw?: EkipUyesi;
}

function resizeAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.onload = () => {
        const MAX = 400;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > MAX) { h = (h * MAX) / w; w = MAX; }
        if (h > MAX) { w = (w * MAX) / h; h = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w); canvas.height = Math.round(h);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob')), 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('img'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, icon: Icon, borderColor, subColor, delay = 0 }: {
  label: string; value: number; icon: React.ElementType;
  borderColor: string; subColor: string; delay?: number;
}) {
  const [active, setActive] = useState(false);
  const displayed = useCountUp(active ? value : 0, 1200);
  useEffect(() => {
    const t = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="relative rounded-xl p-5 flex flex-col gap-3 overflow-hidden" style={{ background: '#1A1A18', borderBottom: `3px solid ${borderColor}`, border: '1px solid #2C2C2A', borderBottomColor: borderColor }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <Icon size={20} style={{ color: '#8B7355' }} />
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: '#F5F0E8' }}>{displayed}</p>
        <p className="text-xs mt-1.5 font-medium uppercase tracking-widest" style={{ color: '#8B7355' }}>{label}</p>
      </div>
      <p className="text-xs font-semibold" style={{ color: subColor }}>{displayed > 0 ? 'aktif' : '—'}</p>
    </div>
  );
}

function TeamCardDisplay({
  card, featured = false, isAdmin,
  onEdit, onDelete,
  draggable, onDragStart, onDragOver, onDrop, isDragOver,
}: {
  card: TeamCard; featured?: boolean; isAdmin: boolean;
  onEdit?: () => void; onDelete?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group relative rounded-xl transition-all duration-300 ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${featured ? 'p-8 flex flex-col sm:flex-row items-center gap-8' : 'p-6 flex flex-col items-center gap-4 text-center'}`}
      style={{
        background: 'white',
        border: isDragOver
          ? '2px dashed #D4AF37'
          : (featured ? '1px solid #D4AF37' : '0.5px solid #F6D9A8'),
        boxShadow: hovered
          ? (featured ? '0 12px 40px rgba(0,0,0,0.12)' : '0 8px 24px rgba(0,0,0,0.08)')
          : undefined,
        transform: hovered && !isDragOver ? 'translateY(-3px)' : undefined,
        opacity: isDragOver ? 0.6 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle + admin controls */}
      {isAdmin && (
        <div className={`absolute top-3 right-3 flex items-center gap-1 transition-opacity z-10 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          {draggable && (
            <span className="p-1 rounded-lg cursor-grab" style={{ background: '#F5F0E8', color: '#8B7355' }} title="Sürükle">
              <GripVertical size={12} />
            </span>
          )}
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1 rounded-lg transition-colors" style={{ background: '#F5F0E8', color: '#8B7355' }} title="Düzenle">
              <Pencil size={12} />
            </button>
          )}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 rounded-lg transition-colors" style={{ background: '#F5F0E8', color: '#FF3B2F' }} title="Sil">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      <div className="relative shrink-0">
        <UserAvatar name={card.name} fotoUrl={card.fotoUrl} size={featured ? 120 : 80} className="rounded-xl relative" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'white', border: '2px solid white' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: '#22A05A' }} />
        </div>
      </div>

      <div className={`space-y-2 ${featured ? 'flex-1 sm:text-left text-center' : ''}`}>
        {featured && card.title && (
          <div className={`flex items-center gap-2 mb-1 ${featured ? 'justify-center sm:justify-start' : ''}`}>
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: '#1A1A18', color: '#D4AF37', border: '1px solid #D4AF37' }}>
              {card.title}
            </span>
          </div>
        )}
        <p className={`font-bold leading-tight ${featured ? 'text-2xl' : 'text-base'}`} style={{ color: '#1A1A18' }}>{card.name}</p>
        {!featured && card.title && (
          <span className="inline-block text-xs px-3 py-1 rounded-full font-semibold" style={{ background: '#FDF3E3', color: '#8B7355', border: '0.5px solid #F6D9A8' }}>
            {card.title}
          </span>
        )}
        {card.aciklama && (
          <p className="text-sm mt-1" style={{ color: '#8B7355' }}>{card.aciklama}</p>
        )}
      </div>
    </div>
  );
}

function EkipModal({ initial, onSave, onClose }: {
  initial?: EkipUyesi;
  onSave: (data: { ad_soyad: string; unvan: string; aciklama: string; foto_url: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ad_soyad: initial?.ad_soyad ?? '', unvan: initial?.unvan ?? '', aciklama: initial?.aciklama ?? '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ad_soyad.trim()) return;
    setSaving(true);
    let foto_url = initial?.foto_url ?? null;
    if (file) {
      try {
        const blob = await resizeAvatar(file);
        const slug = form.ad_soyad.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const path = `ekip_${slug}.jpg`;
        const { error: upErr } = await supabase.storage.from('kullanici-fotograflar').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('kullanici-fotograflar').getPublicUrl(path);
          foto_url = urlData.publicUrl;
        }
      } catch { /* keep existing */ }
    }
    await onSave({ ...form, foto_url });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
          <h2 className="font-semibold text-base" style={{ color: '#1A1A18' }}>{initial ? 'Ekip Üyesini Düzenle' : 'Ekip Üyesi Ekle'}</h2>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="modal-body p-5 space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar name={form.ad_soyad || '?'} fotoUrl={preview ?? initial?.foto_url} size={64} className="rounded-xl shrink-0" />
              <div className="flex-1">
                <label className="label mb-1">Fotoğraf</label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm" style={{ border: '0.5px solid #F6D9A8', background: '#F5F0E8' }}>
                  <Camera size={14} style={{ color: '#D4AF37' }} className="shrink-0" />
                  <span style={{ color: '#8B7355' }} className="truncate">{file ? file.name : 'Dosya seç...'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                </label>
              </div>
            </div>
            <div><label className="label">Ad Soyad *</label><input className="input" value={form.ad_soyad} onChange={e => setForm(f => ({ ...f, ad_soyad: e.target.value }))} required /></div>
            <div><label className="label">Unvan / Pozisyon</label><input className="input" placeholder="Danışman, Ön Büro Sorumlusu..." value={form.unvan} onChange={e => setForm(f => ({ ...f, unvan: e.target.value }))} /></div>
            <div>
              <label className="label">Açıklama <span className="font-normal" style={{ color: '#A89880' }}>(isteğe bağlı)</span></label>
              <textarea className="input resize-none" rows={2} placeholder="Kısa biyografi..." value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">İptal</button>
            <button type="submit" disabled={saving || !form.ad_soyad.trim()} className="btn-gold flex-1 justify-center">
              {saving ? <Loader2 className="animate-spin" size={16} /> : (initial ? 'Güncelle' : 'Kaydet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Anasayfa({ onNavigate, onAddMusteri, onAddPortfoy }: Props) {
  const { effectiveUser } = useAuth();
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';
  const isGuestUser = isGuest(effectiveUser?.rol);

  const [stats, setStats] = useState<Stats>({ portfoy: 0, musteri: 0, satis: 0, loaded: false });
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [ekipUyeleri, setEkipUyeleri] = useState<EkipUyesi[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showWeeklyBriefing, setShowWeeklyBriefing] = useState(false);
  const [showEkipModal, setShowEkipModal] = useState(false);
  const [editEkip, setEditEkip] = useState<EkipUyesi | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [eidsStats, setEidsStats] = useState({ aktif: 0, yakin: 0, doldu: 0, bekleyen: 0 });

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const loadEkip = useCallback(async () => {
    const { data } = await supabase.from('ekip_uyeleri').select('*').order('sira').order('created_at');
    setEkipUyeleri((data ?? []) as EkipUyesi[]);
  }, []);

  const generateSmartMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const [{ data: customers, error: cErr }, { data: portfolios, error: pErr }] = await Promise.all([
        supabase.from('musteriler').select('*'),
        supabase.from('portfoyler').select('*'),
      ]);

      console.log('[Matches] Customers fetched:', customers?.length ?? 0, cErr ?? '');
      console.log('[Matches] Portfolios fetched:', portfolios?.length ?? 0, pErr ?? '');

      if (!customers || !portfolios || customers.length === 0 || portfolios.length === 0) {
        console.log('[Matches] Not enough data to match.');
        setMatches([]);
        setMatchesLoading(false);
        return;
      }

      const results: MatchResult[] = [];
      for (const c of customers as Musteri[]) {
        for (const p of portfolios as Portfoy[]) {
          const { score, reasons } = calculateMatch(c, p);
          console.log(`[Matches] ${c.ad} ${c.soyad} ↔ ${p.isim}: score=${score}`);
          if (score >= 40) results.push({ customer: c, portfolio: p, score, reasons });
        }
      }

      results.sort((a, b) => b.score - a.score);
      console.log('[Matches] Total above threshold:', results.length, '| Top shown:', Math.min(results.length, 10));
      setMatches(results);
    } catch (err) {
      console.error('[Matches] Error:', err);
      setMatches([]);
    }
    setMatchesLoading(false);
  }, []);

  useEffect(() => {
    async function load() {
      const [portfoyRes, musteriRes, teamRes, configRes] = await Promise.all([
        supabase.from('portfoyler').select('id', { count: 'exact', head: true }),
        supabase.from('musteriler').select('id', { count: 'exact', head: true }),
        supabase.from('kullanicilar')
          .select('id, username, ad, soyad, rol, foto_url, sira, created_at')
          .neq('username', 'superadmin')
          .neq('username', 'admin')
          .neq('username', 'derli')
          .neq('rol', 'musteri')
          .neq('rol', 'misafir')
          .order('sira', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('app_config').select('value').eq('key', 'anasayfa_kapak').maybeSingle(),
      ]);
      const satisRes = await supabase.from('musteriler').select('id', { count: 'exact', head: true }).eq('durum', 'satin_alacak');

      setStats({ portfoy: portfoyRes.count ?? 0, musteri: musteriRes.count ?? 0, satis: satisRes.count ?? 0, loaded: true });
      setKullanicilar((teamRes.data ?? []) as Kullanici[]);
      setCoverUrl(configRes.data?.value ?? null);
    }
    load();
    loadEkip();
    generateSmartMatches();

    // Weekly briefing: show on Mondays
    const today = new Date();
    if (today.getDay() === 1) { // Monday
      const lastBriefing = localStorage.getItem('last_briefing_week');
      const thisWeek = `${today.getFullYear()}-W${Math.ceil(today.getDate() / 7)}`;
      if (lastBriefing !== thisWeek) {
        setShowWeeklyBriefing(true);
        localStorage.setItem('last_briefing_week', thisWeek);
      }
    }

    // EIDS stats
    const todayStr = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    Promise.all([
      supabase.from('portfoyler').select('id', { count: 'exact', head: true }).eq('eids_status', 'aktif'),
      supabase.from('portfoyler').select('id', { count: 'exact', head: true }).eq('eids_status', 'aktif').gte('eids_yetki_bitis', todayStr).lte('eids_yetki_bitis', in30Days),
      supabase.from('portfoyler').select('id', { count: 'exact', head: true }).in('eids_status', ['suresi_doldu', 'yok']),
      supabase.from('portfoyler').select('id', { count: 'exact', head: true }).eq('eids_status', 'beklemede'),
    ]).then(([a, y, d, b]) => {
      setEidsStats({ aktif: a.count ?? 0, yakin: y.count ?? 0, doldu: d.count ?? 0, bekleyen: b.count ?? 0 });
    });

    // Auto-refresh every 5 minutes
    const interval = setInterval(generateSmartMatches, 5 * 60 * 1000);

    // Realtime: re-run matches when customers or portfolios change
    const musteriSub = supabase
      .channel('anasayfa-musteriler')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'musteriler' }, () => {
        console.log('[Matches] musteriler changed, re-running matches');
        generateSmartMatches();
      })
      .subscribe();

    const portfoySub = supabase
      .channel('anasayfa-portfoyler')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfoyler' }, () => {
        console.log('[Matches] portfoyler changed, re-running matches');
        generateSmartMatches();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(musteriSub);
      supabase.removeChannel(portfoySub);
    };
  }, [loadEkip, generateSmartMatches]);

  const allCards: TeamCard[] = (() => {
    const kullaniciCards: TeamCard[] = kullanicilar.map((k, i) => ({
      id: k.id,
      dbId: k.id,
      name: `${k.ad} ${k.soyad}`,
      title: ROL_LABELS[k.rol] ?? k.rol,
      fotoUrl: k.foto_url ?? null,
      aciklama: null,
      sira: (k as Kullanici & { sira?: number }).sira ?? (i * 10),
      source: 'kullanici' as const,
    }));

    const ekipCards: TeamCard[] = ekipUyeleri.map(e => ({
      id: e.id,
      dbId: e.id,
      name: e.ad_soyad,
      title: e.unvan ?? '',
      fotoUrl: e.foto_url,
      aciklama: e.aciklama,
      sira: 10000 + e.sira,
      source: 'ekip' as const,
      raw: e,
    }));

    return [...kullaniciCards, ...ekipCards].sort((a, b) => a.sira - b.sira);
  })();

  const [featured, ...rest] = allCards;

  const handleEkipSave = async (data: { ad_soyad: string; unvan: string; aciklama: string; foto_url: string | null }) => {
    if (editEkip) {
      await supabase.from('ekip_uyeleri').update({ ad_soyad: data.ad_soyad, unvan: data.unvan || null, aciklama: data.aciklama || null, foto_url: data.foto_url }).eq('id', editEkip.id);
    } else {
      const maxSira = ekipUyeleri.length > 0 ? Math.max(...ekipUyeleri.map(e => e.sira)) + 1 : 0;
      await supabase.from('ekip_uyeleri').insert({ ad_soyad: data.ad_soyad, unvan: data.unvan || null, aciklama: data.aciklama || null, foto_url: data.foto_url, sira: maxSira });
    }
    setShowEkipModal(false);
    setEditEkip(null);
    loadEkip();
  };

  const handleEkipDelete = async (id: string) => {
    if (!confirm('Bu ekip üyesini silmek istediğinizden emin misiniz?')) return;
    await supabase.from('ekip_uyeleri').delete().eq('id', id);
    loadEkip();
  };

  /** Save new order after drag-and-drop */
  const handleDrop = async (dropIdx: number) => {
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) { setDragOverIdx(null); dragIdx.current = null; return; }

    const reordered = [...allCards];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    // Assign new sira values (0,1,2,...) and persist
    const kulUpdates: Promise<unknown>[] = [];
    const ekipUpdates: Promise<unknown>[] = [];
    reordered.forEach((card, i) => {
      if (card.source === 'kullanici') {
        kulUpdates.push(supabase.from('kullanicilar').update({ sira: i }).eq('id', card.dbId));
      } else {
        ekipUpdates.push(supabase.from('ekip_uyeleri').update({ sira: i }).eq('id', card.dbId));
      }
    });
    await Promise.all([...kulUpdates, ...ekipUpdates]);

    dragIdx.current = null;
    setDragOverIdx(null);

    // Reload
    const [teamRes] = await Promise.all([
      supabase.from('kullanicilar').select('id, username, ad, soyad, rol, foto_url, sira, created_at').neq('username', 'superadmin').neq('username', 'admin').order('sira', { ascending: true }).order('created_at', { ascending: true }),
    ]);
    setKullanicilar((teamRes.data ?? []) as Kullanici[]);
    loadEkip();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const quickActions = [
    { label: '+ Müşteri Ekle', color: '#C0392B', bg: '#FFE8E8', border: '#F0C0C0', emoji: '🧑', action: () => onAddMusteri ? onAddMusteri() : onNavigate('customers') },
    { label: '+ Portföy Ekle', color: '#2055C0', bg: '#E8F0FF', border: '#C0D0F0', emoji: '🏠', action: () => onAddPortfoy ? onAddPortfoy() : onNavigate('portfolio') },
    { label: 'Görevlerim', color: '#C07020', bg: '#FFF3E0', border: '#F0D080', emoji: '📋', action: () => onNavigate('gorevler') },
    { label: 'Randevularım', color: '#207020', bg: '#E8FFE8', border: '#A0D0A0', emoji: '📅', action: () => onNavigate('appointments') },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 340 }}>
        {coverUrl ? (
          <img src={coverUrl} alt="Kapak" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #1A1A18 0%, #3D3880 50%, #7F77DD 100%)' }} />
        )}
        <div className="absolute inset-0" style={{ background: coverUrl ? 'linear-gradient(to bottom, rgba(26,26,24,0.55) 0%, rgba(26,26,24,0.7) 60%, rgba(26,26,24,0.97) 100%)' : 'transparent' }} />

        <div className="relative px-6 py-14 md:py-20 flex flex-col items-center text-center">
          {/* Title block */}
          <div className="mb-5" style={{ display: 'inline-block' }}>
            {/* Top rule */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #C8804B, transparent)', marginBottom: 14 }} />

            <h1 style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: 'clamp(36px, 8vw, 72px)',
              fontWeight: 500,
              color: 'white',
              letterSpacing: '4px',
              lineHeight: 1,
              margin: 0,
              whiteSpace: 'nowrap',
            }}>
              DERLİ EMLAK
            </h1>

            {/* Bottom rule */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #C8804B, transparent)', marginTop: 14 }} />

            {/* Subtitle */}
            <p style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: 'clamp(11px, 2vw, 15px)',
              color: '#C8804B',
              marginTop: 18,
              letterSpacing: '3px',
              fontStyle: 'italic',
            }}>
              Premium Real Estate · Est. 2010
            </p>
          </div>

          {effectiveUser && (
            <p className="mt-4 text-sm md:text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {greeting()},{' '}
              <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>{effectiveUser.ad} {effectiveUser.soyad}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {['Çeşme Bölgesi', 'Premium CRM', 'Est. 2010'].map(badge => (
              <span key={badge} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>{badge}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-8 max-w-5xl mx-auto space-y-10">

        {/* ── GUEST WELCOME ── */}
        {isGuestUser && (
          <div
            className="rounded-xl px-6 py-5 flex items-start gap-4"
            style={{ background: 'white', border: '0.5px solid #F6D9A8' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FDF3E3' }}>
              <span style={{ fontSize: 20 }}>👋</span>
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#1A1A18' }}>Hoşgeldiniz!</p>
              <p className="text-sm mt-0.5" style={{ color: '#8B7355' }}>
                Misafir girişi olarak portföylerimizi ve Instagram ilanlarımızı inceleyebilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* ── QUICK ACTIONS (staff only) ── */}
        {!isGuestUser && <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#8B7355' }}>Hızlı İşlemler</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={a.action}
                className="group flex items-center gap-3 text-left transition-all active:scale-95 hover:shadow-md"
                style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: 12, padding: 16, fontWeight: 500 }}
              >
                <span className="text-2xl shrink-0">{a.emoji}</span>
                <span className="text-sm flex-1 leading-tight" style={{ color: a.color, fontWeight: 500 }}>{a.label}</span>
                <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: a.color }} />
              </button>
            ))}
          </div>
        </div>}

        {/* ── EIDS SUMMARY (staff only) ── */}
        {!isGuestUser && (eidsStats.aktif > 0 || eidsStats.doldu > 0 || eidsStats.bekleyen > 0 || eidsStats.yakin > 0) && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'white', borderBottom: '1px solid #F6D9A8' }}>
              <div className="flex items-center gap-2">
                <ClipboardList size={16} style={{ color: '#D4AF37' }} />
                <h3 className="text-sm font-semibold" style={{ color: '#1A1A18' }}>EİDS Durum Özeti</h3>
              </div>
              <button
                onClick={() => onNavigate('eids-yonetim' as Parameters<typeof onNavigate>[0])}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: '#534AB7' }}
              >
                Yönet <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4">
              {[
                { label: 'Aktif Yetki', value: eidsStats.aktif, bg: '#22A05A', dot: '#4AE08A' },
                { label: '30g İçinde Bitecek', value: eidsStats.yakin, bg: '#E8A020', dot: '#FFD060' },
                { label: 'Süresi Dolmuş/Eksik', value: eidsStats.doldu, bg: '#FF3B2F', dot: '#FF8A80' },
                { label: 'Yetki Bekleyen', value: eidsStats.bekleyen, bg: '#E8A020', dot: '#FFD060' },
              ].map((s, i) => (
                <div key={s.label} className="p-4 flex flex-col gap-1" style={{ background: s.bg, borderRight: i < 3 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                  <div className="w-2 h-2 rounded-full mb-1" style={{ background: s.dot }} />
                  <p className="text-2xl font-bold leading-none" style={{ color: 'white' }}>{s.value}</p>
                  <p className="text-xs font-medium mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MARKET COMMENTARY (staff only) ── */}
        {!isGuestUser && <MarketCommentary />}

        {/* ── STATS (staff only) ── */}
        {!isGuestUser && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Aktif Portföy" value={stats.portfoy} icon={Building2} borderColor="#D4AF37" subColor="#D4AF37" delay={0} />
          <StatCard label="Kayıtlı Müşteri" value={stats.musteri} icon={Users} borderColor="#C8804B" subColor="#C8804B" delay={120} />
          <StatCard label="Başarılı Satış" value={stats.satis} icon={TrendingUp} borderColor="#22A05A" subColor="#22A05A" delay={240} />
          <div className="relative rounded-xl p-5 flex flex-col gap-3 overflow-hidden" style={{ background: '#1A1A18', border: '1px solid #2C2C2A', borderBottomColor: '#D4AF37', borderBottom: '3px solid #D4AF37' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Trophy size={20} style={{ color: '#8B7355' }} />
            </div>
            <div>
              <p className="text-3xl font-bold leading-none" style={{ color: '#F5F0E8' }}>15</p>
              <p className="text-xs mt-1.5 font-medium uppercase tracking-widest" style={{ color: '#8B7355' }}>Yıllık Deneyim</p>
            </div>
            <p className="text-xs font-semibold" style={{ color: '#D4AF37' }}>EST. 2010</p>
          </div>
        </div>}

        {/* ── AI MATCHES (staff only) ── */}
        {!isGuestUser &&
        <div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #F6D9A8' }}>
            {/* Colorful header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #1A1A18, #534AB7)', borderRadius: '10px 10px 0 0' }}>
              <div className="flex items-center gap-2">
                <Zap size={18} style={{ color: '#D4AF37' }} />
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'white', fontFamily: '"Times New Roman", Times, serif' }}>YZ Akıllı Eşleştirme Analizi</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Müşterilerimizi portföylerle akıllıca eşleştiriyoruz</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: 'rgba(212,175,55,0.25)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.4)' }}>{matches.length}</span>
                <button
                  onClick={generateSmartMatches}
                  disabled={matchesLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ background: '#D4AF37', color: '#1A1A18', border: 'none' }}
                >
                  {matchesLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  YZ Eşleştir
                </button>
              </div>
            </div>

            {matchesLoading ? (
              <div className="space-y-0 bg-white">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse" style={{ borderBottom: '1px solid #E8EDF4', height: 76 }}>
                    <div className="flex gap-4 h-full items-center">
                      <div className="w-14 h-10 rounded-lg shrink-0" style={{ background: '#E8EDF4' }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 rounded w-1/2" style={{ background: '#E8EDF4' }} />
                        <div className="h-2 rounded w-1/3" style={{ background: '#FDF3E3' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : matches.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2" style={{ background: 'white' }}>
                <p className="text-sm font-medium" style={{ color: '#8B7355' }}>Henüz eşleşme bulunamadı.</p>
                <p className="text-xs" style={{ color: '#A89880' }}>Müşteri tercihlerini ve portföy bilgilerini detaylandırdıkça eşleşmeler oluşacak.</p>
              </div>
            ) : (
              <div>
                {(showAllMatches ? matches : matches.slice(0, 5)).map((m, i) => {
                  const pct = m.score;
                  const heat =
                    pct >= 80 ? { label: 'SICAK',   color: '#FF3B2F', bg: '#FF3B2F', borderLeft: '#FF3B2F' } :
                    pct >= 65 ? { label: 'YÜKSEK',  color: '#E8A020', bg: '#E8A020', borderLeft: '#E8A020' } :
                    pct >= 50 ? { label: 'ORTA',    color: '#22A05A', bg: '#22A05A', borderLeft: '#22A05A' } :
                                { label: 'DÜŞÜK',   color: '#8B7355', bg: '#8B7355', borderLeft: '#C8D4E0' };

                  const rowBg = i % 2 === 0 ? 'white' : '#F8F6FF';

                  const handleEslestir = async () => {
                    await supabase.from('eslestirme_gecmisi').insert({
                      musteri_id: m.customer.id,
                      portfoy_id: m.portfolio.id,
                      musteri_ad: `${m.customer.ad} ${m.customer.soyad}`,
                      portfoy_baslik: m.portfolio.isim,
                      sonuc: 'bekliyor',
                      danisman: effectiveUser ? `${effectiveUser.ad} ${effectiveUser.soyad}` : null,
                    });
                    onNavigate('mesajlasma');
                  };

                  return (
                    <div
                      key={i}
                      className="group transition-all duration-200"
                      style={{
                        background: rowBg,
                        borderLeft: `3px solid ${heat.borderLeft}`,
                        borderBottom: '1px solid #E8EDF4',
                      }}
                    >
                      {/* Mobile layout */}
                      <div className="flex md:hidden flex-col gap-2 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: heat.bg, color: 'white', fontSize: '11px', fontWeight: 600 }}>{pct}% {heat.label}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8EDF4' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${heat.color}, ${heat.color}99)` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="font-semibold truncate" style={{ color: '#1A1A18' }}>{m.customer.ad} {m.customer.soyad}</p>
                            <p style={{ color: '#8B7355' }}>{m.customer.butce_max || m.customer.butce || '—'} {m.customer.para_birimi || 'TL'}</p>
                          </div>
                          <div>
                            <p className="font-medium truncate" style={{ color: '#534AB7' }}>{m.portfolio.isim}</p>
                            <p style={{ color: '#C0392B' }}>{m.portfolio.fiyat || '—'} {m.portfolio.para_birimi || 'TL'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => onNavigate('customers')} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold btn-ghost">
                            <Eye size={11} /> Detay
                          </button>
                          <button onClick={handleEslestir} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold btn-gold">
                            <Phone size={11} /> Eşleştir
                          </button>
                        </div>
                      </div>

                      {/* Desktop row layout */}
                      <div className="hidden md:grid items-center gap-4 px-4 py-3" style={{ gridTemplateColumns: '90px 1fr 24px 1fr 160px 180px' }}>
                        {/* Score */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{ background: heat.bg, color: 'white', fontSize: 14, fontWeight: 600 }}>{pct}% {heat.label}</span>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#E8EDF4' }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${heat.color}CC, ${heat.color})` }} />
                          </div>
                        </div>

                        {/* Customer */}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: '#1A1A18' }}>{m.customer.ad} {m.customer.soyad}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>
                            {m.customer.butce_max || m.customer.butce ? `${m.customer.butce_max || m.customer.butce} ${m.customer.para_birimi || 'TL'}` : 'Bütçe belirtilmemiş'}
                          </p>
                          <p className="text-xs" style={{ color: '#A89880' }}>{m.customer.muhit || '—'}</p>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center justify-center">
                          <span className="text-lg" style={{ color: '#C8D4E0' }}>↔</span>
                        </div>

                        {/* Portfolio */}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: '#534AB7', fontWeight: 500 }}>{m.portfolio.isim}</p>
                          <p className="text-xs mt-0.5 font-bold" style={{ color: '#C0392B' }}>
                            {m.portfolio.fiyat ? `${m.portfolio.fiyat} ${m.portfolio.para_birimi || 'TL'}` : 'Fiyat belirtilmemiş'}
                          </p>
                          <p className="text-xs" style={{ color: '#A89880' }}>{m.portfolio.bolge || '—'}</p>
                        </div>

                        {/* Reasons */}
                        <div className="flex flex-col gap-1">
                          {m.reasons.map(r => {
                            const pillBg = r.includes('Butce') ? '#FFF3E0' : r.includes('Bolge') ? '#E8F0FF' : '#E8F8FF';
                            const pillColor = r.includes('Butce') ? '#C07020' : r.includes('Bolge') ? '#2055C0' : '#0077AA';
                            return (
                              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-tight" style={{ background: pillBg, color: pillColor }}>
                                ✓ {r}
                              </span>
                            );
                          })}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => onNavigate('customers')}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold w-full btn-ghost"
                          >
                            <Eye size={11} /> Detayı Gör
                          </button>
                          <button
                            onClick={handleEslestir}
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold w-full btn-gold"
                          >
                            <Phone size={11} /> Eşleştir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {matches.length > 5 && (
                  <button
                    onClick={() => setShowAllMatches(v => !v)}
                    className="w-full py-2.5 text-sm font-semibold transition-all"
                    style={{ background: 'white', color: '#534AB7' }}
                  >
                    {showAllMatches ? 'Daha az göster' : `Tümünü Gör (${matches.length} eşleşme)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>}

        {/* ── TEAM ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>Profesyonel Ekibimiz</h2>
              <p className="text-sm mt-1" style={{ color: '#8B7355' }}>
                Çeşme'nin En Deneyimli Emlak Danışmanları
                {isAdmin && <span className="ml-2 text-xs" style={{ color: '#A89880' }}>• Sürükleyerek sıralayabilirsiniz</span>}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => { setEditEkip(null); setShowEkipModal(true); }}
                className="btn-gold flex items-center gap-2 text-sm"
              >
                <Plus size={15} />
                Üye Ekle
              </button>
            )}
          </div>

          {allCards.length === 0 ? (
            <div className="rounded-xl py-12 flex items-center justify-center" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
              <p className="text-sm" style={{ color: '#8B7355' }}>Ekip üyesi bulunamadı.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Featured card (first in sorted list) */}
              {featured && (
                <TeamCardDisplay
                  card={featured}
                  featured
                  isAdmin={isAdmin}
                  draggable={isAdmin}
                  isDragOver={dragOverIdx === 0}
                  onDragStart={() => { dragIdx.current = 0; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(0); }}
                  onDrop={() => handleDrop(0)}
                  onEdit={featured.source === 'ekip' && featured.raw ? () => { setEditEkip(featured.raw!); setShowEkipModal(true); } : undefined}
                  onDelete={featured.source === 'ekip' ? () => handleEkipDelete(featured.id) : undefined}
                />
              )}

              {/* Rest in 3-column grid */}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {rest.map((card, i) => {
                    const absoluteIdx = i + 1; // +1 because featured is index 0
                    return (
                      <TeamCardDisplay
                        key={card.id}
                        card={card}
                        isAdmin={isAdmin}
                        draggable={isAdmin}
                        isDragOver={dragOverIdx === absoluteIdx}
                        onDragStart={() => { dragIdx.current = absoluteIdx; }}
                        onDragOver={e => { e.preventDefault(); setDragOverIdx(absoluteIdx); }}
                        onDrop={() => handleDrop(absoluteIdx)}
                        onEdit={card.source === 'ekip' && card.raw ? () => { setEditEkip(card.raw!); setShowEkipModal(true); } : undefined}
                        onDelete={card.source === 'ekip' ? () => handleEkipDelete(card.id) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      {showEkipModal && (
        <EkipModal
          initial={editEkip ?? undefined}
          onSave={handleEkipSave}
          onClose={() => { setShowEkipModal(false); setEditEkip(null); }}
        />
      )}

      {showWeeklyBriefing && (
        <WeeklyBriefingModal onClose={() => setShowWeeklyBriefing(false)} />
      )}

      {/* Weekly briefing trigger button */}
      {!isGuestUser && (
        <button
          onClick={() => setShowWeeklyBriefing(true)}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-xl transition-all hover:scale-105"
          style={{ background: '#1A1A18', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
        >
          <Zap size={15} /> Haftalık Brifing
        </button>
      )}
    </div>
  );
}
