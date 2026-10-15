import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  GripVertical,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Category } from '../types';
import {
  getMonthCycleRange,
  isTransactionInRange,
  formatCurrency,
} from '../utils/dateCycle';

export const BudgetView: React.FC = () => {
  const {
    categories,
    transactions,
    settings,
    openEditCategoryModal,
    openAddCategoryModal,
    reorderCategories,
    t,
  } = useApp();

  // Current monthly cycle date range based on Global Default Month Start Day
  const cycleRange = useMemo(() => {
    return getMonthCycleRange(new Date(), settings.defaultMonthStartDay, 0);
  }, [settings.defaultMonthStartDay]);

  // Current cycle transactions for expense calculation
  const cycleExpenseTxs = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === 'expense' && isTransactionInRange(tx, cycleRange)
    );
  }, [transactions, cycleRange]);

  // Spent amount per category in this cycle
  const categorySpentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of cycleExpenseTxs) {
      if (tx.categoryId) {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
      }
    }
    return map;
  }, [cycleExpenseTxs]);

  // Transaction count per category for smart sorting
  const categoryFrequencyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.categoryId) {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + 1);
      }
    }
    return map;
  }, [transactions]);

  // Expense categories sorted:
  // If user has a persisted manual order (settings.categoryOrder), use that.
  // Otherwise, smart default sort:
  // 1. Categories with an active Budget (budget > 0) first.
  // 2. Most frequently used categories next.
  // 3. Remaining categories last.
  const expenseCategories = useMemo(() => {
    const expOnly = categories.filter((c) => c.type === 'expense');

    if (settings.categoryOrder && settings.categoryOrder.length > 0) {
      const orderMap = new Map(settings.categoryOrder.map((id, index) => [id, index]));
      return [...expOnly].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
        const orderB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
        return orderA - orderB;
      });
    }

    return [...expOnly].sort((a, b) => {
      // 1. Active budget first
      const hasBudgetA = a.budgetLimit > 0 ? 1 : 0;
      const hasBudgetB = b.budgetLimit > 0 ? 1 : 0;
      if (hasBudgetA !== hasBudgetB) return hasBudgetB - hasBudgetA;

      // 2. Most frequently used next
      const freqA = categoryFrequencyMap.get(a.id) || 0;
      const freqB = categoryFrequencyMap.get(b.id) || 0;
      if (freqA !== freqB) return freqB - freqA;

      // 3. Remaining by name
      return a.name.localeCompare(b.name);
    });
  }, [categories, settings.categoryOrder, categoryFrequencyMap]);

  // Top Summary Block:
  // Total of all active category budgets for current cycle
  const { totalBudget, totalSpent } = useMemo(() => {
    let bSum = 0;
    let sSum = 0;
    for (const cat of expenseCategories) {
      if (cat.budgetLimit > 0) {
        bSum += cat.budgetLimit;
        const spent = categorySpentMap.get(cat.id) || 0;
        sSum += spent;
      }
    }
    return { totalBudget: bSum, totalSpent: sSum };
  }, [expenseCategories, categorySpentMap]);

  const remainingBudget = totalBudget - totalSpent;
  const isOverBudget = totalSpent > totalBudget && totalBudget > 0;
  const overallPercentage = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  // Move up/down handlers
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= expenseCategories.length) return;

    const list = [...expenseCategories];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const orderedIds = list.map((c) => c.id);
    reorderCategories(orderedIds);
  };

  const currencySymbol = settings.currencySymbol || '£';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-28 px-4 py-4 max-w-2xl mx-auto w-full space-y-5 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight">{t('budget')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cycle: {cycleRange.startDate} → {cycleRange.endDate}
          </p>
        </div>
        <button
          type="button"
          onClick={openAddCategoryModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-blue-400 hover:text-white hover:border-zinc-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addCategory')}</span>
        </button>
      </div>

      {/* Top Summary Block: Total Spent / Total Budget, Remaining Budget, progress bar */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t('totalBudget')}
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5">
              {formatCurrency(totalSpent, currencySymbol)}{' '}
              <span className="text-sm font-normal text-zinc-500">
                / {formatCurrency(totalBudget, currencySymbol)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isOverBudget ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {isOverBudget ? t('overBudget') : t('remainingBudget')}
            </span>
            <div
              className={`text-xl sm:text-2xl font-black font-mono mt-0.5 ${
                isOverBudget ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {formatCurrency(Math.abs(remainingBudget), currencySymbol)}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar (turns Red if over budget) */}
        <div className="space-y-1.5">
          <div className="w-full h-3 rounded-full bg-zinc-950 border border-zinc-800/80 overflow-hidden p-0.5">
            <div
              style={{ width: `${totalBudget > 0 ? overallPercentage : 0}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget
                  ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                  : overallPercentage > 85
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
            <span>{Math.round(overallPercentage)}% used</span>
            <span>{totalBudget > 0 ? `${expenseCategories.filter((c) => c.budgetLimit > 0).length} active budgets` : 'No limits set'}</span>
          </div>
        </div>
      </div>

      {/* Reorderable Category Budget List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Category Budgets ({expenseCategories.length})
          </h3>
          <span className="text-[11px] text-zinc-500">Tap card to edit</span>
        </div>

        <div className="space-y-2.5">
          {expenseCategories.map((cat, idx) => {
            const spent = categorySpentMap.get(cat.id) || 0;
            const hasBudget = cat.budgetLimit > 0;
            const isCatOver = hasBudget && spent > cat.budgetLimit;
            const catProgress = hasBudget ? Math.min(100, (spent / cat.budgetLimit) * 100) : 0;

            return (
              <div
                key={cat.id}
                onClick={() => openEditCategoryModal(cat)}
                role="button"
                tabIndex={0}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition cursor-pointer group"
              >
                {/* Left: Move buttons + Category Emoji + Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Move Up/Down Controls */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-col gap-0.5 text-zinc-500"
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      aria-label="Move Up"
                      className="p-1 hover:text-white disabled:opacity-20 transition"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === expenseCategories.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      aria-label="Move Down"
                      className="p-1 hover:text-white disabled:opacity-20 transition"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl shrink-0">
                    {cat.icon}
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-xs group-hover:text-blue-300 transition">
                      {cat.name}
                    </div>
                    {hasBudget && (
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {isCatOver ? (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Over by {formatCurrency(spent - cat.budgetLimit, currencySymbol)}
                          </span>
                        ) : (
                          <span>{formatCurrency(cat.budgetLimit - spent, currencySymbol)} remaining</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: £ Spent / £ Budget OR "Edit" if no budget is set */}
                <div className="text-right shrink-0 pl-3">
                  {hasBudget ? (
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-bold text-white">
                        <span className={isCatOver ? 'text-red-400 font-black' : 'text-zinc-200'}>
                          {formatCurrency(spent, currencySymbol)}
                        </span>{' '}
                        <span className="text-zinc-500">/ {formatCurrency(cat.budgetLimit, currencySymbol)}</span>
                      </div>
                      <div className="w-24 h-1.5 rounded-full bg-zinc-950 overflow-hidden ml-auto">
                        <div
                          style={{ width: `${catProgress}%` }}
                          className={`h-full rounded-full ${
                            isCatOver ? 'bg-red-500' : catProgress > 80 ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-blue-400 group-hover:underline">
                      Set Budget
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Button: A clear "+ Add Category" button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={openAddCategoryModal}
            className="w-full py-3.5 rounded-2xl bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>{t('addCategory')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
