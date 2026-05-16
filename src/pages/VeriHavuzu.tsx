import { useState, useEffect } from 'react';
import { Database, RefreshCw, Download, Loader2, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DataRow {
  id: string;
  [key: string]: unknown;
}

const TABLES = [
  { id: 'musteriler', label: 'Müşteriler', columns: ['ad', 'soyad', 'telefon', 'durum', 'created_at'] },
  { id: 'portfoyler', label: 'Portföyler', columns: ['isim', 'bolge', 'tip', 'fiyat', 'portfoy_durum', 'created_at'] },
  { id: 'randevular', label: 'Randevular', columns: ['konu', 'tarih', 'saat', 'musteri_adi', 'durum'] },
  { id: 'gorevler', label: 'Görevler', columns: ['baslik', 'oncelik', 'durum', 'son_tarih'] },
  { id: 'kullanicilar', label: 'Kullanıcılar', columns: ['ad', 'soyad', 'username', 'rol', 'created_at'] },
];

export default function VeriHavuzu() {
  const [activeTable, setActiveTable] = useState(TABLES[0]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all(TABLES.map(t => supabase.from(t.id).select('*', { count: 'exact', head: true }).then(r => [t.id, r.count || 0]))).then(res => setCounts(Object.fromEntries(res as [string, number][])));
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from(activeTable.id).select('*').order('created_at', { ascending: false }).limit(200);
    setRows((data || []) as DataRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeTable]);

  const filtered = rows.filter(row => {
    if (!search) return true;
    const q = search.toLowerCase();
    return activeTable.columns.some(col => String(row[col] || '').toLowerCase().includes(q));
  });

  const exportCsv = () => {
    const headers = activeTable.columns;
    const csv = [headers.join(','), ...filtered.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTable.id}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? '✓' : '✗';
    if (typeof val === 'string' && val.includes('T') && val.includes(':')) return new Date(val).toLocaleDateString('tr-TR');
    return String(val);
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Veri Havuzu</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>Ham veritabanı görünümü</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="btn-ghost" disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={exportCsv} className="btn-gold"><Download size={14} /> CSV İndir</button>
        </div>
      </div>

      {/* Table tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABLES.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTable(t)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: activeTable.id === t.id ? '#1A1A18' : '#F5F0E8',
              color: activeTable.id === t.id ? '#fff' : '#5A4A3A',
            }}
          >
            {t.label} {counts[t.id] !== undefined && <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[t.id]})</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-box" style={{ marginBottom: 14, maxWidth: 320 }}>
        <Search size={14} color="#8B7355" />
        <input placeholder="Filtrele..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAF6EF', borderBottom: '1px solid #F0E8D8' }}>
                  {activeTable.columns.map(col => (
                    <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8B7355', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((row, i) => (
                  <tr key={row.id || i} style={{ borderBottom: '1px solid #FAF6EF' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAF6EF')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {activeTable.columns.map(col => (
                      <td key={col} style={{ padding: '10px 16px', fontSize: 12, color: '#1A1A18', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#8B7355', fontSize: 13 }}>Kayıt bulunamadı</div>}
            {filtered.length > 100 && <div style={{ padding: 12, textAlign: 'center', color: '#8B7355', fontSize: 12, borderTop: '1px solid #F0E8D8' }}>İlk 100 kayıt gösteriliyor. CSV'ye aktarın tüm veriyi görün.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
