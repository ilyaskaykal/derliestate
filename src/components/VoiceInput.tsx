import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceInput({ onResult, className = '', size = 'sm' }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
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
    recognitionRef.current?.stop();
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
      title={listening ? 'Durdur' : 'Sesli giriş'}
      className={`${sizeClasses[size]} transition-all duration-200 flex items-center justify-center ${
        listening
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 ring-1 ring-red-500/50 animate-pulse'
          : 'bg-navy-700/60 text-navy-300 hover:bg-navy-600/80 hover:text-white'
      } ${className}`}
    >
      {listening ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
    </button>
  );
}
