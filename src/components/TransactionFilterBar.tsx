import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  Account,
  AdvancedFilter,
  Category,
  DateRange,
  PeriodFilterType,
} from '../types';
import { DateRangeCalendarModal } from './DateRangeCalendarModal';

interface TransactionFilterBarProps {
  periodFilter: PeriodFilterType;
  onPeriodChange: (period: PeriodFilterType) => void;
  periodOffset: number;
  onPeriodOffsetChange: (updater: number | ((prev: number) => number)) => void;
  customDateRange: DateRange;
  onCustomDateRangeChange: (range: DateRange) => void;
  advancedFilter: AdvancedFilter;
  onUpdateAdvancedFilter: (next: AdvancedFilter) => void;
  onClearAdvancedFilter: () => void;
  onOpenFilterModal: () => void;
  activeAdvancedCount: number;
  resolvedDateRange?: DateRange;
  categoriesById: Map<string, Category>;
  accountsById: Map<string, Account>;
  language?: 'en' | 'ar';
  currency?: string;
  hideAccountChips?: boolean;
  resetStartDate?: string;
}

const DURATION_OPTIONS: Array<{
  key: PeriodFilterType;
  labelEn: string;
  labelAr: string;
  navigable: boolean;
}> = [
  { key: 'app_month', labelEn: 'App Month', labelAr: 'شهر التطبيق', navigable: true },
  { key: 'this_week', labelEn: 'This Week', labelAr: 'هذا الأسبوع', navigable: true },
  { key: 'last_week', labelEn: 'Last Week', labelAr: 'الأسبوع الماضي', navigable: false },
  { key: 'this_month', labelEn: 'This Month', labelAr: 'هذا الشهر', navigable: true },
  { key: 'last_month', labelEn: 'Last Month', labelAr: 'الشهر الماضي', navigable: false },
  { key: '3_months', labelEn: '3 Months', labelAr: '3 شهور', navigable: true },
  { key: 'this_year', labelEn: 'This Year', labelAr: 'هذه السنة', navigable: true },
  { key: 'all_time', labelEn: 'All Time', labelAr: 'كل الأوقات', navigable: false },
  { key: 'custom', labelEn: 'Custom Duration', labelAr: 'مدة مخصصة', navigable: false },
];

