import { useState, useEffect } from 'react';
import {
  X, Loader2, RefreshCw, Copy, ExternalLink, Clock, TrendingUp,
  MessageSquare, Bot, Target, Phone, Search, Sparkles, CheckSquare,
  AlertCircle, BarChart3, FileText, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { callClaude } from '../lib/claude';
import { supabase } from '../lib/supabase';
import { Musteri, Portfoy } from '../types';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function cleanNum(v: string | number | null | undefined): number {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[^\d]/g, '')) || 0;
}

function parseJSON<T>(text: string): T | null {
  try {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch { /* */ }
  return null;
}

// ─── FEATURE 3: Smart Call Timing ────────────────────────────────────────────

interface CallTimingResult {
  en_iyi_gun: string;
  en_iyi_saat: string;
  iletisim_yontemi: string;
  sebep: string;
  dikkat: string;
}

export function CallTimingCard({ customer }: { customer: Musteri }) {
  const [result, setResult] = useState<CallTimingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const analyze = async () => {
    setLoading(true);
    try {
      const prompt = `
Müşteri bilgileri:
- Ad: ${customer.ad} ${customer.soyad}
- Notlar: ${customer.notlar || 'Yok'}
- Bütçe: ${customer.butce_max || customer.butce}
- Durum: ${customer.durum}
- Eklenme tarihi: ${customer.created_at}

Bu müşteri için en iyi iletişim zamanını öner. Sadece JSON döndür:
{"en_iyi_gun":"Salı-Perşembe","en_iyi_saat":"14:00-17:00","iletisim_yontemi":"WhatsApp","sebep":"Kısa açıklama","dikkat":"Uyarı notu"}`;
      const raw = await callClaude(prompt, 400);
      const parsed = parseJSON<CallTimingResult>(raw);
      if (parsed) setResult(parsed);
    } catch { /* */ }
    setLoading(false);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #F6D9A8', background: 'white' }}>
      <button
        onClick={() => { setOpen(v => !v); if (!open && !result) analyze(); }}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        style={{ color: '#1A1A18' }}
      >
        <div className="flex items-center gap-2">
          <Clock size={15} style={{ color: '#D4AF37' }} />
          En İyi Arama Saati
        </div>
        {open ? <ChevronUp size={14} style={{ color: '#8B7355' }} /> : <ChevronDown size={14} style={{ color: '#8B7355' }} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {loading && <div className="flex items-center gap-2 py-2" style={{ color: '#8B7355' }}><Loader2 size={14} className="animate-spin" /> Analiz ediliyor...</div>}
          {result && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: '#F5F0E8' }}>
                <span style={{ color: '#8B7355' }}>En İyi Gün</span>
                <span className="font-semibold" style={{ color: '#22A05A' }}>{result.en_iyi_gun}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: '#F5F0E8' }}>
                <span style={{ color: '#8B7355' }}>En İyi Saat</span>
                <span className="font-semibold" style={{ color: '#22A05A' }}>{result.en_iyi_saat}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: '#F5F0E8' }}>
                <span style={{ color: '#8B7355' }}>Yöntem</span>
                <span className="font-semibold" style={{ color: '#1A1A18' }}>{result.iletisim_yontemi}</span>
              </div>
              <p className="text-xs px-1" style={{ color: '#8B7355' }}>{result.sebep}</p>
              {result.dikkat && (
                <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(248,163,30,0.08)', border: '1px solid rgba(248,163,30,0.2)' }}>
                  <AlertCircle size={12} style={{ color: '#E8A020', marginTop: 2 }} />
                  <p className="text-xs" style={{ color: '#8B7355' }}>{result.dikkat}</p>
                </div>
              )}
              <button onClick={analyze} disabled={loading} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: '#F5F0E8', color: '#8B7355' }}>
                <RefreshCw size={11} /> Yenile
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FEATURE 4: Auto Customer Summary ────────────────────────────────────────

export function CustomerSummaryCard({ customer }: { customer: Musteri }) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const cacheKey = `musteri_ozet_${customer.id}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setSummary(cached); return; }
    generate();
  }, [customer.id]);

  const generate = async () => {
    setLoading(true);
    try {
      const daysSince = Math.floor((Date.now() - new Date(customer.created_at).getTime()) / 86400000);
      const prompt = `Şu emlak müşterisini 2-3 cümleyle özetle. Türkçe, samimi, profesyonel.
Ad: ${customer.ad} ${customer.soyad}
Süredir arıyor: ${daysSince} gün
Bütçe: ${customer.butce_min || '?'} - ${customer.butce_max || customer.butce || '?'} TL
Bölge tercihi: ${customer.muhit || 'Belirtilmemiş'}
Durum: ${customer.durum}
Denize yakın: ${customer.denize_yakin ? 'İstiyor' : 'Şart değil'}
Deniz manzarası: ${customer.deniz_manzarasi ? 'İstiyor' : 'Şart değil'}
Notlar: ${customer.notlar || customer.aciklama || 'Yok'}

