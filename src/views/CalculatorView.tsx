import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Menu,
  RotateCcw,
  History,
  ArrowRight,
  PlusCircle,
  Delete,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatCurrency } from '../utils/dateCycle';

interface HistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
}

export const CalculatorView: React.FC = () => {
  const { settings, openAddTxModal, setIsSidebarOpen, showToast, t } = useApp();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState(false);
  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';

  // Precision Evaluation Engine for √, ^, %, parentheses, and standard operators
  const evaluateMath = (raw: string): number | null => {
    if (!raw.trim()) return 0;
    try {
      let expr = raw;

      // 1. Convert visual math symbols to computational tokens
      expr = expr.replace(/×/g, '*');
      expr = expr.replace(/÷/g, '/');
      expr = expr.replace(/−/g, '-');
      expr = expr.replace(/\^/g, '**');

      // 2. Handle square roots: √(x) or √x
      // Handle nested or grouped roots first
      let maxLoops = 10;
      while (expr.includes('√(') && maxLoops-- > 0) {
        expr = expr.replace(/√\(([^()]+)\)/g, 'Math.sqrt($1)');
      }
      // Handle standalone number roots like √25
      expr = expr.replace(/√(\d+(\.\d+)?)/g, 'Math.sqrt($1)');

      // 3. Handle percentage:
      // Case A: Number% (e.g. 50% -> (50/100))
      expr = expr.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

      // 4. Sanitize: allow only numbers, math operations, and Math.sqrt
      const testSanitized = expr.replace(/Math\.sqrt/g, '');
      if (!/^[\d\s+\-*/.()**]+$/.test(testSanitized)) {
        return null;
      }

      // 5. Safely execute math function
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${expr})`);
      const val = fn();

      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        // Fix floating point precision artifacts (e.g., 0.1 + 0.2)
        return Math.round(val * 1e10) / 1e10;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleInput = (token: string) => {
    let next = expression;
    if (token === '√') {
      next = expression + '√(';
    } else {
      next = expression + token;
    }
    setExpression(next);

    const calculated = evaluateMath(next);
    if (calculated !== null) {
      setResult(calculated);
    }
  };

  const handleClear = () => {
    setExpression('');
    setResult(0);
  };

  const handleBackspace = () => {
    if (expression.length <= 1) {
      setExpression('');
      setResult(0);
    } else {
      // If deleting the end of '√(', delete both characters
      let next = expression;
      if (next.endsWith('√(')) {
        next = next.slice(0, -2);
      } else {
        next = next.slice(0, -1);
      }
      setExpression(next);
      const calculated = evaluateMath(next);
      if (calculated !== null) {
        setResult(calculated);
      }
    }
  };

  const handleEquals = () => {
    const finalVal = evaluateMath(expression);
    if (finalVal !== null && expression.trim()) {
      setResult(finalVal);

      const newItem: HistoryItem = {
        id: String(Date.now()),
        expression,
        result: finalVal,
        timestamp: new Date().toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const updatedHistory = [newItem, ...history].slice(0, 30);
      setHistory(updatedHistory);
      try {
        localStorage.setItem('calc_history', JSON.stringify(updatedHistory));
      } catch {}

      setExpression(String(finalVal));
    }
  };

  const handleCreateTransaction = () => {
    const finalAmount = result !== 0 ? Math.abs(result) : Math.abs(parseFloat(expression) || 0);
    if (finalAmount <= 0) {
      showToast(isArabic ? 'يرجى إدخال مبلغ صالح أولاً' : 'Please calculate a valid amount first', 'info');
      return;
    }
    openAddTxModal(undefined, finalAmount);
  };

  // Recent 1-2 history items for compact top preview
  const recentHistory = history.slice(0, 2);

  return (
    <div className="h-[calc(100dvh-4.25rem)] sm:h-[calc(100dvh-4.75rem)] w-full max-w-[480px] mx-auto flex flex-col justify-between overflow-hidden bg-black text-white px-3.5 pt-2.5 pb-2 select-none animate-in fade-in">
      {/* 1. Header with Universal Sidebar Access */}
      <header className="flex items-center justify-between pb-1 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Menu"
            className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-black tracking-tight flex items-center gap-1.5">
              <span>{isArabic ? 'الحاسبة المالية' : 'Calculator'}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO
              </span>
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-semibold transition cursor-pointer active:scale-95 ${
            showHistory
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{isArabic ? 'السجل' : 'History'}</span>
          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </header>

      {/* 2. Display Screen with In-Display Scrollable History Preview */}
      <div className="flex-1 flex flex-col justify-end p-4 rounded-3xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl relative overflow-hidden my-2">
        {/* In-Display History Tape: strictly constrained inside display screen without shifting keypad! */}
        {showHistory ? (
          <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md p-3.5 flex flex-col justify-between z-10 overscroll-contain animate-in fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {isArabic ? 'سجل العمليات الحسابية' : 'Calculation History'}
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('calc_history');
                    showToast(isArabic ? 'تم مسح السجل' : 'History cleared', 'info');
                  }}
                  className="text-[10px] text-red-400 hover:underline cursor-pointer"
                >
                  {isArabic ? 'مسح الكل' : 'Clear All'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 my-2 pr-1 overscroll-contain">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  {isArabic ? 'لا توجد عمليات سابقة' : 'No previous calculations'}
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setExpression(String(item.result));
                      setResult(item.result);
                      setShowHistory(false);
                    }}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/70 hover:bg-zinc-850 cursor-pointer transition text-xs font-mono"
                  >
                    <div className="text-zinc-400 truncate max-w-[200px]">{item.expression}</div>
                    <div className="text-blue-400 font-bold">= {item.result.toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="w-full py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition"
            >
              {isArabic ? 'إغلاق السجل' : 'Close History'}
            </button>
          </div>
        ) : (
          /* Compact 1-Line Preview of Latest Calculation */
          recentHistory.length > 0 && (
            <div
              onClick={() => setShowHistory(true)}
              className="cursor-pointer text-xs font-mono text-zinc-500 truncate pb-1 hover:text-zinc-400 transition flex items-center justify-end gap-1.5"
            >
              <span>{recentHistory[0].expression}</span>
              <span className="text-zinc-600">=</span>
              <span className="text-blue-400/80">{recentHistory[0].result}</span>
            </div>
          )
        )}

        {/* Live Calculation Display */}
        <div className="text-right space-y-1">
          {/* Active Expression with clean mathematical font */}
          <div className="text-sm sm:text-base font-mono text-zinc-400 tracking-wider truncate min-h-[1.5rem]">
            {expression || '0'}
          </div>

          {/* Large Bold Live Result */}
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white truncate">
            {result !== 0 ? result.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
          </div>
        </div>
      </div>

      {/* 3. Mathematical Keypad: Ergonomically Proportioned with Clean SVG & Typography */}
      <div className="grid grid-cols-4 gap-2 text-center shrink-0">
        {/* Row 1: Clear, Square Root (√), Power (^), Divide (÷) */}
        <button
          type="button"
          onClick={handleClear}
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-base font-bold text-amber-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleInput('√')}
          title="Square Root"
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-lg font-serif font-bold text-cyan-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          <svg className="w-5 h-5 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h3l3 8 5-16h7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => handleInput('^')}
          title="Power / Exponent"
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-base font-bold text-cyan-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          <span>xʸ</span>
        </button>
        <button
          type="button"
          onClick={() => handleInput('÷')}
          className="h-12 sm:h-13 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xl font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          ÷
        </button>

        {/* Row 2: Left Paren, Right Paren, Percent (%), Multiply (×) */}
        <button
          type="button"
          onClick={() => handleInput('(')}
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-base font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          (
        </button>
        <button
          type="button"
          onClick={() => handleInput(')')}
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-base font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          )
        </button>
        <button
          type="button"
          onClick={() => handleInput('%')}
          title="Percentage"
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-base font-bold text-cyan-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => handleInput('×')}
          className="h-12 sm:h-13 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xl font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          ×
        </button>

        {/* Row 3: 7, 8, 9, Minus (−) */}
        {['7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleInput(digit)}
            className="h-12 sm:h-13 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl font-bold font-mono text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleInput('−')}
          className="h-12 sm:h-13 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xl font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          −
        </button>

        {/* Row 4: 4, 5, 6, Plus (+) */}
        {['4', '5', '6'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleInput(digit)}
            className="h-12 sm:h-13 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl font-bold font-mono text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleInput('+')}
          className="h-12 sm:h-13 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xl font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          +
        </button>

        {/* Row 5: 1, 2, 3, Backspace (⌫) */}
        {['1', '2', '3'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleInput(digit)}
            className="h-12 sm:h-13 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl font-bold font-mono text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="h-12 sm:h-13 rounded-2xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-red-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          <Delete className="w-5 h-5" />
        </button>

        {/* Row 6: 0, Decimal (.), Convert to Tx (+Tx), Equals (=) */}
        <button
          type="button"
          onClick={() => handleInput('0')}
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl font-bold font-mono text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleInput('.')}
          className="h-12 sm:h-13 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl font-bold font-mono text-zinc-300 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleCreateTransaction}
          title={isArabic ? 'تحويل المبلغ لمعاملة جديدة' : 'Create Transaction from Amount'}
          className="h-12 sm:h-13 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 font-bold active:scale-95 transition cursor-pointer flex items-center justify-center gap-1 shadow-sm text-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tx</span>
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="h-12 sm:h-13 rounded-2xl bg-blue-600 hover:bg-blue-500 text-2xl font-bold font-mono text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-lg shadow-blue-900/50"
        >
          =
        </button>
      </div>
    </div>
  );
};
