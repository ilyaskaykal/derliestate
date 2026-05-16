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
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);

    if (isIOS && !isInStandaloneMode) {
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

  if (showAndroid) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9000,
        background: '#1A1A18', border: '1px solid #D4AF37', borderRadius: 16,
        padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: 14 }}>Uygulamayı Yükle</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>DerliEstate Pro'yu ana ekrana ekleyin</div>
        </div>
        <button
          onClick={handleInstall}
          style={{ background: '#D4AF37', color: '#1A1A18', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={16} /> Yükle
        </button>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 9000,
        background: '#1A1A18', border: '1px solid #D4AF37', borderRadius: 16,
        padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: 14 }}>Ana Ekrana Ekle</div>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Share size={16} color="#D4AF37" /> Safari'de <strong style={{ color: '#D4AF37' }}>Paylaş</strong> butonuna dokunun
          </div>
          <div>Ardından <strong style={{ color: '#D4AF37' }}>"Ana Ekrana Ekle"</strong> seçeneğini seçin</div>
        </div>
      </div>
    );
  }

  return null;
}
