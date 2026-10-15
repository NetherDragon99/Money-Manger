import React from 'react';
import { Delete } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (newValue: string) => void;
  lang?: 'en' | 'ar';
}

export const Numpad: React.FC<NumpadProps> = ({ value, onChange, lang = 'en' }) => {
  const handleDigit = (digit: string) => {
    // If value is currently "0", replace with digit unless digit is "."
    if (value === '0') {
      onChange(digit);
      return;
    }

    // If decimal point exists, limit to 2 decimal places
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length >= 2) {
        return; // Don't allow more than 2 decimals
      }
    }

    // Limit maximum length to 10 digits to prevent overflow
    if (value.length >= 10) return;

    onChange(value + digit);
  };

  const handleDecimal = () => {
    if (!value.includes('.')) {
      onChange(value === '' ? '0.' : value + '.');
    }
  };

  const handleBackspace = () => {
    if (value.length <= 1) {
      onChange('0');
    } else {
      onChange(value.slice(0, -1));
    }
  };

  const handleClear = () => {
    onChange('0');
  };

  return (
    <div className="w-full select-none pt-2 pb-1">
      {/* 4-column CSS Grid containing ONLY: 1, 2, 3, ⌫, 4, 5, 6, Clear, 7, 8, 9, ., 0 */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => handleDigit('1')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleDigit('2')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleDigit('3')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          3
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-zinc-300 active:scale-95 active:bg-zinc-700 transition"
        >
          <Delete className="w-5 h-5" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handleDigit('4')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleDigit('5')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleDigit('6')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          6
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-sm font-bold text-amber-400 active:scale-95 active:bg-zinc-700 transition"
        >
          {lang === 'ar' ? 'مسح' : 'Clear'}
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handleDigit('7')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleDigit('8')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleDigit('9')}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          9
        </button>
        <button
          type="button"
          onClick={handleDecimal}
          className="h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-2xl font-bold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          .
        </button>

        {/* Row 4: 0 */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="col-span-4 h-13 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-semibold text-white active:scale-95 active:bg-zinc-800 transition"
        >
          0
        </button>
      </div>
    </div>
  );
};
