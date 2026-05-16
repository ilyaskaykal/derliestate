import { useState } from 'react';
import { Search, MapPin, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface TapuSonuc {
  ada: string;
  parsel: string;
  pafta: string;
  il: string;
  ilce: string;
  mahalle: string;
  nitelik: string;
  yuzolcumu: string;
  malik: string;
  hisse: string;
  tapu_tarihi: string;
  tapu_no: string;
  durum: string;
  notlar: string;
}

const EMPTY_FORM = { ada: '', parsel: '', pafta: '', il: 'İzmir', ilce: 'Çeşme', mahalle: '' };

export default function TapuSorgulama() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TapuSonuc | null>(null);
  const [savedQueries, setSavedQueries] = useState<TapuSonuc[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ada || !form.parsel) { toast('Ada ve parsel numarası zorunludur.', 'error'); return; }
    setLoading(true);

    const { data: existing } = await supabase
      .from('tapu_sorgulama')
      .select('*')
      .eq('ada', form.ada)
      .eq('parsel', form.parsel)
      .eq('ilce', form.ilce)
      .maybeSingle();

    if (existing) {
      setResult(existing as TapuSonuc);
    } else {
      const mockResult: TapuSonuc = {
        ada: form.ada, parsel: form.parsel, pafta: form.pafta,
        il: form.il, ilce: form.ilce, mahalle: form.mahalle,
        nitelik: 'Arsa', yuzolcumu: '—', malik: '—',
        hisse: '1/1', tapu_tarihi: '—', tapu_no: '—',
        durum: 'sorgulandı', notlar: 'e-Devlet entegrasyonu için yetkilendirme gereklidir.',
      };
      const { data: saved } = await supabase.from('tapu_sorgulama').insert({ ...mockResult, sorgulayanid: user?.id }).select().maybeSingle();
      setResult(saved as TapuSonuc || mockResult);
    }

    const { data: all } = await supabase.from('tapu_sorgulama').select('*').eq('sorgulayanid', user?.id).order('created_at', { ascending: false }).limit(10);
    setSavedQueries(all as TapuSonuc[] || []);
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Tapu Sorgulama</h1>
        <p style={{ color: '#8B7355', fontSize: 13 }}>Ada/parsel bazlı tapu bilgisi sorgulama</p>
      </div>

      <div style={{ background: '#FFF8E1', border: '1px solid #D97706', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertCircle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          Bu modül e-Devlet Tapu Müdürlüğü sistemiyle entegrasyon için tasarlanmıştır. Gerçek veriye erişim için EİDS yetkilendirmesi gereklidir. Şu an simülasyon modunda çalışmaktadır.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <div>
          {/* Search form */}
          <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14, marginBottom: 16 }}>Sorgu Kriterleri</h3>
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Ada No *</label>
                  <input value={form.ada} onChange={e => setForm(f => ({ ...f, ada: e.target.value }))} className="input" required placeholder="ör. 123" />
                </div>
                <div>
                  <label className="label">Parsel No *</label>
                  <input value={form.parsel} onChange={e => setForm(f => ({ ...f, parsel: e.target.value }))} className="input" required placeholder="ör. 45" />
                </div>
                <div>
                  <label className="label">Pafta</label>
                  <input value={form.pafta} onChange={e => setForm(f => ({ ...f, pafta: e.target.value }))} className="input" placeholder="ör. F19B" />
                </div>
                <div>
                  <label className="label">Mahalle</label>
                  <input value={form.mahalle} onChange={e => setForm(f => ({ ...f, mahalle: e.target.value }))} className="input" placeholder="Mahalle adı" />
                </div>
                <div>
                  <label className="label">İl</label>
                  <input value={form.il} onChange={e => setForm(f => ({ ...f, il: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">İlçe</label>
                  <input value={form.ilce} onChange={e => setForm(f => ({ ...f, ilce: e.target.value }))} className="input" />
                </div>
              </div>
              <button type="submit" className="btn-gold" disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Sorgula
              </button>
            </form>
          </div>

          {/* Result */}
          {result && (
            <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} color="#059669" />
                <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14 }}>Sorgu Sonucu</h3>
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {([
                  ['Ada', result.ada], ['Parsel', result.parsel], ['Pafta', result.pafta],
                  ['İl/İlçe', `${result.il} / ${result.ilce}`], ['Mahalle', result.mahalle],
                  ['Nitelik', result.nitelik], ['Yüzölçümü', result.yuzolcumu],
                  ['Malik', result.malik], ['Hisse', result.hisse],
                  ['Tapu Tarihi', result.tapu_tarihi], ['Tapu No', result.tapu_no],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontSize: 11, color: '#8B7355' }}>{k}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              {result.notlar && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #F0E8D8', background: '#FAF6EF' }}>
                  <p style={{ fontSize: 12, color: '#8B7355' }}>{result.notlar}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved queries */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0E8D8' }}>
              <h3 style={{ fontWeight: 700, color: '#1A1A18', fontSize: 14 }}>Son Sorgular</h3>
            </div>
            {savedQueries.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#8B7355', fontSize: 12 }}>Henüz sorgu yapılmadı</div>
            ) : (
              savedQueries.map((q, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #FAF6EF', cursor: 'pointer' }}
                  onClick={() => setResult(q)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAF6EF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <MapPin size={11} color="#D4AF37" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18' }}>Ada: {q.ada} / Parsel: {q.parsel}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#8B7355' }}>{q.ilce}, {q.il}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
