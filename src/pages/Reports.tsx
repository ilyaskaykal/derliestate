import { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, BarChart3, Users, Building2, X, Trophy, Medal, TrendingUp, Sparkles } from 'lucide-react';
import { RegionReportButton } from '../components/AIFeatures';
import { supabase } from '../lib/supabase';
import { Musteri, Portfoy, Randevu, Gorev, EslestirmeGecmisi } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { callClaude } from '../lib/claude';

type ReportsTab = 'genel' | 'performans';

const MUSTERI_DURUM_LABELS: Record<string, string> = {
  sicak: 'Sıcak', satin_alacak: 'Satın Alacak', dusunuyor: 'Düşünüyor',
  kararsiz: 'Kararsız', gelmedi: 'No Show', soguk: 'Soğuk',
};
const MUSTERI_DURUM_COLORS: Record<string, string> = {
  sicak: '#ef4444', satin_alacak: '#22c55e', dusunuyor: '#eab308',
  kararsiz: '#3b82f6', gelmedi: '#6b7280', soguk: '#8b5cf6',
};
const PORTFOY_TIP_LABELS: Record<string, string> = {
  daire: 'Daire', villa: 'Villa', ticari: 'Ticari', arsa: 'Arsa',
};
const PORTFOY_TIP_COLORS: Record<string, string> = {
  daire: '#3b82f6', villa: '#d4a853', ticari: '#f97316', arsa: '#22c55e',
};

interface BarData { label: string; value: number; color: string }
function BarChart({ data, title }: { data: BarData[]; title: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="card p-5">
      <h3 className="font-semibold mb-4 text-sm" style={{ color: '#1A1A18' }}>{title}</h3>
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-28 text-right text-xs shrink-0 truncate" style={{ color: '#8B7355' }}>{d.label}</div>
            <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: '#F5F0E8' }}>
              <div
                className="h-full rounded transition-all duration-700"
                style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
              />
            </div>
            <div className="w-8 text-right text-xs font-semibold shrink-0" style={{ color: '#1A1A18' }}>{d.value}</div>
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-center py-4" style={{ color: '#8B7355' }}>Veri yok</p>}
      </div>
    </div>
  );
}

