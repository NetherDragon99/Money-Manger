import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ArrowDownRight,
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

  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');

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

  // Current cycle transactions for income calculation
  const cycleIncomeTxs = useMemo(() => {
    return transactions.filter(
      (tx) => tx.type === 'income' && isTransactionInRange(tx, cycleRange)
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

  // Income received per category in this cycle
  const categoryIncomeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of cycleIncomeTxs) {
      if (tx.categoryId) {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
      }
    }
    return map;
  }, [cycleIncomeTxs]);

  // Frequency of each category used in all transactions (for smart default sort)
  const categoryFrequencyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.categoryId) {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + 1);
      }
    }
    return map;
  }, [transactions]);

  // Expense categories sorted
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

  // Income categories sorted
  const incomeCategories = useMemo(() => {
    return categories
      .filter((c) => c.type === 'income')
      .sort((a, b) => {
        const incA = categoryIncomeMap.get(a.id) || 0;
        const incB = categoryIncomeMap.get(b.id) || 0;
        if (incA !== incB) return incB - incA;
        return a.name.localeCompare(b.name);
      });
  }, [categories, categoryIncomeMap]);

  // Top Summary Block: Total of all active category budgets for current cycle
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

  // Total income received in cycle
  const totalIncomeReceived = useMemo(() => {
    return cycleIncomeTxs.reduce((sum, tx) => sum + tx.amount, 0);
  }, [cycleIncomeTxs]);

  const remainingBudget = totalBudget - totalSpent;
  const isOverBudget = remainingBudget < 0;
  const overallPercentage =
    totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

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
          <h2 className="text-xl font-black tracking-tight">{t('budget')} & Categories</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cycle: {cycleRange.startDate} → {cycleRange.endDate}
          </p>
        </div>
        <button
          type="button"
          onClick={openAddCategoryModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-blue-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addCategory')}</span>
        </button>
      </div>

      {/* Top Summary Block */}
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
            <span>
              {totalBudget > 0
                ? `${expenseCategories.filter((c) => c.budgetLimit > 0).length} active budgets`
                : 'No limits set'}
            </span>
          </div>
        </div>
      </div>

      {/* Segmented Control: Expense Categories vs Income Categories */}
      <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
        <button
          type="button"
          onClick={() => setCategoryTab('expense')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            categoryTab === 'expense'
              ? 'bg-zinc-800 text-white shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          {settings.language === 'ar' ? 'فئات المصروفات' : 'Expense Categories'} ({expenseCategories.length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryTab('income')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            categoryTab === 'income'
              ? 'bg-zinc-800 text-emerald-400 shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          {settings.language === 'ar' ? 'فئات الإيرادات (الواردة)' : 'Income Categories'} ({incomeCategories.length})
        </button>
      </div>

      {/* EXPENSE CATEGORIES TAB */}
      {categoryTab === 'expense' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {settings.language === 'ar' ? 'ميزانية فئات المصروفات' : 'Expense Budgets'} ({expenseCategories.length})
            </h3>
            <span className="text-[11px] text-zinc-500">
              {settings.language === 'ar' ? 'انقر على الفئة لتعديلها أو حذفها' : 'Tap card to edit or delete'}
            </span>
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
                              <AlertCircle className="w-3 h-3" /> Over by{' '}
                              {formatCurrency(spent - cat.budgetLimit, currencySymbol)}
                            </span>
                          ) : (
                            <span>
                              {formatCurrency(cat.budgetLimit - spent, currencySymbol)} remaining
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: £ Spent / £ Budget */}
                  <div className="text-right shrink-0 pl-3">
                    {hasBudget ? (
                      <div>
                        <div className="text-sm font-black font-mono text-white">
                          {formatCurrency(spent, currencySymbol)}
                          <span className="text-xs font-normal text-zinc-500">
                            {' '}
                            / {formatCurrency(cat.budgetLimit, currencySymbol)}
                          </span>
                        </div>
                        <div className="w-24 sm:w-32 h-1.5 rounded-full bg-zinc-950 overflow-hidden mt-1.5 ml-auto">
                          <div
                            style={{ width: `${catProgress}%` }}
                            className={`h-full rounded-full ${
                              isCatOver
                                ? 'bg-red-500'
                                : catProgress > 85
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-xs font-mono font-medium text-zinc-400">
                          {spent > 0 ? formatCurrency(spent, currencySymbol) : 'No budget'}
                        </span>
                        <div className="text-[10px] text-zinc-500">Tap to set limit</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INCOME CATEGORIES TAB */}
      {categoryTab === 'income' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {settings.language === 'ar' ? 'فئات الإيرادات والدخل الوارد' : 'Incoming Income Categories'} ({incomeCategories.length})
            </h3>
            <span className="text-[11px] text-zinc-500">
              {settings.language === 'ar' ? 'انقر على الفئة لتعديلها أو حذفها' : 'Tap card to edit or delete'}
            </span>
          </div>

          {/* Income Summary Banner */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-xs text-zinc-300">
                  {settings.language === 'ar' ? 'إجمالي الدخل الوارد بهذه الدورة' : 'Total Cycle Income Received'}
                </div>
                <div className="text-lg font-black font-mono text-emerald-400">
                  {formatCurrency(totalIncomeReceived, currencySymbol)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddCategoryModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-900/30 cursor-pointer"
            >
              + {settings.language === 'ar' ? 'إضافة فئة دخل' : 'Add Income Category'}
            </button>
          </div>

          {incomeCategories.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-3xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 space-y-3">
              <div className="text-3xl">💰</div>
              <p className="text-sm font-semibold text-white">
                {settings.language === 'ar' ? 'لا توجد فئات دخل حتى الآن' : 'No income categories yet'}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {settings.language === 'ar'
                  ? 'أضف فئات مثل الراتب، المكافآت، الاستثمارات، وغيرها لتصنيف الدخل الوارد.'
                  : 'Add categories like Salary, Freelance, or Investments to track where your money comes from.'}
              </p>
              <button
                type="button"
                onClick={openAddCategoryModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{settings.language === 'ar' ? 'إنشاء فئة واردة جديدة' : 'Create Income Category'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {incomeCategories.map((cat) => {
                const received = categoryIncomeMap.get(cat.id) || 0;

                return (
                  <div
                    key={cat.id}
                    onClick={() => openEditCategoryModal(cat)}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-center text-2xl shrink-0">
                        {cat.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-xs group-hover:text-emerald-300 transition">
                          {cat.name}
                        </div>
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          {settings.language === 'ar' ? 'فئة دخل واردة' : 'Incoming Category'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black font-mono text-emerald-400">
                        +{formatCurrency(received, currencySymbol)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {settings.language === 'ar' ? 'انقر للتعديل أو الحذف' : 'Tap to edit/delete'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
