import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Building2, X, Loader2, Sparkles, MapPin, Ruler, Home, Upload,
  LayoutGrid, List, Filter, ChevronDown, ChevronRight, Star, QrCode,
  ChevronLeft, Images, GripVertical, Wand2, FileDown, Search as SearchIcon,
} from 'lucide-react';
import { SahibindenFetchButton, DescriptionWriter, SimilarPortfoliosPanel } from '../components/AIFeatures';
import { supabase } from '../lib/supabase';
import { Portfoy, PortfoyTip, PortfoyDurum, EidsStatus, CESME_BOLGELERI, isGuest } from '../types';
import { PortfoyStatusBadge } from '../components/StatusBadge';
import { eidsStatusColor, EIDS_STATUS_LABELS, daysUntilExpiry, buildWhatsAppTemplate } from '../lib/eids';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import VoiceInput from '../components/VoiceInput';
import PriceInput, { Currency, displayPrice } from '../components/PriceInput';
import { callClaude } from '../lib/claude';
import EslestirmePanel from '../components/EslestirmePanel';
import { PortfoyWhatsApp } from '../components/WhatsAppButton';
import BelgelerPage from './Belgeler';
import QRModal from '../components/QRModal';
import PhotoEnhancer from '../components/PhotoEnhancer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PiyasaAnalizi {
  degerlendirme: 'Ucuz' | 'Uygun' | 'Pahalı';
  fark_yuzdesi: number;
  piyasa_degeri: string;
  hizli_satis_fiyati: string;
  skor: number;
  oneriler: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIP_OPTIONS: { value: PortfoyTip; label: string }[] = [
  { value: 'daire', label: 'Daire' },
  { value: 'villa', label: 'Villa' },
  { value: 'ticari', label: 'Ticari' },
  { value: 'arsa', label: 'Arsa' },
];

const MAX_FOTO = 30;

const ODA_OPTIONS = ['Stüdyo', '1+1', '2+1', '3+1', '4+1', '5+1', '5+2', 'Diğer'];
const YAS_OPTIONS = ['Sıfır', '1 Yıl', '2 Yıl', '3 Yıl', '5 Yıl', '10 Yıl', '15 Yıl', '20+ Yıl'];
const ISITMA_OPTIONS = ['Doğalgaz Kombi', 'Doğalgaz Merkezi', 'Klima', 'Soba', 'Yerden Isıtma', 'Diğer'];
const ANAHTAR_OPTIONS = ['Bizde', 'Sahibinde', 'Kapıcıda', 'Komşuda', 'Kiracıda', 'Diğer'];

