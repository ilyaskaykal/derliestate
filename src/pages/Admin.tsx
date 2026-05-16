import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Shield, X, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ROL_LABELS, isAdminLevel } from '../types';
import type { Kullanici, KullaniciRol } from '../types';
import bcrypt from 'bcryptjs';

const ROL_OPTIONS: KullaniciRol[] = ['admin', 'yonetici', 'kıdemli_danisan', 'danisan', 'musteri', 'misafir'];

interface FormState {
  username: string;
  ad: string;
  soyad: string;
  rol: KullaniciRol;
  telefon: string;
  password: string;
}

const EMPTY_FORM: FormState = { username: '', ad: '', soyad: '', rol: 'danisan', telefon: '', password: '' };

export default function Admin() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Kullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Kullanici | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('kullanicilar').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (!isAdminLevel(currentUser?.rol)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Shield size={40} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ color: '#1A1A18', fontWeight: 700, marginBottom: 8 }}>Yetkisiz Erişim</h2>
        <p style={{ color: '#8B7355' }}>Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  const filtered = users.filter(u => !search || `${u.ad} ${u.soyad} ${u.username}`.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowModal(true); };
  const openEdit = (u: Kullanici) => {
    setEditing(u);
    setForm({ username: u.username || '', ad: u.ad || '', soyad: u.soyad || '', rol: u.rol || 'danisan', telefon: u.telefon || '', password: '' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.ad.trim()) { toast('Kullanıcı adı ve ad zorunludur.', 'error'); return; }
    if (!editing && !form.password) { toast('Yeni kullanıcı için şifre zorunludur.', 'error'); return; }
    if (form.password && form.password.length < 6) { toast('Şifre en az 6 karakter olmalı.', 'error'); return; }
    setSaving(true);

    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      ad: form.ad.trim(),
      soyad: form.soyad.trim(),
      rol: form.rol,
      telefon: form.telefon.trim(),
    };

    if (form.password) {
      const hash = await bcrypt.hash(form.password, 10);
      payload.sifre = hash;
      payload.ilk_giris = true;
    }

    if (editing) {
      const { error } = await supabase.from('kullanicilar').update(payload).eq('id', editing.id);
      if (error) toast(error.message, 'error');
      else { toast('Kullanıcı güncellendi.', 'success'); setShowModal(false); load(); }
    } else {
      const { error } = await supabase.from('kullanicilar').insert(payload);
      if (error) toast(error.message, 'error');
      else { toast('Kullanıcı oluşturuldu.', 'success'); setShowModal(false); load(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (deleteId === currentUser?.id) { toast('Kendinizi silemezsiniz.', 'error'); setDeleteId(null); return; }
    const { error } = await supabase.from('kullanicilar').delete().eq('id', deleteId);
    if (error) toast(error.message, 'error');
    else { toast('Kullanıcı silindi.', 'success'); load(); }
    setDeleteId(null);
  };

  const resetPassword = async (uid: string) => {
    const hash = await bcrypt.hash('Derli2026!', 10);
    await supabase.from('kullanicilar').update({ sifre: hash, ilk_giris: true }).eq('id', uid);
    toast('Şifre "Derli2026!" olarak sıfırlandı. Kullanıcı ilk girişte değiştirmek zorunda kalacak.', 'success');
  };

  const ROL_BADGE_COLORS: Record<string, string> = {
    superadmin: '#7C3AED', admin: '#DC2626', yonetici: '#D97706',
    kıdemli_danisan: '#2563EB', danisan: '#059669', musteri: '#6B7280', misafir: '#9CA3AF',
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Kullanıcı Yönetimi</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>{users.length} kullanıcı</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="btn-ghost" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={openAdd} className="btn-gold"><Plus size={15} /> Yeni Kullanıcı</button>
        </div>
      </div>

      {/* Search */}
      <div className="search-box" style={{ marginBottom: 16, maxWidth: 340 }}>
        <User size={14} color="#8B7355" />
        <input placeholder="Kullanıcı ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAF6EF', borderBottom: '1px solid #F0E8D8' }}>
                {['Kullanıcı', 'Rol', 'Telefon', 'Kayıt', 'İşlemler'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #FAF6EF' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAF6EF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0E8D8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#8B7355', overflow: 'hidden' }}>
                        {u.foto_url ? <img src={u.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${u.ad?.[0] || ''}${u.soyad?.[0] || ''}`}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18' }}>{u.ad} {u.soyad}</div>
                        <div style={{ fontSize: 11, color: '#8B7355' }}>@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: (ROL_BADGE_COLORS[u.rol] || '#6B7280') + '15', color: ROL_BADGE_COLORS[u.rol] || '#6B7280' }}>
                      {ROL_LABELS[u.rol] || u.rol}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#5A4A3A' }}>{u.telefon || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#8B7355' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('tr-TR') : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(u)} className="btn-ghost" style={{ padding: '5px 8px' }}><Edit2 size={12} /></button>
                      <button onClick={() => resetPassword(u.id)} className="btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}>Şifre Sıfırla</button>
                      {u.id !== currentUser?.id && u.rol !== 'superadmin' && (
                        <button onClick={() => setDeleteId(u.id)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #FFD0CC', background: 'transparent', color: '#FF3B2F', cursor: 'pointer' }}><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#8B7355' }}>Kullanıcı bulunamadı</div>}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold" style={{ color: '#1A1A18' }}>{editing ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Ad *</label>
                    <input value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} className="input" required />
                  </div>
                  <div>
                    <label className="label">Soyad</label>
                    <input value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Kullanıcı Adı *</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="input" required />
                </div>
                <div>
                  <label className="label">Rol</label>
                  <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value as KullaniciRol }))} className="input">
                    {ROL_OPTIONS.map(r => <option key={r} value={r}>{ROL_LABELS[r] || r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} className="input" placeholder="+90 5xx xxx xxxx" />
                </div>
                <div>
                  <label className="label">{editing ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Şifre *'}</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input pr-10" {...(!editing ? { required: true } : {})} minLength={6} />
                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B7355' }}>
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn-gold flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Güncelle' : 'Oluştur')}
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
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1A1A18', marginBottom: 8 }}>Kullanıcıyı Sil</h3>
              <p style={{ color: '#8B7355', fontSize: 13, marginBottom: 20 }}>Bu kullanıcı kalıcı olarak silinecek.</p>
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
