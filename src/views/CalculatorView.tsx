import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useHeaderScroll } from '../hooks/useHeaderScroll';
import {
  Menu,
  RotateCcw,
  History,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  Delete,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
}

export const CalculatorView: React.FC = React.memo(() => {
  const { settings, openAddTxModal, setIsSidebarOpen, showToast, t } = useApp();
  const isHeaderVisible = useHeaderScroll();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<number>(0);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
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

  const activeCursor = cursorPos !== null ? Math.min(cursorPos, expression.length) : expression.length;

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

      // 2. Implicit multiplication: e.g. 5(3) -> 5*(3), (2)(3) -> (2)*(3), 5√9 -> 5*√9
      expr = expr.replace(/(\d)\(/g, '$1*(');
      expr = expr.replace(/\)(\d)/g, ')*$1');
      expr = expr.replace(/(\d|\))√/g, '$1*√');

      // 3. Auto-balance unclosed parentheses: e.g. √(25 or (5+3
      const openParens = (expr.match(/\(/g) || []).length;
      const closeParens = (expr.match(/\)/g) || []).length;
      if (openParens > closeParens) {
        expr = expr + ')'.repeat(openParens - closeParens);
      }

      // 4. Handle square roots (Item 5: iteratively transform √\(([^()]+)\) and √(\d+(?:\.\d+)?) into Math.sqrt($1))
      let maxLoops = 20;
      while (expr.includes('√') && maxLoops-- > 0) {
        const prev = expr;
        expr = expr.replace(/√\(([^()]+)\)/g, 'Math.sqrt($1)');
        expr = expr.replace(/√(\d+(?:\.\d+)?)/g, 'Math.sqrt($1)');
        if (expr === prev) {
          expr = expr.replace(/√+$/g, '');
          break;
        }
      }

      // 5. Handle percentage:
      expr = expr.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

      // 6. Sanitize: allow only numbers, math operations, and Math.sqrt
      const testSanitized = expr.replace(/Math\.sqrt/g, '');
      if (!/^[\d\s+\-*/.()**]+$/.test(testSanitized)) {
        return null;
      }

      // 7. Safely execute math function
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
    const pos = activeCursor;
    let tokenToInsert = token;

    if (token === '√') {
      // If preceded by a digit or closing parenthesis, insert implicit multiplication
      if (pos > 0 && /[\d)]/.test(expression[pos - 1])) {
        tokenToInsert = '×√(';
      } else {
        tokenToInsert = '√(';
      }
    }

    const next = expression.slice(0, pos) + tokenToInsert + expression.slice(pos);
    setExpression(next);
    setCursorPos(pos + tokenToInsert.length);

    const calculated = evaluateMath(next);
    if (calculated !== null) {
      setResult(calculated);
    }
  };

  const handleClear = () => {
    setExpression('');
    setResult(0);
    setCursorPos(null);
  };

  const handleBackspace = () => {
    const pos = activeCursor;
    if (pos <= 0) return;

    if (expression.slice(0, pos).endsWith('×√(') && expression[pos] === ')') {
      const next = expression.slice(0, pos - 3) + expression.slice(pos + 1);
      setExpression(next);
      setCursorPos(Math.max(0, pos - 3));
      const calculated = evaluateMath(next);
      setResult(calculated !== null ? calculated : 0);
      return;
    }
    if (expression.slice(0, pos).endsWith('√(') && expression[pos] === ')') {
      const next = expression.slice(0, pos - 2) + expression.slice(pos + 1);
      setExpression(next);
      setCursorPos(Math.max(0, pos - 2));
      const calculated = evaluateMath(next);
      setResult(calculated !== null ? calculated : 0);
      return;
    }

    let deleteCount = 1;
    if (expression.slice(0, pos).endsWith('×√(')) {
      deleteCount = 3;
    } else if (expression.slice(0, pos).endsWith('√(')) {
      deleteCount = 2;
    }

    const next = expression.slice(0, pos - deleteCount) + expression.slice(pos);
    const newPos = Math.max(0, Math.min(next.length, pos - deleteCount));
    setExpression(next);
    setCursorPos(newPos);

    if (!next.trim()) {
      setResult(0);
    } else {
      const calculated = evaluateMath(next);
      if (calculated !== null) {
        setResult(calculated);
      }
    }
  };

  const handleCursorLeft = () => {
    setCursorPos(Math.max(0, activeCursor - 1));
  };

  const handleCursorRight = () => {
    const openRoots = (expression.match(/√\(/g) || []).length;
    const closeParens = (expression.match(/\)/g) || []).length;

    if (activeCursor === expression.length && openRoots > closeParens) {
      const next = expression + ')';
      setExpression(next);
      setCursorPos(next.length);
      const calculated = evaluateMath(next);
      if (calculated !== null) setResult(calculated);
      return;
    }

    setCursorPos(Math.min(expression.length, activeCursor + 1));
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
      setCursorPos(String(finalVal).length);
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

  const renderMathTypography = (raw: string) => {
    if (!raw) return null;

    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '√') {
        if (raw[i + 1] === '(') {
          let depth = 1;
          let j = i + 2;
          while (j < raw.length && depth > 0) {
            if (raw[j] === '(') depth++;
            else if (raw[j] === ')') depth--;
            j++;
          }
          const radicand = raw.slice(i + 2, depth === 0 ? j - 1 : j);
          elements.push(
            <span key={i} className="inline-flex items-center mx-0.5">
              <span className="font-serif text-base sm:text-lg leading-none font-bold">√</span>
              <span className="border-t-2 border-current pt-0.5 px-0.5 inline-block font-mono">
                {renderMathTypography(radicand)}
              </span>
            </span>
          );
          i = j;
          continue;
        } else {
          let j = i + 1;
          while (j < raw.length && /[0-9.]/.test(raw[j])) {
            j++;
          }
          const radicand = raw.slice(i + 1, j);
          elements.push(
            <span key={i} className="inline-flex items-center mx-0.5">
              <span className="font-serif text-base sm:text-lg leading-none font-bold">√</span>
              <span className="border-t-2 border-current pt-0.5 px-0.5 inline-block font-mono">
                {radicand || ' '}
              </span>
            </span>
          );
          i = j;
          continue;
        }
      } else if (raw[i] === '^') {
        let j = i + 1;
        if (raw[j] === '(') {
          let depth = 1;
          j++;
          while (j < raw.length && depth > 0) {
            if (raw[j] === '(') depth++;
            else if (raw[j] === ')') depth--;
            j++;
          }
          const exp = raw.slice(i + 2, depth === 0 ? j - 1 : j);
          elements.push(
            <sup key={i} className="text-xs font-mono font-bold text-cyan-400 ml-0.5">
              {exp}
            </sup>
          );
          i = j;
          continue;
        } else {
          while (j < raw.length && /[0-9.]/.test(raw[j])) {
            j++;
          }
          const exp = raw.slice(i + 1, j);
          elements.push(
            <sup key={i} className="text-xs font-mono font-bold text-cyan-400 ml-0.5">
              {exp || ' '}
            </sup>
          );
          i = j;
          continue;
        }
      } else {
        let j = i + 1;
        while (j < raw.length && raw[j] !== '√' && raw[j] !== '^') {
          j++;
        }
        elements.push(<span key={i}>{raw.slice(i, j)}</span>);
        i = j;
      }
    }
    return elements;
  };

  // Render Expression with Visual Cursor Position Indicator
  const renderExpressionWithCursor = () => {
    if (!expression) {
      return (
        <span className="inline-flex items-center">
          <span className="text-zinc-600 calc-display-zero">0</span>
          <span className="inline-block w-[2.5px] h-5 bg-blue-500 animate-pulse align-middle ml-1 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </span>
      );
    }

    const before = expression.slice(0, activeCursor);
    const after = expression.slice(activeCursor);

    return (
      <span className="inline-flex items-center flex-wrap justify-end select-none">
        <span
          onClick={(e) => {
            e.stopPropagation();
            setCursorPos(0);
          }}
          className="cursor-pointer"
        >
          {renderMathTypography(before)}
        </span>
        <span className="inline-block w-[2.5px] h-5 bg-blue-500 animate-pulse align-middle mx-0.5 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        <span
          onClick={(e) => {
            e.stopPropagation();
            setCursorPos(expression.length);
          }}
          className="cursor-pointer"
        >
          {renderMathTypography(after)}
        </span>
      </span>
    );
  };

  return (
    <div className="h-[calc(100dvh-4.25rem)] sm:h-[calc(100dvh-4.75rem)] w-full max-w-lg md:max-w-2xl mx-auto flex flex-col justify-between overflow-hidden bg-black text-white px-3.5 pt-1 pb-2 select-none animate-in fade-in">
      {/* 1. Unified Header Bar Across All 5 Tabs (Standardized h-16) */}
      <header className={`sticky top-0 z-30 h-16 px-4 border-b border-zinc-800/80 flex items-center justify-between bg-black/90 backdrop-blur-md shrink-0 -mx-3.5 -mt-1 mb-2 transition-all duration-200 ease-in-out ${
        isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Menu"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-800 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5">
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer active:scale-95 ${
            showHistory
              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
              : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{isArabic ? 'السجل' : 'History'}</span>
          {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </header>

      {/* 2. Display Screen with Smooth Animated History Drawer */}
      <div className="calc-display-screen flex-1 flex flex-col justify-end p-4 rounded-3xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl relative overflow-hidden my-2">
        {/* Animated In-Display History Tape */}
        <div
          className={`calc-history-drawer absolute inset-0 bg-zinc-950/98 backdrop-blur-md p-3.5 flex flex-col justify-between z-20 transition-all duration-300 ease-in-out overscroll-contain ${
            showHistory
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-full opacity-0 pointer-events-none'
          }`}
        >
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
                    setCursorPos(String(item.result).length);
                    setShowHistory(false);
                  }}
                  className="calc-history-item flex items-center justify-between p-2 rounded-xl bg-zinc-900/70 hover:bg-zinc-850 cursor-pointer transition text-xs font-mono border border-transparent"
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

        {/* Compact 1-Line Preview of Latest Calculation */}
        {recentHistory.length > 0 && !showHistory && (
          <div
            onClick={() => setShowHistory(true)}
            className="cursor-pointer text-xs font-mono text-zinc-500 truncate pb-1 hover:text-zinc-400 transition flex items-center justify-end gap-1.5"
          >
            <span>{recentHistory[0].expression}</span>
            <span className="text-zinc-600">=</span>
            <span className="text-blue-400/80">{recentHistory[0].result}</span>
          </div>
        )}

        {/* Live Calculation Display with True Mathematical Typography and Cursor */}
        <div className="text-right space-y-1.5">
          {/* Active Expression with cursor */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / (rect.width || 1)));
              const newPos = Math.round(ratio * expression.length);
              setCursorPos(newPos);
            }}
            className="calc-display-expression text-sm sm:text-base font-mono text-zinc-300 tracking-wider min-h-[1.75rem] flex items-center justify-end overflow-x-auto overflow-y-hidden py-0.5 cursor-pointer hover:bg-zinc-900/30 rounded-lg px-1 transition"
          >
            {renderExpressionWithCursor()}
          </div>

          {/* Large Bold Live Result */}
          <div className="calc-display-result text-3xl sm:text-4xl font-black font-mono tracking-tight text-white truncate">
            {result !== 0 ? result.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
          </div>
        </div>

        {/* Arrow Navigation Bar between Numbers (Item 6: ◀ and ▶) */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-850/80 mt-2 text-zinc-400">
          <span className="text-[10px] font-mono text-zinc-500">
            {isArabic ? 'المؤشر' : 'Cursor'}: {activeCursor}/{expression.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCursorLeft}
              disabled={activeCursor === 0}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-sm"
              title="Move Cursor Left"
            >
              <span className="text-sm font-black select-none">◀</span>
              <span className="text-[10px] uppercase font-semibold">{isArabic ? 'يسار' : 'Left'}</span>
            </button>
            <button
              type="button"
              onClick={handleCursorRight}
              disabled={activeCursor === expression.length}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer shadow-sm"
              title="Move Cursor Right"
            >
              <span className="text-[10px] uppercase font-semibold">{isArabic ? 'يمين' : 'Right'}</span>
              <span className="text-sm font-black select-none">▶</span>
            </button>
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
          className="calc-equals-btn h-12 sm:h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-black font-mono active:scale-95 transition cursor-pointer flex items-center justify-center shadow-lg shadow-emerald-600/50 border border-emerald-400/50"
        >
          <span className="text-2xl font-black leading-none select-none text-white">=</span>
        </button>
      </div>
    </div>
  );
});
