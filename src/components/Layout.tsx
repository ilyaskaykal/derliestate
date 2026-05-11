import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Building2, Calendar, BarChart3, Settings, Crown, LogOut, X,
  Database, MessageSquare, LayoutGrid, ChevronLeft, MoreHorizontal, Dices, Instagram, Landmark,
  CheckSquare, FileText, Home, ClipboardList, Navigation,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROL_LABELS, isAdminLevel, isStaff, isGuest } from '../types';
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

const sidebarItems: { id: Page; label: string; icon: React.ElementType; iconColor: string }[] = [
  { id: 'anasayfa',         label: 'Anasayfa',         icon: Home,           iconColor: '#D4AF37' },
  { id: 'customers',        label: 'Müşteriler',       icon: Users,          iconColor: '#D4AF37' },
  { id: 'portfolio',        label: 'Portföyler',       icon: Building2,      iconColor: '#C8804B' },
  { id: 'tapu-sorgulama',   label: 'İçeri Verilenler', icon: Landmark,       iconColor: '#D4AF37' },
  { id: 'eids-yonetim',    label: 'EİDS Yönetimi',    icon: ClipboardList,  iconColor: '#D4AF37' },
  { id: 'instagram',        label: 'Instagram',        icon: Instagram,      iconColor: '#8B7355' },
  { id: 'veri-havuzu',      label: 'Veri Havuzu',      icon: Database,       iconColor: '#8B7355' },
  { id: 'mesajlasma',       label: 'Mesajlaşma',       icon: MessageSquare,  iconColor: '#8B7355' },
  { id: 'aktivite',         label: 'Aktivite Tahtası', icon: LayoutGrid,     iconColor: '#8B7355' },
  { id: 'appointments',     label: 'Randevular',       icon: Calendar,       iconColor: '#8B7355' },
  { id: 'gorevler',         label: 'Görevler',         icon: CheckSquare,    iconColor: '#8B7355' },
  { id: 'belgeler',         label: 'Belgeler',         icon: FileText,       iconColor: '#8B7355' },
  { id: 'reports',          label: 'Raporlar',         icon: BarChart3,      iconColor: '#8B7355' },
  { id: 'kura',             label: 'Kura Çekilişi',    icon: Dices,          iconColor: '#8B7355' },
  { id: 'rota-planlayici', label: 'Rota Planlayıcı',  icon: Navigation,     iconColor: '#8B7355' },
  { id: 'settings',        label: 'Ayarlar',          icon: Settings,       iconColor: '#8B7355' },
];

const bottomPrimary: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'anasayfa',    label: 'Ana Sayfa',  icon: Home },
  { id: 'customers',   label: 'Müşteriler', icon: Users },
  { id: 'portfolio',   label: 'Portföyler', icon: Building2 },
  { id: 'mesajlasma',  label: 'Mesaj',      icon: MessageSquare },
];

const bottomOverflow: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'veri-havuzu',    label: 'Havuz',           icon: Database },
  { id: 'tapu-sorgulama', label: 'İçeri Verilenler', icon: Landmark },
  { id: 'eids-yonetim',  label: 'EİDS Yönetim',    icon: ClipboardList },
  { id: 'instagram',      label: 'Instagram',      icon: Instagram },
  { id: 'aktivite',       label: 'Aktivite',       icon: LayoutGrid },
  { id: 'appointments',   label: 'Randevular',     icon: Calendar },
  { id: 'gorevler',       label: 'Görevler',       icon: CheckSquare },
  { id: 'belgeler',       label: 'Belgeler',       icon: FileText },
  { id: 'reports',        label: 'Raporlar',       icon: BarChart3 },
  { id: 'kura',           label: 'Kura Çekilişi',  icon: Dices },
  { id: 'rota-planlayici', label: 'Rota',           icon: Navigation },
  { id: 'settings',        label: 'Ayarlar',        icon: Settings },
];

