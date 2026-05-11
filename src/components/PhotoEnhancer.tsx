import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, Sparkles, RotateCcw, ZoomIn } from 'lucide-react';

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
  { name: 'Doğal', filters: { brightness: 105, contrast: 108, saturation: 112 } },
  { name: 'Canlı', filters: { brightness: 110, contrast: 120, saturation: 130 } },
  { name: 'Sıcak', filters: { brightness: 108, contrast: 105, saturation: 115, warmth: 15 } },
  { name: 'Profesyonel', filters: { brightness: 103, contrast: 115, saturation: 108 } },
  { name: 'HDR', filters: { brightness: 100, contrast: 135, saturation: 125 } },
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

      if (filters.sharpness > 0) {
        const strength = filters.sharpness / 100;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const kernel = [-1, -1, -1, -1, 8 + 1 / (strength + 0.01), -1, -1, -1, -1];
        const output = new Uint8ClampedArray(data.length);
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c2 = 0; c2 < 3; c2++) {
              let val = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  val += data[((y + ky) * w + (x + kx)) * 4 + c2] * kernel[(ky + 1) * 3 + (kx + 1)];
                }
              }
              output[idx + c2] = Math.min(255, Math.max(0, val));
            }
            output[idx + 3] = data[idx + 3];
          }
        }
        const blended = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.length; i += 4) {
          for (let c2 = 0; c2 < 3; c2++) {
            blended.data[i + c2] = Math.round(data[i + c2] * (1 - strength) + output[i + c2] * strength);
          }
          blended.data[i + 3] = data[i + 3];
        }
        ctx.putImageData(blended, 0, 0);
      }
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

  const sliders: { key: keyof Filters; label: string; min: number; max: number; unit: string }[] = [
    { key: 'brightness', label: 'Parlaklık', min: 50, max: 200, unit: '%' },
    { key: 'contrast', label: 'Kontrast', min: 50, max: 200, unit: '%' },
    { key: 'saturation', label: 'Doygunluk', min: 0, max: 200, unit: '%' },
    { key: 'warmth', label: 'Sıcaklık', min: 0, max: 60, unit: '' },
    { key: 'sharpness', label: 'Keskinlik', min: 0, max: 100, unit: '' },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-3xl">
        <div className="flex items-center justify-between p-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,107,53,0.15)' }}>
          <div className="flex items-center gap-2">
            <ZoomIn size={18} style={{ color: '#FF6B35' }} />
            <h2 className="font-semibold text-white">Fotoğraf İyileştirici</h2>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="modal-body p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Canvas preview */}
          <div className="flex flex-col gap-3">
            <canvas
              ref={canvasRef}
              className="w-full rounded-xl object-contain"
              style={{ maxHeight: 320, border: '1px solid rgba(255,107,53,0.15)', background: '#0a0a1a' }}
            />
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 btn-ghost justify-center gap-1.5">
                <RotateCcw size={14} />Sıfırla
              </button>
              <button onClick={download} disabled={downloading} className="flex-1 btn-gold justify-center gap-1.5">
                <Download size={14} />İndir
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* AI Presets */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={13} style={{ color: '#FFD700' }} />
                <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">AI Hazır Şablonlar</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {AI_PRESETS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="px-2 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.15)', color: 'rgba(230,215,195,0.8)' }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Manual sliders */}
            <div className="space-y-3">
              {sliders.map(slider => (
                <div key={slider.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-dark-400">{slider.label}</label>
                    <span className="text-xs font-mono" style={{ color: '#FF6B35' }}>
                      {filters[slider.key]}{slider.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    value={filters[slider.key]}
                    onChange={e => setFilters(f => ({ ...f, [slider.key]: Number(e.target.value) }))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: '#FF6B35', background: `linear-gradient(to right, #FF6B35 ${((filters[slider.key] - slider.min) / (slider.max - slider.min)) * 100}%, rgba(255,255,255,0.1) 0%)` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
