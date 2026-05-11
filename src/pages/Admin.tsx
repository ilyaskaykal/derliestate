import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Crown, Eye, Pencil, Trash2, X, Loader2, Shield, Key, Lock, Phone, Camera, Users } from 'lucide-react';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { Kullanici, KullaniciRol, ROL_LABELS, isStaff } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logAction } from '../lib/security';
import UserAvatar from '../components/UserAvatar';

const MANAGEABLE_BY_YONETICI: KullaniciRol[] = ['danisan', 'kıdemli_danisan'];

const ROL_OPTIONS_YONETICI: { value: KullaniciRol; label: string; description: string }[] = [
  { value: 'kıdemli_danisan', label: 'Kıdemli Danışman', description: 'Yalnızca kendi müşterilerini ve portföylerini görebilir' },
  { value: 'danisan', label: 'Danışman', description: 'Yalnızca kendi müşterilerini ve portföylerini görebilir' },
];

const ROL_OPTIONS_ADMIN: { value: KullaniciRol; label: string; description: string }[] = [
  { value: 'yonetici', label: 'Yönetici', description: 'Danışmanları yönetebilir, tüm ekranları görüntüleyebilir' },
  { value: 'kıdemli_danisan', label: 'Kıdemli Danışman', description: 'Yalnızca kendi müşterilerini ve portföylerini görebilir' },
  { value: 'danisan', label: 'Danışman', description: 'Yalnızca kendi müşterilerini ve portföylerini görebilir' },
];

const rolBadgeClass = (rol: KullaniciRol) => {
  if (rol === 'admin') return 'bg-gold-400/15 text-gold-400';
  if (rol === 'yonetici') return 'bg-blue-500/15 text-blue-400';
  if (rol === 'kıdemli_danisan') return 'bg-green-500/15 text-green-400';
  return 'bg-stone-100 text-stone-500';
};

const emptyForm = {
  username: '', sifre: '', ad: '', soyad: '',
  rol: 'danisan' as KullaniciRol, ilk_giris: true, telefon: '',
};

const emptyMusteriForm = {
  username: '', sifre: 'derli', ad: '', soyad: '', telefon: '',
};

/** Resize image to max 400x400 JPEG at 0.85 quality */
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
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('blob fail')), 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('img load fail'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('read fail'));
    reader.readAsDataURL(file);
  });
}

