import { useState, useEffect } from 'react';
import { Plus, Instagram as InstagramIcon, Copy, Download, Sparkles, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { callClaude } from '../lib/claude';
import { displayPrice } from '../components/PriceInput';
import type { Portfoy } from '../types';

interface IlanForm {
  portfoy_id: string;
  baslik: string;
  aciklama: string;
  hashtagler: string;
  foto_url: string;
}

export default function Instagram() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [portfolios, setPortfolios] = useState<Portfoy[]>([]);
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<IlanForm>({ portfoy_id: '', baslik: '', aciklama: '', hashtagler: '', foto_url: '' });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('portfoyler').select('*').then(({ data }) => setPortfolios(data || []));
    loadIlanlar();
  }, []);

  const loadIlanlar = async () => {
    setLoading(true);
    const { data } = await supabase.from('instagram_ilanlar').select('*').order('created_at', { ascending: false });
    setIlanlar(data || []);
    setLoading(false);
  };

  const selectedPortfoy = portfolios.find(p => p.id === form.portfoy_id);

  const generateCaption = async () => {
    if (!selectedPortfoy) { toast('Önce portföy seçin.', 'error'); return; }
    setGenerating(true);
    const prompt = `Türkçe Instagram ilanı yaz. Portföy: "${selectedPortfoy.isim}" - ${selectedPortfoy.tip}, ${selectedPortfoy.oda} oda, ${selectedPortfoy.metrekare}m², ${[selectedPortfoy.mahalle, selectedPortfoy.bolge].filter(Boolean).join(' ')}, ${displayPrice(selectedPortfoy.fiyat, selectedPortfoy.para_birimi)}. ${selectedPortfoy.deniz_manzarasi ? 'Deniz manzaralı.' : ''} ${selectedPortfoy.havuz ? 'Havuzlu.' : ''}
Çıktı:
1. Kısa etkileyici başlık (maksimum 10 kelime)
2. 3-4 cümle açıklama (emoji kullan)
3. 15 adet ilgili hashtag (#çeşme #çeşmevillası gibi)
Format: BASLIK: ... / ACIKLAMA: ... / HASHTAGLER: ...`;
    const answer = await callClaude(prompt, 500);
    const parts = answer.split('/');
    const baslik = parts.find(p => p.includes('BASLIK:'))?.replace('BASLIK:', '').trim() || '';
    const aciklama = parts.find(p => p.includes('ACIKLAMA:'))?.replace('ACIKLAMA:', '').trim() || '';
    const hashtagler = parts.find(p => p.includes('HASHTAGLER:'))?.replace('HASHTAGLER:', '').trim() || '';
    setForm(f => ({ ...f, baslik: baslik || selectedPortfoy.isim, aciklama: aciklama || '', hashtagler: hashtagler || '' }));
    if (selectedPortfoy.foto_url?.[0]) setForm(f => ({ ...f, foto_url: selectedPortfoy.foto_url![0] }));
    setGenerating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.baslik.trim()) { toast('Başlık zorunludur.', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('instagram_ilanlar').insert({ ...form, olusturan_id: user?.id });
    if (error) toast(error.message, 'error');
    else { toast('İlan kaydedildi.', 'success'); setShowModal(false); loadIlanlar(); }
    setSaving(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast('Kopyalandı!', 'success'));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('instagram_ilanlar').delete().eq('id', deleteId);
    toast('İlan silindi.', 'success');
    loadIlanlar();
    setDeleteId(null);
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18', display: 'flex', alignItems: 'center', gap: 10 }}>
            <InstagramIcon size={22} color="#E1306C" /> Instagram İlan Üretici
          </h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>AI destekli otomatik ilan oluşturucu</p>
        </div>
        <button onClick={() => { setForm({ portfoy_id: '', baslik: '', aciklama: '', hashtagler: '', foto_url: '' }); setShowModal(true); }} className="btn-gold">
          <Plus size={15} /> Yeni İlan
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {ilanlar.map(ilan => (
            <div key={ilan.id} style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
              {ilan.foto_url && (
                <img src={ilan.foto_url} alt={ilan.baslik} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <InstagramIcon size={14} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18' }}>derliestate</div>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>{new Date(ilan.created_at).toLocaleDateString('tr-TR')}</div>
                  </div>
                </div>
                <h4 style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18', marginBottom: 6 }}>{ilan.baslik}</h4>
                <p style={{ fontSize: 12, color: '#5A4A3A', lineHeight: 1.6, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ilan.aciklama}</p>
                {ilan.hashtagler && <p style={{ fontSize: 11, color: '#E1306C', lineHeight: 1.6 }}>{ilan.hashtagler}</p>}
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button onClick={() => copyToClipboard(`${ilan.baslik}\n\n${ilan.aciklama}\n\n${ilan.hashtagler}`)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}><Copy size={12} /> Kopyala</button>
                  <button onClick={() => setDeleteId(ilan.id)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #FFD0CC', background: 'transparent', color: '#FF3B2F', cursor: 'pointer' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
          {ilanlar.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: '#8B7355' }}>
              <InstagramIcon size={40} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
              <p>Henüz ilan oluşturulmadı</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold" style={{ color: '#1A1A18' }}>Yeni Instagram İlanı</h2>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">Portföy Seç</label>
                  <select value={form.portfoy_id} onChange={e => setForm(f => ({ ...f, portfoy_id: e.target.value }))} className="input">
                    <option value="">Portföy seçin...</option>
                    {portfolios.map(p => <option key={p.id} value={p.id}>{p.isim}</option>)}
                  </select>
                </div>

                <button type="button" onClick={generateCaption} disabled={!form.portfoy_id || generating} className="btn-ghost">
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} color="#D4AF37" />}
                  AI ile İlan Oluştur
                </button>

                <div>
                  <label className="label">Başlık *</label>
                  <input value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Açıklama</label>
                  <textarea value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} className="input" rows={4} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className="label">Hashtagler</label>
                  <textarea value={form.hashtagler} onChange={e => setForm(f => ({ ...f, hashtagler: e.target.value }))} className="input" rows={2} style={{ resize: 'vertical' }} placeholder="#çeşme #emlak ..." />
                </div>
                <div>
                  <label className="label">Fotoğraf URL</label>
                  <input value={form.foto_url} onChange={e => setForm(f => ({ ...f, foto_url: e.target.value }))} className="input" placeholder="https://..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn-gold flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : 'Kaydet'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 360 }}>
            <div className="p-6 text-center">
              <Trash2 size={32} color="#FF3B2F" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontWeight: 700, color: '#1A1A18', marginBottom: 8 }}>İlanı Sil</h3>
              <p style={{ color: '#8B7355', fontSize: 13, marginBottom: 20 }}>Bu ilan kalıcı olarak silinecek.</p>
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
