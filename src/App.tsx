import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Customers from './pages/Customers';
import Portfolio from './pages/Portfolio';
import Appointments from './pages/Appointments';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import VeriHavuzu from './pages/VeriHavuzu';
import TapuSorgulama from './pages/TapuSorgulama';
import Instagram from './pages/Instagram';
import Mesajlasma from './pages/Mesajlasma';
import AktiviteTahtasi from './pages/AktiviteTahtasi';
import KuraCekilisi from './pages/KuraCekilisi';
import Gorevler from './pages/Gorevler';
import Belgeler from './pages/Belgeler';
import Anasayfa from './pages/Anasayfa';
import EidsYonetim from './pages/EidsYonetim';
import RotaPlanlayici from './pages/RotaPlanlayici';
import InstallPrompt from './components/InstallPrompt';
import VoiceAssistant from './components/VoiceAssistant';
import { isAdminLevel, isStaff, isGuest } from './types';

export type Page =
  | 'anasayfa'
  | 'customers'
  | 'portfolio'
  | 'appointments'
  | 'reports'
  | 'admin'
  | 'settings'
  | 'veri-havuzu'
  | 'tapu-sorgulama'
  | 'instagram'
  | 'mesajlasma'
  | 'aktivite'
  | 'kura'
  | 'gorevler'
  | 'belgeler'
  | 'eids-yonetim'
  | 'rota-planlayici';

function AppInner() {
  const { user, loading, effectiveUser } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState<Page>('anasayfa');

  const isAdmin = effectiveUser?.rol === 'admin';
  const isGuestUser = isGuest(effectiveUser?.rol);

  const GUEST_ALLOWED: Page[] = ['anasayfa', 'portfolio', 'instagram'];
  const STAFF_ONLY: Page[] = ['customers', 'appointments', 'reports', 'admin', 'settings', 'veri-havuzu', 'tapu-sorgulama', 'mesajlasma', 'aktivite', 'kura', 'gorevler', 'belgeler', 'eids-yonetim', 'rota-planlayici'];

  const navigate = (p: Page) => {
    if ((p === 'admin' || p === 'settings') && !isAdmin) {
      toast('Bu sayfaya erisiminiz yok.', 'error');
      return;
    }
    if (isGuestUser && STAFF_ONLY.includes(p)) {
      toast('Bu sayfaya erisiminiz yok.', 'error');
      return;
    }
    setPage(p);
  };

  useEffect(() => {
    if ((page === 'admin' || page === 'settings') && !isAdmin) {
      setPage('anasayfa');
    }
    if (isGuestUser && STAFF_ONLY.includes(page)) {
      setPage('anasayfa');
    }
  }, [isAdmin, isGuestUser, page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060612' }}>
        <div className="flex items-center gap-3" style={{ color: 'rgba(255,107,53,0.7)' }}>
          <div
            className="w-5 h-5 rounded-full animate-spin"
            style={{ border: '2px solid rgba(255,107,53,0.2)', borderTopColor: '#FF6B35' }}
          />
          <span>Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const safePage = (
    ((page === 'admin' || page === 'settings') && !isAdmin) ||
    (isGuestUser && STAFF_ONLY.includes(page))
  ) ? 'anasayfa' : page;

  const renderPage = () => {
    switch (safePage) {
      case 'anasayfa': return <Anasayfa onNavigate={navigate} />;
      case 'customers': return <Customers />;
      case 'portfolio': return <Portfolio />;
      case 'appointments': return <Appointments />;
      case 'reports': return <Reports />;
      case 'admin': return <Admin />;
      case 'settings': return <Settings />;
      case 'veri-havuzu': return <VeriHavuzu />;
      case 'tapu-sorgulama': return <TapuSorgulama />;
      case 'instagram': return <Instagram />;
      case 'mesajlasma': return <Mesajlasma />;
      case 'aktivite': return <AktiviteTahtasi />;
      case 'kura': return <KuraCekilisi />;
      case 'gorevler': return <Gorevler />;
      case 'belgeler': return <Belgeler />;
      case 'eids-yonetim': return <EidsYonetim />;
      case 'rota-planlayici': return <RotaPlanlayici />;
      default: return <Customers />;
    }
  };

  return (
    <Layout currentPage={safePage} onNavigate={navigate}>
      {renderPage()}
      <VoiceAssistant onNavigate={navigate} />
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppInner />
        <InstallPrompt />
      </AuthProvider>
    </ToastProvider>
  );
}
