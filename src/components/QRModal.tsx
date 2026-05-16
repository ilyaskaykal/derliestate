import { useState, useEffect } from 'react';
import { X, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import type { Portfoy } from '../types';
import { displayPrice } from './PriceInput';

interface Props {
  portfoy: Portfoy;
  onClose: () => void;
}

export default function QRModal({ portfoy, onClose }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');
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
      <html><body style="text-align:center;font-family:sans-serif;padding:40px">
      <h2>${portfoy.isim}</h2>
      <img src="${qrDataUrl}" style="width:280px;height:280px" />
      ${portfoy.fiyat ? `<p style="font-size:18px;font-weight:bold">${displayPrice(portfoy.fiyat, (portfoy.para_birimi as 'TL' | 'USD' | 'EUR') || 'TL')}</p>` : ''}
      ${portfoy.bolge ? `<p>${portfoy.bolge}</p>` : ''}
      <p style="color:#888;font-size:12px">DerliEstate Pro - Çeşme Bölgesi</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 400 }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
          <h2 className="font-bold text-base" style={{ color: '#1A1A18' }}>QR Kod</h2>
          <button onClick={onClose} className="touch-compact p-1 rounded"><X size={18} /></button>
        </div>
        <div className="modal-body p-6 flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-center" style={{ color: '#1A1A18' }}>{portfoy.isim}</p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" style={{ width: 280, height: 280 }} />
          ) : (
            <div style={{ width: 280, height: 280, background: '#F5F0E8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="text-sm" style={{ color: '#8B7355' }}>Oluşturuluyor...</span>
            </div>
          )}
          <p className="text-xs text-center" style={{ color: '#8B7355', wordBreak: 'break-all' }}>{url}</p>
        </div>
        <div className="modal-footer">
          <button onClick={download} className="btn-gold flex-1" disabled={!qrDataUrl}>
            <Download size={15} /> İndir
          </button>
          <button onClick={print} className="btn-ghost flex-1" disabled={!qrDataUrl}>
            <Printer size={15} /> Yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
