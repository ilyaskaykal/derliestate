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
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          if (t.type === 'message') {
            return (
              <div
                key={t.id}
                className="flex items-start gap-3 px-4 py-3.5 rounded-2xl shadow-2xl text-sm font-medium min-w-[300px] max-w-[400px] animate-slide-in-right pointer-events-auto cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  background: '#1A1A18',
                  border: '1px solid #D4AF37',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
                onClick={() => { t.onClick?.(); remove(t.id); }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(212,175,55,0.15)' }}
                >
                  <MessageCircle size={16} style={{ color: '#D4AF37' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#D4AF37' }}>Yeni Mesaj</p>
                  <p className="text-sm leading-snug break-words" style={{ color: '#F5F0E8' }}>{t.message}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); remove(t.id); }}
                  className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5"
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
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium min-w-[280px] max-w-[380px] animate-slide-in-right pointer-events-auto"
              style={{
                background: bg,
                border: `1px solid ${borderColor}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <Icon size={16} className="shrink-0" style={{ color: textColor }} />
              <span className="flex-1" style={{ color: textColor }}>{t.message}</span>
              <button onClick={() => remove(t.id)} className="text-slate-500 hover:text-white transition-colors shrink-0">
                <X size={14} />
              </button>
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
