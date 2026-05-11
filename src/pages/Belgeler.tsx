import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Loader2, FileText, Download, Upload, Trash2, Search, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Belge, Musteri, Portfoy } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const TUR_OPTIONS = [
  { value: 'satis_sozlesmesi', label: 'Satış Sözleşmesi' },
  { value: 'kira_sozlesmesi',  label: 'Kira Sözleşmesi' },
  { value: 'vekaletname',      label: 'Vekaletname' },
  { value: 'tapu',             label: 'Tapu' },
  { value: 'kimlik',           label: 'Kimlik' },
  { value: 'diger',            label: 'Diğer' },
];

const TUR_COLORS: Record<string, { color: string; bg: string }> = {
  satis_sozlesmesi: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  kira_sozlesmesi:  { color: '#64B5F6', bg: 'rgba(100,181,246,0.1)' },
  vekaletname:      { color: '#FFD700', bg: 'rgba(255,215,0,0.1)' },
  tapu:             { color: '#D4AF37', bg: 'rgba(212,175,55,0.1)' },
  kimlik:           { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  diger:            { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

function turLabel(v: string | null) {
  return TUR_OPTIONS.find(o => o.value === v)?.label ?? (v || 'Diğer');
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpiringSoon(d: string | null) {
  if (!d) return false;
  const diff = new Date(d).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(d: string | null) {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

interface BelgeFormState {
  baslik: string;
  tur: string;
  musteri_id: string;
  portfoy_id: string;
  imza_tarihi: string;
  gecerlilik_tarihi: string;
  notlar: string;
}

function emptyBelgeForm(): BelgeFormState {
  return { baslik: '', tur: 'diger', musteri_id: '', portfoy_id: '', imza_tarihi: '', gecerlilik_tarihi: '', notlar: '' };
}

interface Props {
  musteriId?: string;
  portfoyId?: string;
  compact?: boolean;
}

export default function BelgelerPage({ musteriId, portfoyId, compact = false }: Props) {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';
  const fileRef = useRef<HTMLInputElement>(null);

  const [belgeler, setBelgeler]       = useState<Belge[]>([]);
  const [musteriler, setMusteriler]   = useState<Musteri[]>([]);
  const [portfoyler, setPortfoyler]   = useState<Portfoy[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState<BelgeFormState>(emptyBelgeForm());
  const [uploadFile, setUploadFile]   = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [search, setSearch]           = useState('');
  const [filterTur, setFilterTur]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('belgeler').select('*').order('created_at', { ascending: false });
    if (musteriId)  q = q.eq('musteri_id', musteriId);
    if (portfoyId)  q = q.eq('portfoy_id', portfoyId);
    if (!isAdmin && !musteriId && !portfoyId && effectiveUser?.username) {
      q = q.eq('yuklendi_user', effectiveUser.username);
    }
    const [b, m, p] = await Promise.all([
      q,
      supabase.from('musteriler').select('id, ad, soyad'),
      supabase.from('portfoyler').select('id, isim'),
    ]);
    setBelgeler((b.data || []) as Belge[]);
    setMusteriler((m.data || []) as Musteri[]);
    setPortfoyler((p.data || []) as Portfoy[]);
    setLoading(false);
  }, [musteriId, portfoyId, isAdmin, effectiveUser?.username]);

  useEffect(() => { load(); }, [load]);

  const filtered = belgeler.filter(b => {
    if (filterTur && b.tur !== filterTur) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (b.baslik || '').toLowerCase().includes(q) || (b.notlar || '').toLowerCase().includes(q);
  });

  const openAdd = () => {
    setForm({ ...emptyBelgeForm(), musteri_id: musteriId || '', portfoy_id: portfoyId || '' });
    setUploadFile(null);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.baslik.trim()) { toast('Başlık gereklidir.', 'error'); return; }
    setUploading(true);

    let dosya_url: string | null = null;

    if (uploadFile) {
      const ext = uploadFile.name.split('.').pop() || 'pdf';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('belgeler')
        .upload(fileName, uploadFile, { contentType: uploadFile.type, upsert: true });
      if (uploadErr) {
        toast(`Dosya yükleme hatası: ${uploadErr.message}`, 'error');
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('belgeler').getPublicUrl(uploadData.path);
      dosya_url = urlData?.publicUrl || null;
    }

    const payload = {
      baslik: form.baslik.trim(),
      tur: form.tur || null,
      musteri_id: form.musteri_id || null,
      portfoy_id: form.portfoy_id || null,
      dosya_url,
      imza_tarihi: form.imza_tarihi || null,
      gecerlilik_tarihi: form.gecerlilik_tarihi || null,
      notlar: form.notlar || null,
      yuklendi_user: effectiveUser?.username || null,
    };

    const { error } = await supabase.from('belgeler').insert(payload);
    if (error) toast('Kayıt hatası: ' + error.message, 'error');
    else { toast('Belge eklendi.'); setShowForm(false); load(); }
    setUploading(false);
  };

  const remove = async (b: Belge) => {
    if (!confirm('Bu belgeyi silmek istiyor musunuz?')) return;
    if (b.dosya_url) {
      const path = b.dosya_url.split('/belgeler/').pop();
      if (path) await supabase.storage.from('belgeler').remove([path]);
    }
    await supabase.from('belgeler').delete().eq('id', b.id);
    toast('Belge silindi.');
    load();
  };

  const musteri = (id: string | null) => musteriler.find(m => m.id === id);
  const portfoy = (id: string | null) => portfoyler.find(p => p.id === id);

  return (
    <div className={compact ? '' : 'h-full flex flex-col'}>
      {/* Header — only in full page mode */}
      {!compact && (
        <div
          className="px-6 py-4 shrink-0 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: 'white', borderBottom: '1px solid #F6D9A8' }}
        >
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1A1A18' }}>
              <FileText size={18} style={{ color: '#D4AF37' }} />
              Belgeler
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>{belgeler.length} belge</p>
          </div>
          <button onClick={openAdd} className="btn-gold"><Plus size={16} />Belge Ekle</button>
        </div>
      )}

      {/* Filters — full page only */}
      {!compact && (
        <div className="px-6 py-2.5 shrink-0 flex items-center gap-2 flex-wrap" style={{ background: 'white', borderBottom: '1px solid #F6D9A8' }}>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={14} />
            <input className="input pl-8 text-xs" placeholder="Belge ara..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input text-xs w-44" value={filterTur} onChange={e => setFilterTur(e.target.value)}>
            <option value="">Tüm Türler</option>
            {TUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* Compact add button */}
      {compact && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium" style={{ color: '#1A1A18' }}>Belgeler ({belgeler.length})</span>
          <button onClick={openAdd} className="btn-gold text-xs py-1.5 px-3"><Plus size={13} />Belge Ekle</button>
        </div>
      )}

      {/* List */}
      <div className={compact ? '' : 'flex-1 overflow-auto px-4 md:px-6 py-4'}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-dark-400"><Loader2 className="animate-spin mr-2" size={18} />Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: '#8B7355' }}>
            <FileText size={28} />
            <p className="text-sm">Henüz belge eklenmemiş.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(b => {
              const tc = TUR_COLORS[b.tur || 'diger'] || TUR_COLORS.diger;
              const expiring = isExpiringSoon(b.gecerlilik_tarihi);
              const expired  = isExpired(b.gecerlilik_tarihi);
              const m = musteri(b.musteri_id);
              const p = portfoy(b.portfoy_id);

              return (
                <div
                  key={b.id}
                  className="rounded-xl p-3.5 flex items-start gap-3"
                  style={{
                    background: 'white',
                    border: expired ? '1px solid rgba(239,68,68,0.3)' : expiring ? '1px solid rgba(212,175,55,0.3)' : '0.5px solid #F6D9A8',
                  }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: tc.bg }}>
                    <FileCheck size={16} style={{ color: tc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-sm" style={{ color: '#1A1A18' }}>{b.baslik}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: tc.bg, color: tc.color }}>
                        {turLabel(b.tur)}
                      </span>
                      {expired && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Süresi Doldu</span>}
                      {expiring && !expired && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37' }}>Yakında Bitiyor</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: '#8B7355' }}>
                      {b.imza_tarihi && <span>İmza: {fmtDate(b.imza_tarihi)}</span>}
                      {b.gecerlilik_tarihi && <span>Bitiş: {fmtDate(b.gecerlilik_tarihi)}</span>}
                      <span>Yüklendi: {fmtDate(b.created_at)}</span>
                      {!compact && m && <span style={{ color: 'rgba(100,181,246,0.6)' }}>{m.ad} {m.soyad}</span>}
                      {!compact && p && <span style={{ color: 'rgba(255,215,0,0.5)' }}>{p.isim}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {b.dosya_url && (
                      <a
                        href={b.dosya_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                        style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
                      >
                        <Download size={12} />İndir
                      </a>
                    )}
                    <button
                      onClick={() => remove(b)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.06)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>Belge Ekle</h2>
              <button onClick={() => setShowForm(false)} className="text-dark-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div>
                  <label className="label">Başlık *</label>
                  <input className="input" placeholder="Belge adı" value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Belge Türü</label>
                  <select className="input" value={form.tur} onChange={e => setForm(f => ({ ...f, tur: e.target.value }))}>
                    {TUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Dosya Yükle (PDF / Görsel)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm transition-all"
                    style={{ borderColor: '#F6D9A8', color: uploadFile ? '#D4AF37' : '#8B7355' }}
                  >
                    <Upload size={16} />
                    {uploadFile ? uploadFile.name : 'Dosya seçin...'}
                  </button>
                </div>
                {!musteriId && (
                  <div>
                    <label className="label">Müşteri (opsiyonel)</label>
                    <select className="input" value={form.musteri_id} onChange={e => setForm(f => ({ ...f, musteri_id: e.target.value }))}>
                      <option value="">Seçin...</option>
                      {musteriler.map(m => <option key={m.id} value={m.id}>{m.ad} {m.soyad}</option>)}
                    </select>
                  </div>
                )}
                {!portfoyId && (
                  <div>
                    <label className="label">Portföy (opsiyonel)</label>
                    <select className="input" value={form.portfoy_id} onChange={e => setForm(f => ({ ...f, portfoy_id: e.target.value }))}>
                      <option value="">Seçin...</option>
                      {portfoyler.map(p => <option key={p.id} value={p.id}>{p.isim}</option>)}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">İmza Tarihi</label>
                    <input type="date" className="input" value={form.imza_tarihi} onChange={e => setForm(f => ({ ...f, imza_tarihi: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Geçerlilik Tarihi</label>
                    <input type="date" className="input" value={form.gecerlilik_tarihi} onChange={e => setForm(f => ({ ...f, gecerlilik_tarihi: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Notlar</label>
                  <textarea className="input h-16 resize-none" value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={uploading} className="btn-gold flex-1 justify-center">
                  {uploading ? <><Loader2 className="animate-spin" size={16} />Yükleniyor...</> : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
