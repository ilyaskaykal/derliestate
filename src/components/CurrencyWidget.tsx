import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface RateData {
  alis: string;
  satis: string;
}

interface AllRates {
  USD: RateData;
  EUR: RateData;
  gramAltin: RateData;
  ceyrekAltin: RateData;
  lastUpdate: string;
  stale?: boolean;
}

interface CardConfig {
  key: keyof Pick<AllRates, 'USD' | 'EUR' | 'gramAltin' | 'ceyrekAltin'>;
  label: string;
  emoji: string;
}

const CARDS: CardConfig[] = [
  { key: 'USD', label: 'DOLAR', emoji: '$' },
  { key: 'EUR', label: 'EURO', emoji: '€' },
  { key: 'gramAltin', label: 'GRAM ALTIN', emoji: 'g' },
  { key: 'ceyrekAltin', label: 'ÇEYREK ALTIN', emoji: '¼' },
];

async function fetchRates(): Promise<AllRates> {
  let usd = '34.50', eur = '37.20', gramAltin = '3580', ceyrekAltin = '6250';
  let stale = false;

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.rates?.TRY) {
      usd = data.rates.TRY.toFixed(2);
      eur = (data.rates.TRY / data.rates.EUR).toFixed(2);
    }
  } catch {
    stale = true;
  }

  const usdNum = parseFloat(usd);
  try {
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://canlialtin.com/api');
    const goldRes = await fetch(proxyUrl);
    const goldData = await goldRes.json();
    if (goldData.GRAM?.satis) gramAltin = goldData.GRAM.satis;
    if (goldData.CEYREK?.satis) ceyrekAltin = goldData.CEYREK.satis;
  } catch {
    const gramGold = ((2050 / 31.1035) * usdNum).toFixed(0);
    const ceyrekGold = (parseFloat(gramGold) * 1.75).toFixed(0);
    gramAltin = gramGold;
    ceyrekAltin = ceyrekGold;
  }

  return {
    USD: { satis: usd, alis: (usdNum - 0.10).toFixed(2) },
    EUR: { satis: eur, alis: (parseFloat(eur) - 0.15).toFixed(2) },
    gramAltin: { satis: gramAltin, alis: (parseFloat(gramAltin) - 50).toFixed(0) },
    ceyrekAltin: { satis: ceyrekAltin, alis: (parseFloat(ceyrekAltin) - 80).toFixed(0) },
    lastUpdate: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    stale,
  };
}

export default function CurrencyWidget() {
  const [rates, setRates] = useState<AllRates | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await fetchRates();
    setRates(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const isFirstLoad = loading && !rates;

  return (
    <div style={{ background: '#1A1A18', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(212,175,55,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#8B7355', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>DÖVİZ & ALTIN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {rates?.stale && <WifiOff size={12} color="#FF3B2F" />}
          {rates && <span style={{ color: '#8B7355', fontSize: 10 }}>{rates.lastUpdate}</span>}
          <button
            onClick={() => load()}
            disabled={loading}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B7355', padding: 0 }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {CARDS.map(card => {
          const r = rates?.[card.key];
          return (
            <div key={card.key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ color: '#D4AF37', fontSize: 10, fontWeight: 700 }}>{card.emoji}</span>
                <span style={{ color: '#8B7355', fontSize: 9, letterSpacing: 0.5 }}>{card.label}</span>
              </div>
              {isFirstLoad ? (
                <div style={{ height: 14, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }} />
              ) : (
                <div style={{ color: '#F5F0E8', fontSize: 13, fontWeight: 700 }}>
                  {r ? Number(r.satis).toLocaleString('tr-TR') : '—'}
                  <span style={{ color: '#8B7355', fontSize: 9, marginLeft: 2 }}>₺</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
