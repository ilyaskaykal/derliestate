import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabase';
import { Kullanici } from '../types';
import {
  handleFailedAttempt,
  checkLockout,
  clearFailedAttempts,
  touchActivity,
  isSessionExpired,
  logAction,
} from '../lib/security';

interface AuthContextType {
  user: Kullanici | null;
  viewAsUser: Kullanici | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ error?: string; needsPasswordChange?: boolean }>;
  loginDirect: (userData: Kullanici) => void;
  logout: () => void;
  changePassword: (userId: string, newPassword: string) => Promise<{ error?: string }>;
  setViewAsUser: (user: Kullanici | null) => void;
  effectiveUser: Kullanici | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function ensureSuperadmin() {
  const { data } = await supabase
    .from('kullanicilar')
    .select('id')
    .eq('username', 'superadmin')
    .maybeSingle();

  if (!data) {
    const hashed = await bcrypt.hash('Derli2026!#', 10);
    await supabase.from('kullanicilar').insert({
      username: 'superadmin',
      sifre: hashed,
      ad: 'Gizli',
      soyad: 'Yonetici',
      rol: 'admin',
      ilk_giris: false,
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Kullanici | null>(null);
  const [viewAsUser, setViewAsUser] = useState<Kullanici | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureSuperadmin();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('derliestate_user') || localStorage.getItem('estateiq_user');
    if (!stored) { setLoading(false); return; }

    let parsed: Kullanici | null = null;
    try { parsed = JSON.parse(stored); } catch {
      localStorage.removeItem('derliestate_user');
      localStorage.removeItem('estateiq_user');
      setLoading(false);
      return;
    }

    if (!parsed?.id) { setLoading(false); return; }

    if (isSessionExpired()) {
      localStorage.removeItem('derliestate_user');
      localStorage.removeItem('estateiq_user');
      setLoading(false);
      return;
    }

    supabase
      .from('kullanicilar')
      .select('id, username, ad, soyad, rol, ilk_giris, telefon, foto_url, created_at, sifre_hashed')
      .eq('id', parsed.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const safe = data as unknown as Kullanici;
          localStorage.setItem('derliestate_user', JSON.stringify(safe));
          localStorage.removeItem('estateiq_user');
          setUser(safe);
          touchActivity();
        } else {
          localStorage.removeItem('derliestate_user');
          localStorage.removeItem('estateiq_user');
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    const updateActivity = () => touchActivity();
    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const interval = setInterval(() => {
      if (isSessionExpired()) {
        localStorage.removeItem('derliestate_user');
        setUser(null);
        setViewAsUser(null);
      }
    }, 60000);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, [user]);

  const login = async (username: string, password: string): Promise<{ error?: string; needsPasswordChange?: boolean }> => {
    const lockout = checkLockout(username);
    if (lockout) return { error: lockout };

    // Try exact match first, then case-insensitive fallback
    let data: Record<string, unknown> | null = null;
    let dbError: { message: string } | null = null;

    const res1 = await supabase
      .from('kullanicilar')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();
    data = res1.data as Record<string, unknown> | null;
    dbError = res1.error;

    if (!data && !res1.error) {
      const res2 = await supabase
        .from('kullanicilar')
        .select('*')
        .ilike('username', username.trim())
        .maybeSingle();
      data = res2.data as Record<string, unknown> | null;
      dbError = res2.error;
    }

    if (dbError) return { error: `Veritabanı hatası: ${dbError.message}` };
    if (!data) {
      handleFailedAttempt(username);
      return { error: `Kullanıcı bulunamadı: ${username}` };
    }

    // Support plain-text passwords, bcrypt hashes, and detect hash by prefix
    const storedSifre = String(data.sifre ?? '');
    const isHashed = data.sifre_hashed === true || storedSifre.startsWith('$2');
    let isValid = false;

    if (isHashed && storedSifre.startsWith('$2')) {
      isValid = await bcrypt.compare(password.trim(), storedSifre);
    } else {
      isValid = storedSifre === password.trim();
      if (isValid) {
        // Migrate plain-text password to bcrypt hash
        const hashed = await bcrypt.hash(password.trim(), 10);
        await supabase
          .from('kullanicilar')
          .update({ sifre: hashed, sifre_hashed: true })
          .eq('id', data.id);
      }
    }

    if (!isValid) {
      handleFailedAttempt(username);
      return { error: 'Şifre hatalı.' };
    }

    clearFailedAttempts(username);

    if (data.ilk_giris) {
      return { needsPasswordChange: true };
    }

    const { sifre: _s, sifre_hashed: _sh, ...safeUser } = data as Record<string, unknown> & { sifre?: unknown; sifre_hashed?: unknown };
    const userToStore = safeUser as unknown as Kullanici;
    localStorage.setItem('derliestate_user', JSON.stringify(userToStore));
    localStorage.removeItem('estateiq_user');
    touchActivity();
    setUser(userToStore);
    return {};
  };

  const loginDirect = (userData: Kullanici) => {
    const { sifre: _s, ...safeUser } = userData as Kullanici & { sifre?: string };
    const userToStore = safeUser as Kullanici;
    localStorage.setItem('derliestate_user', JSON.stringify(userToStore));
    localStorage.removeItem('estateiq_user');
    touchActivity();
    setUser(userToStore);
  };

  const logout = () => {
    localStorage.removeItem('derliestate_user');
    localStorage.removeItem('estateiq_user');
    setUser(null);
    setViewAsUser(null);
  };

  const changePassword = async (userId: string, newPassword: string): Promise<{ error?: string }> => {
    const hashed = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from('kullanicilar')
      .update({ sifre: hashed, sifre_hashed: true, ilk_giris: false })
      .eq('id', userId);
    if (error) return { error: 'Şifre güncellenemedi.' };
    if (user) {
      await logAction(user.username, 'password_changed', { target_user_id: userId });
    }
    return {};
  };

  const effectiveUser = viewAsUser || user;

  return (
    <AuthContext.Provider value={{ user, viewAsUser, loading, login, loginDirect, logout, changePassword, setViewAsUser, effectiveUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
