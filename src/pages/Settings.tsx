import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, User, Key, Bell, Globe, Loader2, Eye, EyeOff, Check, Camera, Facebook } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getClaudeApiKey, saveClaudeApiKey } from '../lib/claude';
import { ROL_LABELS } from '../types';

export default function Settings() {
  const { user, changePassword } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'ai' | 'notifications' | 'facebook'>('profile');
  const [profileForm, setProfileForm] = useState({ ad: '', soyad: '', telefon: '', foto_url: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false });
  const [claudeKey, setClaudeKeyState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setProfileForm({ ad: user.ad || '', soyad: user.soyad || '', telefon: user.telefon || '', foto_url: user.foto_url || '' });
    }
    getClaudeApiKey().then(k => setClaudeKeyState(k || ''));
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('kullanicilar').update({ ad: profileForm.ad, soyad: profileForm.soyad, telefon: profileForm.telefon, foto_url: profileForm.foto_url }).eq('id', user.id);
    if (error) toast(error.message, 'error');
    else toast('Profil güncellendi.', 'success');
    setSaving(false);
  };

  const savePassword = async () => {
    if (!user) return;
    if (pwForm.newPw.length < 6) { toast('Şifre en az 6 karakter olmalı.', 'error'); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast('Şifreler eşleşmiyor.', 'error'); return; }
    setSaving(true);
    const result = await changePassword(user.id, pwForm.newPw);
    if (result.error) toast(result.error, 'error');
    else { toast('Şifre güncellendi.', 'success'); setPwForm({ current: '', newPw: '', confirm: '' }); }
    setSaving(false);
  };

  const saveClaudeKey = async () => {
    await saveClaudeApiKey(claudeKey.trim());
    toast('Claude API anahtarı kaydedildi.', 'success');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = `avatars/${user.id}_${Date.now()}`;
    const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
    if (error) { toast(error.message, 'error'); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    setProfileForm(f => ({ ...f, foto_url: data.publicUrl }));
  };

  const isAdmin = user?.rol === 'admin' || user?.rol === 'yonetici';

  const TABS = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'security', label: 'Güvenlik', icon: Key },
    { id: 'ai', label: 'AI Ayarları', icon: SettingsIcon },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    ...(isAdmin ? [{ id: 'facebook', label: 'Facebook Leads', icon: Facebook }] : []),
  ] as const;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18', marginBottom: 20 }}>Ayarlar</h1>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Tab nav */}
        <div style={{ width: 180, flexShrink: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer', marginBottom: 4,
                background: activeTab === tab.id ? '#1A1A18' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#5A4A3A', fontWeight: 600, fontSize: 13,
              }}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
          {activeTab === 'profile' && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8' }}>
                <h2 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Profil Bilgileri</h2>
              </div>
              <div style={{ padding: 20 }}>
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#F0E8D8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                    {profileForm.foto_url ? (
                      <img src={profileForm.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 22, fontWeight: 700, color: '#8B7355' }}>{user?.ad?.[0]}{user?.soyad?.[0]}</span>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, color: '#1A1A18' }}>{user?.ad} {user?.soyad}</h3>
                    <p style={{ fontSize: 12, color: '#8B7355', marginBottom: 8 }}>{ROL_LABELS[user?.rol || ''] || user?.rol}</p>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    <button onClick={() => fileRef.current?.click()} className="btn-ghost" style={{ fontSize: 12 }}><Camera size={12} /> Fotoğraf Değiştir</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="label">Ad</label>
                      <input value={profileForm.ad} onChange={e => setProfileForm(f => ({ ...f, ad: e.target.value }))} className="input" />
                    </div>
                    <div>
                      <label className="label">Soyad</label>
                      <input value={profileForm.soyad} onChange={e => setProfileForm(f => ({ ...f, soyad: e.target.value }))} className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Telefon</label>
                    <input value={profileForm.telefon} onChange={e => setProfileForm(f => ({ ...f, telefon: e.target.value }))} className="input" placeholder="+90 5xx xxx xxxx" />
                  </div>
                  <button onClick={saveProfile} className="btn-gold" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8' }}>
                <h2 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Şifre Değiştir</h2>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Yeni Şifre</label>
                  <div className="relative">
                    <input type={showPw.new ? 'text' : 'password'} value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} className="input pr-10" minLength={6} />
                    <button type="button" onClick={() => setShowPw(v => ({ ...v, new: !v.new }))} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B7355' }}>
                      {showPw.new ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Şifre Tekrar</label>
                  <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className="input" />
                </div>
                <button onClick={savePassword} className="btn-gold" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Şifreyi Güncelle
                </button>
                <div style={{ padding: 12, background: '#FAF6EF', borderRadius: 8, fontSize: 12, color: '#8B7355', lineHeight: 1.6 }}>
                  Güçlü bir şifre için: en az 8 karakter, büyük/küçük harf, rakam ve özel karakter kullanın.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8' }}>
                <h2 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Claude AI Ayarları</h2>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 14, background: '#FFF8E1', border: '1px solid #D97706', borderRadius: 8, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
                  Claude AI özelliklerini kullanmak için Anthropic'ten bir API anahtarı almanız gerekmektedir. Bu anahtar yalnızca tarayıcınızda saklanır ve asla sunucuya gönderilmez.
                </div>
                <div>
                  <label className="label">Anthropic API Anahtarı</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={claudeKey}
                      onChange={e => setClaudeKeyState(e.target.value)}
                      className="input pr-10"
                      placeholder="sk-ant-..."
                    />
                    <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B7355' }}>
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button onClick={saveClaudeKey} className="btn-gold" style={{ alignSelf: 'flex-start' }}><Check size={14} /> Anahtarı Kaydet</button>
                {claudeKey && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 12 }}>
                    <Check size={14} /> API anahtarı kayıtlı — AI özellikleri aktif
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'facebook' && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Facebook size={18} color="#1877F2" />
                <h2 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Facebook / Instagram Lead Ads</h2>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 14, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 12, color: '#1E40AF', lineHeight: 1.7 }}>
                  Facebook ve Instagram Lead Ads'den gelen müşteriler otomatik olarak sisteme eklenir. Aşağıdaki webhook URL'ini Meta Business Manager'a ekleyin.
                </div>

                <div>
                  <label className="label">Webhook URL</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input readOnly value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead`} className="input" style={{ flex: 1, fontFamily: 'monospace', fontSize: 11 }} />
                    <button onClick={() => { navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-lead`); toast('Kopyalandı!', 'success'); }} className="btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Kopyala</button>
                  </div>
                </div>

                <div>
                  <label className="label">Verify Token</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input readOnly value="derli2026facebook" className="input" style={{ flex: 1, fontFamily: 'monospace' }} />
                    <button onClick={() => { navigator.clipboard.writeText('derli2026facebook'); toast('Kopyalandı!', 'success'); }} className="btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Kopyala</button>
                  </div>
                </div>

                <div style={{ background: '#FAF6EF', borderRadius: 10, padding: 16, border: '1px solid #F0E8D8' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18', marginBottom: 12 }}>Kurulum Adımları</div>
                  {[
                    { n: 1, t: 'Meta Business Manager\'a gidin', d: 'business.facebook.com → Ayarlar → Veri Kaynakları → Lead Ads' },
                    { n: 2, t: 'Webhook Ekle', d: 'Yukarıdaki Webhook URL\'ini ve Verify Token\'ı girin. Webhook Doğrula\'ya tıklayın.' },
                    { n: 3, t: 'leadgen Aboneliği', d: '"leadgen" alanını seçin ve değişikliklere abone olun.' },
                    { n: 4, t: 'Sayfayı bağlayın', d: 'Facebook Sayfanızı webhook ile ilişkilendirin. Instagram için bağlı hesabınızı seçin.' },
                    { n: 5, t: 'Test edin', d: 'Meta Test Lead aracını kullanarak bir test lead gönderin ve Müşteriler sayfasında görünüp görünmediğini kontrol edin.' },
                  ].map(s => (
                    <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1877F2', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18', marginBottom: 2 }}>{s.t}</div>
                        <div style={{ fontSize: 11, color: '#8B7355', lineHeight: 1.5 }}>{s.d}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: 12, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12, color: '#065F46', lineHeight: 1.6 }}>
                  Lead kaynağı "facebook_lead" veya "instagram_lead" olan müşteriler, müşteri listesinde mavi FB / renkli IG badge ile gösterilir.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8' }}>
                <h2 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Bildirim Ayarları</h2>
              </div>
              <div style={{ padding: 20 }}>
                {[
                  { label: 'Yeni mesaj bildirimi', desc: 'Birisi size mesaj gönderdiğinde sesli bildirim al' },
                  { label: 'Randevu hatırlatıcısı', desc: 'Randevudan 1 saat önce bildirim al' },
                  { label: 'Görev bildirimleri', desc: 'Size görev atandığında bildirim al' },
                  { label: 'Müşteri güncellemeleri', desc: 'Müşteri durumu değiştiğinde bildirim al' },
                ].map((n, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #FAF6EF' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 2 }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: '#8B7355' }}>{n.desc}</div>
                    </div>
                    <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked={i < 2} style={{ opacity: 0, width: 0, height: 0 }} onChange={() => {}} />
                      <span style={{ position: 'absolute', inset: 0, background: i < 2 ? '#D4AF37' : '#D4C9B8', borderRadius: 11, transition: 'background 0.2s' }} />
                      <span style={{ position: 'absolute', left: i < 2 ? 20 : 2, top: 2, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
