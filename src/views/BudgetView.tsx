import React, { useMemo, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ArrowDownRight,
  Search,
  X,
  Menu,
  Check,
} from 'lucide-react';
import { Category } from '../types';
import {
  getMonthCycleRange,
  isTransactionInRange,
  formatCurrency,
} from '../utils/dateCycle';
import { SmartBudgetAlertBanner } from '../components/SmartBudgetAlertBanner';
import { useHeaderScroll } from '../hooks/useHeaderScroll';
import { useLongPress } from '../hooks/useLongPress';

interface ExpenseCategoryRowProps {
  cat: Category;
  originalIdx: number;
  totalCategories: number;
  isSelected: boolean;
  isCategoryMultiSelect: boolean;
  spent: number;
  currencySymbol: string;
  language: 'en' | 'ar';
  onMove: (idx: number, dir: 'up' | 'down', type: 'expense') => void;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
}

const ExpenseCategoryRow: React.FC<ExpenseCategoryRowProps> = ({
  cat,
  originalIdx,
  totalCategories,
  isSelected,
  isCategoryMultiSelect,
  spent,
  currencySymbol,
  language,
  onMove,
  onSelect,
  onToggle,
  onEdit,
}) => {
  const { handlers } = useLongPress({
    onLongPress: onSelect,
    onClick: () => {
      if (isCategoryMultiSelect) {
        onToggle();
      } else {
        onEdit();
      }
    },
  });

  const hasBudget = Boolean(cat.budgetLimit && cat.budgetLimit > 0);
  const isCatOver = Boolean(hasBudget && spent > cat.budgetLimit);
  const isCatNear = Boolean(hasBudget && !isCatOver && spent >= cat.budgetLimit * 0.8);
  const catProgress = hasBudget ? Math.min(100, (spent / cat.budgetLimit) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-2xl bg-zinc-900 border transition group ${
        isSelected
          ? 'border-blue-500/80 bg-blue-950/20 shadow-md shadow-blue-900/20'
          : 'border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
      }`}
    >
      {/* Distinct Reorder Controls */}
      <div
        className="flex flex-col gap-1 shrink-0 z-10"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={originalIdx <= 0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (originalIdx > 0) onMove(originalIdx, 'up', 'expense');
          }}
          aria-label="Move Up"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 active:bg-blue-600 active:text-white disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={originalIdx >= totalCategories - 1}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (originalIdx < totalCategories - 1) onMove(originalIdx, 'down', 'expense');
          }}
          aria-label="Move Down"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 active:bg-blue-600 active:text-white disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Category Body */}
      <div
        {...handlers}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect();
        }}
        role="button"
        tabIndex={0}
        className="flex-1 flex items-center justify-between min-w-0 cursor-pointer pl-1 active:scale-[0.99] transition select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isCategoryMultiSelect && (
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          )}
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
                    {formatCurrency(spent - cat.budgetLimit, currencySymbol, language)}
                  </span>
                ) : (
                  <span>
                    {formatCurrency(cat.budgetLimit - spent, currencySymbol, language)} remaining
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
                {formatCurrency(spent, currencySymbol, language)}
                <span className="text-xs font-normal text-zinc-500">
                  {' '}
                  / {formatCurrency(cat.budgetLimit, currencySymbol, language)}
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
                {spent > 0 ? formatCurrency(spent, currencySymbol, language) : 'No budget'}
              </span>
              <div className="text-[10px] text-zinc-500">Tap to set limit</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface IncomeCategoryRowProps {
  cat: Category;
  originalIdx: number;
  totalCategories: number;
  isSelected: boolean;
  isCategoryMultiSelect: boolean;
  received: number;
  currencySymbol: string;
  language: 'en' | 'ar';
  onMove: (idx: number, dir: 'up' | 'down', type: 'income') => void;
  onSelect: () => void;
  onToggle: () => void;
  onEdit: () => void;
}

const IncomeCategoryRow: React.FC<IncomeCategoryRowProps> = ({
  cat,
  originalIdx,
  totalCategories,
  isSelected,
  isCategoryMultiSelect,
  received,
  currencySymbol,
  language,
  onMove,
  onSelect,
  onToggle,
  onEdit,
}) => {
  const { handlers } = useLongPress({
    onLongPress: onSelect,
    onClick: () => {
      if (isCategoryMultiSelect) {
        onToggle();
      } else {
        onEdit();
      }
    },
  });

  return (
    <div
      className={`flex items-center gap-2 p-2.5 sm:p-3 rounded-2xl bg-zinc-900 border transition group ${
        isSelected
          ? 'border-emerald-500/80 bg-emerald-950/20 shadow-md shadow-emerald-900/20'
          : 'border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700'
      }`}
    >
      {/* Reorder Controls */}
      <div
        className="flex flex-col gap-1 shrink-0 z-10"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={originalIdx <= 0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (originalIdx > 0) onMove(originalIdx, 'up', 'income');
          }}
          aria-label="Move Up"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 active:bg-emerald-600 active:text-white disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={originalIdx >= totalCategories - 1}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (originalIdx < totalCategories - 1) onMove(originalIdx, 'down', 'income');
          }}
          aria-label="Move Down"
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 active:bg-emerald-600 active:text-white disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Category Body */}
      <div
        {...handlers}
        onContextMenu={(e) => {
          e.preventDefault();
          onSelect();
        }}
        role="button"
        tabIndex={0}
        className="flex-1 flex items-center justify-between min-w-0 cursor-pointer pl-1 active:scale-[0.99] transition select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isCategoryMultiSelect && (
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border transition shrink-0 ${
                isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-zinc-700 bg-zinc-950 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="w-11 h-11 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-center text-2xl shrink-0">
            {cat.icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-xs group-hover:text-emerald-300 transition">
              {cat.name}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">
              {language === 'ar' ? 'فئة دخل واردة' : 'Incoming Category'}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-sm font-black font-mono text-emerald-400">
            +{formatCurrency(received, currencySymbol, language)}
          </div>
          <div className="text-[10px] text-zinc-500">
            {language === 'ar' ? 'انقر للتعديل أو الحذف' : 'Tap to edit/delete'}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BudgetView: React.FC<{ isBarsVisible?: boolean }> = ({ isBarsVisible: propBarsVisible }) => {
  const {
    categories,
    transactions,
    settings,
    openEditCategoryModal,
    openAddCategoryModal,
    reorderCategories,
    setIsSidebarOpen,
    isCategoryMultiSelect,
    selectedCategoryIds,
    startCategoryMultiSelect,
    toggleCategorySelection,
    t,
  } = useApp();

  const isHeaderVisible = propBarsVisible !== undefined ? propBarsVisible : true;

  const [categoryTab, setCategoryTab] = useState<'expense' | 'income'>('expense');
  const [searchQuery, setSearchQuery] = useState('');

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleSubTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleSubTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      const isRtl = settings.language === 'ar';
      if ((!isRtl && deltaX < 0) || (isRtl && deltaX > 0)) {
        setCategoryTab('income');
      } else {
        setCategoryTab('expense');
      }
    }
  };

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
    const incOnly = categories.filter((c) => c.type === 'income');
    if (settings.categoryOrder && settings.categoryOrder.length > 0) {
      const orderMap = new Map(settings.categoryOrder.map((id, index) => [id, index]));
      return [...incOnly].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
        const orderB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
        return orderA - orderB;
      });
    }
    return [...incOnly].sort((a, b) => {
      const incA = categoryIncomeMap.get(a.id) || 0;
      const incB = categoryIncomeMap.get(b.id) || 0;
      if (incA !== incB) return incB - incA;
      return a.name.localeCompare(b.name);
    });
  }, [categories, settings.categoryOrder, categoryIncomeMap]);

  // Real-time search filtered lists
  const displayExpenseCategories = useMemo(() => {
    if (!searchQuery.trim()) return expenseCategories;
    const q = searchQuery.toLowerCase().trim();
    return expenseCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [expenseCategories, searchQuery]);

  const displayIncomeCategories = useMemo(() => {
    if (!searchQuery.trim()) return incomeCategories;
    const q = searchQuery.toLowerCase().trim();
    return incomeCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [incomeCategories, searchQuery]);

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

  // Move up/down handlers (distinct for expense and income, preserving both orders)
  const handleMove = (index: number, direction: 'up' | 'down', listType: 'expense' | 'income' = 'expense') => {
    const activeList = listType === 'expense' ? expenseCategories : incomeCategories;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeList.length) return;

    const list = [...activeList];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const otherList = listType === 'expense' ? incomeCategories : expenseCategories;
    const combinedIds = [...list.map((c) => c.id), ...otherList.map((c) => c.id)];
    reorderCategories(combinedIds);
  };

  const currencySymbol = settings.currencySymbol || '£';

  return (
    <div className="bg-black text-white flex flex-col pb-24 pt-16 animate-in fade-in">
      {/* 1. Standardized Top Header Across All Views (Item 2) */}
      <header
        style={{
          transform: isHeaderVisible ? 'translateY(0%)' : 'translateY(-110%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`fixed top-0 left-0 right-0 w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto z-20 h-16 px-4 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between ${
          isHeaderVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* Universal Sidebar Menu Button (☰) */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Menu"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-800 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">{t('budget')} & Categories</h2>
            <p className="text-[10px] sm:text-xs text-zinc-400">
              {settings.language === 'ar' ? 'شهر التطبيق' : 'App Month'}: {cycleRange.startDate} → {cycleRange.endDate}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-3 w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto space-y-5">

      {/* Smart Budget Alert Banner */}
      <SmartBudgetAlertBanner />

      {/* Top Summary Block */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden space-y-4">
        <div className="md:grid md:grid-cols-2 md:items-center md:gap-6">
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
          <div className="text-left md:text-right rtl:text-right rtl:md:text-left mt-3 md:mt-0">
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

      {/* Advanced Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            settings.language === 'ar'
              ? 'البحث في فئات الميزانية بالاسم...'
              : 'Search budget categories by name...'
          }
          className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded-full hover:bg-zinc-800 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Segmented Control: Expense Categories vs Income Categories with Animated Sliding Pill */}
      <div
        onTouchStart={handleSubTouchStart}
        onTouchEnd={handleSubTouchEnd}
        className="relative flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden select-none"
      >
        {/* Sliding Indicator Pill */}
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-md ${
            categoryTab === 'expense'
              ? 'bg-zinc-800'
              : 'bg-emerald-950/80 border border-emerald-500/30'
          }`}
          style={{
            transform: settings.language === 'ar'
              ? (categoryTab === 'expense' ? 'translateX(0)' : 'translateX(-100%)')
              : (categoryTab === 'expense' ? 'translateX(0)' : 'translateX(100%)'),
          }}
        />
        <button
          type="button"
          onClick={() => setCategoryTab('expense')}
          className={`relative z-10 flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer text-center ${
            categoryTab === 'expense'
              ? 'text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          {settings.language === 'ar' ? 'فئات المصروفات' : 'Expense Categories'} ({expenseCategories.length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryTab('income')}
          className={`relative z-10 flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer text-center ${
            categoryTab === 'income'
              ? 'text-emerald-400'
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

          {/* Expense Summary Banner (matching the Income tab banner) */}
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ArrowDownRight className="w-5 h-5 text-rose-400" />
              <div>
                <div className="text-xs text-zinc-300">
                  {settings.language === 'ar' ? 'إجمالي مصروفات هذه الدورة' : 'Total Cycle Expenses Spent'}
                </div>
                <div className="text-lg font-black font-mono text-rose-400">
                  {formatCurrency(totalSpent, currencySymbol)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openAddCategoryModal('expense')}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-900/30 cursor-pointer"
            >
              + {settings.language === 'ar' ? 'إضافة فئة مصروفات' : 'Add Expense Category'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {displayExpenseCategories.map((cat) => {
              const spent = categorySpentMap.get(cat.id) || 0;
              const originalIdx = expenseCategories.findIndex((c) => c.id === cat.id);
              const isSelected = selectedCategoryIds.includes(cat.id);

              return (
                <ExpenseCategoryRow
                  key={cat.id}
                  cat={cat}
                  originalIdx={originalIdx}
                  totalCategories={expenseCategories.length}
                  isSelected={isSelected}
                  isCategoryMultiSelect={isCategoryMultiSelect}
                  spent={spent}
                  currencySymbol={currencySymbol}
                  language={settings.language}
                  onMove={handleMove}
                  onSelect={() => startCategoryMultiSelect(cat.id)}
                  onToggle={() => toggleCategorySelection(cat.id)}
                  onEdit={() => openEditCategoryModal(cat)}
                />
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
              onClick={() => openAddCategoryModal('income')}
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
                onClick={() => openAddCategoryModal('income')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{settings.language === 'ar' ? 'إنشاء فئة واردة جديدة' : 'Create Income Category'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {displayIncomeCategories.map((cat) => {
                const received = categoryIncomeMap.get(cat.id) || 0;
                const originalIdx = incomeCategories.findIndex((c) => c.id === cat.id);
                const isSelected = selectedCategoryIds.includes(cat.id);

                return (
                  <IncomeCategoryRow
                    key={cat.id}
                    cat={cat}
                    originalIdx={originalIdx}
                    totalCategories={incomeCategories.length}
                    isSelected={isSelected}
                    isCategoryMultiSelect={isCategoryMultiSelect}
                    received={received}
                    currencySymbol={currencySymbol}
                    language={settings.language}
                    onMove={handleMove}
                    onSelect={() => startCategoryMultiSelect(cat.id)}
                    onToggle={() => toggleCategorySelection(cat.id)}
                    onEdit={() => openEditCategoryModal(cat)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  );
};
