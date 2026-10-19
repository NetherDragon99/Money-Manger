import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calculator as CalcIcon,
  RotateCcw,
  History,
  ArrowRight,
  PlusCircle,
  Delete,
  Sparkles,
  Percent,
} from 'lucide-react';
import { formatCurrency } from '../utils/dateCycle';

interface HistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
}

export const CalculatorView: React.FC = () => {
  const { settings, openAddTxModal, t } = useApp();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<number>(0);
  const [memory, setMemory] = useState<number>(0);
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

  // Evaluates a mathematical expression safely
  const calculateResult = (expr: string): number | null => {
    if (!expr.trim()) return 0;
    try {
      // Replace visual operators with JS operators
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/%/g, '/100');

      // Only allow safe math tokens
      if (!/^[\d\s+\-*/.()]+$/.test(sanitized)) {
        return null;
      }

      // eslint-disable-next-line no-new-func
      const evalFn = new Function(`return (${sanitized})`);
      const val = evalFn();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return Math.round(val * 10000) / 10000;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleInput = (char: string) => {
    const next = expression + char;
    setExpression(next);
    const evalRes = calculateResult(next);
    if (evalRes !== null) {
      setResult(evalRes);
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
      const next = expression.slice(0, -1);
      setExpression(next);
      const evalRes = calculateResult(next);
      if (evalRes !== null) {
        setResult(evalRes);
      }
    }
  };

  const handleEquals = () => {
    const finalVal = calculateResult(expression);
    if (finalVal !== null && expression.trim()) {
      setResult(finalVal);
      setExpression(String(finalVal));

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
      } catch {
        // Ignore storage errors
      }
    }
  };

  // Quick Percentage Helper (e.g. +14% VAT or -10% discount)
  const handleQuickPercent = (percentVal: number) => {
    const currentNum = result !== 0 ? result : (parseFloat(expression) || 0);
    if (currentNum === 0) return;

    const multiplier = 1 + percentVal / 100;
    const computed = Math.round(currentNum * multiplier * 100) / 100;
    setExpression(String(computed));
    setResult(computed);
  };

  // Memory operations
  const handleMemoryClear = () => setMemory(0);
  const handleMemoryRecall = () => {
    if (memory !== 0) {
      handleInput(String(memory));
    }
  };
  const handleMemoryAdd = () => {
    const cur = result !== 0 ? result : (parseFloat(expression) || 0);
    setMemory((prev) => prev + cur);
  };
  const handleMemorySubtract = () => {
    const cur = result !== 0 ? result : (parseFloat(expression) || 0);
    setMemory((prev) => prev - cur);
  };

  // Quick Action: Send Calculated Number directly to Add Transaction modal
  const handleCreateTransaction = () => {
    const finalAmount = result !== 0 ? Math.abs(result) : Math.abs(parseFloat(expression) || 0);
    if (finalAmount <= 0) return;
    openAddTxModal(undefined, finalAmount);
  };

  return (
    <div className="bg-black text-white flex flex-col pb-20 px-4 py-3 max-w-[480px] mx-auto w-full space-y-3 animate-in fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <CalcIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">
              {isArabic ? 'الحاسبة المالية الذكية' : 'Financial Calculator'}
            </h2>
            <p className="text-xs text-zinc-400">
              {isArabic ? 'حساب دقيق وتحويل مباشر للمعاملات' : 'Smart calculations & instant transaction export'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
            showHistory
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{isArabic ? 'السجل' : 'History'}</span>
        </button>
      </div>

      {/* History Tape Drawer */}
      {showHistory && (
        <div className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3 animate-in fade-in max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {isArabic ? 'سجل العمليات الحسابية' : 'Calculation Tape'}
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('calc_history');
                }}
                className="text-[11px] text-red-400 hover:underline"
              >
                {isArabic ? 'مسح السجل' : 'Clear All'}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="text-center py-4 text-xs text-zinc-500">
              {isArabic ? 'لا توجد عمليات سابقة' : 'No previous calculations'}
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setExpression(String(item.result));
                    setResult(item.result);
                  }}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 cursor-pointer transition"
                >
                  <div className="text-xs font-mono text-zinc-400 truncate max-w-[180px]">
                    {item.expression}
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-400">
                    = {item.result.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calculator Display Screen */}
      <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800/80 shadow-2xl relative space-y-2 text-right">
        {/* Memory Indicator */}
        <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span className={memory !== 0 ? 'text-amber-400 font-bold' : ''}>
            {memory !== 0 ? `[M: ${memory}]` : ''}
          </span>
          <span className="truncate max-w-[240px] text-zinc-400 font-mono text-sm">
            {expression || '0'}
          </span>
        </div>

        {/* Big Bold Current Result */}
        <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white truncate">
          {result !== 0 ? result.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
        </div>
      </div>

      {/* Quick Tax & Discount Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => handleQuickPercent(14)}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-emerald-400 hover:bg-zinc-800 transition shrink-0 cursor-pointer"
        >
          +14% VAT
        </button>
        <button
          type="button"
          onClick={() => handleQuickPercent(10)}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-emerald-400 hover:bg-zinc-800 transition shrink-0 cursor-pointer"
        >
          +10%
        </button>
        <button
          type="button"
          onClick={() => handleQuickPercent(-10)}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-rose-400 hover:bg-zinc-800 transition shrink-0 cursor-pointer"
        >
          -10% Off
        </button>
        <button
          type="button"
          onClick={() => handleQuickPercent(-20)}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-rose-400 hover:bg-zinc-800 transition shrink-0 cursor-pointer"
        >
          -20% Off
        </button>
      </div>

      {/* Memory Bar */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={handleMemoryClear}
          className="py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer"
        >
          MC
        </button>
        <button
          type="button"
          onClick={handleMemoryRecall}
          className="py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer"
        >
          MR
        </button>
        <button
          type="button"
          onClick={handleMemoryAdd}
          className="py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer"
        >
          M+
        </button>
        <button
          type="button"
          onClick={handleMemorySubtract}
          className="py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer"
        >
          M-
        </button>
      </div>

      {/* Ergonomic Scientific & Math Keypad */}
      <div className="grid grid-cols-4 gap-2 text-center select-none">
        {/* Row 1 */}
        <button
          type="button"
          onClick={handleClear}
          className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-bold text-amber-400 hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleInput('(')}
          className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-base font-bold text-blue-400 hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
        >
          (
        </button>
        <button
          type="button"
          onClick={() => handleInput(')')}
          className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-base font-bold text-blue-400 hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
        >
          )
        </button>
        <button
          type="button"
          onClick={() => handleInput('÷')}
          className="h-11 sm:h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-xl font-bold text-blue-400 hover:bg-blue-600/30 active:scale-95 transition cursor-pointer"
        >
          ÷
        </button>

        {/* Row 2 */}
        {['7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleInput(d)}
            className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-lg font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleInput('×')}
          className="h-11 sm:h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-xl font-bold text-blue-400 hover:bg-blue-600/30 active:scale-95 transition cursor-pointer"
        >
          ×
        </button>

        {/* Row 3 */}
        {['4', '5', '6'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleInput(d)}
            className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-lg font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleInput('−')}
          className="h-11 sm:h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-xl font-bold text-blue-400 hover:bg-blue-600/30 active:scale-95 transition cursor-pointer"
        >
          −
        </button>

        {/* Row 4 */}
        {['1', '2', '3'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleInput(d)}
            className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-lg font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleInput('+')}
          className="h-11 sm:h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 text-xl font-bold text-blue-400 hover:bg-blue-600/30 active:scale-95 transition cursor-pointer"
        >
          +
        </button>

        {/* Row 5 */}
        <button
          type="button"
          onClick={() => handleInput('.')}
          className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-bold font-mono text-zinc-300 hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => handleInput('0')}
          className="h-11 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-lg font-bold font-mono text-white hover:bg-zinc-850 active:scale-95 transition cursor-pointer"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="h-11 sm:h-12 rounded-xl bg-zinc-850 border border-zinc-750 text-zinc-300 hover:text-red-400 active:scale-95 flex items-center justify-center transition cursor-pointer"
        >
          <Delete className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="h-11 sm:h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-2xl font-bold font-mono text-white shadow-lg shadow-blue-900/40 active:scale-95 transition cursor-pointer"
        >
          =
        </button>
      </div>

      {/* Action Banner: Convert Result directly to Transaction */}
      {(result > 0 || (parseFloat(expression) || 0) > 0) && (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleCreateTransaction}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {isArabic
                ? `تسجيل معاملة بهذا المبلغ (${formatCurrency(result || parseFloat(expression), currencySymbol)})`
                : `Create Transaction from Result (${formatCurrency(result || parseFloat(expression), currencySymbol)})`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
