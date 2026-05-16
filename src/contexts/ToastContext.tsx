import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle, XCircle, Info, MessageCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'message';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  onClick?: () => void;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, onClick?: () => void) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success', onClick?: () => void) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type, onClick }]);
    const duration = type === 'message' ? 5000 : 4000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          if (t.type === 'message') {
            return (
              <div
                key={t.id}
                onClick={() => { t.onClick?.(); remove(t.id); }}
                style={{
                  background: '#1A1A18',
                  border: '1px solid #D4AF37',
                  borderRadius: 12,
                  padding: '12px 16px',
                  minWidth: 260,
                  cursor: t.onClick ? 'pointer' : 'default',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                }}
              >
                <MessageCircle size={18} color="#D4AF37" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#D4AF37', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Yeni Mesaj</div>
                  <div style={{ color: '#fff', fontSize: 13 }}>{t.message}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); remove(t.id); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          }

          const Icon = t.type === 'success' ? CheckCircle : t.type === 'error' ? XCircle : Info;
          const bg = t.type === 'success' ? '#22A05A' : t.type === 'error' ? '#FF3B2F' : '#1A1A18';
          const textColor = '#ffffff';
          const borderColor = t.type === 'info' ? '#D4AF37' : 'transparent';

          return (
            <div
              key={t.id}
              style={{
                background: bg,
                border: `1px solid ${borderColor}`,
                borderRadius: 10,
                padding: '10px 16px',
                minWidth: 220,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: textColor,
                fontSize: 14,
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              }}
            >
              <Icon size={16} />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