Sadece 2-3 cümle özet yaz.`;
      const result = await callClaude(prompt, 300);
      setSummary(result.trim());
      localStorage.setItem(cacheKey, result.trim());
    } catch { /* */ }
    setLoading(false);
  };

  if (!summary && !loading) return null;

  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bot size={13} style={{ color: '#D4AF37' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#D4AF37' }}>YZ Özet</span>
        </div>
        <button onClick={generate} disabled={loading} className="p-1 rounded" style={{ color: '#8B7355' }}>
          <RefreshCw size={11} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#8B7355' }}>
          <Loader2 size={12} className="animate-spin" /> Özet oluşturuluyor...
        </div>
      ) : (
        <p className="text-sm italic leading-relaxed" style={{ color: '#5C4A32' }}>{summary}</p>
      )}
    </div>
  );
}

// ─── FEATURE 5: Price Negotiation Assistant ──────────────────────────────────

interface NegotiationResult {
  ilk_teklif: string;
  hedef_fiyat: string;
  en_dusuk_kabul: string;
  strateji: string;
  guclu_argumanlar: string[];
  dikkat_edilecekler: string;
  basari_olasiligi: number;
}

interface NegotiationModalProps {
  customer: Musteri;
  portfolio: Portfoy;
  onClose: () => void;
}

export function NegotiationModal({ customer, portfolio, onClose }: NegotiationModalProps) {
  const [result, setResult] = useState<NegotiationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { analyze(); }, []);

  const analyze = async () => {
    setLoading(true);
    try {
      const customerBudget = cleanNum(customer.butce_max || customer.butce);
      const portfolioPrice = cleanNum(portfolio.fiyat);
      const gap = portfolioPrice - customerBudget;
      const gapPercent = portfolioPrice > 0 ? ((gap / portfolioPrice) * 100).toFixed(1) : '0';

      const prompt = `Sen deneyimli bir emlak müzakere uzmanısın.
Müşteri: ${customer.ad} ${customer.soyad}
Müşteri bütçesi: ${customerBudget.toLocaleString('tr-TR')} TL
Portföy fiyatı: ${portfolioPrice.toLocaleString('tr-TR')} TL
Fark: ${gap.toLocaleString('tr-TR')} TL (%${gapPercent})
Portföy: ${portfolio.isim}
Durum: ${customer.durum}

