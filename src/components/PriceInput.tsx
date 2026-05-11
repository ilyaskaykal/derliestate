import { useRef } from 'react';

export type Currency = 'TL' | 'USD' | 'EUR';

export const CURRENCY_SYMBOLS: Record<Currency, string> = { TL: '₺', USD: '$', EUR: '€' };

export function formatPrice(raw: string | number): string {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function unformatPrice(formatted: string): string {
  return formatted.replace(/\./g, '');
}

/** Display a stored raw numeric string with dot-formatting and currency symbol */
export function displayPrice(raw: string, currency: Currency = 'TL'): string {
  if (!raw) return '';
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = formatPrice(raw);
  return currency === 'TL' ? `${formatted} ₺` : `${symbol}${formatted}`;
}

interface PriceInputProps {
  value: string;          // raw digits stored in state
  currency: Currency;
  onValueChange: (raw: string) => void;
  onCurrencyChange: (c: Currency) => void;
  placeholder?: string;
  required?: boolean;
}

export default function PriceInput({
  value,
  currency,
  onValueChange,
  onCurrencyChange,
  placeholder = '0',
  required,
}: PriceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const displayed = formatPrice(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = unformatPrice(e.target.value);
    onValueChange(raw);
  };

  return (
    <div className="flex gap-1.5">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className="input flex-1 min-w-0"
        placeholder={placeholder}
        value={displayed}
        onChange={handleChange}
        required={required}
        style={{ border: '2px solid #C8804B', color: '#C0392B', fontWeight: 600, fontSize: 16 }}
      />
      <select
        className="input w-20 shrink-0 px-2 text-sm font-semibold"
        value={currency}
        onChange={e => onCurrencyChange(e.target.value as Currency)}
        style={{ background: '#1A1A18', color: '#D4AF37', border: 'none' }}
      >
        <option value="TL">₺ TL</option>
        <option value="USD">$ USD</option>
        <option value="EUR">€ EUR</option>
      </select>
    </div>
  );
}
