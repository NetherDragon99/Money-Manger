import React from 'react';
import { Delete, RotateCcw } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (newValue: string) => void;
  lang?: 'en' | 'ar';
}

export const Numpad: React.FC<NumpadProps> = ({ value, onChange, lang = 'en' }) => {
  const handleDigit = (digit: string) => {
    // If value is currently "0" or empty, replace with digit unless digit is "."
    if (value === '0' || value === '') {
      if (digit === '.') {
        onChange('0.');
      } else {
        onChange(digit);
      }
      return;
    }

    // If decimal point exists, limit to 2 decimal places
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length >= 2) {
        return;
      }
    }

    // Limit maximum length to 10 digits to prevent overflow
    if (value.length >= 10) return;

    onChange(value + digit);
  };

  const handleDecimal = () => {
    if (!value.includes('.')) {
      onChange(value === '' || value === '0' ? '0.' : value + '.');
    }
  };

  const handleBackspace = () => {
    if (value.length <= 1 || value === '0') {
      onChange('0');
    } else {
      const next = value.slice(0, -1);
      onChange(next === '' ? '0' : next);
    }
  };

  const handleClear = () => {
    onChange('0');
  };

  const handleQuickAdd = (amount: number) => {
    const cur = parseFloat(String(value).replace(/,/g, '')) || 0;
    const next = Math.max(0, cur + amount);
    onChange(Number.isInteger(next) ? String(next) : next.toFixed(2));
  };

  return (
    <div className="w-full select-none pt-1 pb-1 space-y-2">
      {/* Quick Add and Clear Utilities */}
      <div className="flex items-center justify-between gap-1.5 px-0.5">
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-amber-400 hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{lang === 'ar' ? 'مسح (0)' : 'Clear (0)'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {[10, 50, 100].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => handleQuickAdd(amt)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] font-mono font-bold text-zinc-300 hover:text-white hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
            >
              +{amt}
            </button>
          ))}
        </div>
      </div>

      {/* Uniform 3-Column Ergonomic Grid (All buttons equal size, 0 is NOT oversized) */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Row 1 */}
        {['1', '2', '3'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-12 sm:h-13 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-xl font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 active:bg-zinc-800 transition shadow-sm cursor-pointer"
          >
            {d}
          </button>
        ))}

        {/* Row 2 */}
        {['4', '5', '6'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-12 sm:h-13 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-xl font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 active:bg-zinc-800 transition shadow-sm cursor-pointer"
          >
            {d}
          </button>
        ))}

        {/* Row 3 */}
        {['7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDigit(d)}
            className="h-12 sm:h-13 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-xl font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 active:bg-zinc-800 transition shadow-sm cursor-pointer"
          >
            {d}
          </button>
        ))}

        {/* Row 4: Decimal (.), 0 (Normal 1-col size), Backspace (⌫) */}
        <button
          type="button"
          onClick={handleDecimal}
          className="h-12 sm:h-13 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-2xl font-bold font-mono text-zinc-300 hover:text-white hover:bg-zinc-850 active:scale-95 active:bg-zinc-800 transition shadow-sm cursor-pointer"
        >
          .
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-12 sm:h-13 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-xl font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 active:bg-zinc-800 transition shadow-sm cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="h-12 sm:h-13 flex items-center justify-center rounded-2xl bg-zinc-850 border border-zinc-750 text-zinc-300 hover:text-red-400 hover:bg-zinc-800 active:scale-95 active:bg-zinc-700 transition shadow-sm cursor-pointer"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
