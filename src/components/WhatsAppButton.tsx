import { MessageCircle } from 'lucide-react';
import type { Portfoy, Musteri } from '../types';
import { useToast } from '../contexts/ToastContext';
import { displayPrice } from './PriceInput';

interface PortfoyWhatsAppProps {
  portfoy: Portfoy;
}

export function PortfoyWhatsApp({ portfoy }: PortfoyWhatsAppProps) {
  const { toast } = useToast();

  const sendWhatsApp = () => {
    const parts: string[] = [];
    parts.push(`🏠 *${portfoy.isim}*`);
    parts.push('');
    if (portfoy.bolge || portfoy.ilce) parts.push(`📍 Bölge: ${portfoy.bolge || portfoy.ilce}`);
    if (portfoy.fiyat) parts.push(`💰 Fiyat: ${displayPrice(portfoy.fiyat, (portfoy.para_birimi as 'TL' | 'USD' | 'EUR') || 'TL')}`);
    const specs: string[] = [];
    if (portfoy.oda) specs.push(portfoy.oda);
    if (portfoy.metrekare) specs.push(`${portfoy.metrekare} m²`);
    if (portfoy.durum_bina) specs.push(portfoy.durum_bina);
    if (specs.length) parts.push(`🏗️ ${specs.join(' | ')}`);
    if (portfoy.denize_yakin) parts.push('🌊 Denize Yakın');
    if (portfoy.deniz_manzarasi) parts.push('🌅 Deniz Manzarası');
    parts.push('');
    parts.push('📞 Detaylı bilgi için iletişime geçebilirsiniz.');
    parts.push('');
    parts.push('_DerliEstate Pro - Çeşme Bölgesi Lider CRM_');
    const message = parts.join('\n');
    try {
      navigator.clipboard.writeText(message);
      toast('WhatsApp mesajı kopyalandı!', 'success');
    } catch { /* ignore */ }
    window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
  };

  return (
    <button
      type="button"
      onClick={sendWhatsApp}
      style={{
        background: '#25D366',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '4px 8px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
      }}
      title="WhatsApp ile paylaş"
    >
      <MessageCircle size={14} />
    </button>
  );
}

interface MusteriWhatsAppProps {
  musteri: Musteri;
}

export function MusteriWhatsApp({ musteri }: MusteriWhatsAppProps) {
  if (!musteri.telefon) return null;
  const cleaned = musteri.telefon.replace(/\D/g, '');
  const number = cleaned.startsWith('0') ? '90' + cleaned.slice(1) : cleaned.startsWith('90') ? cleaned : '90' + cleaned;
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        background: '#25D366',
        color: '#fff',
        borderRadius: 6,
        padding: '4px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        textDecoration: 'none',
      }}
      title="WhatsApp"
    >
      <MessageCircle size={14} />
    </a>
  );
}
