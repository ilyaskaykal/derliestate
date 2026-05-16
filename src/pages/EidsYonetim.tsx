import { useState, useEffect } from 'react';
import { Shield, Search, X, Loader2, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { EIDS_STATUS_LABELS, eidsStatusColor, daysUntilExpiry } from '../lib/eids';
import type { Portfoy, EidsStatus } from '../types';

function getEidsLabel(s: string): string {
  return EIDS_STATUS_LABELS[s as EidsStatus] ?? s;
}
function getEidsColor(s: string): string {
  return eidsStatusColor(s as EidsStatus).text;
}
function calcEidsExpiry(d?: string) {
  if (!d) return null;
  const days = daysUntilExpiry(d);
  if (days === null) return null;
  return { isExpired: days < 0, daysLeft: days, label: days < 0 ? `${Math.abs(days)} gün önce doldu` : `${days} gün kaldı` };
}

const STATUS_OPTIONS: EidsStatus[] = ['yok', 'bekliyor', 'isleniyor', 'tamamlandi', 'iptal', 'suresi_doldu'];

export default function EidsYonetim() {
  const { toast } = useToast();
  const [portfolios, setPortfolios] = useState<Portfoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('portfoyler').select('id,isim,bolge,mahalle,sahibi_ad,eids_status,eids_son_tarih,portfoy_kodu,portfoy_durum').order('created_at', { ascending: false });
    setPortfolios(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = portfolios.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.isim?.toLowerCase().includes(q) || p.bolge?.toLowerCase().includes(q) || p.sahibi_ad?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || p.eids_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id: string, status: EidsStatus) => {
    setUpdating(id);
    const { error } = await supabase.from('portfoyler').update({ eids_status: status }).eq('id', id);
    if (error) toast(error.message, 'error');
    else load();
    setUpdating(null);
  };

  const stats = {
    yok: portfolios.filter(p => p.eids_status === 'yok').length,
    bekliyor: portfolios.filter(p => p.eids_status === 'bekliyor').length,
    tamamlandi: portfolios.filter(p => p.eids_status === 'tamamlandi').length,
    suresi_doldu: portfolios.filter(p => p.eids_status === 'suresi_doldu').length,
  };

  const STATUS_ICON: Record<string, React.ReactNode> = {
    yok: <XCircle size={14} color="#6B7280" />,
    bekliyor: <Clock size={14} color="#D97706" />,
    isleniyor: <Loader2 size={14} color="#2563EB" />,
    tamamlandi: <CheckCircle size={14} color="#059669" />,
    iptal: <XCircle size={14} color="#DC2626" />,
    suresi_doldu: <AlertTriangle size={14} color="#FF3B2F" />,
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>EİDS Yönetimi</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>e-Devlet İşlem Doğrulama Sistemi takibi</p>
        </div>
        <button onClick={load} className="btn-ghost" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'EİDS Yok', count: stats.yok, color: '#6B7280' },
          { label: 'Bekliyor', count: stats.bekliyor, color: '#D97706' },
          { label: 'Tamamlandı', count: stats.tamamlandi, color: '#059669' },
          { label: 'Süresi Doldu', count: stats.suresi_doldu, color: '#FF3B2F' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${s.color}30`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: '#8B7355' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
          <Search size={14} color="#8B7355" />
          <input placeholder="Portföy ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
          {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input" style={{ width: 160 }}>
          <option value="">Tüm Durumlar</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{getEidsLabel(s)}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FAF6EF', borderBottom: '1px solid #F0E8D8' }}>
                {['Portföy', 'Bölge', 'Mal Sahibi', 'EİDS Durumu', 'Son Tarih', 'Durum Değiştir'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const expiry = calcEidsExpiry(p.eids_son_tarih);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #FAF6EF' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAF6EF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A18' }}>{p.isim}</div>
                      {p.portfoy_kodu && <div style={{ fontSize: 11, color: '#8B7355' }}>#{p.portfoy_kodu}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#5A4A3A' }}>{[p.mahalle, p.bolge].filter(Boolean).join(', ')}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#5A4A3A' }}>{p.sahibi_ad || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {STATUS_ICON[p.eids_status || 'yok']}
                        <span style={{ fontSize: 12, fontWeight: 600, color: getEidsColor(p.eids_status || 'yok') }}>{getEidsLabel(p.eids_status || 'yok')}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.eids_son_tarih ? (
                        <span style={{ fontSize: 12, color: expiry?.isExpired ? '#FF3B2F' : expiry?.daysLeft && expiry.daysLeft < 30 ? '#D97706' : '#059669', fontWeight: 600 }}>
                          {new Date(p.eids_son_tarih).toLocaleDateString('tr-TR')}
                          {expiry && <span style={{ fontSize: 10, display: 'block', fontWeight: 400, color: '#8B7355' }}>{expiry.label}</span>}
                        </span>
                      ) : <span style={{ fontSize: 12, color: '#C4B5A5' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {updating === p.id ? (
                        <Loader2 size={14} className="animate-spin" color="#D4AF37" />
                      ) : (
                        <select
                          value={p.eids_status || 'yok'}
                          onChange={e => updateStatus(p.id, e.target.value as EidsStatus)}
                          className="input"
                          style={{ width: 140, fontSize: 11, padding: '4px 8px' }}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{getEidsLabel(s)}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#8B7355' }}>Portföy bulunamadı</div>}
        </div>
      )}
    </div>
  );
}
