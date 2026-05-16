import { useState, useEffect, useRef } from 'react';
import { Shuffle, Plus, X, Trophy, RefreshCw, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Katilimci {
  id: string;
  ad: string;
}

export default function KuraCekilisi() {
  const [katilimcilar, setKatilimcilar] = useState<Katilimci[]>([]);
  const [yeniAd, setYeniAd] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [kazanan, setKazanan] = useState<Katilimci | null>(null);
  const [gecmis, setGecmis] = useState<{ winner: string; date: string; participants: number }[]>([]);
  const [animText, setAnimText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addKatilimci = () => {
    const ad = yeniAd.trim();
    if (!ad) return;
    if (katilimcilar.some(k => k.ad.toLowerCase() === ad.toLowerCase())) return;
    setKatilimcilar(prev => [...prev, { id: Date.now().toString(), ad }]);
    setYeniAd('');
  };

  const removeKatilimci = (id: string) => setKatilimcilar(prev => prev.filter(k => k.id !== id));

  const startDraw = () => {
    if (katilimcilar.length < 2) return;
    setKazanan(null);
    setSpinning(true);

    let counter = 0;
    const totalTicks = 30 + Math.floor(Math.random() * 20);
    intervalRef.current = setInterval(() => {
      const rand = katilimcilar[Math.floor(Math.random() * katilimcilar.length)];
      setAnimText(rand.ad);
      counter++;
      if (counter >= totalTicks) {
        clearInterval(intervalRef.current!);
        const winner = katilimcilar[Math.floor(Math.random() * katilimcilar.length)];
        setKazanan(winner);
        setAnimText(winner.ad);
        setSpinning(false);
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, colors: ['#D4AF37', '#1A1A18', '#F5F0E8', '#B8962E'] });
        setGecmis(prev => [{ winner: winner.ad, date: new Date().toLocaleString('tr-TR'), participants: katilimcilar.length }, ...prev.slice(0, 9)]);
      }
    }, 80 + counter * 2);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const reset = () => { setKazanan(null); setAnimText(''); };

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Kura Çekilişi</h1>
        <p style={{ color: '#8B7355', fontSize: 13 }}>Müşteri veya danışman kura çekilişi yapın</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left - participants */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14, marginBottom: 14 }}>
              Katılımcılar ({katilimcilar.length})
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={yeniAd}
                onChange={e => setYeniAd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKatilimci()}
                className="input"
                placeholder="Katılımcı adı..."
                style={{ flex: 1 }}
              />
              <button onClick={addKatilimci} className="btn-gold" style={{ padding: '9px 14px' }}><Plus size={14} /></button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {katilimcilar.map((k, i) => (
                <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#FAF6EF', borderRadius: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#D4AF37', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{k.ad}</span>
                  <button onClick={() => removeKatilimci(k.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={12} color="#8B7355" /></button>
                </div>
              ))}
              {katilimcilar.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#C4B5A5', fontSize: 12 }}>Katılımcı eklenmedi</div>
              )}
            </div>
            {katilimcilar.length > 0 && (
              <button onClick={() => setKatilimcilar([])} style={{ marginTop: 10, width: '100%', padding: 7, background: 'none', border: '1px solid #F0E8D8', borderRadius: 8, color: '#8B7355', cursor: 'pointer', fontSize: 12 }}>
                Listeyi Temizle
              </button>
            )}
          </div>
        </div>

        {/* Right - draw */}
        <div>
          <div style={{ background: '#1A1A18', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 16 }}>
            {/* Drum */}
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(212,175,55,0.1)', border: '3px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', transition: 'transform 0.1s' }}>
              {spinning ? (
                <span style={{ fontSize: 13, fontWeight: 900, color: '#D4AF37', padding: '0 12px', wordBreak: 'break-word', textAlign: 'center', lineHeight: 1.3 }}>{animText}</span>
              ) : kazanan ? (
                <div>
                  <Trophy size={28} color="#D4AF37" style={{ margin: '0 auto 4px' }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#D4AF37', display: 'block' }}>{kazanan.ad}</span>
                </div>
              ) : (
                <Shuffle size={36} color="#D4AF37" />
              )}
            </div>

            {kazanan && !spinning && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(212,175,55,0.1)', borderRadius: 8, border: '1px solid rgba(212,175,55,0.3)' }}>
                <Trophy size={16} color="#D4AF37" style={{ margin: '0 auto 4px', display: 'block' }} />
                <p style={{ color: '#F5F0E8', fontWeight: 900, fontSize: 18 }}>{kazanan.ad}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Kazanan!</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={startDraw}
                disabled={spinning || katilimcilar.length < 2}
                style={{ flex: 1, padding: '11px', borderRadius: 10, background: katilimcilar.length >= 2 ? '#D4AF37' : 'rgba(212,175,55,0.3)', border: 'none', color: '#1A1A18', fontWeight: 700, cursor: katilimcilar.length >= 2 ? 'pointer' : 'default', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {spinning ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
                {spinning ? 'Çekiliyor...' : 'Kura Çek'}
              </button>
              {kazanan && <button onClick={reset} style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer' }}><RefreshCw size={16} /></button>}
            </div>
            {katilimcilar.length < 2 && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>En az 2 katılımcı ekleyin</p>}
          </div>

          {/* History */}
          {gecmis.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0E8D8' }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#8B7355' }}>Geçmiş Çekilişler</h4>
              </div>
              {gecmis.map((g, i) => (
                <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid #FAF6EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Trophy size={12} color="#D4AF37" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18' }}>{g.winner}</span>
                    <span style={{ fontSize: 11, color: '#8B7355' }}>({g.participants} kişi)</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#C4B5A5' }}>{g.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
