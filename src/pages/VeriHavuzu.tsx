import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Download, Plus, Search, X, ChevronUp, ChevronDown, Loader2,
  Users, Building2, Edit2, Check, History, AlignLeft, ExternalLink, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Musteri, Portfoy, MusteriDurum, PortfoyTip, PortfoyDurum, CESME_BOLGELERI, DegisiklikGecmisi } from '../types';
import { MusteriStatusBadge, PortfoyStatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type Tab = 'musteriler' | 'portfoyler';
type SortDir = 'asc' | 'desc';

const MUSTERI_DURUM_OPTS: { value: MusteriDurum; label: string }[] = [
  { value: 'sicak', label: 'Sıcak' },
  { value: 'satin_alacak', label: 'Satın Alacak' },
  { value: 'dusunuyor', label: 'Düşünüyor' },
  { value: 'kararsiz', label: 'Kararsız' },
  { value: 'gelmedi', label: 'No Show' },
  { value: 'soguk', label: 'Soğuk' },
];

const TIP_OPTIONS: { value: PortfoyTip; label: string }[] = [
  { value: 'daire', label: 'Daire' },
  { value: 'villa', label: 'Villa' },
  { value: 'ticari', label: 'Ticari' },
  { value: 'arsa', label: 'Arsa' },
];

const ODA_OPTIONS = ['Stüdyo', '1+1', '2+1', '3+1', '4+1', '5+1', '5+2', 'Diğer'];
const YAS_OPTIONS = ['Sıfır', '1 Yıl', '2 Yıl', '3 Yıl', '5 Yıl', '10 Yıl', '15 Yıl', '20+ Yıl'];

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <div
      className={`w-9 h-5 rounded-full transition-all relative cursor-pointer shrink-0`}
      style={{ background: value ? '#534AB7' : '#D4C9B8' }}
      onClick={onChange}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-4' : 'left-0.5'}`} />
    </div>
  );
}

function EditCell({
  value, onSave, type = 'text', options,
}: {
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'select' | 'number';
  options?: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (local !== value) onSave(local);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:text-yellow-400 transition-colors group flex items-center gap-1"
        onClick={() => setEditing(true)}
        title="Düzenlemek için tıkla"
      >
        {value || <span style={{ color: '#D4C9B8' }}>—</span>}
        <Edit2 size={10} className="opacity-0 group-hover:opacity-60 shrink-0" />
      </span>
    );
  }

  if (type === 'select' && options) {
    return (
      <div className="flex items-center gap-1">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          className="rounded px-1.5 py-0.5 text-xs focus:outline-none" style={{ background: 'white', border: '1px solid #534AB7', color: '#1A1A18' }}
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={commit}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={commit} className="text-green-400"><Check size={12} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        className="rounded px-1.5 py-0.5 text-xs focus:outline-none w-24" style={{ background: 'white', border: '1px solid #534AB7', color: '#1A1A18' }}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={commit} className="text-green-400"><Check size={12} /></button>
    </div>
  );
}

