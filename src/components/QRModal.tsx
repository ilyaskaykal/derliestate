import { useState, useEffect, useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import type { Portfoy } from '../types';
import { displayPrice } from './PriceInput';

interface Props {
  portfoy: Portfoy;
  onClose: () => void;
}

export default function QRModal({ portfoy, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = `${window.location.origin}/portfoy/${portfoy.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#1A1A18', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [url]);

  const download = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qr-${portfoy.isim.replace(/\s+/g, '-')}.png`;
    a.click();
  };

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><body style="margin:0;background:#fff;display:flex;flex-direction:column;align-items:center;padding:40px;font-family:sans-serif">
        <img src="${qrDataUrl}" style="width:280px;height:280px" />
        <h2 style="margin-top:20px;font-size:18px;color:#000">${portfoy.isim}</h2>
        ${portfoy.fiyat ? `<p style="font-size:16px;color:#D4AF37;font-weight:bold">${displayPrice(portfoy.fiyat, (portfoy.para_birimi as 'TL' | 'USD' | 'EUR') || 'TL')}</p>` : ''}
        ${portfoy.bolge ? `<p style="color:#666">${portfoy.bolge}</p>` : ''}
        <p style="color:#999;font-size:12px;margin-top:16px">DerliEstate Pro - Çeşme Bölgesi</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#D4C9B8' }}>
          <h2 className="font-semibold" style={{ color: '#1A1A18' }}>QR Kod</h2>
          <button onClick={onClose} className="text-dark-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          {qrDataUrl ? (
            <div className="p-3 rounded-2xl" style={{ background: 'white', border: '1px solid #D4C9B8' }}>
              <img src={qrDataUrl} alt="QR" style={{ width: 240, height: 240, borderRadius: 8 }} />
            </div>
          ) : (
            <div className="w-60 h-60 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid #D4C9B8' }}>
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(212,175,55,0.2)', borderTopColor: '#D4AF37' }} />
            </div>
          )}

          <div className="text-center">
            <p className="font-semibold" style={{ color: '#1A1A18' }}>{portfoy.isim}</p>
            {portfoy.fiyat && (
              <p className="text-sm font-bold mt-0.5" style={{ color: '#D4AF37' }}>
                {displayPrice(portfoy.fiyat, (portfoy.para_birimi as 'TL' | 'USD' | 'EUR') || 'TL')}
              </p>
            )}
            <p className="text-xs mt-1.5 break-all" style={{ color: '#8B7355' }}>{url}</p>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="flex gap-3 w-full">
            <button
              onClick={download}
              disabled={!qrDataUrl}
              className="btn-gold flex-1 justify-center disabled:opacity-40"
            >
              <Download size={15} />İndir
            </button>
            <button
              onClick={print}
              disabled={!qrDataUrl}
              className="btn-ghost flex-1 justify-center disabled:opacity-40"
            >
              <Printer size={15} />Yazdır
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
