import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Building2, Calendar, BarChart3, Settings, LogOut, X, Menu,
  Database, MessageSquare, LayoutGrid, Dices, Instagram, Landmark,
  CheckSquare, FileText, Home, ClipboardList, Navigation, Bell,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROL_LABELS, isGuest } from '../types';
import type { Page } from '../App';
import UserAvatar from './UserAvatar';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import LanguageSwitcher from './LanguageSwitcher';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'anasayfa',        label: 'Anasayfa',         icon: Home },
  { id: 'customers',       label: 'Müşteriler',        icon: Users },
  { id: 'portfolio',       label: 'Portföyler',        icon: Building2 },
  { id: 'tapu-sorgulama',  label: 'İçeri Verilenler',  icon: Landmark },
  { id: 'eids-yonetim',    label: 'EİDS Yönetimi',     icon: ClipboardList },
  { id: 'instagram',       label: 'Instagram',          icon: Instagram },
  { id: 'veri-havuzu',     label: 'Veri Havuzu',        icon: Database },
  { id: 'mesajlasma',      label: 'Mesajlaşma',         icon: MessageSquare },
  { id: 'aktivite',        label: 'Aktivite Tahtası',   icon: LayoutGrid },
  { id: 'appointments',    label: 'Randevular',         icon: Calendar },
  { id: 'gorevler',        label: 'Görevler',           icon: CheckSquare },
  { id: 'belgeler',        label: 'Belgeler',           icon: FileText },
  { id: 'reports',         label: 'Raporlar',           icon: BarChart3 },
  { id: 'kura',            label: 'Kura Çekilişi',      icon: Dices },
  { id: 'rota-planlayici', label: 'Rota Planlayıcı',   icon: Navigation },
  { id: 'settings',        label: 'Ayarlar',            icon: Settings },
];

// 4 items pinned in bottom nav; rest go in the "Menü" drawer
const BOTTOM_NAV_ITEMS: Page[] = ['anasayfa', 'customers', 'portfolio', 'mesajlasma'];

