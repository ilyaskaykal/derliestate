import type { MusteriDurum, PortfoyDurum, RandevuDurum } from '../types';

const musteriConfig: Record<MusteriDurum, { label: string; bg: string; color: string; shadow: string; dotColor: string }> = {
  sicak:        { label: 'Sıcak',        bg: '#FF3B2F', color: '#fff', shadow: 'none', dotColor: '#FF3B2F' },
  satin_alacak: { label: 'Satın Alacak', bg: '#22A05A', color: '#fff', shadow: 'none', dotColor: '#22A05A' },
  dusunuyor:    { label: 'Düşünüyor',    bg: '#E8A020', color: '#fff', shadow: 'none', dotColor: '#E8A020' },
  kararsiz:     { label: 'Kararsız',     bg: '#7F77DD', color: '#fff', shadow: 'none', dotColor: '#7F77DD' },
  gelmedi:      { label: 'No Show',      bg: '#5F5E5A', color: '#fff', shadow: 'none', dotColor: '#5F5E5A' },
  soguk:        { label: 'Soğuk',        bg: '#5F5E5A', color: '#fff', shadow: 'none', dotColor: '#5F5E5A' },
};

const portfoyConfig: Record<PortfoyDurum, { label: string; bg: string; color: string; shadow: string }> = {
  olumlu:   { label: 'Olumlu',   bg: '#22A05A', color: '#fff', shadow: 'none' },
  kararsiz: { label: 'Kararsız', bg: '#E8A020', color: '#fff', shadow: 'none' },
  olumsuz:  { label: 'Olumsuz',  bg: '#C0392B', color: '#fff', shadow: 'none' },
};

const randevuConfig: Record<RandevuDurum, { label: string; bg: string; color: string; shadow: string }> = {
  bekliyor:   { label: 'Bekliyor',   bg: '#7F77DD', color: '#fff', shadow: 'none' },
  tamamlandi: { label: 'Tamamlandı', bg: '#22A05A', color: '#fff', shadow: 'none' },
  iptal:      { label: 'İptal',      bg: '#FF3B2F', color: '#fff', shadow: 'none' },
};

export function MusteriStatusBadge({ durum }: { durum: MusteriDurum }) {
  const c = musteriConfig[durum] || musteriConfig.kararsiz;
  return (
    <span
      className="status-badge"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

export function PortfoyStatusBadge({ durum }: { durum: PortfoyDurum }) {
  const c = portfoyConfig[durum] || portfoyConfig.kararsiz;
  return (
    <span
      className="status-badge"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

export function RandevuStatusBadge({ durum }: { durum: RandevuDurum }) {
  const c = randevuConfig[durum] || randevuConfig.bekliyor;
  return (
    <span
      className="status-badge"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

export { musteriConfig };
