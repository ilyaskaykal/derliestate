import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    // Detect iOS Safari
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);

    if (isIOS && !isInStandaloneMode) {
      // Slight delay so user sees the app first
      setTimeout(() => setShowIOS(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowAndroid(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShowAndroid(false);
    setShowIOS(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowAndroid(false);
      setDeferredPrompt(null);
    }
  };

  if (dismissed) return null;

  // Android / Chrome install prompt
  if (showAndroid) {
    return (
      <div
        className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-80 z-50 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'white',
          border: '1px solid #F6D9A8',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="DerliEstate" className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: '#1A1A18' }}>DerliEstate Pro</p>
              <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Ana ekrana ekle ve uygulama gibi kullan</p>
            </div>
            <button onClick={dismiss} className="text-dark-500 hover:text-white p-1 shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={dismiss}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors" style={{ color: '#8B7355', borderColor: '#F6D9A8' }}
            >
              Daha Sonra
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #C8A020)' }}
            >
              <Download size={13} />
              Ana Ekrana Ekle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari instructions
  if (showIOS) {
    return (
      <div
        className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-80 z-50 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'white',
          border: '1px solid #F6D9A8',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <img src="/icon-192.png" alt="DerliEstate" className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: '#1A1A18' }}>Ana Ekrana Ekle</p>
              <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>DerliEstate'i uygulama olarak kullan</p>
            </div>
            <button onClick={dismiss} className="text-dark-500 hover:text-white p-1 shrink-0">
              <X size={16} />
            </button>
          </div>
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: '#FDF3E3', border: '1px solid #F6D9A8' }}
          >
            <div className="flex items-center gap-2.5 text-xs" style={{ color: '#1A1A18' }}>
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-[10px]"
                style={{ background: '#D4AF37' }}
              >1</span>
              <span>Safari'de alt menüden</span>
              <Share size={14} className="text-blue-400 shrink-0" />
              <span className="text-blue-400 font-semibold">Paylaş</span>
              <span>butonuna bas</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs" style={{ color: '#1A1A18' }}>
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shrink-0 text-[10px]"
                style={{ background: '#D4AF37' }}
              >2</span>
              <span>
                <span className="text-white font-semibold">"Ana Ekrana Ekle"</span>
                {' '}seçeneğine dokun
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