function playPing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore */ }
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, effectiveUser, viewAsUser, setViewAsUser, logout } = useAuth();
  const { toast } = useToast();
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const markChatRead = useCallback(async () => {
    if (!effectiveUser?.id) return;
    setUnreadMessages(0);
    await supabase
      .from('kullanicilar')
      .update({ son_mesaj_okundu: new Date().toISOString() })
      .eq('id', effectiveUser.id);
  }, [effectiveUser?.id]);

  useEffect(() => {
    if (!effectiveUser?.id) return;
    (async () => {
      const { data: u } = await supabase
        .from('kullanicilar')
        .select('son_mesaj_okundu')
        .eq('id', effectiveUser.id)
        .maybeSingle();
      if (!u?.son_mesaj_okundu) return;
      const { count } = await supabase
        .from('mesajlar')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', u.son_mesaj_okundu)
        .neq('kullanici_id', effectiveUser.id);
      setUnreadMessages(count ?? 0);
    })();
  }, [effectiveUser?.id]);

  useEffect(() => {
    if (currentPage === 'mesajlasma') markChatRead();
  }, [currentPage, markChatRead]);

  useEffect(() => {
    if (!effectiveUser?.id) return;
    const channel = supabase
      .channel('layout-mesajlar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mesajlar' },
        (payload) => {
          const msg = payload.new as { kullanici_id: string; kullanici_adi: string; mesaj: string; tip: string };
          if (msg.kullanici_id === effectiveUser.id) return;
          if (currentPageRef.current === 'mesajlasma') return;
          setUnreadMessages(n => n + 1);
          playPing();
          const preview = msg.tip === 'voice' ? 'Sesli mesaj' : (msg.mesaj?.slice(0, 60) || '');
          toast(`${msg.kullanici_adi}: ${preview}`, 'message', () => navigate('mesajlasma'));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveUser?.id, toast]);

  const isAdminRole = viewAsUser ? user?.rol === 'admin' : effectiveUser?.rol === 'admin';
  const isGuestRole = isGuest(effectiveUser?.rol);
  const GUEST_PAGES: Page[] = ['anasayfa', 'portfolio', 'instagram'];

  const visibleItems = NAV_ITEMS.filter(item => {
    if (isGuestRole) return GUEST_PAGES.includes(item.id);
    return item.id !== 'settings' || isAdminRole;
  });

  const navigate = useCallback((p: Page) => {
    if (p === 'mesajlasma') markChatRead();
    onNavigate(p);
    setMenuDrawerOpen(false);
  }, [onNavigate, markChatRead]);

  const displayName = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
  const rolLabel = ROL_LABELS[effectiveUser?.rol ?? 'danisan'] ?? effectiveUser?.rol ?? '';

  const bottomNavItems = visibleItems.filter(i => BOTTOM_NAV_ITEMS.includes(i.id));
  const drawerItems = visibleItems.filter(i => !BOTTOM_NAV_ITEMS.includes(i.id));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#EEF2F7' }}>

      {/* ═══════════════════════════════════════
          DESKTOP SIDEBAR (hidden on mobile via CSS)
          ═══════════════════════════════════════ */}
      <aside className="desktop-sidebar no-scrollbar">
        {/* Logo */}
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={18} color="#1A1A18" />
            </div>
            <div>
              <div style={{ color: '#F5F0E8', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>DerliEstate</div>
              <div style={{ color: '#D4AF37', fontSize: 10, fontWeight: 600 }}>Pro</div>
            </div>
          </div>
        </div>

        {viewAsUser && (
          <div style={{ margin: '0 12px 8px', padding: '6px 10px', background: 'rgba(232,160,32,0.15)', border: '1px solid rgba(232,160,32,0.4)', borderRadius: 8 }}>
            <div style={{ color: '#E8A020', fontSize: 10, fontWeight: 700 }}>Görüntüleme Modu</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{viewAsUser.ad} {viewAsUser.soyad}</div>
            <button onClick={() => setViewAsUser(null)} style={{ color: '#E8A020', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
              Çıkış Yap →
            </button>
          </div>
        )}

        <nav style={{ padding: '0 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const badge = item.id === 'mesajlasma' && unreadMessages > 0;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`nav-link w-full ${isActive ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <Icon size={16} />
                <span className="flex-1 text-left">{item.label}</span>
                {badge && (
                  <span style={{ background: '#FF3B2F', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 5px', minWidth: 18, textAlign: 'center' }}>
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LanguageSwitcher />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserAvatar name={displayName} fotoUrl={effectiveUser?.foto_url} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#F5F0E8', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ color: '#8B7355', fontSize: 10 }}>{rolLabel}</div>
            </div>
            <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B7355', padding: 4 }} title="Çıkış Yap">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════ */}
      <main className="main-area">

        {/* Mobile Top Bar — hidden on desktop */}
        <div className="mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={15} color="#1A1A18" />
            </div>
            <span style={{ color: '#D4AF37', fontWeight: 800, fontSize: 15, letterSpacing: '0.06em' }}>DERLİ EMLAK</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => navigate('mesajlasma')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: unreadMessages > 0 ? '#D4AF37' : 'rgba(255,255,255,0.5)', padding: 6, position: 'relative', minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Bell size={20} />
              {unreadMessages > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 2, background: '#FF3B2F', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 99, padding: '1px 4px', minWidth: 16, textAlign: 'center', lineHeight: '14px' }}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </button>
            <UserAvatar name={displayName} fotoUrl={effectiveUser?.foto_url} size={30} />
          </div>
        </div>

        {/* Page content */}
        <div className="page-content">
          {children}
        </div>
      </main>

      {/* ═══════════════════════════════════════
          MOBILE BOTTOM NAVIGATION — hidden on desktop
          ═══════════════════════════════════════ */}
      <nav className="mobile-bottom-nav">
        {bottomNavItems.map(item => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const badge = item.id === 'mesajlasma' && unreadMessages > 0;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
            >
              {isActive && <span className="bottom-nav-indicator" />}
              <div style={{ position: 'relative' }}>
                <Icon size={20} />
                {badge && (
                  <span style={{ position: 'absolute', top: -4, right: -6, background: '#FF3B2F', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 99, padding: '1px 4px', minWidth: 15, textAlign: 'center', lineHeight: '13px' }}>
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>
              <span className="bottom-nav-label">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}

        {/* Menü button — opens bottom drawer */}
        <button
          onClick={() => setMenuDrawerOpen(true)}
          className={`bottom-nav-btn ${menuDrawerOpen ? 'active' : ''}`}
        >
          <Menu size={20} />
          <span className="bottom-nav-label">Menü</span>
        </button>
      </nav>

      {/* ═══════════════════════════════════════
          MOBILE MENU BOTTOM DRAWER
          ═══════════════════════════════════════ */}
      {menuDrawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMenuDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, backdropFilter: 'blur(2px)' }}
            className="md:hidden"
          />
          {/* Drawer */}
          <div className="menu-drawer md:hidden">
            {/* Drawer handle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em' }}>MENÜ</span>
              <button onClick={() => setMenuDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 4, minWidth: 32, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
              {drawerItems.map(item => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isActive ? 'rgba(212,175,55,0.15)' : 'transparent',
                      color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.75)',
                      fontSize: 14, fontWeight: isActive ? 700 : 500, fontFamily: 'inherit',
                      textAlign: 'left', marginBottom: 2,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    <Icon size={18} />
                    {item.label}
                    {item.id === 'mesajlasma' && unreadMessages > 0 && (
                      <span style={{ marginLeft: 'auto', background: '#FF3B2F', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 6px' }}>
                        {unreadMessages}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '10px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <UserAvatar name={displayName} fotoUrl={effectiveUser?.foto_url} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#F5F0E8', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                  <div style={{ color: '#8B7355', fontSize: 11 }}>{rolLabel}</div>
                </div>
              </div>
              <LanguageSwitcher />
              <button
                onClick={() => { setMenuDrawerOpen(false); logout(); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,59,47,0.1)', color: '#FF3B2F', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', marginTop: 8 }}
              >
                <LogOut size={16} /> Çıkış Yap
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
