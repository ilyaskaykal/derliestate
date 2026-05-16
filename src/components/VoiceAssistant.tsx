import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Loader2, Volume2 } from 'lucide-react';
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

export default function VoiceAssistant({ onNavigate }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const startListening = () => {
    const w = window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
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
    window.speechSynthesis.speak(utt);
  };

  const handleVoiceCommand = async (command: string) => {
    const lower = command.toLowerCase();

    const navPatterns: { pattern: RegExp; action: () => void; page: string }[] = [
      { pattern: /müşteri ekle|yeni müşteri/i, action: () => onNavigate?.('customers'), page: 'müşteriler' },
      { pattern: /portföy ekle|yeni portföy/i, action: () => onNavigate?.('portfolio'), page: 'portföyler' },
      { pattern: /görev(lerimi)? (göster|aç|git)|görevlere git/i, action: () => onNavigate?.('gorevler'), page: 'görevler' },
      { pattern: /mesajlar|mesajlaşma/i, action: () => onNavigate?.('mesajlasma'), page: 'mesajlaşma' },
      { pattern: /aktivite/i, action: () => onNavigate?.('aktivite'), page: 'aktivite tahtası' },
      { pattern: /randev/i, action: () => onNavigate?.('appointments'), page: 'randevular' },
      { pattern: /anasayfa|ana sayfa/i, action: () => onNavigate?.('anasayfa'), page: 'ana sayfa' },
    ];

    for (const { pattern, action, page } of navPatterns) {
      if (pattern.test(lower)) {
        const msg = `Tamam, ${page} açıyorum.`;
        setResponse(msg);
        speakResponse(msg);
        action();
        return;
      }
    }

    setProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [{ data: portfolios }, { data: customers }, { data: tasks }, { data: appointments }] = await Promise.all([
        supabase.from('portfoyler').select('isim, fiyat, para_birimi, bolge, mahalle, ilce, il, tip, oda, metrekare, denize_yakin, deniz_manzarasi, portfoy_durum').order('created_at', { ascending: false }),
        supabase.from('musteriler').select('ad, soyad, butce_min, butce_max, para_birimi, muhit, durum, portfoy_tercihi').order('created_at', { ascending: false }),
        supabase.from('gorevler').select('baslik, oncelik, durum, son_tarih').eq('durum', 'bekliyor'),
        supabase.from('randevular').select('konu, tarih, saat, durum').eq('tarih', today),
      ]);

      const prompt = `Sen DerliEstate Pro emlak CRM asistanısın. Kullanıcının sorduğu soruya gerçek veriye bakarak kısa ve net Türkçe cevap ver.
KULLANICI SORUSU: "${command}"
PORTFÖYLER (${(portfolios || []).length} adet): ${JSON.stringify((portfolios || []).slice(0, 50))}
MÜŞTERİLER (${(customers || []).length} adet): ${JSON.stringify((customers || []).slice(0, 50))}
BEKLEYEN GÖREVLER: ${JSON.stringify((tasks || []).slice(0, 20))}
BUGÜNKİ RANDEVULAR: ${JSON.stringify(appointments || [])}
Kısa, doğal Türkçe; maksimum 3-4 cümle. Sadece düz metin.`;

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
        style={{
          position: 'fixed',
          bottom: 90,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#1A1A18',
          border: '2px solid #D4AF37',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 1000,
        }}
        title="Sesli Asistan"
      >
        <Mic size={22} color="#D4AF37" />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 90,
      right: 20,
      width: 320,
      background: '#1A1A18',
      border: '1px solid #D4AF37',
      borderRadius: 16,
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(212,175,55,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Volume2 size={16} color="#D4AF37" />
          <span style={{ color: '#F5F0E8', fontWeight: 700, fontSize: 14 }}>Sesli Asistan</span>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 16 }}>
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            border: `2px solid ${listening ? '#FF3B2F' : '#D4AF37'}`,
            background: listening ? 'rgba(255,59,47,0.1)' : 'rgba(212,175,55,0.1)',
            color: listening ? '#FF3B2F' : '#D4AF37',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
          {listening ? 'Dinleniyor...' : 'Konuşmak için tıklayın'}
        </button>

        {transcript && (
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <span style={{ color: '#8B7355', fontSize: 11 }}>Siz: </span>
            <span style={{ color: '#F5F0E8', fontSize: 13 }}>{transcript}</span>
          </div>
        )}

        {processing && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} color="#D4AF37" className="animate-spin" />
            <span style={{ color: '#8B7355', fontSize: 12 }}>İşleniyor...</span>
          </div>
        )}

        {response && !processing && (
          <div style={{ marginTop: 10, padding: 10, background: 'rgba(212,175,55,0.08)', borderRadius: 8, border: '1px solid rgba(212,175,55,0.2)' }}>
            <span style={{ color: '#8B7355', fontSize: 11 }}>Asistan: </span>
            <span style={{ color: '#F5F0E8', fontSize: 13 }}>{response}</span>
          </div>
        )}

        {!transcript && !processing && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: '#8B7355', fontSize: 10, marginBottom: 6 }}>Örnek komutlar:</p>
            {EXAMPLE_PROMPTS.map((p, i) => (
              <p key={i} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 2 }}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