const tipColors: Record<PortfoyTip, string> = {
  daire: 'bg-blue-500/10 text-blue-400',
  villa: 'bg-amber-500/10 text-amber-600',
  ticari: 'bg-orange-500/10 text-orange-400',
  arsa: 'bg-green-500/10 text-green-400',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = Omit<Portfoy, 'id' | 'created_at'>;
type FotoItem = { url: string; sira: number };
type ViewMode = 'kart' | 'liste';
type GroupBy = 'none' | 'bolge' | 'durum' | 'fiyat';
type SortBy = 'yeni' | 'eski' | 'fiyat_asc' | 'fiyat_desc';
type PriceRange = 'all' | '0-5' | '5-10' | '10-20' | '20+';

interface Filters {
  bolgeler: string[];
  tip: PortfoyTip | 'tumu';
  durum: PortfoyDurum | 'tumu';
  priceRange: PriceRange;
  denizeYakin: boolean;
  denizManzarasi: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(danisman: string): FormState {
  return {
    isim: '', sahip_ad: '', sahip_soyad: '', tc: '', sahip_tel: '',
    il: 'İzmir', ilce: 'Çeşme', mahalle: '', bolge: '', ada: '', parsel: '',
    fiyat: '', para_birimi: 'TL', tip: 'daire', oda: '', metrekare: '', durum_bina: '', kat: '', isitma: '',
    portfoy_durum: 'kararsiz', baska_emlakci: false, ilan_no: '', ilan_portal: '',
    aciklama: '', kapak_foto: '', danisman, anahtar_nerede: '',
    eklendi_user_id: '', eklendi_user_ad: '', ilan_url: '',
    denize_yakin: false, deniz_manzarasi: false, fotograflar: [],
  };
}

function emptyFilters(): Filters {
  return { bolgeler: [], tip: 'tumu', durum: 'tumu', priceRange: 'all', denizeYakin: false, denizManzarasi: false };
}

/** Parse price string to a numeric million-TL value for range matching. Returns null if not TL or unparseable. */
function parsePriceMillion(p: Portfoy): number | null {
  if ((p.para_birimi || 'TL') !== 'TL') return null;
  const num = parseFloat(p.fiyat?.replace(/[^\d.]/g, '') || '');
  if (isNaN(num)) return null;
  return num / 1_000_000;
}

function matchesPriceRange(p: Portfoy, range: PriceRange): boolean {
  if (range === 'all') return true;
  const m = parsePriceMillion(p);
  if (m === null) return false;
  if (range === '0-5') return m >= 0 && m < 5;
  if (range === '5-10') return m >= 5 && m < 10;
  if (range === '10-20') return m >= 10 && m < 20;
  if (range === '20+') return m >= 20;
  return true;
}

/** Heuristic AI Satılabilirlik score, 0–10 */
function calcScore(p: Portfoy): number {
  let score = 4; // base
  if (p.portfoy_durum === 'olumlu') score += 3;
  else if (p.portfoy_durum === 'kararsiz') score += 1;
  const m = parsePriceMillion(p);
  if (m !== null && m >= 5 && m <= 15) score += 2;
  if (p.kapak_foto) score += 1;
  if (p.baska_emlakci) score -= 1;
  if (p.denize_yakin) score += 1;
  if (p.deniz_manzarasi) score += 1;
  if (p.oda) score += 0.5;
  return Math.max(0, Math.min(10, score));
}

function daysSince(dateStr: string): number {
  const created = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

function getPriceGroupLabel(p: Portfoy): string {
  const m = parsePriceMillion(p);
  if (m === null) return 'Fiyat Belirtilmemiş';
  if (m < 5) return '0 – 5 Milyon TL';
  if (m < 10) return '5 – 10 Milyon TL';
  if (m < 20) return '10 – 20 Milyon TL';
  return '20+ Milyon TL';
}

function getDurumLabel(d: PortfoyDurum): string {
  const map: Record<PortfoyDurum, string> = { olumlu: 'Olumlu', kararsiz: 'Kararsız', olumsuz: 'Olumsuz' };
  return map[d] || d;
}

function hasActiveFilters(f: Filters): boolean {
  return (
    f.bolgeler.length > 0 ||
    f.tip !== 'tumu' ||
    f.durum !== 'tumu' ||
    f.priceRange !== 'all' ||
    f.denizeYakin ||
    f.denizManzarasi
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PiyasaAnaliziKart({ analiz }: { analiz: PiyasaAnalizi }) {
  const degColor = analiz.degerlendirme === 'Ucuz' ? '#22c55e' : analiz.degerlendirme === 'Pahalı' ? '#ef4444' : '#FFD700';
  // slider: 0=ucuz(-50%+), 50=uygun, 100=pahalı(+50%+)
  const clampedFark = Math.max(-50, Math.min(50, analiz.degerlendirme === 'Pahalı' ? analiz.fark_yuzdesi : -analiz.fark_yuzdesi));
  const sliderPos = Math.round((clampedFark + 50) / 100 * 100);

  return (
    <div className="mt-3 rounded-2xl overflow-hidden" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'rgba(192,57,43,0.04)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B7355' }}>Piyasa Analizi</span>
        <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: `${degColor}15`, color: degColor, border: `1px solid ${degColor}40` }}>
          {analiz.degerlendirme} {analiz.fark_yuzdesi > 0 ? `%${analiz.fark_yuzdesi}` : ''}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Price comparison bar */}
        <div>
          <div className="flex justify-between text-[10px] mb-1.5 font-medium" style={{ color: '#8B7355' }}>
            <span>Ucuz</span>
            <span>Uygun</span>
            <span>Pahalı</span>
          </div>
          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: 'linear-gradient(90deg, #22c55e, #FFD700, #ef4444)', width: '100%', opacity: 0.3 }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full shadow-lg border-2"
              style={{ left: `calc(${sliderPos}% - 7px)`, background: degColor, borderColor: '#EFEBE4', boxShadow: `0 0 8px ${degColor}80` }}
            />
          </div>
        </div>

        {/* Price cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>Piyasa Değeri</p>
            <p className="text-sm font-bold" style={{ color: '#FFD700' }}>{analiz.piyasa_degeri} TL</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <p className="text-[10px] font-medium mb-0.5" style={{ color: 'rgba(34,197,94,0.5)' }}>Hızlı Satış Fiyatı</p>
            <p className="text-sm font-bold" style={{ color: '#22c55e' }}>{analiz.hizli_satis_fiyati} TL</p>
          </div>
        </div>

        {/* Sellability score */}
        <div>
          <p className="text-[10px] font-medium mb-1.5" style={{ color: '#8B7355' }}>Satılabilirlik Skoru</p>
          <div className="flex items-center gap-1.5">
            {[...Array(10)].map((_, i) => (
              <Star
                key={i}
                size={14}
                fill={i < analiz.skor ? '#FFD700' : 'transparent'}
                stroke={i < analiz.skor ? '#FFD700' : 'rgba(255,215,0,0.2)'}
                strokeWidth={1.5}
              />
            ))}
            <span className="ml-1 text-sm font-bold" style={{ color: '#1A1A18' }}>{analiz.skor}/10</span>
          </div>
        </div>

        {/* Recommendations */}
        {analiz.oneriler?.length > 0 && (
          <div>
            <p className="text-[10px] font-medium mb-2" style={{ color: '#8B7355' }}>Öneriler</p>
            <div className="space-y-1.5">
              {analiz.oneriler.map((o, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#1A1A18' }}>
                  <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5" style={{ background: 'rgba(192,57,43,0.15)', color: '#C0392B' }}>{i + 1}</span>
                  {o}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? '#4ade80' : score >= 5 ? '#facc15' : '#f87171';
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${color}15`, color, border: `1px solid ${color}33` }}
    >
      <Star size={9} fill={color} strokeWidth={0} />
      {score.toFixed(1)}/10
    </span>
  );
}

// ─── EIDS Card sub-component ─────────────────────────────────────────────────

const EIDS_STATUS_OPTIONS: { value: EidsStatus; label: string }[] = [
  { value: 'yok',           label: 'Yetki Yok' },
  { value: 'beklemede',     label: 'Mal Sahibinden Bekleniyor' },
  { value: 'aktif',         label: 'Aktif' },
  { value: 'suresi_doldu',  label: 'Süresi Doldu' },
  { value: 'iptal_edildi',  label: 'İptal Edildi' },
  { value: 'yabanci_malik', label: 'Yabancı Malik (Muaf)' },
  { value: 'tapusuz',       label: 'Tapusuz Mülk' },
];

function EidsCard({
  portfoy,
  isAdminOrYonetici,
  danismanAdi,
  onUpdated,
}: {
  portfoy: Portfoy;
  isAdminOrYonetici: boolean;
  danismanAdi: string;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingExtra, setSavingExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({
    eids_tasinmaz_no: portfoy.eids_tasinmaz_no ?? '',
    eids_yetki_baslangic: portfoy.eids_yetki_baslangic ?? '',
    eids_yetki_bitis: portfoy.eids_yetki_bitis ?? '',
  });
  const [form, setForm] = useState({
    eids_status: portfoy.eids_status ?? 'yok',
    eids_tasinmaz_no: portfoy.eids_tasinmaz_no ?? '',
    eids_yetki_baslangic: portfoy.eids_yetki_baslangic ?? '',
    eids_yetki_bitis: portfoy.eids_yetki_bitis ?? '',
    eids_yetki_belge_no: portfoy.eids_yetki_belge_no ?? '',
    eids_yetkili_kisi: portfoy.eids_yetkili_kisi ?? '',
    eids_notlar: portfoy.eids_notlar ?? '',
  });
  const [belgeNo, setBelgeNo] = useState('');

  useEffect(() => {
    supabase.from('app_config').select('value').eq('key', 'derli_yetki_belge_no').maybeSingle()
      .then(({ data }) => { if (data?.value) setBelgeNo(data.value); });
  }, []);

  const colors = eidsStatusColor(form.eids_status as EidsStatus);
  const days = form.eids_status === 'aktif' ? daysUntilExpiry(form.eids_yetki_bitis) : null;

  const save = async () => {
    setSaving(true);
    const oldStatus = portfoy.eids_status ?? 'yok';
    const { error } = await supabase.from('portfoyler').update(form).eq('id', portfoy.id);
    if (error) { toast('Hata oluştu.', 'error'); setSaving(false); return; }
    if (oldStatus !== form.eids_status) {
      await supabase.from('eids_audit_log').insert({
        property_id: portfoy.id,
        old_status: oldStatus,
        new_status: form.eids_status,
        changed_by: danismanAdi,
        notes: form.eids_notlar || null,
      });
    }
    toast('EİDS bilgileri güncellendi.');
    setSaving(false);
    setEditing(false);
    onUpdated();
  };

  const saveExtra = async () => {
    setSavingExtra(true);
    const { error } = await supabase.from('portfoyler').update(extraForm).eq('id', portfoy.id);
    if (error) { toast('Hata oluştu.', 'error'); setSavingExtra(false); return; }
    toast('EİDS bilgileri güncellendi.');
    setSavingExtra(false);
    onUpdated();
  };

  const extraDays = extraForm.eids_yetki_bitis ? daysUntilExpiry(extraForm.eids_yetki_bitis) : null;

  const sendWhatsApp = () => {
    const text = buildWhatsAppTemplate({ ...portfoy, ...form } as Portfoy, belgeNo, danismanAdi);
    const tel = portfoy.sahip_tel?.replace(/[^\d+]/g, '');
    const url = tel
      ? `https://wa.me/${tel.replace('+', '')}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24' }}>EİDS Yetki Durumu</p>
        {isAdminOrYonetici && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs transition-colors px-2 py-0.5 rounded" style={{ color: '#8B7355' }}
          >
            Düzenle
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: colors.bg, color: colors.text }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.dot }} />
              {EIDS_STATUS_LABELS[form.eids_status as EidsStatus] ?? form.eids_status}
              {days !== null && ` (${days} gün kaldı)`}
            </span>
            {days !== null && days <= 30 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                Hatırlatma Gerekli
              </span>
            )}
          </div>
          {form.eids_tasinmaz_no && (
            <p className="text-xs" style={{ color: '#8B7355' }}>Taşınmaz No: <span className="font-mono" style={{ color: '#1A1A18' }}>{form.eids_tasinmaz_no}</span></p>
          )}
          {form.eids_yetki_bitis && (
            <p className="text-xs" style={{ color: '#8B7355' }}>Bitiş: <span style={{ color: '#1A1A18' }}>{new Date(form.eids_yetki_bitis).toLocaleDateString('tr-TR')}</span></p>
          )}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button
              onClick={sendWhatsApp}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              Mal Sahibine Yetki Talimatı Gönder
            </button>
            {days !== null && days <= 30 && (
              <button
                onClick={sendWhatsApp}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                Süreyi Uzat Hatırlatması
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label text-xs">Durum</label>
            <select className="input text-sm" value={form.eids_status} onChange={e => setForm(f => ({ ...f, eids_status: e.target.value as EidsStatus }))}>
              {EIDS_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Taşınmaz No</label>
              <input className="input text-sm" value={form.eids_tasinmaz_no} onChange={e => setForm(f => ({ ...f, eids_tasinmaz_no: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Yetkili Kişi</label>
              <select className="input text-sm" value={form.eids_yetkili_kisi} onChange={e => setForm(f => ({ ...f, eids_yetkili_kisi: e.target.value }))}>
                <option value="">Seçin</option>
                <option value="Malik">Malik</option>
                <option value="Eş">Eş</option>
                <option value="Akraba">Akraba</option>
                <option value="Vekil">Vekil</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Yetki Başlangıç</label>
              <input type="date" className="input text-sm" value={form.eids_yetki_baslangic} onChange={e => setForm(f => ({ ...f, eids_yetki_baslangic: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Yetki Bitiş</label>
              <input type="date" className="input text-sm" value={form.eids_yetki_bitis} onChange={e => setForm(f => ({ ...f, eids_yetki_bitis: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label text-xs">Yetki Belge No</label>
            <input className="input text-sm" value={form.eids_yetki_belge_no} placeholder={belgeNo || 'Belge numarası'} onChange={e => setForm(f => ({ ...f, eids_yetki_belge_no: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs">Notlar</label>
            <textarea className="input resize-none text-sm" rows={2} value={form.eids_notlar} onChange={e => setForm(f => ({ ...f, eids_notlar: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost flex-1 text-xs justify-center py-1.5">İptal</button>
            <button onClick={save} disabled={saving} className="btn-gold flex-1 text-xs justify-center py-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : '💾 Kaydet'}
            </button>
          </div>
          <button
            onClick={sendWhatsApp}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            📱 WhatsApp Gönder
          </button>
        </div>
      )}

      {/* Always-visible: Yetki Numarası, Alınan Tarih, Bitiş Tarihi */}
      <div className="pt-2 border-t space-y-3" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
        <div>
          <label className="label text-xs">🔢 Yetki Numarası</label>
          <input
            className="input text-sm"
            placeholder="Mal sahibinden gelen taşınmaz numarası"
            value={extraForm.eids_tasinmaz_no}
            onChange={e => setExtraForm(f => ({ ...f, eids_tasinmaz_no: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">📅 Alınan Tarih</label>
            <input
              type="date"
              className="input text-sm"
              value={extraForm.eids_yetki_baslangic}
              onChange={e => setExtraForm(f => ({ ...f, eids_yetki_baslangic: e.target.value }))}
            />
          </div>
          <div>
            <label className="label text-xs">📅 Bitiş Tarihi</label>
            <div className="space-y-1">
              <input
                type="date"
                className="input text-sm"
                value={extraForm.eids_yetki_bitis}
                onChange={e => setExtraForm(f => ({ ...f, eids_yetki_bitis: e.target.value }))}
              />
              {extraDays !== null && (
                <p className="text-xs font-medium" style={{ color: extraDays < 0 ? '#f87171' : extraDays <= 30 ? '#fbbf24' : '#4ade80' }}>
                  {extraDays < 0 ? `${Math.abs(extraDays)} gün geçti` : `${extraDays} gün kaldı`}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={saveExtra}
            disabled={savingExtra}
            className="btn-gold flex-1 text-xs justify-center py-1.5"
          >
            {savingExtra ? <Loader2 size={12} className="animate-spin" /> : '💾 Kaydet'}
          </button>
          <button
            onClick={sendWhatsApp}
            className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            📱 WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Portfolio() {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
  const isAdminOrYonetici = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';
  const isGuestUser = isGuest(effectiveUser?.rol) || effectiveUser?.username === 'derli';

  const canSeePhone = (record: { eklendi_user_id?: string }) =>
    effectiveUser?.rol === 'admin' || effectiveUser?.username === 'superadmin' || record.eklendi_user_id === effectiveUser?.username;

  const maskSoyad = (soyad: string | undefined, _record: { eklendi_user_id?: string }) => soyad ?? '';

  const maskPhone = (phone: string | undefined, record: { eklendi_user_id?: string }) =>
    canSeePhone(record) ? (phone ?? '') : '••• •••• ••••';

  // ── Core data state
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Portfoy | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(danismanAdi));
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Portfoy | null>(null);
  const [qrPortfoy, setQrPortfoy] = useState<Portfoy | null>(null);
  const [enhancerUrl, setEnhancerUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<PiyasaAnalizi | null>(null);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingMulti, setUploadingMulti] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<FotoItem[] | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dragFotoItem = useRef<number | null>(null);

  // ── View / sort / group / filter state
  const [viewMode, setViewMode] = useState<ViewMode>('kart');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('yeni');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('portfoyler').select('*').order('created_at', { ascending: false });
    setPortfoyler(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived: filtered + sorted
  const processed = useMemo(() => {
    let list = portfoyler.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || (
        p.isim.toLowerCase().includes(q) ||
        (p.bolge || '').toLowerCase().includes(q) ||
        p.mahalle.toLowerCase().includes(q) ||
        p.ilce.toLowerCase().includes(q) ||
        `${p.sahip_ad} ${p.sahip_soyad}`.toLowerCase().includes(q)
      );
      if (!matchSearch) return false;
      if (filters.bolgeler.length > 0 && !filters.bolgeler.includes(p.bolge || '')) return false;
      if (filters.tip !== 'tumu' && p.tip !== filters.tip) return false;
      if (filters.durum !== 'tumu' && p.portfoy_durum !== filters.durum) return false;
      if (!matchesPriceRange(p, filters.priceRange)) return false;
      if (filters.denizeYakin && !p.denize_yakin) return false;
      if (filters.denizManzarasi && !p.deniz_manzarasi) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'yeni') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'eski') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const pa = parsePriceMillion(a) ?? (sortBy === 'fiyat_asc' ? Infinity : -Infinity);
      const pb = parsePriceMillion(b) ?? (sortBy === 'fiyat_asc' ? Infinity : -Infinity);
      if (sortBy === 'fiyat_asc') return pa - pb;
      if (sortBy === 'fiyat_desc') return pb - pa;
      return 0;
    });

    return list;
  }, [portfoyler, search, filters, sortBy]);

  // ── Grouped list
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '_all', label: '', items: processed }];
    const map = new Map<string, Portfoy[]>();
    processed.forEach(p => {
      let key = '';
      if (groupBy === 'bolge') key = p.bolge || 'Bölge Belirtilmemiş';
      else if (groupBy === 'durum') key = getDurumLabel(p.portfoy_durum);
      else if (groupBy === 'fiyat') key = getPriceGroupLabel(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, label: key, items }));
  }, [processed, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Form helpers
  const openAdd = () => {
    setForm({ ...emptyForm(danismanAdi), eklendi_user_id: effectiveUser?.username || '', eklendi_user_ad: danismanAdi });
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (p: Portfoy) => { setForm({ ...p }); setEditItem(p); setShowForm(true); };
  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  // ── Filter helpers
  const setFilt = (patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch }));
  const toggleBolge = (b: string) => {
    setFilt({ bolgeler: filters.bolgeler.includes(b) ? filters.bolgeler.filter(x => x !== b) : [...filters.bolgeler, b] });
  };

  // ── Photo upload
  const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
          if (height > maxHeight) { width = (width * maxHeight) / height; height = maxHeight; }
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas context failed')); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => { if (blob) resolve(blob); else reject(new Error('Blob creation failed')); },
            'image/jpeg', quality
          );
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.id === 'portfoy-fotograflar');
      if (!bucketExists) {
        const { error: createErr } = await supabase.storage.createBucket('portfoy-fotograflar', {
          public: true, allowedMimeTypes: ['image/*'], fileSizeLimit: 5242880,
        });
        if (createErr) console.error('[Upload] Create bucket error:', createErr);
      } else {
        await supabase.storage.updateBucket('portfoy-fotograflar', { public: true });
      }
      const resized = await resizeImage(file, 1200, 800, 0.8);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadOpts: any = { contentType: 'image/jpeg', upsert: true, duplex: 'half' };
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('portfoy-fotograflar')
        .upload(fileName, resized, uploadOpts);
      if (uploadError) {
        const msg = uploadError.message || JSON.stringify(uploadError);
        alert('Detaylı hata:\n' + JSON.stringify(uploadError, null, 2));
        toast('Yükleme hatası: ' + msg, 'error');
        return;
      }
      console.log('[Upload] data:', uploadData);
      const { data: urlData } = supabase.storage.from('portfoy-fotograflar').getPublicUrl(fileName);
      setF({ kapak_foto: urlData.publicUrl });
      toast('Fotoğraf yüklendi.');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      alert('Detaylı hata:\n' + JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
      toast('Hata: ' + (e?.message || e?.error || JSON.stringify(err)), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleMultiPhotoUpload = async (files: FileList) => {
    const current: FotoItem[] = form.fotograflar || [];
    if (current.length >= MAX_FOTO) {
      toast(`En fazla ${MAX_FOTO} fotoğraf yükleyebilirsiniz`, 'error');
      return;
    }
    setUploadingMulti(true);
    const newItems: FotoItem[] = [];
    const remaining = MAX_FOTO - current.length;
    const filesToUpload = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      toast(`En fazla ${MAX_FOTO} fotoğraf yükleyebilirsiniz`, 'error');
    }
    for (let i = 0; i < filesToUpload.length; i++) {
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.id === 'portfoy-fotograflar');
        if (!bucketExists) {
          await supabase.storage.createBucket('portfoy-fotograflar', { public: true, allowedMimeTypes: ['image/*'], fileSizeLimit: 5242880 });
        }
        const resized = await resizeImage(filesToUpload[i], 1200, 800, 0.8);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploadOpts: any = { contentType: 'image/jpeg', upsert: true, duplex: 'half' };
        const { error } = await supabase.storage.from('portfoy-fotograflar').upload(fileName, resized, uploadOpts);
        if (!error) {
          const { data: urlData } = supabase.storage.from('portfoy-fotograflar').getPublicUrl(fileName);
          newItems.push({ url: urlData.publicUrl, sira: current.length + newItems.length });
        }
      } catch { /* skip failed */ }
    }
    const updated = [...current, ...newItems].map((f, idx) => ({ ...f, sira: idx }));
    setF({ fotograflar: updated, kapak_foto: updated[0]?.url || form.kapak_foto });
    setUploadingMulti(false);
    toast(`${newItems.length} fotoğraf yüklendi.`);
  };

  const removeFoto = (idx: number) => {
    const updated = (form.fotograflar || []).filter((_, i) => i !== idx).map((f, i) => ({ ...f, sira: i }));
    setF({ fotograflar: updated, kapak_foto: updated[0]?.url || '' });
  };

  const handleFotoDragStart = (idx: number) => { dragFotoItem.current = idx; };
  const handleFotoDrop = (toIdx: number) => {
    if (dragFotoItem.current === null || dragFotoItem.current === toIdx) return;
    const fotos = [...(form.fotograflar || [])];
    const [moved] = fotos.splice(dragFotoItem.current, 1);
    fotos.splice(toIdx, 0, moved);
    const reindexed = fotos.map((f, i) => ({ ...f, sira: i }));
    setF({ fotograflar: reindexed, kapak_foto: reindexed[0]?.url || '' });
    dragFotoItem.current = null;
  };

  // ── CRUD
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (editItem) {
      const { error } = await supabase.from('portfoyler').update(payload).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else toast('Portföy güncellendi.');
    } else {
      const { error } = await supabase.from('portfoyler').insert(payload);
      if (error) toast('Hata oluştu.', 'error'); else toast('Portföy eklendi.');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Bu portföyü silmek istiyor musunuz?')) return;
    await supabase.from('portfoyler').delete().eq('id', id);
    toast('Portföy silindi.');
    load();
    if (selected?.id === id) setSelected(null);
  };

  const updateDurum = async (id: string, durum: PortfoyDurum) => {
    await supabase.from('portfoyler').update({ portfoy_durum: durum }).eq('id', id);
    toast('Durum güncellendi.');
    load();
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, portfoy_durum: durum } : null);
  };

  const loadImageAsBase64 = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });

  const formatPdfPrice = (val: string | undefined) => {
    if (!val) return '0';
    return String(val).replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const exportPdf = async (p: Portfoy) => {
    toast('PDF hazırlanıyor...', 'success');
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const W = pdf.internal.pageSize.getWidth();   // 210
      const H = pdf.internal.pageSize.getHeight();  // 297

      const DARK   = [26, 15, 8]    as const;
      const CARAMEL= [200, 128, 75] as const;
      const GOLD   = [212, 175, 55] as const;
      const CREAM  = [245, 222, 179]as const;
      const WHITE  = [255, 248, 220]as const;
      const MUTED  = [150, 130, 110]as const;

      // ── PAGE 1: COVER ──────────────────────────────────────────────────────
      pdf.setFillColor(...DARK);
      pdf.rect(0, 0, W, H, 'F');

      // Header band
      pdf.setFillColor(...CARAMEL);
      pdf.rect(0, 0, W, 42, 'F');

      pdf.setTextColor(...DARK);
      pdf.setFontSize(26);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DERLİ EMLAK', W / 2, 18, { align: 'center' });
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Profesyonel Gayrimenkul Sunumu', W / 2, 28, { align: 'center' });
      pdf.setFontSize(9);
      pdf.text(new Date().toLocaleDateString('tr-TR'), W / 2, 37, { align: 'center' });

      // Cover photo
      let photoY = 55;
      if (p.kapak_foto) {
        try {
          const imgData = await loadImageAsBase64(p.kapak_foto);
          pdf.addImage(imgData, 'JPEG', 15, photoY, W - 30, 90);
          photoY += 95;
        } catch { /* skip photo on CORS failure */ }
      }

      // Property title
      pdf.setTextColor(...GOLD);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      const titleLines = pdf.splitTextToSize(p.isim || 'Portföy Sunumu', W - 30);
      pdf.text(titleLines, W / 2, photoY + 12, { align: 'center' });
      photoY += 10 + titleLines.length * 9;

      // Price
      pdf.setTextColor(...WHITE);
      pdf.setFontSize(32);
      pdf.text(`${formatPdfPrice(p.fiyat)} ${p.para_birimi || 'TL'}`, W / 2, photoY + 14, { align: 'center' });
      photoY += 24;

      // Location
      pdf.setTextColor(...MUTED);
      pdf.setFontSize(13);
      const loc = [p.mahalle, p.ilce, p.il].filter(Boolean).join(' · ') || p.bolge || '';
      if (loc) pdf.text(loc, W / 2, photoY + 8, { align: 'center' });
      photoY += 16;

      // Sea badges
      const badges: string[] = [];
      if (p.denize_yakin) badges.push('Denize Yakın');
      if (p.deniz_manzarasi) badges.push('Deniz Manzaralı');
      if (badges.length) {
        pdf.setFontSize(10);
        pdf.setTextColor(100, 181, 246);
        pdf.text(badges.join('  ·  '), W / 2, photoY + 6, { align: 'center' });
        photoY += 12;
      }

      // Decorative divider
      pdf.setDrawColor(...CARAMEL);
      pdf.setLineWidth(0.5);
      pdf.line(25, photoY + 6, W - 25, photoY + 6);
      photoY += 14;

      // Quick stats row (4 boxes)
      const stats = [
        ['Tip', p.tip || '-'],
        ['Oda', p.oda || '-'],
        ['m²', p.metrekare || '-'],
        ['Kat', p.kat || '-'],
      ];
      const boxW = (W - 30 - 9) / 4;
      stats.forEach(([label, val], i) => {
        const bx = 15 + i * (boxW + 3);
        pdf.setFillColor(45, 30, 15);
        pdf.roundedRect(bx, photoY, boxW, 20, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(...MUTED);
        pdf.text(label, bx + boxW / 2, photoY + 6, { align: 'center' });
        pdf.setFontSize(11);
        pdf.setTextColor(...CREAM);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(val), bx + boxW / 2, photoY + 14, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
      });

      // ── PAGE 2: PHOTOS ──────────────────────────────────────────────────────
      const photos = (p.fotograflar || []).slice(0, 6);
      if (photos.length > 0) {
        pdf.addPage();
        pdf.setFillColor(...DARK);
        pdf.rect(0, 0, W, H, 'F');

        pdf.setFillColor(...CARAMEL);
        pdf.rect(0, 0, W, 18, 'F');
        pdf.setTextColor(...DARK);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fotoğraflar', W / 2, 12, { align: 'center' });

        const photoW = (W - 35) / 2;
        const photoH = 62;
        let loaded = 0;
        for (let i = 0; i < photos.length; i++) {
          try {
            const imgData = await loadImageAsBase64(photos[i].url);
            const col = i % 2;
            const row = Math.floor(i / 2);
            const px = 15 + col * (photoW + 5);
            const py = 25 + row * (photoH + 5);
            pdf.addImage(imgData, 'JPEG', px, py, photoW, photoH);
            loaded++;
          } catch { /* skip */ }
        }
        if (loaded === 0) {
          pdf.setTextColor(...MUTED);
          pdf.setFontSize(11);
          pdf.text('Fotoğraflar yüklenemedi.', W / 2, 80, { align: 'center' });
        }
      }

      // ── PAGE 3: DETAILS ────────────────────────────────────────────────────
      pdf.addPage();
      pdf.setFillColor(...DARK);
      pdf.rect(0, 0, W, H, 'F');

      pdf.setFillColor(...CARAMEL);
      pdf.rect(0, 0, W, 18, 'F');
      pdf.setTextColor(...DARK);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Özellikler', W / 2, 12, { align: 'center' });

      let dy = 30;
      const detailRows: [string, string][] = [
        ['Tip', p.tip || ''],
        ['Oda Sayısı', p.oda || ''],
        ['Kullanım Alanı', p.metrekare ? `${p.metrekare} m²` : ''],
        ['Bina Durumu', p.durum_bina || ''],
        ['Kat', p.kat || ''],
        ['Isıtma', p.isitma || ''],
        ['İl', p.il || ''],
        ['İlçe', p.ilce || ''],
        ['Mahalle', p.mahalle || ''],
        ['Bölge', p.bolge || ''],
      ];

      detailRows.filter(([, v]) => v).forEach(([label, value], idx) => {
        const isEven = idx % 2 === 0;
        pdf.setFillColor(isEven ? 40 : 35, isEven ? 25 : 20, isEven ? 12 : 10);
        pdf.rect(15, dy, W - 30, 11, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...GOLD);
        pdf.text(label, 20, dy + 7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...CREAM);
        pdf.text(String(value), 80, dy + 7.5);
        dy += 12;
      });

      if (p.denize_yakin || p.deniz_manzarasi) {
        dy += 5;
        pdf.setFillColor(20, 40, 70);
        pdf.rect(15, dy, W - 30, 11, 'F');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 181, 246);
        pdf.setFont('helvetica', 'bold');
        pdf.text([p.denize_yakin ? 'Denize Yakın' : '', p.deniz_manzarasi ? 'Deniz Manzaralı' : ''].filter(Boolean).join('   '), 20, dy + 7.5);
        dy += 12;
      }

      if (p.aciklama) {
        dy += 8;
        pdf.setTextColor(...GOLD);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Açıklama', 15, dy);
        dy += 8;
        pdf.setTextColor(...CREAM);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(p.aciklama, W - 30);
        const maxLines = Math.floor((H - dy - 20) / 6);
        pdf.text(lines.slice(0, maxLines), 15, dy);
      }

      // ── PAGE 4: CONTACT ────────────────────────────────────────────────────
      pdf.addPage();
      pdf.setFillColor(...DARK);
      pdf.rect(0, 0, W, H, 'F');

      pdf.setFillColor(...CARAMEL);
      pdf.rect(0, 0, W, 18, 'F');
      pdf.setTextColor(...DARK);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('İletişim', W / 2, 12, { align: 'center' });

      // Company block
      pdf.setFillColor(40, 25, 12);
      pdf.roundedRect(25, 40, W - 50, 50, 4, 4, 'F');
      pdf.setDrawColor(...CARAMEL);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(25, 40, W - 50, 50, 4, 4, 'S');

      pdf.setTextColor(...GOLD);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DERLİ EMLAK', W / 2, 58, { align: 'center' });
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...MUTED);
      pdf.text('Çeşme · İzmir', W / 2, 68, { align: 'center' });
      pdf.text('www.derliestate.com', W / 2, 78, { align: 'center' });

      // Advisor block
      pdf.setFillColor(35, 22, 10);
      pdf.roundedRect(25, 105, W - 50, 35, 4, 4, 'F');
      pdf.setTextColor(...MUTED);
      pdf.setFontSize(9);
      pdf.text('Danışmanınız', W / 2, 117, { align: 'center' });
      pdf.setTextColor(...CREAM);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim(), W / 2, 127, { align: 'center' });
      if (effectiveUser?.telefon) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(...GOLD);
        pdf.text(effectiveUser.telefon, W / 2, 136, { align: 'center' });
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(`Bu belge ${new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.`, W / 2, H - 12, { align: 'center' });

      pdf.save(`${(p.isim || 'portfoy').replace(/\s+/g, '-')}-sunum.pdf`);
      toast('PDF indirildi!', 'success');
    } catch (err) {
      toast(`PDF oluşturulamadı: ${err instanceof Error ? err.message : 'Hata'}`, 'error');
    }
  };

  const runAI = async (p: Portfoy) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const prompt = `Sen Çeşme bölgesi uzmanı bir emlak değerleme uzmanısın.

Portföy bilgileri:
- Bölge: ${p.bolge || p.ilce || p.mahalle}
- Tip: ${p.tip}
- Oda Sayısı: ${p.oda}
- Alan: ${p.metrekare} m²
- Bina Durumu: ${p.durum_bina}
- İstenen Fiyat: ${p.fiyat} ${p.para_birimi || 'TL'}
- Denize Yakın: ${p.denize_yakin ? 'Evet' : 'Hayır'}
- Deniz Manzarası: ${p.deniz_manzarasi ? 'Evet' : 'Hayır'}
- Açıklama: ${p.aciklama || 'Yok'}

Şunları analiz et:
1. Fiyat değerlendirmesi: Piyasaya göre Uygun/Pahalı/Ucuz (% fark ile)
2. Tahmini gerçek piyasa değeri
3. Hızlı satış için önerilen fiyat
4. Satılabilirlik skoru: X/10
5. Satışı hızlandıracak 3 öneri

Kısa, net, Türkçe yanıtla. SADECE JSON formatında dön, başka hiçbir şey yazma:
{"degerlendirme":"Pahalı","fark_yuzdesi":15,"piyasa_degeri":"8.500.000","hizli_satis_fiyati":"7.800.000","skor":7,"oneriler":["öneri1","öneri2","öneri3"]}`;
      const raw = await callClaude(prompt, 600);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON yanıt alınamadı');
      setAiResult(JSON.parse(jsonMatch[0]) as PiyasaAnalizi);
    } catch (err) {
      toast(`Piyasa analizi hatası: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    setAiLoading(false);
  };

  // ─── Shared card action buttons (used in grid cards)
  const activeFilterCount =
    filters.bolgeler.length +
    (filters.tip !== 'tumu' ? 1 : 0) +
    (filters.durum !== 'tumu' ? 1 : 0) +
    (filters.priceRange !== 'all' ? 1 : 0) +
    (filters.denizeYakin ? 1 : 0) +
    (filters.denizManzarasi ? 1 : 0);

  // ─── Toolbar styles
  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    cursor: 'pointer', border: '0.5px solid #F6D9A8',
    background: 'white', color: '#8B7355', transition: 'all 0.15s',
  };
  const btnActive: React.CSSProperties = {
    background: 'rgba(192,57,43,0.1)', color: '#C0392B',
    border: '1px solid rgba(192,57,43,0.35)',
  };

  const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: 'yeni', label: 'En Yeni' },
    { value: 'eski', label: 'En Eski' },
    { value: 'fiyat_asc', label: 'En Düşük Fiyat' },
    { value: 'fiyat_desc', label: 'En Yüksek Fiyat' },
  ];

  const PRICE_RANGES: { value: PriceRange; label: string }[] = [
    { value: '0-5', label: '0–5M' },
    { value: '5-10', label: '5–10M' },
    { value: '10-20', label: '10–20M' },
    { value: '20+', label: '20M+' },
  ];

  // ─── Render card
  const renderCard = (p: Portfoy) => {
    const score = calcScore(p);
    const days = daysSince(p.created_at);
    return (
      <div
        key={p.id}
        className="transition-all duration-200 cursor-pointer group hover:shadow-lg overflow-hidden rounded-xl"
        style={{
          background: 'white',
          border: '0.5px solid #F6D9A8',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#C0392B')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#F6D9A8')}
        onClick={() => { setSelected(p); setAiResult(null); }}
      >
        {/* Cover photo */}
        {p.kapak_foto ? (
          <div className="relative h-40 overflow-hidden">
            <img src={p.kapak_foto} alt={p.isim} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <div style={{ color: '#C0392B', fontSize: 18, fontWeight: 700 }}>
                {p.fiyat ? displayPrice(p.fiyat, (p.para_birimi as Currency) || 'TL') : 'Fiyat belirtilmemiş'}
              </div>
            </div>
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${tipColors[p.tip]}`}>
                {TIP_OPTIONS.find(t => t.value === p.tip)?.label}
              </span>
            </div>
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
              <PortfoyStatusBadge durum={p.portfoy_durum} />
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(0,0,0,0.5)', color: '#8B7355', border: '0.5px solid rgba(212,201,184,0.5)' }}
              >
                {days}g
              </span>
            </div>
            {(p.fotograflar?.length || 0) > 0 && (
              <div className="absolute bottom-2 right-2">
                <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)' }}>
                  <Images size={10} />
                  {p.fotograflar!.length}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-28 flex items-center justify-center" style={{ background: '#FDF3E3' }}>
            <Building2 size={32} style={{ color: '#D4C9B8' }} />
          </div>
        )}

        <div className="p-4">
          {!p.kapak_foto && (
            <div className="flex items-start justify-between mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${tipColors[p.tip]}`}>
                {TIP_OPTIONS.find(t => t.value === p.tip)?.label}
              </span>
              <div className="flex items-center gap-1">
                <PortfoyStatusBadge durum={p.portfoy_durum} />
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: 'rgba(192,57,43,0.06)', color: '#8B7355', border: '0.5px solid #F6D9A8' }}
                >
                  {days}g
                </span>
              </div>
            </div>
          )}
          <h3 className="font-semibold text-sm mb-1 line-clamp-2 transition-colors" style={{ color: '#1A1A18' }}>{p.isim}</h3>
          {(p.bolge || p.mahalle || p.ilce) && (
            <div className="flex items-center gap-1 text-xs mb-2" style={{ color: '#8B7355' }}>
              <MapPin size={11} />
              {p.bolge || [p.mahalle, p.ilce].filter(Boolean).join(', ')}
            </div>
          )}
          {!p.kapak_foto && (
            <div className="mb-2" style={{ color: '#C0392B', fontSize: 18, fontWeight: 700 }}>
              {p.fiyat ? displayPrice(p.fiyat, (p.para_birimi as Currency) || 'TL') : 'Fiyat belirtilmemiş'}
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-2" style={{ color: '#8B7355' }}>
            {p.oda && <span className="flex items-center gap-1"><Home size={11} />{p.oda}</span>}
            {p.metrekare && <span className="flex items-center gap-1"><Ruler size={11} />{p.metrekare} m²</span>}
            {p.durum_bina && <span>{p.durum_bina}</span>}
          </div>

          {/* Sea badges */}
          {(p.denize_yakin || p.deniz_manzarasi) && (
            <div className="flex gap-1 mb-2">
              {p.denize_yakin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
                  Denize Yakın
                </span>
              )}
              {p.deniz_manzarasi && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee' }}>
                  Deniz Manzaralı
                </span>
              )}
            </div>
          )}

          {/* EİDS mini badge */}
          {!isGuestUser && p.eids_status && p.eids_status !== 'yok' && (
            <div className="mb-2">
              {(() => {
                const ec = eidsStatusColor(p.eids_status as EidsStatus);
                const days = p.eids_status === 'aktif' ? daysUntilExpiry(p.eids_yetki_bitis) : null;
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: ec.bg, color: ec.text }}>
                    <span className="w-1 h-1 rounded-full" style={{ background: ec.dot }} />
                    EİDS: {days !== null ? `${days}g` : EIDS_STATUS_LABELS[p.eids_status as EidsStatus]?.slice(0, 12)}
                  </span>
                );
              })()}
            </div>
          )}

          <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '0.5px solid #F6D9A8' }}>
            <span className="text-xs truncate max-w-[40%]" style={{ color: '#8B7355' }}>{!isGuestUser ? (p.danisman || `${p.sahip_ad} ${maskSoyad(p.sahip_soyad, p)}`) : ''}</span>
            {!isGuestUser && (
              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <PortfoyWhatsApp portfoy={p} />
                <button
                  onClick={() => setQrPortfoy(p)}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-xl transition-all"
                  style={{ background: 'rgba(100,181,246,0.12)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.25)' }}
                >
                  <QrCode size={12} />
                </button>
                {p.baska_emlakci && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(192,57,43,0.1)', color: '#C0392B' }}>Başka</span>
                )}
                <ScoreBadge score={score} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render list row
  const renderListRow = (p: Portfoy) => {
    const score = calcScore(p);
    const days = daysSince(p.created_at);
    return (
      <tr
        key={p.id}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '0.5px solid #F6D9A8' }}
        onClick={() => { setSelected(p); setAiResult(null); }}
      >
        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#8B7355' }}>
          {!isGuestUser ? ([p.ada, p.parsel].filter(Boolean).join('/') || '—') : '—'}
        </td>
        <td className="px-3 py-2">
          <div className="text-sm font-medium line-clamp-1" style={{ color: '#1A1A18' }}>{p.isim}</div>
          {(p.denize_yakin || p.deniz_manzarasi) && (
            <div className="flex gap-1 mt-0.5">
              {p.denize_yakin && <span className="text-[9px] px-1 py-px rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>DY</span>}
              {p.deniz_manzarasi && <span className="text-[9px] px-1 py-px rounded" style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee' }}>DM</span>}
            </div>
          )}
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap hidden md:table-cell" style={{ color: '#8B7355' }}>{p.bolge || p.mahalle || '—'}</td>
        <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#C0392B', fontSize: 18, fontWeight: 700 }}>
          {p.fiyat ? displayPrice(p.fiyat, (p.para_birimi as Currency) || 'TL') : '—'}
        </td>
        <td className="px-3 py-2 hidden sm:table-cell">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tipColors[p.tip]}`}>
            {TIP_OPTIONS.find(t => t.value === p.tip)?.label}
          </span>
        </td>
        <td className="px-3 py-2 hidden sm:table-cell">
          <PortfoyStatusBadge durum={p.portfoy_durum} />
        </td>
        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: '#8B7355' }}>{days}g</td>
        <td className="px-3 py-2"><ScoreBadge score={score} /></td>
        <td className="px-3 py-2">
          {!isGuestUser && (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { openEdit(p); }}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: 'rgba(192,57,43,0.08)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.15)' }}
              >
                Düzenle
              </button>
              <button
                onClick={() => remove(p.id)}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                Sil
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  // ─── Render group section
  const renderGroup = (group: { key: string; label: string; items: Portfoy[] }) => {
    const isCollapsed = collapsedGroups.has(group.key);
    return (
      <div key={group.key} className="mb-6">
        {groupBy !== 'none' && (
          <button
            onClick={() => toggleGroup(group.key)}
            className="flex items-center gap-2 mb-3 w-full text-left"
          >
            {isCollapsed ? <ChevronRight size={14} style={{ color: '#C0392B' }} /> : <ChevronDown size={14} style={{ color: '#C0392B' }} />}
            <span className="text-sm font-semibold" style={{ color: '#C0392B' }}>{group.label}</span>
            <span className="text-xs ml-1" style={{ color: '#8B7355' }}>({group.items.length})</span>
            <span className="flex-1 h-px ml-2" style={{ background: 'rgba(192,57,43,0.12)' }} />
          </button>
        )}
        {!isCollapsed && (
          viewMode === 'kart' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.items.map(renderCard)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: '0.5px solid #F6D9A8' }}>
              <table className="w-full text-sm" style={{ background: 'white' }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #F6D9A8', background: '#1A1A18' }}>
                    {['Ada/Parsel', 'Başlık', 'Bölge', 'Fiyat', 'Tip', 'Durum', 'Gün', 'Skor', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider ${
                          h === 'Bölge' ? 'hidden md:table-cell' : h === 'Tip' || h === 'Durum' ? 'hidden sm:table-cell' : ''
                        }`}
                        style={{ color: '#8B7355' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(renderListRow)}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#FDF3E3' }}>
      {/* ── Top Header Bar ── */}
      <div
        className="px-4 md:px-6 py-3 shrink-0"
        style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}
      >
        {/* Row 1: search + controls + add */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8B7355' }} size={16} />
            <input
              type="text"
              className="input pl-9 py-2 text-sm"
              placeholder="Ara: başlık, bölge, sahip..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="text-xs font-medium rounded-lg px-3 py-2 pr-7 appearance-none cursor-pointer"
              style={{ background: 'white', color: '#8B7355', border: '0.5px solid #F6D9A8' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8B7355' }} />
          </div>

          {/* Group by */}
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
            {(['none', 'bolge', 'durum', 'fiyat'] as GroupBy[]).map(g => {
              const labels: Record<GroupBy, string> = { none: 'Grupla', bolge: 'Bölge', durum: 'Durum', fiyat: 'Fiyat' };
              const isActive = groupBy === g;
              return (
                <button
                  key={g}
                  onClick={() => setGroupBy(isActive && g !== 'none' ? 'none' : g)}
                  className="text-xs px-2.5 py-1.5 rounded-md transition-all font-medium"
                  style={isActive ? btnActive : { color: '#8B7355', background: 'transparent', border: '1px solid transparent', cursor: 'pointer' }}
                >
                  {labels[g]}
                </button>
              );
            })}
          </div>

          {/* View mode */}
          <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
            <button
              onClick={() => setViewMode('kart')}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all font-medium"
              style={viewMode === 'kart' ? btnActive : { color: '#8B7355', background: 'transparent', border: '1px solid transparent', cursor: 'pointer' }}
            >
              <LayoutGrid size={13} />Kart
            </button>
            <button
              onClick={() => setViewMode('liste')}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-all font-medium"
              style={viewMode === 'liste' ? btnActive : { color: '#8B7355', background: 'transparent', border: '1px solid transparent', cursor: 'pointer' }}
            >
              <List size={13} />Liste
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-all relative"
            style={showFilters || activeFilterCount > 0 ? { ...btnBase, ...btnActive } : btnBase}
          >
            <Filter size={13} />
            Filtrele
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center"
                style={{ background: '#C0392B', color: '#fff' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Add — hidden for guests */}
          {!isGuestUser && (
            <button onClick={openAdd} className="shrink-0 py-2 text-sm flex items-center gap-1.5 px-4 rounded-lg font-medium transition-all" style={{ background: '#C0392B', color: 'white', border: 'none' }}>
              <Plus size={15} />Portföy Ekle
            </button>
          )}
        </div>

        {/* Row 2: Filter bar (collapsible) */}
        {showFilters && (
          <div
            className="mt-3 pt-3 space-y-3"
            style={{ borderTop: '0.5px solid #F6D9A8' }}
          >
            {/* Bölge checkboxes */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B7355' }}>Çeşme Bölgesi</div>
              <div className="flex flex-wrap gap-1.5">
                {CESME_BOLGELERI.map(b => {
                  const active = filters.bolgeler.includes(b);
                  return (
                    <button
                      key={b}
                      onClick={() => toggleBolge(b)}
                      className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                      style={active ? btnActive : btnBase}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {/* Tip */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B7355' }}>Tip</div>
                <div className="flex gap-1">
                  {(['tumu', 'daire', 'villa', 'ticari', 'arsa'] as const).map(t => {
                    const active = filters.tip === t;
                    const labels: Record<string, string> = { tumu: 'Tümü', daire: 'Daire', villa: 'Villa', ticari: 'Ticari', arsa: 'Arsa' };
                    return (
                      <button key={t} onClick={() => setFilt({ tip: t })} className="text-xs px-2.5 py-1 rounded-md font-medium transition-all" style={active ? btnActive : btnBase}>
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Durum */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B7355' }}>Portföy Durum</div>
                <div className="flex gap-1">
                  {(['tumu', 'olumlu', 'kararsiz', 'olumsuz'] as const).map(d => {
                    const active = filters.durum === d;
                    const labels: Record<string, string> = { tumu: 'Tümü', olumlu: 'Olumlu', kararsiz: 'Kararsız', olumsuz: 'Olumsuz' };
                    return (
                      <button key={d} onClick={() => setFilt({ durum: d })} className="text-xs px-2.5 py-1 rounded-md font-medium transition-all" style={active ? btnActive : btnBase}>
                        {labels[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price range */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B7355' }}>Fiyat (TL)</div>
                <div className="flex gap-1">
                  {PRICE_RANGES.map(pr => {
                    const active = filters.priceRange === pr.value;
                    return (
                      <button
                        key={pr.value}
                        onClick={() => setFilt({ priceRange: active ? 'all' : pr.value })}
                        className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                        style={active ? btnActive : btnBase}
                      >
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Deniz */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8B7355' }}>Deniz</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilt({ denizeYakin: !filters.denizeYakin })}
                    className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                    style={filters.denizeYakin ? { ...btnActive, color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.12)' } : btnBase}
                  >
                    Denize Yakın
                  </button>
                  <button
                    onClick={() => setFilt({ denizManzarasi: !filters.denizManzarasi })}
                    className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                    style={filters.denizManzarasi ? { ...btnActive, color: '#22d3ee', border: '1px solid rgba(6,182,212,0.4)', background: 'rgba(6,182,212,0.12)' } : btnBase}
                  >
                    Deniz Manzaralı
                  </button>
                </div>
              </div>
            </div>

            {/* Clear */}
            {hasActiveFilters(filters) && (
              <button
                onClick={() => setFilters(emptyFilters())}
                className="flex items-center gap-1.5 text-xs font-medium transition-all"
                style={{ color: '#f87171', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                <X size={12} /> Filtreleri Temizle
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Result count */}
        {!loading && portfoyler.length > 0 && (
          <div className="text-xs mb-4" style={{ color: '#8B7355' }}>
            {processed.length} portföy{activeFilterCount > 0 || search ? ` (${portfoyler.length} toplam)` : ''}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : processed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Building2 size={32} className="mb-2" style={{ color: '#D4C9B8' }} />
            {search || hasActiveFilters(filters) ? 'Arama/filtre sonucu bulunamadı.' : 'Henüz portföy eklenmemiş.'}
          </div>
        ) : (
          <div>
            {groups.map(renderGroup)}
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-3xl">
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{editItem ? 'Portföy Düzenle' : 'Yeni Portföy'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: '#8B7355' }} className="hover:opacity-70"><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-6">

                {/* Kapak Fotoğrafı */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Kapak Fotoğrafı
                  </h3>
                  <div className="space-y-3">
                    {form.kapak_foto && (
                      <div className="relative">
                        <img src={form.kapak_foto} alt="Kapak" className="w-full h-44 object-cover rounded-xl" />
                        <button
                          type="button"
                          onClick={() => setF({ kapak_foto: '' })}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-red-500/80 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <label className={`flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 cursor-pointer transition-colors ${uploading ? 'opacity-50' : ''}`} style={{ borderColor: '#F6D9A8' }}>
                        {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} style={{ color: '#8B7355' }} />}
                        <span className="text-sm" style={{ color: '#8B7355' }}>{uploading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                        />
                      </label>
                      <div className="flex-1">
                        <label className="label">veya URL girin</label>
                        <input
                          className="input"
                          placeholder="https://..."
                          value={form.kapak_foto}
                          onChange={e => setF({ kapak_foto: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Multi Photo Upload */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Fotoğraflar
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1" style={{ background: 'rgba(192,57,43,0.12)', color: '#C0392B' }}>
                      {form.fotograflar?.length || 0} / {MAX_FOTO} fotoğraf
                    </span>
                  </h3>
                  <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 cursor-pointer transition-colors mb-3 ${(uploadingMulti || (form.fotograflar?.length || 0) >= MAX_FOTO) ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ borderColor: '#F6D9A8' }}>
                    {uploadingMulti ? <Loader2 className="animate-spin" size={16} /> : <Images size={16} style={{ color: '#8B7355' }} />}
                    <span className="text-sm" style={{ color: '#8B7355' }}>{uploadingMulti ? 'Yükleniyor...' : (form.fotograflar?.length || 0) >= MAX_FOTO ? `Maksimum ${MAX_FOTO} fotoğrafa ulaşıldı` : 'Birden fazla fotoğraf ekle (min 5 önerilir)'}</span>
                    <input type="file" accept="image/*" multiple className="hidden" disabled={uploadingMulti || (form.fotograflar?.length || 0) >= MAX_FOTO} onChange={e => { if (e.target.files?.length) handleMultiPhotoUpload(e.target.files); }} />
                  </label>
                  {(form.fotograflar?.length || 0) > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {form.fotograflar!.map((foto, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={() => handleFotoDragStart(idx)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleFotoDrop(idx)}
                          className="relative group rounded-xl overflow-hidden aspect-square cursor-grab"
                          style={{ border: idx === 0 ? '2px solid #C0392B' : '0.5px solid #F6D9A8' }}
                        >
                          <img src={foto.url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <div className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#C0392B', color: '#fff' }}>KAPAK</div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <GripVertical size={14} className="text-white" />
                            <button type="button" onClick={() => removeFoto(idx)} className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                              <X size={12} className="text-white" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Mal Sahibi Bilgileri
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Ad"><input className="input" value={form.sahip_ad} onChange={e => setF({ sahip_ad: e.target.value })} required /></FormField>
                    <FormField label="Soyad"><input className="input" value={form.sahip_soyad} onChange={e => setF({ sahip_soyad: e.target.value })} /></FormField>
                    <FormField label="TC Kimlik No"><input className="input" value={form.tc} onChange={e => setF({ tc: e.target.value })} /></FormField>
                    <FormField label="Telefon"><input className="input" value={form.sahip_tel} onChange={e => setF({ sahip_tel: e.target.value })} /></FormField>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Konum
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <FormField label="Çeşme Bölgesi">
                      <select className="input" value={form.bolge} onChange={e => setF({ bolge: e.target.value })}>
                        <option value="">Seçin</option>
                        {CESME_BOLGELERI.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Mahalle"><input className="input" value={form.mahalle} onChange={e => setF({ mahalle: e.target.value })} /></FormField>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField label="İl"><input className="input" value={form.il} onChange={e => setF({ il: e.target.value })} /></FormField>
                    <FormField label="İlçe"><input className="input" value={form.ilce} onChange={e => setF({ ilce: e.target.value })} /></FormField>
                    <FormField label="Ada / Parsel">
                      <div className="flex gap-1">
                        <input className="input" placeholder="Ada" value={form.ada} onChange={e => setF({ ada: e.target.value })} />
                        <input className="input" placeholder="Parsel" value={form.parsel} onChange={e => setF({ parsel: e.target.value })} />
                      </div>
                    </FormField>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Gayrimenkul Detayları
                  </h3>
                  <div className="space-y-3">
                    <FormField label="Başlık"><input className="input" value={form.isim} onChange={e => setF({ isim: e.target.value })} required /></FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Fiyat">
                        <PriceInput
                          value={form.fiyat}
                          currency={(form.para_birimi as Currency) || 'TL'}
                          onValueChange={v => setF({ fiyat: v })}
                          onCurrencyChange={c => setF({ para_birimi: c })}
                          placeholder="3.500.000"
                        />
                      </FormField>
                      <FormField label="Tip">
                        <select className="input" value={form.tip} onChange={e => setF({ tip: e.target.value as PortfoyTip })}>
                          {TIP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </FormField>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Oda Sayısı">
                        <select className="input" value={form.oda} onChange={e => setF({ oda: e.target.value })}>
                          <option value="">Seçin</option>
                          {ODA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Metrekare"><input className="input" placeholder="m²" value={form.metrekare} onChange={e => setF({ metrekare: e.target.value })} /></FormField>
                      <FormField label="Bina Yaşı">
                        <select className="input" value={form.durum_bina} onChange={e => setF({ durum_bina: e.target.value })}>
                          <option value="">Seçin</option>
                          {YAS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Kat"><input className="input" placeholder="ör. 3. Kat" value={form.kat} onChange={e => setF({ kat: e.target.value })} /></FormField>
                      <FormField label="Isıtma">
                        <select className="input" value={form.isitma} onChange={e => setF({ isitma: e.target.value })}>
                          <option value="">Seçin</option>
                          {ISITMA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </FormField>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Portföy Durumu
                  </h3>
                  <div className="flex gap-2 mb-3">
                    {([['olumlu', 'Olumlu', 'bg-green-500/10 text-green-400 border-green-500/30'],
                      ['kararsiz', 'Kararsız', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'],
                      ['olumsuz', 'Olumsuz', 'bg-red-500/10 text-red-400 border-red-500/30']] as const).map(([val, label, cls]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setF({ portfoy_durum: val })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.portfoy_durum === val ? cls + ' scale-105' : 'bg-white text-[#8B7355] border-[#D4C9B8]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="label">Anahtar Nerede?</label>
                      <select
                        className="input"
                        value={ANAHTAR_OPTIONS.includes(form.anahtar_nerede) ? form.anahtar_nerede : (form.anahtar_nerede ? 'Diğer' : '')}
                        onChange={e => {
                          if (e.target.value === 'Diğer') setF({ anahtar_nerede: 'Diğer' });
                          else setF({ anahtar_nerede: e.target.value });
                        }}
                      >
                        <option value="">Seçin</option>
                        {ANAHTAR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    {(form.anahtar_nerede === 'Diğer' || (!ANAHTAR_OPTIONS.includes(form.anahtar_nerede) && form.anahtar_nerede)) && (
                      <div>
                        <label className="label">Diğer (belirtin)</label>
                        <input
                          className="input"
                          placeholder="Anahtar konumu"
                          value={form.anahtar_nerede === 'Diğer' ? '' : form.anahtar_nerede}
                          onChange={e => setF({ anahtar_nerede: e.target.value || 'Diğer' })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={`w-10 h-5 rounded-full transition-all relative ${form.baska_emlakci ? 'bg-red-600' : 'bg-gray-300'}`}
                        onClick={() => setF({ baska_emlakci: !form.baska_emlakci })}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.baska_emlakci ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-sm" style={{ color: '#1A1A18' }}>Başka Emlakçıda İlanı Var</span>
                    </label>
                  </div>
                  {form.baska_emlakci && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="İlan No"><input className="input" value={form.ilan_no} onChange={e => setF({ ilan_no: e.target.value })} /></FormField>
                      <FormField label="Portal Adı"><input className="input" placeholder="ör. Sahibinden" value={form.ilan_portal} onChange={e => setF({ ilan_portal: e.target.value })} /></FormField>
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#C0392B' }}>
                    <span className="w-4 h-px" style={{ background: 'rgba(192,57,43,0.4)' }} />Konum Özellikleri & İlan
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`w-10 h-5 rounded-full transition-all relative ${form.denize_yakin ? 'bg-blue-500' : 'bg-gray-300'}`}
                          onClick={() => setF({ denize_yakin: !form.denize_yakin })}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.denize_yakin ? 'left-5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-sm" style={{ color: '#1A1A18' }}>Denize Yakın</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`w-10 h-5 rounded-full transition-all relative ${form.deniz_manzarasi ? 'bg-cyan-500' : 'bg-gray-300'}`}
                          onClick={() => setF({ deniz_manzarasi: !form.deniz_manzarasi })}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.deniz_manzarasi ? 'left-5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-sm" style={{ color: '#1A1A18' }}>Deniz Manzaralı</span>
                      </label>
                    </div>
                    <div>
                      <label className="label">İlan URL (Sahibinden vb.)</label>
                      <input
                        className="input"
                        placeholder="https://www.sahibinden.com/ilan/..."
                        value={form.ilan_url || ''}
                        onChange={e => setF({ ilan_url: e.target.value })}
                      />
                      <div className="mt-2">
                        <SahibindenFetchButton onFetched={(data) => {
                          const d = data as Record<string, string>;
                          setF({
                            isim: (d.baslik as string) || form.isim,
                            fiyat: (d.fiyat as string) || form.fiyat,
                            para_birimi: (d.para_birimi as string) || form.para_birimi,
                            metrekare: (d.metrekare as string) || form.metrekare,
                            oda: (d.oda_sayisi as string) || form.oda,
                            kat: (d.bulundugu_kat as string) || form.kat,
                            isitma: (d.isitma as string) || form.isitma,
                            aciklama: (d.aciklama as string) || form.aciklama,
                            mahalle: (d.mahalle as string) || form.mahalle,
                            ilce: (d.ilce as string) || form.ilce,
                            il: (d.il as string) || form.il,
                          });
                          toast('İlan bilgileri dolduruldu!');
                        }} />
                      </div>
                    </div>
                  </div>
                </section>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label" style={{ marginBottom: 0 }}>Notlar / Açıklama</label>
                    <DescriptionWriter portfolio={form} onGenerated={(desc) => {
                      setF({ aciklama: desc });
                      toast('Açıklama oluşturuldu!');
                    }} />
                  </div>
                  <div className="relative">
                    <textarea className="input h-24 resize-none pr-10" value={form.aciklama} onChange={e => setF({ aciklama: e.target.value })} />
                    <div className="absolute right-2 top-2">
                      <VoiceInput size="sm" onResult={t => setF({ aciklama: form.aciklama + (form.aciklama ? ' ' : '') + t })} />
                    </div>
                  </div>
                  {form.aciklama && <p className="text-xs mt-1 text-right" style={{ color: '#8B7355' }}>{form.aciklama.length} karakter</p>}
                </div>

                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}>
                  <span className="text-xs" style={{ color: '#8B7355' }}>Danışman: </span>{form.danisman || danismanAdi}
                </div>

                {/* EİDS Section */}
                <section>
                  <h3 className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-amber-400/40" />EİDS Yetki Bilgileri
                  </h3>
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="EİDS Durum">
                        <select className="input" value={form.eids_status ?? 'yok'} onChange={e => setF({ eids_status: e.target.value as EidsStatus })}>
                          <option value="yok">Yok</option>
                          <option value="beklemede">Beklemede</option>
                          <option value="aktif">Aktif</option>
                          <option value="suresi_doldu">Süresi Doldu</option>
                          <option value="iptal_edildi">İptal Edildi</option>
                          <option value="yabanci_malik">Yabancı Malik</option>
                          <option value="tapusuz">Tapusuz</option>
                        </select>
                      </FormField>
                      <FormField label="Yetkili Kişi">
                        <select className="input" value={form.eids_yetkili_kisi ?? ''} onChange={e => setF({ eids_yetkili_kisi: e.target.value })}>
                          <option value="">Seçin</option>
                          <option value="Malik">Malik</option>
                          <option value="Eş">Eş</option>
                          <option value="Akraba">Akraba</option>
                          <option value="Vekil">Vekil</option>
                        </select>
                      </FormField>
                    </div>
                    <FormField label="Taşınmaz Numarası">
                      <input
                        className="input"
                        placeholder="Mal sahibinden alınan numara"
                        value={form.eids_tasinmaz_no ?? ''}
                        onChange={e => setF({ eids_tasinmaz_no: e.target.value })}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Alınan Tarih">
                        <input
                          type="date"
                          className="input"
                          value={form.eids_yetki_baslangic ?? ''}
                          onChange={e => setF({ eids_yetki_baslangic: e.target.value })}
                        />
                      </FormField>
                      <div>
                        <label className="label">Bitiş Tarihi</label>
                        <input
                          type="date"
                          className="input"
                          value={form.eids_yetki_bitis ?? ''}
                          onChange={e => setF({ eids_yetki_bitis: e.target.value })}
                        />
                        {form.eids_yetki_bitis && (() => {
                          const d = daysUntilExpiry(form.eids_yetki_bitis);
                          if (d === null) return null;
                          return (
                            <p className="text-xs mt-1 font-medium" style={{ color: d < 0 ? '#f87171' : d <= 30 ? '#fbbf24' : '#4ade80' }}>
                              {d < 0 ? `${Math.abs(d)} gün geçti` : `${d} gün kaldı`}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <FormField label="Notlar">
                      <textarea
                        className="input resize-none"
                        rows={2}
                        placeholder="EİDS notları..."
                        value={form.eids_notlar ?? ''}
                        onChange={e => setF({ eids_notlar: e.target.value })}
                      />
                    </FormField>
                  </div>
                </section>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : (editItem ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            {selected.kapak_foto && (
              <div className="relative h-52 overflow-hidden">
                <img src={selected.kapak_foto} alt={selected.isim} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold" style={{ color: '#C0392B' }}>{displayPrice(selected.fiyat, (selected.para_birimi as Currency) || 'TL')}</p>
                      <h2 className="text-white font-semibold text-lg mt-0.5">{selected.isim}</h2>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white bg-black/50 rounded-full p-1.5"><X size={18} /></button>
                  </div>
                </div>
              </div>
            )}
            {!selected.kapak_foto && (
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#F6D9A8' }}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${tipColors[selected.tip]}`}>
                    {TIP_OPTIONS.find(t => t.value === selected.tip)?.label}
                  </span>
                  <PortfoyStatusBadge durum={selected.portfoy_durum} />
                </div>
                <button onClick={() => setSelected(null)} style={{ color: '#8B7355' }} className="hover:opacity-70"><X size={20} /></button>
              </div>
            )}
            <div className="p-5 space-y-5">
              {!selected.kapak_foto && (
                <div>
                  <h2 className="text-xl font-semibold mb-1" style={{ color: '#1A1A18' }}>{selected.isim}</h2>
                  <p className="text-2xl font-bold" style={{ color: '#C0392B' }}>{displayPrice(selected.fiyat, (selected.para_birimi as Currency) || 'TL')}</p>
                </div>
              )}

              {/* Photo gallery */}
              {(selected.fotograflar?.length || 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Images size={14} style={{ color: '#8B7355' }} />
                    <span className="text-xs font-semibold" style={{ color: '#8B7355' }}>
                      {selected.fotograflar!.length} fotoğraf
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {selected.fotograflar!.map((foto, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setLightboxPhotos(selected.fotograflar!); setLightboxIdx(idx); }}
                        className="relative aspect-square rounded-xl overflow-hidden group"
                      >
                        <img src={foto.url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        {idx === 0 && (
                          <div className="absolute top-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: '#C0392B', color: '#fff' }}>KAPAK</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selected.kapak_foto && (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${tipColors[selected.tip]}`}>
                    {TIP_OPTIONS.find(t => t.value === selected.tip)?.label}
                  </span>
                  <PortfoyStatusBadge durum={selected.portfoy_durum} />
                </div>
              )}

              {/* Days + score row */}
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(192,57,43,0.06)', color: '#8B7355', border: '0.5px solid #F6D9A8' }}>
                  {daysSince(selected.created_at)} gün önce eklendi
                </span>
                <ScoreBadge score={calcScore(selected)} />
              </div>

              {(selected.bolge || selected.mahalle || selected.ilce) && (
                <p className="text-sm flex items-center gap-1" style={{ color: '#8B7355' }}>
                  <MapPin size={13} />
                  {[selected.bolge, selected.mahalle, selected.ilce, selected.il].filter(Boolean).join(', ')}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 text-sm">
                {([
                  ['Oda', selected.oda],
                  ['Metrekare', selected.metrekare ? `${selected.metrekare} m²` : ''],
                  ['Bina Yaşı', selected.durum_bina],
                  ['Kat', selected.kat],
                  ['Isıtma', selected.isitma],
                  ...(!isGuestUser ? [['Ada/Parsel', [selected.ada, selected.parsel].filter(Boolean).join('/')]] : []),
                ] as [string, string][]).map(([label, value]) => value ? (
                  <div key={label} className="rounded-lg p-2.5" style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8' }}>
                    <p className="text-xs" style={{ color: '#8B7355' }}>{label}</p>
                    <p className="text-sm" style={{ color: '#1A1A18' }}>{value}</p>
                  </div>
                ) : null)}
              </div>

              {isGuestUser && (
                <a
                  href="https://wa.me/905324140034"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  İletişim İçin WhatsApp
                </a>
              )}

              {!isGuestUser && selected.danisman && (
                <div className="rounded-lg p-3" style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>Danışman</p>
                  <p style={{ color: '#1A1A18' }}>{selected.danisman}</p>
                </div>
              )}

              {!isGuestUser && (
                <div className="rounded-lg p-3" style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8' }}>
                  <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Mal Sahibi</p>
                  <p style={{ color: '#1A1A18' }}>{selected.sahip_ad} {maskSoyad(selected.sahip_soyad, selected)}</p>
                  <p className="text-sm" style={{ color: '#8B7355' }}>
                    {maskPhone(selected.sahip_tel, selected)}
                    {canSeePhone(selected) && selected.tc && ` • TC: ${selected.tc}`}
                  </p>
                </div>
              )}

              {!isGuestUser && selected.anahtar_nerede && (
                <div className="rounded-lg p-3" style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8' }}>
                  <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>Anahtar Nerede</p>
                  <p style={{ color: '#1A1A18' }}>{selected.anahtar_nerede}</p>
                </div>
              )}

              {!isGuestUser && selected.baska_emlakci && (
                <div className="rounded-lg p-3" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)' }}>
                  <p className="text-sm font-medium" style={{ color: '#C0392B' }}>Başka Emlakçıda İlan Mevcut</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>{selected.ilan_portal} • İlan No: {selected.ilan_no}</p>
                </div>
              )}

              {(selected.denize_yakin || selected.deniz_manzarasi) && (
                <div className="flex gap-2">
                  {selected.denize_yakin && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                      Denize Yakın
                    </span>
                  )}
                  {selected.deniz_manzarasi && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}>
                      Deniz Manzaralı
                    </span>
                  )}
                </div>
              )}

              {!isGuestUser && selected.ilan_url && (
                <a
                  href={selected.ilan_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: 'rgba(255,184,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,184,0,0.25)' }}
                >
                  Sahibinden'de Gör
                </a>
              )}

              {!isGuestUser && selected.aciklama && (
                <div className="rounded-lg p-3" style={{ background: '#FDF3E3', border: '0.5px solid #F6D9A8' }}>
                  <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Notlar</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A18' }}>{selected.aciklama}</p>
                </div>
              )}

              {/* EİDS Yetki Durumu */}
              {!isGuestUser && (
                <EidsCard portfoy={selected} isAdminOrYonetici={isAdminOrYonetici} danismanAdi={danismanAdi} onUpdated={load} />
              )}

              {/* WhatsApp + QR buttons (staff only) */}
              {!isGuestUser && (
                <div className="flex gap-2">
                  <PortfoyWhatsApp portfoy={selected} />
                  <button
                    onClick={() => setQrPortfoy(selected)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-all"
                    style={{ background: 'rgba(100,181,246,0.12)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.25)' }}
                  >
                    <QrCode size={14} />QR Kod
                  </button>
                </div>
              )}

              {/* Photo Enhancer + PDF buttons */}
              {!isGuestUser && selected.kapak_foto && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEnhancerUrl(selected.kapak_foto)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'rgba(192,57,43,0.08)', color: '#C0392B', border: '1px solid rgba(192,57,43,0.2)' }}
                  >
                    <Wand2 size={15} />
                    Fotoğraf İyileştir
                  </button>
                  <button
                    onClick={() => exportPdf(selected)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{ background: 'rgba(100,181,246,0.08)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.2)' }}
                  >
                    <FileDown size={15} />
                    PDF Sunum
                  </button>
                </div>
              )}

              {/* Documents */}
              {!isGuestUser && (
                <div className="rounded-xl p-4" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <BelgelerPage portfoyId={selected.id} compact />
                </div>
              )}

              {/* Matching history */}
              {!isGuestUser && (
                <div className="rounded-xl p-4" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <EslestirmePanel portfoyId={selected.id} />
                </div>
              )}

              {/* Similar portfolios */}
              {!isGuestUser && portfoyler.length > 1 && (
                <div className="rounded-xl p-4" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <SearchIcon size={14} style={{ color: '#D4AF37' }} />
                    <span className="text-sm font-semibold" style={{ color: '#1A1A18' }}>Benzer Portföyler</span>
                  </div>
                  <SimilarPortfoliosPanel portfolio={selected} allPortfolios={portfoyler} />
                </div>
              )}

              {!isGuestUser && (
                <div>
                  <label className="label mb-2">Durum Güncelle</label>
                  <div className="flex gap-2">
                    {([['olumlu', 'Olumlu', 'bg-green-500/10 text-green-400 border-green-500/30'],
                      ['kararsiz', 'Kararsız', 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'],
                      ['olumsuz', 'Olumsuz', 'bg-red-500/10 text-red-400 border-red-500/30']] as const).map(([val, label, cls]) => (
                      <button
                        key={val}
                        onClick={() => updateDurum(selected.id, val)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${selected.portfoy_durum === val ? cls + ' scale-105' : 'bg-white text-[#8B7355] border-[#D4C9B8] hover:border-[#C0392B]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isGuestUser && (
                <div>
                  <button onClick={() => runAI(selected)} disabled={aiLoading} className="btn-gold w-full justify-center">
                    {aiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    {aiLoading ? 'Analiz yapılıyor...' : 'Piyasa Analizi Yap'}
                  </button>
                  {aiLoading && (
                    <div className="mt-3 rounded-2xl p-6 flex flex-col items-center gap-3" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                      <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid rgba(192,57,43,0.15)', borderTopColor: '#C0392B' }} />
                      <p className="text-xs" style={{ color: '#8B7355' }}>Piyasa verileri analiz ediliyor...</p>
                    </div>
                  )}
                  {aiResult && <PiyasaAnaliziKart analiz={aiResult} />}
                </div>
              )}

              {!isGuestUser && (
                <div className="flex gap-2">
                  <button onClick={() => { openEdit(selected); setSelected(null); }} className="btn-ghost flex-1 justify-center">Düzenle</button>
                  <button onClick={() => remove(selected.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium px-4 py-2 rounded-lg transition-all text-sm flex items-center justify-center gap-2">Sil</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrPortfoy && <QRModal portfoy={qrPortfoy} onClose={() => setQrPortfoy(null)} />}

      {/* Photo Enhancer */}
      {enhancerUrl && <PhotoEnhancer imageUrl={enhancerUrl} onClose={() => setEnhancerUrl(null)} />}

      {/* Lightbox */}
      {lightboxPhotos && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.95)' }}
          onClick={() => setLightboxPhotos(null)}
        >
          <button
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.max(0, i - 1)); }}
            disabled={lightboxIdx === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <img
            src={lightboxPhotos[lightboxIdx]?.url}
            alt={`${lightboxIdx + 1}`}
            className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.min(lightboxPhotos.length - 1, i + 1)); }}
            disabled={lightboxIdx === lightboxPhotos.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <ChevronRight size={20} className="text-white" />
          </button>
          <button
            onClick={() => setLightboxPhotos(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <X size={18} className="text-white" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightboxIdx + 1} / {lightboxPhotos.length}
          </div>
        </div>
      )}
    </div>
  );
}