function DescriptionCell({ value, label = 'Detay', onEdit }: { value: string; label?: string; onEdit?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!value) return <span style={{ color: '#D4C9B8' }}>—</span>;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 transition-colors text-left" style={{ color: '#1A1A18' }}
        title="Tıkla — tam metni göster"
      >
        <AlignLeft size={11} className="shrink-0 opacity-60" />
        <span className="truncate max-w-[120px] block">{value}</span>
      </button>
      {open && (
        <div
          className="absolute z-50 bottom-full mb-2 left-0 w-72 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: 'white', border: '1px solid #F6D9A8' }}
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8B7355' }}>{label}</p>
            <button onClick={() => setOpen(false)} className="shrink-0" style={{ color: '#8B7355' }}><X size={12} /></button>
          </div>
          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words px-3 pb-3" style={{ color: '#1A1A18' }}>{value}</p>
          {onEdit && (
            <div className="px-3 py-2" style={{ borderTop: '0.5px solid #F6D9A8' }}>
              <button onClick={() => { setOpen(false); onEdit(); }} className="flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: '#D4AF37' }}>
                <Edit2 size={11} />Düzenle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SortHeader({ label, col, sortCol, sortDir, onSort, width }: {
  label: string; col: string; sortCol: string; sortDir: SortDir; onSort: (c: string) => void; width?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className="text-left px-3 py-2.5 font-medium text-xs uppercase cursor-pointer select-none whitespace-nowrap"
      style={{ color: '#8B7355', letterSpacing: '1px', ...(width ? { width } : {}) }}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
      </span>
    </th>
  );
}

export default function VeriHavuzu() {
  const { effectiveUser, user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('musteriler');

  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [loading, setLoading] = useState(true);

  const [mSearch, setMSearch] = useState('');
  const [pSearch, setPSearch] = useState('');
  const [mSortCol, setMSortCol] = useState('created_at');
  const [mSortDir, setMSortDir] = useState<SortDir>('desc');
  const [pSortCol, setPSortCol] = useState('created_at');
  const [pSortDir, setPSortDir] = useState<SortDir>('desc');

  const [selectedMusteri, setSelectedMusteri] = useState<Musteri | null>(null);
  const [selectedPortfoy, setSelectedPortfoy] = useState<Portfoy | null>(null);
  const [portfoyGecmis, setPortfoyGecmis] = useState<DegisiklikGecmisi[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
  const isAdminOrYonetici = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';
  const isSuperadmin = user?.username === 'superadmin' || effectiveUser?.username === 'superadmin';
  const hasFullAccess = effectiveUser?.rol === 'admin' || isSuperadmin;
  const canExport = hasFullAccess;

  // Phone visibility: admin/superadmin sees all; others see only their own records' phones
  const canSeePhone = (record: { eklendi_user_id?: string }) =>
    hasFullAccess || record.eklendi_user_id === effectiveUser?.username;
  const canSeeContact = canSeePhone;
  // Surnames always visible in Veri Havuzu (only phones are masked)
  const maskSoyad = (soyad: string | null | undefined, _record: { eklendi_user_id?: string }) => soyad ?? '';
  const maskPhone = (phone: string | null | undefined, record: { eklendi_user_id?: string }) =>
    canSeePhone(record) ? (phone ?? '') : '';

  const canEditRecord = (eklendi_user_id?: string) =>
    isAdminOrYonetici || isSuperadmin || !eklendi_user_id || eklendi_user_id === effectiveUser?.username;

  const load = useCallback(async () => {
    setLoading(true);
    const [m, p] = await Promise.all([
      supabase.from('musteriler').select('*').order('created_at', { ascending: false }),
      supabase.from('portfoyler').select('*').order('created_at', { ascending: false }),
    ]);
    setMusteriler((m.data || []) as Musteri[]);
    setPortfoyler((p.data || []) as Portfoy[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortData = <T extends Record<string, unknown>>(data: T[], col: string, dir: SortDir): T[] => {
    return [...data].sort((a, b) => {
      const av = String(a[col] ?? '');
      const bv = String(b[col] ?? '');
      return dir === 'asc' ? av.localeCompare(bv, 'tr') : bv.localeCompare(av, 'tr');
    });
  };

  const handleMSort = (col: string) => {
    if (mSortCol === col) setMSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setMSortCol(col); setMSortDir('asc'); }
  };
  const handlePSort = (col: string) => {
    if (pSortCol === col) setPSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setPSortCol(col); setPSortDir('asc'); }
  };

  const filteredM = sortData(
    musteriler.filter(m => {
      const q = mSearch.toLowerCase();
      return !q || `${m.ad} ${m.soyad} ${m.telefon} ${m.muhit} ${m.danisman}`.toLowerCase().includes(q);
    }),
    mSortCol, mSortDir
  );

  const filteredP = sortData(
    portfoyler.filter(p => {
      const q = pSearch.toLowerCase();
      return !q || `${p.isim} ${p.bolge} ${p.fiyat} ${p.danisman} ${p.sahip_ad} ${p.sahip_soyad}`.toLowerCase().includes(q);
    }),
    pSortCol, pSortDir
  );

  const updateMusteri = async (id: string, field: string, value: string | boolean) => {
    const { error } = await supabase.from('musteriler').update({ [field]: value }).eq('id', id);
    if (error) { toast('Güncelleme başarısız.', 'error'); return; }
    setMusteriler(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    if (selectedMusteri?.id === id) setSelectedMusteri(prev => prev ? { ...prev, [field]: value } : null);
  };

  const updatePortfoy = async (id: string, field: string, value: string | boolean, oldValue?: string) => {
    const { error } = await supabase.from('portfoyler').update({ [field]: value }).eq('id', id);
    if (error) { toast('Güncelleme başarısız.', 'error'); return; }

    if ((field === 'fiyat' || field === 'aciklama') && oldValue !== undefined && oldValue !== value) {
      await supabase.from('degisiklik_gecmisi').insert({
        kayit_id: id,
        kayit_turu: 'portfoy',
        alan: field,
        eski_deger: oldValue,
        yeni_deger: String(value),
        degistiren: danismanAdi,
      });
    }

    setPortfoyler(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    if (selectedPortfoy?.id === id) setSelectedPortfoy(prev => prev ? { ...prev, [field]: value } : null);
  };

  const openPortfoyHistory = async (p: Portfoy) => {
    const { data } = await supabase
      .from('degisiklik_gecmisi')
      .select('*')
      .eq('kayit_id', p.id)
      .order('created_at', { ascending: false });
    setPortfoyGecmis(data || []);
    setShowHistory(true);
  };

  const exportMusteri = () => {
    if (!canExport) { toast('Bu özelliğe erişim yetkiniz yok.', 'error'); return; }
    const rows = [
      ['Ad', 'Soyad', 'Telefon', 'Bütçe Min', 'Bütçe Max', 'Tercih Bölge', 'Bölge Esnek', 'Denize Yakın', 'Deniz Manzarası', 'Olmazsa Olmaz', 'Açıklama', 'Durum', 'Danışman', 'Eklenme'],
      ...filteredM.map(m => [
        m.ad, m.soyad, m.telefon, m.butce_min, m.butce_max, m.muhit,
        m.bolge_esnek ? 'Evet' : 'Hayır',
        m.denize_yakin ? 'Evet' : 'Hayır',
        m.deniz_manzarasi ? 'Evet' : 'Hayır',
        m.olmaz_olmaz, m.aciklama, m.durum, m.danisman,
        new Date(m.created_at).toLocaleDateString('tr-TR'),
      ]),
    ];
    downloadCSV(rows, 'Musteri_Havuzu');
  };

  const exportPortfoy = () => {
    if (!canExport) { toast('Bu özelliğe erişim yetkiniz yok.', 'error'); return; }
    const rows = [
      ['Başlık', 'Bölge', 'Fiyat', 'Tip', 'Oda', 'm²', 'Bina Yaşı', 'Denize Yakın', 'Deniz Manzarası', 'Durum', 'Danışman', 'Eklenme'],
      ...filteredP.map(p => [
        p.isim, p.bolge, p.fiyat, p.tip, p.oda, p.metrekare, p.durum_bina,
        p.denize_yakin ? 'Evet' : 'Hayır',
        p.deniz_manzarasi ? 'Evet' : 'Hayır',
        p.portfoy_durum, p.danisman,
        new Date(p.created_at).toLocaleDateString('tr-TR'),
      ]),
    ];
    downloadCSV(rows, 'Portfoy_Havuzu');
  };

  const downloadCSV = (rows: (string | null | undefined | boolean)[][], name: string) => {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Excel dosyası indirildi.');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: '#1A1A18' }}>Veri Havuzu</h1>
            <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Tüm müşteri ve portföy kayıtları — paylaşımlı, düzenlenebilir</p>
          </div>
          {canExport && (
            <button onClick={tab === 'musteriler' ? exportMusteri : exportPortfoy} className="btn-ghost">
              <Download size={15} />
              Excel'e Aktar
            </button>
          )}
        </div>

        <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}>
          {([['musteriler', 'Müşteri Havuzu', Users], ['portfoyler', 'Portföy Havuzu', Building2]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === id
                ? { background: '#1A1A18', color: '#F5F0E8', boxShadow: '0 0 8px rgba(212,175,55,0.2)', border: '1px solid #D4AF37' }
                : { color: '#8B7355' }
              }
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : tab === 'musteriler' ? (
          <MusteriTable
            musteriler={filteredM}
            search={mSearch}
            onSearch={setMSearch}
            sortCol={mSortCol}
            sortDir={mSortDir}
            onSort={handleMSort}
            onUpdate={updateMusteri}
            onSelect={setSelectedMusteri}
            danismanAdi={danismanAdi}
            onReload={load}
            canEdit={canEditRecord}
            canSeePhone={canSeePhone}
            maskSoyad={maskSoyad}
            maskPhone={maskPhone}
          />
        ) : (
          <PortfoyTable
            portfoyler={filteredP}
            search={pSearch}
            onSearch={setPSearch}
            sortCol={pSortCol}
            sortDir={pSortDir}
            onSort={handlePSort}
            onUpdate={updatePortfoy}
            onSelect={setSelectedPortfoy}
            danismanAdi={danismanAdi}
            onReload={load}
            onHistory={openPortfoyHistory}
            canEdit={canEditRecord}
            canSeePhone={canSeePhone}
            maskSoyad={maskSoyad}
            maskPhone={maskPhone}
          />
        )}
      </div>

      {selectedMusteri && (
        <MusteriDetailModal
          musteri={selectedMusteri}
          onClose={() => setSelectedMusteri(null)}
          onUpdate={updateMusteri}
          maskSoyad={maskSoyad}
          maskPhone={maskPhone}
        />
      )}

      {selectedPortfoy && (
        <PortfoyDetailModal
          portfoy={selectedPortfoy}
          onClose={() => setSelectedPortfoy(null)}
          onUpdate={updatePortfoy}
          onHistory={() => openPortfoyHistory(selectedPortfoy)}
          maskSoyad={maskSoyad}
          maskPhone={maskPhone}
        />
      )}

      {showHistory && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="modal-content max-w-lg" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Değişiklik Geçmişi</h2>
              <button onClick={() => setShowHistory(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <div className="modal-body p-4 space-y-2">
              {portfoyGecmis.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#8B7355' }}>Henüz değişiklik kaydı yok.</p>
              ) : portfoyGecmis.map(g => (
                <div key={g.id} className="rounded-lg p-3 text-sm" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-yellow-400 font-medium">{g.alan === 'fiyat' ? 'Fiyat' : 'Açıklama'} değişti</span>
                    <span className="text-xs" style={{ color: '#8B7355' }}>{new Date(g.created_at).toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="text-xs" style={{ color: '#1A1A18' }}>
                    <span className="line-through text-red-400/70">{g.eski_deger || '(boş)'}</span>
                    <span className="mx-2" style={{ color: '#8B7355' }}>→</span>
                    <span className="text-green-400/90">{g.yeni_deger || '(boş)'}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Değiştiren: {g.degistiren}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Müşteri Table ────────────────────────────────────────────────────────────

function MusteriTable({
  musteriler, search, onSearch, sortCol, sortDir, onSort, onUpdate, onSelect, danismanAdi, onReload, canEdit, canSeePhone, maskSoyad, maskPhone,
}: {
  musteriler: Musteri[];
  search: string;
  onSearch: (v: string) => void;
  sortCol: string;
  sortDir: SortDir;
  onSort: (c: string) => void;
  onUpdate: (id: string, field: string, value: string | boolean) => void;
  onSelect: (m: Musteri) => void;
  danismanAdi: string;
  onReload: () => void;
  canEdit: (eklendi_user_id?: string) => boolean;
  canSeePhone: (record: { eklendi_user_id?: string }) => boolean;
  maskSoyad: (soyad: string | null | undefined, record: { eklendi_user_id?: string }) => string;
  maskPhone: (phone: string | null | undefined, record: { eklendi_user_id?: string }) => string;
}) {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ad: '', soyad: '', telefon: '', butce_min: '', butce_max: '',
    muhit: '', bolge_esnek: false, olmaz_olmaz: '', aciklama: '',
    durum: 'kararsiz' as MusteriDurum,
    denize_yakin: false, deniz_manzarasi: false,
  });

  const save = async () => {
    if (!form.ad) return;
    setSaving(true);
    const { error } = await supabase.from('musteriler').insert({
      ...form,
      danisman: danismanAdi,
      eklendi_user_id: effectiveUser?.username || '',
      eklendi_user_ad: danismanAdi,
      email: '', butce: form.butce_min, portfoy_tercihi: '', kaynak: '', notlar: '',
      kesin_istekler: '', butce_max: form.butce_max,
    });
    if (error) toast('Hata oluştu.', 'error');
    else { toast('Müşteri eklendi.'); setShowAdd(false); onReload(); }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'rgba(253,243,227,0.97)', backdropFilter: 'blur(8px)' }}>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: '#8B7355' }} />
          <input className="input pl-8 py-2 text-sm" placeholder="Ara: ad, telefon, bölge..." value={search} onChange={e => onSearch(e.target.value)} />
          {search && <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: '#8B7355' }}><X size={13} /></button>}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gold"><Plus size={14} />Müşteri Ekle</button>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: 900 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#1A1A18', borderBottom: '0.5px solid #F6D9A8' }}>
              <SortHeader label="Ad Soyad" col="ad" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Telefon" col="telefon" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Bütçe Min" col="butce_min" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Bütçe Max" col="butce_max" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Tercih Bölge" col="muhit" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase whitespace-nowrap" style={{ color: '#8B7355', letterSpacing: '1px' }}>Esnek</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase whitespace-nowrap" style={{ color: '#8B7355', letterSpacing: '1px' }}>D.Yakın</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase whitespace-nowrap" style={{ color: '#8B7355', letterSpacing: '1px' }}>D.Manz.</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase" style={{ color: '#8B7355', letterSpacing: '1px' }}>Olmazsa Olmaz</th>
              <SortHeader label="Durum" col="durum" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Danışman" col="danisman" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Eklenme" col="created_at" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {musteriler.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12" style={{ color: '#8B7355' }}>Kayıt bulunamadı.</td></tr>
            ) : musteriler.map(m => {
              const editable = canEdit(m.eklendi_user_id);
              const showPhone = canSeePhone(m);
              return (
                <tr key={m.id} className="transition-colors" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF3E2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <td className="px-3 py-2.5 overflow-hidden">
                    <button className="font-medium transition-colors text-left text-sm w-full truncate block" style={{ color: '#1A1A18' }} onClick={() => onSelect(m)}>
                      {m.ad} {maskSoyad(m.soyad, m)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs overflow-hidden">
                    {showPhone
                      ? (editable ? <EditCell value={m.telefon} onSave={v => onUpdate(m.id, 'telefon', v)} /> : <span style={{ color: '#1A1A18' }}>{m.telefon || '—'}</span>)
                      : <span className="flex items-center gap-1 tracking-widest" style={{ color: '#8B7355' }} title="Bu numarayı sadece kaydı oluşturan görebilir"><Lock size={10} className="shrink-0 opacity-60" />••• •••• ••••</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={m.butce_min || ''} onSave={v => onUpdate(m.id, 'butce_min', v)} /> : <span>{m.butce_min || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={m.butce_max || ''} onSave={v => onUpdate(m.id, 'butce_max', v)} /> : <span>{m.butce_max || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={m.muhit || ''} onSave={v => onUpdate(m.id, 'muhit', v)} /> : <span className="truncate block">{m.muhit || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {editable ? (
                      <button
                        onClick={() => onUpdate(m.id, 'bolge_esnek', !m.bolge_esnek)}
                        className="text-xs font-medium px-2 py-0.5 rounded-full transition-all"
                        style={m.bolge_esnek ? { background: 'rgba(34,160,90,0.15)', color: '#22A05A' } : { background: '#F5F0E8', color: '#8B7355' }}
                      >
                        {m.bolge_esnek ? 'Evet' : 'Hayır'}
                      </button>
                    ) : <span className="text-xs" style={{ color: '#8B7355' }}>{m.bolge_esnek ? 'Evet' : 'Hayır'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-bold" style={{ color: m.denize_yakin ? '#22A05A' : '#D4C9B8' }} title="Denize Yakın">
                      {m.denize_yakin ? '🌊' : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-bold" style={{ color: m.deniz_manzarasi ? '#534AB7' : '#D4C9B8' }} title="Deniz Manzarası">
                      {m.deniz_manzarasi ? '🌅' : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden">
                    <DescriptionCell value={m.olmaz_olmaz || ''} label="Olmazsa Olmaz" onEdit={editable ? () => onSelect(m) : undefined} />
                  </td>
                  <td className="px-3 py-2.5">
                    <MusteriStatusBadge durum={m.durum} />
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap overflow-hidden" style={{ color: '#8B7355' }}>
                    <span className="truncate block">{m.eklendi_user_ad || m.danisman || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#8B7355' }}>
                    {new Date(m.created_at).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-content max-w-xl" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Müşteri Havuzuna Ekle</h2>
              <button onClick={() => setShowAdd(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Ad</label><input className="input" value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} required /></div>
                  <div><label className="label">Soyad</label><input className="input" value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} /></div>
                  <div><label className="label">Telefon</label><input className="input" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} /></div>
                  <div><label className="label">Tercih Bölge</label><input className="input" value={form.muhit} onChange={e => setForm(f => ({ ...f, muhit: e.target.value }))} /></div>
                  <div><label className="label">Bütçe Min (TL)</label><input className="input" type="number" value={form.butce_min} onChange={e => setForm(f => ({ ...f, butce_min: e.target.value }))} /></div>
                  <div><label className="label">Bütçe Max (TL)</label><input className="input" type="number" value={form.butce_max} onChange={e => setForm(f => ({ ...f, butce_max: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <Toggle value={form.bolge_esnek} onChange={() => setForm(f => ({ ...f, bolge_esnek: !f.bolge_esnek }))} />
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Bölge Esnek?</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle value={form.denize_yakin} onChange={() => setForm(f => ({ ...f, denize_yakin: !f.denize_yakin }))} />
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Denize Yakın</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle value={form.deniz_manzarasi} onChange={() => setForm(f => ({ ...f, deniz_manzarasi: !f.deniz_manzarasi }))} />
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Deniz Manzarası</span>
                  </div>
                </div>
                <div><label className="label">Olmazsa Olmaz İstekler</label><input className="input" placeholder="ör. mutlaka deniz manzarası" value={form.olmaz_olmaz} onChange={e => setForm(f => ({ ...f, olmaz_olmaz: e.target.value }))} /></div>
                <div>
                  <label className="label">Açıklama</label>
                  <textarea className="input h-20 resize-none" placeholder="Müşteri hakkında notlar..." value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Durum</label>
                  <select className="input" value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value as MusteriDurum }))}>
                    {MUSTERI_DURUM_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#F5F0E8', color: '#1A1A18' }}>
                  <span className="text-xs" style={{ color: '#8B7355' }}>Danışman: </span>{danismanAdi}
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowAdd(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button onClick={save} disabled={saving || !form.ad} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Portföy Table ────────────────────────────────────────────────────────────

function PortfoyTable({
  portfoyler, search, onSearch, sortCol, sortDir, onSort, onUpdate, onSelect, danismanAdi, onReload, onHistory, canEdit, canSeePhone, maskSoyad, maskPhone,
}: {
  portfoyler: Portfoy[];
  search: string;
  onSearch: (v: string) => void;
  sortCol: string;
  sortDir: SortDir;
  onSort: (c: string) => void;
  onUpdate: (id: string, field: string, value: string | boolean, old?: string) => void;
  onSelect: (p: Portfoy) => void;
  danismanAdi: string;
  onReload: () => void;
  onHistory: (p: Portfoy) => void;
  canEdit: (eklendi_user_id?: string) => boolean;
  canSeePhone: (record: { eklendi_user_id?: string }) => boolean;
  maskSoyad: (soyad: string | null | undefined, record: { eklendi_user_id?: string }) => string;
  maskPhone: (phone: string | null | undefined, record: { eklendi_user_id?: string }) => string;
}) {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    isim: '', bolge: '', fiyat: '', tip: 'daire' as PortfoyTip,
    oda: '', metrekare: '', durum_bina: '', aciklama: '',
    denize_yakin: false, deniz_manzarasi: false,
  });

  const save = async () => {
    if (!form.isim) return;
    setSaving(true);
    const { error } = await supabase.from('portfoyler').insert({
      ...form,
      danisman: danismanAdi,
      eklendi_user_id: effectiveUser?.username || '',
      eklendi_user_ad: danismanAdi,
      sahip_ad: '', sahip_soyad: '', tc: '', sahip_tel: '', il: 'İzmir', ilce: 'Çeşme',
      mahalle: form.bolge, ada: '', parsel: '', kat: '', isitma: '',
      portfoy_durum: 'kararsiz' as PortfoyDurum, baska_emlakci: false, ilan_no: '', ilan_portal: '',
      kapak_foto: '',
    });
    if (error) toast('Hata oluştu.', 'error');
    else { toast('Portföy eklendi.'); setShowAdd(false); onReload(); }
    setSaving(false);
  };

  const tipColors: Record<PortfoyTip, string> = {
    daire: 'bg-blue-500/10 text-blue-400',
    villa: 'bg-yellow-500/10 text-yellow-400',
    ticari: 'bg-orange-500/10 text-orange-400',
    arsa: 'bg-green-500/10 text-green-400',
  };

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'rgba(253,243,227,0.97)', backdropFilter: 'blur(8px)' }}>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: '#8B7355' }} />
          <input className="input pl-8 py-2 text-sm" placeholder="Ara: başlık, bölge, danışman..." value={search} onChange={e => onSearch(e.target.value)} />
          {search && <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: '#8B7355' }}><X size={13} /></button>}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-gold"><Plus size={14} />Portföy Ekle</button>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: 'fixed', minWidth: 1000, width: '100%' }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: 180 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#1A1A18', borderBottom: '0.5px solid #F6D9A8' }}>
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase" style={{ color: '#8B7355', letterSpacing: '1px' }}>Foto</th>
              <SortHeader label="İlan Başlığı" col="isim" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Bölge" col="bolge" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Fiyat" col="fiyat" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Tip" col="tip" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Oda" col="oda" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="m²" col="metrekare" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Bina Yaşı" col="durum_bina" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase whitespace-nowrap" style={{ color: '#8B7355', letterSpacing: '1px' }}>D.Yakın</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase whitespace-nowrap" style={{ color: '#8B7355', letterSpacing: '1px' }}>D.Manz.</th>
              <SortHeader label="Danışman" col="danisman" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Eklenme" col="created_at" sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
              <th className="text-left px-3 py-2.5 font-medium text-xs uppercase" style={{ color: '#8B7355', letterSpacing: '1px' }}></th>
            </tr>
          </thead>
          <tbody>
            {portfoyler.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-12" style={{ color: '#8B7355' }}>Kayıt bulunamadı.</td></tr>
            ) : portfoyler.map(p => {
              const editable = canEdit(p.eklendi_user_id);
              const showPhone = canSeePhone(p);
              return (
                <tr key={p.id} className="transition-colors" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF3E2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <td className="px-3 py-2">
                    {p.kapak_foto ? (
                      <img src={p.kapak_foto} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F5F0E8', color: '#D4C9B8' }}>
                        <Building2 size={14} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 overflow-hidden">
                    <button className="font-medium transition-colors text-left text-sm w-full truncate block" style={{ color: '#1A1A18' }} onClick={() => onSelect(p)}>
                      {p.isim}
                    </button>
                    {p.ilan_url && (
                      <a href={p.ilan_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-[10px] flex items-center gap-0.5 hover:underline mt-0.5">
                        <ExternalLink size={9} />sahibinden
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden" style={{ color: '#1A1A18' }}>
                    {editable ? (
                      <EditCell value={p.bolge || ''} onSave={v => onUpdate(p.id, 'bolge', v)} type="select" options={CESME_BOLGELERI.map(b => ({ value: b, label: b }))} />
                    ) : <span className="truncate block">{p.bolge || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={p.fiyat || ''} onSave={v => onUpdate(p.id, 'fiyat', v, p.fiyat)} /> : <span className="truncate block">{p.fiyat || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${tipColors[p.tip]}`}>
                      {TIP_OPTIONS.find(t => t.value === p.tip)?.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={p.oda || ''} onSave={v => onUpdate(p.id, 'oda', v)} type="select" options={ODA_OPTIONS.map(o => ({ value: o, label: o }))} /> : <span>{p.oda || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={p.metrekare || ''} onSave={v => onUpdate(p.id, 'metrekare', v)} /> : <span>{p.metrekare || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#1A1A18' }}>
                    {editable ? <EditCell value={p.durum_bina || ''} onSave={v => onUpdate(p.id, 'durum_bina', v)} type="select" options={YAS_OPTIONS.map(o => ({ value: o, label: o }))} /> : <span>{p.durum_bina || '—'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm" style={{ color: p.denize_yakin ? '#22A05A' : '#D4C9B8' }} title="Denize Yakın">{p.denize_yakin ? '🌊' : '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm" style={{ color: p.deniz_manzarasi ? '#534AB7' : '#D4C9B8' }} title="Deniz Manzarası">{p.deniz_manzarasi ? '🌅' : '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs overflow-hidden" style={{ color: '#8B7355' }}>
                    <span className="truncate block">{p.eklendi_user_ad || p.danisman || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#8B7355' }}>
                    {new Date(p.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => onHistory(p)} className="transition-colors p-1 rounded" style={{ color: '#8B7355' }} title="Değişiklik geçmişi">
                      <History size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-content max-w-xl" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Portföy Havuzuna Ekle</h2>
              <button onClick={() => setShowAdd(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div><label className="label">İlan Başlığı</label><input className="input" value={form.isim} onChange={e => setForm(f => ({ ...f, isim: e.target.value }))} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Bölge</label>
                    <select className="input" value={form.bolge} onChange={e => setForm(f => ({ ...f, bolge: e.target.value }))}>
                      <option value="">Seçin</option>
                      {CESME_BOLGELERI.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tip</label>
                    <select className="input" value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value as PortfoyTip }))}>
                      {TIP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Fiyat</label><input className="input" placeholder="ör. 3.500.000 TL" value={form.fiyat} onChange={e => setForm(f => ({ ...f, fiyat: e.target.value }))} /></div>
                  <div>
                    <label className="label">Oda</label>
                    <select className="input" value={form.oda} onChange={e => setForm(f => ({ ...f, oda: e.target.value }))}>
                      <option value="">Seçin</option>
                      {ODA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div><label className="label">m²</label><input className="input" value={form.metrekare} onChange={e => setForm(f => ({ ...f, metrekare: e.target.value }))} /></div>
                  <div>
                    <label className="label">Bina Yaşı</label>
                    <select className="input" value={form.durum_bina} onChange={e => setForm(f => ({ ...f, durum_bina: e.target.value }))}>
                      <option value="">Seçin</option>
                      {YAS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3">
                    <Toggle value={form.denize_yakin} onChange={() => setForm(f => ({ ...f, denize_yakin: !f.denize_yakin }))} />
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Denize Yakın</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle value={form.deniz_manzarasi} onChange={() => setForm(f => ({ ...f, deniz_manzarasi: !f.deniz_manzarasi }))} />
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Deniz Manzarası</span>
                  </div>
                </div>
                <div><label className="label">Açıklama</label><textarea className="input h-20 resize-none" value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} /></div>
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#F5F0E8', color: '#1A1A18' }}>
                  <span className="text-xs" style={{ color: '#8B7355' }}>Danışman: </span>{danismanAdi}
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowAdd(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button onClick={save} disabled={saving || !form.isim} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Müşteri Detail Modal ─────────────────────────────────────────────────────

function MusteriDetailModal({ musteri, onClose, onUpdate, maskSoyad, maskPhone }: {
  musteri: Musteri;
  onClose: () => void;
  onUpdate: (id: string, field: string, value: string | boolean) => void;
  maskSoyad: (soyad: string | null | undefined, record: { eklendi_user_id?: string }) => string;
  maskPhone: (phone: string | null | undefined, record: { eklendi_user_id?: string }) => string;
}) {
  const phoneVisible = !!maskPhone(musteri.telefon, musteri);
  return (
    <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
          <div>
            <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{musteri.ad} {maskSoyad(musteri.soyad, musteri)}</h2>
            <MusteriStatusBadge durum={musteri.durum} />
          </div>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <div className="modal-body p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>Telefon</p>
              {phoneVisible
                ? <p className="font-mono" style={{ color: '#1A1A18' }}>{musteri.telefon || '—'}</p>
                : <p className="flex items-center gap-1 font-mono" style={{ color: '#8B7355' }} title="Bu numarayı sadece kaydı oluşturan görebilir"><Lock size={11} className="shrink-0" />••• •••• ••••</p>
              }
            </div>
            {[
              ['Danışman', musteri.danisman],
              ['Bütçe Min', musteri.butce_min],
              ['Bütçe Max', musteri.butce_max],
              ['Tercih Bölge', musteri.muhit],
              ['Bölge Esnek', musteri.bolge_esnek ? 'Evet' : 'Hayır'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>{label}</p>
                <p style={{ color: '#1A1A18' }}>{value || '—'}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <span className="text-lg">🌊</span>
              <span className="text-sm" style={{ color: '#1A1A18' }}>Denize Yakın: <span style={{ color: musteri.denize_yakin ? '#22A05A' : '#8B7355', fontWeight: musteri.denize_yakin ? 600 : 400 }}>{musteri.denize_yakin ? 'Evet' : 'Hayır'}</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <span className="text-lg">🌅</span>
              <span className="text-sm" style={{ color: '#1A1A18' }}>Deniz Manzarası: <span style={{ color: musteri.deniz_manzarasi ? '#534AB7' : '#8B7355', fontWeight: musteri.deniz_manzarasi ? 600 : 400 }}>{musteri.deniz_manzarasi ? 'Evet' : 'Hayır'}</span></span>
            </div>
          </div>
          {musteri.olmaz_olmaz && (
            <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Olmazsa Olmaz İstekler</p>
              <p className="text-sm" style={{ color: '#1A1A18' }}>{musteri.olmaz_olmaz}</p>
            </div>
          )}
          {musteri.kesin_istekler && (
            <div className="rounded-lg p-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <p className="text-xs mb-1 font-medium" style={{ color: '#D4AF37' }}>Kesin İstekler (AI için)</p>
              <p className="text-sm" style={{ color: '#1A1A18' }}>{musteri.kesin_istekler}</p>
            </div>
          )}
          {musteri.aciklama && (
            <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Açıklama</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A18' }}>{musteri.aciklama}</p>
            </div>
          )}
          <p className="text-xs" style={{ color: '#8B7355' }}>Eklenme: {new Date(musteri.created_at).toLocaleString('tr-TR')}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Portföy Detail Modal ─────────────────────────────────────────────────────

function PortfoyDetailModal({ portfoy, onClose, onUpdate, onHistory, maskSoyad, maskPhone }: {
  portfoy: Portfoy;
  onClose: () => void;
  onUpdate: (id: string, field: string, value: string | boolean, old?: string) => void;
  onHistory: () => void;
  maskSoyad: (soyad: string | null | undefined, record: { eklendi_user_id?: string }) => string;
  maskPhone: (phone: string | null | undefined, record: { eklendi_user_id?: string }) => string;
}) {
  const phoneVisible = !!maskPhone(portfoy.sahip_tel, portfoy);
  const tipColors: Record<PortfoyTip, string> = {
    daire: 'bg-blue-500/10 text-blue-400',
    villa: 'bg-yellow-500/10 text-yellow-400',
    ticari: 'bg-orange-500/10 text-orange-400',
    arsa: 'bg-green-500/10 text-green-400',
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${tipColors[portfoy.tip]}`}>
              {TIP_OPTIONS.find(t => t.value === portfoy.tip)?.label}
            </span>
            <PortfoyStatusBadge durum={portfoy.portfoy_durum} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onHistory} className="btn-ghost py-1.5 px-3 text-xs"><History size={13} />Geçmiş</button>
            <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
          </div>
        </div>
        <div className="modal-body p-5 space-y-4">
          {portfoy.kapak_foto && <img src={portfoy.kapak_foto} alt={portfoy.isim} className="w-full h-44 object-cover rounded-xl" />}
          <div>
            <h2 className="text-xl font-semibold" style={{ color: '#1A1A18' }}>{portfoy.isim}</h2>
            <p className="text-2xl font-bold mt-0.5" style={{ color: '#D4AF37' }}>{portfoy.fiyat}</p>
            {portfoy.bolge && <p className="text-sm mt-0.5" style={{ color: '#8B7355' }}>{portfoy.bolge}</p>}
          </div>
          {portfoy.ilan_url && (
            <a
              href={portfoy.ilan_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'rgba(34,160,90,0.08)', border: '1px solid rgba(34,160,90,0.3)', color: '#22A05A' }}
            >
              <ExternalLink size={15} />
              Sahibinden'de Gör
            </a>
          )}
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <span className="text-lg">🌊</span>
              <span className="text-sm" style={{ color: '#1A1A18' }}>Denize Yakın: <span style={{ color: portfoy.denize_yakin ? '#22A05A' : '#8B7355', fontWeight: portfoy.denize_yakin ? 600 : 400 }}>{portfoy.denize_yakin ? 'Evet' : 'Hayır'}</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <span className="text-lg">🌅</span>
              <span className="text-sm" style={{ color: '#1A1A18' }}>Deniz Manzarası: <span style={{ color: portfoy.deniz_manzarasi ? '#534AB7' : '#8B7355', fontWeight: portfoy.deniz_manzarasi ? 600 : 400 }}>{portfoy.deniz_manzarasi ? 'Evet' : 'Hayır'}</span></span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              ['Oda', portfoy.oda],
              ['m²', portfoy.metrekare ? `${portfoy.metrekare} m²` : ''],
              ['Bina Yaşı', portfoy.durum_bina],
              ['Kat', portfoy.kat],
              ['Danışman', portfoy.danisman],
            ].map(([label, value]) => value ? (
              <div key={label} className="rounded-lg p-2.5" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                <p className="text-xs" style={{ color: '#8B7355' }}>{label}</p>
                <p className="text-sm" style={{ color: '#1A1A18' }}>{value}</p>
              </div>
            ) : null)}
            <div className="rounded-lg p-2.5" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }} key="sahip_tel">
              <p className="text-xs" style={{ color: '#8B7355' }}>Sahip Tel</p>
              {phoneVisible
                ? <p className="text-sm font-mono" style={{ color: '#1A1A18' }}>{portfoy.sahip_tel || '—'}</p>
                : <p className="flex items-center gap-1 text-xs font-mono" style={{ color: '#8B7355' }} title="Bu numarayı sadece kaydı oluşturan görebilir"><Lock size={10} className="shrink-0" />••• ••••</p>
              }
            </div>
          </div>
          {portfoy.aciklama && (
            <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
              <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Açıklama</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A18' }}>{portfoy.aciklama}</p>
            </div>
          )}
          <p className="text-xs" style={{ color: '#8B7355' }}>Eklenme: {new Date(portfoy.created_at).toLocaleString('tr-TR')}</p>
        </div>
      </div>
    </div>
  );
}
