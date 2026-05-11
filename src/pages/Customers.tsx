import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, Users, Flame, ShoppingCart, Eye, X, Sparkles, Loader2, SlidersHorizontal, ArrowUpDown, Tag, Globe, Brain, Link, Mic, MicOff, Clipboard, Phone, CheckSquare, Square, Share2, ThumbsUp, ThumbsDown, MessageCircle, Building2, Target, MessageSquare, TrendingUp, Zap } from 'lucide-react';
import { CustomerSummaryCard, CallTimingCard, NegotiationModal, MessageWriterModal, CallCoachingModal, BroadcastModal, useFollowUpReminders } from '../components/AIFeatures';
import { Portfoy } from '../types';
import { supabase } from '../lib/supabase';
import { Musteri, MusteriDurum, CESME_BOLGELERI } from '../types';
import { MusteriStatusBadge, musteriConfig } from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import VoiceInput from '../components/VoiceInput';
import PriceInput, { Currency, displayPrice } from '../components/PriceInput';
import { callClaude } from '../lib/claude';
import EslestirmePanel from '../components/EslestirmePanel';
import { MusteriWhatsApp } from '../components/WhatsAppButton';
import { calcTags, calcTier } from '../lib/segmentation';
import BelgelerPage from './Belgeler';

const DURUM_OPTIONS: { value: MusteriDurum; label: string }[] = [
  { value: 'sicak', label: 'Sıcak' },
  { value: 'satin_alacak', label: 'Satın Alacak' },
  { value: 'dusunuyor', label: 'Düşünüyor' },
  { value: 'kararsiz', label: 'Kararsız' },
  { value: 'gelmedi', label: 'No Show' },
  { value: 'soguk', label: 'Soğuk' },
];

type TabKey = 'tumü' | 'acil' | 'aktif' | 'pasif';
type SortKey = 'en_yeni' | 'en_eski' | 'score' | 'butce_asc' | 'butce_desc';

type BudgetRange = '0-5' | '5-10' | '10-20' | '20+' | null;

type FormState = Omit<Musteri, 'id' | 'created_at'>;

function emptyForm(danisman: string, userId = '', userAd = ''): FormState {
  return {
    ad: '', soyad: '', telefon: '', email: '', muhit: '', butce: '',
    butce_min: '', butce_max: '', para_birimi: 'TL', bolge_esnek: false,
    olmaz_olmaz: '', kesin_istekler: '', aciklama: '', danisman,
    portfoy_tercihi: '', durum: 'kararsiz', kaynak: '', notlar: '',
    eklendi_user_id: userId, eklendi_user_ad: userAd,
    denize_yakin: false, deniz_manzarasi: false,
    yabanci_musteri: false, uyruk: '', pasaport_no: '', dil_tercihi: '', turkiye_kalis_suresi: '', vatandaslik_durumu: '',
  };
}

