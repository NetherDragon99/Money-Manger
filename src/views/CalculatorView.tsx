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

export const CalculatorView: React.FC<{ isBarsVisible?: boolean }> = ({ isBarsVisible: propBarsVisible }) => {
  const { settings, openAddTxModal, setIsSidebarOpen, showToast, t } = useApp();
  const isHeaderVisible = propBarsVisible !== undefined ? propBarsVisible : true;
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
  const openRootsCount = (expression.match(/√\(/g) || []).length;
  const closeParensCount = (expression.match(/\)/g) || []).length;
  const canMoveRight = activeCursor < expression.length || openRootsCount > closeParensCount;

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

    // Smart Scope Exit: if at the end of an unclosed root, auto-close and step out
    if (activeCursor === expression.length && openRoots > closeParens) {
      const next = expression + ')';
      setExpression(next);
      setCursorPos(next.length);
      const calculated = evaluateMath(next);
      if (calculated !== null) setResult(calculated);
      return;
    }

    // Step over closing parenthesis if cursor is right before it
    if (activeCursor < expression.length && expression[activeCursor] === ')') {
      setCursorPos(activeCursor + 1);
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

  // Render Expression with Visual Cursor Position Indicator integrated inside mathematical structures
  const renderExpressionWithCursor = () => {
    if (!expression) {
      return (
        <span className="inline-flex items-center">
          <span className="text-zinc-600 calc-display-zero">0</span>
          <span className="calc-caret inline-block w-[2.5px] h-5 bg-blue-500 animate-pulse align-middle ml-1 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </span>
      );
    }

    let cursorRendered = false;

    const renderCursor = () => {
      if (cursorRendered) return null;
      cursorRendered = true;
      return (
        <span
          key="calc-active-cursor"
          className="calc-caret inline-block w-[2.5px] h-5 bg-blue-500 animate-pulse align-middle mx-0.5 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"
        />
      );
    };

    const renderRange = (start: number, end: number): React.ReactNode[] => {
      const elements: React.ReactNode[] = [];
      let i = start;

      // When the sub-range is empty (e.g. inside an empty radical √( )), render the caret here if cursor points here
      if (start === end && start === activeCursor && !cursorRendered) {
        elements.push(renderCursor());
      }

      while (i < end) {
        if (i === activeCursor && !cursorRendered) {
          elements.push(renderCursor());
        }

        if (expression[i] === '√') {
          if (expression[i + 1] === '(') {
            let depth = 1;
            let j = i + 2;
            while (j < expression.length && depth > 0) {
              if (expression[j] === '(') depth++;
              else if (expression[j] === ')') depth--;
              j++;
            }
            const closeIdx = depth === 0 ? j - 1 : Math.min(j, end);
            elements.push(
              <span key={`sqrt-${i}`} className="inline-flex items-center mx-0.5 align-baseline">
                <span className="font-serif text-base sm:text-lg leading-none font-bold text-cyan-400 select-none">√</span>
                <span className="border-t-2 border-cyan-400/80 pt-0.5 px-0.5 inline-flex items-center font-mono">
                  {renderRange(i + 2, closeIdx)}
                </span>
              </span>
            );
            i = depth === 0 ? j : closeIdx;
            continue;
          } else {
            let j = i + 1;
            while (j < end && /[0-9.]/.test(expression[j])) {
              j++;
            }
            elements.push(
              <span key={`sqrt-single-${i}`} className="inline-flex items-center mx-0.5 align-baseline">
                <span className="font-serif text-base sm:text-lg leading-none font-bold text-cyan-400 select-none">√</span>
                <span className="border-t-2 border-cyan-400/80 pt-0.5 px-0.5 inline-flex items-center font-mono">
                  {renderRange(i + 1, j)}
                </span>
              </span>
            );
            i = j;
            continue;
          }
        } else if (expression[i] === '^') {
          let j = i + 1;
          if (expression[j] === '(') {
            let depth = 1;
            j++;
            while (j < expression.length && depth > 0) {
              if (expression[j] === '(') depth++;
              else if (expression[j] === ')') depth--;
              j++;
            }
            const closeIdx = depth === 0 ? j - 1 : Math.min(j, end);
            elements.push(
              <sup key={`sup-${i}`} className="text-xs font-mono font-bold text-cyan-400 ml-0.5 inline-flex items-center">
                {renderRange(i + 2, closeIdx)}
              </sup>
            );
            i = depth === 0 ? j : closeIdx;
            continue;
          } else {
            while (j < end && /[0-9.]/.test(expression[j])) {
              j++;
            }
            elements.push(
              <sup key={`sup-single-${i}`} className="text-xs font-mono font-bold text-cyan-400 ml-0.5 inline-flex items-center">
                {renderRange(i + 1, j)}
              </sup>
            );
            i = j;
            continue;
          }
        } else {
          const char = expression[i];
          const charIdx = i;
          const isOp = /[\+\-×÷=/%]/.test(char);
          elements.push(
            <span
              key={`char-${charIdx}`}
              onClick={(e) => {
                e.stopPropagation();
                setCursorPos(charIdx + 1);
              }}
              className={`cursor-pointer transition-colors ${isOp ? 'text-blue-400 font-bold px-0.5' : 'text-zinc-200 hover:text-white'}`}
            >
              {char}
            </span>
          );
          i++;
        }
      }

      // When cursor is at the end of this range (inside √ or root) and not yet rendered
      if (activeCursor === end && !cursorRendered) {
        elements.push(renderCursor());
      }

      // Root level fallback caret only if cursor is at or beyond expression length
      if (start === 0 && end === expression.length && activeCursor >= expression.length && !cursorRendered) {
        elements.push(renderCursor());
      }

      return elements.filter(Boolean);
    };

    return (
      <span className="inline-flex items-center flex-wrap justify-end select-none">
        {renderRange(0, expression.length)}
      </span>
    );
  };

  return (
    <div className="w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden bg-black text-white select-none animate-in fade-in">
      {/* 1. Unified Header Bar Across All 5 Tabs */}
      <header
        style={{
          transform: isHeaderVisible ? 'translateY(0%)' : 'translateY(-110%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`sticky top-0 z-20 h-16 md:h-20 landscape:h-12 px-4 md:px-8 border-b border-zinc-800/80 flex items-center justify-between bg-black/90 backdrop-blur-md shrink-0 ${
          isHeaderVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Menu"
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center hover:bg-zinc-800 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer active:scale-95"
          >
            <Menu className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg md:text-2xl font-black tracking-tight flex items-center gap-1.5 md:gap-2">
              <span>{isArabic ? 'الحاسبة المالية' : 'Calculator'}</span>
              <span className="text-[10px] md:text-xs font-bold px-1.5 md:px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                PRO
              </span>
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl border text-xs md:text-sm font-semibold transition cursor-pointer active:scale-95 ${
            showHistory
              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
              : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300'
          }`}
        >
          <History className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span>{isArabic ? 'السجل' : 'History'}</span>
          {showHistory ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />}
        </button>
      </header>

      {/* Main Responsive Calculator Container: Explicit Height & Clearance for Navigation Bar */}
      <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl mx-auto h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-11.5rem)] landscape:h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-9.5rem)] md:max-h-[calc(100dvh-11.5rem)] landscape:max-h-[calc(100dvh-7.5rem)] flex flex-col lg:flex-row gap-2.5 md:gap-4 p-2.5 md:p-5 flex-1 min-h-0">
        {/* 2. Display Screen with Proportional Height (25% to 30% on portrait, full height on lg:flex-row) */}
        <div className="calc-display-screen w-full lg:w-5/12 h-[28%] lg:h-full flex flex-col justify-between p-3.5 md:p-6 rounded-3xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl relative overflow-hidden shrink-0">
          {/* Animated In-Display History Tape */}
          <div
            className={`calc-history-drawer absolute inset-0 bg-zinc-950/98 backdrop-blur-md p-3.5 md:p-6 flex flex-col justify-between z-20 transition-all duration-300 ease-in-out overscroll-contain ${
              showHistory
                ? 'translate-y-0 opacity-100 pointer-events-auto'
                : '-translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 md:pb-3">
              <span className="text-[11px] md:text-sm font-bold uppercase tracking-wider text-zinc-400">
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
                  className="text-[10px] md:text-xs text-red-400 hover:underline cursor-pointer"
                >
                  {isArabic ? 'مسح الكل' : 'Clear All'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 md:space-y-2.5 my-2 md:my-3 pr-1 overscroll-contain">
              {history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs md:text-base text-zinc-500">
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
                    className="calc-history-item flex items-center justify-between p-2 md:p-3.5 rounded-xl md:rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 cursor-pointer transition text-xs md:text-base font-mono border border-transparent"
                  >
                    <div className="text-zinc-400 truncate max-w-[180px] md:max-w-xs">{item.expression}</div>
                    <div className="text-blue-400 font-bold">= {item.result.toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="w-full py-2 md:py-3 rounded-xl md:rounded-2xl bg-zinc-900 border border-zinc-800 text-xs md:text-sm font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
            >
              {isArabic ? 'إغلاق السجل' : 'Close History'}
            </button>
          </div>

          {/* Compact 1-Line Preview of Latest Calculation */}
          {recentHistory.length > 0 && !showHistory && (
            <div
              onClick={() => setShowHistory(true)}
              className="cursor-pointer text-xs md:text-sm font-mono text-zinc-500 truncate pb-0.5 md:pb-1 hover:text-zinc-400 transition flex items-center justify-end gap-1.5"
            >
              <span>{recentHistory[0].expression}</span>
              <span className="text-zinc-600">=</span>
              <span className="text-blue-400/80">{recentHistory[0].result}</span>
            </div>
          )}

          {/* Live Calculation Display with Mathematical Typography and Cursor */}
          <div className="text-right space-y-1 md:space-y-2">
            {/* Active Expression with cursor */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / (rect.width || 1)));
                const newPos = Math.round(ratio * expression.length);
                setCursorPos(newPos);
              }}
              className="calc-display-expression text-sm sm:text-base md:text-xl lg:text-2xl font-mono text-zinc-300 tracking-wider min-h-[1.75rem] md:min-h-[2.25rem] flex items-center justify-end overflow-x-auto overflow-y-hidden py-0.5 cursor-pointer hover:bg-zinc-900/30 rounded-lg px-1 transition"
            >
              {renderExpressionWithCursor()}
            </div>

            {/* Large Bold Live Result */}
            <div className="calc-display-result text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-black font-mono tracking-tight text-white truncate">
              {result !== 0 ? result.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}
            </div>
          </div>

          {/* Arrow Navigation Bar between Numbers */}
          <div className="flex items-center justify-between pt-1.5 md:pt-3 border-t border-zinc-850/80 mt-1 md:mt-2 text-zinc-400">
            <span className="text-[10px] md:text-xs font-mono text-zinc-500">
              {isArabic ? 'المؤشر' : 'Cursor'}: {activeCursor}/{expression.length}
            </span>
            <div className="flex items-center gap-1.5 md:gap-3">
              <button
                type="button"
                onClick={handleCursorLeft}
                disabled={activeCursor === 0}
                className="px-2.5 md:px-4 py-1 md:py-2 rounded-xl md:rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1.5 text-xs md:text-sm font-bold active:scale-95 cursor-pointer shadow-sm"
                title="Move Cursor Left"
              >
                <span className="text-xs md:text-base font-black select-none">◀</span>
                <span className="text-[10px] md:text-xs uppercase font-semibold">{isArabic ? 'يسار' : 'Left'}</span>
              </button>
              <button
                type="button"
                onClick={handleCursorRight}
                disabled={!canMoveRight}
                className="px-2.5 md:px-4 py-1 md:py-2 rounded-xl md:rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1.5 text-xs md:text-sm font-bold active:scale-95 cursor-pointer shadow-sm"
                title="Move Cursor Right"
              >
                <span className="text-[10px] md:text-xs uppercase font-semibold">{isArabic ? 'يمين' : 'Right'}</span>
                <span className="text-xs md:text-base font-black select-none">▶</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Mathematical Keypad: Ergonomically Proportioned flex-1 Grid Filling Available Screen */}
        <div className="w-full lg:w-7/12 flex-1 h-[72%] lg:h-full grid grid-cols-4 grid-rows-6 gap-2 md:gap-3 text-center min-h-0">
          {/* Row 1: Clear, Square Root (√), Power (^), Divide (÷) */}
          <button
            type="button"
            onClick={handleClear}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-amber-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleInput('√')}
            title="Square Root"
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-serif font-bold text-cyan-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            <svg className="w-5 h-5 md:w-8 md:h-8 fill-none stroke-current stroke-[2.5]" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h3l3 8 5-16h7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleInput('^')}
            title="Power / Exponent"
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-cyan-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            <span>xʸ</span>
          </button>
          <button
            type="button"
            onClick={() => handleInput('÷')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-2xl md:text-4xl lg:text-5xl font-black text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            ÷
          </button>

          {/* Row 2: Left Paren, Right Paren, Percent (%), Multiply (×) */}
          <button
            type="button"
            onClick={() => handleInput('(')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => handleInput(')')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            )
          </button>
          <button
            type="button"
            onClick={() => handleInput('%')}
            title="Percentage"
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-cyan-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleInput('×')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-2xl md:text-4xl lg:text-5xl font-black text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            ×
          </button>

          {/* Row 3: 7, 8, 9, Minus (−) */}
          {['7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleInput(digit)}
              className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleInput('−')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-2xl md:text-4xl lg:text-5xl font-black text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            −
          </button>

          {/* Row 4: 4, 5, 6, Plus (+) */}
          {['4', '5', '6'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleInput(digit)}
              className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleInput('+')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-2xl md:text-4xl lg:text-5xl font-black text-blue-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            +
          </button>

          {/* Row 5: 1, 2, 3, Backspace (⌫) */}
          {['1', '2', '3'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleInput(digit)}
              className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-red-400 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            <Delete className="w-5 h-5 md:w-8 md:h-8" />
          </button>

          {/* Row 6: 0, Decimal (.), Convert to Tx (+Tx), Equals (=) */}
          <button
            type="button"
            onClick={() => handleInput('0')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-white active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleInput('.')}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xl md:text-3xl lg:text-4xl font-mono font-bold text-zinc-300 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-sm"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleCreateTransaction}
            title={isArabic ? 'تحويل المبلغ لمعاملة جديدة' : 'Create Transaction from Amount'}
            className="w-full h-full rounded-2xl md:rounded-3xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 font-bold active:scale-95 transition cursor-pointer flex items-center justify-center gap-1 md:gap-2 shadow-sm text-sm md:text-xl lg:text-2xl"
          >
            <PlusCircle className="w-4 h-4 md:w-6 md:h-6" />
            <span>Tx</span>
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="calc-equals-btn w-full h-full rounded-2xl md:rounded-3xl bg-emerald-600 hover:bg-emerald-500 text-white text-2xl md:text-4xl lg:text-5xl font-black font-mono active:scale-95 transition cursor-pointer flex items-center justify-center shadow-lg shadow-emerald-600/50 border border-emerald-400/50"
          >
            <span className="leading-none select-none text-white">=</span>
          </button>
        </div>
      </div>
    </div>
  );
};
