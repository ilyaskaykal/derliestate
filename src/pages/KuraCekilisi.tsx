import { useState, useEffect, useCallback, useRef } from 'react';
import { Dices, Crown, Check, Users, Building2, Loader2, ChevronDown, ChevronUp, Trophy, Sparkles, Radio } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { Kullanici, Portfoy } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isAdminLevel } from '../types';
import { logAction } from '../lib/security';
import UserAvatar from '../components/UserAvatar';

interface KuraGecmisi {
  id: string;
  aciklama: string | null;
  portfoy_id: string | null;
  kazanan_username: string | null;
  kazanan_ad: string | null;
  katilanlar: { id: string; ad: string; username: string; foto_url?: string | null }[] | null;
  cekilis_tarihi: string;
}

const CARD_COLORS = [
  'from-blue-600/30 to-blue-800/20 border-blue-500/30',
  'from-green-600/30 to-green-800/20 border-green-500/30',
  'from-orange-600/30 to-orange-800/20 border-orange-500/30',
  'from-pink-600/30 to-pink-800/20 border-pink-500/30',
  'from-cyan-600/30 to-cyan-800/20 border-cyan-500/30',
  'from-yellow-600/30 to-yellow-800/20 border-yellow-500/30',
];

function cardColor(username: string) {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xfffff;
  return CARD_COLORS[hash % CARD_COLORS.length];
}

const CHANNEL_NAME = 'kura-canli';

