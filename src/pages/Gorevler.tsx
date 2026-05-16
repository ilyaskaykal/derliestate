import { useState, useEffect } from 'react';
import { Plus, Search, X, Edit2, Trash2, CheckSquare, Clock, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isAdminLevel } from '../types';
import type { Gorev, GorevOncelik, GorevDurum } from '../types';

const ONCELIK_OPTIONS: GorevOncelik[] = ['dusuk', 'orta', 'yuksek', 'acil'];
const DURUM_OPTIONS: GorevDurum[] = ['bekliyor', 'devam_ediyor', 'tamamlandi', 'iptal'];

const ONCELIK_COLORS: Record<GorevOncelik, string> = {
  dusuk: '#6B7280',
  orta: '#D97706',
  yuksek: '#DC2626',
  acil: '#FF3B2F',
};

const DURUM_COLORS: Record<GorevDurum, string> = {
  bekliyor: '#D97706',
  devam_ediyor: '#2563EB',
  tamamlandi: '#059669',
  iptal: '#6B7280',
};

const EMPTY_FORM = {
  baslik: '', aciklama: '', oncelik: 'orta' as GorevOncelik, durum: 'bekliyor' as GorevDurum,
  son_tarih: '', atanan_id: '', musteri_id: '', portfoy_id: '',
};