// Micro-site token generator
function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface GorusmeKaydı {
  id: string;
  musteri_id: string;
  ses_url?: string | null;
  transkript?: string | null;
  ozet?: string | null;
  analiz?: Record<string, unknown> | null;
  danisman?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// AI Purchase Score (client-side heuristic, no API calls)
// ---------------------------------------------------------------------------
function calcPurchaseScore(m: Musteri): number {
  let score = 0;
  // Status scores
  if (m.durum === 'sicak') score += 35;
  else if (m.durum === 'satin_alacak') score += 50;
  else if (m.durum === 'dusunuyor') score += 15;
  else if (m.durum === 'kararsiz') score += 10;
  else if (m.durum === 'gelmedi') score += 5;
  else if (m.durum === 'soguk') score += 2;

  // Contact info
  if (m.telefon && m.telefon.trim()) score += 10;
  if (m.email && m.email.trim()) score += 5;

  // Budget
  if ((m.butce_min && m.butce_min.trim()) || (m.butce_max && m.butce_max.trim()) || (m.butce && m.butce.trim())) score += 10;

  // Flexibility
  if (m.bolge_esnek) score += 5;

  // Sea preferences
  if (m.denize_yakin) score += 5;
  if (m.deniz_manzarasi) score += 5;

  // Notes / description
  if ((m.aciklama && m.aciklama.trim()) || (m.notlar && m.notlar.trim())) score += 5;

  return Math.min(100, Math.max(0, score));
}

function ScoreBadge({ score }: { score: number }) {
  const getScoreStyle = (s: number) => {
    if (s >= 75) return { color: '#FF3B2F', barBg: 'linear-gradient(90deg, #FF3B2F, #FF8C00)' };
    if (s >= 50) return { color: '#E8A020', barBg: 'linear-gradient(90deg, #E8A020, #F0C040)' };
    return { color: '#22A05A', barBg: 'linear-gradient(90deg, #22A05A, #40C070)' };
  };
  const style = getScoreStyle(score);
  return (
    <div style={{ textAlign: 'right' }}>
      <span style={{ fontSize: '26px', fontWeight: 800, color: style.color, lineHeight: 1 }}>{score}</span>
      <div style={{ height: '8px', background: '#EDE5D8', borderRadius: '4px', width: '60px', marginTop: '3px' }}>
        <div style={{ height: '100%', width: `${score}%`, background: style.barBg, borderRadius: '4px' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parse budget string to millions (TL) for range filtering
// ---------------------------------------------------------------------------
function parseBudgetToMillions(m: Musteri): number | null {
  const raw = m.butce_max || m.butce_min || m.butce || '';
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return null;
  // If para_birimi is not TL, skip budget range filter (return null = unknown)
  if (m.para_birimi && m.para_birimi !== 'TL') return null;
  // Values stored as plain numbers (e.g. 5000000 = 5M)
  return n / 1_000_000;
}

// ---------------------------------------------------------------------------
// Days since a date
// ---------------------------------------------------------------------------
function daysSince(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Customers() {
  const { toast } = useToast();
  const { effectiveUser, user } = useAuth();
  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
  const canSeePhone = (record: { eklendi_user_id?: string }) =>
    effectiveUser?.rol === 'admin' || effectiveUser?.username === 'superadmin' || record.eklendi_user_id === effectiveUser?.username;

  const maskPhone = (phone: string, record: { eklendi_user_id?: string }) =>
    canSeePhone(record) ? phone : '••• •••• ••••';
  const maskEmail = (email: string, record: { eklendi_user_id?: string }) =>
    canSeePhone(record) ? email : '••••••••';
  const isAdminOrYonetici = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';

  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Musteri | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(danismanAdi, effectiveUser?.username || '', danismanAdi));
  const [saving, setSaving] = useState(false);
  const [selectedMusteri, setSelectedMusteri] = useState<Musteri | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [personalityLoading, setPersonalityLoading] = useState(false);
  const [personalityResult, setPersonalityResult] = useState<Record<string, string> | null>(null);
  const [callRecords, setCallRecords] = useState<GorusmeKaydı[]>([]);
  const [showCallForm, setShowCallForm] = useState(false);
  const [callTranscript, setCallTranscript] = useState('');
  const [callSaving, setCallSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micrositeLoading, setMicrositeLoading] = useState(false);
  const [showPortfoySecim, setShowPortfoySecim] = useState(false);
  const [allPortfoyler, setAllPortfoyler] = useState<Portfoy[]>([]);
  const [selectedPortfoyIds, setSelectedPortfoyIds] = useState<string[]>([]);
  const [activeLink, setActiveLink] = useState<{ id: string; token: string; url: string } | null>(null);
  const [reaksiyonlar, setReaksiyonlar] = useState<{ portfoy_id: string; reaksiyon: string; yorum?: string; created_at: string }[]>([]);
  const [reaksiyonlarLoading, setReaksiyonlarLoading] = useState(false);

  // AI Feature modals
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [negotiationPortfolio, setNegotiationPortfolio] = useState<Portfoy | null>(null);
  const [showMessageWriter, setShowMessageWriter] = useState(false);
  const [showCallCoaching, setShowCallCoaching] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [detailPortfoyler, setDetailPortfoyler] = useState<Portfoy[]>([]);

  const followUpReminders = useFollowUpReminders(musteriler);

  // Tab / sort / filter state
  const [activeTab, setActiveTab] = useState<TabKey>('tumü');
  const [sortBy, setSortBy] = useState<SortKey>('en_yeni');
  const [showFilters, setShowFilters] = useState(false);
  const [filterBolgeler, setFilterBolgeler] = useState<string[]>([]);
  const [filterBudget, setFilterBudget] = useState<BudgetRange>(null);
  const [filterDenizeYakin, setFilterDenizeYakin] = useState(false);
  const [filterDenizManzarasi, setFilterDenizManzarasi] = useState(false);
  const [filterDurumlar, setFilterDurumlar] = useState<MusteriDurum[]>([]);
  const [filterSegment, setFilterSegment] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('musteriler').select('*').order('created_at', { ascending: false });
    setMusteriler(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasActiveFilters = filterBolgeler.length > 0 || filterBudget !== null || filterDenizeYakin || filterDenizManzarasi || filterDurumlar.length > 0 || filterSegment !== null;

  const clearFilters = () => {
    setFilterBolgeler([]);
    setFilterBudget(null);
    setFilterDenizeYakin(false);
    setFilterDenizManzarasi(false);
    setFilterDurumlar([]);
    setFilterSegment(null);
  };

  // Tab counts
  const tabCounts = useMemo(() => ({
    tumü: musteriler.length,
    acil: musteriler.filter(m => m.durum === 'sicak' || m.durum === 'satin_alacak').length,
    aktif: musteriler.filter(m => m.durum === 'dusunuyor' || m.durum === 'kararsiz').length,
    pasif: musteriler.filter(m => m.durum === 'gelmedi' || m.durum === 'soguk').length,
  }), [musteriler]);

  // Full pipeline: search → tab → filters → sort
  const filtered = useMemo(() => {
    let list = musteriler;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.ad.toLowerCase().includes(q) ||
        m.soyad.toLowerCase().includes(q) ||
        m.telefon.includes(q) ||
        m.muhit.toLowerCase().includes(q) ||
        m.portfoy_tercihi.toLowerCase().includes(q)
      );
    }

    // Tab filter
    if (activeTab === 'acil') {
      list = list.filter(m => m.durum === 'sicak' || m.durum === 'satin_alacak');
    } else if (activeTab === 'aktif') {
      list = list.filter(m => m.durum === 'dusunuyor' || m.durum === 'kararsiz');
    } else if (activeTab === 'pasif') {
      list = list.filter(m => m.durum === 'gelmedi' || m.durum === 'soguk');
    }

    // Segment tag filter
    if (filterSegment) {
      list = list.filter(m => calcTags(m).some(t => t.key === filterSegment));
    }

    // Durum checkboxes filter
    if (filterDurumlar.length > 0) {
      list = list.filter(m => filterDurumlar.includes(m.durum));
    }

    // Bölge filter
    if (filterBolgeler.length > 0) {
      list = list.filter(m => filterBolgeler.some(b => m.muhit.toLowerCase().includes(b.toLowerCase())));
    }

    // Budget filter (TL only, skip if unknown)
    if (filterBudget) {
      list = list.filter(m => {
        const mil = parseBudgetToMillions(m);
        if (mil === null) return true;
        if (filterBudget === '0-5') return mil <= 5;
        if (filterBudget === '5-10') return mil > 5 && mil <= 10;
        if (filterBudget === '10-20') return mil > 10 && mil <= 20;
        if (filterBudget === '20+') return mil > 20;
        return true;
      });
    }

    // Denize yakın / Deniz manzarası
    if (filterDenizeYakin) list = list.filter(m => m.denize_yakin);
    if (filterDenizManzarasi) list = list.filter(m => m.deniz_manzarasi);

    // Sort
    if (sortBy === 'en_yeni') {
      list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'en_eski') {
      list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'score') {
      list = [...list].sort((a, b) => calcPurchaseScore(b) - calcPurchaseScore(a));
    } else if (sortBy === 'butce_desc') {
      list = [...list].sort((a, b) => (parseBudgetToMillions(b) ?? -1) - (parseBudgetToMillions(a) ?? -1));
    } else if (sortBy === 'butce_asc') {
      list = [...list].sort((a, b) => (parseBudgetToMillions(a) ?? Infinity) - (parseBudgetToMillions(b) ?? Infinity));
    }

    return list;
  }, [musteriler, search, activeTab, filterBolgeler, filterBudget, filterDenizeYakin, filterDenizManzarasi, filterDurumlar, filterSegment, sortBy]);

  const stats = {
    total: musteriler.length,
    sicak: musteriler.filter(m => m.durum === 'sicak').length,
    satin_alacak: musteriler.filter(m => m.durum === 'satin_alacak').length,
    gelmedi: musteriler.filter(m => m.durum === 'gelmedi').length,
  };

  const openAdd = () => { setForm(emptyForm(danismanAdi, effectiveUser?.username || '', danismanAdi)); setEditItem(null); setShowForm(true); };
  const openEdit = (m: Musteri) => { setForm({ ...m }); setEditItem(m); setShowForm(true); };
  const canEdit = (m: Musteri) => isAdminOrYonetici || m.eklendi_user_id === effectiveUser?.username || !m.eklendi_user_id;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (editItem) {
      const { error } = await supabase.from('musteriler').update(payload).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else toast('Müşteri güncellendi.');
    } else {
      const { error } = await supabase.from('musteriler').insert(payload);
      if (error) toast('Hata oluştu.', 'error'); else toast('Müşteri eklendi.');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Bu müşteriyi silmek istediğinizden emin misiniz?')) return;
    await supabase.from('musteriler').delete().eq('id', id);
    toast('Müşteri silindi.');
    load();
    if (selectedMusteri?.id === id) setSelectedMusteri(null);
  };

  const updateDurum = async (id: string, durum: MusteriDurum) => {
    await supabase.from('musteriler').update({ durum }).eq('id', id);
    toast('Durum güncellendi.');
    load();
    if (selectedMusteri?.id === id) setSelectedMusteri(prev => prev ? { ...prev, durum } : null);
  };

  const loadCallRecords = useCallback(async (musteriId: string) => {
    const { data } = await supabase.from('gorusme_kayitlari').select('*').eq('musteri_id', musteriId).order('created_at', { ascending: false });
    setCallRecords((data || []) as GorusmeKaydı[]);
  }, []);

  const runPersonalityAnalysis = async (m: Musteri) => {
    setPersonalityLoading(true);
    setPersonalityResult(null);
    try {
      const prompt = `Müşteri bilgilerine göre kişilik analizi yap. Şu 5 boyutu değerlendir ve her birini kısa cümleyle açıkla:
1. İletişim Stili (Direkt mi, Dolaylı mı?)
2. Karar Verme Hızı (Hızlı mı, Temkinli mi?)
3. Risk Toleransı (Risk Seven mi, Kaçınan mı?)
4. Motivasyonu (Ne onu satın almaya iter?)
5. Satış Stratejisi (Bu müşteriye nasıl yaklaşılmalı?)

Müşteri: ${m.ad} ${m.soyad}
Durum: ${m.durum}
Açıklama: ${m.aciklama || ''}
Notlar: ${m.notlar || ''}
Kaynak: ${m.kaynak || ''}
${m.yabanci_musteri ? `Yabancı Uyruklu: ${m.uyruk || ''}, Dil: ${m.dil_tercihi || ''}` : ''}

Yanıt formatı (sadece JSON, başka metin yok):
{"iletisim_stili":"...","karar_hizi":"...","risk_toleransi":"...","motivasyon":"...","satis_stratejisi":"..."}`;

      const result = await callClaude(prompt, 500);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setPersonalityResult(JSON.parse(jsonMatch[0]));
      } else {
        setPersonalityResult({ genel: result });
      }
    } catch (err) {
      toast(`Kişilik analizi hatası: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    setPersonalityLoading(false);
  };

  const saveCallSummary = async (m: Musteri) => {
    if (!callTranscript.trim()) return;
    setCallSaving(true);
    try {
      const prompt = `Aşağıdaki müşteri görüşme transkripsiyonunu analiz et ve özetle:

Müşteri: ${m.ad} ${m.soyad}
Transkript:
${callTranscript}

JSON formatında yanıt ver:
{"ozet":"Görüşmenin kısa özeti","ana_konular":"Konuşulan ana konular","sonuc":"Görüşme sonucu","aksiyon":"Alınması gereken aksiyon adımları","tonlama":"Müşterinin genel tutumu (pozitif/nötr/negatif)"}`;

      const result = await callClaude(prompt, 600);
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      const analiz = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      const ozet = analiz?.ozet || result.slice(0, 300);

      await supabase.from('gorusme_kayitlari').insert({
        musteri_id: m.id,
        transkript: callTranscript,
        ozet,
        analiz,
        danisman: danismanAdi,
      });

      toast('Görüşme kaydı eklendi.', 'success');
      setCallTranscript('');
      setShowCallForm(false);
      loadCallRecords(m.id);
    } catch (err) {
      toast(`Kayıt hatası: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    setCallSaving(false);
  };

  const openDetail = async (m: Musteri) => {
    setSelectedMusteri(m);
    loadCallRecords(m.id);
    loadReaksiyonlar(m.id);
    // Load portfolios for AI features
    const { data } = await supabase.from('portfoyler').select('id, isim, bolge, fiyat, para_birimi, tip, metrekare, oda, mahalle, ilce').order('created_at', { ascending: false });
    setDetailPortfoyler((data || []) as Portfoy[]);
  };

  const openPortfoySecim = async (m: Musteri) => {
    // Load all portfolios for selection
    const { data } = await supabase.from('portfoyler').select('id, isim, bolge, mahalle, ilce, fiyat, para_birimi, tip, kapak_foto').order('created_at', { ascending: false });
    setAllPortfoyler((data || []) as Portfoy[]);
    // Pre-check existing active link's portfolios
    const { data: linkData } = await supabase
      .from('musteri_linkler')
      .select('*')
      .eq('musteri_id', m.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (linkData) {
      setSelectedPortfoyIds(Array.isArray(linkData.portfoy_ids) ? linkData.portfoy_ids : []);
      setActiveLink({ id: linkData.id, token: linkData.token, url: `${window.location.origin}/?microsite=${linkData.token}` });
    } else {
      setSelectedPortfoyIds([]);
      setActiveLink(null);
    }
    setShowPortfoySecim(true);
  };

  const loadReaksiyonlar = async (musteriId: string) => {
    setReaksiyonlarLoading(true);
    // Find the latest link for this customer
    const { data: linkData } = await supabase
      .from('musteri_linkler')
      .select('id')
      .eq('musteri_id', musteriId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!linkData) { setReaksiyonlar([]); setReaksiyonlarLoading(false); return; }
    const { data } = await supabase
      .from('musteri_reaksiyonlar')
      .select('*')
      .eq('link_id', linkData.id)
      .order('created_at', { ascending: false });
    setReaksiyonlar(data || []);
    setReaksiyonlarLoading(false);
  };

  const generateMicrosite = async (m: Musteri) => {
    if (selectedPortfoyIds.length === 0) {
      toast('En az bir portföy seçin.', 'error');
      return;
    }
    setMicrositeLoading(true);
    const token = generateToken();
    try {
      const { data: inserted } = await supabase.from('musteri_linkler').insert({
        token,
        musteri_id: m.id,
        musteri_ad: `${m.ad} ${m.soyad}`.trim(),
        portfoy_ids: selectedPortfoyIds,
        danisman_username: effectiveUser?.username,
        danisman_ad: `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).select().maybeSingle();
      if (inserted) {
        const url = `${window.location.origin}/?microsite=${token}`;
        setActiveLink({ id: inserted.id, token, url });
        toast('Müşteri sayfası oluşturuldu!', 'success');
      }
    } catch {
      toast('Sayfa oluşturulamadı.', 'error');
    }
    setMicrositeLoading(false);
  };

  const shareWhatsApp = (url: string, m: Musteri) => {
    const text = `Merhaba ${m.ad}, size özel seçtiğim portföyleri incelemenizi isterim: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const startVoiceTranscript = () => {
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast('Ses tanıma desteklenmiyor.', 'error'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setCallTranscript(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const runAI = async (m: Musteri) => {
    setAiLoading(true);
    setAiResult('');
    try {
      const prompt = `Aşağıdaki müşteri bilgilerini analiz et ve şunları belirt:
1. Satın alma olasılığı (%)
2. Aciliyet seviyesi
3. Davranış analizi
4. 3 aksiyon adımı
5. Riskler

Müşteri Bilgileri:
Ad: ${m.ad} ${m.soyad}
Telefon: ${m.telefon}
Muhit/Tercih Bölge: ${m.muhit}
Bütçe: ${m.butce_min ? `${m.butce_min} - ${m.butce_max} TL` : m.butce}
Bölge Esnek: ${m.bolge_esnek ? 'Evet' : 'Hayır'}
Olmazsa Olmaz: ${m.olmaz_olmaz}
Kesin İstekler: ${m.kesin_istekler}
Açıklama: ${m.aciklama}
Durum: ${m.durum}
Kaynak: ${m.kaynak}
Notlar: ${m.notlar}`;

      setAiResult(await callClaude(prompt));
    } catch (err) {
      setAiResult(`AI analizi sırasında hata oluştu: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAiLoading(false);
  };

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const toggleBolge = (b: string) => {
    setFilterBolgeler(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  const toggleDurum = (d: MusteriDurum) => {
    setFilterDurumlar(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  // Segment widget counts
  const segmentCounts = useMemo(() => {
    return {
      vip: musteriler.filter(m => calcTags(m).some(t => t.key === 'vip')).length,
      acil: musteriler.filter(m => calcTags(m).some(t => t.key === 'acil')).length,
      yeni: musteriler.filter(m => calcTags(m).some(t => t.key === 'yeni')).length,
    };
  }, [musteriler]);

  const BUDGET_BUTTONS: { label: string; value: BudgetRange }[] = [
    { label: '0-5M', value: '0-5' },
    { label: '5-10M', value: '5-10' },
    { label: '10-20M', value: '10-20' },
    { label: '20M+', value: '20+' },
  ];

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'tumü', label: 'Tümü' },
    { key: 'acil', label: 'Acil' },
    { key: 'aktif', label: 'Aktif' },
    { key: 'pasif', label: 'Pasif' },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: '#FDF3E3' }}>
      {/* Top bar */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(212,175,55,0.25)', background: 'white' }}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: '#8B7355' }} />
            <input
              type="text"
              className="input pl-10 py-2.5 text-base"
              placeholder="Müşteri ara: ad, telefon, muhit, tercih..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8B7355' }}>
                <X size={16} />
              </button>
            )}
          </div>
          {/* YZ Öncelik Sırala button */}
          <button
            onClick={() => setSortBy(s => s === 'score' ? 'en_yeni' : 'score')}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={sortBy === 'score'
              ? { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }
              : { background: 'rgba(26,26,24,0.06)', color: '#8B7355', border: '1px solid rgba(26,26,24,0.12)' }
            }
          >
            <Sparkles size={14} />
            YZ Öncelik Sırala
          </button>
          <button onClick={openAdd} className="btn-gold shrink-0">
            <Plus size={16} />
            Müşteri Ekle
          </button>
        </div>

        {/* Tab filter bar */}
        <div className="flex items-center gap-0 mt-3" style={{ borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all relative"
                style={isActive
                  ? { color: '#D4AF37', borderBottom: '2px solid #D4AF37', marginBottom: '-1px' }
                  : { color: '#8B7355', borderBottom: '2px solid transparent', marginBottom: '-1px' }
                }
              >
                {tab.label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={isActive
                    ? { background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }
                    : { background: 'rgba(26,26,24,0.06)', color: '#8B7355' }
                  }
                >
                  {tabCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0" style={{ background: '#FDF3E3' }}>
        {[
          { label: 'Toplam', value: stats.total, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Sıcak', value: stats.sicak, icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Satın Alacak', value: stats.satin_alacak, icon: ShoppingCart, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'No Show', value: stats.gelmedi, icon: Eye, color: 'text-dark-300', bg: 'bg-dark-700' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3" style={{ background: '#1A1A18' }}>
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#F5F0E8' }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#8B7355' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Segment widget bar */}
      {(segmentCounts.vip > 0 || segmentCounts.acil > 0 || segmentCounts.yeni > 0) && (
        <div className="px-6 py-2.5 shrink-0 flex items-center gap-2 flex-wrap" style={{ background: '#F5F0E8', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
          {segmentCounts.vip > 0 && (
            <button
              onClick={() => setFilterSegment(s => s === 'vip' ? null : 'vip')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filterSegment === 'vip'
                ? { background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.5)' }
                : { background: 'rgba(212,175,55,0.08)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }
              }
            >
              🌟 {segmentCounts.vip} VIP Müşteri
            </button>
          )}
          {segmentCounts.acil > 0 && (
            <button
              onClick={() => setFilterSegment(s => s === 'acil' ? null : 'acil')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filterSegment === 'acil'
                ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)' }
                : { background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
              }
            >
              🔥 {segmentCounts.acil} Acil Alıcı
            </button>
          )}
          {segmentCounts.yeni > 0 && (
            <button
              onClick={() => setFilterSegment(s => s === 'yeni' ? null : 'yeni')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={filterSegment === 'yeni'
                ? { background: 'rgba(100,181,246,0.2)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.5)' }
                : { background: 'rgba(100,181,246,0.08)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.2)' }
              }
            >
              🆕 {segmentCounts.yeni} Yeni Müşteri
            </button>
          )}
          {filterSegment && (
            <button
              onClick={() => setFilterSegment(null)}
              className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all"
              style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)' }}
            >
              <X size={11} /> Segment Filtresi Kaldır
            </button>
          )}
        </div>
      )}

      {/* Filter & Sort bar */}
      <div className="px-6 py-2 shrink-0 flex items-center gap-3 flex-wrap" style={{ background: '#F5F0E8', borderBottom: '1px solid rgba(212,175,55,0.12)' }}>
        {/* Filtrele toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={showFilters || hasActiveFilters
            ? { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }
            : { background: 'rgba(26,26,24,0.06)', color: '#8B7355', border: '1px solid rgba(26,26,24,0.12)' }
          }
        >
          <SlidersHorizontal size={13} />
          Filtrele
          {hasActiveFilters && (
            <span style={{ background: 'linear-gradient(135deg, #D4AF37, #C8804B)', color: '#fff', borderRadius: '999px', padding: '0 5px', fontSize: '10px', fontWeight: 700 }}>
              {filterBolgeler.length + (filterBudget ? 1 : 0) + (filterDenizeYakin ? 1 : 0) + (filterDenizManzarasi ? 1 : 0) + filterDurumlar.length}
            </span>
          )}
        </button>

        {/* Sort options */}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <ArrowUpDown size={12} style={{ color: '#8B7355' }} />
          {([
            { key: 'en_yeni', label: 'En Yeni' },
            { key: 'en_eski', label: 'En Eski' },
            { key: 'butce_desc', label: 'Bütçe ↓' },
            { key: 'butce_asc', label: 'Bütçe ↑' },
            { key: 'score', label: 'YZ Öncelik' },
          ] as { key: SortKey; label: string }[]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className="px-2.5 py-1 rounded text-xs font-medium transition-all"
              style={sortBy === opt.key
                ? { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }
                : { color: '#8B7355', border: '1px solid transparent' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <div className="px-6 py-3 shrink-0 space-y-3" style={{ background: '#F5F0E8', borderBottom: '1px solid rgba(212,175,55,0.12)' }}>
          {/* Bölge chips */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#8B7355' }}>Bölge</p>
            <div className="flex flex-wrap gap-1.5">
              {CESME_BOLGELERI.map(b => {
                const active = filterBolgeler.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => toggleBolge(b)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={active
                      ? { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }
                      : { background: 'rgba(26,26,24,0.06)', color: '#8B7355', border: '1px solid rgba(26,26,24,0.12)' }
                    }
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget range */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#8B7355' }}>Bütçe (TL)</p>
            <div className="flex flex-wrap gap-2">
              {BUDGET_BUTTONS.map(btn => {
                const active = filterBudget === btn.value;
                return (
                  <button
                    key={btn.value}
                    onClick={() => setFilterBudget(active ? null : btn.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={active
                      ? { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }
                      : { background: 'rgba(26,26,24,0.06)', color: '#8B7355', border: '1px solid rgba(26,26,24,0.1)' }
                    }
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Durum checkboxes */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#8B7355' }}>Durum</p>
            <div className="flex flex-wrap gap-2">
              {DURUM_OPTIONS.map(opt => {
                const active = filterDurumlar.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleDurum(opt.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={active
                      ? { background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.35)' }
                      : { background: 'rgba(26,26,24,0.06)', color: '#8B7355', border: '1px solid rgba(26,26,24,0.1)' }
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sea toggles */}
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterDenizeYakin}
                onChange={e => setFilterDenizeYakin(e.target.checked)}
                style={{ accentColor: '#60a5fa' }}
              />
              <span className="text-sm" style={{ color: filterDenizeYakin ? '#60a5fa' : '#8B7355' }}>Denize Yakın</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterDenizManzarasi}
                onChange={e => setFilterDenizManzarasi(e.target.checked)}
                style={{ accentColor: '#22d3ee' }}
              />
              <span className="text-sm" style={{ color: filterDenizManzarasi ? '#22d3ee' : '#8B7355' }}>Deniz Manzaralı</span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.07)' }}
              >
                <X size={12} />
                Filtreleri Temizle
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6" style={{ background: '#FDF3E3' }}>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#1A1A18', borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#8B7355' }}>Ad Soyad</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#8B7355' }}>Telefon</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: '#8B7355' }}>Muhit</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: '#8B7355' }}>Bütçe</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden lg:table-cell" style={{ color: '#8B7355' }}>Danışman</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#8B7355' }}>Durum</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#8B7355' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12" style={{ color: '#8B7355' }}><Loader2 className="animate-spin mx-auto mb-2" size={24} />Yükleniyor...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12" style={{ color: '#8B7355' }}>
                    {search || hasActiveFilters ? 'Arama/filtre sonucu bulunamadı.' : 'Henüz müşteri eklenmemiş.'}
                  </td></tr>
                ) : filtered.map(m => {
                  const score = calcPurchaseScore(m);
                  const budgetDisplay = m.butce_min && m.butce_max
                    ? `${displayPrice(m.butce_min, (m.para_birimi as Currency) || 'TL')} – ${displayPrice(m.butce_max, (m.para_birimi as Currency) || 'TL')}`
                    : m.butce || null;

                  return (
                    <tr key={m.id} className="transition-colors" style={{ borderBottom: '0.5px solid #E8DFD0' }}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <button className="font-medium hover:text-gold-400 transition-colors text-left" style={{ color: '#1A1A18' }} onClick={() => { openDetail(m); setAiResult(''); setPersonalityResult(null); setActiveLink(null); setReaksiyonlar([]); }}>
                            {m.ad} {m.soyad}
                          </button>
                          <div className="mt-0.5">
                            <ScoreBadge score={score} />
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(() => { const tier = calcTier(m); return tier.label !== 'Normal' ? (
                              <span style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}44`, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, display: 'inline-block' }}>
                                {tier.label}
                              </span>
                            ) : null; })()}
                            {calcTags(m).map(tag => (
                              <span key={tag.key} style={{ background: tag.bg, color: tag.color, border: `1px solid ${tag.color}33`, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, display: 'inline-block' }}>
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1A1A18' }}>{maskPhone(m.telefon, m)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <span style={{ color: '#1A1A18' }}>{m.muhit || '-'}</span>
                          {(m.denize_yakin || m.deniz_manzarasi) && (
                            <div className="flex gap-1 flex-wrap">
                              {m.denize_yakin && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                                  Denize Yakın
                                </span>
                              )}
                              {m.deniz_manzarasi && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)' }}>
                                  Manzaralı
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {budgetDisplay ? (
                          <span style={{ fontSize: 18, fontWeight: 700, color: '#C0392B' }}>{budgetDisplay}</span>
                        ) : (
                          <span style={{ color: '#8B7355' }}>-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs hidden lg:table-cell" style={{ color: '#1A1A18' }}>{m.danisman || '-'}</td>
                      <td className="px-4 py-3"><MusteriStatusBadge durum={m.durum} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { openDetail(m); setAiResult(''); setPersonalityResult(null); setActiveLink(null); setReaksiyonlar([]); }} className="hover:text-gold-400 transition-colors p-1.5 rounded text-xs" style={{ color: '#8B7355' }}>
                            <Eye size={14} />
                          </button>
                          <button onClick={() => openEdit(m)} className="transition-colors p-1.5 rounded text-xs" style={{ color: '#8B7355' }}>Düzenle</button>
                          <button onClick={() => remove(m.id)} className="hover:text-red-400 transition-colors p-1.5 rounded text-xs" style={{ color: '#8B7355' }}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{editItem ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
            <div className="modal-body p-5 space-y-5">
              {/* Temel Bilgiler */}
              <section>
                <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-4 h-px bg-gold-400/40" />Temel Bilgiler
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Ad</label><input className="input" value={form.ad} onChange={e => setF({ ad: e.target.value })} required /></div>
                  <div><label className="label">Soyad</label><input className="input" value={form.soyad} onChange={e => setF({ soyad: e.target.value })} /></div>
                  <div><label className="label">Telefon</label><input className="input" value={form.telefon} onChange={e => setF({ telefon: e.target.value })} /></div>
                  <div><label className="label">E-posta</label><input type="email" className="input" value={form.email} onChange={e => setF({ email: e.target.value })} /></div>
                  <div><label className="label">Kaynak</label><input className="input" placeholder="ör. Instagram, Referans" value={form.kaynak} onChange={e => setF({ kaynak: e.target.value })} /></div>
                  <div>
                    <label className="label">Durum</label>
                    <select className="input" value={form.durum} onChange={e => setF({ durum: e.target.value as MusteriDurum })}>
                      {DURUM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Bütçe & Bölge */}
              <section>
                <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-4 h-px bg-gold-400/40" />Bütçe & Bölge
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Bütçe Min</label>
                    <PriceInput
                      value={form.butce_min}
                      currency={(form.para_birimi as Currency) || 'TL'}
                      onValueChange={v => setF({ butce_min: v })}
                      onCurrencyChange={c => setF({ para_birimi: c })}
                      placeholder="2.000.000"
                    />
                  </div>
                  <div>
                    <label className="label">Bütçe Max</label>
                    <PriceInput
                      value={form.butce_max}
                      currency={(form.para_birimi as Currency) || 'TL'}
                      onValueChange={v => setF({ butce_max: v })}
                      onCurrencyChange={c => setF({ para_birimi: c })}
                      placeholder="5.000.000"
                    />
                  </div>
                  <div><label className="label">Tercih Bölge / Muhit</label><input className="input" placeholder="ör. Alaçatı" value={form.muhit} onChange={e => setF({ muhit: e.target.value })} /></div>
                  <div><label className="label">Portföy Tercihi</label><input className="input" placeholder="ör. 3+1 Villa" value={form.portfoy_tercihi} onChange={e => setF({ portfoy_tercihi: e.target.value })} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-6 mt-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8B7355' }}>Bölge Esnek?</label>
                    <div
                      className={`w-10 h-5 rounded-full transition-all relative cursor-pointer ${form.bolge_esnek ? 'bg-gold-400' : 'bg-dark-600'}`}
                      onClick={() => setF({ bolge_esnek: !form.bolge_esnek })}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.bolge_esnek ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm" style={{ color: '#8B7355' }}>{form.bolge_esnek ? 'Evet' : 'Hayır'}</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`w-10 h-5 rounded-full transition-all relative ${form.denize_yakin ? 'bg-blue-500' : 'bg-dark-600'}`}
                      onClick={() => setF({ denize_yakin: !form.denize_yakin })}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.denize_yakin ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Denize Yakın</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`w-10 h-5 rounded-full transition-all relative ${form.deniz_manzarasi ? 'bg-cyan-500' : 'bg-dark-600'}`}
                      onClick={() => setF({ deniz_manzarasi: !form.deniz_manzarasi })}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.deniz_manzarasi ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm" style={{ color: '#1A1A18' }}>Deniz Manzaralı</span>
                  </label>
                </div>
              </section>

              {/* İstekler */}
              <section>
                <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-4 h-px bg-gold-400/40" />İstekler & Gereksinimler
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="label">Olmazsa Olmaz İstekler</label>
                    <div className="relative">
                      <input className="input pr-10" placeholder="ör. mutlaka deniz manzarası, mutlaka Alaçatı" value={form.olmaz_olmaz} onChange={e => setF({ olmaz_olmaz: e.target.value })} />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <VoiceInput size="sm" onResult={t => setF({ olmaz_olmaz: form.olmaz_olmaz + (form.olmaz_olmaz ? ' ' : '') + t })} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Kesin İstekler <span className="text-amber-400">(AI bu kuralları mutlaka uygular)</span></label>
                    <div className="relative">
                      <input className="input pr-10" placeholder="ör. sadece Alaçatı — AI başka bölge önermez" value={form.kesin_istekler} onChange={e => setF({ kesin_istekler: e.target.value })} />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <VoiceInput size="sm" onResult={t => setF({ kesin_istekler: form.kesin_istekler + (form.kesin_istekler ? ' ' : '') + t })} />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Açıklama */}
              <section>
                <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-4 h-px bg-gold-400/40" />Danışman Notları
                </h3>
                <div>
                  <label className="label">Açıklama (AI eşleştirme için kullanılır)</label>
                  <div className="relative">
                    <textarea className="input h-24 resize-none pr-10" placeholder="Müşteri hakkında detaylı bilgi..." value={form.aciklama} onChange={e => setF({ aciklama: e.target.value })} />
                    <div className="absolute right-2 top-2">
                      <VoiceInput size="sm" onResult={t => setF({ aciklama: form.aciklama + (form.aciklama ? ' ' : '') + t })} />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">Notlar</label>
                  <div className="relative">
                    <textarea className="input h-20 resize-none pr-10" value={form.notlar} onChange={e => setF({ notlar: e.target.value })} />
                    <div className="absolute right-2 top-2">
                      <VoiceInput size="sm" onResult={t => setF({ notlar: form.notlar + (form.notlar ? ' ' : '') + t })} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Yabancı Müşteri */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                    <span className="w-4 h-px bg-gold-400/40" /><Globe size={12} />Yabancı Müşteri
                  </h3>
                  <div
                    className={`w-10 h-5 rounded-full transition-all relative cursor-pointer ${form.yabanci_musteri ? 'bg-gold-400' : 'bg-dark-600'}`}
                    onClick={() => setF({ yabanci_musteri: !form.yabanci_musteri })}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.yabanci_musteri ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>
                {form.yabanci_musteri && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: 'rgba(212,168,67,0.05)', border: '1px solid rgba(212,168,67,0.15)' }}>
                    <div><label className="label">Uyruk / Milliyet</label><input className="input" placeholder="ör. Alman, Rus, İngiliz" value={form.uyruk || ''} onChange={e => setF({ uyruk: e.target.value })} /></div>
                    <div><label className="label">Pasaport No</label><input className="input" placeholder="Pasaport numarası" value={form.pasaport_no || ''} onChange={e => setF({ pasaport_no: e.target.value })} /></div>
                    <div><label className="label">Dil Tercihi</label><input className="input" placeholder="ör. İngilizce, Almanca" value={form.dil_tercihi || ''} onChange={e => setF({ dil_tercihi: e.target.value })} /></div>
                    <div><label className="label">Türkiye Kalış Süresi</label><input className="input" placeholder="ör. 6 ay, 1 yıl" value={form.turkiye_kalis_suresi || ''} onChange={e => setF({ turkiye_kalis_suresi: e.target.value })} /></div>
                    <div className="col-span-2"><label className="label">Vatandaşlık Durumu</label><input className="input" placeholder="ör. Başvurulacak, Aktif, Gerekmiyor" value={form.vatandaslik_durumu || ''} onChange={e => setF({ vatandaslik_durumu: e.target.value })} /></div>
                  </div>
                )}
              </section>

              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#F5F0E8', color: '#1A1A18' }}>
                <span className="text-xs" style={{ color: '#8B7355' }}>Danışman: </span>{form.danisman || danismanAdi}
              </div>
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

      {/* Detail Modal */}
      {selectedMusteri && (() => {
        const days = daysSince(selectedMusteri.created_at);
        const showWarning = days !== null && days > 3;
        const score = calcPurchaseScore(selectedMusteri);
        const budgetDisplay = selectedMusteri.butce_min && selectedMusteri.butce_max
          ? `${displayPrice(selectedMusteri.butce_min, (selectedMusteri.para_birimi as Currency) || 'TL')} – ${displayPrice(selectedMusteri.butce_max, (selectedMusteri.para_birimi as Currency) || 'TL')}`
          : selectedMusteri.butce || null;

        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedMusteri(null)}>
            <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{selectedMusteri.ad} {selectedMusteri.soyad}</h2>
                    <ScoreBadge score={score} />
                  </div>
                  <MusteriStatusBadge durum={selectedMusteri.durum} />
                </div>
                <button onClick={() => setSelectedMusteri(null)} style={{ color: '#8B7355' }}><X size={20} /></button>
              </div>

              {/* "X gündür görüşülmedi" warning */}
              {showWarning && (
                <div className="mx-5 mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  {days} gündür görüşülmedi
                </div>
              )}

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ['Telefon', maskPhone(selectedMusteri.telefon, selectedMusteri)],
                    ['E-posta', maskEmail(selectedMusteri.email, selectedMusteri)],
                    ['Muhit', selectedMusteri.muhit],
                    ['Danışman', selectedMusteri.danisman],
                    ['Kaynak', selectedMusteri.kaynak],
                    ['Bölge Esnek', selectedMusteri.bolge_esnek ? 'Evet' : 'Hayır'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                      <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>{label}</p>
                      <p style={{ color: '#1A1A18' }}>{value || '-'}</p>
                    </div>
                  ))}
                </div>

                {budgetDisplay && (
                  <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                    <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Bütçe</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#C0392B' }}>{budgetDisplay}</p>
                  </div>
                )}

                {(selectedMusteri.denize_yakin || selectedMusteri.deniz_manzarasi) && (
                  <div className="flex gap-2">
                    {selectedMusteri.denize_yakin && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                        Denize Yakın
                      </span>
                    )}
                    {selectedMusteri.deniz_manzarasi && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}>
                        Deniz Manzaralı
                      </span>
                    )}
                  </div>
                )}

                {selectedMusteri.olmaz_olmaz && (
                  <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                    <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Olmazsa Olmaz İstekler</p>
                    <p className="text-sm" style={{ color: '#1A1A18' }}>{selectedMusteri.olmaz_olmaz}</p>
                  </div>
                )}

                {selectedMusteri.kesin_istekler && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-amber-400 text-xs mb-1 font-medium">Kesin İstekler (AI için)</p>
                    <p className="text-sm" style={{ color: '#1A1A18' }}>{selectedMusteri.kesin_istekler}</p>
                  </div>
                )}

                {selectedMusteri.aciklama && (
                  <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                    <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Açıklama</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A18' }}>{selectedMusteri.aciklama}</p>
                  </div>
                )}

                {selectedMusteri.notlar && (
                  <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                    <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Notlar</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1A18' }}>{selectedMusteri.notlar}</p>
                  </div>
                )}

                {/* Tier + Segment tags */}
                {(() => {
                  const tier = calcTier(selectedMusteri);
                  const tags = calcTags(selectedMusteri);
                  if (tier.label === 'Normal' && tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {tier.label !== 'Normal' && (
                        <span className="flex items-center gap-1" style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}44`, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                          <Tag size={10} />
                          {tier.label}
                        </span>
                      )}
                      {tags.map(tag => (
                        <span key={tag.key} className="flex items-center gap-1" style={{ background: tag.bg, color: tag.color, border: `1px solid ${tag.color}33`, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                          <Tag size={10} />
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  );
                })()}

                {/* YZ Summary */}
                <CustomerSummaryCard customer={selectedMusteri} />

                {/* YZ Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShowCallCoaching(true)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(212,175,55,0.08)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' }}
                  >
                    <Target size={16} />
                    Görüşme Koçu
                  </button>
                  <button
                    onClick={() => setShowMessageWriter(true)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(34,160,90,0.08)', color: '#22A05A', border: '1px solid rgba(34,160,90,0.25)' }}
                  >
                    <MessageSquare size={16} />
                    Mesaj Yaz
                  </button>
                  <button
                    onClick={() => {
                      if (detailPortfoyler.length > 0) {
                        setNegotiationPortfolio(detailPortfoyler[0]);
                        setShowNegotiationModal(true);
                      }
                    }}
                    disabled={detailPortfoyler.length === 0}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#FF3B2F', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    <TrendingUp size={16} />
                    Pazarlık
                  </button>
                </div>

                {/* Call Timing */}
                <CallTimingCard customer={selectedMusteri} />

                {/* WhatsApp */}
                <div className="flex gap-2">
                  <MusteriWhatsApp musteri={selectedMusteri} />
                </div>

                {/* Documents */}
                <div className="rounded-xl p-4" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <BelgelerPage musteriId={selectedMusteri.id} compact />
                </div>

                {/* Matching history */}
                <div className="rounded-xl p-4" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <EslestirmePanel musteriId={selectedMusteri.id} />
                </div>

                <div>
                  <label className="label mb-2">Durum Güncelle</label>
                  <div className="flex flex-wrap gap-2">
                    {DURUM_OPTIONS.map(o => {
                      const c = musteriConfig[o.value];
                      return (
                        <button
                          key={o.value}
                          onClick={() => updateDurum(selectedMusteri.id, o.value)}
                          className={`status-badge cursor-pointer transition-all border ${selectedMusteri.durum === o.value ? `${c.bg} ${c.text} border-current scale-105` : 'border-stone-300 hover:border-stone-400'}`}
                          style={selectedMusteri.durum !== o.value ? { background: '#F5F0E8', color: '#8B7355', padding: '6px 12px' } : { padding: '6px 12px' }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Foreign customer badge */}
                {selectedMusteri.yabanci_musteri && (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.2)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Globe size={14} style={{ color: '#d4a843' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#d4a843' }}>Yabancı Müşteri</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedMusteri.uyruk && <div><span style={{ color: '#8B7355' }}>Uyruk:</span> <span style={{ color: '#1A1A18' }}>{selectedMusteri.uyruk}</span></div>}
                      {selectedMusteri.dil_tercihi && <div><span style={{ color: '#8B7355' }}>Dil:</span> <span style={{ color: '#1A1A18' }}>{selectedMusteri.dil_tercihi}</span></div>}
                      {selectedMusteri.pasaport_no && <div><span style={{ color: '#8B7355' }}>Pasaport:</span> <span style={{ color: '#1A1A18' }}>{selectedMusteri.pasaport_no}</span></div>}
                      {selectedMusteri.turkiye_kalis_suresi && <div><span style={{ color: '#8B7355' }}>Kalış:</span> <span style={{ color: '#1A1A18' }}>{selectedMusteri.turkiye_kalis_suresi}</span></div>}
                      {selectedMusteri.vatandaslik_durumu && <div className="col-span-2"><span style={{ color: '#8B7355' }}>Vatandaşlık:</span> <span style={{ color: '#1A1A18' }}>{selectedMusteri.vatandaslik_durumu}</span></div>}
                    </div>
                  </div>
                )}

                <div>
                  <button
                    onClick={() => runAI(selectedMusteri)}
                    disabled={aiLoading}
                    className="btn-gold w-full justify-center"
                  >
                    {aiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    {aiLoading ? 'Analiz yapılıyor...' : 'AI Analizi Yap'}
                  </button>
                  {aiResult && (
                    <div className="mt-3 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}>
                      {aiResult}
                    </div>
                  )}
                </div>

                {/* Personality Analysis */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain size={15} style={{ color: '#534AB7' }} />
                      <span className="text-sm font-semibold" style={{ color: '#534AB7' }}>Kişilik Analizi</span>
                    </div>
                    <button
                      onClick={() => runPersonalityAnalysis(selectedMusteri)}
                      disabled={personalityLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(83,74,183,0.1)', color: '#534AB7', border: '1px solid rgba(83,74,183,0.3)' }}
                    >
                      {personalityLoading ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                      {personalityLoading ? 'Analiz...' : 'Analiz Et'}
                    </button>
                  </div>
                  {personalityResult && (
                    <div className="space-y-2">
                      {Object.entries(personalityResult).map(([key, val]) => {
                        const labels: Record<string, string> = { iletisim_stili: 'İletişim Stili', karar_hizi: 'Karar Hızı', risk_toleransi: 'Risk Toleransı', motivasyon: 'Motivasyon', satis_stratejisi: 'Satış Stratejisi', genel: 'Genel' };
                        return (
                          <div key={key} className="rounded-lg p-2.5" style={{ background: 'rgba(83,74,183,0.06)', border: '1px solid rgba(83,74,183,0.15)' }}>
                            <p className="text-xs font-semibold mb-0.5" style={{ color: '#534AB7' }}>{labels[key] || key}</p>
                            <p className="text-xs" style={{ color: '#1A1A18' }}>{String(val)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Call Records */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone size={15} style={{ color: '#64B5F6' }} />
                      <span className="text-sm font-semibold" style={{ color: '#64B5F6' }}>Görüşme Kayıtları</span>
                    </div>
                    <button
                      onClick={() => setShowCallForm(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(100,181,246,0.1)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.3)' }}
                    >
                      <Plus size={12} />
                      Kayıt Ekle
                    </button>
                  </div>
                  {showCallForm && (
                    <div className="space-y-2">
                      <div className="relative">
                        <textarea
                          className="input h-24 resize-none text-xs"
                          placeholder="Görüşme transkriptini buraya yazın veya mikrofonla kaydedin..."
                          value={callTranscript}
                          onChange={e => setCallTranscript(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={startVoiceTranscript}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={isListening
                            ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                            : { background: 'rgba(100,181,246,0.1)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.3)' }
                          }
                        >
                          {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                          {isListening ? 'Duraksatılıyor...' : 'Ses Kaydet'}
                        </button>
                        <button
                          onClick={() => saveCallSummary(selectedMusteri)}
                          disabled={callSaving || !callTranscript.trim()}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={{ background: 'rgba(100,181,246,0.12)', color: '#64B5F6', border: '1px solid rgba(100,181,246,0.3)' }}
                        >
                          {callSaving ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                          AI ile Özetle & Kaydet
                        </button>
                      </div>
                    </div>
                  )}
                  {callRecords.length > 0 && (
                    <div className="space-y-2">
                      {callRecords.map(rec => (
                        <div key={rec.id} className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(100,181,246,0.05)', border: '1px solid rgba(100,181,246,0.12)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: '#64B5F6' }}>{rec.danisman || 'Danışman'}</span>
                            <span className="text-xs" style={{ color: '#8B7355' }}>{new Date(rec.created_at).toLocaleDateString('tr-TR')}</span>
                          </div>
                          {rec.ozet && <p className="text-xs" style={{ color: '#1A1A18' }}>{rec.ozet}</p>}
                          {rec.analiz && typeof rec.analiz === 'object' && (rec.analiz as Record<string, string>).sonuc && (
                            <p className="text-xs" style={{ color: '#a7c4e8' }}>Sonuç: {(rec.analiz as Record<string, string>).sonuc}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Müşteri Sayfası */}
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe size={15} style={{ color: '#22c55e' }} />
                      <span className="text-sm font-semibold" style={{ color: '#22c55e' }}>Müşteri Sayfası</span>
                    </div>
                    <button
                      onClick={() => openPortfoySecim(selectedMusteri)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                    >
                      <Share2 size={12} />
                      Portföy Seç & Paylaş
                    </button>
                  </div>

                  {activeLink && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <span className="flex-1 text-xs truncate" style={{ color: '#4ade80' }}>{activeLink.url}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(activeLink.url); toast('Bağlantı kopyalandı!', 'success'); }}
                          className="shrink-0 p-1.5 rounded-lg"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                          title="Kopyala"
                        >
                          <Clipboard size={13} />
                        </button>
                        <button
                          onClick={() => shareWhatsApp(activeLink.url, selectedMusteri)}
                          className="shrink-0 p-1.5 rounded-lg"
                          style={{ background: 'rgba(37,211,102,0.1)', color: '#25d366' }}
                          title="WhatsApp'ta Paylaş"
                        >
                          <Share2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reactions summary */}
                  {reaksiyonlarLoading ? (
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#8B7355' }}>
                      <Loader2 size={12} className="animate-spin" />Tepkiler yükleniyor...
                    </div>
                  ) : reaksiyonlar.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
                          <ThumbsUp size={12} />
                          {reaksiyonlar.filter(r => r.reaksiyon === 'begendim').length} beğendi
                        </span>
                        <span className="flex items-center gap-1" style={{ color: '#f87171' }}>
                          <ThumbsDown size={12} />
                          {reaksiyonlar.filter(r => r.reaksiyon === 'ilgilenmiyorum').length} reddetti
                        </span>
                        <span className="flex items-center gap-1" style={{ color: '#64B5F6' }}>
                          <MessageCircle size={12} />
                          {reaksiyonlar.filter(r => r.yorum).length} yorum
                        </span>
                      </div>
                      {reaksiyonlar.filter(r => r.yorum).map((r, i) => (
                        <div key={i} className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(100,181,246,0.06)', border: '1px solid rgba(100,181,246,0.15)', color: '#a7c4e8' }}>
                          {r.yorum}
                        </div>
                      ))}
                    </div>
                  ) : activeLink ? (
                    <p className="text-xs" style={{ color: '#8B7355' }}>Henüz tepki gelmedi.</p>
                  ) : (
                    <p className="text-xs" style={{ color: '#8B7355' }}>Portföy seçip paylaşın, müşteri tepkilerini buradan takip edin.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { openEdit(selectedMusteri); setSelectedMusteri(null); }} className="btn-ghost flex-1 justify-center">Düzenle</button>
                  <button onClick={() => remove(selectedMusteri.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-medium px-4 py-2 rounded-lg transition-all text-sm flex items-center justify-center gap-2">Sil</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Portfolio Selection Modal */}
      {/* Follow-up reminders banner */}
      {followUpReminders.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50 space-y-2 max-w-sm">
          {followUpReminders.map(({ customer, message }) => (
            <div key={customer.id} className="rounded-xl p-3 shadow-xl flex items-start gap-2" style={{ background: '#1A1A18', border: '1px solid rgba(212,175,55,0.3)' }}>
              <span style={{ fontSize: 16 }}>⏰</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{ color: '#F5F0E8' }}>{message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast button */}
      <button
        onClick={() => setShowBroadcast(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-xl transition-all hover:scale-105"
        style={{ background: '#1A1A18', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
      >
        <Zap size={15} /> Toplu Mesaj
      </button>

      {/* AI modals */}
      {showCallCoaching && selectedMusteri && (
        <CallCoachingModal customer={selectedMusteri} onClose={() => setShowCallCoaching(false)} />
      )}
      {showMessageWriter && selectedMusteri && (
        <MessageWriterModal customer={selectedMusteri} portfolios={detailPortfoyler} onClose={() => setShowMessageWriter(false)} />
      )}
      {showNegotiationModal && selectedMusteri && negotiationPortfolio && (
        <NegotiationModal customer={selectedMusteri} portfolio={negotiationPortfolio} onClose={() => setShowNegotiationModal(false)} />
      )}
      {showBroadcast && (
        <BroadcastModal customers={musteriler} onClose={() => setShowBroadcast(false)} />
      )}

      {showPortfoySecim && selectedMusteri && (
        <div className="modal-overlay" style={{ zIndex: 60 }} onClick={e => e.target === e.currentTarget && setShowPortfoySecim(false)}>
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <div>
                <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Müşteri Sayfası Oluştur</h2>
                <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>{selectedMusteri.ad} {selectedMusteri.soyad} için portföy seçin</p>
              </div>
              <button onClick={() => setShowPortfoySecim(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>

            <div className="modal-body p-4">
              {/* Active link display */}
              {activeLink && (
                <div className="mb-4 rounded-xl p-3 space-y-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>Aktif bağlantı</p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs truncate" style={{ color: '#4ade80' }}>{activeLink.url}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(activeLink.url); toast('Kopyalandı!', 'success'); }}
                      className="shrink-0 p-1.5 rounded-lg"
                      style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                    >
                      <Clipboard size={13} />
                    </button>
                    <button
                      onClick={() => shareWhatsApp(activeLink.url, selectedMusteri)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(37,211,102,0.1)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}
                    >
                      <Share2 size={12} />
                      WhatsApp
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs mb-3" style={{ color: '#8B7355' }}>Yeni bir seçim yapıp tekrar oluşturabilirsiniz ({selectedPortfoyIds.length} seçili):</p>

              {allPortfoyler.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#8B7355' }}>
                  <Building2 size={28} className="mx-auto mb-2" />
                  <p className="text-sm">Portföy bulunamadı.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allPortfoyler.map(p => {
                    const isSelected = selectedPortfoyIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPortfoyIds(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                        style={isSelected
                          ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }
                          : { background: '#F5F0E8', border: '0.5px solid #F6D9A8' }
                        }
                      >
                        {p.kapak_foto
                          ? <img src={p.kapak_foto} alt={p.isim} className="w-12 h-10 object-cover rounded-lg shrink-0" />
                          : <div className="w-12 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.1)' }}><Building2 size={16} style={{ color: '#D4AF37' }} /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1A1A18' }}>{p.isim}</p>
                          <p className="text-xs truncate" style={{ color: '#8B7355' }}>{[p.mahalle, p.ilce].filter(Boolean).join(', ') || p.bolge || ''}</p>
                        </div>
                        <div className="shrink-0">
                          {isSelected
                            ? <CheckSquare size={18} style={{ color: '#22c55e' }} />
                            : <Square size={18} style={{ color: 'rgba(26,26,24,0.25)' }} />
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowPortfoySecim(false)} className="btn-ghost flex-1 justify-center">İptal</button>
              <button
                onClick={() => generateMicrosite(selectedMusteri).then(() => setShowPortfoySecim(false))}
                disabled={micrositeLoading || selectedPortfoyIds.length === 0}
                className="btn-gold flex-1 justify-center"
              >
                {micrositeLoading ? <Loader2 className="animate-spin" size={16} /> : <Link size={16} />}
                {activeLink ? 'Yeni Bağlantı Oluştur' : 'Bağlantı Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