export default function Admin() {
  const { user, setViewAsUser } = useAuth();
  const { toast } = useToast();
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Kullanici | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [showSelfEdit, setShowSelfEdit] = useState(false);
  const [selfForm, setSelfForm] = useState({ ad: '', soyad: '', username: '', sifre: '', telefon: '' });
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetId = useRef<string | null>(null);
  const [photoModal, setPhotoModal] = useState<Kullanici | null>(null);
  const [photoModalFile, setPhotoModalFile] = useState<File | null>(null);
  const [photoModalPreview, setPhotoModalPreview] = useState<string | null>(null);

  // Audit log
  const [auditLog, setAuditLog] = useState<{ id: string; user_username: string; action: string; details: Record<string, unknown> | null; created_at: string }[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // Musteri accounts
  const [musteriHesaplar, setMusteriHesaplar] = useState<Kullanici[]>([]);
  const [showMusteriForm, setShowMusteriForm] = useState(false);
  const [editMusteri, setEditMusteri] = useState<Kullanici | null>(null);
  const [musteriForm, setMusteriForm] = useState({ ...emptyMusteriForm });
  const [musteriSaving, setMusteriSaving] = useState(false);

  const isAdmin = user?.rol === 'admin';
  const isYonetici = user?.rol === 'yonetici';

  const canManage = (target: Kullanici): boolean => {
    if (target.id === user?.id) return false;
    if (isAdmin) return true;
    if (isYonetici) return MANAGEABLE_BY_YONETICI.includes(target.rol);
    return false;
  };

  const canView = (target: Kullanici): boolean => {
    if (target.id === user?.id) return false;
    if (isAdmin) return true;
    if (isYonetici) return MANAGEABLE_BY_YONETICI.includes(target.rol);
    return false;
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('kullanicilar').select('id, username, ad, soyad, rol, ilk_giris, telefon, foto_url, created_at').neq('username', 'superadmin').neq('rol', 'musteri').order('created_at');
    let list = (data || []) as Kullanici[];
    if (isYonetici) {
      list = list.filter(k => k.rol !== 'admin' && k.id !== user?.id);
    }
    setKullanicilar(list);
    setLoading(false);
  }, [isYonetici, user?.id]);

  const loadMusteri = useCallback(async () => {
    const { data } = await supabase.from('kullanicilar').select('id, username, ad, soyad, rol, ilk_giris, telefon, foto_url, created_at').eq('rol', 'musteri').order('created_at');
    setMusteriHesaplar((data || []) as Kullanici[]);
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    setAuditLog((data || []) as typeof auditLog);
    setAuditLoading(false);
  }, []);

  useEffect(() => { load(); loadMusteri(); }, [load, loadMusteri]);

  useEffect(() => {
    if (user && showSelfEdit) {
      setSelfForm({ ad: user.ad, soyad: user.soyad, username: user.username, sifre: '', telefon: user.telefon || '' });
    }
  }, [user, showSelfEdit]);

  const openAdd = () => { setForm({ ...emptyForm }); setEditItem(null); setShowForm(true); };

  const openEdit = (k: Kullanici) => {
    if (!canManage(k)) { toast('Bu kullanıcıyı düzenleme yetkiniz yok.', 'error'); return; }
    setForm({ username: k.username, sifre: '', ad: k.ad, soyad: k.soyad, rol: k.rol, ilk_giris: k.ilk_giris, telefon: k.telefon || '' });
    setEditItem(k);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem && isYonetici && !MANAGEABLE_BY_YONETICI.includes(form.rol)) { toast('Bu role kullanıcı oluşturma yetkiniz yok.', 'error'); return; }
    if (editItem && isYonetici && !MANAGEABLE_BY_YONETICI.includes(editItem.rol)) { toast('Bu kullanıcıyı düzenleme yetkiniz yok.', 'error'); return; }
    if (editItem && isYonetici && !MANAGEABLE_BY_YONETICI.includes(form.rol)) { toast('Bu role atama yetkiniz yok.', 'error'); return; }
    setSaving(true);
    if (editItem) {
      const update: Record<string, unknown> = { username: form.username, ad: form.ad, soyad: form.soyad, rol: form.rol, telefon: form.telefon || null };
      if (form.sifre) {
        update.sifre = await bcrypt.hash(form.sifre, 10);
        update.sifre_hashed = true;
      }
      const { error } = await supabase.from('kullanicilar').update(update).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error');
      else {
        toast('Kullanıcı güncellendi.');
        await logAction(user?.username ?? '', 'user_updated', { target: editItem.username, rol: form.rol });
      }
    } else {
      const hashed = await bcrypt.hash(form.sifre, 10);
      const { username, ad, soyad, rol, telefon } = form;
      const { error } = await supabase.from('kullanicilar').insert({
        username, ad, soyad, rol,
        sifre: hashed, sifre_hashed: true,
        ilk_giris: true,
        telefon: telefon || null,
      });
      if (error) toast('Hata oluştu.', 'error');
      else {
        toast('Kullanıcı oluşturuldu. İlk girişte şifre değiştirmesi gerekecek.');
        await logAction(user?.username ?? '', 'user_created', { username, rol });
      }
    }
    setSaving(false); setShowForm(false); load();
  };

  const remove = async (k: Kullanici) => {
    if (k.id === user?.id) { toast('Kendi hesabınızı silemezsiniz.', 'error'); return; }
    if (!canManage(k)) { toast('Bu kullanıcıyı silme yetkiniz yok.', 'error'); return; }
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    await supabase.from('kullanicilar').delete().eq('id', k.id);
    await logAction(user?.username ?? '', 'user_deleted', { target: k.username, rol: k.rol });
    toast('Kullanıcı silindi.'); load();
  };

  const viewAs = (k: Kullanici) => {
    if (!canView(k)) { toast('Bu kullanıcının ekranını görüntüleme yetkiniz yok.', 'error'); return; }
    setViewAsUser(k);
    toast(`${k.ad} ${k.soyad} olarak görüntüleniyor.`, 'info');
  };

  const saveSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const update: Record<string, unknown> = { ad: selfForm.ad, soyad: selfForm.soyad, username: selfForm.username, telefon: selfForm.telefon || null };
    if (selfForm.sifre) {
      update.sifre = await bcrypt.hash(selfForm.sifre, 10);
      update.sifre_hashed = true;
    }
    const { error } = await supabase.from('kullanicilar').update(update).eq('id', user.id);
    if (error) toast('Hata oluştu.', 'error');
    else {
      if (selfForm.sifre) await logAction(user.username, 'password_changed', { self: true });
      toast('Bilgileriniz güncellendi.'); setShowSelfEdit(false);
    }
    setSaving(false);
  };

  /** Admin-only: open photo modal for a user */
  const openPhotoModal = (k: Kullanici) => {
    if (!isAdmin) return;
    setPhotoModal(k);
    setPhotoModalFile(null);
    setPhotoModalPreview(null);
  };

  const closePhotoModal = () => {
    setPhotoModal(null);
    setPhotoModalFile(null);
    setPhotoModalPreview(null);
  };

  const handlePhotoModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoModalFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoModalPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /** Upload with username-based filename */
  const handlePhotoUpload = async () => {
    if (!photoModal || !photoModalFile) return;
    const targetUsername = photoModal.username;
    setUploadingFor(photoModal.id);
    try {
      const blob = await resizeAvatar(photoModalFile);
      const path = `${targetUsername}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('kullanici-fotograflar')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) { toast('Fotoğraf yüklenemedi: ' + upErr.message, 'error'); return; }
      const { data: urlData } = supabase.storage.from('kullanici-fotograflar').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('kullanicilar')
        .update({ foto_url: urlData.publicUrl })
        .eq('id', photoModal.id);
      if (dbErr) { toast('Fotoğraf kaydedilemedi.', 'error'); return; }
      toast('Fotoğraf güncellendi.');
      closePhotoModal();
      load();
    } catch (err) {
      toast('Hata: ' + String(err), 'error');
    } finally {
      setUploadingFor(null);
    }
  };

  const handlePhotoRemove = async () => {
    if (!photoModal) return;
    setUploadingFor(photoModal.id);
    try {
      const { error: dbErr } = await supabase.from('kullanicilar')
        .update({ foto_url: null })
        .eq('id', photoModal.id);
      if (dbErr) { toast('Fotoğraf kaldırılamadı.', 'error'); return; }
      // Also delete from storage
      await supabase.storage.from('kullanici-fotograflar').remove([`${photoModal.username}.jpg`]);
      toast('Fotoğraf kaldırıldı.');
      closePhotoModal();
      load();
    } catch (err) {
      toast('Hata: ' + String(err), 'error');
    } finally {
      setUploadingFor(null);
    }
  };

  /** Legacy: used only for self-edit modal photo update */
  const triggerPhotoUpload = (userId: string) => {
    if (!isAdmin) return;
    photoTargetId.current = userId;
    photoInputRef.current?.click();
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !photoTargetId.current) return;
    const targetId = photoTargetId.current;
    const targetUser = kullanicilar.find(k => k.id === targetId) ?? user;
    const username = targetUser?.username ?? targetId;
    setUploadingFor(targetId);
    try {
      const blob = await resizeAvatar(file);
      const path = `${username}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('kullanici-fotograflar')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) { toast('Fotoğraf yüklenemedi: ' + upErr.message, 'error'); return; }
      const { data: urlData } = supabase.storage.from('kullanici-fotograflar').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('kullanicilar').update({ foto_url: urlData.publicUrl }).eq('id', targetId);
      if (dbErr) { toast('Fotoğraf kaydedilemedi.', 'error'); return; }
      toast('Fotoğraf güncellendi.'); load();
    } catch (err) {
      toast('Hata: ' + String(err), 'error');
    } finally {
      setUploadingFor(null);
    }
  };

  const saveMusteriHesap = async (e: React.FormEvent) => {
    e.preventDefault();
    setMusteriSaving(true);
    if (editMusteri) {
      const update: Record<string, unknown> = { username: musteriForm.username, ad: musteriForm.ad, soyad: musteriForm.soyad, telefon: musteriForm.telefon || null };
      if (musteriForm.sifre) {
        update.sifre = await bcrypt.hash(musteriForm.sifre, 10);
        update.sifre_hashed = true;
      }
      const { error } = await supabase.from('kullanicilar').update(update).eq('id', editMusteri.id);
      if (error) toast('Hata olustu.', 'error'); else toast('Musteri hesabi guncellendi.');
    } else {
      const rawPass = musteriForm.sifre || 'derli';
      const hashed = await bcrypt.hash(rawPass, 10);
      const { error } = await supabase.from('kullanicilar').insert({
        username: musteriForm.username,
        sifre: hashed,
        sifre_hashed: true,
        ad: musteriForm.ad,
        soyad: musteriForm.soyad,
        rol: 'musteri',
        ilk_giris: false,
        telefon: musteriForm.telefon || null,
      });
      if (error) toast('Hata olustu: ' + error.message, 'error'); else toast('Musteri hesabi olusturuldu.');
    }
    setMusteriSaving(false); setShowMusteriForm(false); setEditMusteri(null); loadMusteri();
  };

  const removeMusteri = async (k: Kullanici) => {
    if (!confirm('Bu musteri hesabini silmek istediginizden emin misiniz?')) return;
    await supabase.from('kullanicilar').delete().eq('id', k.id);
    toast('Musteri hesabi silindi.'); loadMusteri();
  };

  const rolOptions = isAdmin ? ROL_OPTIONS_ADMIN : ROL_OPTIONS_YONETICI;
  const manageableList = kullanicilar.filter(k => k.id !== user?.id && (isAdmin ? true : MANAGEABLE_BY_YONETICI.includes(k.rol)));
  const readOnlyYoneticiList = isYonetici ? kullanicilar.filter(k => k.rol === 'yonetici' && k.id !== user?.id) : [];
  const selfRow = kullanicilar.find(k => k.id === user?.id) ?? user;

  const UserRow = ({ k, isSelf = false, readOnly = false }: { k: Kullanici; isSelf?: boolean; readOnly?: boolean }) => (
    <tr className={`transition-colors ${readOnly ? 'opacity-60' : ''}`} style={{ borderBottom: '0.5px solid #F6D9A8', background: isSelf ? 'rgba(212,175,55,0.06)' : 'white' }}
      onMouseEnter={e => { if (!isSelf && !readOnly) (e.currentTarget as HTMLTableRowElement).style.background = '#FEF3E2'; }}
      onMouseLeave={e => { if (!isSelf && !readOnly) (e.currentTarget as HTMLTableRowElement).style.background = 'white'; }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative group">
            <UserAvatar name={`${k.ad} ${k.soyad}`} fotoUrl={k.foto_url} size={32} />
            {isAdmin && (
              <button
                onClick={() => triggerPhotoUpload(k.id)}
                disabled={uploadingFor === k.id}
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(26,26,24,0.6)' }}
                title="Fotoğraf yükle"
              >
                {uploadingFor === k.id
                  ? <Loader2 size={12} className="animate-spin text-white" />
                  : <Camera size={12} className="text-white" />}
              </button>
            )}
          </div>
          <span style={{ color: '#1A1A18' }}>{k.ad} {k.soyad}</span>
          {isSelf && <span className="text-xs" style={{ color: '#D4AF37' }}>(sen)</span>}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8B7355' }}>@{k.username}</td>
      <td className="px-4 py-3">
        {k.telefon
          ? <a href={`tel:${k.telefon}`} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"><Phone size={11} />{k.telefon}</a>
          : <span className="text-xs" style={{ color: '#D4C9B8' }}>—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`status-badge ${rolBadgeClass(k.rol)}`}>
          {(k.rol === 'admin' || k.rol === 'yonetici') && <Crown size={11} />}
          {ROL_LABELS[k.rol] ?? k.rol}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs ${isSelf ? 'text-green-400' : k.ilk_giris ? 'text-yellow-400' : 'text-green-400'}`}>
          {isSelf ? 'Aktif' : k.ilk_giris ? 'Şifre Değiştirilmedi' : 'Aktif'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: '#8B7355' }}>{new Date(k.created_at).toLocaleDateString('tr-TR')}</td>
      <td className="px-4 py-3 text-right">
        {isSelf || readOnly ? (
          readOnly ? <Lock size={13} className="ml-auto" style={{ color: '#D4C9B8' }} /> : (
            <div className="flex items-center justify-end gap-1">
              {isAdmin && (
                <button onClick={() => openPhotoModal(k)} className="transition-colors p-1.5 rounded" style={{ color: '#8B7355' }} title="Fotoğraf yükle"><Camera size={14} /></button>
              )}
              <span className="text-xs italic" style={{ color: '#8B7355' }}>—</span>
            </div>
          )
        ) : (
          <div className="flex items-center justify-end gap-1">
            {isAdmin && (
              <button onClick={() => openPhotoModal(k)} className="transition-colors p-1.5 rounded" style={{ color: '#8B7355' }} title="Fotoğraf yükle"><Camera size={14} /></button>
            )}
            <button onClick={() => viewAs(k)} className="transition-colors p-1.5 rounded" style={{ color: '#8B7355' }} title="Ekranı görüntüle"><Eye size={14} /></button>
            <button onClick={() => openEdit(k)} className="transition-colors p-1.5 rounded" style={{ color: '#8B7355' }}><Pencil size={14} /></button>
            <button onClick={() => remove(k)} className="transition-colors p-1.5 rounded hover:text-red-400" style={{ color: '#8B7355' }}><Trash2 size={14} /></button>
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Hidden file input for photo upload */}
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />

      <div className="px-4 md:px-6 py-4 shrink-0 flex items-center justify-between gap-3" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}>
        <div className="flex items-center gap-2">
          <Crown style={{ color: '#D4AF37' }} className="shrink-0" size={20} />
          <div>
            <h1 className="text-base md:text-lg font-semibold" style={{ color: '#1A1A18' }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: '#8B7355' }}>Kullanıcı yönetimi</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={() => { setShowAudit(s => !s); if (!showAudit) loadAudit(); }}
              className="btn-ghost text-xs md:text-sm px-2 md:px-4"
            >
              <Shield size={14} />
              <span className="hidden md:inline">Denetim Kaydı</span>
            </button>
          )}
          <button onClick={() => setShowSelfEdit(true)} className="btn-ghost text-xs md:text-sm px-2 md:px-4">
            <Key size={14} />
            <span className="hidden md:inline">Kendi Bilgilerimi Düzenle</span>
            <span className="md:hidden">Bilgilerim</span>
          </button>
          <button onClick={openAdd} className="btn-gold text-xs md:text-sm px-2 md:px-4">
            <Plus size={15} />
            <span className="hidden md:inline">Kullanıcı Ekle</span>
            <span className="md:hidden">Ekle</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" style={{ maxHeight: 'calc(100vh - 88px)', background: '#FDF3E3' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}><Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...</div>
        ) : (
          <>
            {isAdmin && (
              <div className="flex items-start gap-3 rounded-xl px-4 py-2.5 text-xs" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', color: 'rgba(212,175,55,0.9)' }}>
                <Camera size={13} className="shrink-0 mt-0.5" style={{ color: '#D4AF37' }} />
                Kullanıcı fotoğrafı yüklemek veya kaldırmak için satırdaki kamera ikonuna tıklayın.
              </div>
            )}

            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr style={{ background: '#1A1A18', borderBottom: '0.5px solid #F6D9A8' }}>
                    {['Kullanıcı', 'Kullanıcı Adı', 'Telefon', 'Rol', 'Durum', 'Kayıt', 'İşlemler'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase" style={{ color: '#8B7355', letterSpacing: '1px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selfRow && <UserRow k={selfRow as Kullanici} isSelf />}
                  {readOnlyYoneticiList.map(k => <UserRow key={k.id} k={k} readOnly />)}
                  {manageableList.map(k => <UserRow key={k.id} k={k} />)}
                  {manageableList.length === 0 && readOnlyYoneticiList.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: '#8B7355' }}>Yönetebileceğiniz kullanıcı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {isYonetici && (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(83,74,183,0.06)', border: '1px solid rgba(83,74,183,0.2)', color: '#534AB7' }}>
                <Shield size={14} className="shrink-0 mt-0.5 text-blue-400" />
                <p>Yönetici olarak yalnızca <strong>Danışman</strong> ve <strong>Kıdemli Danışman</strong> hesaplarını yönetebilirsiniz.</p>
              </div>
            )}

            {/* Musteri Girisleri — admin only */}
            {isAdmin && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: '#1A1A18' }}>
                      <Users size={16} style={{ color: '#64B5F6' }} />
                      Musteri Girisleri
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>
                      Portfoy ve Instagram goruntuleme icin ozel erisim
                    </p>
                  </div>
                  <button
                    onClick={() => { setMusteriForm({ ...emptyMusteriForm }); setEditMusteri(null); setShowMusteriForm(true); }}
                    className="btn-ghost text-xs px-3"
                  >
                    <Plus size={13} /> Musteri Ekle
                  </button>
                </div>
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead>
                      <tr style={{ background: '#1A1A18', borderBottom: '0.5px solid #F6D9A8' }}>
                        {['Musteri', 'Kullanici Adi', 'Telefon', 'Durum', 'Islemler'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase" style={{ color: '#8B7355', letterSpacing: '1px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {musteriHesaplar.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: '#8B7355' }}>Henuz musteri hesabi yok.</td></tr>
                      ) : musteriHesaplar.map(k => (
                        <tr key={k.id} className="transition-colors" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FEF3E2'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'white'}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar name={`${k.ad} ${k.soyad}`} fotoUrl={k.foto_url} size={32} />
                              <span style={{ color: '#1A1A18' }}>{k.ad} {k.soyad}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8B7355' }}>@{k.username}</td>
                          <td className="px-4 py-3">
                            {k.telefon
                              ? <span className="flex items-center gap-1 text-blue-400 text-xs"><Phone size={11} />{k.telefon}</span>
                              : <span className="text-xs" style={{ color: '#D4C9B8' }}>—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(83,74,183,0.08)', color: 'rgba(83,74,183,0.6)' }}>
                              ••••••
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => { setMusteriForm({ username: k.username, sifre: '', ad: k.ad, soyad: k.soyad, telefon: k.telefon || '' }); setEditMusteri(k); setShowMusteriForm(true); }}
                                className="transition-colors p-1.5 rounded" style={{ color: '#8B7355' }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => removeMusteri(k)} className="transition-colors p-1.5 rounded hover:text-red-400" style={{ color: '#8B7355' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Audit Log — admin only */}
            {isAdmin && showAudit && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: '#1A1A18' }}>
                    <Shield size={16} className="text-blue-400" />
                    Denetim Kaydı
                  </h2>
                  <div className="flex-1 h-px" style={{ background: '#D4C9B8' }} />
                  <button onClick={loadAudit} className="text-xs transition-colors" style={{ color: '#8B7355' }}>Yenile</button>
                </div>
                {auditLoading ? (
                  <div className="flex items-center justify-center py-8" style={{ color: '#8B7355' }}><Loader2 className="animate-spin mr-2" size={16} />Yükleniyor...</div>
                ) : auditLog.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: '#8B7355' }}>Henüz kayıt yok.</p>
                ) : (
                  <div className="card overflow-x-auto">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead>
                        <tr style={{ background: '#1A1A18', borderBottom: '0.5px solid #F6D9A8' }}>
                          {['Tarih', 'Kullanıcı', 'İşlem', 'Detaylar'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 font-medium uppercase" style={{ color: '#8B7355', letterSpacing: '1px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map(entry => (
                          <tr key={entry.id} className="transition-colors" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#FEF3E2'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'white'}
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: '#8B7355' }}>
                              {new Date(entry.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-2.5 font-mono" style={{ color: '#1A1A18' }}>@{entry.user_username || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                entry.action.includes('deleted') || entry.action.includes('cleared') ? 'bg-red-500/10 text-red-400' :
                                entry.action.includes('created') ? 'bg-green-500/10 text-green-400' :
                                entry.action.includes('password') ? 'bg-yellow-500/10 text-yellow-400' :
                                'bg-stone-100 text-stone-500'
                              }`}>
                                {entry.action}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 max-w-[240px] truncate" style={{ color: '#8B7355' }}>
                              {entry.details ? JSON.stringify(entry.details) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-md w-full" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{editItem ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Ad</label><input className="input" value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} required /></div>
                  <div><label className="label">Soyad</label><input className="input" value={form.soyad} onChange={e => setForm(f => ({ ...f, soyad: e.target.value }))} /></div>
                </div>
                <div><label className="label">Kullanıcı Adı</label><input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required /></div>
                <div>
                  <label className="label">Telefon <span className="font-normal" style={{ color: '#8B7355' }}>(+905321234567)</span></label>
                  <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8B7355' }} /><input type="tel" className="input pl-8" placeholder="+905321234567" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} /></div>
                </div>
                <div>
                  <label className="label">{editItem ? 'Yeni Şifre (boş bırakılırsa değişmez)' : 'Geçici Şifre'}</label>
                  <input type="password" className="input" value={form.sifre} onChange={e => setForm(f => ({ ...f, sifre: e.target.value }))} required={!editItem} />
                </div>
                <div>
                  <label className="label">Rol</label>
                  <div className="space-y-2 mt-1">
                    {rolOptions.map(opt => (
                      <label key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all" style={form.rol === opt.value ? { borderColor: 'rgba(212,175,55,0.5)', background: 'rgba(212,175,55,0.05)' } : { borderColor: '#F6D9A8', background: '#F5F0E8' }}>
                        <input type="radio" name="rol" value={opt.value} checked={form.rol === opt.value} onChange={() => setForm(f => ({ ...f, rol: opt.value }))} className="mt-0.5 accent-yellow-500" />
                        <div>
                          <p className="text-sm font-medium" style={{ color: form.rol === opt.value ? '#D4AF37' : '#1A1A18' }}>{opt.label}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>{opt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {!editItem && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-xs">
                    <Shield size={13} className="inline mr-1" />Kullanıcı ilk girişinde şifresini değiştirmek zorunda kalacak.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving} className="btn-gold flex-1 justify-center">{saving ? <Loader2 className="animate-spin" size={16} /> : (editItem ? 'Güncelle' : 'Oluştur')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {photoModal && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && closePhotoModal()}>
          <div className="modal-content max-w-sm w-full" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold text-base" style={{ color: '#1A1A18' }}>Fotoğraf Yükle</h2>
              <button onClick={closePhotoModal} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Current photo / preview */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {photoModalPreview ? (
                    <img src={photoModalPreview} alt="Önizleme" className="w-24 h-24 rounded-2xl object-cover border-2 border-gold-400/40" />
                  ) : (
                    <UserAvatar name={`${photoModal.ad} ${photoModal.soyad}`} fotoUrl={photoModal.foto_url} size={96} className="rounded-2xl" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold" style={{ color: '#1A1A18' }}>{photoModal.ad} {photoModal.soyad}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>@{photoModal.username}</p>
                </div>
              </div>

              {/* File picker */}
              <div>
                <label className="label mb-1">Fotoğraf Seç</label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors" style={{ border: '0.5px solid #F6D9A8', background: '#F5F0E8' }}>
                  <Camera size={16} style={{ color: '#D4AF37' }} className="shrink-0" />
                  <span className="text-sm flex-1 truncate" style={{ color: '#1A1A18' }}>
                    {photoModalFile ? photoModalFile.name : 'Dosya seçmek için tıklayın...'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoModalFileChange} />
                </label>
              </div>
            </div>

            <div className="modal-footer">
              {photoModal.foto_url && (
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  disabled={uploadingFor === photoModal.id}
                  className="btn-ghost text-red-400 hover:text-red-300 flex-1 justify-center border-red-500/20 hover:border-red-400/30"
                >
                  {uploadingFor === photoModal.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={15} />}
                  Kaldır
                </button>
              )}
              <button type="button" onClick={closePhotoModal} className="btn-ghost flex-1 justify-center">İptal</button>
              <button
                type="button"
                onClick={handlePhotoUpload}
                disabled={!photoModalFile || uploadingFor === photoModal.id}
                className="btn-gold flex-1 justify-center"
              >
                {uploadingFor === photoModal.id ? <Loader2 className="animate-spin" size={16} /> : <Camera size={15} />}
                Yükle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Musteri Hesap Modal */}
      {showMusteriForm && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowMusteriForm(false)}>
          <div className="modal-content max-w-md w-full" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{editMusteri ? 'Musteri Hesabi Duzenle' : 'Yeni Musteri Hesabi'}</h2>
              <button onClick={() => setShowMusteriForm(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <form onSubmit={saveMusteriHesap} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Ad</label><input className="input" value={musteriForm.ad} onChange={e => setMusteriForm(f => ({ ...f, ad: e.target.value }))} required /></div>
                  <div><label className="label">Soyad</label><input className="input" value={musteriForm.soyad} onChange={e => setMusteriForm(f => ({ ...f, soyad: e.target.value }))} /></div>
                </div>
                <div><label className="label">Kullanici Adi</label><input className="input" value={musteriForm.username} onChange={e => setMusteriForm(f => ({ ...f, username: e.target.value }))} required /></div>
                <div>
                  <label className="label">Telefon</label>
                  <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8B7355' }} /><input type="tel" className="input pl-8" placeholder="+905321234567" value={musteriForm.telefon} onChange={e => setMusteriForm(f => ({ ...f, telefon: e.target.value }))} /></div>
                </div>
                <div>
                  <label className="label">{editMusteri ? 'Sifre (bos birakilan degismez)' : 'Sifre'}</label>
                  <input type="text" className="input font-mono" placeholder="derli" value={musteriForm.sifre} onChange={e => setMusteriForm(f => ({ ...f, sifre: e.target.value }))} required={!editMusteri} />
                </div>
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(83,74,183,0.06)', border: '1px solid rgba(83,74,183,0.2)', color: '#534AB7' }}>
                  <Eye size={13} className="shrink-0 mt-0.5" />
                  Bu hesap yalnizca Portfoy ve Instagram sayfalarini gorebilir. Musteri bilgileri, mesajlasma ve diger sayfalar gizlenir.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowMusteriForm(false)} className="btn-ghost flex-1 justify-center">Iptal</button>
                <button type="submit" disabled={musteriSaving} className="btn-gold flex-1 justify-center">{musteriSaving ? <Loader2 className="animate-spin" size={16} /> : (editMusteri ? 'Guncelle' : 'Olustur')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Self-edit Modal */}
      {showSelfEdit && user && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowSelfEdit(false)}>
          <div className="modal-content max-w-md w-full" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <UserAvatar name={`${user.ad} ${user.soyad}`} fotoUrl={user.foto_url} size={40} />
                  {isAdmin && (
                    <button
                      onClick={() => triggerPhotoUpload(user.id)}
                      disabled={uploadingFor === user.id}
                      className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: 'rgba(26,26,24,0.6)' }}
                      title="Fotoğraf değiştir"
                    >
                      {uploadingFor === user.id ? <Loader2 size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
                    </button>
                  )}
                </div>
                <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>Kendi Bilgilerimi Düzenle</h2>
              </div>
              <button onClick={() => setShowSelfEdit(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <form onSubmit={saveSelf} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Ad</label><input className="input" value={selfForm.ad} onChange={e => setSelfForm(f => ({ ...f, ad: e.target.value }))} /></div>
                  <div><label className="label">Soyad</label><input className="input" value={selfForm.soyad} onChange={e => setSelfForm(f => ({ ...f, soyad: e.target.value }))} /></div>
                </div>
                <div><label className="label">Kullanıcı Adı</label><input className="input" value={selfForm.username} onChange={e => setSelfForm(f => ({ ...f, username: e.target.value }))} /></div>
                <div>
                  <label className="label">Telefon <span className="font-normal" style={{ color: '#8B7355' }}>(+905321234567)</span></label>
                  <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8B7355' }} /><input type="tel" className="input pl-8" placeholder="+905321234567" value={selfForm.telefon} onChange={e => setSelfForm(f => ({ ...f, telefon: e.target.value }))} /></div>
                </div>
                <div><label className="label">Yeni Şifre (boş bırakılırsa değişmez)</label><input type="password" className="input" placeholder="••••••••" value={selfForm.sifre} onChange={e => setSelfForm(f => ({ ...f, sifre: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowSelfEdit(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving} className="btn-gold flex-1 justify-center">{saving ? <Loader2 className="animate-spin" size={16} /> : 'Kaydet'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
