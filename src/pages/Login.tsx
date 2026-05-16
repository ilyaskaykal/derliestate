import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { checkLockout } from '../lib/security';

export default function Login() {
  const { login, changePassword } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forceChange, setForceChange] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!url || !key || url === 'undefined' || key === 'undefined') {
      setDbStatus('error');
      setDbError('Supabase ortam değişkenleri eksik.');
      return;
    }
    supabase
      .from('kullanicilar')
      .select('count', { count: 'exact', head: true })
      .then(({ error }) => {
        if (error) {
          setDbStatus('error');
          setDbError(`Veritabanı bağlantı hatası: ${error.message}`);
        } else {
          setDbStatus('ok');
        }
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const lockout = checkLockout(username.trim());
    if (lockout) { toast(lockout, 'error'); return; }
    setLoading(true);
    try {
      const result = await login(username.trim(), password.trim());
      setLoading(false);
      if (result.needsPasswordChange) {
        setTempUsername(username.trim());
        setForceChange(true);
        return;
      }
      if (result.error) toast(result.error, 'error');
    } catch (err) {
      toast('Beklenmeyen hata: ' + String(err), 'error');
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) { toast('Şifre en az 6 karakter olmalıdır.', 'error'); return; }
    if (newPass !== confirmPass) { toast('Şifreler eşleşmiyor.', 'error'); return; }
    setLoading(true);
    const { data: userData } = await supabase
      .from('kullanicilar')
      .select('id, username, ad, soyad, rol, ilk_giris, telefon, foto_url, created_at')
      .eq('username', tempUsername)
      .maybeSingle();
    if (userData) {
      const result = await changePassword(userData.id, newPass);
      if (result.error) toast(result.error, 'error');
      else {
        toast('Şifreniz güncellendi.', 'success');
        await login(tempUsername, newPass);
      }
    }
    setLoading(false);
  };

  if (forceChange) {
    return (
      <div className="login-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 w-full max-w-sm">
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1A1A18' }}>Şifre Değiştir</h2>
          <p className="text-sm mb-6" style={{ color: '#8B7355' }}>İlk girişte yeni şifre belirlemeniz gerekiyor.</p>
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
            <div>
              <label className="label">Yeni Şifre</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  className="input pr-10"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 touch-compact" style={{ color: '#8B7355' }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Şifre Tekrar</label>
              <input
                type="password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                className="input"
                required
              />
            </div>
            <button type="submit" className="btn-gold w-full justify-center" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Şifreyi Güncelle'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="glass-card rounded-2xl p-8 w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div style={{ width: 52, height: 52, background: '#1A1A18', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #D4AF37', marginBottom: 12 }}>
            <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: 20 }}>D</span>
          </div>
          <h1 style={{ color: '#1A1A18', fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px' }}>
            DerliEstate <span style={{ color: '#D4AF37' }}>Pro</span>
          </h1>
          <p style={{ color: '#8B7355', fontSize: 12, marginTop: 4 }}>Profesyonel Gayrimenkul Portföy Yönetimi</p>
          <p style={{ color: '#8B7355', fontSize: 11 }}>Çeşme Bölgesi — Lider CRM</p>
        </div>

        {/* DB status */}
        {dbStatus === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#F5F0E8', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#8B7355' }}>
            <Loader2 size={14} className="animate-spin" /> Sunucu bağlantısı kontrol ediliyor...
          </div>
        )}
        {dbStatus === 'ok' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#F0FFF4', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#22A05A' }}>
            <CheckCircle size={14} /> Sunucu bağlantısı başarılı
          </div>
        )}
        {dbStatus === 'error' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 12px', background: '#FFF0EE', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#FF3B2F' }}>
            <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{dbError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="label">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Şifre</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-10"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 touch-compact"
                style={{ color: '#8B7355' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-gold w-full justify-center mt-2" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Giriş Yap'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: '#D4C9B8' }} />
          <span style={{ color: '#8B7355', fontSize: 11 }}>İpucu</span>
          <div style={{ flex: 1, height: 1, background: '#D4C9B8' }} />
        </div>

        <p style={{ color: '#8B7355', fontSize: 11, textAlign: 'center' }}>
          Kullanıcı adı ve şifreniz için yöneticinizle iletişime geçin.
        </p>
      </div>
    </div>
  );
}
