import { useState, useEffect, useCallback } from 'react';
import { Plus, Instagram as InstagramIcon, X, Loader2, ExternalLink, Trash2, MapPin, Tag, Upload, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { InstagramIlan, isGuest } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

type FormState = {
  url: string;
  baslik: string;
  fiyat: string;
  bolge: string;
  aciklama: string;
  foto_url: string;
  ada: string;
  parsel: string;
};

function emptyForm(): FormState {
  return { url: '', baslik: '', fiyat: '', bolge: '', aciklama: '', foto_url: '', ada: '', parsel: '' };
}

const BUCKET = 'instagram-fotograflar';

export default function Instagram() {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici' || effectiveUser?.username === 'superadmin';
  const isGuestUser = isGuest(effectiveUser?.rol);

  const [ilanlar, setIlanlar] = useState<InstagramIlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<InstagramIlan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('instagram_ilanlar')
      .select('*')
      .order('created_at', { ascending: false });
    setIlanlar(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = ilanlar.filter(i => {
    const q = search.toLowerCase();
    return (
      (i.baslik || '').toLowerCase().includes(q) ||
      (i.bolge || '').toLowerCase().includes(q) ||
      (i.fiyat || '').toLowerCase().includes(q) ||
      (i.aciklama || '').toLowerCase().includes(q)
    );
  });

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const canModify = (_ilan: InstagramIlan) => isAdmin;

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (ilan: InstagramIlan) => {
    setEditItem(ilan);
    setForm({
      url: ilan.url || '',
      baslik: ilan.baslik || '',
      fiyat: ilan.fiyat || '',
      bolge: ilan.bolge || '',
      aciklama: ilan.aciklama || '',
      foto_url: ilan.foto_url || '',
      ada: ilan.ada || '',
      parsel: ilan.parsel || '',
    });
    setShowForm(true);
  };

  const ensureBucket = async () => {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some(b => b.id === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, allowedMimeTypes: ['image/*'], fileSizeLimit: 10485760 });
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      await ensureBucket();
      // Resize via canvas
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          const img = document.createElement('img');
          img.onload = () => {
            let w = img.naturalWidth, h = img.naturalHeight;
            const maxW = 1200, maxH = 1200;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
              if (!blob) { reject(new Error('Blob failed')); return; }
              const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              supabase.storage.from(BUCKET).upload(fileName, blob, { contentType: 'image/jpeg', upsert: true, duplex: 'half' } as any)
                .then(({ error: uploadErr }) => {
                  if (uploadErr) { reject(uploadErr); return; }
                  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
                  resolve(urlData.publicUrl);
                });
            }, 'image/jpeg', 0.85);
          };
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });
      setF({ foto_url: url });
      toast('Fotoğraf yüklendi.');
    } catch (err) {
      toast('Fotoğraf yüklenemedi.', 'error');
      console.error(err);
    }
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.url.trim()) { toast('URL zorunludur.', 'error'); return; }
    if (!form.foto_url && !editItem?.foto_url) { toast('Fotoğraf zorunludur.', 'error'); return; }
    if (!form.ada.trim()) { toast('Ada no zorunludur.', 'error'); return; }
    if (!form.parsel.trim()) { toast('Parsel no zorunludur.', 'error'); return; }
    setSaving(true);

    const payload = {
      url: form.url.trim(),
      baslik: form.baslik.trim() || null,
      fiyat: form.fiyat.trim() || null,
      bolge: form.bolge.trim() || null,
      aciklama: form.aciklama.trim() || null,
      foto_url: form.foto_url || null,
      ada: form.ada.trim() || null,
      parsel: form.parsel.trim() || null,
    };

    if (editItem) {
      const { error } = await supabase.from('instagram_ilanlar').update(payload).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else toast('İlan güncellendi.');
    } else {
      const { error } = await supabase.from('instagram_ilanlar').insert({
        ...payload,
        eklendi_user_id: effectiveUser?.username || null,
        eklendi_user_ad: danismanAdi || null,
      });
      if (error) toast('Hata oluştu.', 'error'); else toast('İlan eklendi.');
    }

    setSaving(false);
    setShowForm(false);
    setEditItem(null);
    setForm(emptyForm());
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Bu ilanı silmek istiyor musunuz?')) return;
    await supabase.from('instagram_ilanlar').delete().eq('id', id);
    toast('İlan silindi.');
    load();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 shrink-0 flex items-center gap-3" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
            <InstagramIcon size={16} color="white" />
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              className="input pl-4"
              placeholder="İlan ara: başlık, bölge, fiyat..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn-gold shrink-0">
            <Plus size={16} />
            İlan Ekle
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 shrink-0 flex items-center gap-4" style={{ background: '#FDF3E3', borderBottom: '0.5px solid #F6D9A8' }}>
        <span className="text-sm" style={{ color: '#8B7355' }}>
          <span className="font-semibold" style={{ color: '#1A1A18' }}>{filtered.length}</span> ilan
          {search && ` · "${search}" araması`}
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(240,148,51,0.15), rgba(188,24,136,0.15))', border: '1px solid rgba(188,24,136,0.25)' }}
            >
              <InstagramIcon size={28} style={{ color: 'rgba(240,148,51,0.7)' }} />
            </div>
            <div className="text-center">
              <p className="font-medium mb-1" style={{ color: '#1A1A18' }}>{search ? 'Arama sonucu bulunamadı.' : 'Henüz ilan eklenmemiş.'}</p>
              {!search && (
                <p className="text-sm" style={{ color: '#8B7355' }}>
                  Instagram ilanlarını buradan takip edin.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(ilan => (
              <IlanCard
                key={ilan.id}
                ilan={ilan}
                canModify={canModify(ilan)}
                onEdit={() => openEdit(ilan)}
                onRemove={() => remove(ilan.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-lg" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f09433, #bc1888)' }}>
                  <InstagramIcon size={15} color="white" />
                </div>
                <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>
                  {editItem ? 'İlanı Düzenle' : 'Yeni Instagram İlanı'}
                </h2>
              </div>
              <button onClick={() => { setShowForm(false); setEditItem(null); }} style={{ color: '#8B7355' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">

                {/* Photo upload */}
                <div>
                  <label className="label">
                    Fotoğraf <span style={{ color: '#FF4060' }}>*</span>
                  </label>
                  {form.foto_url ? (
                    <div className="relative rounded-xl overflow-hidden mb-2" style={{ height: '200px' }}>
                      <img src={form.foto_url} alt="Önizleme" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setF({ foto_url: '' })}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        <X size={14} />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <label
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                          style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)' }}
                        >
                          <Upload size={11} />
                          Değiştir
                          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ borderColor: 'rgba(212,175,55,0.4)', background: 'rgba(212,175,55,0.04)' }}
                    >
                      {uploading ? (
                        <Loader2 className="animate-spin" size={24} style={{ color: 'rgba(212,175,55,0.6)' }} />
                      ) : (
                        <Upload size={24} style={{ color: 'rgba(212,175,55,0.5)' }} />
                      )}
                      <span className="text-sm" style={{ color: '#8B7355' }}>
                        {uploading ? 'Yükleniyor...' : 'Fotoğraf yüklemek için tıkla'}
                      </span>
                      <span className="text-xs" style={{ color: '#D4C9B8' }}>JPG, PNG · max 5MB</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="label">Instagram URL <span style={{ color: '#FF4060' }}>*</span></label>
                  <input
                    className="input"
                    placeholder="https://www.instagram.com/p/..."
                    value={form.url}
                    onChange={e => setF({ url: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Ada No <span style={{ color: '#FF4060' }}>*</span></label>
                    <input className="input" placeholder="ör. 4234" value={form.ada} onChange={e => setF({ ada: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Parsel No <span style={{ color: '#FF4060' }}>*</span></label>
                    <input className="input" placeholder="ör. 5" value={form.parsel} onChange={e => setF({ parsel: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Başlık</label>
                    <input className="input" placeholder="İlan başlığı" value={form.baslik} onChange={e => setF({ baslik: e.target.value })} />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1"><Tag size={12} />Fiyat</label>
                    <input className="input" placeholder="ör. 12.000.000 TL" value={form.fiyat} onChange={e => setF({ fiyat: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="label flex items-center gap-1"><MapPin size={12} />Bölge</label>
                  <input className="input" placeholder="ör. Alaçatı, Çeşme" value={form.bolge} onChange={e => setF({ bolge: e.target.value })} />
                </div>

                <div>
                  <label className="label">Açıklama</label>
                  <textarea
                    className="input h-24 resize-none"
                    placeholder="İlan hakkında notlar..."
                    value={form.aciklama}
                    onChange={e => setF({ aciklama: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving || uploading} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : (editItem ? 'Güncelle' : 'Ekle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface IlanCardProps {
  ilan: InstagramIlan;
  canModify: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

function IlanCard({ ilan, canModify, onEdit, onRemove }: IlanCardProps) {
  const displayPhoto = ilan.foto_url;

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] flex flex-col"
      style={{
        background: 'white',
        border: '0.5px solid #F6D9A8',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Photo */}
      <div className="relative overflow-hidden shrink-0" style={{ height: '250px', background: '#FDF3E3' }}>
        {displayPhoto ? (
          <img
            src={displayPhoto}
            alt={ilan.baslik || 'Instagram ilanı'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f09433, #bc1888)' }}>
              <InstagramIcon size={24} color="white" />
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Instagram badge */}
        <div className="absolute top-3 left-3">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
            <InstagramIcon size={13} color="white" />
          </div>
        </div>

        {/* Action buttons (owner/admin only) */}
        {canModify && (
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }}
              title="Düzenle"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onRemove}
              className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,60,80,0.15)', color: '#FF3C50', border: '1px solid rgba(255,60,80,0.3)' }}
              title="Sil"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        {/* Price */}
        {ilan.fiyat && (
          <div className="absolute bottom-3 left-3">
            <span className="text-sm font-bold" style={{ color: '#D4AF37', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {ilan.fiyat}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        {(ilan.ada || ilan.parsel) && (
          <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md self-start" style={{ background: 'rgba(240,148,51,0.12)', color: 'rgba(240,148,51,0.9)', border: '1px solid rgba(240,148,51,0.2)' }}>
            {ilan.ada && ilan.parsel ? `${ilan.ada}/${ilan.parsel}` : ilan.ada || ilan.parsel}
          </div>
        )}
        {ilan.baslik && (
          <h3 className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: '#1A1A18' }}>{ilan.baslik}</h3>
        )}
        {ilan.bolge && (
          <p className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}>
            <MapPin size={11} />
            {ilan.bolge}
          </p>
        )}
        {ilan.aciklama && (
          <p className="text-xs leading-relaxed line-clamp-3 flex-1" style={{ color: '#8B7355' }}>
            {ilan.aciklama}
          </p>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-2 mt-auto" style={{ borderTop: '0.5px solid #F6D9A8' }}>
          <span className="text-[10px] truncate max-w-[45%]" style={{ color: '#8B7355' }}>
            {ilan.eklendi_user_ad || '—'}
          </span>
          <a
            href={ilan.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))', color: '#8B7355', border: '0.5px solid #F6D9A8' }}
          >
            <ExternalLink size={11} />
            Instagram'da Gör
          </a>
        </div>
      </div>
    </div>
  );
}
