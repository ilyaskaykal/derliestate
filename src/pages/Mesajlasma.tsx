import { useState, useEffect, useRef } from 'react';
import { Send, Search, User, Loader2, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import UserAvatar from '../components/UserAvatar';
import type { Mesaj } from '../types';

interface StaffUser {
  id: string;
  ad: string;
  soyad: string;
  rol: string;
  foto_url?: string;
}

export default function Mesajlasma() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [messages, setMessages] = useState<Mesaj[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('genel');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionResults, setMentionResults] = useState<StaffUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from('kullanicilar').select('id,ad,soyad,rol,foto_url').then(({ data }) => setStaff(data || []));
  }, []);

  useEffect(() => {
    loadMessages();
    const sub = supabase
      .channel('messages-' + selectedChannel)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mesajlar', filter: `kanal=eq.${selectedChannel}` }, payload => {
        setMessages(prev => [...prev, payload.new as Mesaj]);
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [selectedChannel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('mesajlar')
      .select('*')
      .eq('kanal', selectedChannel)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const mentions: string[] = [];
    const mentionRegex = /@(\w+)/g;
    let m;
    while ((m = mentionRegex.exec(text)) !== null) {
      const found = staff.find(s => `${s.ad}${s.soyad}`.toLowerCase() === m[1].toLowerCase() || s.ad.toLowerCase() === m[1].toLowerCase());
      if (found) mentions.push(found.id);
    }
    const { error } = await supabase.from('mesajlar').insert({
      kanal: selectedChannel, icerik: text.trim(),
      gonderen_id: user?.id, gonderen_ad: `${user?.ad} ${user?.soyad}`,
      gonderen_foto: user?.foto_url || null, mentionlar: mentions,
    });
    if (error) toast(error.message, 'error');
    else setText('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === '@') { setShowMentions(true); setMentionQuery(''); }
    if (e.key === 'Escape') setShowMentions(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1 && atIdx === val.length - 1) { setShowMentions(true); setMentionQuery(''); }
    else if (atIdx !== -1 && showMentions) {
      const query = val.slice(atIdx + 1);
      if (/\s/.test(query)) setShowMentions(false);
      else setMentionQuery(query);
    } else setShowMentions(false);
  };

  const insertMention = (s: StaffUser) => {
    const atIdx = text.lastIndexOf('@');
    const newText = text.slice(0, atIdx) + `@${s.ad} `;
    setText(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!showMentions) return;
    const q = mentionQuery.trim();
    supabase.from('kullanicilar').select('id,ad,soyad,rol,foto_url')
      .neq('username', 'superadmin').neq('rol', 'misafir')
      .or(q ? `ad.ilike.%${q}%,soyad.ilike.%${q}%` : 'ad.neq.null')
      .limit(8)
      .then(({ data }) => setMentionResults(data || []));
  }, [showMentions, mentionQuery]);

  const channels = [
    { id: 'genel', name: 'Genel' },
    { id: 'satis', name: 'Satış' },
    { id: 'kiralama', name: 'Kiralama' },
    { id: 'yonetim', name: 'Yönetim' },
  ];

  const filteredMessages = messages.filter(msg => !search || msg.icerik?.toLowerCase().includes(search.toLowerCase()) || msg.gonderen_ad?.toLowerCase().includes(search.toLowerCase()));

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  let lastDate = '';

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 220, borderRight: '1px solid #F0E8D8', display: 'flex', flexDirection: 'column', background: '#FAF6EF', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px', borderBottom: '1px solid #F0E8D8' }}>
          <h2 style={{ fontWeight: 900, fontSize: 15, color: '#1A1A18' }}>Mesajlaşma</h2>
        </div>
        <div style={{ padding: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#8B7355', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Kanallar</p>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer',
                background: selectedChannel === ch.id ? '#1A1A18' : 'transparent',
                color: selectedChannel === ch.id ? '#fff' : '#5A4A3A', fontSize: 13, fontWeight: 600, marginBottom: 2,
              }}
            >
              # {ch.name}
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 8px 0', borderTop: '1px solid #F0E8D8', marginTop: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#8B7355', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Ekip</p>
          {staff.slice(0, 8).map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#5A4A3A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.ad}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
          <div>
            <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}># {channels.find(c => c.id === selectedChannel)?.name}</h3>
            <p style={{ fontSize: 11, color: '#8B7355' }}>{filteredMessages.length} mesaj</p>
          </div>
          <div className="search-box" style={{ width: 180 }}>
            <Search size={12} color="#8B7355" />
            <input placeholder="Mesajlarda ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" style={{ fontSize: 12 }} />
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {filteredMessages.map((msg, i) => {
            const msgDate = formatDate(msg.created_at);
            const showDate = msgDate !== lastDate;
            lastDate = msgDate;
            const isOwn = msg.gonderen_id === user?.id;
            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={{ textAlign: 'center', margin: '16px 0', position: 'relative' }}>
                    <div style={{ height: 1, background: '#F0E8D8', position: 'absolute', top: '50%', left: 0, right: 0 }} />
                    <span style={{ position: 'relative', background: '#F5F0E8', padding: '2px 12px', borderRadius: 12, fontSize: 11, color: '#8B7355' }}>{msgDate}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                  {!isOwn && (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F0E8D8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {msg.gonderen_foto ? <img src={msg.gonderen_foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={14} color="#8B7355" />}
                    </div>
                  )}
                  <div style={{ maxWidth: '65%' }}>
                    {!isOwn && <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 3, fontWeight: 600 }}>{msg.gonderen_ad}</div>}
                    <div style={{
                      padding: '9px 13px', borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: isOwn ? '#1A1A18' : '#fff',
                      border: isOwn ? 'none' : '1px solid #F0E8D8',
                      fontSize: 13, color: isOwn ? '#F5F0E8' : '#1A1A18', lineHeight: 1.5,
                    }}>
                      {msg.icerik?.split(/(@\w+)/).map((part, j) =>
                        part.startsWith('@') ? <span key={j} style={{ color: '#D4AF37', fontWeight: 700 }}>{part}</span> : part
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#C4B5A5', marginTop: 3, textAlign: isOwn ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8B7355' }}>
              <AtSign size={32} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14 }}>Henüz mesaj yok. İlk mesajı gönderin!</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #F0E8D8', background: '#fff', position: 'relative' }}>
          {showMentions && mentionResults.length > 0 && (
            <div style={{ position: 'absolute', bottom: '100%', left: 20, right: 20, background: '#fff', border: '1px solid #F0E8D8', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 100 }}>
              {mentionResults.map(s => (
                <button key={s.id} onClick={() => insertMention(s)} style={{ width: '100%', padding: '8px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAF6EF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <User size={14} color="#8B7355" />
                  <span style={{ fontWeight: 600, color: '#1A1A18' }}>{s.ad} {s.soyad}</span>
                  <span style={{ color: '#8B7355', fontSize: 11 }}>{s.rol}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Mesaj yazın... (@ ile bahsedin, Enter ile gönderin)"
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #F0E8D8', borderRadius: 10, resize: 'none', fontSize: 13, color: '#1A1A18', fontFamily: 'inherit', outline: 'none', maxHeight: 100, lineHeight: 1.5 }}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              style={{ width: 40, height: 40, borderRadius: 10, background: text.trim() ? '#1A1A18' : '#F0E8D8', border: 'none', cursor: text.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
            >
              {sending ? <Loader2 size={16} color="#D4AF37" className="animate-spin" /> : <Send size={16} color={text.trim() ? '#D4AF37' : '#C4B5A5'} />}
            </button>
          </div>
          <p style={{ fontSize: 10, color: '#C4B5A5', marginTop: 4 }}>@ ile ekip üyelerini etiketleyin • Enter gönderin • Shift+Enter satır atlar</p>
        </div>
      </div>
    </div>
  );
}
