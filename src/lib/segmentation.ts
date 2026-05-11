import type { Musteri } from '../types';

export interface SegmentTag {
  key: string;
  label: string;
  emoji: string;
  color: string;
  bg: string;
}

export interface CustomerTier {
  label: string;
  color: string;
  bg: string;
}

export function parseBudgetTL(m: Musteri): number {
  const raw = m.butce_max || m.butce || m.butce_min || '';
  if (!raw.trim()) return 0;
  const num = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (isNaN(num)) return 0;
  const currency = (m.para_birimi || 'TL').toUpperCase();
  if (currency === 'USD') return num * 32;
  if (currency === 'EUR') return num * 35;
  return num;
}

export function calcTier(m: Musteri): CustomerTier {
  const budget = parseBudgetTL(m);
  if (budget >= 35_000_000) return { label: 'VIP',          color: '#D4AF37', bg: '#1A1A18' };
  if (budget >= 25_000_000) return { label: 'Premium Plus', color: '#fff',    bg: '#534AB7' };
  if (budget >= 20_000_000) return { label: 'Premium',      color: '#fff',    bg: '#185FA5' };
  return { label: 'Normal', color: '#5D4037', bg: '#EFEBE4' };
}

function daysSince(d: string | null | undefined): number {
  if (!d) return 9999;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export function calcTags(m: Musteri): SegmentTag[] {
  const tags: SegmentTag[] = [];
  const budget = parseBudgetTL(m) / 1_000_000;
  const daysSinceCreated = daysSince(m.created_at);

  if (budget * 1_000_000 >= 35_000_000) {
    tags.push({ key: 'vip', label: 'VIP', emoji: '👑', color: '#D4AF37', bg: '#1A1A18' });
  } else if (budget * 1_000_000 >= 25_000_000) {
    tags.push({ key: 'premium_plus', label: 'Premium Plus', emoji: '💎', color: '#fff', bg: '#534AB7' });
  } else if (budget * 1_000_000 >= 20_000_000) {
    tags.push({ key: 'premium', label: 'Premium', emoji: '⭐', color: '#fff', bg: '#185FA5' });
  }

  if (m.durum === 'sicak') {
    tags.push({ key: 'acil', label: 'Acil Alıcı', emoji: '🔥', color: '#fff', bg: '#FF3B2F' });
  }

  if (daysSinceCreated <= 7) {
    tags.push({ key: 'yeni', label: 'Yeni', emoji: '🆕', color: '#1A1A18', bg: '#D4AF37' });
  }

  if (daysSinceCreated > 30 && m.durum !== 'satin_alacak') {
    tags.push({ key: 'pasif', label: 'Pasif', emoji: '😴', color: '#8B7355', bg: '#EFEBE4' });
  } else if (daysSinceCreated > 3 && m.durum !== 'gelmedi' && m.durum !== 'satin_alacak') {
    tags.push({ key: 'takip', label: 'Takip', emoji: '⏰', color: '#fff', bg: '#E8A020' });
  }

  return tags;
}
