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
  { key: 'USD',         label: 'DOLAR',         emoji: '💵' },
  { key: 'EUR',         label: 'EURO',           emoji: '💶' },
  { key: 'gramAltin',   label: 'GRAM ALTIN',     emoji: '🥇' },
  { key: 'ceyrekAltin', label: 'ÇEYREK ALTIN',   emoji: '🥈' },
];

async function fetchRates(): Promise<AllRates> {
  let usd = '34.50', eur = '37.20', gramAltin = '3.580', ceyrekAltin = '6.250';
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

function PriceSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="h-3 w-16 rounded animate-pulse" style={{ background: 'rgba(212,175,55,0.15)' }} />
      <div className="h-5 w-24 rounded animate-pulse" style={{ background: 'rgba(212,175,55,0.1)' }} />
    </div>
  );
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
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
      {CARDS.map(card => {
        const rate = rates?.[card.key] as RateData | undefined;
        return (
          <div
            key={card.key}
            className="shrink-0 flex-1 min-w-[155px] px-3 py-2.5 rounded-xl"
            style={{
              background: '#1A1A18',
              borderBottom: '3px solid #D4AF37',
              border: '1px solid #2C2C2A',
              borderBottomColor: '#D4AF37',
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm shrink-0">{card.emoji}</span>
              <span className="text-[10px] font-bold tracking-widest" style={{ color: '#8B7355' }}>
                {card.label}
              </span>
              {rates?.stale && (
                <span className="ml-auto text-[9px]" style={{ color: '#8B7355' }}>yaklaşık</span>
              )}
            </div>

            {isFirstLoad ? (
              <PriceSkeleton />
            ) : rate ? (
              <div className="space-y-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-medium w-7 shrink-0" style={{ color: '#8B7355' }}>Alış</span>
                  <span className="text-xs font-semibold" style={{ color: 'rgba(212,175,55,0.7)' }}>
                    {rate.alis} ₺
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-medium w-7 shrink-0" style={{ color: '#8B7355' }}>Satış</span>
                  <span className="text-sm font-bold" style={{ color: '#D4AF37' }}>
                    {rate.satis} ₺
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs" style={{ color: '#8B7355' }}>
                <WifiOff size={11} />
                <span>Veri yok</span>
              </div>
            )}

            {rates?.lastUpdate && !isFirstLoad && (
              <p className="text-[9px] mt-1.5 leading-none" style={{ color: 'rgba(139,115,85,0.5)' }}>
                {rates.lastUpdate}
              </p>
            )}
          </div>
        );
      })}

      <button
        onClick={() => load()}
        disabled={loading}
        className="shrink-0 flex items-center justify-center w-9 min-h-[68px] rounded-xl transition-all disabled:opacity-30 hover:opacity-80"
        style={{ background: '#1A1A18', border: '1px solid #2C2C2A', color: '#8B7355' }}
        title="Yenile"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}
