import { useState, useEffect, useRef } from 'react';
import { BarChart2, TrendingUp, Users, Building2, Calendar, Download, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayPrice } from '../components/PriceInput';

interface MonthlyData {
  month: string;
  customers: number;
  portfolios: number;
  appointments: number;
  closedDeals: number;
}

interface RegionData {
  bolge: string;
  count: number;
  totalValue: number;
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, avgDealSize: 0, conversionRate: 0, activeCustomers: 0 });
  const [period, setPeriod] = useState<3 | 6 | 12>(6);

  const load = async () => {
    setLoading(true);
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split('T')[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      const [{ count: c }, { count: p }, { count: r }, { count: k }] = await Promise.all([
        supabase.from('musteriler').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end),
        supabase.from('portfoyler').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end),
        supabase.from('randevular').select('*', { count: 'exact', head: true }).gte('tarih', start).lte('tarih', end),
        supabase.from('musteriler').select('*', { count: 'exact', head: true }).eq('durum', 'kapandi').gte('updated_at', start).lte('updated_at', end),
      ]);
      months.push({ month: d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }), customers: c || 0, portfolios: p || 0, appointments: r || 0, closedDeals: k || 0 });
    }
    setMonthly(months);

    const { data: portfoyler } = await supabase.from('portfoyler').select('bolge,fiyat,para_birimi').not('bolge', 'is', null);
    const regionMap: Record<string, { count: number; total: number }> = {};
    (portfoyler || []).forEach(p => {
      if (!p.bolge) return;
      if (!regionMap[p.bolge]) regionMap[p.bolge] = { count: 0, total: 0 };
      regionMap[p.bolge].count++;
      const val = parseFloat(String(p.fiyat).replace(/\./g, '').replace(',', '.')) || 0;
      regionMap[p.bolge].total += val;
    });
    setRegions(Object.entries(regionMap).map(([bolge, v]) => ({ bolge, count: v.count, totalValue: v.total })).sort((a, b) => b.count - a.count));

    const { count: active } = await supabase.from('musteriler').select('*', { count: 'exact', head: true }).in('durum', ['sicak', 'ilgili', 'takip']);
    const { count: closed } = await supabase.from('musteriler').select('*', { count: 'exact', head: true }).eq('durum', 'kapandi');
    const { count: total } = await supabase.from('musteriler').select('*', { count: 'exact', head: true });
    setSummary({
      totalRevenue: regions.reduce((s, r) => s + r.totalValue, 0),
      avgDealSize: regions.length > 0 ? regions.reduce((s, r) => s + r.totalValue, 0) / regions.reduce((s, r) => s + r.count, 0) : 0,
      conversionRate: total ? Math.round(((closed || 0) / total) * 100) : 0,
      activeCustomers: active || 0,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  const maxBar = Math.max(...monthly.map(m => m.customers), 1);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Raporlar & Analitik</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>İş performansı özeti</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: '#F5F0E8', borderRadius: 8, overflow: 'hidden' }}>
            {([3, 6, 12] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '7px 14px', border: 'none', background: period === p ? '#1A1A18' : 'transparent', color: period === p ? '#fff' : '#8B7355', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {p} Ay
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Aktif Müşteri', value: summary.activeCustomers.toString(), icon: Users, color: '#2563EB' },
              { label: 'Dönüşüm Oranı', value: `%${summary.conversionRate}`, icon: TrendingUp, color: '#059669' },
              { label: 'Toplam Portföy Değeri', value: displayPrice(summary.totalRevenue.toString(), 'TL'), icon: Building2, color: '#D4AF37' },
              { label: 'Ort. İşlem Büyüklüğü', value: displayPrice(Math.round(summary.avgDealSize).toString(), 'TL'), icon: BarChart2, color: '#DC2626' },
            ].map(card => (
              <div key={card.label} style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: '18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: card.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <card.icon size={16} color={card.color} />
                  </div>
                  <span style={{ fontSize: 11, color: '#8B7355', fontWeight: 600 }}>{card.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
            {/* Bar chart - monthly customers */}
            <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14, marginBottom: 20 }}>Aylık Müşteri & Portföy Trendi</h3>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 160 }}>
                {monthly.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                    <div
                      style={{ flex: 1, background: '#2563EB', borderRadius: '3px 3px 0 0', height: `${(m.customers / maxBar) * 140}px`, minHeight: 2, position: 'relative' }}
                      title={`${m.customers} müşteri`}
                    />
                    <div
                      style={{ flex: 1, background: '#059669', borderRadius: '3px 3px 0 0', height: `${(m.portfolios / maxBar) * 140}px`, minHeight: 2 }}
                      title={`${m.portfolios} portföy`}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {monthly.map((m, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#8B7355' }}>{m.month}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8B7355' }}><div style={{ width: 10, height: 10, background: '#2563EB', borderRadius: 2 }} />Müşteri</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8B7355' }}><div style={{ width: 10, height: 10, background: '#059669', borderRadius: 2 }} />Portföy</span>
              </div>
            </div>

            {/* Region breakdown */}
            <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14, marginBottom: 16 }}>Bölge Dağılımı</h3>
              {regions.slice(0, 8).map((r, i) => {
                const maxCount = regions[0]?.count || 1;
                return (
                  <div key={r.bolge} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A18' }}>{r.bolge}</span>
                      <span style={{ fontSize: 12, color: '#8B7355' }}>{r.count} portföy</span>
                    </div>
                    <div style={{ height: 6, background: '#F0E8D8', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg, #D4AF37, #B8962E)', width: `${(r.count / maxCount) * 100}%`, borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
              {regions.length === 0 && <p style={{ fontSize: 13, color: '#8B7355', textAlign: 'center', padding: 20 }}>Portföy bulunamadı</p>}
            </div>
          </div>

          {/* Monthly table */}
          <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0E8D8' }}>
              <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14 }}>Aylık Özet Tablosu</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAF6EF' }}>
                    {['Ay', 'Yeni Müşteri', 'Yeni Portföy', 'Randevu', 'Kapanan'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #FAF6EF' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAF6EF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: 13, color: '#1A1A18' }}>{m.month}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#2563EB', fontWeight: 600 }}>{m.customers}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#059669', fontWeight: 600 }}>{m.portfolios}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#D97706', fontWeight: 600 }}>{m.appointments}</td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: m.closedDeals > 0 ? '#D4AF37' : '#8B7355', fontWeight: m.closedDeals > 0 ? 900 : 400 }}>{m.closedDeals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
