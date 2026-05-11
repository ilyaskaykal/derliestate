import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, AlertTriangle, CheckCircle, WifiOff, Phone, ArrowLeft, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { checkLockout } from '../lib/security';

type LoginTab = 'username' | 'phone';

export default function Login() {
  const { login, loginDirect, changePassword } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<LoginTab>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  const [otpCode, setOtpCode] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  const [forceChange, setForceChange] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('');
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
      setDbError('Supabase ortam değişkenleri eksik. Netlify ortam değişkenlerini kontrol edin (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).');
      return;
    }

    supabase
      .from('kullanicilar')
      .select('count', { count: 'exact', head: true })
      .then(({ error }) => {
        if (error) {
          setDbStatus('error');
          setDbError(`Veritabanı bağlantı hatası: ${error.message} (${error.code})`);
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
        setTempPassword(password.trim());
        setForceChange(true);
        return;
      }
      if (result.error) toast(result.error, 'error');
    } catch (err) {
      toast('Beklenmeyen hata: ' + JSON.stringify(err), 'error');
      setLoading(false);
    }
  };

  const formatPhone = (input: string): string => {
    let cleaned = input.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    if (!cleaned.startsWith('+')) cleaned = '+90' + cleaned;
    return cleaned;
  };

  const startOtpTimer = () => {
    setOtpTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    const formatted = formatPhone(phone);
    console.log('[SMS] Sending to:', formatted);

    if (!/^\+90\d{10}$/.test(formatted)) {
      setPhoneError('Geçerli bir numara girin: +90XXXXXXXXXX');
      return;
    }

    setPhoneLoading(true);
    try {
      const { data: dbUser } = await supabase
        .from('kullanicilar')
        .select('id')
        .eq('telefon', formatted)
        .neq('username', 'superadmin')
        .maybeSingle();

      if (!dbUser) {
        setPhoneError('Bu telefon numarası kayıtlı değil.');
        setPhoneLoading(false);
        return;
      }

      const res = await fetch('/.netlify/functions/sms-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: formatted }),
      });
      const data = await res.json() as { status?: string; error?: string };
      console.log('[SMS] Send response:', data);

      if (data.status === 'pending') {
        setPhone(formatted); // store normalized form
        setPhoneStep('otp');
        setOtpCode('');
        startOtpTimer();
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } else {
        setPhoneError(data.error || 'SMS gönderilemedi, tekrar deneyin.');
      }
    } catch (err) {
      console.error('[SMS] Send error:', err);
      setPhoneError('SMS gönderilemedi, tekrar deneyin.');
    }
    setPhoneLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (otpCode.length !== 6) { setPhoneError('6 haneli kodu girin.'); return; }

    setPhoneLoading(true);
    try {
      const normalized = phone.trim();
      const code = otpCode.trim();
      console.log('[SMS] Verifying:', { phone: normalized, code });

      const res = await fetch('/.netlify/functions/sms-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone: normalized, code }),
      });
      const data = await res.json() as { status?: string; error?: string; message?: string; _debug?: unknown };
      console.log('=== SMS VERIFY DEBUG ===');
      console.log('Phone:', normalized);
      console.log('Code entered:', code);
      console.log('Full response:', JSON.stringify(data, null, 2));

      // Show raw Twilio response as alert for diagnosis
      alert('Twilio Yanıtı:\n' + JSON.stringify(data, null, 2));

      if (data.error || (data.status !== 'approved' && data.status !== 'pending')) {
        const errorMsg = data.error || data.message || data.status || 'unknown';
        setPhoneError(`Doğrulama hatası: ${errorMsg}`);
        setPhoneLoading(false);
        return;
      }

      if (data.status !== 'approved') {
        setPhoneError(
          data.status === 'expired'
            ? 'Kod süresi doldu. Yeni kod isteyin.'
            : `Kod yanlış veya süresi dolmuş. (${data.status ?? 'unknown'})`
        );
        setPhoneLoading(false);
        return;
      }

      // OTP approved — fetch full user record and log in directly
      const { data: dbUser } = await supabase
        .from('kullanicilar')
        .select('id, username, ad, soyad, rol, ilk_giris, telefon, foto_url, created_at, sifre_hashed')
        .eq('telefon', normalized)
        .neq('username', 'superadmin')
        .maybeSingle();

      if (!dbUser) {
        setPhoneError('Kullanıcı bulunamadı.');
        setPhoneLoading(false);
        return;
      }

      if (dbUser.ilk_giris) {
        // Need password change — but we don't have the password here.
        // Set a flag so the password change screen appears; use empty temp password
        // since the user will set a new one anyway.
        setTempUsername(dbUser.username);
        setTempPassword('__sms_verified__');
        setPhoneLoading(false);
        setForceChange(true);
        return;
      }

      loginDirect(dbUser as Parameters<typeof loginDirect>[0]);
    } catch (err) {
      console.error('[SMS] Verify error:', err);
      setPhoneError('Doğrulama başarısız, tekrar deneyin.');
    }
    setPhoneLoading(false);
  };

  const handleResendCode = async () => {
    setPhoneError('');
    setPhoneLoading(true);
    try {
      const res = await fetch('/.netlify/functions/sms-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: phone.trim() }),
      });
      const data = await res.json() as { status?: string; error?: string };
      console.log('[SMS] Resend response:', data);
      if (data.status === 'pending') {
        startOtpTimer();
        setOtpCode('');
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } else {
        setPhoneError(data.error || 'SMS gönderilemedi.');
      }
    } catch (err) {
      console.error('[SMS] Resend error:', err);
      setPhoneError('SMS gönderilemedi.');
    }
    setPhoneLoading(false);
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
        if (tempPassword === '__sms_verified__') {
          // Came from SMS login — log in directly
          loginDirect({ ...userData, ilk_giris: false } as Parameters<typeof loginDirect>[0]);
        } else {
          await login(tempUsername, newPass);
        }
      }
    }
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast(`${provider === 'google' ? 'Google' : 'Apple'} girişi başarısız: ${error.message}`, 'error');
      setSocialLoading(null);
    }
  };

  const BgDecorations = () => (
    <>
      {/* Floating orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Gold particles */}
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`particle particle-${i + 1}`} />
      ))}

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,215,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </>
  );

  const tabBtn = (id: LoginTab, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => { setTab(id); setPhoneError(''); setPhoneStep('phone'); setOtpCode(''); }}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
      style={
        tab === id
          ? { background: '#1A1A18', color: '#F5F0E8', border: '1px solid #D4AF37' }
          : { color: '#8B7355', background: 'transparent' }
      }
    >
      {icon}
      {label}
    </button>
  );

  if (forceChange) {
    return (
      <div className="min-h-screen login-bg flex items-center justify-center p-4 relative overflow-hidden">
        <BgDecorations />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: '#1A1A18', border: '2px solid #D4AF37' }}
              >
                <img src="/logo.png" alt="" className="w-9 h-9 object-contain" style={{ filter: 'brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(400%) hue-rotate(5deg)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span className="text-2xl font-bold" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>DerliEstate Pro</span>
            </div>
            <h1 className="text-xl font-semibold" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>Şifre Değiştir</h1>
            <p className="text-sm mt-1" style={{ color: '#8B7355' }}>İlk girişte yeni şifre belirlemeniz gerekiyor.</p>
          </div>
          <div className="glass-card rounded-2xl p-7">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="label">Yeni Şifre</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} className="input pr-10" placeholder="En az 6 karakter" value={newPass} onChange={e => setNewPass(e.target.value)} required />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#8B7355' }} onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Şifre Tekrar</label>
                <input type="password" className="input" placeholder="Şifrenizi tekrar girin" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-gold w-full justify-center py-3">
                {loading ? <><Loader2 className="animate-spin" size={16} />Güncelleniyor...</> : 'Şifremi Güncelle ve Giriş Yap'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen login-bg flex items-center justify-center p-4 relative overflow-hidden">
      <BgDecorations />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-4 mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: '#1A1A18', border: '2px solid #D4AF37', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
            >
              <img
                src="/logo.png"
                alt="Derli Emlak"
                className="w-10 h-10 object-contain"
                style={{ filter: 'brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(400%) hue-rotate(5deg)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="text-left">
              <span
                className="text-3xl font-bold block"
                style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}
              >
                DerliEstate
              </span>
              <span
                className="text-sm font-bold tracking-[0.2em] uppercase"
                style={{ color: '#D4AF37' }}
              >
                Pro
              </span>
            </div>
          </div>
          <p className="text-sm tracking-wide" style={{ color: '#8B7355' }}>
            Profesyonel Gayrimenkul Portföy Yönetimi
          </p>
          <div
            className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: '#8B7355' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#D4AF37' }} />
            Çeşme Bölgesi — Lider CRM
          </div>
        </div>

        {/* Status banners */}
        {dbStatus === 'checking' && (
          <div
            className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-xs"
            style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', color: '#8B7355' }}
          >
            <Loader2 size={13} className="animate-spin shrink-0" />
            Sunucu bağlantısı kontrol ediliyor...
          </div>
        )}
        {dbStatus === 'ok' && (
          <div
            className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl text-xs"
            style={{ background: 'rgba(34,160,90,0.06)', border: '1px solid rgba(34,160,90,0.2)', color: '#22A05A' }}
          >
            <CheckCircle size={13} className="shrink-0" />
            Sunucu bağlantısı başarılı
          </div>
        )}
        {dbStatus === 'error' && (
          <div
            className="flex items-start gap-2 mb-4 px-4 py-3 rounded-xl text-xs"
            style={{ background: '#FFF0EE', border: '1px solid rgba(255,59,47,0.3)', color: '#C0392B' }}
          >
            <WifiOff size={13} className="shrink-0 mt-0.5" />
            <span>{dbError}</span>
          </div>
        )}

        {/* Login card */}
        <div className="glass-card rounded-2xl p-7">
          {/* Card header line */}
          <div
            className="h-px w-full mb-6 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }}
          />

          <h2
            className="text-lg font-bold mb-5"
            style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}
          >
            Hesabınıza Giriş Yapın
          </h2>

          {/* Tab switcher */}
          <div
            className="flex gap-1.5 rounded-xl p-1 mb-6"
            style={{ background: '#EFEBE4', border: '0.5px solid #D4C9B8' }}
          >
            {tabBtn('username', <Eye size={14} />, 'Kullanıcı Adı')}
            {tabBtn('phone', <Phone size={14} />, 'Telefon ile')}
          </div>

          {dbStatus === 'error' && (
            <div
              className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: '#FFF0EE', border: '1px solid rgba(255,59,47,0.2)', color: '#C0392B' }}
            >
              <AlertTriangle size={13} className="shrink-0" />
              Veritabanına ulaşılamıyor. Giriş şu an çalışmayabilir.
            </div>
          )}

          {/* Username / password */}
          {tab === 'username' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Kullanıcı Adı</label>
                <input
                  type="text"
                  className="input"
                  placeholder="kullanici_adi"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>
              <div>
                <label className="label">Şifre</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#8B7355' }}
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading || dbStatus === 'error'} className="btn-gold w-full justify-center py-3 mt-2">
                {loading ? <><Loader2 className="animate-spin" size={16} />Giriş yapılıyor...</> : 'Giriş Yap'}
              </button>
              <p className="text-center text-xs mt-3" style={{ color: '#A89880', fontStyle: 'italic' }}>
                Misafir girişi için: <span style={{ color: '#8B7355' }}>derli</span> / <span style={{ color: '#8B7355' }}>3535</span>
              </p>
            </form>
          )}

          {/* Phone OTP — Step 1: enter phone */}
          {tab === 'phone' && phoneStep === 'phone' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              {phoneError && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: '#FFF0EE', border: '1px solid rgba(255,59,47,0.2)', color: '#C0392B' }}
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{phoneError}</span>
                </div>
              )}
              <div>
                <label className="label">Telefon Numarası</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8B7355' }} />
                  <input
                    type="tel"
                    className="input pl-9"
                    placeholder="+905XXXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: '#A89880' }}>
                  Örnek: +905321234567
                </p>
              </div>
              <button type="submit" disabled={phoneLoading || dbStatus === 'error'} className="btn-gold w-full justify-center py-3 mt-2">
                {phoneLoading ? (
                  <><Loader2 className="animate-spin" size={16} />Kontrol ediliyor...</>
                ) : (
                  <><MessageSquare size={16} />Kod Gönder</>
                )}
              </button>
            </form>
          )}

          {/* Phone OTP — Step 2: enter OTP */}
          {tab === 'phone' && phoneStep === 'otp' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => { setPhoneStep('phone'); setPhoneError(''); setOtpCode(''); if (timerRef.current) clearInterval(timerRef.current); }}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: '#8B7355' }}
                >
                  <ArrowLeft size={13} />
                  Geri
                </button>
                <span className="text-xs" style={{ color: '#A89880' }}>
                  {phone} numarasına SMS gönderildi
                </span>
              </div>

              {phoneError && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                  style={{ background: '#FFF0EE', border: '1px solid rgba(255,59,47,0.2)', color: '#C0392B' }}
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{phoneError}</span>
                </div>
              )}

              <div>
                <label className="label">6 Haneli Doğrulama Kodu</label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="input text-center text-2xl tracking-[0.5em] font-bold"
                  placeholder="——————"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  required
                />
              </div>

              <div className="text-center">
                {otpTimer > 0 ? (
                  <p className="text-xs" style={{ color: '#A89880' }}>
                    Kod {otpTimer} saniye içinde gelmezse tekrar gönderin
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={phoneLoading}
                    className="text-xs font-semibold transition-colors"
                    style={{ color: '#D4AF37' }}
                  >
                    Kodu Tekrar Gönder
                  </button>
                )}
              </div>

              <button type="submit" disabled={phoneLoading || otpCode.length !== 6} className="btn-gold w-full justify-center py-3 mt-1">
                {phoneLoading ? (
                  <><Loader2 className="animate-spin" size={16} />Doğrulanıyor...</>
                ) : (
                  <><CheckCircle size={16} />Doğrula ve Giriş Yap</>
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: '#D4C9B8' }} />
            <span className="text-xs" style={{ color: '#A89880' }}>veya</span>
            <div className="flex-1 h-px" style={{ background: '#D4C9B8' }} />
          </div>

          {/* Social login */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'white', border: '0.5px solid #D4C9B8', color: '#1A1A18' }}
            >
              {socialLoading === 'google' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Google ile Giriş Yap
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('apple')}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'white', border: '0.5px solid #D4C9B8', color: '#1A1A18' }}
            >
              {socialLoading === 'apple' ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.28.07 2.16.71 2.94.73.99-.14 1.93-.8 2.98-.86 1.28.09 2.24.59 2.86 1.56-2.58 1.6-1.99 5.1.72 6.15-.6 1.45-1.28 2.91-2.5 4.3zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Apple ile Giriş Yap
            </button>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: '#A89880' }}>
            Kullanıcı adı ve şifreniz için yöneticinizle iletişime geçin.
          </p>

          {/* Bottom accent line */}
          <div
            className="h-px w-full mt-6 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-4" style={{ color: 'rgba(247,197,159,0.25)' }}>
          DerliEstate Pro — Çeşme Bölgesi Gayrimenkul CRM
        </p>
      </div>
    </div>
  );
}
