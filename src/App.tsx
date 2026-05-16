import { Suspense, lazy, useState, Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import VoiceAssistant from './components/VoiceAssistant';
import InstallPrompt from './components/InstallPrompt';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F0E8', padding: 24 }}>
          <div style={{ maxWidth: 480, width: '100%', background: '#fff', borderRadius: 16, border: '1px solid #F0E8D8', padding: 32, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
            <AlertTriangle size={40} color="#D4AF37" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A18', marginBottom: 8 }}>Bir hata oluştu</h2>
            <p style={{ fontSize: 13, color: '#8B7355', marginBottom: 16, wordBreak: 'break-word' }}>{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#1A1A18', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
            >
              <RefreshCw size={16} /> Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export type Page =
  | 'anasayfa'
  | 'customers'
  | 'portfolio'
  | 'appointments'
  | 'gorevler'
  | 'mesajlasma'
  | 'aktivite'
  | 'reports'
  | 'admin'
  | 'settings'
  | 'belgeler'
  | 'eids-yonetim'
  | 'veri-havuzu'
  | 'instagram'
  | 'kura'
  | 'tapu-sorgulama'
  | 'rota-planlayici';

const Anasayfa = lazy(() => import('./pages/Anasayfa'));
const Customers = lazy(() => import('./pages/Customers'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Gorevler = lazy(() => import('./pages/Gorevler'));
const Mesajlasma = lazy(() => import('./pages/Mesajlasma'));
const AktiviteTahtasi = lazy(() => import('./pages/AktiviteTahtasi'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));
const Settings = lazy(() => import('./pages/Settings'));
const Belgeler = lazy(() => import('./pages/Belgeler'));
const EidsYonetim = lazy(() => import('./pages/EidsYonetim'));
const VeriHavuzu = lazy(() => import('./pages/VeriHavuzu'));
const Instagram = lazy(() => import('./pages/Instagram'));
const KuraCekilisi = lazy(() => import('./pages/KuraCekilisi'));
const TapuSorgulama = lazy(() => import('./pages/TapuSorgulama'));
const RotaPlanlayici = lazy(() => import('./pages/RotaPlanlayici'));

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <Loader2 size={28} className="animate-spin" color="#D4AF37" />
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('anasayfa');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F0E8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, background: '#1A1A18', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid #D4AF37' }}>
            <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: 20 }}>D</span>
          </div>
          <Loader2 size={24} className="animate-spin" color="#D4AF37" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const renderPage = () => {
    switch (currentPage) {
      case 'anasayfa': return <Anasayfa onNavigate={setCurrentPage} />;
      case 'customers': return <Customers />;
      case 'portfolio': return <Portfolio />;
      case 'appointments': return <Appointments />;
      case 'gorevler': return <Gorevler />;
      case 'mesajlasma': return <Mesajlasma />;
      case 'aktivite': return <AktiviteTahtasi />;
      case 'reports': return <Reports />;
      case 'admin': return <Admin />;
      case 'settings': return <Settings />;
      case 'belgeler': return <Belgeler />;
      case 'eids-yonetim': return <EidsYonetim />;
      case 'veri-havuzu': return <VeriHavuzu />;
      case 'instagram': return <Instagram />;
      case 'kura': return <KuraCekilisi />;
      case 'tapu-sorgulama': return <TapuSorgulama />;
      case 'rota-planlayici': return <RotaPlanlayici />;
      default: return <Anasayfa onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <Suspense fallback={<PageFallback />}>
        {renderPage()}
      </Suspense>
      <VoiceAssistant onNavigate={setCurrentPage} />
      <InstallPrompt />
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
