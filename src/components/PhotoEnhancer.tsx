import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Sparkles, RotateCcw } from 'lucide-react';

interface Props {
  imageUrl: string;
  onClose: () => void;
}

interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  warmth: number;
}

const DEFAULT_FILTERS: Filters = { brightness: 100, contrast: 100, saturation: 100, sharpness: 0, warmth: 0 };

const AI_PRESETS: { name: string; filters: Partial<Filters> }[] = [
  { name: 'Doğal',       filters: { brightness: 105, contrast: 108, saturation: 112 } },
  { name: 'Canlı',       filters: { brightness: 110, contrast: 120, saturation: 130 } },
  { name: 'Sıcak',       filters: { brightness: 108, contrast: 105, saturation: 115, warmth: 15 } },
  { name: 'Profesyonel', filters: { brightness: 103, contrast: 115, saturation: 108 } },
  { name: 'HDR',         filters: { brightness: 100, contrast: 135, saturation: 125 } },
  { name: 'Siyah Beyaz', filters: { saturation: 0, contrast: 120 } },
];

export default function PhotoEnhancer({ imageUrl, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [downloading, setDownloading] = useState(false);

  const applyFilters = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const b = filters.brightness / 100;
      const c = filters.contrast / 100;
      const s = filters.saturation / 100;
      ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) sepia(${filters.warmth / 100})`;
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  }, [imageUrl, filters]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const applyPreset = (preset: (typeof AI_PRESETS)[0]) => {
    setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
  };

  const reset = () => setFilters({ ...DEFAULT_FILTERS });

  const download = () => {
    setDownloading(true);
    const canvas = canvasRef.current;
    if (!canvas) { setDownloading(false); return; }
    const link = document.createElement('a');
    link.download = `enhanced-photo-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
    setDownloading(false);
  };

  const sliders: { key: keyof Filters; label: string; min: number; max: number }[] = [
    { key: 'brightness', label: 'Parlaklık',  min: 50, max: 200 },
    { key: 'contrast',   label: 'Kontrast',   min: 50, max: 200 },
    { key: 'saturation', label: 'Doygunluk',  min: 0,  max: 200 },
    { key: 'warmth',     label: 'Sıcaklık',   min: 0,  max: 60  },
    { key: 'sharpness',  label: 'Keskinlik',  min: 0,  max: 100 },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
          <h2 className="font-bold" style={{ color: '#1A1A18' }}>Fotoğraf Düzenle</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body p-4 flex flex-col gap-4">
          <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, maxHeight: 300, objectFit: 'contain', background: '#000' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} color="#D4AF37" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18' }}>AI Önayarlar</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AI_PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className="btn-ghost"
                  style={{ padding: '4px 12px', fontSize: 12 }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {sliders.map(s => (
            <div key={s.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18' }}>{s.label}</span>
                <span style={{ fontSize: 12, color: '#8B7355' }}>{filters[s.key]}</span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                value={filters[s.key]}
                onChange={e => setFilters(f => ({ ...f, [s.key]: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: '#D4AF37' }}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button onClick={download} className="btn-gold flex-1" disabled={downloading}>
            <Download size={15} /> İndir
          </button>
          <button onClick={reset} className="btn-ghost">
            <RotateCcw size={14} /> Sıfırla
          </button>
        </div>
      </div>
    </div>
  );
}