const PAGE_LABELS: Partial<Record<Page, string>> = {
  anasayfa:         'Anasayfa',
  customers:        'Müşteriler',
  portfolio:        'Portföyler',
  'veri-havuzu':    'Veri Havuzu',
  'tapu-sorgulama': 'İçeri Verilenler',
  'eids-yonetim':   'EİDS Yönetimi',
  instagram:        'Instagram İlanları',
  mesajlasma:       'Mesajlaşma',
  aktivite:         'Aktivite Tahtası',
  kura:             'Kura Çekilişi',
  appointments:     'Randevular',
  gorevler:         'Görevler',
  belgeler:         'Belgeler',
  reports:          'Raporlar',
  settings:         'Ayarlar',
  admin:            'Admin Panel',
  'rota-planlayici': 'Rota Planlayıcı',
};

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
  } catch { /* ignore if AudioContext blocked */ }
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, effectiveUser, viewAsUser, setViewAsUser, logout } = useAuth();
  const { toast } = useToast();
  const [showMore, setShowMore] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Notification permission prompt + iOS install banner
  useEffect(() => {
    if (!effectiveUser?.id) return;

    // iOS detection: not standalone and is iOS Safari
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = ('standalone' in navigator) && (navigator as Navigator & { standalone: boolean }).standalone;
    if (isIos && !isStandalone) setShowIosBanner(true);

    if (!('Notification' in window)) return;

    setNotifPermission(Notification.permission);

    if (Notification.permission === 'default') {
      const t = setTimeout(() => {
        Notification.requestPermission().then((perm) => {
          setNotifPermission(perm);
          if (perm === 'granted') toast('Bildirimler aktif edildi!', 'success');
        });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [effectiveUser?.id, toast]);

  const markChatRead = useCallback(async () => {
    if (!effectiveUser?.id) return;
    setUnreadMessages(0);
    if ('clearAppBadge' in navigator) (navigator as Navigator & { clearAppBadge(): Promise<void> }).clearAppBadge().catch(() => {});
    await supabase
      .from('kullanicilar')
      .update({ son_mesaj_okundu: new Date().toISOString() })
      .eq('id', effectiveUser.id);
  }, [effectiveUser?.id]);

  // Fetch DB-based unread count on mount / user change
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
      const n = count ?? 0;
      setUnreadMessages(n);
      if ('setAppBadge' in navigator && n > 0) {
        (navigator as Navigator & { setAppBadge(n: number): Promise<void> }).setAppBadge(n).catch(() => {});
      }
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
          setUnreadMessages(n => {
            const next = n + 1;
            if ('setAppBadge' in navigator) {
              (navigator as Navigator & { setAppBadge(n: number): Promise<void> }).setAppBadge(next).catch(() => {});
            }
            return next;
          });
          playPing();
          const preview = msg.tip === 'voice' ? 'Sesli mesaj' : (msg.mesaj?.slice(0, 60) || '');
          toast(
            `${msg.kullanici_adi}: ${preview}`,
            'message',
            () => navigate('mesajlasma'),
          );
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(`${msg.kullanici_adi}`, {
              body: preview,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'derliestate-message',
            } as NotificationOptions);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [effectiveUser?.id, toast]);

  const showAdmin = viewAsUser ? isAdminLevel(user?.rol) : isAdminLevel(effectiveUser?.rol);
  const isAdminRole = viewAsUser ? user?.rol === 'admin' : effectiveUser?.rol === 'admin';
  const isGuestRole = isGuest(effectiveUser?.rol);

  const GUEST_PAGES: Page[] = ['anasayfa', 'portfolio', 'instagram'];
  const visibleSidebarItems = sidebarItems.filter(item => {
    if (isGuestRole) return GUEST_PAGES.includes(item.id);
    return item.id !== 'settings' || isAdminRole;
  });

  const navigate = useCallback((p: Page) => {
    if (p === 'mesajlasma') markChatRead();
    onNavigate(p);
    setShowMore(false);
  }, [onNavigate, markChatRead]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FEF9F0' }}>
      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex w-60 flex-col shrink-0"
        style={{
          background: 'linear-gradient(180deg, #1A1A18 0%, #78350F 100%)',
          borderRight: '1px solid #2C2C2A',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid #2C2C2A' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                background: '#1A1A18',
                border: '2px solid #D4AF37',
              }}
            >
              <img
                src="/logo.png"
                alt="Derli Emlak"
                className="w-7 h-7 object-contain"
                style={{ filter: 'brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(400%) hue-rotate(5deg)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <span
              className="font-serif text-lg font-bold tracking-wide"
              style={{ color: '#F5F0E8', fontFamily: '"Times New Roman", Times, serif' }}
            >
              DerliEstate Pro
            </span>
          </div>
          <div
            className="mt-3 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wider flex items-center gap-1.5"
            style={{ background: 'rgba(212,175,55,0.08)', color: '#8B7355', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#D4AF37' }} />
            PREMIUM CRM
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleSidebarItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`nav-link w-full text-left ${isActive ? 'active' : ''}`}
              >
                <Icon
                  size={17}
                  style={{ color: isActive ? '#D4AF37' : item.iconColor, opacity: isActive ? 1 : 0.8 }}
                />
                {item.label}
                {item.id === 'mesajlasma' && unreadMessages > 0 && (
                  <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center"
                    style={{ background: '#D4AF37', color: '#1A1A18', fontSize: '10px' }}
                  >
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
          {showAdmin && (
            <button
              onClick={() => onNavigate('admin')}
              className={`nav-link w-full text-left ${currentPage === 'admin' ? 'active' : ''}`}
            >
              <Crown size={17} style={{ color: currentPage === 'admin' ? '#D4AF37' : '#8B7355', opacity: currentPage === 'admin' ? 1 : 0.8 }} />
              <span>Admin Panel</span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}
              >
                Admin
              </span>
            </button>
          )}
        </nav>

        {/* User card */}
        <div className="p-3" style={{ borderTop: '1px solid #2C2C2A' }}>
          <div
            className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2C2C2A' }}
          >
            <UserAvatar
              name={`${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim() || '?'}
              fotoUrl={effectiveUser?.foto_url}
              size={32}
              className="rounded-xl"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight" style={{ color: '#F5F0E8' }}>
                {effectiveUser?.ad} {effectiveUser?.soyad}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: '#8B7355' }}>
                {effectiveUser?.rol ? ROL_LABELS[effectiveUser.rol] ?? effectiveUser.rol : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-1 px-1">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ color: 'rgba(255,80,80,0.8)', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.2)' }}
            >
              <LogOut size={13} />
              Çıkış
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header */}
        <div
          className="md:hidden flex items-center gap-2 px-3 py-2.5 shrink-0"
          style={{
            background: '#1A1A18',
            borderBottom: '1px solid #2C2C2A',
          }}
        >
          {currentPage !== 'anasayfa' ? (
            <button
              onClick={() => onNavigate('anasayfa')}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0"
              style={{ color: '#D4AF37', background: 'rgba(212,175,55,0.1)' }}
              aria-label="Geri"
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#1A1A18', border: '2px solid #D4AF37' }}
            >
              <img
                src="/logo.png"
                alt="Derli Emlak"
                className="w-5 h-5 object-contain"
                style={{ filter: 'brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(400%) hue-rotate(5deg)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          <span className="flex-1 font-semibold text-sm truncate" style={{ color: '#F5F0E8', fontFamily: '"Times New Roman", Times, serif' }}>
            {PAGE_LABELS[currentPage] || 'DerliEstate Pro'}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSwitcher />
            <UserAvatar
              name={`${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim() || '?'}
              fotoUrl={effectiveUser?.foto_url}
              size={32}
              className="rounded-xl"
            />
            <button
              onClick={logout}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
              style={{ color: 'rgba(255,80,80,0.8)' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* View-as banner */}
        {viewAsUser && (
          <div
            className="px-3 md:px-4 py-2 flex items-center justify-between shrink-0 gap-2"
            style={{ background: '#D4AF37' }}
          >
            <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-black min-w-0">
              <Crown size={14} className="shrink-0" />
              <span className="truncate">
                Görüntüleniyor: <strong>{viewAsUser.ad} {viewAsUser.soyad}</strong>
              </span>
            </div>
            <button
              onClick={() => setViewAsUser(null)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-black shrink-0 transition-colors"
              style={{ background: 'rgba(0,0,0,0.15)' }}
            >
              <X size={12} />
              Geri
            </button>
          </div>
        )}

        {/* Notifications denied banner */}
        {notifPermission === 'denied' && (
          <div
            className="px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 text-xs font-medium"
            style={{ background: 'rgba(255,59,47,0.08)', borderBottom: '1px solid rgba(255,59,47,0.2)', color: '#C0392B' }}
          >
            <span>Bildirimler kapalı. Ayarlar &rarr; DerliEstate &rarr; Bildirimleri Ac</span>
            <button onClick={() => setNotifPermission(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        {/* iOS install banner */}
        {showIosBanner && (
          <div
            className="px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 text-xs font-medium"
            style={{ background: 'rgba(212,175,55,0.08)', borderBottom: '1px solid rgba(212,175,55,0.2)', color: '#8B7355' }}
          >
            <span>iPhone'da bildirim almak icin: Safari &rarr; Paylas &rarr; Ana Ekrana Ekle</span>
            <button onClick={() => setShowIosBanner(false)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-[72px] md:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-40"
          style={{
            background: '#1A1A18',
            borderTop: '1px solid #2C2C2A',
            height: '64px',
          }}
        >
          {bottomPrimary.filter(item => !isGuestRole || GUEST_PAGES.includes(item.id)).map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-all min-w-0 relative"
                style={
                  isActive
                    ? { color: '#D4AF37', background: 'rgba(212,175,55,0.1)' }
                    : { color: '#8B7355' }
                }
              >
                <div className="relative">
                  <Icon size={22} />
                  {item.id === 'mesajlasma' && unreadMessages > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full font-bold"
                      style={{
                        background: '#D4AF37',
                        color: '#1A1A18',
                        fontSize: '9px',
                        minWidth: '16px',
                        height: '16px',
                        padding: '0 3px',
                      }}
                    >
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium truncate leading-tight px-0.5">
                  {item.label}
                </span>
                {isActive && (
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                    style={{ width: '24px', height: '2px', background: '#D4AF37' }}
                  />
                )}
              </button>
            );
          })}

          {/* Daha Fazla — hidden for guest roles */}
          {!isGuestRole && <div className="relative flex-1" ref={moreRef}>
            <button
              onClick={() => setShowMore(v => !v)}
              className="w-full h-full flex flex-col items-center justify-center gap-0.5 transition-all"
              style={
                showMore ||
                bottomOverflow.some(i => i.id === currentPage) ||
                (showAdmin && currentPage === 'admin')
                  ? { color: '#D4AF37', background: 'rgba(212,175,55,0.1)' }
                  : { color: '#8B7355' }
              }
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-medium leading-tight">Daha Fazla</span>
            </button>

            {showMore && (
              <div
                className="absolute bottom-full right-0 mb-1 rounded-2xl shadow-2xl overflow-hidden w-52"
                style={{
                  background: '#1A1A18',
                  border: '1px solid #2C2C2A',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                }}
              >
                {bottomOverflow.filter(item => item.id !== 'settings' || isAdminRole).map(item => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-sm font-medium"
                      style={
                        isActive
                          ? { color: '#D4AF37', background: 'rgba(212,175,55,0.12)' }
                          : { color: '#8B7355' }
                      }
                    >
                      <Icon size={17} />
                      {item.label}
                    </button>
                  );
                })}
                {showAdmin && (
                  <button
                    onClick={() => navigate('admin')}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-sm font-medium"
                    style={
                      currentPage === 'admin'
                        ? { color: '#D4AF37', background: 'rgba(212,175,55,0.12)' }
                        : { color: '#8B7355' }
                    }
                  >
                    <Crown size={17} />
                    Admin Panel
                  </button>
                )}
                <div style={{ borderTop: '1px solid #2C2C2A' }}>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-sm font-medium"
                    style={{ color: 'rgba(255,80,80,0.8)' }}
                  >
                    <LogOut size={17} />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>}
        </nav>
      </div>
    </div>
  );
}
