import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function VoiceInput({ onResult, className = '', size = 'sm' }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!(
    (window as typeof window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
    (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  ));
  const recognitionRef = useRef<unknown>(null);

  const start = useCallback(() => {
    if (!supported) return;
    const w = window as typeof window & { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }, [supported, onResult]);

  const stop = useCallback(() => {
    (recognitionRef.current as SpeechRecognition | null)?.stop();
    setListening(false);
  }, []);

  if (!supported) return null;

  const sizeClasses = {
    sm: 'p-1.5 rounded-md',
    md: 'p-2 rounded-lg',
    lg: 'p-3 rounded-xl',
  };
  const iconSize = { sm: 14, md: 16, lg: 20 }[size];

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`transition-all ${sizeClasses[size]} ${listening ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-stone-400 hover:text-stone-700'} ${className}`}
    >
      {listening ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
    </button>
  );
}