export default function Reports() {
  const { toast } = useToast();
  const { user, effectiveUser } = useAuth();
  const canExport = user?.rol === 'admin' || user?.username === 'superadmin';
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';
  const [activeTab, setActiveTab] = useState<ReportsTab>('genel');
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [randevular, setRandevular] = useState<Randevu[]>([]);
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [eslestirmeler, setEslestirmeler] = useState<EslestirmeGecmisi[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [perfAiLoading, setPerfAiLoading] = useState(false);
  const [perfAiResult, setPerfAiResult] = useState('');

  // Monthly filter for Performans tab
  const now = new Date();
  const [perfYear, setPerfYear]   = useState(now.getFullYear());
  const [perfMonth, setPerfMonth] = useState(now.getMonth() + 1);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, p, r, g, e] = await Promise.all([
      supabase.from('musteriler').select('*'),
      supabase.from('portfoyler').select('*'),
      supabase.from('randevular').select('*'),
      supabase.from('gorevler').select('*'),
      supabase.from('eslestirme_gecmisi').select('*'),
    ]);
    setMusteriler(m.data || []);
    setPortfoyler(p.data || []);
    setRandevular(r.data || []);
    setGorevler((g.data || []) as Gorev[]);
    setEslestirmeler((e.data || []) as EslestirmeGecmisi[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const musteriDurumData: BarData[] = Object.entries(MUSTERI_DURUM_LABELS).map(([key, label]) => ({
    label,
    value: musteriler.filter(m => m.durum === key).length,
    color: MUSTERI_DURUM_COLORS[key],
  })).filter(d => d.value > 0);

  const muhitData: BarData[] = Object.entries(
    musteriler.reduce<Record<string, number>>((acc, m) => {
      if (m.muhit) acc[m.muhit] = (acc[m.muhit] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, color: '#d4a853' }));

  const portfoyTipData: BarData[] = Object.entries(PORTFOY_TIP_LABELS).map(([key, label]) => ({
    label,
    value: portfoyler.filter(p => p.tip === key).length,
    color: PORTFOY_TIP_COLORS[key],
  })).filter(d => d.value > 0);

  const portfoyDurumData: BarData[] = [
    { label: 'Olumlu', value: portfoyler.filter(p => p.portfoy_durum === 'olumlu').length, color: '#22c55e' },
    { label: 'Kararsız', value: portfoyler.filter(p => p.portfoy_durum === 'kararsiz').length, color: '#eab308' },
    { label: 'Olumsuz', value: portfoyler.filter(p => p.portfoy_durum === 'olumsuz').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  interface AdvisorStats {
    name: string;
    musteriCount: number;
    portfoyCount: number;
    sicakCount: number;
    satinAlacakCount: number;
    olumluCount: number;
    score: number;
  }

  const advisorStatsMap: Record<string, AdvisorStats> = {};

  musteriler.forEach(m => {
    const name = m.danisman?.trim() || 'Bilinmiyor';
    if (!advisorStatsMap[name]) advisorStatsMap[name] = { name, musteriCount: 0, portfoyCount: 0, sicakCount: 0, satinAlacakCount: 0, olumluCount: 0, score: 0 };
    advisorStatsMap[name].musteriCount++;
    if (m.durum === 'sicak') advisorStatsMap[name].sicakCount++;
    if (m.durum === 'satin_alacak') advisorStatsMap[name].satinAlacakCount++;
  });

  portfoyler.forEach(p => {
    const name = p.danisman?.trim() || 'Bilinmiyor';
    if (!advisorStatsMap[name]) advisorStatsMap[name] = { name, musteriCount: 0, portfoyCount: 0, sicakCount: 0, satinAlacakCount: 0, olumluCount: 0, score: 0 };
    advisorStatsMap[name].portfoyCount++;
    if (p.portfoy_durum === 'olumlu') advisorStatsMap[name].olumluCount++;
  });

  const leaderboard: AdvisorStats[] = Object.values(advisorStatsMap)
    .map(a => ({ ...a, score: a.musteriCount * 1 + a.portfoyCount * 2 + a.sicakCount * 3 + a.satinAlacakCount * 5 + a.olumluCount * 4 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const exportToExcel = async () => {
    if (!canExport) { toast('Bu özelliğe erişim yetkiniz yok.', 'error'); return; }
    setExporting(true);
    try {
      const wb = createWorkbook(musteriler, portfoyler, randevular);
      downloadExcel(wb);
      toast('Excel dosyası indirildi.');
    } catch {
      toast('Dışa aktarma başarısız.', 'error');
    }
    setExporting(false);
  };

  // ── Performans metrics helpers
  const inMonth = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === perfYear && d.getMonth() + 1 === perfMonth;
  };

  interface PerfAdvisor {
    name: string;
    musteriEklenen: number;
    portfoyEklenen: number;
    gorevTamamlanan: number;
    eslestirmeSayisi: number;
    score: number;
  }

  const TR_MONTHS_FULL = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  const perfAdvisors = (() => {
    const map: Record<string, PerfAdvisor> = {};
    const ensure = (name: string) => {
      if (!map[name]) map[name] = { name, musteriEklenen: 0, portfoyEklenen: 0, gorevTamamlanan: 0, eslestirmeSayisi: 0, score: 0 };
    };
    musteriler.filter(m => inMonth(m.created_at)).forEach(m => {
      const name = m.danisman?.trim() || m.eklendi_user_ad?.trim() || 'Bilinmiyor';
      ensure(name); map[name].musteriEklenen++;
    });
    portfoyler.filter(p => inMonth(p.created_at)).forEach(p => {
      const name = p.danisman?.trim() || p.eklendi_user_ad?.trim() || 'Bilinmiyor';
      ensure(name); map[name].portfoyEklenen++;
    });
    gorevler.filter(g => g.durum === 'tamamlandi' && inMonth(g.created_at)).forEach(g => {
      const name = g.atanan_user || 'Bilinmiyor';
      ensure(name); map[name].gorevTamamlanan++;
    });
    eslestirmeler.filter(e => inMonth(e.created_at)).forEach(e => {
      const name = e.danisman?.trim() || 'Bilinmiyor';
      ensure(name); map[name].eslestirmeSayisi++;
    });
    return Object.values(map)
      .map(a => ({ ...a, score: a.musteriEklenen * 2 + a.portfoyEklenen * 3 + a.gorevTamamlanan * 2 + a.eslestirmeSayisi * 4 }))
      .sort((a, b) => b.score - a.score);
  })();

  // Filter to current user for non-admins
  const visiblePerfAdvisors = isAdmin ? perfAdvisors : perfAdvisors.filter(a => {
    const myName = `${effectiveUser?.ad || ''} ${effectiveUser?.soyad || ''}`.trim();
    return a.name === myName;
  });

  const runPerfAI = async () => {
    if (visiblePerfAdvisors.length === 0) { toast('Bu dönemde performans verisi yok.', 'info'); return; }
    setPerfAiLoading(true);
    setPerfAiResult('');
    try {
      const summary = visiblePerfAdvisors.map(a =>
        `${a.name}: ${a.musteriEklenen} müşteri, ${a.portfoyEklenen} portföy, ${a.gorevTamamlanan} görev, ${a.eslestirmeSayisi} eşleştirme (${a.score} puan)`
      ).join('\n');
      const prompt = `Aşağıdaki ${TR_MONTHS_FULL[perfMonth - 1]} ${perfYear} performans verilerini analiz et ve Türkçe önerilerde bulun:\n\n${summary}\n\nHer danışman için: güçlü yönler, geliştirilmesi gerekenler ve 2 somut öneri. Kısa ve net yaz.`;
      setPerfAiResult(await callClaude(prompt, 1200));
    } catch (err) {
      setPerfAiResult(`Analiz hatası: ${err instanceof Error ? err.message : String(err)}`);
    }
    setPerfAiLoading(false);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#FDF3E3' }}>
      <div className="px-6 py-4 shrink-0 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>Raporlar</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Genel istatistikler ve dağılımlar</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && activeTab === 'genel' && (
            <button onClick={exportToExcel} disabled={exporting} className="btn-gold">
              {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Excel'e Aktar
            </button>
          )}
          <RegionReportButton />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 shrink-0 flex items-center gap-0" style={{ background: '#FDF3E3', borderBottom: '0.5px solid #F6D9A8' }}>
        {([
          { key: 'genel', label: 'Genel İstatistikler', icon: BarChart3 },
          { key: 'performans', label: 'Performans Takibi', icon: TrendingUp },
        ] as { key: ReportsTab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all relative"
            style={activeTab === key
              ? { color: '#D4AF37', borderBottom: '2px solid #D4AF37', marginBottom: '-1px', background: '#1A1A18' }
              : { color: '#8B7355', borderBottom: '2px solid transparent', marginBottom: '-1px' }
            }
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : activeTab === 'performans' ? (
          /* ── Performans Tab ── */
          <div className="space-y-6">
            {/* Month selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium" style={{ color: '#1A1A18' }}>Dönem:</span>
              <select
                value={perfMonth}
                onChange={e => setPerfMonth(Number(e.target.value))}
                className="text-xs rounded-lg px-3 py-1.5 focus:outline-none"
                style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}
              >
                {TR_MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={perfYear}
                onChange={e => setPerfYear(Number(e.target.value))}
                className="text-xs rounded-lg px-3 py-1.5 focus:outline-none"
                style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Leaderboard */}
            {visiblePerfAdvisors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: '#8B7355' }}>
                <TrendingUp size={32} />
                <p className="text-sm">Bu dönemde performans verisi yok.</p>
              </div>
            ) : (
              <div className="card p-5" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                    <Trophy size={20} style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Aylık Performans — {TR_MONTHS_FULL[perfMonth - 1]} {perfYear}</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Müşteri, portföy, görev ve eşleştirme bazlı skor</p>
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-6 gap-2 px-3 pb-2 mb-1" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
                  {['Danışman', 'Müşteri', 'Portföy', 'Görev', 'Eşleştirme', 'Toplam'].map(h => (
                    <div key={h} className="text-[10px] font-semibold uppercase tracking-wide text-center" style={{ color: '#8B7355', letterSpacing: '1px' }}>{h}</div>
                  ))}
                </div>

                <div className="space-y-2">
                  {visiblePerfAdvisors.map((a, i) => {
                    const maxScore = visiblePerfAdvisors[0]?.score || 1;
                    const medal = i === 0 ? '#D4AF37' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : null;
                    return (
                      <div key={a.name} className="rounded-xl overflow-hidden" style={{ background: i < 3 ? '#F5F0E8' : 'white', border: `0.5px solid #F6D9A8` }}>
                        <div className="grid grid-cols-6 gap-2 px-3 py-3 items-center">
                          <div className="flex items-center gap-2 min-w-0">
                            {medal
                              ? <Medal size={15} style={{ color: medal, flexShrink: 0 }} />
                              : <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: '#8B7355' }}>#{i+1}</span>
                            }
                            <span className="text-sm font-semibold truncate" style={{ color: '#1A1A18' }}>{a.name}</span>
                          </div>
                          {[a.musteriEklenen, a.portfoyEklenen, a.gorevTamamlanan, a.eslestirmeSayisi].map((v, j) => (
                            <div key={j} className="text-center">
                              <span className="text-base font-bold" style={{ color: v > 0 ? '#1A1A18' : '#8B7355' }}>{v}</span>
                            </div>
                          ))}
                          <div className="text-center">
                            <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>{a.score}</span>
                          </div>
                        </div>
                        <div className="px-3 pb-2">
                          <div className="w-full rounded-full overflow-hidden" style={{ height: '3px', background: '#F5F0E8' }}>
                            <div className="h-full rounded-full" style={{ width: `${(a.score / maxScore) * 100}%`, background: medal ? `linear-gradient(90deg, ${medal}, #D4AF37)` : 'linear-gradient(90deg, #D4AF37, #1A1A18)', transition: 'width 0.8s ease' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            <div className="card p-5" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                  <Sparkles size={20} style={{ color: '#D4AF37' }} />
                </div>
                <div>
                  <h2 className="font-semibold" style={{ color: '#1A1A18' }}>YZ Performans Analizi</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Claude verilerinizi analiz ederek gelişim önerileri sunar</p>
                </div>
                {perfAiResult && (
                  <button onClick={() => setPerfAiResult('')} className="ml-auto p-1.5 rounded-lg" style={{ color: '#8B7355' }}><X size={16} /></button>
                )}
              </div>
              <button onClick={runPerfAI} disabled={perfAiLoading} className="btn-gold w-full justify-center py-3">
                {perfAiLoading
                  ? <><Loader2 className="animate-spin" size={16} />Analiz yapılıyor...</>
                  : <><Sparkles size={16} />YZ Analizi Yap</>
                }
              </button>
              {perfAiResult && (
                <div className="mt-4 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: '#F5F0E8', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}>
                  {perfAiResult}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Toplam Müşteri', value: musteriler.length, icon: Users, color: '#534AB7', bg: 'rgba(83,74,183,0.1)' },
                { label: 'Toplam Portföy', value: portfoyler.length, icon: Building2, color: '#534AB7', bg: 'rgba(83,74,183,0.08)' },
                { label: 'Toplam Randevu', value: randevular.length, icon: BarChart3, color: '#22A05A', bg: 'rgba(34,160,90,0.1)' },
                { label: 'Aktif (Sıcak)', value: musteriler.filter(m => m.durum === 'sicak').length, icon: Users, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
              ].map(s => (
                <div key={s.label} className="card p-4 flex items-center gap-3" style={{ background: '#1A1A18', border: '1px solid #D4AF37' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.bg, color: s.color }}>
                    <s.icon size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#F5F0E8' }}>{s.value}</p>
                    <p className="text-xs" style={{ color: '#8B7355' }}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BarChart data={musteriDurumData} title="Müşteri Durum Dağılımı" />
              <BarChart data={muhitData} title="Muhit Dağılımı (İlk 8)" />
              <BarChart data={portfoyTipData} title="Portföy Tip Dağılımı" />
              <BarChart data={portfoyDurumData} title="Portföy Durum Dağılımı" />
            </div>

            {/* Performans Takibi Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="card p-5" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                    <Trophy size={20} style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Performans Sıralaması</h2>
                    <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Danışman bazlı müşteri, portföy ve kapanış skoru</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {leaderboard.map((a, i) => {
                    const maxScore = leaderboard[0]?.score || 1;
                    const medal = i === 0 ? '#D4AF37' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : null;
                    return (
                      <div key={a.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: i < 3 ? '#F5F0E8' : 'white', border: `0.5px solid #F6D9A8` }}>
                        <div className="w-7 text-center shrink-0">
                          {medal ? <Medal size={18} style={{ color: medal }} /> : <span className="text-xs font-bold" style={{ color: '#8B7355' }}>#{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold truncate" style={{ color: '#1A1A18' }}>{a.name}</span>
                            <span className="text-xs font-bold shrink-0 ml-2" style={{ color: '#D4AF37' }}>{a.score} puan</span>
                          </div>
                          <div className="w-full rounded-full overflow-hidden" style={{ height: '4px', background: '#F5F0E8' }}>
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(a.score / maxScore) * 100}%`, background: medal ? `linear-gradient(90deg, ${medal}, #D4AF37)` : 'linear-gradient(90deg, #D4AF37, #1A1A18)' }} />
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px]" style={{ color: '#8B7355' }}>{a.musteriCount} müşteri</span>
                            <span className="text-[10px]" style={{ color: '#8B7355' }}>{a.portfoyCount} portföy</span>
                            {a.sicakCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>{a.sicakCount} sıcak</span>}
                            {a.satinAlacakCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>{a.satinAlacakCount} satın alacak</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function createWorkbook(musteriler: Musteri[], portfoyler: Portfoy[], randevular: Randevu[]) {
  const musteriRows = [
    ['Ad', 'Soyad', 'Telefon', 'E-posta', 'Muhit', 'Bütçe Min', 'Bütçe Max', 'Bölge Esnek', 'Olmazsa Olmaz', 'Açıklama', 'Durum', 'Danışman', 'Tarih'],
    ...musteriler.map(m => [m.ad, m.soyad, m.telefon, m.email, m.muhit, m.butce_min, m.butce_max, m.bolge_esnek ? 'Evet' : 'Hayır', m.olmaz_olmaz, m.aciklama, m.durum, m.danisman, m.created_at]),
  ];
  const portfoyRows = [
    ['Başlık', 'Bölge', 'Tip', 'Fiyat', 'İl', 'İlçe', 'Mahalle', 'Oda', 'Metrekare', 'Durum', 'Danışman', 'Sahip Ad', 'Sahip Soyad', 'Telefon'],
    ...portfoyler.map(p => [p.isim, p.bolge, p.tip, p.fiyat, p.il, p.ilce, p.mahalle, p.oda, p.metrekare, p.portfoy_durum, p.danisman, p.sahip_ad, p.sahip_soyad, p.sahip_tel]),
  ];
  const randevuRows = [
    ['Konu', 'Tarih', 'Saat', 'Durum'],
    ...randevular.map(r => [r.konu, r.tarih, r.saat, r.durum]),
  ];
  return { musteriRows, portfoyRows, randevuRows };
}

function downloadExcel({ musteriRows, portfoyRows, randevuRows }: ReturnType<typeof createWorkbook>) {
  const toCSV = (rows: (string | null | undefined | boolean)[][]) =>
    rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

  const content = `Müşteriler\n${toCSV(musteriRows)}\n\nPortföyler\n${toCSV(portfoyRows)}\n\nRandevular\n${toCSV(randevuRows)}`;
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DerliEstate_Pro_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
