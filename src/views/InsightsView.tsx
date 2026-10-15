import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TransactionType } from '../types';
import {
  getMonthCycleRange,
  isTransactionInRange,
  formatCurrency,
} from '../utils/dateCycle';

export const InsightsView: React.FC = () => {
  const { accounts, transactions, settings, t } = useApp();

  const [activeAnalysisType, setActiveAnalysisType] = useState<'expense' | 'income'>('expense');
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);

  // Month cycle for Public accounts
  const cycleRange = useMemo(() => {
    return getMonthCycleRange(new Date(), settings.defaultMonthStartDay, 0);
  }, [settings.defaultMonthStartDay]);

  // Public accounts set
  const publicAccountIds = useMemo(() => {
    return new Set(accounts.filter((a) => !a.isPrivate).map((a) => a.id));
  }, [accounts]);

  // Current month cycle transactions in Public accounts
  const cycleTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => isTransactionInRange(tx, cycleRange) && publicAccountIds.has(tx.accountId)
    );
  }, [transactions, cycleRange, publicAccountIds]);

  // Total balance, income, expense for current month cycle (Public accounts)
  const { totalCycleBalance, totalCycleIncome, totalCycleExpense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of cycleTransactions) {
      if (tx.type === 'income') inc += tx.amount;
      if (tx.type === 'expense') exp += tx.amount;
    }
    const bal = accounts.filter((a) => !a.isPrivate).reduce((sum, a) => sum + a.balance, 0);
    return {
      totalCycleBalance: bal,
      totalCycleIncome: inc,
      totalCycleExpense: exp,
    };
  }, [cycleTransactions, accounts]);

  // Category Breakdown for the active type (expense or income)
  const categoryAnalytics = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        icon: string;
        amount: number;
        count: number;
      }
    >();

    let totalAmount = 0;

    for (const tx of cycleTransactions) {
      if (tx.type === activeAnalysisType) {
        totalAmount += tx.amount;
        const key = tx.categoryId || tx.categoryName || 'Unknown';
        const existing = map.get(key) || {
          id: key,
          name: tx.categoryName || 'General',
          icon: tx.categoryIcon || '💵',
          amount: 0,
          count: 0,
        };
        existing.amount += tx.amount;
        existing.count += 1;
        map.set(key, existing);
      }
    }

    const list = Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { list, totalAmount };
  }, [cycleTransactions, activeAnalysisType]);

  // SECTION 3: Spending vs Income Bar Chart (4 Periods: 1-7, 8-14, 15-21, 22-End)
  const periodsData = useMemo(() => {
    const periods = [
      { label: '1 - 7', income: 0, expense: 0 },
      { label: '8 - 14', income: 0, expense: 0 },
      { label: '15 - 21', income: 0, expense: 0 },
      { label: '22 - End', income: 0, expense: 0 },
    ];

    for (const tx of cycleTransactions) {
      const day = parseInt(tx.date.slice(8, 10), 10);
      let pIdx = 0;
      if (day >= 1 && day <= 7) pIdx = 0;
      else if (day >= 8 && day <= 14) pIdx = 1;
      else if (day >= 15 && day <= 21) pIdx = 2;
      else pIdx = 3;

      if (tx.type === 'income') periods[pIdx].income += tx.amount;
      if (tx.type === 'expense') periods[pIdx].expense += tx.amount;
    }

    const maxVal = Math.max(
      1,
      ...periods.map((p) => Math.max(p.income, p.expense))
    );

    return { periods, maxVal };
  }, [cycleTransactions]);

  // Vibrant Palette for Donut slices
  const DONUT_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
    '#6366f1', // indigo
  ];

  // SVG Donut Path Builder
  const donutPaths = useMemo(() => {
    const { list, totalAmount } = categoryAnalytics;
    if (totalAmount === 0 || list.length === 0) return [];

    let currentAngle = 0;
    const size = 160;
    const center = size / 2;
    const radius = 64;
    const strokeWidth = 24;

    return list.map((item, index) => {
      const angle = (item.amount / totalAmount) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      // Arc coordinates
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;
      const pathData =
        angle >= 359.9
          ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius}`
          : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

      return {
        pathData,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
        item,
        strokeWidth,
      };
    });
  }, [categoryAnalytics]);

  const currencySymbol = settings.currencySymbol || '£';
  const displayedCategories = showAllCategories
    ? categoryAnalytics.list
    : categoryAnalytics.list.slice(0, 3);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-28 px-4 py-4 max-w-2xl mx-auto w-full space-y-5 animate-in fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black tracking-tight">{t('insights')}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {cycleRange.startDate} → {cycleRange.endDate}
        </p>
      </div>

      {/* Top Summary Block: Current Month Total Balance, Income, Expense */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            {t('totalBalance')} ({t('publicAccounts')})
          </span>
          <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
            {formatCurrency(totalCycleBalance, currencySymbol)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-zinc-800/80">
          <div className="text-left">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{t('totalIncome')}</span>
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-1">
              {formatCurrency(totalCycleIncome, currencySymbol)}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-xs font-bold text-red-400">
              <span>{t('totalExpense')}</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-red-400 mt-1">
              {formatCurrency(totalCycleExpense, currencySymbol)}
            </div>
          </div>
        </div>
      </div>

      {/* Expense / Income Toggle Segmented Control */}
      <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveAnalysisType('expense')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
            activeAnalysisType === 'expense'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          {t('expense')}
        </button>
        <button
          type="button"
          onClick={() => setActiveAnalysisType('income')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition ${
            activeAnalysisType === 'income'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          {t('income')}
        </button>
      </div>

      {/* Section 1: Top Categories */}
      <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {t('topCategories')} ({categoryAnalytics.list.length})
          </h3>
          <span className="text-xs font-mono text-zinc-400 font-bold">
            Total: {formatCurrency(categoryAnalytics.totalAmount, currencySymbol)}
          </span>
        </div>

        {categoryAnalytics.list.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">{t('noInsightsData')}</p>
        ) : (
          <div className="space-y-2.5">
            {displayedCategories.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs">
                      {item.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {item.count} {t('transactionsCount')} • {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-black text-white">
                    {formatCurrency(item.amount, currencySymbol)}
                  </div>
                </div>
              </div>
            ))}

            {/* 4th item "Show More / View All" button */}
            {categoryAnalytics.list.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="w-full py-2.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-800 text-blue-400 text-xs font-bold flex items-center justify-center gap-1 transition"
              >
                <span>{showAllCategories ? t('showLess') : `${t('viewAll')} (${categoryAnalytics.list.length})`}</span>
                {showAllCategories ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Analytics Donut Chart */}
      <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          {t('categoryShare')}
        </h3>

        {categoryAnalytics.totalAmount === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">{t('noInsightsData')}</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
            {/* SVG Donut Chart with total in center */}
            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
              <svg width="170" height="170" viewBox="0 0 160 160" className="transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="24"
                />
                {donutPaths.map((slice, i) => (
                  <path
                    key={i}
                    d={slice.pathData}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={slice.strokeWidth}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              {/* Total Amount in center hole */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                  Total
                </span>
                <span className="text-xs sm:text-sm font-black font-mono text-white tracking-tight">
                  {formatCurrency(categoryAnalytics.totalAmount, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Color-coded Legend */}
            <div className="flex-1 w-full space-y-2 max-h-48 overflow-y-auto pr-1">
              {categoryAnalytics.list.map((cat, idx) => (
                <div key={cat.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                    />
                    <span className="text-zinc-300 truncate max-w-[120px]">{cat.name}</span>
                  </div>
                  <div className="font-mono text-zinc-400 font-semibold shrink-0 pl-2">
                    {formatCurrency(cat.amount, currencySymbol)} ({cat.percentage.toFixed(0)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Spending vs Income Bar Chart */}
      <div className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {t('spendingVsIncome')}
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Income
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2.5 h-2.5 rounded bg-red-500" /> Expense
            </span>
          </div>
        </div>

        {/* 4 period towers side-by-side */}
        <div className="grid grid-cols-4 gap-3 pt-6 pb-2 items-end h-48 border-b border-zinc-800">
          {periodsData.periods.map((period, idx) => {
            const incHeight = Math.max(4, (period.income / periodsData.maxVal) * 100);
            const expHeight = Math.max(4, (period.expense / periodsData.maxVal) * 100);

            return (
              <div key={idx} className="flex flex-col items-center h-full justify-end gap-1.5">
                <div className="w-full flex items-end justify-center gap-1.5 h-36">
                  {/* Green Income Tower */}
                  <div
                    style={{ height: `${period.income > 0 ? incHeight : 4}%` }}
                    className={`w-3.5 sm:w-5 rounded-t-lg transition-all duration-500 ${
                      period.income > 0 ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                    title={`Income: ${formatCurrency(period.income, currencySymbol)}`}
                  />
                  {/* Red Expense Tower */}
                  <div
                    style={{ height: `${period.expense > 0 ? expHeight : 4}%` }}
                    className={`w-3.5 sm:w-5 rounded-t-lg transition-all duration-500 ${
                      period.expense > 0 ? 'bg-red-500' : 'bg-zinc-800'
                    }`}
                    title={`Expense: ${formatCurrency(period.expense, currencySymbol)}`}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 font-medium">{period.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
