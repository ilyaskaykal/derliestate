import { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Download, Trash2, Upload, Search, X, Loader2, File, Image, FileArchive } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { Belge } from '../types';

const KATEGORI_OPTIONS = ['sozlesme', 'tapu', 'vekaletname', 'kimlik', 'vergi', 'diger'];

export default function Belgeler() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [belgeler, setBelgeler] = useState<Belge[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('belgeler').select('*').order('created_at', { ascending: false });
    setBelgeler(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = belgeler.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.isim?.toLowerCase().includes(q) || b.aciklama?.toLowerCase().includes(q);
    const matchKategori = !kategoriFilter || b.kategori === kategoriFilter;
    return matchSearch && matchKategori;
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileName = `belgeler/${user?.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('belgeler').upload(fileName, file);
    if (error) { toast(error.message, 'error'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('belgeler').getPublicUrl(fileName);
    const { error: dbError } = await supabase.from('belgeler').insert({
      isim: file.name, dosya_url: urlData.publicUrl, dosya_tipi: file.type,
      boyut: file.size, yukleyen_id: user?.id, kategori: 'diger',
    });
    if (dbError) toast(dbError.message, 'error');
    else { toast('Belge yüklendi.', 'success'); load(); }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const belge = belgeler.find(b => b.id === deleteId);
    if (belge?.dosya_url) {
      const path = belge.dosya_url.split('/belgeler/')[1];
      if (path) await supabase.storage.from('belgeler').remove([`belgeler/${path}`]);
    }
    const { error } = await supabase.from('belgeler').delete().eq('id', deleteId);
    if (error) toast(error.message, 'error');
    else { toast('Belge silindi.', 'success'); load(); }
    setDeleteId(null);
  };

  const updateKategori = async (id: string, kategori: string) => {
    await supabase.from('belgeler').update({ kategori }).eq('id', id);
    load();
  };

  const getIcon = (type: string) => {
    if (type?.startsWith('image/')) return <Image size={20} color="#2563EB" />;
    if (type?.includes('pdf')) return <FileText size={20} color="#DC2626" />;
    if (type?.includes('zip') || type?.includes('rar')) return <FileArchive size={20} color="#D97706" />;
    return <File size={20} color="#6B7280" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Belgeler</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>{belgeler.length} belge</p>
        </div>
        <div>
          <input ref={fileRef} type="file" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} className="btn-gold" disabled={uploading}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Belge Yükle
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} color="#8B7355" />
          <input placeholder="Belge ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
        </div>
        <select value={kategoriFilter} onChange={e => setKategoriFilter(e.target.value)} className="input" style={{ width: 160 }}>
          <option value="">Tüm Kategoriler</option>
          {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        style={{ border: '2px dashed #D4C9B8', borderRadius: 12, padding: '24px', textAlign: 'center', marginBottom: 20, cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.background = '#FFFBEB'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D4C9B8'; e.currentTarget.style.background = 'transparent'; }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && fileRef.current) { const dt = new DataTransfer(); dt.items.add(file); fileRef.current.files = dt.files; fileRef.current.dispatchEvent(new Event('change', { bubbles: true })); } }}
      >
        <Upload size={24} color="#D4C9B8" style={{ margin: '0 auto 8px' }} />
        <p style={{ fontSize: 13, color: '#8B7355' }}>Dosyaları sürükleyin veya tıklayarak yükleyin</p>
        <p style={{ fontSize: 11, color: '#C4B5A5', marginTop: 4 }}>PDF, DOC, XLS, JPG, PNG ve daha fazlası</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8B7355' }}>
          <FileText size={40} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
          <p>Belge bulunamadı</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(b => (
            <div key={b.id} style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, background: '#FAF6EF', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getIcon(b.dosya_tipi || '')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.isim}</div>
                <div style={{ fontSize: 11, color: '#8B7355', marginTop: 2 }}>
                  {formatSize(b.boyut || 0)} · {new Date(b.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>
              <select value={b.kategori || 'diger'} onChange={e => updateKategori(b.id, e.target.value)} className="input" style={{ width: 130, fontSize: 11, padding: '4px 8px' }}>
                {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={b.dosya_url} download={b.isim} target="_blank" rel="noreferrer" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #F0E8D8', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#5A4A3A', textDecoration: 'none' }}>
                  <Download size={13} />
                </a>
                <button onClick={() => setDeleteId(b.id)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #FFD0CC', background: 'transparent', color: '#FF3B2F', cursor: 'pointer' }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 360 }}>
            <div className="p-6 text-center">
              <Trash2 size={32} color="#FF3B2F" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1A1A18', marginBottom: 8 }}>Belgeyi Sil</h3>
              <p style={{ color: '#8B7355', fontSize: 13, marginBottom: 20 }}>Bu belge kalıcı olarak silinecek.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleDelete} style={{ flex: 1, padding: '9px', background: '#FF3B2F', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Sil</button>
                <button onClick={() => setDeleteId(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
