import { useState, useEffect } from 'react';
import { Home, Users, Building2, Calendar, CheckSquare, TrendingUp, Bell, Star, Clock, ChevronRight, RefreshCw, Sparkles, X, MapPin, Maximize, Bed, Check, Loader2, TrendingDown, Handshake } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { displayPrice } from '../components/PriceInput';
import { callClaude } from '../lib/claude';
import type { Page } from '../App';
import type { Musteri, Portfoy } from '../types';

interface Props {
  onNavigate: (page: Page) => void;
}

interface Stats {
  totalCustomers: number;
  activePortfolios: number;
  todayAppointments: number;
  pendingTasks: number;
  hotCustomers: number;
  closedDeals: number;
}

interface RecentActivity {
  id: string;
  type: 'customer' | 'portfolio' | 'appointment' | 'task';
  title: string;
  subtitle: string;
  time: string;
}

interface AiMatch {
  musteri: Musteri;
  portfoy: Portfoy;
  score: number;
  reason: string;
}

export default function Anasayfa({ onNavigate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ totalCustomers: 0, activePortfolios: 0, todayAppointments: 0, pendingTasks: 0, hotCustomers: 0, closedDeals: 0 });
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiMatches, setAiMatches] = useState<AiMatch[]>([]);
  const [aiMatchLoading, setAiMatchLoading] = useState(false);
  const [detailMatch, setDetailMatch] = useState<AiMatch | null>(null);
  const [savingMatch, setSavingMatch] = useState<string | null>(null);
  const [piyasaYorum, setPiyasaYorum] = useState('');
  const [piyasaLoading, setPiyasaLoading] = useState(false);
  const [showBrifing, setShowBrifing] = useState(false);
  const [brifingLoading, setBrifingLoading] = useState(false);
  const [brifingContent, setBrifingContent] = useState('');
  const [pazarlikLoading, setPazarlikLoading] = useState<number | null>(null);
  const [pazarlikSonuc, setPazarlikSonuc] = useState<Record<number, string>>({});
  const today = new Date().toISOString().split('T')[0];

  const loadPiyasaYorum = async () => {
    const cacheKey = `piyasa_yorum_${new Date().toDateString()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setPiyasaYorum(cached); return; }
    setPiyasaLoading(true);
    try {
      const text = await callClaude(
        `Çeşme / İzmir Yarımadası konut piyasası hakkında bugünlük kısa bir yorum yaz. Genel trend, yabancı talep, fiyat beklentisi. 2-3 cümle, profesyonel, gerçekçi.`,
        250,
        'Sen deneyimli bir Türk gayrimenkul piyasa analistissin. Kısa, net ve olgusal yorumlar yapıyorsun.'
      );
      setPiyasaYorum(text.trim());
      localStorage.setItem(cacheKey, text.trim());
    } catch {
      setPiyasaYorum('');
    }
    setPiyasaLoading(false);
  };

  const loadBrifing = async () => {
    setBrifingLoading(true);
    const [{ data: musteriler }, { data: portfoyler }, { data: gorevler }] = await Promise.all([
      supabase.from('musteriler').select('ad,soyad,durum').in('durum', ['sicak', 'satin_alacak']).limit(10),
      supabase.from('portfoyler').select('isim,fiyat,para_birimi').eq('portfoy_durum', 'aktif').limit(10),
      supabase.from('gorevler').select('baslik,oncelik').eq('durum', 'bekliyor').limit(10),
    ]);
    try {
      const text = await callClaude(
        `Bu haftanın gayrimenkul ekibi için Türkçe haftalık brifing hazırla.

Sıcak müşteriler: ${musteriler?.map(m => `${m.ad} ${m.soyad} (${m.durum})`).join(', ') || 'yok'}
Aktif portföyler: ${portfoyler?.map(p => `${p.isim}`).join(', ') || 'yok'}
Bekleyen görevler: ${gorevler?.map(g => `${g.baslik} (${g.oncelik})`).join(', ') || 'yok'}

Haftalık öncelikler, odaklanılacak müşteriler ve bu haftanın hedefleri. 3-4 madde halinde.`,
        500,
        'Sen bir gayrimenkul ofisi yöneticisisin. Motivasyon verici ve pratik haftalık brifingler hazırlıyorsun.'
      );
      setBrifingContent(text.trim());
    } catch {
      setBrifingContent('Brifing oluşturulamadı.');
    }
    setBrifingLoading(false);
  };

  const pazarlikAsistani = async (match: AiMatch, idx: number) => {
    setPazarlikLoading(idx);
    try {
      const text = await callClaude(
        `Bir Türk gayrimenkul danışmanı olarak, aşağıdaki eşleştirme için pazarlık stratejisi öner:

Müşteri: ${match.musteri.ad} ${match.musteri.soyad}
Müşteri bütçe aralığı: ${match.musteri.butce_min || '?'} - ${match.musteri.butce_max || '?'} ${match.musteri.para_birimi || 'TL'}
Müşteri istekleri: ${match.musteri.kesin_istekler || 'belirtilmemiş'}

Portföy: ${match.portfoy.isim}
Portföy fiyatı: ${match.portfoy.fiyat} ${match.portfoy.para_birimi || 'TL'}
Portföy özellikleri: ${[match.portfoy.tip, match.portfoy.oda ? match.portfoy.oda + ' oda' : '', match.portfoy.metrekare ? match.portfoy.metrekare + 'm²' : ''].filter(Boolean).join(', ')}

Somut pazarlık önerileri, açılış teklifi ve kabul edilebilir minimum fiyat tahmini. 3-4 cümle.`,
        400,
        'Sen deneyimli bir Türk gayrimenkul müzakere uzmanısın. Pratik, gerçekçi pazarlık tavsiyeleri veriyorsun.'
      );
      setPazarlikSonuc(prev => ({ ...prev, [idx]: text.trim() }));
    } catch (e: any) {
      toast(e.message, 'error');
    }
    setPazarlikLoading(null);
  };

  const load = async () => {
    setLoading(true);
    const [
      { count: customers },
      { count: portfolios },
      { count: todayAppt },
      { count: tasks },
      { count: hotCustomers },
      { count: closedDeals },
      { data: recentCustomers },
      { data: recentPortfolios },
    ] = await Promise.all([
      supabase.from('musteriler').select('*', { count: 'exact', head: true }),
      supabase.from('portfoyler').select('*', { count: 'exact', head: true }).eq('portfoy_durum', 'aktif'),
      supabase.from('randevular').select('*', { count: 'exact', head: true }).eq('tarih', today).eq('durum', 'bekliyor'),
      supabase.from('gorevler').select('*', { count: 'exact', head: true }).eq('durum', 'bekliyor'),
      supabase.from('musteriler').select('*', { count: 'exact', head: true }).eq('durum', 'sicak'),
      supabase.from('musteriler').select('*', { count: 'exact', head: true }).eq('durum', 'kapandi'),
      supabase.from('musteriler').select('id,ad,soyad,created_at').order('created_at', { ascending: false }).limit(3),
      supabase.from('portfoyler').select('id,isim,created_at,fiyat,para_birimi').order('created_at', { ascending: false }).limit(3),
    ]);

    setStats({
      totalCustomers: customers || 0,
      activePortfolios: portfolios || 0,
      todayAppointments: todayAppt || 0,
      pendingTasks: tasks || 0,
      hotCustomers: hotCustomers || 0,
      closedDeals: closedDeals || 0,
    });

    const activities: RecentActivity[] = [];
    (recentCustomers || []).forEach(c => {
      activities.push({ id: c.id, type: 'customer', title: `${c.ad} ${c.soyad}`, subtitle: 'Yeni müşteri', time: new Date(c.created_at).toLocaleDateString('tr-TR') });
    });
    (recentPortfolios || []).forEach(p => {
      activities.push({ id: p.id, type: 'portfolio', title: p.isim, subtitle: displayPrice(p.fiyat, p.para_birimi), time: new Date(p.created_at).toLocaleDateString('tr-TR') });
    });
    activities.sort((a, b) => b.time.localeCompare(a.time));
    setRecent(activities.slice(0, 5));
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadPiyasaYorum();
    // Show Monday briefing once per week
    const now = new Date();
    if (now.getDay() === 1) {
      const lastBrifing = localStorage.getItem('last_briefing');
      const thisMonday = now.toDateString();
      if (lastBrifing !== thisMonday) {
        localStorage.setItem('last_briefing', thisMonday);
        setShowBrifing(true);
        loadBrifing();
      }
    }
  }, []);

  const runAiMatching = async () => {
    setAiMatchLoading(true);
    const [{ data: musteriler }, { data: portfoyler }] = await Promise.all([
      supabase.from('musteriler').select('*').in('durum', ['sicak', 'satin_alacak', 'dusunuyor']).limit(20),
      supabase.from('portfoyler').select('*').eq('portfoy_durum', 'aktif').limit(20),
    ]);
    if (!musteriler?.length || !portfoyler?.length) { toast('Yeterli veri yok.', 'error'); setAiMatchLoading(false); return; }
    const prompt = `Sen bir Türk gayrimenkul uzmanısın. Aşağıdaki müşterileri ve portföyleri analiz et, en uyumlu 3 eşleştirmeyi JSON formatında döndür.

Müşteriler: ${JSON.stringify(musteriler.slice(0, 10).map(m => ({ id: m.id, ad: `${m.ad} ${m.soyad}`, butce_min: m.butce_min, butce_max: m.butce_max, muhit: m.muhit, istekler: m.kesin_istekler, aciklama: m.aciklama })))}

Portföyler: ${JSON.stringify(portfoyler.slice(0, 10).map(p => ({ id: p.id, isim: p.isim, fiyat: p.fiyat, bolge: p.bolge, tip: p.tip, oda: p.oda, metrekare: p.metrekare })))}

Sadece JSON döndür, başka hiçbir şey yazma:
[{"musteri_id":"...","portfoy_id":"...","score":85,"reason":"kısa açıklama"},...]`;
    try {
      const raw = await callClaude(prompt, 500);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('no json');
      const parsed: { musteri_id: string; portfoy_id: string; score: number; reason: string }[] = JSON.parse(jsonMatch[0]);
      const matches: AiMatch[] = parsed.slice(0, 3).map(item => ({
        musteri: musteriler.find(m => m.id === item.musteri_id)!,
        portfoy: portfoyler.find(p => p.id === item.portfoy_id)!,
        score: item.score,
        reason: item.reason,
      })).filter(m => m.musteri && m.portfoy);
      setAiMatches(matches);
    } catch {
      toast('AI analizi yapılamadı.', 'error');
    }
    setAiMatchLoading(false);
  };

  const saveMatch = async (match: AiMatch) => {
    setSavingMatch(match.musteri.id + match.portfoy.id);
    const { error } = await supabase.from('eslestirme_gecmisi').insert({
      musteri_id: match.musteri.id,
      portfoy_id: match.portfoy.id,
      musteri_ad: `${match.musteri.ad} ${match.musteri.soyad}`,
      portfoy_baslik: match.portfoy.isim,
      gosterildi_tarihi: new Date().toISOString(),
      sonuc: 'bekliyor',
      notlar: match.reason,
      danisman: user?.username,
    });
    if (error) toast(error.message, 'error');
    else toast('Eşleştirme kaydedildi!', 'success');
    setSavingMatch(null);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 17 ? 'İyi günler' : 'İyi akşamlar';

  const statCards = [
    { label: 'Toplam Müşteri', value: stats.totalCustomers, icon: Users, color: '#2563EB', page: 'customers' as Page },
    { label: 'Aktif Portföy', value: stats.activePortfolios, icon: Building2, color: '#059669', page: 'portfolio' as Page },
    { label: 'Bugünkü Randevu', value: stats.todayAppointments, icon: Calendar, color: '#D97706', page: 'appointments' as Page },
    { label: 'Bekleyen Görev', value: stats.pendingTasks, icon: CheckSquare, color: '#DC2626', page: 'gorevler' as Page },
    { label: 'Sıcak Müşteri', value: stats.hotCustomers, icon: TrendingUp, color: '#D4AF37', page: 'customers' as Page },
    { label: 'Kapanan Satış', value: stats.closedDeals, icon: Star, color: '#7C3AED', page: 'customers' as Page },
  ];

  const activityIcon: Record<string, React.ReactNode> = {
    customer: <Users size={14} color="#2563EB" />,
    portfolio: <Building2 size={14} color="#059669" />,
    appointment: <Calendar size={14} color="#D97706" />,
    task: <CheckSquare size={14} color="#DC2626" />,
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1A1A18', marginBottom: 4 }}>
            {greeting}, {user?.ad || 'Kullanıcı'}
          </h1>
          <p style={{ color: '#8B7355', fontSize: 14 }}>
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Quick alerts */}
      {(stats.todayAppointments > 0 || stats.pendingTasks > 0) && (
        <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {stats.todayAppointments > 0 && (
            <div
              onClick={() => onNavigate('appointments')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FFF8E1', border: '1px solid #D97706', borderRadius: 10 }}
            >
              <Bell size={16} color="#D97706" />
              <span style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>
                Bugün {stats.todayAppointments} randevunuz var
              </span>
              <ChevronRight size={14} color="#D97706" />
            </div>
          )}
          {stats.pendingTasks > 0 && (
            <div
              onClick={() => onNavigate('gorevler')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#FFF0EE', border: '1px solid #DC2626', borderRadius: 10 }}
            >
              <CheckSquare size={16} color="#DC2626" />
              <span style={{ fontSize: 13, color: '#991B1B', fontWeight: 600 }}>
                {stats.pendingTasks} bekleyen göreviniz var
              </span>
              <ChevronRight size={14} color="#DC2626" />
            </div>
          )}
        </div>
      )}

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCards.map(card => (
          <div
            key={card.label}
            onClick={() => onNavigate(card.page)}
            style={{
              cursor: 'pointer',
              background: '#fff',
              border: '1px solid #F0E8D8',
              borderRadius: 12,
              padding: '20px 16px',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: card.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <card.icon size={18} color={card.color} />
              </div>
              <ChevronRight size={14} color="#C4B5A5" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#1A1A18', lineHeight: 1 }}>{loading ? '—' : card.value}</div>
            <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Piyasa Yorumcusu */}
      {(piyasaYorum || piyasaLoading) && (
        <div style={{ marginBottom: 24, background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={18} color="#2563EB" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18' }}>Piyasa Yorumcusu</span>
              <span style={{ fontSize: 10, color: '#8B7355', background: '#FAF6EF', padding: '1px 6px', borderRadius: 4 }}>Bugün • AI</span>
            </div>
            {piyasaLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8B7355', fontSize: 12 }}>
                <Loader2 size={12} className="animate-spin" /> Piyasa analizi yükleniyor...
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#5A4A3A', lineHeight: 1.6 }}>{piyasaYorum}</p>
            )}
          </div>
          <button onClick={loadPiyasaYorum} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4B5A5', padding: 4 }} title="Yenile">
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* Recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14 }}>Son Aktiviteler</h3>
            <Clock size={14} color="#8B7355" />
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#8B7355', fontSize: 13 }}>Henüz aktivite yok</div>
          ) : (
            <div>
              {recent.map(item => (
                <div key={item.id} style={{ padding: '12px 20px', borderBottom: '1px solid #FAF6EF', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FAF6EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {activityIcon[item.type]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>{item.subtitle}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#C4B5A5', flexShrink: 0 }}>{item.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8' }}>
            <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14 }}>Hızlı Erişim</h3>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Müşteriler', icon: Users, page: 'customers' as Page, color: '#2563EB' },
              { label: 'Portföyler', icon: Building2, page: 'portfolio' as Page, color: '#059669' },
              { label: 'Randevular', icon: Calendar, page: 'appointments' as Page, color: '#D97706' },
              { label: 'Görevler', icon: CheckSquare, page: 'gorevler' as Page, color: '#DC2626' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.page)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: '#FAF6EF', border: 'none', borderRadius: 8, cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F5EDD8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FAF6EF')}
              >
                <div style={{ width: 30, height: 30, borderRadius: 6, background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon size={15} color={item.color} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{item.label}</span>
                <ChevronRight size={14} color="#C4B5A5" style={{ marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Smart Matching */}
      <div style={{ marginTop: 32, background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14 }}>AI Akilli Eslestirme</h3>
            <p style={{ fontSize: 12, color: '#8B7355' }}>Musteri-portfoy uyum analizi</p>
          </div>
          <button onClick={runAiMatching} className="btn-gold" disabled={aiMatchLoading} style={{ fontSize: 12 }}>
            {aiMatchLoading ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #D4AF37', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Analiz ediliyor...</> : <><Sparkles size={13} /> Analiz Et</>}
          </button>
        </div>
        {aiMatches.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#8B7355' }}>
            <Sparkles size={32} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13 }}>"Analiz Et" butonuna basarak AI destekli eslestirme yapın</p>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {aiMatches.map((match, i) => (
              <div key={i} style={{ border: '1px solid #F0E8D8', borderRadius: 10, padding: 14, background: '#FAF6EF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 2 }}>Musteri</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18' }}>{match.musteri.ad} {match.musteri.soyad}</div>
                      <div style={{ fontSize: 11, color: '#8B7355' }}>{match.musteri.muhit || match.musteri.aciklama?.slice(0, 40)}</div>
                    </div>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' }}>
                      <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{match.score}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 2 }}>Portfoy</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.portfoy.isim}</div>
                      <div style={{ fontSize: 11, color: '#8B7355' }}>{displayPrice(match.portfoy.fiyat, match.portfoy.para_birimi)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#5A4A3A', padding: '6px 10px', background: '#fff', borderRadius: 6, marginBottom: 10, border: '1px solid #F0E8D8' }}>{match.reason}</div>
                {pazarlikSonuc[i] && (
                  <div style={{ fontSize: 12, color: '#1E40AF', padding: '8px 10px', background: '#EFF6FF', borderRadius: 6, marginBottom: 10, border: '1px solid #BFDBFE', lineHeight: 1.6 }}>
                    <strong>Pazarlık Stratejisi:</strong> {pazarlikSonuc[i]}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setDetailMatch(match)} className="btn-ghost" style={{ fontSize: 12, flex: 1, justifyContent: 'center' }}>Detay Gor</button>
                  <button
                    onClick={() => pazarlikAsistani(match, i)}
                    disabled={pazarlikLoading === i}
                    className="btn-ghost"
                    style={{ fontSize: 12, flex: 1, justifyContent: 'center', borderColor: '#2563EB', color: '#2563EB' }}
                  >
                    {pazarlikLoading === i ? <Loader2 size={12} className="animate-spin" /> : <Handshake size={12} />}
                    Pazarlik
                  </button>
                  <button
                    onClick={() => saveMatch(match)}
                    disabled={savingMatch === match.musteri.id + match.portfoy.id}
                    className="btn-gold"
                    style={{ fontSize: 12, flex: 1, justifyContent: 'center' }}
                  >
                    <Check size={12} /> Eslestir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail side-by-side modal */}
      {detailMatch && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailMatch(null)}>
          <div className="modal-content" style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F0E8D8' }}>
              <h2 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 16 }}>Eslestirme Detayi</h2>
              <button onClick={() => setDetailMatch(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {/* Musteri side */}
              <div style={{ padding: 20, borderRight: '1px solid #F0E8D8' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Musteri</div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A18', marginBottom: 4 }}>{detailMatch.musteri.ad} {detailMatch.musteri.soyad}</h3>
                <p style={{ fontSize: 12, color: '#8B7355', marginBottom: 16 }}>{detailMatch.musteri.durum}</p>
                {[
                  ['Telefon', detailMatch.musteri.telefon],
                  ['Butce Min', detailMatch.musteri.butce_min ? displayPrice(detailMatch.musteri.butce_min, detailMatch.musteri.para_birimi || 'TL') : null],
                  ['Butce Max', detailMatch.musteri.butce_max ? displayPrice(detailMatch.musteri.butce_max, detailMatch.musteri.para_birimi || 'TL') : null],
                  ['Bolge', detailMatch.musteri.muhit],
                  ['Istekler', detailMatch.musteri.kesin_istekler],
                  ['Notlar', detailMatch.musteri.notlar],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>{k}</div>
                    <div style={{ fontSize: 13, color: '#1A1A18', fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Portfoy side */}
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Portfoy</div>
                {detailMatch.portfoy.foto_url?.[0] && (
                  <img src={detailMatch.portfoy.foto_url[0]} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />
                )}
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A18', marginBottom: 4 }}>{detailMatch.portfoy.isim}</h3>
                <p style={{ fontSize: 14, color: '#D4AF37', fontWeight: 700, marginBottom: 12 }}>{displayPrice(detailMatch.portfoy.fiyat, detailMatch.portfoy.para_birimi)}</p>
                {[
                  ['Bolge', [detailMatch.portfoy.mahalle, detailMatch.portfoy.bolge].filter(Boolean).join(', ')],
                  ['Tip', detailMatch.portfoy.tip],
                  ['Oda', detailMatch.portfoy.oda],
                  ['m²', detailMatch.portfoy.metrekare ? `${detailMatch.portfoy.metrekare} m²` : null],
                  ['Kat', detailMatch.portfoy.kat],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k as string} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>{k}</div>
                    <div style={{ fontSize: 13, color: '#1A1A18', fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F0E8D8', background: '#FAF6EF', borderRadius: '0 0 12px 12px' }}>
              <div style={{ fontSize: 12, color: '#5A4A3A', marginBottom: 10 }}><strong>AI Analizi:</strong> {detailMatch.reason}</div>
              <button
                onClick={() => { saveMatch(detailMatch); setDetailMatch(null); }}
                className="btn-gold"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Check size={14} /> Eslestirmeyi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Haftalık Brifing Modal */}
      {showBrifing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBrifing(false)}>
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F0E8D8', background: '#1A1A18', borderRadius: '12px 12px 0 0' }}>
              <div>
                <h2 style={{ fontWeight: 700, color: '#D4AF37', fontSize: 16 }}>Haftalık Brifing</h2>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={() => setShowBrifing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {brifingLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8B7355' }}>
                  <Loader2 size={28} className="animate-spin" color="#D4AF37" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 13 }}>Haftalık brifing hazırlanıyor...</p>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#1A1A18', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{brifingContent}</div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F0E8D8', display: 'flex', gap: 8 }}>
              <button onClick={() => { setBrifingContent(''); setBrifingLoading(false); loadBrifing(); }} className="btn-ghost" style={{ fontSize: 12 }} disabled={brifingLoading}>
                <RefreshCw size={12} /> Yenile
              </button>
              <button onClick={() => setShowBrifing(false)} className="btn-gold" style={{ flex: 1, justifyContent: 'center' }}>
                Haftaya Başla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Brifing trigger button */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          onClick={() => { setShowBrifing(true); if (!brifingContent) loadBrifing(); }}
          style={{ fontSize: 11, color: '#8B7355', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Sparkles size={11} color="#D4AF37" /> Haftalık Brifing'i Aç
        </button>
      </div>

      {/* Welcome for fresh installs */}
      {stats.totalCustomers === 0 && stats.activePortfolios === 0 && !loading && (
        <div style={{ marginTop: 32, padding: 32, background: 'linear-gradient(135deg, #1A1A18, #2A2A22)', borderRadius: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏡</div>
          <h2 style={{ color: '#D4AF37', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>DerliEstate Pro'ya Hoş Geldiniz</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 20 }}>
            Profesyonel gayrimenkul portföy yönetiminize başlamak için müşteri veya portföy ekleyin.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('customers')} className="btn-gold">
              <Users size={15} /> Müşteri Ekle
            </button>
            <button onClick={() => onNavigate('portfolio')} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(212,175,55,0.4)', background: 'transparent', color: '#D4AF37', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
              <Building2 size={15} /> Portföy Ekle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