export const TransactionFilterBar: React.FC<TransactionFilterBarProps> = ({
  periodFilter,
  onPeriodChange,
  periodOffset,
  onPeriodOffsetChange,
  customDateRange,
  onCustomDateRangeChange,
  advancedFilter,
  onUpdateAdvancedFilter,
  onClearAdvancedFilter,
  onOpenFilterModal,
  activeAdvancedCount,
  resolvedDateRange,
  categoriesById,
  accountsById,
  language = 'ar',
  currency = 'EGP',
  hideAccountChips = false,
  resetStartDate,
}) => {
  const isArabic = language === 'ar';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [dropdownOpen]);

  const currentOpt =
    DURATION_OPTIONS.find((o) => o.key === periodFilter) || DURATION_OPTIONS[0];
  const isNavigable =
    currentOpt.navigable && !(resetStartDate && (periodFilter === 'app_month' || periodFilter === 'this_month'));

  const activeDurationLabel = (() => {
    if (resetStartDate && (periodFilter === 'app_month' || periodFilter === 'this_month')) {
      return isArabic ? 'منذ إعادة التعيين' : 'Since Reset';
    }
    if (periodFilter === 'custom' && customDateRange.startDate && customDateRange.endDate) {
      return `${customDateRange.startDate.slice(5)} -> ${customDateRange.endDate.slice(5)}`;
    }
    return isArabic ? currentOpt.labelAr : currentOpt.labelEn;
  })();

  const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

  if (advancedFilter.type !== 'all') {
    const typeLabels: Record<string, string> = isArabic
      ? { expense: 'مصروف', income: 'دخل', transfer: 'تحويل' }
      : { expense: 'Expense', income: 'Income', transfer: 'Transfer' };
    chips.push({
      id: 'type',
      label: typeLabels[advancedFilter.type] || advancedFilter.type,
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, type: 'all' }),
    });
  }

  if (advancedFilter.minAmount !== undefined || advancedFilter.maxAmount !== undefined) {
    const minStr = advancedFilter.minAmount !== undefined ? `${advancedFilter.minAmount}` : '0';
    const maxStr = advancedFilter.maxAmount !== undefined ? `${advancedFilter.maxAmount}` : '∞';
    chips.push({
      id: 'amount',
      label: `${minStr}–${maxStr} ${currency}`,
      onRemove: () =>
        onUpdateAdvancedFilter({ ...advancedFilter, minAmount: undefined, maxAmount: undefined }),
    });
  }

  if (!hideAccountChips && advancedFilter.accountVisibility && advancedFilter.accountVisibility !== 'all') {
    chips.push({
      id: 'acc_vis',
      label:
        advancedFilter.accountVisibility === 'public'
          ? isArabic ? 'حسابات عامة' : 'Public'
          : isArabic ? 'حسابات خاصة' : 'Private',
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, accountVisibility: 'all' }),
    });
  }

  if (!hideAccountChips) {
    for (const accId of advancedFilter.accountIds || []) {
      const acc = accountsById.get(accId);
      chips.push({
        id: `acc_${accId}`,
        label: acc ? `${acc.icon} ${acc.name}` : accId,
        onRemove: () =>
          onUpdateAdvancedFilter({
            ...advancedFilter,
            accountIds: advancedFilter.accountIds.filter((x) => x !== accId),
          }),
      });
    }
  }

  for (const catId of advancedFilter.categoryIds || []) {
    const cat = categoriesById.get(catId);
    chips.push({
      id: `cat_${catId}`,
      label: cat ? `${cat.icon} ${cat.name}` : catId,
      onRemove: () =>
        onUpdateAdvancedFilter({
          ...advancedFilter,
          categoryIds: advancedFilter.categoryIds.filter((x) => x !== catId),
        }),
    });
  }

  for (const pool of advancedFilter.budgetPools || []) {
    const poolNames: Record<string, string> = isArabic
      ? { daily: 'يومي', outings: 'خروجات', fixed: 'فواتير', oneoff: 'One-Off', savings: 'تحويش' }
      : { daily: 'Daily', outings: 'Outings', fixed: 'Fixed', oneoff: 'One-Off', savings: 'Savings' };
    chips.push({
      id: `pool_${pool}`,
      label: poolNames[pool] || pool,
      onRemove: () =>
        onUpdateAdvancedFilter({
          ...advancedFilter,
          budgetPools: (advancedFilter.budgetPools || []).filter((x) => x !== pool),
        }),
    });
  }

  if (advancedFilter.recurringFilter && advancedFilter.recurringFilter !== 'all') {
    chips.push({
      id: 'recurring',
      label:
        advancedFilter.recurringFilter === 'recurring'
          ? isArabic ? 'متكرر فقط' : 'Recurring'
          : isArabic ? 'غير متكرر' : 'One-Time',
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, recurringFilter: 'all' }),
    });
  }

  if (advancedFilter.hasNotesOnly) {
    chips.push({
      id: 'notes',
      label: isArabic ? 'بملاحظات' : 'With Notes',
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, hasNotesOnly: false }),
    });
  }

  if (advancedFilter.hasTaxOrFeeOnly) {
    chips.push({
      id: 'taxfee',
      label: isArabic ? 'بضرائب / رسوم' : 'Tax / Fee',
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, hasTaxOrFeeOnly: false }),
    });
  }

  if (advancedFilter.sortBy && advancedFilter.sortBy !== 'date_desc') {
    const sortNames: Record<string, string> = isArabic
      ? { date_asc: 'الأقدم أولاً', amount_desc: 'الأعلى مبلغاً', amount_asc: 'الأقل مبلغاً' }
      : { date_asc: 'Oldest First', amount_desc: 'Highest Amount', amount_asc: 'Lowest Amount' };
    chips.push({
      id: 'sort',
      label: sortNames[advancedFilter.sortBy] || advancedFilter.sortBy,
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, sortBy: 'date_desc' }),
    });
  }

  if (advancedFilter.searchQuery && advancedFilter.searchQuery.trim()) {
    chips.push({
      id: 'query',
      label: `"${advancedFilter.searchQuery.trim()}"`,
      onRemove: () => onUpdateAdvancedFilter({ ...advancedFilter, searchQuery: undefined }),
    });
  }

  return (
    <div className="space-y-2">
      {/* Primary Top Bar: Duration Selector + Filter Menu Icon */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1" ref={dropdownRef}>
          {isNavigable && (
            <button
              type="button"
              onClick={() => onPeriodOffsetChange((p) => p - 1)}
              aria-label="Previous period"
              className="w-9 h-9 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
          )}

          <div className="relative min-w-0 flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="w-full sm:w-auto min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-xs font-bold text-white flex items-center justify-between gap-2 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{activeDurationLabel}</span>
                {periodOffset !== 0 && isNavigable && (
                  <span className="text-[10px] font-mono text-emerald-400">
                    ({periodOffset > 0 ? `+${periodOffset}` : periodOffset})
                  </span>
                )}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </button>

            {dropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute start-0 mt-1.5 w-52 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl py-1.5 z-50 text-xs font-medium overflow-hidden"
              >
                {DURATION_OPTIONS.map((opt) => {
                  const isActive = periodFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onPeriodOffsetChange(0);
                        onPeriodChange(opt.key);
                        if (opt.key === 'custom') {
                          setCalendarOpen(true);
                        }
                      }}
                      className={`w-full text-start px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-zinc-800 transition cursor-pointer ${
                        isActive ? 'text-emerald-400 font-bold bg-emerald-500/10' : 'text-zinc-200'
                      }`}
                    >
                      <span>{isArabic ? opt.labelAr : opt.labelEn}</span>
                      {opt.key === 'custom' && <Calendar className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isNavigable && (
            <button
              type="button"
              onClick={() => onPeriodOffsetChange((p) => p + 1)}
              aria-label="Next period"
              className="w-9 h-9 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          )}

          {periodFilter === 'custom' && (
            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="h-9 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
              title={isArabic ? 'تعديل التاريخ' : 'Edit range'}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          )}

          {periodOffset !== 0 && isNavigable && (
            <button
              type="button"
              onClick={() => onPeriodOffsetChange(0)}
              className="h-9 px-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
              title={isArabic ? 'العودة للفترة الحالية' : 'Back to current'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Menu Icon Button + Active Badge */}
        <button
          type="button"
          onClick={onOpenFilterModal}
          aria-label={isArabic ? 'تصفية المعاملات' : 'Filter transactions'}
          className={`relative min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
            activeAdvancedCount > 0
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden xs:inline">{isArabic ? 'فلترة' : 'Filter'}</span>
          {activeAdvancedCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold flex items-center justify-center">
              {activeAdvancedCount}
            </span>
          )}
        </button>
      </div>

      {/* Resolved Date Window Subtitle (when custom or shifted) */}
      {resolvedDateRange &&
        periodFilter !== 'all_time' &&
        (periodOffset !== 0 || periodFilter === 'custom' || periodFilter === '3_months') && (
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 px-1">
            <span>
              {resolvedDateRange.startDate} {'->'} {resolvedDateRange.endDate}
            </span>
          </div>
        )}

      {/* Horizontal Removable Active Filter Chips */}
      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-[11px] font-semibold shrink-0 transition cursor-pointer"
            >
              <span className="max-w-[140px] truncate">{chip.label}</span>
              <X className="w-3 h-3 shrink-0 opacity-80" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAdvancedFilter}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-[11px] font-semibold shrink-0 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isArabic ? 'مسح الكل' : 'Clear All'}</span>
          </button>
        </div>
      )}

      <DateRangeCalendarModal
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        initialRange={customDateRange}
        onApply={(range) => {
          onCustomDateRangeChange(range);
          onPeriodChange('custom');
        }}
        language={language}
      />
    </div>
  );
};
