import React, { useState, useMemo, useEffect } from 'react';
import { navigateBack } from '../context/NavigationContext';
import { useAppActions, useAppData, useAppUI } from '../context/AppContext';
import {
  X,
  Filter,
  Check,
  Search,
  PiggyBank,
  Receipt,
  Sparkles,
  Coffee,
  Shield,
  ArrowUpDown,
  Repeat,
  FileText,
  Percent,
  Eye,
} from 'lucide-react';
import {
  AdvancedFilter,
  SmartBudgetPoolKey,
  Transaction,
  TransactionSortBy,
} from '../types';
import {
  DEFAULT_ADVANCED_FILTER,
  getEffectiveTransactionAmount,
  isTransactionInRange,
  resolveDateRange,
} from '../utils/dateCycle';
import { parseFormattedNumber } from '../utils/formatters';

interface AdvancedFilterModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  scopedTransactions?: Transaction[];
  initialFilter?: AdvancedFilter;
  onApplyFilter?: (filter: AdvancedFilter) => void;
  onClearFilter?: () => void;
  hideAccountPicker?: boolean;
  hideAccountVisibility?: boolean;
}

export const AdvancedFilterModal: React.FC<AdvancedFilterModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  scopedTransactions,
  initialFilter: propInitialFilter,
  onApplyFilter: propOnApplyFilter,
  onClearFilter: propOnClearFilter,
  hideAccountPicker = false,
  hideAccountVisibility = false,
}) => {
  const { accounts, categories, transactions, settings, t } = useAppData();
  const {
    isFilterModalOpen,
    advancedFilter,
    periodFilter,
    periodOffset,
    customDateRange,
  } = useAppUI();
  const {
    setIsFilterModalOpen,
    setAdvancedFilter,
    clearAdvancedFilter,
  } = useAppActions();

  const isScopedMode = propIsOpen !== undefined;
  const effectiveIsOpen = isScopedMode ? Boolean(propIsOpen) : isFilterModalOpen;
  const effectiveInitialFilter = propInitialFilter ?? advancedFilter;

  const isArabic = settings.language === 'ar';
  const currency = settings.currencySymbol || 'EGP';
  const [localFilter, setLocalFilter] = useState<AdvancedFilter>(() => ({
    ...DEFAULT_ADVANCED_FILTER,
    ...effectiveInitialFilter,
  }));
  const [isClosing, setIsClosing] = useState(false);

  // Sync draft filter strictly when modal opens so stale filters never linger
  useEffect(() => {
    if (effectiveIsOpen) {
      setLocalFilter({
        ...DEFAULT_ADVANCED_FILTER,
        ...effectiveInitialFilter,
      });
      setIsClosing(false);
    }
  }, [effectiveIsOpen, effectiveInitialFilter]);

  // Scope dataset strictly to active duration (Home duration or Account duration)
  const durationScopedTxs = useMemo(() => {
    if (scopedTransactions) return scopedTransactions;
    const range = resolveDateRange(
      periodFilter,
      settings.weekStartDay,
      settings.defaultMonthStartDay,
      periodOffset,
      customDateRange,
      settings.resetStartDate
    );
    return transactions.filter((tx) => isTransactionInRange(tx, range));
  }, [
    scopedTransactions,
    transactions,
    periodFilter,
    settings.weekStartDay,
    settings.defaultMonthStartDay,
    periodOffset,
    customDateRange,
    settings.resetStartDate,
  ]);

  // Dynamic transaction types present in active scope
  const availableTypes = useMemo(() => {
    const types: ('all' | 'expense' | 'income' | 'transfer')[] = ['all'];
    if (durationScopedTxs.some((tx) => tx.type === 'expense')) types.push('expense');
    if (durationScopedTxs.some((tx) => tx.type === 'income')) types.push('income');
    if (durationScopedTxs.some((tx) => tx.type === 'transfer')) types.push('transfer');
    return types;
  }, [durationScopedTxs]);

  // Only accounts that have transactions inside the active scope
  const availableAccounts = useMemo(() => {
    return accounts.filter((acc) =>
      durationScopedTxs.some((tx) => tx.accountId === acc.id || tx.toAccountId === acc.id)
    );
  }, [accounts, durationScopedTxs]);

  // Only categories ACTUALLY used by transactions in the active scope + counts
  const usedCategoryEntries = useMemo(() => {
    const countMap = new Map<string, number>();
    const metaMap = new Map<string, { name: string; icon: string }>();

    for (const tx of durationScopedTxs) {
      if (localFilter.type !== 'all' && tx.type !== localFilter.type) continue;
      if (!tx.categoryId) continue;
      countMap.set(tx.categoryId, (countMap.get(tx.categoryId) || 0) + 1);
      if (!metaMap.has(tx.categoryId)) {
        metaMap.set(tx.categoryId, {
          name: tx.categoryName || tx.categoryId,
          icon: tx.categoryIcon || '🏷️',
        });
      }
    }

    const items = categories
      .filter((cat) => countMap.has(cat.id))
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        count: countMap.get(cat.id) || 0,
      }));

    // Include any fallback category ids stored directly on transactions if deleted from category list
    for (const [catId, count] of countMap.entries()) {
      if (!items.some((i) => i.id === catId)) {
        const meta = metaMap.get(catId);
        items.push({
          id: catId,
          name: meta?.name || catId,
          icon: meta?.icon || '🏷️',
          count,
        });
      }
    }

    items.sort((a, b) => b.count - a.count);
    return items;
  }, [categories, durationScopedTxs, localFilter.type]);

  // Compute Amount Slider bounds from active scope transactions
  const maxScopeAmount = useMemo(() => {
    let highest = 0;
    for (const tx of durationScopedTxs) {
      const eff = getEffectiveTransactionAmount(tx);
      if (eff > highest) highest = eff;
    }
    if (highest <= 0) return 1000;
    const magnitude = Math.pow(10, Math.max(1, Math.floor(Math.log10(highest)) - 1));
    return Math.max(100, Math.ceil(highest / magnitude) * magnitude);
  }, [durationScopedTxs]);

  if (!effectiveIsOpen) return null;

  const sliderStep = maxScopeAmount >= 50000 ? 100 : maxScopeAmount >= 5000 ? 50 : 10;
  const sliderMinVal =
    localFilter.minAmount !== undefined
      ? Math.max(0, Math.min(maxScopeAmount, localFilter.minAmount))
      : 0;
  const sliderMaxVal =
    localFilter.maxAmount !== undefined
      ? Math.max(sliderMinVal, Math.min(maxScopeAmount, localFilter.maxAmount))
      : maxScopeAmount;

  const minPct = maxScopeAmount > 0 ? (sliderMinVal / maxScopeAmount) * 100 : 0;
  const maxPct = maxScopeAmount > 0 ? (sliderMaxVal / maxScopeAmount) * 100 : 100;

  const closeModal = () => {
    if (propOnClose) {
      propOnClose();
    } else if (isScopedMode) {
      setIsFilterModalOpen(false);
    } else {
      navigateBack();
    }
  };

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      closeModal();
    }, 150);
  };

  const toggleAccount = (id: string) => {
    setLocalFilter((prev) => {
      const exists = prev.accountIds.includes(id);
      return {
        ...prev,
        accountIds: exists ? prev.accountIds.filter((x) => x !== id) : [...prev.accountIds, id],
      };
    });
  };

  const toggleCategory = (id: string) => {
    setLocalFilter((prev) => {
      const exists = prev.categoryIds.includes(id);
      return {
        ...prev,
        categoryIds: exists ? prev.categoryIds.filter((x) => x !== id) : [...prev.categoryIds, id],
      };
    });
  };

  const toggleBudgetPool = (pool: SmartBudgetPoolKey) => {
    setLocalFilter((prev) => {
      const current = prev.budgetPools || [];
      const exists = current.includes(pool);
      return {
        ...prev,
        budgetPools: exists ? current.filter((p) => p !== pool) : [...current, pool],
      };
    });
  };

  const handleApply = () => {
    if (propOnApplyFilter) {
      propOnApplyFilter(localFilter);
    } else {
      setAdvancedFilter(localFilter);
    }
    closeModal();
  };

  const handleClear = () => {
    if (propOnClearFilter) {
      propOnClearFilter();
    } else {
      clearAdvancedFilter();
    }
    closeModal();
  };

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[70] flex items-end sm:items-center landscape:items-center justify-center bg-black/80 p-0 sm:p-4 landscape:p-2 overflow-y-auto overscroll-contain transition-opacity duration-150 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
        className={`w-full max-w-lg max-h-[92svh] my-auto flex flex-col rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl bg-zinc-950 border border-zinc-800/90 shadow-2xl overflow-hidden text-white transition-transform duration-150 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0 bg-zinc-900/60">
          <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-400" />
            <span>{t('advancedFilterTitle')}</span>
          </h3>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filters */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 kb-scroll-pad">
          {/* Keyword & Notes Search */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {isArabic ? 'البحث في الوصف والملاحظات' : 'Search Notes & Description'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={localFilter.searchQuery ?? ''}
                onChange={(e) =>
                  setLocalFilter((prev) => ({ ...prev, searchQuery: e.target.value }))
                }
                placeholder={isArabic ? 'ابحث في تفاصيل وملاحظات المعاملة...' : 'Search by notes or description...'}
                className="w-full ps-9 pe-9 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {localFilter.searchQuery && (
                <button
                  type="button"
                  onClick={() => setLocalFilter((prev) => ({ ...prev, searchQuery: '' }))}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isArabic ? 'الترتيب حسب' : 'Sort Order'}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'date_desc', label: isArabic ? 'الأحدث' : 'Newest' },
                  { id: 'date_asc', label: isArabic ? 'الأقدم' : 'Oldest' },
                  { id: 'amount_desc', label: isArabic ? 'الأعلى مبلغاً' : 'Highest' },
                  { id: 'amount_asc', label: isArabic ? 'الأقل مبلغاً' : 'Lowest' },
                ] as Array<{ id: TransactionSortBy; label: string }>
              ).map((opt) => {
                const isSelected = (localFilter.sortBy || 'date_desc') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLocalFilter((prev) => ({ ...prev, sortBy: opt.id }))}
                    className={`py-2 px-2.5 text-[11px] font-bold rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t('transactionType')}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLocalFilter((prev) => ({ ...prev, type }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border capitalize transition cursor-pointer ${
                    localFilter.type === type
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                  }`}
                >
                  {type === 'all' ? t('allTypes') : t(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Synced Dual-Handle Amount Slider + Manual Min/Max Inputs */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                {isArabic ? 'نطاق المبلغ' : 'Amount Range'}
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {sliderMinVal.toLocaleString()} – {sliderMaxVal.toLocaleString()} {currency}
              </span>
            </div>

            {/* Custom Dual-Thumb Range Track (LTR normalized for accurate thumb geometry) */}
            <div className="relative h-6 flex items-center select-none" dir="ltr">
              <div className="w-full h-1.5 rounded-full bg-zinc-800 relative">
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{
                    left: `${minPct}%`,
                    width: `${Math.max(0, maxPct - minPct)}%`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={maxScopeAmount}
                step={sliderStep}
                value={sliderMinVal}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const clamped = Math.min(val, sliderMaxVal);
                  setLocalFilter((prev) => ({
                    ...prev,
                    minAmount: clamped <= 0 ? undefined : clamped,
                  }));
                }}
                aria-label="Minimum amount slider"
                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-950 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-950 [&::-moz-range-thumb]:cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={maxScopeAmount}
                step={sliderStep}
                value={sliderMaxVal}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const clamped = Math.max(val, sliderMinVal);
                  setLocalFilter((prev) => ({
                    ...prev,
                    maxAmount: clamped >= maxScopeAmount ? undefined : clamped,
                  }));
                }}
                aria-label="Maximum amount slider"
                className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-300 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-950 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-teal-300 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-950 [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-zinc-500 mb-1 block">{t('minAmount')}</span>
                <input
                  type="number"
                  step="any"
                  value={localFilter.minAmount ?? ''}
                  onChange={(e) =>
                    setLocalFilter((prev) => ({
                      ...prev,
                      minAmount:
                        e.target.value === '' ? undefined : parseFormattedNumber(e.target.value),
                    }))
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 mb-1 block">{t('maxAmount')}</span>
                <input
                  type="number"
                  step="any"
                  value={localFilter.maxAmount ?? ''}
                  onChange={(e) =>
                    setLocalFilter((prev) => ({
                      ...prev,
                      maxAmount:
                        e.target.value === '' ? undefined : parseFormattedNumber(e.target.value),
                    }))
                  }
                  placeholder={String(maxScopeAmount)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs sm:text-sm font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Budget Pool Filter (all 5 pools) */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {isArabic ? 'بنود الميزانية' : 'Budget Pool'}
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'daily', label: t('poolDaily'), icon: <Coffee className="w-3.5 h-3.5" /> },
                  { id: 'outings', label: t('poolOutings'), icon: <Sparkles className="w-3.5 h-3.5" /> },
                  { id: 'fixed', label: t('poolFixed'), icon: <Receipt className="w-3.5 h-3.5" /> },
                  { id: 'oneoff', label: t('poolOneOff'), icon: <Shield className="w-3.5 h-3.5" /> },
                  { id: 'savings', label: t('poolSavings'), icon: <PiggyBank className="w-3.5 h-3.5" /> },
                ] as const
              ).map((p) => {
                const isSelected = localFilter.budgetPools?.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleBudgetPool(p.id)}
                    className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                    }`}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Attributes: Recurring / Notes / Tax & Fee */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {isArabic ? 'خصائص إضافية' : 'Transaction Attributes'}
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: isArabic ? 'الكل (متكرر وعادي)' : 'All Schedules' },
                  { id: 'recurring', label: isArabic ? 'متكرر فقط' : 'Recurring Only' },
                  { id: 'non_recurring', label: isArabic ? 'غير متكرر' : 'One-Time Only' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLocalFilter((prev) => ({ ...prev, recurringFilter: opt.id }))}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    (localFilter.recurringFilter || 'all') === opt.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                  <span>{opt.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  setLocalFilter((prev) => ({ ...prev, hasNotesOnly: !prev.hasNotesOnly }))
                }
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  localFilter.hasNotesOnly
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>{isArabic ? 'بملاحظات فقط' : 'Has Notes'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setLocalFilter((prev) => ({ ...prev, hasTaxOrFeeOnly: !prev.hasTaxOrFeeOnly }))
                }
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  localFilter.hasTaxOrFeeOnly
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Percent className="w-3 h-3" />
                <span>{isArabic ? 'ضرائب أو رسوم فقط' : 'Tax / Fee Only'}</span>
              </button>
            </div>
          </div>

          {/* Account Visibility Filter (Home only) */}
          {!hideAccountVisibility && (
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isArabic ? 'ظهور الحسابات' : 'Account Visibility'}</span>
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { id: 'all', label: isArabic ? 'كل الحسابات' : 'All Accounts' },
                    { id: 'public', label: isArabic ? 'عامة فقط' : 'Public Only' },
                    { id: 'private', label: isArabic ? 'خاصة فقط' : 'Private Only' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setLocalFilter((prev) => ({ ...prev, accountVisibility: opt.id }))
                    }
                    className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      (localFilter.accountVisibility || 'all') === opt.id
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accounts filter (Home only) */}
          {!hideAccountPicker && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {t('filterByAccount')}
              </label>
              {availableAccounts.length === 0 ? (
                <div className="text-xs text-zinc-500 italic p-2 rounded-xl bg-zinc-900/40 border border-zinc-800">
                  {isArabic
                    ? 'لا توجد حسابات بها معاملات في هذه المدة'
                    : 'No accounts with transactions in this period'}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableAccounts.map((acc) => {
                    const isSelected = localFilter.accountIds.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => toggleAccount(acc.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600/30 border-emerald-500 text-white shadow-sm'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        <span>{acc.icon}</span>
                        <span>{acc.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Strictly Used Categories Within Active Scope */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t('filterByCategory')} ({usedCategoryEntries.length})
            </label>
            {usedCategoryEntries.length === 0 ? (
              <div className="text-xs text-zinc-500 italic p-2 rounded-xl bg-zinc-900/40 border border-zinc-800">
                {isArabic
                  ? 'لا توجد فئات مستخدمة في المعاملات خلال هذه المدة'
                  : 'No categories used by transactions in this period'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {usedCategoryEntries.map((cat) => {
                  const isSelected = localFilter.categoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600/30 border-emerald-500 text-white shadow-sm'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate max-w-[120px]">{cat.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/30 text-zinc-300">
                        {cat.count}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
          >
            {t('clearFilters')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-xs font-bold text-black shadow-lg shadow-emerald-950/50 transition cursor-pointer"
            >
              {t('applyFilters')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