export default function KuraCekilisi() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canDraw = user?.rol === 'admin';

  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [gecmis, setGecmis] = useState<KuraGecmisi[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state (admin only)
  const [aciklama, setAciklama] = useState('');
  const [selectedPortfoyId, setSelectedPortfoyId] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Live draw state (shared across all viewers via broadcast)
  const [spinning, setSpinning] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [winner, setWinner] = useState<Kullanici | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<Kullanici[]>([]);
  const [liveDescription, setLiveDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [isLive, setIsLive] = useState(false); // true when a draw is actively broadcasting

  // History expand
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const spinRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, portRes, gecmisRes] = await Promise.all([
      supabase.from('kullanicilar').select('*').neq('rol', 'admin').neq('rol', 'misafir').neq('username', 'superadmin').neq('username', 'derli').order('ad'),
      supabase.from('portfoyler').select('id, isim, ada, parsel, bolge').order('created_at', { ascending: false }),
      supabase.from('kura_gecmisi').select('*').order('cekilis_tarihi', { ascending: false }).limit(50),
    ]);
    setKullanicilar((usersRes.data || []) as Kullanici[]);
    setPortfoyler((portRes.data || []) as Portfoy[]);
    setGecmis((gecmisRes.data || []) as KuraGecmisi[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Subscribe to realtime broadcast channel
  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'draw_start' }, ({ payload }) => {
        setLiveParticipants(payload.participants as Kullanici[]);
        setLiveDescription(payload.description || '');
        setSpinning(true);
        setWinner(null);
        setHighlightedId(null);
        setIsLive(true);
      })
      .on('broadcast', { event: 'draw_highlight' }, ({ payload }) => {
        setHighlightedId((payload.user as Kullanici).id);
      })
      .on('broadcast', { event: 'draw_winner' }, ({ payload }) => {
        const w = payload.winner as Kullanici;
        setHighlightedId(w.id);
        setWinner(w);
        setSpinning(false);
        setIsLive(false);
        fireConfetti();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedUsers(new Set(kullanicilar.map(k => k.id)));
  const selectDanismanlar = () => setSelectedUsers(new Set(kullanicilar.filter(k => k.rol === 'danisan' || k.rol === 'kıdemli_danisan').map(k => k.id)));
  const clearAll = () => setSelectedUsers(new Set());

  const fireConfetti = () => {
    confetti({
      particleCount: 200,
      spread: 90,
      origin: { y: 0.55 },
      colors: ['#FFD700', '#FF0040', '#FF6B35', '#10b981', '#f97316'],
    });
    setTimeout(() => {
      confetti({ particleCount: 100, spread: 120, origin: { x: 0.1, y: 0.7 }, colors: ['#FFD700', '#FF0040', '#FF6B35'] });
      confetti({ particleCount: 100, spread: 120, origin: { x: 0.9, y: 0.7 }, colors: ['#FFD700', '#FF0040', '#FF6B35'] });
    }, 400);
  };

  const drawWinner = () => {
    if (selectedUsers.size < 2) { toast('En az 2 katılımcı seçin.', 'error'); return; }
    let participants = kullanicilar.filter(k => selectedUsers.has(k.id));

    // Prevent consecutive winner: exclude last winner from pool if pool size allows
    const lastWinnerUsername = gecmis[0]?.kazanan_username;
    if (lastWinnerUsername) {
      const withoutLast = participants.filter(k => k.username !== lastWinnerUsername);
      if (withoutLast.length >= 2) participants = withoutLast;
    }

    // Broadcast start to all viewers
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_start',
      payload: { participants, description: aciklama },
    });

    setLiveParticipants(participants);
    setLiveDescription(aciklama);
    setWinner(null);
    setSpinning(true);
    setIsLive(true);

    let counter = 0;
    let interval = 50;
    let highlightIndex = 0;

    const spin = () => {
      const current = participants[highlightIndex % participants.length];
      setHighlightedId(current.id);

      channelRef.current?.send({
        type: 'broadcast',
        event: 'draw_highlight',
        payload: { user: current, counter },
      });

      highlightIndex++;
      counter++;
      if (counter > 20) interval = 100;
      if (counter > 30) interval = 200;
      if (counter > 40) interval = 400;

      if (counter < 50) {
        spinRef.current = setTimeout(spin, interval);
      } else {
        const winnerUser = participants[Math.floor(Math.random() * participants.length)];
        setHighlightedId(winnerUser.id);
        setWinner(winnerUser);
        setSpinning(false);
        setIsLive(false);
        fireConfetti();

        channelRef.current?.send({
          type: 'broadcast',
          event: 'draw_winner',
          payload: { winner: winnerUser, description: aciklama },
        });

        saveResult(winnerUser, participants);
      }
    };

    spin();
  };

  const saveResult = async (winnerUser: Kullanici, participants: Kullanici[]) => {
    setSaving(true);
    const { error } = await supabase.from('kura_gecmisi').insert({
      aciklama: aciklama || null,
      portfoy_id: selectedPortfoyId || null,
      kazanan_username: winnerUser.username,
      kazanan_ad: `${winnerUser.ad} ${winnerUser.soyad}`.trim(),
      katilanlar: participants.map(p => ({ id: p.id, ad: `${p.ad} ${p.soyad}`.trim(), username: p.username, foto_url: p.foto_url })),
    });
    if (error) toast('Kura kaydedilemedi.', 'error');
    else { await load(); }
    setSaving(false);
  };

  const resetDraw = () => {
    setWinner(null);
    setHighlightedId(null);
    setLiveParticipants([]);
    setAciklama('');
    setSelectedPortfoyId('');
  };

  const clearHistory = async () => {
    setClearingHistory(true);
    const count = gecmis.length;
    const { error } = await supabase.from('kura_gecmisi').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) toast('Geçmiş temizlenemedi.', 'error');
    else {
      setGecmis([]);
      toast('Kura geçmişi temizlendi.', 'success');
      await logAction(user?.username ?? '', 'kura_history_cleared', { deleted_count: count });
    }
    setShowClearConfirm(false);
    setClearingHistory(false);
  };

  const showAnimation = spinning || winner || (liveParticipants.length > 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-4 md:px-6 py-4 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid #F6D9A8', background: 'white' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #d4a843, #f59e0b)' }}
          >
            <Dices size={15} className="text-dark-900" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold" style={{ color: '#1A1A18' }}>Kura Çekilişi</h1>
            <p className="text-dark-400 text-xs">Portföy Dağıtım Kurası</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-red-400 border border-red-500/30 bg-red-500/10 animate-pulse">
              <Radio size={12} />
              CANLI
            </div>
          )}
          {!canDraw && (
            <span className="text-xs text-dark-500 bg-dark-700/50 px-2 py-1 rounded-lg">Sadece izleme</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-dark-400">
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : (
          <>
            {/* Non-admin idle state */}
            {!canDraw && !showAnimation && (
              <div
                className="rounded-2xl border p-8 text-center"
                style={{ background: 'white', borderColor: '#F6D9A8' }}
              >
                <Dices size={40} className="mx-auto mb-3 text-dark-500 opacity-50" />
                <p className="text-dark-400 text-sm font-medium">Şu an aktif çekiliş yok</p>
                <p className="text-dark-600 text-xs mt-1">Admin bir çekiliş başlattığında burada canlı olarak izleyebilirsiniz</p>
              </div>
            )}

            {/* Draw setup — only for admin */}
            {canDraw && (
              <div
                className="rounded-2xl border overflow-hidden"
                style={{
                  background: 'white',
                  borderColor: '#F6D9A8',
                  boxShadow: '0 0 40px rgba(212,168,67,0.06)',
                }}
              >
                <div className="p-4 md:p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Bu kura ne için?</label>
                      <input
                        className="input"
                        placeholder="ör. Alaçatı portföy dağılımı"
                        value={aciklama}
                        onChange={e => setAciklama(e.target.value)}
                        disabled={spinning}
                      />
                    </div>
                    <div>
                      <label className="label">Portföy (opsiyonel)</label>
                      <select
                        className="input"
                        value={selectedPortfoyId}
                        onChange={e => setSelectedPortfoyId(e.target.value)}
                        disabled={spinning}
                      >
                        <option value="">— Portföy seç —</option>
                        {portfoyler.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.isim} {p.ada && p.parsel ? `(${p.ada}/${p.parsel})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Participant selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <label className="label mb-0">Katılımcılar</label>
                      <div className="flex gap-2">
                        <button onClick={selectAll} disabled={spinning} className="text-xs px-2.5 py-1 rounded-lg bg-dark-700 text-dark-300 hover:bg-dark-600 transition-colors border border-dark-600">
                          Tümünü Seç
                        </button>
                        <button onClick={selectDanismanlar} disabled={spinning} className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20">
                          <Users size={11} className="inline mr-1" />Danışmanlar
                        </button>
                        <button onClick={clearAll} disabled={spinning} className="text-xs px-2.5 py-1 rounded-lg bg-dark-700 text-dark-500 hover:bg-dark-600 transition-colors border border-dark-600">
                          Temizle
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {kullanicilar.map(k => {
                        const isSelected = selectedUsers.has(k.id);
                        return (
                          <button
                            key={k.id}
                            onClick={() => toggleUser(k.id)}
                            disabled={spinning}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-sm font-medium ${
                              isSelected
                                ? 'bg-gold-400/15 border-gold-400/40 text-gold-300'
                                : 'bg-dark-700/50 border-dark-600 text-dark-300 hover:border-dark-500'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected ? 'bg-gold-400 border-gold-400' : 'border-dark-500'
                              }`}
                            >
                              {isSelected && <Check size={10} className="text-dark-900" />}
                            </span>
                            <span className="truncate">{k.ad} {k.soyad}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedUsers.size > 0 && (
                      <p className="text-dark-500 text-xs mt-2">
                        <span className="text-gold-400 font-semibold">{selectedUsers.size}</span> katılımcı seçildi
                      </p>
                    )}
                  </div>

                  {/* BIG DRAW BUTTON */}
                  <button
                    onClick={drawWinner}
                    disabled={spinning || selectedUsers.size < 2 || saving}
                    className={`w-full py-5 rounded-2xl text-xl font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-3 border-2 ${
                      spinning || saving
                        ? 'bg-dark-700 border-dark-600 text-dark-400 cursor-not-allowed'
                        : 'border-gold-400/50 text-gold-300 hover:border-gold-400 hover:shadow-[0_0_40px_rgba(212,168,67,0.3)] active:scale-98 cursor-pointer'
                    }`}
                    style={
                      !spinning && !saving
                        ? { background: 'linear-gradient(135deg, rgba(212,168,67,0.15), rgba(245,158,11,0.08))' }
                        : undefined
                    }
                  >
                    {spinning ? (
                      <><Loader2 size={24} className="animate-spin" />Kura çekiliyor...</>
                    ) : (
                      <><Dices size={26} />KURA ÇEK</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Live animation — shown to ALL users when draw is active */}
            {showAnimation && liveParticipants.length > 0 && (
              <div
                className="rounded-2xl border p-5 md:p-8"
                style={{
                  background: '#FDF3E3',
                  borderColor: winner ? 'rgba(212,168,67,0.4)' : '#F6D9A8',
                  boxShadow: winner ? '0 0 60px rgba(212,168,67,0.15)' : undefined,
                }}
              >
                {!canDraw && spinning && (
                  <div className="flex items-center justify-center gap-2 mb-5 text-sm text-dark-400">
                    <Radio size={14} className="text-red-400 animate-pulse" />
                    Admin tarafından başlatıldı — canlı izliyorsunuz
                  </div>
                )}

                {liveDescription && (
                  <p className="text-center text-dark-400 text-sm mb-4">{liveDescription}</p>
                )}

                {winner && (
                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Trophy size={24} className="text-gold-400" />
                      <h2 className="text-xl md:text-2xl font-bold text-gold-400">Kazanan!</h2>
                      <Trophy size={24} className="text-gold-400" />
                    </div>
                    <p className="text-2xl md:text-3xl font-black mt-1" style={{ color: '#1A1A18' }}>
                      {winner.ad} {winner.soyad}
                    </p>
                    <p className="text-dark-400 text-sm mt-1">@{winner.username}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {liveParticipants.map(k => {
                    const isHighlighted = highlightedId === k.id;
                    const isWinner = winner?.id === k.id;

                    return (
                      <div
                        key={k.id}
                        className={`relative rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-all duration-150 ${
                          isWinner
                            ? 'border-gold-400 shadow-[0_0_30px_rgba(212,168,67,0.5)]'
                            : isHighlighted
                              ? 'border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4)] scale-105'
                              : `border bg-gradient-to-br ${cardColor(k.username)}`
                        }`}
                        style={
                          isWinner
                            ? {
                                background: 'linear-gradient(135deg, rgba(212,168,67,0.2), rgba(245,158,11,0.1))',
                                animation: 'winnerGlow 1.5s ease-in-out infinite',
                              }
                            : isHighlighted
                              ? { background: 'linear-gradient(135deg, rgba(96,165,250,0.2), rgba(59,130,246,0.1))' }
                              : undefined
                        }
                      >
                        {isWinner && (
                          <Crown size={20} className="text-gold-400 absolute -top-3 left-1/2 -translate-x-1/2" />
                        )}
                        <UserAvatar
                          name={`${k.ad} ${k.soyad}`}
                          fotoUrl={k.foto_url}
                          size={48}
                          className="rounded-2xl"
                        />
                        <div className="text-center">
                          <p className={`text-sm font-semibold leading-tight ${isWinner ? 'text-gold-300' : isHighlighted ? 'text-blue-600' : ''}`} style={!isWinner && !isHighlighted ? { color: '#1A1A18' } : undefined}>
                            {k.ad}
                          </p>
                          <p className={`text-xs ${isWinner ? 'text-gold-400/70' : 'text-dark-400'}`}>
                            {k.soyad}
                          </p>
                        </div>
                        {isWinner && (
                          <div className="flex gap-1">
                            <Sparkles size={12} className="text-gold-400" />
                            <Sparkles size={12} className="text-gold-300" />
                            <Sparkles size={12} className="text-gold-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {winner && canDraw && (
                  <div className="flex justify-center mt-8">
                    <button onClick={resetDraw} className="btn-ghost">
                      Yeni Kura Çek
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* History */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-widest">Kura Geçmişi</h2>
                <div className="flex-1 h-px bg-dark-700" />
                <span className="text-xs text-dark-500">{gecmis.length} çekiliş</span>
                {canDraw && gecmis.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Geçmişi Temizle
                  </button>
                )}
              </div>

              {gecmis.length === 0 ? (
                <div className="text-center py-10 text-dark-600 text-sm">
                  <Dices size={32} className="mx-auto mb-2 opacity-30" />
                  Henüz kura çekilmedi.
                </div>
              ) : (
                <div className="space-y-2">
                  {gecmis.map(g => {
                    const isExpanded = expandedHistory === g.id;
                    const portfoy = portfoyler.find(p => p.id === g.portfoy_id);
                    return (
                      <div key={g.id} className="card overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
                          onClick={() => setExpandedHistory(isExpanded ? null : g.id)}
                        >
                          <div className="w-8 h-8 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center shrink-0">
                            <Trophy size={13} className="text-gold-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm" style={{ color: '#1A1A18' }}>{g.kazanan_ad}</span>
                              {g.aciklama && <span className="text-dark-400 text-xs truncate">— {g.aciklama}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-dark-500 text-xs">
                                {new Date(g.cekilis_tarihi).toLocaleDateString('tr-TR', {
                                  day: 'numeric', month: 'long', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                              <span className="text-dark-600 text-xs">
                                {Array.isArray(g.katilanlar) ? g.katilanlar.length : 0} katılımcı
                              </span>
                              {portfoy && (
                                <span className="flex items-center gap-1 text-xs text-dark-500">
                                  <Building2 size={10} />
                                  {portfoy.isim}
                                </span>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={15} className="text-dark-500 shrink-0" /> : <ChevronDown size={15} className="text-dark-500 shrink-0" />}
                        </button>

                        {isExpanded && Array.isArray(g.katilanlar) && (
                          <div className="px-4 pb-4 pt-1 border-t border-stone-200">
                            <p className="text-dark-500 text-xs mb-2 uppercase tracking-wide">Katılanlar:</p>
                            <div className="flex flex-wrap gap-2">
                              {g.katilanlar.map((k) => (
                                <span
                                  key={k.id || k.username}
                                  className={`text-xs px-2.5 py-1 rounded-full border ${
                                    k.username === g.kazanan_username
                                      ? 'bg-gold-400/15 text-gold-300 border-gold-400/30 font-semibold'
                                      : 'bg-dark-700 text-dark-300 border-dark-600'
                                  }`}
                                >
                                  {k.username === g.kazanan_username && '🏆 '}
                                  {k.ad}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showClearConfirm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowClearConfirm(false)}>
          <div className="modal-content max-w-sm w-full">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                <Dices size={22} className="text-red-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: '#1A1A18' }}>Geçmişi Temizle</h3>
              <p className="text-sm mb-6" style={{ color: '#8B7355' }}>Tüm kura çekiliş geçmişi silinecek. Bu işlem geri alınamaz.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowClearConfirm(false)} className="btn-ghost flex-1">İptal</button>
                <button
                  onClick={clearHistory}
                  disabled={clearingHistory}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                >
                  {clearingHistory ? 'Siliniyor...' : 'Evet, Temizle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes winnerGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(212,168,67,0.5); }
          50% { box-shadow: 0 0 50px rgba(212,168,67,0.8), 0 0 80px rgba(212,168,67,0.3); }
        }
      `}</style>
    </div>
  );
}
