import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Loader2, GripVertical, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Kullanici, Musteri } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import UserAvatar from '../components/UserAvatar';

type Oncelik = 'sicak' | 'yakin' | 'takip';

interface AktiviteKarti {
  id: string;
  danisman_username: string;
  musteri_id: string | null;
  musteri_ad: string | null;
  not_metni: string | null;
  oncelik: Oncelik;
  sira: number;
  son_aksiyon_tarihi: string | null;
  created_at: string;
}

const ONCELIK_CONFIG: Record<Oncelik, { label: string; color: string; bg: string; border: string; dot: string }> = {
  sicak:  { label: 'Sıcak (bu hafta)',   color: '#FF3B2F', bg: 'rgba(255,59,47,0.12)',   border: 'rgba(255,59,47,0.3)',   dot: '#FF3B2F' },
  yakin:  { label: 'Yakın (2 hafta)',     color: '#D4AF37', bg: 'rgba(212,175,55,0.12)',  border: 'rgba(212,175,55,0.3)',  dot: '#D4AF37' },
  takip:  { label: 'Takip',              color: '#534AB7', bg: 'rgba(83,74,183,0.1)',    border: 'rgba(83,74,183,0.25)',  dot: '#534AB7' },
};

export default function AktiviteTahtasi() {
  const { effectiveUser, user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.rol === 'admin' || user?.rol === 'yonetici';

  const [danismanlar, setDanismanlar] = useState<Kullanici[]>([]);
  const [kartlar, setKartlar] = useState<AktiviteKarti[]>([]);
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-card modal state
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [formMusteri, setFormMusteri] = useState('');
  const [formMusteriId, setFormMusteriId] = useState('');
  const [formNot, setFormNot] = useState('');
  const [formOncelik, setFormOncelik] = useState<Oncelik>('sicak');
  const [formTarih, setFormTarih] = useState('');
  const [saving, setSaving] = useState(false);
  const [musteriSearch, setMusteriSearch] = useState('');
  const [showMusteriDropdown, setShowMusteriDropdown] = useState(false);

  // Drag state
  const dragItem = useRef<{ id: string; danisman: string } | null>(null);
  const dragOver = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [danRes, kartRes, musRes] = await Promise.all([
      supabase.from('kullanicilar').select('*').not('rol', 'in', '("admin")').neq('username', 'superadmin').order('sira').order('ad'),
      supabase.from('aktivite_tahtasi').select('*').order('sira'),
      supabase.from('musteriler').select('id, ad, soyad, butce, danisman, last_contact').order('ad'),
    ]);
    setDanismanlar((danRes.data || []) as Kullanici[]);
    setKartlar((kartRes.data || []) as AktiviteKarti[]);
    setMusteriler((musRes.data || []) as Musteri[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('aktivite-tahtasi-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aktivite_tahtasi' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const canEdit = (danismanUsername: string) =>
    isAdmin || effectiveUser?.username === danismanUsername;

  const openAdd = (danismanUsername: string) => {
    setAddingFor(danismanUsername);
    setFormMusteri('');
    setFormMusteriId('');
    setFormNot('');
    setFormOncelik('sicak');
    setFormTarih('');
    setMusteriSearch('');
  };

  const doAdd = async () => {
    if (!addingFor) return;
    if (!formMusteri.trim() && !formMusteriId) { toast('Müşteri adı girin.', 'error'); return; }
    setSaving(true);
    const kartsForDan = kartlar.filter(k => k.danisman_username === addingFor);
    const payload = {
      danisman_username: addingFor,
      musteri_id: formMusteriId || null,
      musteri_ad: formMusteri || null,
      not_metni: formNot || null,
      oncelik: formOncelik,
      sira: kartsForDan.length,
      son_aksiyon_tarihi: formTarih || null,
    };
    const { error } = await supabase.from('aktivite_tahtasi').insert(payload);
    if (error) toast('Hata oluştu.', 'error'); else toast('Kart eklendi.');
    setSaving(false);
    setAddingFor(null);
    load();
  };

  const removeKart = async (id: string) => {
    await supabase.from('aktivite_tahtasi').delete().eq('id', id);
    toast('Kart kaldırıldı.');
    load();
  };

  const handleDragStart = (id: string, danisman: string) => {
    dragItem.current = { id, danisman };
  };

  const handleDrop = async (targetId: string, danisman: string) => {
    if (!dragItem.current || dragItem.current.danisman !== danisman) return;
    if (dragItem.current.id === targetId) return;

    const cols = kartlar.filter(k => k.danisman_username === danisman);
    const fromIdx = cols.findIndex(k => k.id === dragItem.current!.id);
    const toIdx = cols.findIndex(k => k.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...cols];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Optimistic update
    setKartlar(prev => {
      const others = prev.filter(k => k.danisman_username !== danisman);
      return [...others, ...reordered.map((k, i) => ({ ...k, sira: i }))];
    });

    // Persist
    await Promise.all(
      reordered.map((k, i) => supabase.from('aktivite_tahtasi').update({ sira: i }).eq('id', k.id))
    );
    dragItem.current = null;
    dragOver.current = null;
  };

  const filteredMusteriler = musteriler.filter(m => {
    if (!musteriSearch) return true;
    const q = musteriSearch.toLowerCase();
    return `${m.ad} ${m.soyad}`.toLowerCase().includes(q);
  }).slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: '#8B7355' }}>
        <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#FDF3E3' }}>
      {/* Header */}
      <div className="px-4 md:px-6 py-4 shrink-0 flex items-center justify-between"
        style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}>
        <div>
          <h1 className="text-base md:text-lg font-semibold" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>Aktivite Tahtası</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Her danışmanın öncelikli müşteri listesi</p>
        </div>
        <span className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: '#8B7355' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          Gerçek zamanlı
        </span>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6">
        <div className="flex gap-4 min-w-max pb-4">
          {danismanlar.map(dan => {
            const danKartlar = kartlar
              .filter(k => k.danisman_username === dan.username)
              .sort((a, b) => a.sira - b.sira);
            const canEditCol = canEdit(dan.username);
            const isSelf = effectiveUser?.username === dan.username;

            return (
              <div
                key={dan.username}
                className="w-72 shrink-0 flex flex-col rounded-2xl overflow-hidden"
                style={{ background: 'white', border: isSelf ? '1px solid #D4AF37' : '0.5px solid #F6D9A8' }}
              >
                {/* Column header */}
                <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: '0.5px solid #F6D9A8', background: '#1A1A18' }}>
                  <UserAvatar name={`${dan.ad} ${dan.soyad}`} fotoUrl={dan.foto_url} size={32} className="rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#F5F0E8' }}>{dan.ad} {dan.soyad}</p>
                    <p className="text-xs" style={{ color: '#8B7355' }}>{danKartlar.length} müşteri</p>
                  </div>
                  {isSelf && <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>sen</span>}
                  {canEditCol && (
                    <button
                      onClick={() => openAdd(dan.username)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]" style={{ background: '#FDF3E3' }}>
                  {danKartlar.length === 0 && (
                    <div className="text-center py-8 text-xs" style={{ color: '#8B7355' }}>
                      Henüz müşteri eklenmedi
                    </div>
                  )}
                  {danKartlar.map(kart => {
                    const onc = ONCELIK_CONFIG[kart.oncelik as Oncelik] || ONCELIK_CONFIG.takip;
                    const linkedMusteri = kart.musteri_id ? musteriler.find(m => m.id === kart.musteri_id) : null;
                    const displayName = linkedMusteri ? `${linkedMusteri.ad} ${linkedMusteri.soyad}` : (kart.musteri_ad || '—');

                    return (
                      <div
                        key={kart.id}
                        draggable={canEditCol}
                        onDragStart={() => handleDragStart(kart.id, dan.username)}
                        onDragOver={e => { e.preventDefault(); dragOver.current = kart.id; }}
                        onDrop={() => handleDrop(kart.id, dan.username)}
                        className="rounded-xl p-3 transition-all"
                        style={{
                          background: 'white',
                          border: `1px solid ${onc.border}`,
                          cursor: canEditCol ? 'grab' : 'default',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {canEditCol && (
                            <GripVertical size={14} className="shrink-0 mt-0.5" style={{ color: '#D4C9B8' }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: onc.bg, color: onc.color, border: `1px solid ${onc.border}` }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: onc.dot }} />
                                {onc.label}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate" style={{ color: '#1A1A18' }}>{displayName}</p>
                            {linkedMusteri?.butce && (
                              <p className="text-xs mt-0.5" style={{ color: '#D4AF37' }}>
                                Bütçe: {linkedMusteri.butce}
                              </p>
                            )}
                            {kart.not_metni && (
                              <p className="text-xs mt-1 line-clamp-2" style={{ color: '#8B7355' }}>
                                {kart.not_metni}
                              </p>
                            )}
                            {kart.son_aksiyon_tarihi && (
                              <p className="text-[10px] mt-1" style={{ color: '#8B7355' }}>
                                Son aksiyon: {new Date(kart.son_aksiyon_tarihi).toLocaleDateString('tr-TR')}
                              </p>
                            )}
                          </div>
                          {canEditCol && (
                            <button
                              onClick={() => removeKart(kart.id)}
                              className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-red-500/20"
                              style={{ color: 'rgba(255,59,47,0.4)' }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add card modal */}
      {addingFor && (
        <div className="modal-overlay" style={{ background: 'rgba(120,53,15,0.4)' }} onClick={e => e.target === e.currentTarget && setAddingFor(null)}>
          <div className="modal-content max-w-md" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Müşteri Ekle</h2>
              <button onClick={() => setAddingFor(null)} style={{ color: '#8B7355' }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Musteri search */}
              <div className="relative">
                <label className="label">Mevcut Müşteri Seç</label>
                <input
                  className="input"
                  placeholder="İsim ara..."
                  value={musteriSearch}
                  onChange={e => { setMusteriSearch(e.target.value); setShowMusteriDropdown(true); }}
                  onFocus={() => setShowMusteriDropdown(true)}
                />
                {showMusteriDropdown && filteredMusteriler.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden shadow-2xl"
                    style={{ background: 'white', border: '0.5px solid #F6D9A8' }}
                  >
                    {filteredMusteriler.map(m => (
                      <button
                        key={m.id}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                        style={{ color: '#1A1A18' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F5F0E8')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          setFormMusteriId(m.id);
                          setFormMusteri(`${m.ad} ${m.soyad}`);
                          setMusteriSearch(`${m.ad} ${m.soyad}`);
                          setShowMusteriDropdown(false);
                        }}
                      >
                        <span className="font-medium">{m.ad} {m.soyad}</span>
                        {m.butce && <span className="ml-2 text-xs" style={{ color: '#D4AF37' }}>{m.butce}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="label">veya Manuel Ad Gir</label>
                <input
                  className="input"
                  placeholder="Müşteri adı"
                  value={formMusteri}
                  onChange={e => { setFormMusteri(e.target.value); setFormMusteriId(''); }}
                />
              </div>

              <div>
                <label className="label">Öncelik</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(ONCELIK_CONFIG) as [Oncelik, typeof ONCELIK_CONFIG['sicak']][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormOncelik(key)}
                      className="py-2 rounded-xl text-xs font-semibold transition-all"
                      style={formOncelik === key
                        ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }
                        : { background: 'white', color: '#8B7355', border: '0.5px solid #F6D9A8' }
                      }
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Danışman Notu</label>
                <textarea
                  className="input h-20 resize-none"
                  placeholder="Bu müşteriyle ne zaman ne yapacaksın..."
                  value={formNot}
                  onChange={e => setFormNot(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Son Aksiyon Tarihi</label>
                <input type="date" className="input" value={formTarih} onChange={e => setFormTarih(e.target.value)} />
              </div>

              <div className="flex gap-3" style={{ paddingTop: '0.5rem', borderTop: '1px solid #F6D9A8' }}>
                <button onClick={() => setAddingFor(null)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button onClick={doAdd} disabled={saving} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={15} /> : 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
