import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, Building2, Users, Play, Pause, Mic, MapPin, Tag, Sparkles, Loader2, ChevronRight, Flame, Sun, Cloud, Snowflake, Instagram as InstagramIcon, Trash2 } from 'lucide-react';
import { WhatsAppReplySuggestions } from '../components/AIFeatures';
import { logAction } from '../lib/security';
import { supabase } from '../lib/supabase';
import { Mesaj, MentionItem, Musteri, Portfoy, InstagramIlan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { callClaude } from '../lib/claude';
import VoiceInput from '../components/VoiceInput';
import UserAvatar from '../components/UserAvatar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return (
    d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  );
}

function formatDur(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Formats ada/parsel: "4234" + "5" → "4234/5"
function adaParselLabel(ada: string, parsel: string): string {
  return ada && parsel ? `${ada}/${parsel}` : ada || parsel || '—';
}

// ---------------------------------------------------------------------------
// Mention inline card (inside message text)
// ---------------------------------------------------------------------------
function MentionCard({ item, onClick }: { item: MentionItem; onClick?: () => void }) {
  if (item.type === 'portfoy') {
    return (
      <span
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold mx-0.5 cursor-pointer transition-all hover:opacity-80 bg-gold-400/15 text-gold-300 border border-gold-400/25"
      >
        <Building2 size={10} />
        @{item.adaParsel || item.label}
      </span>
    );
  }
  if (item.type === 'instagram') {
    return (
      <span
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold mx-0.5 cursor-pointer transition-all hover:opacity-80"
        style={{ background: 'rgba(240,148,51,0.15)', color: '#f09433', border: '1px solid rgba(240,148,51,0.3)' }}
      >
        <InstagramIcon size={10} />
        @{item.adaParsel || item.label}
      </span>
    );
  }
  return (
    <span
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold mx-0.5 cursor-pointer transition-all hover:opacity-80 bg-blue-500/15 text-blue-300 border border-blue-500/20"
    >
      <Users size={10} />
      #{item.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Render message — handles @ada/parsel and #musteri tags
// ---------------------------------------------------------------------------
function renderMessage(
  text: string,
  mentions: MentionItem[] | null,
  onMentionClick: (m: MentionItem) => void,
) {
  if (!mentions || mentions.length === 0) return <span>{text}</span>;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  for (const mention of mentions) {
    const tag = mention.type === 'musteri'
      ? `#${mention.label}`
      : `@${mention.adaParsel || mention.label}`;
    const idx = remaining.indexOf(tag);
    if (idx === -1) continue;
    parts.push(<span key={`t${idx}`}>{remaining.slice(0, idx)}</span>);
    parts.push(
      <MentionCard key={`m${mention.id}`} item={mention} onClick={() => onMentionClick(mention)} />,
    );
    remaining = remaining.slice(idx + tag.length);
  }
  parts.push(<span key="tail">{remaining}</span>);
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Voice note bubble
// ---------------------------------------------------------------------------
function VoiceNoteBubble({ m, isOwn }: { m: Mesaj; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(m.ses_url!);
    audioRef.current = audio;
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => { setPlaying(false); setProgress(0); setCurrentSec(0); };
    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentSec(Math.floor(audio.currentTime));
      }
    };
    return () => { audio.pause(); audio.src = ''; };
  }, [m.ses_url]);

  const toggle = () => {
    if (!audioRef.current) return;
    playing ? audioRef.current.pause() : audioRef.current.play();
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl min-w-[180px] max-w-[260px] ${isOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
      style={isOwn
        ? { background: '#1A1A18', border: '1px solid rgba(212,175,55,0.3)' }
        : { background: 'white', border: '1px solid #F6D9A8' }
      }
    >
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
        style={isOwn
          ? { background: 'rgba(212,175,55,0.3)', color: '#F5F0E8' }
          : { background: '#F5F0E8', color: '#1A1A18' }
        }
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="relative h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: isOwn ? 'rgba(212,175,55,0.2)' : '#F5F0E8' }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: isOwn ? '#D4AF37' : '#534AB7' }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Mic size={9} style={{ color: isOwn ? 'rgba(212,175,55,0.5)' : '#8B7355' }} />
          <span className="text-xs tabular-nums" style={{ color: isOwn ? 'rgba(212,175,55,0.7)' : '#8B7355' }}>
            {formatDur(playing ? currentSec : (m.sure ?? 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Matching
// ---------------------------------------------------------------------------
const AI_KEYWORDS = [
  'müşterim var', 'arıyor', 'istiyor', 'bütçesi', 'milyon', 'denize yakın',
  'villa arıyor', 'daire arıyor', 'arsa arıyor', 'taş ev', 'deniz manzaralı',
  'bahçeli', 'havuzlu', 'alaçatı', 'ilıca', 'çeşme', 'butce', 'budget',
];

function detectAIKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some(kw => lower.includes(kw));
}

type MatchScore = 'sicak' | 'ilik' | 'orta' | 'soguk';

interface AIMatch {
  portfoyId: string;
  adaParsel: string;
  isim: string;
  fiyat: string;
  bolge: string;
  tip: string;
  kapakFoto: string;
  skor: number;
  kategori: MatchScore;
  neden: string;
}

function matchKategori(skor: number): MatchScore {
  if (skor >= 80) return 'sicak';
  if (skor >= 60) return 'ilik';
  if (skor >= 40) return 'orta';
  return 'soguk';
}

const KATEGORI_CONFIG: Record<MatchScore, { label: string; color: string; border: string; bg: string; icon: React.ElementType; glow: string; borderLeftColor: string }> = {
  sicak: { label: 'SICAK', color: 'text-red-500', border: 'border-red-500/40', bg: 'bg-red-500/10', icon: Flame, glow: '', borderLeftColor: '#ef4444' },
  ilik: { label: 'ILIK', color: 'text-amber-500', border: 'border-amber-500/40', bg: 'bg-amber-500/10', icon: Sun, glow: '', borderLeftColor: '#f59e0b' },
  orta: { label: 'ORTA', color: 'text-amber-600', border: 'border-amber-600/35', bg: 'bg-amber-600/8', icon: Cloud, glow: '', borderLeftColor: '#d97706' },
  soguk: { label: 'SOGUK', color: 'text-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/8', icon: Snowflake, glow: '', borderLeftColor: '#3b82f6' },
};

// ---------------------------------------------------------------------------
// Dropdown suggestion types
// ---------------------------------------------------------------------------
interface PortfoySuggestion {
  trigger: '@';
  source: 'portfoy';
  id: string;
  adaParsel: string;
  isim: string;
  fiyat: string;
  bolge: string;
  tip: string;
}
interface InstagramSuggestion {
  trigger: '@';
  source: 'instagram';
  id: string;
  adaParsel: string;
  baslik: string;
  fiyat: string;
  bolge: string;
  foto_url: string;
  url: string;
}
interface MusteriSuggestion {
  trigger: '#';
  id: string;
  label: string;
  muhit: string;
}
type Suggestion = PortfoySuggestion | InstagramSuggestion | MusteriSuggestion;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Mesajlasma() {
  const { effectiveUser } = useAuth();
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingMentions, setPendingMentions] = useState<MentionItem[]>([]);
  const [userPhotoMap, setUserPhotoMap] = useState<Record<string, { name: string; fotoUrl: string | null }>>({});

  // Dropdown state — tracks which trigger character and the query
  const [dropdownTrigger, setDropdownTrigger] = useState<'@' | '#' | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [allPortfoyler, setAllPortfoyler] = useState<Portfoy[]>([]);
  const [allMusteriler, setAllMusteriler] = useState<Musteri[]>([]);
  const [allInstagram, setAllInstagram] = useState<InstagramIlan[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEslestirBtn, setShowEslestirBtn] = useState(false);

  // AI matching
  const [aiMatches, setAiMatches] = useState<AIMatch[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiStrip, setShowAiStrip] = useState(false);

  // Mention detail modal
  const [selectedMention, setSelectedMention] = useState<MentionItem | null>(null);
  const [detailPortfoy, setDetailPortfoy] = useState<Portfoy | null>(null);
  const [detailMusteri, setDetailMusteri] = useState<Musteri | null>(null);

  // Clear messages
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingMessages, setClearingMessages] = useState(false);
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici' || effectiveUser?.username === 'superadmin';

  // Walkie-talkie
  const [transmitting, setTransmitting] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const danismanAdi = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('mesajlar')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);
    setMesajlar((data || []) as Mesaj[]);
  }, []);

  useEffect(() => {
    loadHistory();
    supabase
      .from('portfoyler')
      .select('id, isim, ada, parsel, fiyat, bolge, tip')
      .then(r => setAllPortfoyler((r.data || []) as Portfoy[]));
    supabase
      .from('musteriler')
      .select('id, ad, soyad, muhit')
      .then(r => setAllMusteriler((r.data || []) as Musteri[]));
    supabase
      .from('instagram_ilanlar')
      .select('id, baslik, ada, parsel, fiyat, bolge, foto_url, url')
      .then(r => setAllInstagram((r.data || []) as InstagramIlan[]));
    supabase
      .from('kullanicilar')
      .select('id, ad, soyad, foto_url')
      .neq('username', 'superadmin')
      .then(r => {
        const map: Record<string, { name: string; fotoUrl: string | null }> = {};
        for (const u of (r.data || []) as { id: string; ad: string; soyad: string; foto_url: string | null }[]) {
          map[u.id] = { name: `${u.ad} ${u.soyad}`.trim(), fotoUrl: u.foto_url };
        }
        setUserPhotoMap(map);
      });
  }, [loadHistory]);

  useEffect(() => {
    const channel = supabase
      .channel('mesajlar-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mesajlar' },
        payload => setMesajlar(prev => [...prev, payload.new as Mesaj]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Walkie-talkie receive channel
  useEffect(() => {
    const ch = supabase.channel('walkie-talkie');
    wtChannelRef.current = ch;
    ch
      .on('broadcast', { event: 'audio_chunk' }, ({ payload }) => {
        if (payload.sender === effectiveUser?.username) return;
        setActiveSpeaker(payload.senderAd || payload.sender);
        try {
          const audio = new Audio(payload.data as string);
          audio.play().catch(() => {});
        } catch { /* ignore */ }
      })
      .on('broadcast', { event: 'audio_end' }, () => {
        setActiveSpeaker(null);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [effectiveUser?.username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mesajlar]);

  // ---------------------------------------------------------------------------
  // Mention dropdown logic
  // ---------------------------------------------------------------------------
  const handleTextChange = (val: string) => {
    setText(val);
    setShowEslestirBtn(detectAIKeywords(val) && val.length > 10);

    // Find the last unmatched @ or # in the text
    let lastAt = -1, lastHash = -1;
    for (let i = val.length - 1; i >= 0; i--) {
      if (val[i] === '@' && lastAt === -1) lastAt = i;
      if (val[i] === '#' && lastHash === -1) lastHash = i;
    }

    // Use whichever trigger is closest to the cursor (later in text)
    const atPos = lastAt;
    const hashPos = lastHash;

    const tryTrigger = (triggerChar: '@' | '#', triggerPos: number) => {
      if (triggerPos === -1) return false;
      const query = val.slice(triggerPos + 1);
      // Stop if query contains a space longer than needed (mention closed by space after selection)
      if (query.length > 20) return false;
      return { triggerChar, query };
    };

    // Prefer the one that is later (closer to cursor) with no space after trigger
    const atResult = atPos !== -1 ? tryTrigger('@', atPos) : null;
    const hashResult = hashPos !== -1 ? tryTrigger('#', hashPos) : null;

    // Pick the one closer to end; ignore if a space was already typed after it
    const active = (() => {
      // After a mention is inserted we add a space — once we see a space after the trigger, close dropdown
      if (atResult && !atResult.query.includes(' ')) return atResult;
      if (hashResult && !hashResult.query.includes(' ')) return hashResult;
      return null;
    })();

    if (!active) {
      setDropdownTrigger(null);
      setSuggestions([]);
      return;
    }

    const q = active.query;
    if (active.triggerChar === '@') {
      setDropdownTrigger('@');
      setSuggestions([]);

      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(async () => {
        const cleanQ = q.trim();
        console.log('[@ mention] searching:', JSON.stringify(cleanQ));

        const isNumeric = /^\d+$/.test(cleanQ);

        const buildPortfoyQuery = () => {
          const base = supabase.from('portfoyler').select('id, isim, ada, parsel, fiyat, bolge, tip');
          if (!cleanQ) return base.limit(5);
          if (isNumeric) return base.or(`ada.eq.${cleanQ},parsel.eq.${cleanQ}`).limit(5);
          return base.or(`ada.ilike.%${cleanQ}%,parsel.ilike.%${cleanQ}%,isim.ilike.%${cleanQ}%`).limit(5);
        };

        const buildIgQuery = () => {
          const base = supabase.from('instagram_ilanlar').select('id, baslik, ada, parsel, fiyat, bolge, foto_url, url');
          if (!cleanQ) return base.limit(5);
          if (isNumeric) return base.or(`ada.eq.${cleanQ},parsel.eq.${cleanQ}`).limit(5);
          return base.or(`ada.ilike.%${cleanQ}%,parsel.ilike.%${cleanQ}%,baslik.ilike.%${cleanQ}%`).limit(5);
        };

        const [portRes, igRes] = await Promise.all([buildPortfoyQuery(), buildIgQuery()]);

        console.log('[@ mention] portfoy results:', portRes.data?.length, portRes.data);
        console.log('[@ mention] instagram results:', igRes.data?.length, igRes.data);

        const portfoyResults: PortfoySuggestion[] = (portRes.data || []).map(p => ({
          trigger: '@' as const,
          source: 'portfoy' as const,
          id: p.id,
          adaParsel: adaParselLabel(p.ada, p.parsel),
          isim: p.isim,
          fiyat: p.fiyat,
          bolge: p.bolge,
          tip: p.tip,
        }));

        const igResults: InstagramSuggestion[] = (igRes.data || []).map(i => {
          const ap = i.ada && i.parsel ? `${i.ada}/${i.parsel}` : i.ada || i.parsel || '';
          return {
            trigger: '@' as const,
            source: 'instagram' as const,
            id: i.id,
            adaParsel: ap || i.baslik || i.id.slice(0, 8),
            baslik: i.baslik || '',
            fiyat: i.fiyat || '',
            bolge: i.bolge || '',
            foto_url: i.foto_url || '',
            url: i.url || '',
          };
        });

        setSuggestions([...portfoyResults, ...igResults]);
      }, 150);
    } else {
      const results: MusteriSuggestion[] = allMusteriler
        .filter(m => `${m.ad} ${m.soyad}`.toLowerCase().includes(q))
        .slice(0, 8)
        .map(m => ({
          trigger: '#',
          id: m.id,
          label: `${m.ad} ${m.soyad}`.trim(),
          muhit: m.muhit || '',
        }));
      setSuggestions(results);
      setDropdownTrigger('#');
    }
  };

  const selectSuggestion = (s: Suggestion) => {
    if (s.trigger === '@') {
      const triggerPos = text.lastIndexOf('@');
      if ((s as PortfoySuggestion | InstagramSuggestion).source === 'instagram') {
        const ig = s as InstagramSuggestion;
        const newText = text.slice(0, triggerPos) + `@${ig.adaParsel} `;
        setText(newText);
        const mention: MentionItem = {
          type: 'instagram',
          id: ig.id,
          label: ig.adaParsel,
          adaParsel: ig.adaParsel,
          portfoyIsim: ig.baslik,
          portfoyFiyat: ig.fiyat,
          portfoyBolge: ig.bolge,
          instagramUrl: ig.url,
          instagramFoto: ig.foto_url,
        };
        setPendingMentions(prev => prev.find(m => m.id === ig.id) ? prev : [...prev, mention]);
      } else {
      const ps = s as PortfoySuggestion;
      const newText = text.slice(0, triggerPos) + `@${ps.adaParsel} `;
      setText(newText);
      const mention: MentionItem = {
        type: 'portfoy',
        id: ps.id,
        label: ps.adaParsel,
        adaParsel: ps.adaParsel,
        portfoyIsim: ps.isim,
        portfoyFiyat: ps.fiyat,
        portfoyBolge: ps.bolge,
      };
      setPendingMentions(prev => prev.find(m => m.id === ps.id) ? prev : [...prev, mention]);
      }
    } else {
      const ms = s as MusteriSuggestion;
      const triggerPos = text.lastIndexOf('#');
      const newText = text.slice(0, triggerPos) + `#${ms.label} `;
      setText(newText);
      const mention: MentionItem = { type: 'musteri', id: ms.id, label: ms.label };
      setPendingMentions(prev => prev.find(m => m.id === ms.id) ? prev : [...prev, mention]);
    }
    setDropdownTrigger(null);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // AI Matching
  // ---------------------------------------------------------------------------
  const runAIMatch = useCallback(async (query: string) => {
    if (!query.trim() || allPortfoyler.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setShowAiStrip(true);
    setAiMatches([]);

    const portfoyList = allPortfoyler.slice(0, 40).map(p => ({
      id: p.id,
      ada: p.ada,
      parsel: p.parsel,
      isim: p.isim,
      fiyat: p.fiyat,
      bolge: p.bolge,
      tip: p.tip,
      oda: p.oda,
      metrekare: p.metrekare,
      aciklama: p.aciklama,
    }));

    const prompt = `Sen bir emlak AI asistanısın. Müşteri isteği ile portföy listesini eşleştir.

MÜŞTERİ İSTEĞİ:
"${query}"

PORTFÖY LİSTESİ (JSON):
${JSON.stringify(portfoyList, null, 2)}

GÖREV: Her portföy için 0-100 arası bir uyum skoru ver ve kısa bir neden yaz.
Sadece JSON döndür, başka bir şey yazma. Format:
[
  {
    "portfoyId": "...",
    "skor": 85,
    "neden": "Bütçeye uygun, istenen bölgede, villa tipi"
  },
  ...
]

Sadece skor 30 ve üzerinde olanları döndür. En fazla 8 sonuç. Skor yüksekten düşüğe sırala.`;

    try {
      const raw = await callClaude(prompt, 1200);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI yanıtı ayrıştırılamadı');
      const parsed: { portfoyId: string; skor: number; neden: string }[] = JSON.parse(jsonMatch[0]);

      const matches: AIMatch[] = parsed
        .map(item => {
          const p = allPortfoyler.find(p => p.id === item.portfoyId);
          if (!p) return null;
          const kat = matchKategori(item.skor);
          return {
            portfoyId: p.id,
            adaParsel: adaParselLabel(p.ada, p.parsel),
            isim: p.isim,
            fiyat: p.fiyat,
            bolge: p.bolge,
            tip: p.tip,
            kapakFoto: p.kapak_foto || '',
            skor: item.skor,
            kategori: kat,
            neden: item.neden,
          } as AIMatch;
        })
        .filter((m): m is AIMatch => m !== null);

      setAiMatches(matches);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI eşleştirme başarısız');
    } finally {
      setAiLoading(false);
    }
  }, [allPortfoyler]);

  const insertPortfoyMention = (m: AIMatch) => {
    const tag = `@${m.adaParsel} `;
    setText(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + tag);
    const mention: MentionItem = {
      type: 'portfoy',
      id: m.portfoyId,
      label: m.adaParsel,
      adaParsel: m.adaParsel,
      portfoyIsim: m.isim,
      portfoyFiyat: m.fiyat,
      portfoyBolge: m.bolge,
    };
    setPendingMentions(prev => prev.find(pm => pm.id === m.portfoyId) ? prev : [...prev, mention]);
    inputRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // Send text
  // ---------------------------------------------------------------------------
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await supabase.from('mesajlar').insert({
      kullanici_id: effectiveUser?.id || '',
      kullanici_adi: danismanAdi,
      mesaj: text.trim(),
      mentionler: pendingMentions.length > 0 ? pendingMentions : null,
      tip: 'text',
    });
    setText('');
    setPendingMentions([]);
    setSending(false);
  };

  const clearMessages = async () => {
    setClearingMessages(true);
    const count = mesajlar.length;
    const { error } = await supabase.from('mesajlar').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { setClearingMessages(false); return; }
    setMesajlar([]);
    setShowClearConfirm(false);
    setClearingMessages(false);
    await logAction(effectiveUser?.username ?? '', 'chat_history_cleared', { deleted_count: count });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((dropdownTrigger) && e.key === 'Escape') { setDropdownTrigger(null); setSuggestions([]); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ---------------------------------------------------------------------------
  // Walkie-talkie transmit
  // ---------------------------------------------------------------------------
  const startTransmit = async () => {
    if (transmitting) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const ch = wtChannelRef.current;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ch) {
          const reader = new FileReader();
          reader.onload = () => {
            ch.send({
              type: 'broadcast',
              event: 'audio_chunk',
              payload: {
                data: reader.result,
                sender: effectiveUser?.username || '',
                senderAd: `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim(),
              },
            });
          };
          reader.readAsDataURL(e.data);
        }
      };
      recorder.start(100);
      setTransmitting(true);
    } catch {
      alert('Mikrofon erişimi reddedildi.');
    }
  };

  const stopTransmit = () => {
    if (!transmitting || !recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    wtChannelRef.current?.send({
      type: 'broadcast',
      event: 'audio_end',
      payload: {},
    });
    setTransmitting(false);
  };

  // ---------------------------------------------------------------------------
  // Mention detail modal
  // ---------------------------------------------------------------------------
  const openMention = async (item: MentionItem) => {
    if (item.type === 'instagram') {
      if (item.instagramUrl) window.open(item.instagramUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedMention(item);
    if (item.type === 'portfoy') {
      const { data } = await supabase.from('portfoyler').select('*').eq('id', item.id).maybeSingle();
      setDetailPortfoy(data as Portfoy | null);
      setDetailMusteri(null);
    } else {
      const { data } = await supabase.from('musteriler').select('*').eq('id', item.id).maybeSingle();
      setDetailMusteri(data as Musteri | null);
      setDetailPortfoy(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Message grouping
  // ---------------------------------------------------------------------------
  const grouped: { date: string; messages: Mesaj[] }[] = [];
  for (const m of mesajlar) {
    const date = new Date(m.created_at).toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.messages.push(m);
    else grouped.push({ date, messages: [m] });
  }

  const showDropdown = dropdownTrigger !== null && suggestions.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="px-4 md:px-6 py-3 md:py-4 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}
      >
        <div>
          <h1 className="text-base md:text-lg font-semibold" style={{ color: '#1A1A18' }}>Ofis Mesajlaşma</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>
            @ portföy ada/parsel · # müşteri adı · sesli mesaj
          </p>
        </div>
        {isAdmin && mesajlar.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
            Temizle
          </button>
        )}
      </div>

      {/* AI Match Strip */}
      {showAiStrip && (
        <div
          className="shrink-0"
          style={{ borderBottom: '0.5px solid #F6D9A8', background: '#FEF9F0' }}
        >
          {/* Strip header */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-gold-400" />
              <span className="text-xs font-bold" style={{ color: '#1A1A18' }}>AI Portföy Eşleştirme</span>
              {aiLoading && <Loader2 size={12} className="animate-spin" style={{ color: '#8B7355' }} />}
              {!aiLoading && aiMatches.length > 0 && (
                <span className="text-xs" style={{ color: '#8B7355' }}>{aiMatches.length} sonuç</span>
              )}
            </div>
            <button
              onClick={() => { setShowAiStrip(false); setAiMatches([]); setAiError(null); }}
              className="transition-colors p-1" style={{ color: '#8B7355' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Loading state */}
          {aiLoading && (
            <div className="flex items-center gap-3 px-4 pb-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-44 h-24 rounded-xl animate-pulse shrink-0"
                  style={{ background: '#F6D9A8', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}

          {/* Error state */}
          {!aiLoading && aiError && (
            <div className="px-4 pb-3 text-xs text-red-400">{aiError}</div>
          )}

          {/* Match cards horizontal scroll */}
          {!aiLoading && aiMatches.length > 0 && (
            <div className="flex gap-3 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {aiMatches.map(m => {
                const cfg = KATEGORI_CONFIG[m.kategori];
                const Icon = cfg.icon;
                return (
                  <div
                    key={m.portfoyId}
                    className={`relative shrink-0 w-52 rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] cursor-pointer`}
                    style={{ background: '#FEF9F0', border: '0.5px solid #F6D9A8', borderLeft: `3px solid ${cfg.borderLeftColor}` }}
                  >
                    {/* Cover image / placeholder */}
                    <div className="h-20 relative overflow-hidden">
                      {m.kapakFoto ? (
                        <img
                          src={m.kapakFoto}
                          alt={m.isim}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: '#F5F0E8' }}>
                          <Building2 size={22} style={{ color: '#D4C9B8' }} />
                        </div>
                      )}
                      {/* Score badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: cfg.borderLeftColor }}>
                        <Icon size={10} />
                        {m.skor}%
                        <span className="text-[9px] font-semibold opacity-75">{cfg.label}</span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-2.5">
                      <p className="font-semibold text-xs truncate mb-0.5" style={{ color: '#1A1A18' }}>
                        {m.isim || m.adaParsel}
                      </p>
                      <div className="flex items-center gap-2 mb-1.5">
                        {m.fiyat && (
                          <span className="text-xs font-bold truncate" style={{ color: '#22A05A' }}>{m.fiyat}</span>
                        )}
                        {m.bolge && (
                          <span className="flex items-center gap-0.5 text-[10px]" style={{ color: '#8B7355' }}>
                            <MapPin size={8} />{m.bolge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] leading-snug line-clamp-2 mb-2" style={{ color: '#8B7355' }}>{m.neden}</p>

                      {/* Actions */}
                      <button
                        onClick={() => insertPortfoyMention(m)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all bg-gold-400/15 text-gold-300 border border-gold-400/25 hover:bg-gold-400/25"
                      >
                        <ChevronRight size={10} />
                        Müşteriye Öner
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {!aiLoading && !aiError && aiMatches.length === 0 && !aiLoading && (
            <div className="px-4 pb-3 text-xs" style={{ color: '#8B7355' }}>Uygun portföy bulunamadı.</div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-1" style={{ background: '#FEF9F0' }}>
        {mesajlar.length === 0 && (
          <div className="text-center py-16" style={{ color: '#8B7355' }}>
            <p className="text-lg mb-1">Henüz mesaj yok</p>
            <p className="text-sm">İlk mesajı sen gönder!</p>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: '#F6D9A8' }} />
              <span className="text-xs font-medium" style={{ color: '#92400E' }}>{group.date}</span>
              <div className="flex-1 h-px" style={{ background: '#F6D9A8' }} />
            </div>
            {group.messages.map((m, i) => {
              const isOwn = m.kullanici_id === effectiveUser?.id;
              const prevSame = i > 0 && group.messages[i - 1].kullanici_id === m.kullanici_id;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 md:gap-3 ${isOwn ? 'flex-row-reverse' : ''} ${prevSame ? 'mt-0.5' : 'mt-3'}`}
                >
                  {!prevSame ? (
                    <UserAvatar
                      name={userPhotoMap[m.kullanici_id]?.name || m.kullanici_adi}
                      fotoUrl={userPhotoMap[m.kullanici_id]?.fotoUrl}
                      size={32}
                    />
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}
                  <div className={`max-w-[80%] md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!prevSame && (
                      <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-semibold" style={{ color: '#1A1A18' }}>{m.kullanici_adi}</span>
                        <span className="text-xs" style={{ color: '#8B7355' }}>{formatTime(m.created_at)}</span>
                      </div>
                    )}
                    {m.tip === 'voice' && m.ses_url ? (
                      <VoiceNoteBubble m={m} isOwn={isOwn} />
                    ) : (
                      <div
                        className={`px-3 md:px-3.5 py-2 md:py-2.5 rounded-2xl text-sm leading-relaxed break-words ${isOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                        style={isOwn
                          ? { background: '#B45309', color: 'white' }
                          : { background: 'white', color: '#1A1A18', border: '1px solid #F6D9A8' }
                        }
                      >
                        {renderMessage(m.mesaj, m.mentionler, openMention)}
                      </div>
                    )}
                    {prevSame && (
                      <span className="text-xs mt-0.5 px-1" style={{ color: '#D4C9B8' }}>{formatTime(m.created_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="px-3 md:px-4 pb-3 md:pb-4 pt-2 md:pt-3 shrink-0"
        style={{ borderTop: '1px solid #F6D9A8', background: '#FDF3E3' }}
      >
        {/* BAS KONUŞ walkie-talkie button */}
        <div className="flex flex-col items-center gap-1.5 mb-3">
          {/* Active speaker indicator */}
          <div className={`h-6 flex items-center justify-center transition-all ${activeSpeaker ? 'opacity-100' : 'opacity-0'}`}>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              🔊 <span>{activeSpeaker} konuşuyor...</span>
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              onMouseDown={startTransmit}
              onMouseUp={stopTransmit}
              onMouseLeave={transmitting ? stopTransmit : undefined}
              onTouchStart={e => { e.preventDefault(); startTransmit(); }}
              onTouchEnd={e => { e.preventDefault(); stopTransmit(); }}
              className={`relative w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 font-bold text-[10px] tracking-wide transition-all duration-100 select-none touch-none
                ${transmitting
                  ? 'bg-red-600 shadow-[0_0_32px_rgba(220,38,38,0.7)] scale-95 border-4 border-red-300'
                  : 'border-4 border-red-500/60 hover:border-red-500 active:scale-95 cursor-pointer shadow-lg'
                }`}
              style={transmitting ? { WebkitUserSelect: 'none', userSelect: 'none' } : { background: '#FDF3E3', WebkitUserSelect: 'none', userSelect: 'none' }}
            >
              {transmitting && (
                <>
                  <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-60" />
                  <span className="absolute inset-[-6px] rounded-full border border-red-500/30 animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
                </>
              )}
              <span className="text-2xl relative z-10">🎙</span>
              <span className={`font-bold leading-none relative z-10 ${transmitting ? 'text-white' : 'text-red-400'}`}>
                {transmitting ? 'BIRAK' : 'BAS KONUŞ'}
              </span>
            </button>
            <span className={`text-xs h-4 ${transmitting ? 'text-red-400 font-semibold animate-pulse' : ''}`} style={!transmitting ? { color: '#8B7355' } : undefined}>
              {transmitting ? '📡 YAYINDA...' : 'Bas ve konuş, bırak dur'}
            </span>
          </div>
        </div>

        {/* Text input with dropdown */}
        <div className="relative">
          {showDropdown && (
            <div
              className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl shadow-2xl overflow-hidden z-20"
              style={{
                background: 'white',
                border: '1px solid #F6D9A8',
                backdropFilter: 'blur(16px)',
              }}
            >
              {/* Trigger label */}
              <div
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold"
                style={{ borderBottom: '0.5px solid #F6D9A8', color: dropdownTrigger === '@' ? '#D4AF37' : '#534AB7' }}
              >
                {dropdownTrigger === '@' ? (
                  <><Building2 size={12} /> Ada/parsel ile ara</>
                ) : (
                  <><Users size={12} /> Müşteri ara</>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {dropdownTrigger === '@' && (() => {
                  const portfoyItems = suggestions.filter(s => s.trigger === '@' && (s as PortfoySuggestion | InstagramSuggestion).source === 'portfoy') as PortfoySuggestion[];
                  const igItems = suggestions.filter(s => s.trigger === '@' && (s as PortfoySuggestion | InstagramSuggestion).source === 'instagram') as InstagramSuggestion[];
                  return (
                    <>
                      {portfoyItems.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(212,175,55,0.8)', background: 'rgba(212,175,55,0.05)', borderBottom: '0.5px solid #F6D9A8' }}>
                            Portföyler
                          </div>
                          {portfoyItems.map(ps => (
                            <button
                              key={ps.id}
                              onClick={() => selectSuggestion(ps)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:bg-[#F5F0E8]"
                            >
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)' }}>
                                <Building2 size={13} style={{ color: '#D4AF37' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold font-mono text-sm" style={{ color: '#D4AF37' }}>@{ps.adaParsel}</span>
                                  <span className="text-xs truncate" style={{ color: '#1A1A18' }}>{ps.isim}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {ps.bolge && <span className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}><MapPin size={9} />{ps.bolge}</span>}
                                  {ps.fiyat && <span className="text-xs font-medium" style={{ color: '#22A05A' }}>{ps.fiyat}</span>}
                                  {ps.tip && <span className="text-xs px-1.5 py-0.5 rounded-full capitalize" style={{ background: '#F5F0E8', color: '#8B7355' }}>{ps.tip}</span>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      {igItems.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(240,148,51,0.8)', background: 'rgba(240,148,51,0.05)', borderBottom: '0.5px solid #F6D9A8', borderTop: portfoyItems.length > 0 ? '0.5px solid #F6D9A8' : undefined }}>
                            Instagram İlanları
                          </div>
                          {igItems.map(ig => (
                            <button
                              key={ig.id}
                              onClick={() => selectSuggestion(ig)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:bg-[#F5F0E8]"
                            >
                              <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: ig.foto_url ? undefined : 'rgba(240,148,51,0.1)', border: '1px solid rgba(240,148,51,0.25)' }}>
                                {ig.foto_url ? (
                                  <img src={ig.foto_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <InstagramIcon size={13} style={{ color: '#f09433' }} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold font-mono text-sm" style={{ color: '#f09433' }}>@{ig.adaParsel}</span>
                                  {ig.baslik && <span className="text-xs truncate" style={{ color: '#1A1A18' }}>{ig.baslik}</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {ig.bolge && <span className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}><MapPin size={9} />{ig.bolge}</span>}
                                  {ig.fiyat && <span className="text-xs font-medium" style={{ color: '#22A05A' }}>{ig.fiyat}</span>}
                                  <span className="text-[10px] px-1 py-px rounded" style={{ background: 'rgba(240,148,51,0.1)', color: 'rgba(240,148,51,0.7)' }}>Instagram</span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      {portfoyItems.length === 0 && igItems.length === 0 && (
                        <p className="px-4 py-3 text-xs" style={{ color: '#8B7355' }}>Sonuç bulunamadı</p>
                      )}
                    </>
                  );
                })()}
                {dropdownTrigger === '#' && suggestions.map(s => {
                  const ms = s as MusteriSuggestion;
                  return (
                    <button
                      key={ms.id}
                      onClick={() => selectSuggestion(s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:bg-[#F5F0E8]"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(83,74,183,0.1)', border: '1px solid rgba(83,74,183,0.2)' }}>
                        <Users size={13} style={{ color: '#534AB7' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm" style={{ color: '#534AB7' }}>#{ms.label}</span>
                        {ms.muhit && (
                          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#8B7355' }}>
                            <MapPin size={9} />{ms.muhit}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl px-3 md:px-4 py-2.5 md:py-3 transition-all" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <textarea
              ref={inputRef}
              className="flex-1 bg-transparent text-sm resize-none outline-none max-h-32 leading-relaxed"
              style={{ color: '#1A1A18', height: 'auto', minHeight: '24px' }}
              placeholder="Mesaj yaz... @ portföy · # müşteri"
              value={text}
              onChange={e => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {showEslestirBtn && (
                <button
                  onClick={() => runAIMatch(text)}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-gold-400/15 text-gold-300 border border-gold-400/30 hover:bg-gold-400/25 disabled:opacity-50 shrink-0"
                  title="AI ile portföy eşleştir"
                >
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span className="hidden sm:inline">Eşleştir</span>
                </button>
              )}
              <VoiceInput
                size="md"
                className="!bg-[#B45309] !text-white hover:!bg-[#92400E]"
                onResult={t => {
                  setText(prev => prev + (prev ? ' ' : '') + t);
                  inputRef.current?.focus();
                }}
              />
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="p-2 rounded-xl transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                style={!text.trim() ? { background: '#F5F0E8', color: '#D4C9B8' } : { background: '#D4AF37', color: '#1A1A18' }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* WhatsApp reply suggestions based on last message */}
        {mesajlar.length > 0 && (() => {
          const lastMsg = mesajlar[mesajlar.length - 1];
          const isOwn = lastMsg.kullanici_id === effectiveUser?.id;
          if (isOwn) return null;
          const customerMention = lastMsg.mentionler?.find(m => m.type === 'musteri');
          const customer = customerMention
            ? { id: customerMention.id, ad: customerMention.label, durum: 'dusunuyor' } as import('../types').Musteri
            : null;
          return (
            <WhatsAppReplySuggestions
              lastMessage={lastMsg.mesaj}
              customer={customer}
              onSelect={(reply) => {
                setText(reply);
                inputRef.current?.focus();
              }}
            />
          );
        })()}

        {/* Hint row */}
        <div className="flex items-center gap-3 mt-1.5 pl-1">
          <span className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}>
            <Building2 size={10} style={{ color: 'rgba(212,175,55,0.6)' }} />
            @ portföy ada/parsel
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}>
            <Tag size={10} style={{ color: 'rgba(83,74,183,0.5)' }} />
            # müşteri adı
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}>
            <Sparkles size={10} style={{ color: 'rgba(212,175,55,0.5)' }} />
            müşteri isteği yaz → Eşleştir
          </span>
        </div>
      </div>

      {/* Clear confirm modal */}
      {showClearConfirm && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setShowClearConfirm(false)}>
          <div className="modal-content max-w-sm w-full" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: '#1A1A18' }}>Mesajları Temizle</h3>
              <p className="text-sm mb-6" style={{ color: '#8B7355' }}>Tüm mesajlar silinecek. Bu işlem geri alınamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)} className="btn-ghost flex-1">İptal</button>
                <button
                  onClick={clearMessages}
                  disabled={clearingMessages}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                >
                  {clearingMessages ? 'Siliniyor...' : 'Evet, Temizle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedMention && (detailPortfoy || detailMusteri) && (
        <div
          className="modal-overlay"
          style={{ background: 'rgba(120,53,15,0.4)' }}
          onClick={e => e.target === e.currentTarget && setSelectedMention(null)}
        >
          <div className="modal-content max-w-md w-full max-h-[90vh] md:max-h-[80vh] overflow-y-auto" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-4 md:p-5" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <div className="flex items-center gap-2">
                {selectedMention.type === 'portfoy' ? (
                  <>
                    <Building2 size={16} className="text-gold-400" />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#1A1A18' }}>
                        Ada/Parsel: {selectedMention.adaParsel}
                      </p>
                      {selectedMention.portfoyIsim && (
                        <p className="text-xs" style={{ color: '#8B7355' }}>{selectedMention.portfoyIsim}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Users size={16} className="text-blue-400" />
                    <h2 className="font-semibold" style={{ color: '#1A1A18' }}>{selectedMention.label}</h2>
                  </>
                )}
              </div>
              <button onClick={() => setSelectedMention(null)} className="p-1" style={{ color: '#8B7355' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 md:p-5">
              {detailPortfoy && (
                <div className="space-y-3 text-sm">
                  {detailPortfoy.kapak_foto && (
                    <img
                      src={detailPortfoy.kapak_foto}
                      alt={detailPortfoy.isim}
                      className="w-full h-40 object-cover rounded-xl"
                    />
                  )}
                  {detailPortfoy.fiyat && (
                    <p className="text-2xl font-bold" style={{ color: '#D4AF37' }}>{detailPortfoy.fiyat}</p>
                  )}
                  {[
                    ['İsim', detailPortfoy.isim],
                    ['Ada / Parsel', adaParselLabel(detailPortfoy.ada, detailPortfoy.parsel)],
                    ['Bölge', detailPortfoy.bolge],
                    ['Tip', detailPortfoy.tip],
                    ['Oda', detailPortfoy.oda],
                    ['m²', detailPortfoy.metrekare ? `${detailPortfoy.metrekare} m²` : ''],
                    ['Danışman', detailPortfoy.danisman],
                  ].map(([l, v]) =>
                    v ? (
                      <div key={l} className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                        <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>{l}</p>
                        <p style={{ color: '#1A1A18' }}>{v}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
              {detailMusteri && (
                <div className="space-y-3 text-sm">
                  {[
                    ['Telefon', detailMusteri.telefon],
                    ['Tercih Bölge', detailMusteri.muhit],
                    ['Bütçe Min', detailMusteri.butce_min],
                    ['Bütçe Max', detailMusteri.butce_max],
                    ['Danışman', detailMusteri.danisman],
                  ].map(([l, v]) =>
                    v ? (
                      <div key={l} className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                        <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>{l}</p>
                        <p style={{ color: '#1A1A18' }}>{v}</p>
                      </div>
                    ) : null,
                  )}
                  {detailMusteri.aciklama && (
                    <div className="rounded-lg p-3" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8' }}>
                      <p className="text-xs mb-1" style={{ color: '#8B7355' }}>Açıklama</p>
                      <p style={{ color: '#1A1A18' }}>{detailMusteri.aciklama}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
