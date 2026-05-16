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

export function displayPrice(raw: string, currency: Currency = 'TL'): string {
  if (!raw) return '';
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = formatPrice(raw);
  return currency === 'TL' ? `${formatted} ₺` : `${symbol}${formatted}`;
}

interface PriceInputProps {
  value: string;
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
    <div className="flex gap-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayed}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className="input flex-1"
        style={{ borderColor: '#E8A020', color: '#1A1A18' }}
      />
      <select
        value={currency}
        onChange={e => onCurrencyChange(e.target.value as Currency)}
        className="input w-20"
        style={{ background: '#1A1A18', color: '#D4AF37', border: '2px solid #D4AF37' }}
      >
        <option value="TL">₺ TL</option>
        <option value="USD">$ USD</option>
        <option value="EUR">€ EUR</option>
      </select>
    </div>
  );
}
