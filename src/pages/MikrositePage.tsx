import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Portfoy } from '../types';
import { Heart, X, MessageSquare, MapPin, Home, Ruler, Building2, ChevronLeft, ChevronRight, Send, CheckCircle } from 'lucide-react';

interface MusteriLink {
  id: string;
  token: string;
  musteri_id: string | null;
  musteri_ad: string | null;
  portfoy_ids: string[];
  danisman_username: string | null;
  danisman_ad: string | null;
  expires_at: string | null;
}

interface Reaksiyon {
  portfoy_id: string;
  reaksiyon: 'begendim' | 'ilgilenmiyorum';
  yorum?: string;
}

interface Props {
  token: string;
}

function PortfoyKart({ portfoy, linkId, existingReaction }: { portfoy: Portfoy; linkId: string; existingReaction?: Reaksiyon }) {
  const [reaction, setReaction] = useState<Reaksiyon | null>(existingReaction ?? null);
  const [yorum, setYorum] = useState('');
  const [yorumSent, setYorumSent] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [sending, setSending] = useState(false);

  const photos = portfoy.fotograflar?.length ? portfoy.fotograflar : portfoy.kapak_foto ? [{ url: portfoy.kapak_foto, sira: 0 }] : [];
  const currentPhoto = photos[photoIdx]?.url;

  const sendReaction = async (r: 'begendim' | 'ilgilenmiyorum') => {
    if (reaction) return;
    setSending(true);
    const { data } = await supabase
      .from('musteri_reaksiyonlar')
      .insert({ link_id: linkId, portfoy_id: portfoy.id, reaksiyon: r })
      .select()
      .maybeSingle();
    if (data) setReaction({ portfoy_id: portfoy.id, reaksiyon: r });
    setSending(false);
  };

  const sendYorum = async () => {
    if (!yorum.trim() || yorumSent) return;
    setSending(true);
    await supabase.from('musteri_reaksiyonlar').insert({
      link_id: linkId,
      portfoy_id: portfoy.id,
      reaksiyon: reaction?.reaksiyon ?? 'yorum',
      yorum: yorum.trim(),
    });
    setYorumSent(true);
    setSending(false);
  };

  const fiyatDisplay = portfoy.fiyat
    ? `${Number(portfoy.fiyat).toLocaleString('tr-TR')} ${portfoy.para_birimi || 'TL'}`
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(40,24,10,0.95), rgba(26,15,8,0.98))', border: '1px solid rgba(200,128,75,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
    >
      {/* Photos */}
      {photos.length > 0 && (
        <div className="relative" style={{ height: 220 }}>
          <img
            src={currentPhoto}
            alt={portfoy.isim}
            className="w-full h-full object-cover"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                disabled={photoIdx === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                <ChevronLeft size={16} className="text-white" />
              </button>
              <button
                onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                disabled={photoIdx === photos.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
                <ChevronRight size={16} className="text-white" />
              </button>
              <div className="absolute bottom-2 right-3 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                {photoIdx + 1}/{photos.length}
              </div>
            </>
          )}
          {/* Reaction badge overlay */}
          {reaction && (
            <div
              className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={reaction.reaksiyon === 'begendim'
                ? { background: 'rgba(34,197,94,0.9)', color: '#fff' }
                : { background: 'rgba(239,68,68,0.9)', color: '#fff' }
              }
            >
              {reaction.reaksiyon === 'begendim' ? '❤️ Beğendim' : '❌ İlgilenmiyorum'}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-lg leading-snug" style={{ color: '#f5deb3' }}>{portfoy.isim}</h3>
          {fiyatDisplay && (
            <p className="text-xl font-bold mt-1" style={{ color: '#d4af37' }}>{fiyatDisplay}</p>
          )}
        </div>

        {/* Location */}
        {(portfoy.mahalle || portfoy.ilce || portfoy.bolge) && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(200,128,75,0.8)' }}>
            <MapPin size={14} />
            <span>{[portfoy.mahalle, portfoy.ilce, portfoy.il].filter(Boolean).join(', ') || portfoy.bolge}</span>
          </div>
        )}

        {/* Stats chips */}
        <div className="flex flex-wrap gap-2">
          {portfoy.tip && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(200,128,75,0.12)', color: '#c8804b', border: '1px solid rgba(200,128,75,0.2)' }}>
              <Building2 size={11} />{portfoy.tip}
            </span>
          )}
          {portfoy.oda && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(200,128,75,0.12)', color: '#c8804b', border: '1px solid rgba(200,128,75,0.2)' }}>
              <Home size={11} />{portfoy.oda} Oda
            </span>
          )}
          {portfoy.metrekare && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(200,128,75,0.12)', color: '#c8804b', border: '1px solid rgba(200,128,75,0.2)' }}>
              <Ruler size={11} />{portfoy.metrekare} m²
            </span>
          )}
          {portfoy.denize_yakin && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              Denize Yakın
            </span>
          )}
          {portfoy.deniz_manzarasi && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.2)' }}>
              Deniz Manzaralı
            </span>
          )}
        </div>

        {/* Reaction buttons */}
        {!reaction ? (
          <div className="flex gap-3">
            <button
              onClick={() => sendReaction('begendim')}
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <Heart size={16} />
              Beğendim
            </button>
            <button
              onClick={() => sendReaction('ilgilenmiyorum')}
              disabled={sending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <X size={16} />
              İlgilenmiyorum
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium"
            style={reaction.reaksiyon === 'begendim'
              ? { background: 'rgba(34,197,94,0.08)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
              : { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
            }
          >
            <CheckCircle size={15} />
            {reaction.reaksiyon === 'begendim' ? 'Bu portföyü beğendiniz' : 'Bu portföyü reddettiniz'}
          </div>
        )}

        {/* Comment */}
        {!yorumSent ? (
          <div className="space-y-2">
            <textarea
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,128,75,0.2)', color: '#f5deb3', '::placeholder': { color: 'rgba(200,128,75,0.4)' } } as React.CSSProperties}
              placeholder="Yorum veya soru ekleyin (isteğe bağlı)..."
              value={yorum}
              onChange={e => setYorum(e.target.value)}
            />
            {yorum.trim() && (
              <button
                onClick={sendYorum}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(200,128,75,0.12)', color: '#c8804b', border: '1px solid rgba(200,128,75,0.3)' }}
              >
                <Send size={14} />
                Yorum Gönder
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm" style={{ background: 'rgba(34,197,94,0.06)', color: '#4ade80' }}>
            <CheckCircle size={13} />
            Yorumunuz danışmana iletildi
          </div>
        )}
      </div>
    </div>
  );
}

export default function MikrositePage({ token }: Props) {
  const [link, setLink] = useState<MusteriLink | null>(null);
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: linkData } = await supabase
        .from('musteri_linkler')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!linkData) { setNotFound(true); setLoading(false); return; }
      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) { setExpired(true); setLoading(false); return; }

      const ids: string[] = Array.isArray(linkData.portfoy_ids) ? linkData.portfoy_ids : [];
      setLink({ ...linkData, portfoy_ids: ids });

      if (ids.length > 0) {
        const { data: pData } = await supabase
          .from('portfoyler')
          .select('*')
          .in('id', ids);
        // Keep original selection order
        const ordered = ids.map(id => (pData || []).find((p: Portfoy) => p.id === id)).filter(Boolean) as Portfoy[];
        setPortfoyler(ordered);
      }

      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1A0F08' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '2px solid rgba(200,128,75,0.2)', borderTopColor: '#c8804b' }} />
          <p className="text-sm" style={{ color: 'rgba(200,128,75,0.6)' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (notFound || expired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#1A0F08' }}>
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'rgba(200,128,75,0.1)', border: '1px solid rgba(200,128,75,0.25)' }}>
            <Building2 size={28} style={{ color: '#c8804b' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#f5deb3' }}>
            {expired ? 'Bağlantı Süresi Doldu' : 'Sayfa Bulunamadı'}
          </h1>
          <p className="text-sm" style={{ color: 'rgba(200,128,75,0.6)' }}>
            {expired ? 'Bu bağlantının geçerlilik süresi dolmuş. Danışmanınızdan yeni bir bağlantı isteyin.' : 'Bu bağlantı geçerli değil veya kaldırılmış.'}
          </p>
        </div>
      </div>
    );
  }

  if (!link) return null;

  return (
    <div className="min-h-screen" style={{ background: '#1A0F08' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 py-4"
        style={{ background: 'rgba(26,15,8,0.95)', borderBottom: '1px solid rgba(200,128,75,0.2)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #c8804b, #d4af37)', color: '#1A0F08' }}
          >
            D
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: '#f5deb3' }}>Derli Emlak</p>
            <p className="text-xs truncate" style={{ color: 'rgba(200,128,75,0.6)' }}>Özel Portföy Seçkisi</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(200,128,75,0.08), rgba(212,175,55,0.06))', border: '1px solid rgba(200,128,75,0.2)' }}
        >
          <h1 className="text-lg font-bold leading-snug" style={{ color: '#f5deb3' }}>
            Merhaba {link.musteri_ad || 'Değerli Müşterimiz'} 👋
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'rgba(200,128,75,0.75)' }}>
            Danışmanınız <strong style={{ color: '#c8804b' }}>{link.danisman_ad || 'Danışmanınız'}</strong> sizin için bu portföyleri özenle seçti.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: 'rgba(200,128,75,0.5)' }}>
            <span>{portfoyler.length} portföy</span>
            <span>·</span>
            <span>Her karta tepkinizi bildirin</span>
          </div>
        </div>

        {/* Portfolio cards */}
        {portfoyler.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'rgba(200,128,75,0.4)' }}>
            <Building2 size={36} className="mx-auto mb-3" />
            <p className="text-sm">Henüz portföy eklenmemiş.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {portfoyler.map(p => (
              <PortfoyKart key={p.id} portfoy={p} linkId={link.id} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="rounded-2xl p-5 text-center space-y-2"
          style={{ background: 'rgba(200,128,75,0.04)', border: '1px solid rgba(200,128,75,0.12)' }}
        >
          <p className="text-sm font-medium" style={{ color: '#d4af37' }}>İletişim için danışmanınıza ulaşın</p>
          <p className="text-xs" style={{ color: 'rgba(200,128,75,0.5)' }}>
            Tepkileriniz danışmanınıza anlık olarak iletilmektedir.
          </p>
          <p className="text-xs mt-3" style={{ color: 'rgba(200,128,75,0.3)' }}>
            Derli Emlak &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
