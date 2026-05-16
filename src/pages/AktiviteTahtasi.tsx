import { useState, useEffect } from 'react';
import { Activity, Users, Building2, Calendar, CheckSquare, TrendingUp, Award, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { displayPrice } from '../components/PriceInput';

interface StaffStats {
  id: string;
  ad: string;
  soyad: string;
  rol: string;
  foto_url?: string;
  musteri_count: number;
  portfoy_count: number;
  randevu_count: number;
  gorev_count: number;
  kapanan_count: number;
  puan: number;
}

interface RecentEvent {
  id: string;
  type: 'musteri' | 'portfoy' | 'randevu' | 'gorev';
  title: string;
  user: string;
  time: string;
  color: string;
}

export default function AktiviteTahtasi() {
  const { user } = useAuth();
  const [staffStats, setStaffStats] = useState<StaffStats[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  const load = async () => {
    setLoading(true);
    const now = new Date();
    let since = new Date(0).toISOString();
    if (period === 'week') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (period === 'month') since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: users }, { data: musteriler }, { data: portfoyler }, { data: randevular }, { data: gorevler }] = await Promise.all([
      supabase.from('kullanicilar').select('id,ad,soyad,rol,foto_url'),
      supabase.from('musteriler').select('id,ad,soyad,created_at,danismanid,durum').gte('created_at', since),
      supabase.from('portfoyler').select('id,isim,created_at,danismanid').gte('created_at', since),
      supabase.from('randevular').select('id,konu,created_at,danismanid').gte('created_at', since),
      supabase.from('gorevler').select('id,baslik,created_at,atanan_id,durum').gte('created_at', since),
    ]);

    const stats = (users || []).map(u => {
      const mc = (musteriler || []).filter(m => m.danismanid === u.id).length;
      const pc = (portfoyler || []).filter(p => p.danismanid === u.id).length;
      const rc = (randevular || []).filter(r => r.danismanid === u.id).length;
      const gc = (gorevler || []).filter(g => g.atanan_id === u.id && g.durum === 'tamamlandi').length;
      const kc = (musteriler || []).filter(m => m.danismanid === u.id && m.durum === 'kapandi').length;
      return { ...u, musteri_count: mc, portfoy_count: pc, randevu_count: rc, gorev_count: gc, kapanan_count: kc, puan: mc * 5 + pc * 10 + rc * 8 + gc * 6 + kc * 50 };
    }).sort((a, b) => b.puan - a.puan);

    setStaffStats(stats);

    const events: RecentEvent[] = [
      ...(musteriler || []).slice(0, 5).map(m => ({ id: m.id, type: 'musteri' as const, title: `Yeni müşteri: ${m.ad} ${m.soyad}`, user: (users || []).find(u => u.id === m.danismanid)?.ad || 'Sistem', time: m.created_at, color: '#2563EB' })),
      ...(portfoyler || []).slice(0, 5).map(p => ({ id: p.id, type: 'portfoy' as const, title: `Yeni portföy: ${p.isim}`, user: (users || []).find(u => u.id === p.danismanid)?.ad || 'Sistem', time: p.created_at, color: '#059669' })),
      ...(randevular || []).slice(0, 5).map(r => ({ id: r.id, type: 'randevu' as const, title: `Randevu: ${r.konu}`, user: (users || []).find(u => u.id === r.danismanid)?.ad || 'Sistem', time: r.created_at, color: '#D97706' })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);

    setRecentEvents(events);
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  const PERIOD_LABELS = { week: 'Bu Hafta', month: 'Bu Ay', all: 'Tüm Zamanlar' };

  const RANK_BADGES = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Aktivite Tahtası</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>Ekip performansı ve son aktiviteler</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: '#F5F0E8', borderRadius: 8, overflow: 'hidden' }}>
            {(['week', 'month', 'all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '7px 14px', border: 'none', background: period === p ? '#1A1A18' : 'transparent', color: period === p ? '#fff' : '#8B7355', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Leaderboard */}
          <div>
            <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={16} color="#D4AF37" />
                <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Sıralama — {PERIOD_LABELS[period]}</h3>
              </div>
              {staffStats.map((s, i) => (
                <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid #FAF6EF', display: 'flex', alignItems: 'center', gap: 14, background: s.id === user?.id ? '#FFFBEB' : '#fff' }}>
                  <div style={{ width: 28, textAlign: 'center', fontSize: 18 }}>{RANK_BADGES[i] || <span style={{ fontSize: 13, fontWeight: 700, color: '#8B7355' }}>#{i + 1}</span>}</div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0E8D8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {s.foto_url ? <img src={s.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 700, fontSize: 13, color: '#8B7355' }}>{s.ad[0]}{s.soyad[0]}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18' }}>{s.ad} {s.soyad}</span>
                      <span style={{ fontWeight: 900, fontSize: 16, color: '#D4AF37' }}>{s.puan} puan</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#8B7355' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10} /> {s.musteri_count} müşteri</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Building2 size={10} /> {s.portfoy_count} portföy</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} /> {s.randevu_count} randevu</span>
                      {s.kapanan_count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#059669', fontWeight: 700 }}><TrendingUp size={10} /> {s.kapanan_count} kapandı</span>}
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: 6, height: 4, background: '#F0E8D8', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg, #D4AF37, #B8962E)', width: `${Math.min(100, (s.puan / (staffStats[0]?.puan || 1)) * 100)}%`, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              ))}
              {staffStats.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#8B7355', fontSize: 13 }}>Veri bulunamadı</div>}
            </div>
          </div>

          {/* Recent events */}
          <div>
            <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="#D4AF37" />
                <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 15 }}>Son Aktiviteler</h3>
              </div>
              <div style={{ padding: '8px 0' }}>
                {recentEvents.map((ev, i) => (
                  <div key={`${ev.id}-${i}`} style={{ padding: '10px 20px', borderBottom: '1px solid #FAF6EF', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                      <p style={{ fontSize: 11, color: '#8B7355' }}>{ev.user} · {new Date(ev.time).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                ))}
                {recentEvents.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#8B7355', fontSize: 13 }}>Aktivite yok</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
