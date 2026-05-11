import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { ChevronDown } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const change = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'rgba(212,168,67,0.1)',
          border: '1px solid rgba(212,168,67,0.25)',
          color: '#d4a843',
        }}
      >
        <span>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 bottom-full mb-2 rounded-xl overflow-hidden z-50 shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #0D0221, #0A0F2E)',
              border: '1px solid rgba(212,168,67,0.25)',
              minWidth: 140,
            }}
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => change(lang.code)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all hover:bg-white/5 text-left"
                style={{ color: lang.code === current.code ? '#d4a843' : 'rgba(230,215,195,0.7)' }}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
                <span className="text-xs ml-auto opacity-60">{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
