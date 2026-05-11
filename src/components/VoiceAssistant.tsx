import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Loader2, Volume2, Navigation, Users, Building2, CheckSquare } from 'lucide-react';
import { callClaude } from '../lib/claude';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import type { Page } from '../App';

interface Props {
  onNavigate?: (page: Page) => void;
  onOpenAddCustomer?: () => void;
  onOpenAddPortfolio?: () => void;
}

const EXAMPLE_PROMPTS = [
  '"Dalyan\'daki portföyleri listele"',
  '"En sıcak müşteri kim?"',
  '"Bugün kaç görevim var?"',
  '"Alaçatı\'da kaç portföy var?"',
];

export default function VoiceAssistant({ onNavigate, onOpenAddCustomer, onOpenAddPortfolio }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [navAction, setNavAction] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const startListening = () => {
    const SR = (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { toast('Tarayıcınız ses tanımayı desteklemiyor.', 'error'); return; }

    const rec = new SR();
    rec.lang = 'tr-TR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = async (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setListening(false);
      await handleVoiceCommand(text);
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setTranscript('');
    setResponse('');
    setNavAction(null);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const speakResponse = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'tr-TR';
    utt.rate = 1.0;
    utt.pitch = 1.0;
    window.speechSynthesis.speak(utt);
  };

  const handleVoiceCommand = async (command: string) => {
    const lower = command.toLowerCase();

    // Navigation intent detection
    const navPatterns: { pattern: RegExp; action: () => void; page: string }[] = [
      { pattern: /müşteri ekle|yeni müşteri|müşteri oluştur/i, action: () => { onNavigate?.('customers'); onOpenAddCustomer?.(); }, page: 'müşteri ekleme' },
      { pattern: /portföy ekle|yeni portföy|portföy oluştur/i, action: () => { onNavigate?.('portfolio'); onOpenAddPortfolio?.(); }, page: 'portföy ekleme' },
      { pattern: /görev(lerimi)? (göster|aç|git)|görevlere git/i, action: () => onNavigate?.('gorevler'), page: 'görevler' },
      { pattern: /mesajlar(ı)? (göster|aç|git)|mesajlaşma|mesajlaşmaya git/i, action: () => onNavigate?.('mesajlasma'), page: 'mesajlaşma' },
      { pattern: /aktivite tah|aktiviteye git/i, action: () => onNavigate?.('aktivite'), page: 'aktivite tahtası' },
      { pattern: /randev(u|ular)(ı)? (göster|aç)|randevulara git/i, action: () => onNavigate?.('appointments'), page: 'randevular' },
      { pattern: /portföy(leri)? (göster|aç|listele)(?!.*bölge|.*mahalle|.*ada|.*dalyan|.*alaçatı|.*ilıca|.*ovacık|.*boyalık)/i, action: () => onNavigate?.('portfolio'), page: 'portföyler' },
      { pattern: /müşteri(leri)? (göster|aç|listele)(?!.*sıcak|.*soğuk|.*kararsız)/i, action: () => onNavigate?.('customers'), page: 'müşteriler' },
      { pattern: /anasayfa(ya)? git|ana sayfa/i, action: () => onNavigate?.('anasayfa'), page: 'ana sayfa' },
      { pattern: /rota plan|rotaya git/i, action: () => onNavigate?.('rota-planlayici'), page: 'rota planlayıcı' },
    ];

    for (const { pattern, action, page } of navPatterns) {
      if (pattern.test(lower)) {
        const msg = `Tamam, ${page} açıyorum.`;
        setNavAction(page);
        setResponse(msg);
        speakResponse(msg);
        action();
        return;
      }
    }

    // Data query — fetch from Supabase and send to Claude
    setProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const [{ data: portfolios }, { data: customers }, { data: tasks }, { data: appointments }] = await Promise.all([
        supabase.from('portfoyler').select('isim, fiyat, para_birimi, bolge, mahalle, ilce, il, tip, oda, metrekare, denize_yakin, deniz_manzarasi, portfoy_durum, danisman').order('created_at', { ascending: false }),
        supabase.from('musteriler').select('ad, soyad, butce_min, butce_max, para_birimi, muhit, durum, portfoy_tercihi, danisman').order('created_at', { ascending: false }),
        supabase.from('gorevler').select('baslik, oncelik, durum, son_tarih, saat, atanan_user').eq('durum', 'bekliyor'),
        supabase.from('randevular').select('konu, tarih, saat, durum').eq('tarih', today),
      ]);

      const prompt = `Sen DerliEstate Pro emlak CRM asistanısın. Kullanıcının sorduğu soruya gerçek veriye bakarak kısa ve net Türkçe cevap ver.

KULLANICI SORUSU: "${command}"

VERİ:

PORTFÖYLER (${(portfolios || []).length} adet):
${JSON.stringify((portfolios || []).slice(0, 80).map(p => ({
  isim: p.isim,
  fiyat: p.fiyat,
  para_birimi: p.para_birimi || 'TL',
  bolge: p.bolge,
  mahalle: p.mahalle,
  ilce: p.ilce,
  tip: p.tip,
  oda: p.oda,
  metrekare: p.metrekare,
  denize_yakin: p.denize_yakin,
  deniz_manzarasi: p.deniz_manzarasi,
  durum: p.portfoy_durum,
})))}

MÜŞTERİLER (${(customers || []).length} adet):
${JSON.stringify((customers || []).slice(0, 80).map(c => ({
  ad: c.ad,
  soyad: c.soyad,
  butce_min: c.butce_min,
  butce_max: c.butce_max,
  para_birimi: c.para_birimi || 'TL',
  muhit: c.muhit,
  durum: c.durum,
  portfoy_tercihi: c.portfoy_tercihi,
})))}

BEKLEYEN GÖREVLER (${(tasks || []).length} adet):
${JSON.stringify((tasks || []).slice(0, 30))}

BUGÜNKÜ RANDEVULAR (${(appointments || []).length} adet):
${JSON.stringify(appointments || [])}

KURALLAR:
1. Veriyi olduğu gibi kullan, uydurma.
2. Kısa, doğal Türkçe; maksimum 3-4 cümle.
3. Belirli bölge sorulduysa sadece o bölgedeki portföyleri say/listele.
4. Veri yoksa "bulunamadı" de.
5. Fiyatları okunabilir biçimde söyle (ör. "8 milyon TL").
6. Sadece düz metin döndür, JSON veya markdown yok.`;

      const answer = await callClaude(prompt, 400);
      setResponse(answer);
      speakResponse(answer);
    } catch {
      const msg = 'Üzgünüm, şu an cevap veremiyorum.';
      setResponse(msg);
      speakResponse(msg);
    }
    setProcessing(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-30 transition-all hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #D4AF37, #C8A020)', boxShadow: '0 4px 24px rgba(212,175,55,0.5)' }}
        aria-label="Sesli Asistan"
      >
        <Mic size={22} className="text-white" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
      style={{ background: 'white', border: '1px solid #F6D9A8' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F6D9A8', background: '#FDF3E3' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #D4AF37, #C8A020)' }}>
            <Mic size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold" style={{ color: '#1A1A18' }}>Sesli Asistan</span>
        </div>
        <button onClick={() => { setOpen(false); window.speechSynthesis?.cancel(); }} className="text-dark-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Mic button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={listening ? stopListening : startListening}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
            style={listening
              ? { background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', boxShadow: '0 0 24px rgba(239,68,68,0.4)' }
              : { background: 'linear-gradient(135deg, #D4AF37, #C8A020)', boxShadow: '0 4px 20px rgba(212,175,55,0.4)' }
            }
          >
            {listening ? <MicOff size={24} className="text-red-400" /> : <Mic size={24} className="text-white" />}
          </button>
          <p className="text-xs text-center" style={{ color: '#8B7355' }}>
            {listening ? 'Dinleniyor... (tıkla dur)' : 'Konuşmak için tıkla'}
          </p>
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
            <p className="text-xs mb-0.5" style={{ color: '#8B7355' }}>Söylediğiniz:</p>
            <p className="text-sm italic" style={{ color: '#1A1A18' }}>"{transcript}"</p>
          </div>
        )}

        {/* Processing */}
        {processing && (
          <div className="flex items-center gap-2 justify-center py-2">
            <Loader2 size={16} className="animate-spin" style={{ color: '#D4AF37' }} />
            <span className="text-xs" style={{ color: '#8B7355' }}>Veritabanı sorgulanıyor...</span>
          </div>
        )}

        {/* Nav action feedback */}
        {navAction && !processing && (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Navigation size={13} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <p className="text-sm" style={{ color: 'rgba(147,197,253,0.9)' }}>{response}</p>
          </div>
        )}

        {/* AI Response */}
        {response && !processing && !navAction && (
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Volume2 size={11} style={{ color: '#22c55e' }} />
              <p className="text-xs font-medium" style={{ color: '#22c55e' }}>Asistan yanıtı:</p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#1A1A18' }}>{response}</p>
          </div>
        )}

        {/* Example prompts */}
        {!transcript && !listening && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium" style={{ color: '#8B7355' }}>Örnek sorular:</p>
            <div className="grid grid-cols-1 gap-1">
              {EXAMPLE_PROMPTS.map(q => (
                <div key={q} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: '#FDF3E3', color: '#8B7355', border: '1px solid #F6D9A8' }}>
                  {q}
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: '#8B7355' }}>Navigasyon: "Müşteri ekle", "Görevlerimi göster"</p>
          </div>
        )}

        {/* Capability chips */}
        {!transcript && !listening && (
          <div className="flex gap-1.5 flex-wrap pt-1">
            {[
              { icon: <Building2 size={10} />, label: 'Portföy' },
              { icon: <Users size={10} />, label: 'Müşteri' },
              { icon: <CheckSquare size={10} />, label: 'Görev' },
              { icon: <Navigation size={10} />, label: 'Navigasyon' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(212,175,55,0.08)', color: '#8B7355', border: '1px solid rgba(212,175,55,0.2)' }}>
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