export default function Gorevler() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Gorev[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [oncelikFilter, setOncelikFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Gorev | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [staff, setStaff] = useState<{ id: string; ad: string; soyad: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('gorevler').select('*').order('son_tarih', { ascending: true }).order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from('kullanicilar').select('id, ad, soyad').then(({ data }) => setStaff(data || []));
  }, []);

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.baslik?.toLowerCase().includes(q);
    const matchDurum = !durumFilter || t.durum === durumFilter;
    const matchOncelik = !oncelikFilter || t.oncelik === oncelikFilter;
    return matchSearch && matchDurum && matchOncelik;
  });

  const grouped = DURUM_OPTIONS.reduce<Record<GorevDurum, Gorev[]>>((acc, d) => {
    acc[d] = filtered.filter(t => t.durum === d);
    return acc;
  }, { bekliyor: [], devam_ediyor: [], tamamlandi: [], iptal: [] });

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowModal(true); };
  const openEdit = (t: Gorev) => {
    setEditing(t);
    setForm({ baslik: t.baslik || '', aciklama: t.aciklama || '', oncelik: t.oncelik || 'orta', durum: t.durum || 'bekliyor', son_tarih: t.son_tarih || '', atanan_id: t.atanan_id || '', musteri_id: t.musteri_id || '', portfoy_id: t.portfoy_id || '' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.baslik.trim()) { toast('Başlık zorunludur.', 'error'); return; }
    setSaving(true);
    const payload = { ...form, olusturan_id: user?.id };
    if (editing) {
      const { error } = await supabase.from('gorevler').update(payload).eq('id', editing.id);
      if (error) toast(error.message, 'error');
      else { toast('Görev güncellendi.', 'success'); setShowModal(false); load(); }
    } else {
      const { error } = await supabase.from('gorevler').insert(payload);
      if (error) toast(error.message, 'error');
      else { toast('Görev eklendi.', 'success'); setShowModal(false); load(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('gorevler').delete().eq('id', deleteId);
    if (error) toast(error.message, 'error');
    else { toast('Görev silindi.', 'success'); load(); }
    setDeleteId(null);
  };

  const quickStatus = async (id: string, durum: GorevDurum) => {
    await supabase.from('gorevler').update({ durum }).eq('id', id);
    load();
  };

  const isOverdue = (t: Gorev) => t.son_tarih && t.durum !== 'tamamlandi' && t.durum !== 'iptal' && new Date(t.son_tarih) < new Date();

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Görevler</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>{tasks.filter(t => t.durum === 'bekliyor').length} bekleyen görev</p>
        </div>
        <button onClick={openAdd} className="btn-gold"><Plus size={15} /> Yeni Görev</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} color="#8B7355" />
          <input placeholder="Görev ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
        </div>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="input" style={{ width: 150 }}>
          <option value="">Tüm Durumlar</option>
          {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
        </select>
        <select value={oncelikFilter} onChange={e => setOncelikFilter(e.target.value)} className="input" style={{ width: 130 }}>
          <option value="">Tüm Öncelikler</option>
          {ONCELIK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {DURUM_OPTIONS.filter(d => d !== 'iptal').map(durum => (
            <div key={durum} style={{ background: '#FAF6EF', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: DURUM_COLORS[durum] + '15', borderBottom: `2px solid ${DURUM_COLORS[durum]}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: DURUM_COLORS[durum], textTransform: 'capitalize' }}>{durum.replace('_', ' ')}</span>
                <span style={{ background: DURUM_COLORS[durum], color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{grouped[durum].length}</span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                {grouped[durum].map(t => (
                  <div key={t.id} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: `1px solid ${isOverdue(t) ? '#FFD0CC' : '#F0E8D8'}`, borderLeft: `3px solid ${ONCELIK_COLORS[t.oncelik]}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18', flex: 1 }}>{t.baslik}</h4>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Edit2 size={11} color="#8B7355" /></button>
                        {isAdminLevel(user?.rol) && <button onClick={() => setDeleteId(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><Trash2 size={11} color="#FF3B2F" /></button>}
                      </div>
                    </div>
                    {t.aciklama && <p style={{ fontSize: 11, color: '#8B7355', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.aciklama}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: ONCELIK_COLORS[t.oncelik] + '15', color: ONCELIK_COLORS[t.oncelik], fontWeight: 600 }}>{t.oncelik}</span>
                        {isOverdue(t) && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#FFD0CC', color: '#FF3B2F', fontWeight: 600 }}>Gecikmiş</span>}
                      </div>
                      {t.son_tarih && <span style={{ fontSize: 10, color: isOverdue(t) ? '#FF3B2F' : '#8B7355', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} />{new Date(t.son_tarih).toLocaleDateString('tr-TR')}</span>}
                    </div>
                    {durum === 'bekliyor' && (
                      <button onClick={() => quickStatus(t.id, 'devam_ediyor')} style={{ marginTop: 8, width: '100%', padding: '5px', background: '#2563EB10', border: '1px solid #2563EB30', borderRadius: 6, color: '#2563EB', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Başla</button>
                    )}
                    {durum === 'devam_ediyor' && (
                      <button onClick={() => quickStatus(t.id, 'tamamlandi')} style={{ marginTop: 8, width: '100%', padding: '5px', background: '#05966910', border: '1px solid #05966930', borderRadius: 6, color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Tamamla</button>
                    )}
                  </div>
                ))}
                {grouped[durum].length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#C4B5A5', fontSize: 12 }}>Görev yok</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold" style={{ color: '#1A1A18' }}>{editing ? 'Görev Düzenle' : 'Yeni Görev'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">Başlık *</label>
                  <input value={form.baslik} onChange={e => setForm(f => ({ ...f, baslik: e.target.value }))} className="input" required placeholder="Görev başlığı..." />
                </div>
                <div>
                  <label className="label">Açıklama</label>
                  <textarea value={form.aciklama} onChange={e => setForm(f => ({ ...f, aciklama: e.target.value }))} className="input" rows={2} style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Öncelik</label>
                    <select value={form.oncelik} onChange={e => setForm(f => ({ ...f, oncelik: e.target.value as GorevOncelik }))} className="input">
                      {ONCELIK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Durum</label>
                    <select value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value as GorevDurum }))} className="input">
                      {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Son Tarih</label>
                    <input type="date" value={form.son_tarih} onChange={e => setForm(f => ({ ...f, son_tarih: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Atanan Kişi</label>
                    <select value={form.atanan_id} onChange={e => setForm(f => ({ ...f, atanan_id: e.target.value }))} className="input">
                      <option value="">Seçin</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.ad} {s.soyad}</option>)}
                    </select>
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
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1A1A18', marginBottom: 8 }}>Görevi Sil</h3>
              <p style={{ color: '#8B7355', fontSize: 13, marginBottom: 20 }}>Bu görev kalıcı olarak silinecek.</p>
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
