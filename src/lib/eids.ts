import type { EidsStatus, Portfoy } from '../types';

export const EIDS_STATUS_LABELS: Record<EidsStatus, string> = {
  yok: 'Yetki Yok',
  beklemede: 'Mal Sahibinden Bekleniyor',
  aktif: 'Aktif',
  suresi_doldu: 'Süresi Doldu',
  iptal_edildi: 'İptal Edildi',
  yabanci_malik: 'Yabancı Malik (Muaf)',
  tapusuz: 'Tapusuz Mülk',
};

export function eidsStatusColor(status: EidsStatus | undefined): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'aktif': return { bg: '#F0FFF4', text: '#22A05A', dot: '#22A05A' };
    case 'beklemede': return { bg: '#FFFBF0', text: '#E8A020', dot: '#E8A020' };
    case 'suresi_doldu': return { bg: '#FFF0EE', text: '#FF3B2F', dot: '#FF3B2F' };
    case 'iptal_edildi': return { bg: '#FFF0EE', text: '#FF3B2F', dot: '#FF3B2F' };
    case 'yabanci_malik': return { bg: '#EFEBE4', text: '#8B7355', dot: '#8B7355' };
    case 'tapusuz': return { bg: '#EFEBE4', text: '#8B7355', dot: '#8B7355' };
    default: return { bg: '#FFF0EE', text: '#FF3B2F', dot: '#FF3B2F' };
  }
}

export function daysUntilExpiry(bitis: string | undefined): number | null {
  if (!bitis) return null;
  const diff = new Date(bitis).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function eidsStatusLabel(p: Portfoy): string {
  const base = EIDS_STATUS_LABELS[p.eids_status ?? 'yok'] ?? 'Yetki Yok';
  if (p.eids_status === 'aktif' && p.eids_yetki_bitis) {
    const days = daysUntilExpiry(p.eids_yetki_bitis);
    if (days !== null) return `${base} (${days} gün kaldı)`;
  }
  return base;
}

export function shouldShowReminder(p: Portfoy): boolean {
  if (p.eids_status !== 'aktif') return false;
  const days = daysUntilExpiry(p.eids_yetki_bitis);
  return days !== null && days <= 30;
}

export function buildWhatsAppTemplate(
  p: Portfoy,
  belgeNo: string,
  danismanAdi: string,
): string {
  const malik = `${p.sahip_ad ?? ''} ${p.sahip_soyad ?? ''}`.trim() || 'Mal Sahibi';
  return `Sayın ${malik},

Dijital platformlarda ilan girebilmemiz için e-Devlet üzerinden EİDS yetkisi vermeniz gerekiyor.

🔹 e-Devlet'e girin
🔹 Arama kısmına EİDS yazın
🔹 "EİDS Taşınmaz İlanı Yayınlama İzni İşlemleri (Ticaret Bakanlığı)" bölümüne girin
🔹 Sağ üstteki yeşil "İlan Yayınlama İzni Ver" butonuna tıklayın
🔹 İzin vermek istediğiniz tapuyu seçip Devam Et deyin
🔹 Yetki numarası kısmına Derli Emlak Yetki belge numarası olan: ${belgeNo || '3502600'} yazıp Sorgula deyin
🔹 Yetki süresini en az 90 gün olacak şekilde seçip Kaydet butonuna basın
🔹 Ekranda çıkan TAŞINMAZ NUMARASI'nı bizimle paylaşmanız yeterli

Takıldığınız yerde arayın, birlikte halledelim.

Saygılarımla,
${danismanAdi}
Derli Emlak`;
}