Sadece JSON döndür:
{"ilk_teklif":"17500000","hedef_fiyat":"16800000","en_dusuk_kabul":"16200000","strateji":"Kısa strateji","guclu_argumanlar":["arg1","arg2","arg3"],"dikkat_edilecekler":"Uyarı","basari_olasiligi":75}`;
      const raw = await callClaude(prompt, 600);
      const parsed = parseJSON<NegotiationResult>(raw);
      if (parsed) setResult(parsed);
    } catch { /* */ }
    setLoading(false);
  };

  const fmt = (v: string) => {
    const n = cleanNum(v);
    return n > 0 ? n.toLocaleString('tr-TR') + ' TL' : v;
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={18} style={{ color: '#D4AF37' }} />
            <div>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Pazarlık Stratejisi</h2>
              <p className="text-xs" style={{ color: '#8B7355' }}>{customer.ad} {customer.soyad} ↔ {portfolio.isim}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <div className="modal-body p-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin" style={{ color: '#D4AF37' }} />
              <p className="text-sm" style={{ color: '#8B7355' }}>Pazarlık stratejisi oluşturuluyor...</p>
            </div>
          )}
          {result && (
            <div className="space-y-4">
              {/* Price range visual */}
              <div className="rounded-xl p-4" style={{ background: '#F5F0E8', border: '1px solid #F6D9A8' }}>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p style={{ color: '#8B7355' }}>İlk Teklif</p>
                    <p className="font-bold text-base mt-1" style={{ color: '#E8A020' }}>{fmt(result.ilk_teklif)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#8B7355' }}>Hedef</p>
                    <p className="font-bold text-base mt-1" style={{ color: '#22A05A' }}>{fmt(result.hedef_fiyat)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#8B7355' }}>En Az</p>
                    <p className="font-bold text-base mt-1" style={{ color: '#FF3B2F' }}>{fmt(result.en_dusuk_kabul)}</p>
                  </div>
                </div>
              </div>

              {/* Success probability */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: '#8B7355' }}>Başarı Olasılığı</span>
                  <span className="font-bold" style={{ color: result.basari_olasiligi >= 60 ? '#22A05A' : '#E8A020' }}>
                    %{result.basari_olasiligi}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8EDF4' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${result.basari_olasiligi}%`, background: result.basari_olasiligi >= 60 ? '#22A05A' : '#E8A020' }}
                  />
                </div>
              </div>

              {/* Strategy */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#D4AF37' }}>Strateji</p>
                <p className="text-sm" style={{ color: '#1A1A18' }}>{result.strateji}</p>
              </div>

              {/* Strong arguments */}
              {result.guclu_argumanlar?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#8B7355' }}>Güçlü Argümanlar</p>
                  <ul className="space-y-1.5">
                    {result.guclu_argumanlar.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckSquare size={13} style={{ color: '#22A05A', marginTop: 2, flexShrink: 0 }} />
                        <span style={{ color: '#1A1A18' }}>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warning */}
              {result.dikkat_edilecekler && (
                <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(248,163,30,0.08)', border: '1px solid rgba(248,163,30,0.2)' }}>
                  <AlertCircle size={14} style={{ color: '#E8A020', marginTop: 1, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: '#8B7355' }}>{result.dikkat_edilecekler}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Kapat</button>
          <button onClick={analyze} disabled={loading} className="btn-gold flex-1 justify-center">
            <RefreshCw size={14} /> Yeniden Analiz
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE 6: Customer Message Writer ──────────────────────────────────────

type MessageType = 'whatsapp' | 'email' | 'sms';
type MessageTone = 'samimi' | 'profesyonel' | 'acil';

interface MessageWriterModalProps {
  customer: Musteri;
  portfolios: Portfoy[];
  onClose: () => void;
}

export function MessageWriterModal({ customer, portfolios, onClose }: MessageWriterModalProps) {
  const [msgType, setMsgType] = useState<MessageType>('whatsapp');
  const [tone, setTone] = useState<MessageTone>('samimi');
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const portfolio = portfolios.find(p => p.id === selectedPortfolio);

  const generate = async () => {
    setLoading(true);
    try {
      const typeInstructions = {
        whatsapp: 'WhatsApp için emoji içeren, kısa, samimi, max 150 kelime.',
        email: 'Resmi email. Önce "Konu: ..." satırı yaz, sonra gövde.',
        sms: 'SMS için max 160 karakter, özlü.',
      };
      const prompt = `Sen DerliEstate Çeşme bölgesi danışmanısın.
Müşteri: ${customer.ad} ${customer.soyad}
${portfolio ? `Portföy: ${portfolio.isim} - ${portfolio.fiyat} - ${portfolio.bolge}` : ''}
Ton: ${tone}
Notlar: ${customer.notlar || ''}

${typeInstructions[msgType]}
Sadece mesaj metnini yaz, başka bir şey ekleme.`;
      const result = await callClaude(prompt, 400);
      setMessage(result.trim());
    } catch { /* */ }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    if (!customer.telefon) return;
    const phone = customer.telefon.replace(/\D/g, '');
    const url = `https://wa.me/${phone.startsWith('0') ? '90' + phone.slice(1) : phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={18} style={{ color: '#D4AF37' }} />
            <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Mesaj Yaz — {customer.ad} {customer.soyad}</h2>
          </div>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <div className="modal-body p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="label">Mesaj Tipi</label>
            <div className="grid grid-cols-3 gap-2">
              {([['whatsapp', 'WhatsApp'], ['email', 'E-posta'], ['sms', 'SMS']] as [MessageType, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setMsgType(v)} className="py-2 rounded-xl text-sm font-semibold transition-all"
                  style={msgType === v ? { background: '#D4AF37', color: '#1A1A18' } : { background: '#F5F0E8', color: '#8B7355', border: '1px solid #F6D9A8' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="label">Ton</label>
            <div className="grid grid-cols-3 gap-2">
              {([['samimi', 'Samimi'], ['profesyonel', 'Profesyonel'], ['acil', 'Acil']] as [MessageTone, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setTone(v)} className="py-2 rounded-xl text-sm font-semibold transition-all"
                  style={tone === v ? { background: '#1A1A18', color: '#D4AF37' } : { background: '#F5F0E8', color: '#8B7355', border: '1px solid #F6D9A8' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio selector */}
          {portfolios.length > 0 && (
            <div>
              <label className="label">Portföy (opsiyonel)</label>
              <select className="input" value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)}>
                <option value="">Portföy seçme</option>
                {portfolios.map(p => <option key={p.id} value={p.id}>{p.isim} — {p.fiyat}</option>)}
              </select>
            </div>
          )}

          {/* Generated message */}
          <div>
            <label className="label">Mesaj</label>
            <textarea
              className="input resize-none"
              rows={6}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Üret butonuna tıkla..."
            />
            <p className="text-xs mt-1 text-right" style={{ color: '#8B7355' }}>{message.length} karakter</p>
          </div>
        </div>
        <div className="modal-footer flex-wrap gap-2">
          <button onClick={generate} disabled={loading} className="btn-gold flex-1 min-w-[120px] justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {message ? 'Yeniden Yaz' : 'Üret'}
          </button>
          {message && (
            <>
              <button onClick={copy} className="btn-ghost flex items-center gap-1.5 flex-1 min-w-[100px] justify-center">
                <Copy size={14} /> {copied ? 'Kopyalandı!' : 'Kopyala'}
              </button>
              {msgType === 'whatsapp' && customer.telefon && (
                <button onClick={openWhatsApp} className="btn-ghost flex items-center gap-1.5 flex-1 min-w-[140px] justify-center" style={{ color: '#22A05A' }}>
                  <ExternalLink size={14} /> WhatsApp'ta Aç
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE 13: Call Coaching ────────────────────────────────────────────────

interface CallCoachingResult {
  acilis_cumlesi: string;
  guclu_yonler: string[];
  dikkat_edilecekler: string[];
  onerilen_portfoyler: string;
  kapatis_stratejisi: string;
  tahmini_sure: string;
}

interface CallCoachingModalProps {
  customer: Musteri;
  onClose: () => void;
}

export function CallCoachingModal({ customer, onClose }: CallCoachingModalProps) {
  const [result, setResult] = useState<CallCoachingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { analyze(); }, []);

  const analyze = async () => {
    setLoading(true);
    try {
      const prompt = `Sen deneyimli bir satış koçusun. Bu müşteri için görüşme hazırlık notu.
Müşteri: ${customer.ad} ${customer.soyad}
Durum: ${customer.durum}
Bütçe: ${customer.butce_max || customer.butce} TL
Bölge: ${customer.muhit}
Notlar: ${customer.notlar || ''}

Sadece JSON döndür:
{"acilis_cumlesi":"Merhaba ${customer.ad} Bey/Hanım...","guclu_yonler":["özellik1","özellik2"],"dikkat_edilecekler":["uyarı1","uyarı2"],"onerilen_portfoyler":"Bölge önerisi","kapatis_stratejisi":"Strateji","tahmini_sure":"10-15 dakika"}`;
      const raw = await callClaude(prompt, 500);
      const parsed = parseJSON<CallCoachingResult>(raw);
      if (parsed) setResult(parsed);
    } catch { /* */ }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
          <div className="flex items-center gap-2">
            <Target size={18} style={{ color: '#D4AF37' }} />
            <div>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Görüşme Koçu</h2>
              <p className="text-xs" style={{ color: '#8B7355' }}>{customer.ad} {customer.soyad} için hazırlık</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <div className="modal-body p-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin" style={{ color: '#D4AF37' }} />
              <p className="text-sm" style={{ color: '#8B7355' }}>Hazırlık notları oluşturuluyor...</p>
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#D4AF37' }}>Açılış Cümlesi</p>
                <p className="text-sm italic" style={{ color: '#1A1A18' }}>"{result.acilis_cumlesi}"</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#22A05A' }}>Güçlü Yönler</p>
                  <ul className="space-y-1">
                    {result.guclu_yonler?.map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <CheckSquare size={11} style={{ color: '#22A05A', marginTop: 1, flexShrink: 0 }} />
                        <span style={{ color: '#1A1A18' }}>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#E8A020' }}>Dikkat Et</p>
                  <ul className="space-y-1">
                    {result.dikkat_edilecekler?.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs">
                        <AlertCircle size={11} style={{ color: '#E8A020', marginTop: 1, flexShrink: 0 }} />
                        <span style={{ color: '#1A1A18' }}>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ background: '#F5F0E8' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#8B7355' }}>Önerilen Portföyler</p>
                <p className="text-sm" style={{ color: '#1A1A18' }}>{result.onerilen_portfoyler}</p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 rounded-xl p-3" style={{ background: '#F5F0E8' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#8B7355' }}>Kapanış</p>
                  <p className="text-xs" style={{ color: '#1A1A18' }}>{result.kapatis_stratejisi}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#F5F0E8', minWidth: 80 }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#8B7355' }}>Süre</p>
                  <p className="text-xs font-bold" style={{ color: '#1A1A18' }}>{result.tahmini_sure}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Kapat</button>
          {customer.telefon && (
            <a
              href={`tel:${customer.telefon}`}
              className="btn-gold flex-1 flex items-center justify-center gap-2"
              onClick={onClose}
            >
              <Phone size={14} /> Aramayı Başlat
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE 9: Similar Portfolio Finder ─────────────────────────────────────

interface SimilarPortfolioCardProps {
  portfolio: Portfoy;
  allPortfolios: Portfoy[];
}

export function SimilarPortfoliosPanel({ portfolio, allPortfolios }: SimilarPortfolioCardProps) {
  const similar = allPortfolios
    .filter(p => p.id !== portfolio.id)
    .map(p => {
      let score = 0;
      const pPrice = cleanNum(p.fiyat);
      const basePrice = cleanNum(portfolio.fiyat);
      if (pPrice > 0 && basePrice > 0) {
        if (pPrice <= basePrice * 0.95) score += 30;
        else if (pPrice <= basePrice * 1.05) score += 20;
      }
      if (p.tip === portfolio.tip) score += 25;
      if (p.bolge === portfolio.bolge) score += 20;
      if (Math.abs((cleanNum(p.metrekare) || 0) - (cleanNum(portfolio.metrekare) || 0)) < 30) score += 15;
      if (p.oda === portfolio.oda) score += 10;
      const priceDiff = basePrice > 0 && pPrice > 0
        ? ((pPrice - basePrice) / basePrice * 100).toFixed(0)
        : null;
      return { ...p, similarityScore: score, priceDiff };
    })
    .filter(p => p.similarityScore > 30)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 5);

  if (similar.length === 0) {
    return <p className="text-sm text-center py-4" style={{ color: '#8B7355' }}>Benzer portföy bulunamadı.</p>;
  }

  return (
    <div className="space-y-2">
      {similar.map(p => {
        const diff = p.priceDiff !== null ? Number(p.priceDiff) : null;
        return (
          <div key={p.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#F5F0E8', border: '1px solid #F6D9A8' }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#1A1A18' }}>{p.isim}</p>
              <p className="text-xs" style={{ color: '#8B7355' }}>{p.bolge || '—'} · {p.tip} · {p.oda}</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: '#D4AF37' }}>{p.fiyat} {p.para_birimi || 'TL'}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {diff !== null && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                  background: diff <= 0 ? 'rgba(34,160,90,0.1)' : 'rgba(239,68,68,0.1)',
                  color: diff <= 0 ? '#22A05A' : '#FF3B2F',
                }}>
                  {diff > 0 ? '+' : ''}{diff}%
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                %{p.similarityScore} benzer
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── FEATURE 7: Portfolio Description Writer ─────────────────────────────────

interface DescriptionWriterProps {
  portfolio: Partial<Portfoy>;
  onGenerated: (desc: string) => void;
}

export function DescriptionWriter({ portfolio, onGenerated }: DescriptionWriterProps) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const prompt = `Sen profesyonel bir emlak ilan yazarısın. Sahibinden.com için çekici ilan açıklaması yaz.
İsim: ${portfolio.isim || ''}
Tip: ${portfolio.tip || ''}
Bölge: ${portfolio.bolge || portfolio.mahalle || portfolio.ilce || 'Çeşme'}
Oda: ${portfolio.oda || ''}
Alan: ${portfolio.metrekare || ''} m²
Fiyat: ${portfolio.fiyat || ''} ${portfolio.para_birimi || 'TL'}
Durum: ${portfolio.durum_bina || ''}
Kat: ${portfolio.kat || ''}
Isıtma: ${portfolio.isitma || ''}
Denize yakın: ${portfolio.denize_yakin ? 'Evet' : 'Hayır'}
Deniz manzarası: ${portfolio.deniz_manzarasi ? 'Evet' : 'Hayır'}

200-300 kelime arası, Türkçe, SEO dostu, Çeşme bölgesini öne çıkaran açıklama yaz.`;
      const result = await callClaude(prompt, 600);
      onGenerated(result.trim());
    } catch { /* */ }
    setLoading(false);
  };

  return (
    <button type="button" onClick={generate} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
      YZ ile Açıklama Yaz
    </button>
  );
}

// ─── FEATURE 10: Weekly AI Briefing ──────────────────────────────────────────

interface WeeklyBriefingModalProps {
  onClose: () => void;
}

export function WeeklyBriefingModal({ onClose }: WeeklyBriefingModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { generate(); }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const [{ data: customers }, { data: portfolios }, { data: tasks }] = await Promise.all([
        supabase.from('musteriler').select('*'),
        supabase.from('portfoyler').select('*'),
        supabase.from('gorevler').select('*').eq('durum', 'bekliyor'),
      ]);

      const hotCustomers = (customers || []).filter((c: Musteri) => c.durum === 'sicak');
      const overdueTasksCount = (tasks || []).filter((t: { son_tarih?: string }) => t.son_tarih && new Date(t.son_tarih) < new Date()).length;

      const prompt = `Sen DerliEstate Çeşme ofisinin YZ asistanısın. Bu hafta için kısa brifing hazırla.
Toplam müşteri: ${customers?.length || 0}
Sıcak müşteriler: ${hotCustomers.length}
Toplam portföy: ${portfolios?.length || 0}
Bekleyen görev: ${tasks?.length || 0}
Gecikmiş görev: ${overdueTasksCount}
Sıcak müşteriler: ${hotCustomers.map((c: Musteri) => c.ad + ' ' + c.soyad).join(', ')}

Markdown formatında, emoji kullanarak, motive edici haftalık brifing yaz.
Bölümler: Bu Hafta Öncelikler, Dikkat Edilecekler, Motivasyon Notu. Max 200 kelime.`;
      const result = await callClaude(prompt, 600);
      setContent(result);

      await supabase.from('haftalik_brifing').insert({
        hafta_baslangic: new Date().toISOString().split('T')[0],
        icerik: result,
        kullanici: 'sistem',
      });
    } catch { /* */ }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} style={{ color: '#D4AF37' }} />
            <div>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Haftalık YZ Brifing</h2>
              <p className="text-xs" style={{ color: '#8B7355' }}>Bu haftanın öncelikleri</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <div className="modal-body p-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin" style={{ color: '#D4AF37' }} />
              <p className="text-sm" style={{ color: '#8B7355' }}>Haftalık brifing hazırlanıyor...</p>
            </div>
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#1A1A18' }}>
              {content}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Kapat</button>
          <button onClick={generate} disabled={loading} className="btn-gold flex-1 justify-center">
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE 11: Market Commentary ───────────────────────────────────────────

interface MarketCommentaryProps {
  rates?: Record<string, { satis?: string }>;
}

export function MarketCommentary({ rates }: MarketCommentaryProps) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [indicator, setIndicator] = useState<'good' | 'neutral' | 'caution'>('neutral');

  const cacheKey = `piyasa_yorum_${new Date().toISOString().split('T')[0]}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { comment: c, indicator: ind } = JSON.parse(cached);
        setComment(c); setIndicator(ind);
      } catch { generate(); }
    } else {
      generate();
    }
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const usd = rates?.USD?.satis || '?';
      const eur = rates?.EUR?.satis || '?';
      const prompt = `Sen Türkiye gayrimenkul piyasası uzmanısın. Kısa yorum yap.
USD/TRY: ${usd}, EUR/TRY: ${eur}
Tarih: ${new Date().toLocaleDateString('tr-TR')}

Çeşme bölgesi için 2-3 cümle, emoji içeren, samimi yorum yaz. Ardından yeni satırda sadece şunu yaz: INDICATOR:good, INDICATOR:neutral, veya INDICATOR:caution`;
      const result = await callClaude(prompt, 300);
      const lines = result.split('\n');
      const indicatorLine = lines.find(l => l.includes('INDICATOR:'));
      const ind = indicatorLine?.includes('good') ? 'good' : indicatorLine?.includes('caution') ? 'caution' : 'neutral';
      const cleanComment = result.replace(/INDICATOR:\w+/g, '').trim();
      setComment(cleanComment);
      setIndicator(ind as 'good' | 'neutral' | 'caution');
      localStorage.setItem(cacheKey, JSON.stringify({ comment: cleanComment, indicator: ind }));
    } catch { /* */ }
    setLoading(false);
  };

  const indicatorConfig = {
    good: { label: 'İyi Gün', color: '#22A05A', bg: 'rgba(34,160,90,0.08)', dot: '#22A05A' },
    neutral: { label: 'Nötr', color: '#E8A020', bg: 'rgba(232,160,32,0.08)', dot: '#E8A020' },
    caution: { label: 'Dikkatli Ol', color: '#FF3B2F', bg: 'rgba(255,59,47,0.08)', dot: '#FF3B2F' },
  };
  const cfg = indicatorConfig[indicator];

  return (
    <div className="rounded-xl p-4" style={{ background: cfg.bg, border: `1px solid ${cfg.dot}30` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} style={{ color: cfg.color }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>Piyasa Yorumu</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.dot}20`, color: cfg.color }}>
            {cfg.label}
          </span>
          <button onClick={generate} disabled={loading} className="p-1 rounded" style={{ color: '#8B7355' }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#8B7355' }}>
          <Loader2 size={12} className="animate-spin" /> Yükleniyor...
        </div>
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: '#5C4A32' }}>{comment}</p>
      )}
    </div>
  );
}

// ─── FEATURE 12: Region Report PDF ───────────────────────────────────────────

export function RegionReportButton() {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const [{ data: portfolios }, { data: customers }] = await Promise.all([
        supabase.from('portfoyler').select('*'),
        supabase.from('musteriler').select('*'),
      ]);

      const regionStats: Record<string, { count: number; totalPrice: number; avgPrice: number }> = {};
      (portfolios || []).forEach((p: Portfoy) => {
        const region = p.bolge || p.mahalle || p.ilce || 'Diğer';
        if (!regionStats[region]) regionStats[region] = { count: 0, totalPrice: 0, avgPrice: 0 };
        regionStats[region].count++;
        regionStats[region].totalPrice += cleanNum(p.fiyat);
      });
      Object.keys(regionStats).forEach(r => {
        regionStats[r].avgPrice = regionStats[r].count > 0 ? regionStats[r].totalPrice / regionStats[r].count : 0;
      });

      const prompt = `Sen Çeşme gayrimenkul piyasası analistsin. Aylık bölge raporu yaz.
Bölge istatistikleri: ${JSON.stringify(regionStats)}
Toplam portföy: ${portfolios?.length || 0}
Toplam müşteri: ${customers?.length || 0}

Şu bölgeleri analiz et: Alaçatı, Çeşme Merkez, Ilıca, Şifne, Reisdere, Dalyan
Her bölge için fiyat trendi, talep, yatırım tavsiyesi. Markdown, 400-500 kelime.`;

      const report = await callClaude(prompt, 1200);

      // Generate simple text-based report download
      const content = `DERLİ EMLAK - Çeşme Bölge Raporu\n${new Date().toLocaleDateString('tr-TR')}\n\n${report}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cesme_bolge_raporu_${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* */ }
    setLoading(false);
  };

  return (
    <button onClick={generate} disabled={loading} className="btn-gold flex items-center gap-2">
      {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
      Bölge Raporu Oluştur
    </button>
  );
}

// ─── FEATURE 14B: Auto Follow-up Reminder ────────────────────────────────────

export function useFollowUpReminders(customers: Musteri[]) {
  const [reminders, setReminders] = useState<{ customer: Musteri; message: string }[]>([]);

  useEffect(() => {
    const hotCustomers = customers.filter(c => c.durum === 'sicak' || c.durum === 'satin_alacak');
    const overdue = hotCustomers.filter(c => {
      const last = c.last_contact || c.created_at;
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      return days >= 3;
    });
    if (overdue.length > 0) {
      setReminders(overdue.slice(0, 3).map(c => ({
        customer: c,
        message: `${c.ad} ${c.soyad}'a ${Math.floor((Date.now() - new Date(c.last_contact || c.created_at).getTime()) / 86400000)} gündür mesaj atmadınız.`,
      })));
    }
  }, [customers]);

  return reminders;
}

// ─── FEATURE 14C: Broadcast List ─────────────────────────────────────────────

interface BroadcastModalProps {
  customers: Musteri[];
  onClose: () => void;
}

export function BroadcastModal({ customers, onClose }: BroadcastModalProps) {
  const [segment, setSegment] = useState<string>('sicak');
  const [template, setTemplate] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);

  const filtered = customers.filter(c => {
    if (segment === 'sicak') return c.durum === 'sicak';
    if (segment === 'satin_alacak') return c.durum === 'satin_alacak';
    if (segment === 'hepsi') return true;
    return c.durum === segment;
  });

  const generateTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const prompt = `DerliEstate Çeşme danışmanı olarak ${segment} müşterilere toplu WhatsApp mesajı yaz. Kısa, emoji içeren, profesyonel. Müşteri adı için {AD} kullan.`;
      const result = await callClaude(prompt, 200);
      setTemplate(result.trim());
    } catch { /* */ }
    setLoadingTemplate(false);
  };

  const openNext = () => {
    const next = currentIdx + 1;
    if (next < filtered.length) {
      const c = filtered[next];
      const phone = c.telefon?.replace(/\D/g, '');
      if (phone) {
        const msg = template.replace('{AD}', c.ad);
        const waPhone = phone.startsWith('0') ? '90' + phone.slice(1) : phone;
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      setCurrentIdx(next);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: '#D4AF37' }} />
            <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Toplu Mesaj</h2>
          </div>
          <button onClick={onClose} style={{ color: '#8B7355' }}><X size={20} /></button>
        </div>
        <div className="modal-body p-5 space-y-4">
          <div>
            <label className="label">Segment</label>
            <select className="input" value={segment} onChange={e => { setSegment(e.target.value); setCurrentIdx(-1); }}>
              <option value="sicak">Sıcak Müşteriler</option>
              <option value="satin_alacak">Satın Alacak</option>
              <option value="dusunuyor">Düşünüyor</option>
              <option value="hepsi">Tümü</option>
            </select>
            <p className="text-xs mt-1" style={{ color: '#8B7355' }}>{filtered.length} müşteri seçildi</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label" style={{ marginBottom: 0 }}>Mesaj Şablonu</label>
              <button onClick={generateTemplate} disabled={loadingTemplate} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                {loadingTemplate ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} YZ ile Oluştur
              </button>
            </div>
            <textarea
              className="input resize-none"
              rows={4}
              value={template}
              onChange={e => setTemplate(e.target.value)}
              placeholder="Mesaj şablonunu buraya yaz... {AD} müşteri adı için kullanılır"
            />
          </div>

          {currentIdx >= 0 && (
            <div className="rounded-xl p-3 text-center text-sm" style={{ background: 'rgba(34,160,90,0.08)', border: '1px solid rgba(34,160,90,0.2)' }}>
              <span style={{ color: '#22A05A' }}>{currentIdx + 1} / {filtered.length} gönderildi</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Kapat</button>
          <button
            onClick={openNext}
            disabled={!template.trim() || filtered.length === 0 || currentIdx >= filtered.length - 1}
            className="btn-gold flex-1 justify-center"
          >
            <Phone size={14} />
            {currentIdx < 0 ? 'Sırayla Aç' : currentIdx < filtered.length - 1 ? 'Sonraki' : 'Tamamlandı'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FEATURE 14A: WhatsApp Reply Suggestions ─────────────────────────────────

interface ReplySuggestionsProps {
  lastMessage: string;
  customer: Musteri | null;
  onSelect: (reply: string) => void;
}

export function WhatsAppReplySuggestions({ lastMessage, customer, onSelect }: ReplySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lastMessage || !customer) return;
    const timer = setTimeout(() => generate(), 500);
    return () => clearTimeout(timer);
  }, [lastMessage, customer?.id]);

  const generate = async () => {
    if (!lastMessage || !customer) return;
    setLoading(true);
    try {
      const prompt = `Müşteri mesajı: "${lastMessage}"
Müşteri: ${customer.ad}, Durum: ${customer.durum}

3 kısa WhatsApp cevap önerisi. Sadece JSON: {"oneriler":["cevap1","cevap2","cevap3"]}`;
      const raw = await callClaude(prompt, 300);
      const parsed = parseJSON<{ oneriler: string[] }>(raw);
      if (parsed?.oneriler) setSuggestions(parsed.oneriler.slice(0, 3));
    } catch { /* */ }
    setLoading(false);
  };

  if (suggestions.length === 0 && !loading) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 py-1">
      {loading && <span className="text-xs" style={{ color: '#8B7355' }}><Loader2 size={10} className="animate-spin inline mr-1" />Öneriler yükleniyor...</span>}
      {suggestions.map((s, i) => (
        <button key={i} onClick={() => onSelect(s)}
          className="text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80"
          style={{ background: 'rgba(212,175,55,0.1)', color: '#8B7355', border: '1px solid rgba(212,175,55,0.3)' }}>
          {s.length > 40 ? s.slice(0, 40) + '…' : s}
        </button>
      ))}
    </div>
  );
}

// ─── FEATURE 1: Sahibinden Fetch Button ──────────────────────────────────────

interface SahibindenFetchProps {
  onFetched: (data: Record<string, unknown>) => void;
}

export function SahibindenFetchButton({ onFetched }: SahibindenFetchProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInput, setShowInput] = useState(false);

  const fetch_ = async () => {
    if (!url.includes('sahibinden.com')) {
      setError('Lütfen geçerli bir Sahibinden.com URL\'si girin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const html = await res.text();

      const prompt = `Bu Sahibinden.com ilan HTML'inden bilgileri çıkar ve JSON olarak döndür:
{"baslik":"...","fiyat":"...","para_birimi":"TL","metrekare":"...","oda_sayisi":"...","bulundugu_kat":"...","bina_katlari":"...","isitma":"...","banyo":"...","aciklama":"...","mahalle":"...","ilce":"...","il":"..."}

HTML (ilk 12000 karakter):
${html.substring(0, 12000)}

Sadece JSON döndür.`;
      const raw = await callClaude(prompt, 800);
      const parsed = parseJSON<Record<string, unknown>>(raw);
      if (parsed) {
        onFetched(parsed);
        setShowInput(false);
        setUrl('');
      } else {
        setError('Ilan bilgileri ayrıştırılamadı.');
      }
    } catch (e) {
      setError('Çekme başarısız: ' + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  };

  if (!showInput) {
    return (
      <button type="button" onClick={() => setShowInput(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
        <Search size={12} /> Sahibinden'den Çek
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
      <p className="text-xs font-semibold" style={{ color: '#D4AF37' }}>Sahibinden.com İlan URL'si</p>
      <div className="flex gap-2">
        <input
          type="url"
          className="input flex-1 text-xs"
          placeholder="https://www.sahibinden.com/ilan/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <button type="button" onClick={fetch_} disabled={loading || !url}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0"
          style={{ background: '#D4AF37', color: '#1A1A18' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : 'Çek'}
        </button>
        <button type="button" onClick={() => { setShowInput(false); setError(''); }}
          className="px-2 py-1.5 rounded-lg text-xs shrink-0"
          style={{ background: '#F5F0E8', color: '#8B7355' }}>
          <X size={12} />
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: '#FF3B2F' }}>{error}</p>}
      {loading && <p className="text-xs" style={{ color: '#8B7355' }}>HTML çekiliyor ve analiz ediliyor...</p>}
    </div>
  );
}
