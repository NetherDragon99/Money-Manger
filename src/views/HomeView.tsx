import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Menu,
  RotateCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { PeriodFilterType, DateRange, Transaction } from '../types';
import {
  resolveDateRange,
  isTransactionInRange,
  formatCurrency,
  padZero,
  formatDateToYYYYMMDD,
  getDaysInMonth,
} from '../utils/dateCycle';
import { GroupedTransactionList } from '../components/GroupedTransactionList';
import { MiniDateTimePicker } from '../components/MiniDateTimePicker';
import { SmartBudgetAlertBanner } from '../components/SmartBudgetAlertBanner';
import { useHeaderScroll } from '../hooks/useHeaderScroll';

export const HomeView: React.FC = () => {
  const {
    accounts,
    transactions,
    settings,
    homeSubView,
    setHomeSubView,
    periodFilter,
    setPeriodFilter,
    periodOffset,
    setPeriodOffset,
    customDateRange,
    setCustomDateRange,
    advancedFilter,
    setIsSidebarOpen,
    setIsResetPeriodModalOpen,
    setIsFilterModalOpen,
    t,
  } = useApp();

  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [showCustomRangePicker, setShowCustomRangePicker] = useState(false);
  const [customTarget, setCustomTarget] = useState<'start' | 'end'>('start');
  const isHeaderVisible = useHeaderScroll();

  // Calendar view specific state
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    formatDateToYYYYMMDD(new Date())
  );

  // Filter out private accounts for Home summary!
  const publicAccountIds = useMemo(() => {
    return new Set(accounts.filter((a) => !a.isPrivate).map((a) => a.id));
  }, [accounts]);

  // Active Date Range for the period
  const activeDateRange = useMemo(() => {
    return resolveDateRange(
      periodFilter,
      settings.weekStartDay,
      settings.defaultMonthStartDay,
      periodOffset,
      customDateRange,
      settings.resetStartDate
    );
  }, [periodFilter, settings.weekStartDay, settings.defaultMonthStartDay, periodOffset, customDateRange, settings.resetStartDate]);

  // Apply filters (Period + Advanced Filters)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Check Date Range
      if (!isTransactionInRange(tx, activeDateRange)) return false;

      // 2. Type filter
      if (advancedFilter.type !== 'all' && tx.type !== advancedFilter.type) return false;

      // 3. Account filter
      if (advancedFilter.accountIds.length > 0) {
        const matchesAcc =
          advancedFilter.accountIds.includes(tx.accountId) ||
          (tx.toAccountId && advancedFilter.accountIds.includes(tx.toAccountId));
        if (!matchesAcc) return false;
      }

      // 4. Category filter
      if (advancedFilter.categoryIds.length > 0) {
        if (!tx.categoryId || !advancedFilter.categoryIds.includes(tx.categoryId)) return false;
      }

      // 5. Amount Min / Max
      if (advancedFilter.minAmount !== undefined && tx.amount < advancedFilter.minAmount) return false;
      if (advancedFilter.maxAmount !== undefined && tx.amount > advancedFilter.maxAmount) return false;

      return true;
    });
  }, [transactions, activeDateRange, advancedFilter]);

  // Public Summary Calculation: INCOME, EXPENSE, BALANCE
  // Crucial: Calculated ONLY from Public accounts (isPrivate === false)!
  const { publicIncome, publicExpense, publicBalance } = useMemo(() => {
    let inc = 0;
    let exp = 0;

    for (const tx of filteredTransactions) {
      if (tx.type === 'income') {
        if (publicAccountIds.has(tx.accountId)) {
          inc += tx.amount;
        }
      } else if (tx.type === 'expense') {
        if (publicAccountIds.has(tx.accountId)) {
          exp += tx.amount;
        }
      } else if (tx.type === 'transfer') {
        // If money transferred from private to public, counts as income for public
        if (!publicAccountIds.has(tx.accountId) && tx.toAccountId && publicAccountIds.has(tx.toAccountId)) {
          inc += tx.amount;
        }
        // If money transferred from public to private, counts as expense for public
        if (publicAccountIds.has(tx.accountId) && tx.toAccountId && !publicAccountIds.has(tx.toAccountId)) {
          exp += tx.amount;
        }
      }
    }

    // Public Balance: sum of balances of public accounts
    const bal = accounts.filter((a) => !a.isPrivate).reduce((acc, a) => acc + a.balance, 0);

    return {
      publicIncome: inc,
      publicExpense: exp,
      publicBalance: bal,
    };
  }, [filteredTransactions, accounts, publicAccountIds]);

  // CALENDAR COMPUTATION
  const calendarDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + calendarMonthOffset);
    return d;
  }, [calendarMonthOffset]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

    let startOffset = firstDayIndex;
    if (settings.weekStartDay === 'saturday') {
      startOffset = (firstDayIndex + 1) % 7;
    } else if (settings.weekStartDay === 'monday') {
      startOffset = (firstDayIndex + 6) % 7;
    }

    const daysList: Array<{ dateStr: string; dayNumber: number; isCurrentMonth: boolean }> = [];

    // Empty lead cells
    for (let i = 0; i < startOffset; i++) {
      daysList.push({ dateStr: '', dayNumber: 0, isCurrentMonth: false });
    }

    // Days in current month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${padZero(month + 1)}-${padZero(day)}`;
      daysList.push({ dateStr, dayNumber: day, isCurrentMonth: true });
    }

    return daysList;
  }, [calendarDate, settings.weekStartDay]);

  // Calendar Day transactions mapping
  const calendarDayTxsMap = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const arr = map.get(tx.date) || [];
      arr.push(tx);
      map.set(tx.date, arr);
    }
    return map;
  }, [transactions]);

  // Selected Day Transactions for Calendar view
  const selectedCalendarDayTxs = useMemo(() => {
    return transactions.filter((tx) => tx.date === selectedCalendarDate);
  }, [transactions, selectedCalendarDate]);

  const currencySymbol = settings.currencySymbol || '£';

  // Week header day names
  const weekDayLabels = useMemo(() => {
    if (settings.weekStartDay === 'saturday') {
      return settings.language === 'ar'
        ? ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة']
        : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }
    if (settings.weekStartDay === 'monday') {
      return settings.language === 'ar'
        ? ['إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد']
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    }
    return settings.language === 'ar'
      ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }, [settings.weekStartDay, settings.language]);

  const getPeriodFilterName = () => {
    if (settings.resetStartDate && periodFilter === 'this_month') {
      return 'Since Reset';
    }
    switch (periodFilter) {
      case 'all_time':
        return t('allTime');
      case 'this_week':
        return t('thisWeek');
      case 'last_week':
        return t('lastWeek');
      case 'this_month':
        return t('thisMonth');
      case 'last_month':
        return t('lastMonth');
      case 'calendar_month':
        return t('calendarMonth');
      case 'custom':
        return t('customRange');
      default:
        return t('thisMonth');
    }
  };

  const hasActiveAdvancedFilter =
    advancedFilter.accountIds.length > 0 ||
    advancedFilter.categoryIds.length > 0 ||
    advancedFilter.minAmount !== undefined ||
    advancedFilter.maxAmount !== undefined ||
    advancedFilter.type !== 'all';

  return (
    <div className="bg-black text-white flex flex-col pb-24 animate-in fade-in">
      {/* 1. Top Header Bar with Smart Auto-Hide on Scroll */}
      <header className={`sticky top-0 z-30 bg-black/90 backdrop-blur-md px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        {/* Left: Hamburger Menu Button (☰) */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open Menu"
          className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: Period Filter Dropdown (< All Time ▾ > or < This Month ▾ >) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPeriodOffset((p) => p - 1)}
            aria-label="Previous Period"
            className="p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-200 transition"
            >
              <span>{getPeriodFilterName()}</span>
              {periodOffset !== 0 && (
                <span className="text-[10px] text-blue-400 font-mono">
                  ({periodOffset > 0 ? `+${periodOffset}` : periodOffset})
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {periodDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-1/2 -translate-x-1/2 mt-1.5 w-48 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl py-1.5 z-50 text-xs font-medium"
              >
                {(
                  [
                    'this_month',
                    'calendar_month',
                    'last_month',
                    'this_week',
                    'last_week',
                    'all_time',
                    'custom',
                  ] as PeriodFilterType[]
                ).map((pKey) => (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => {
                      setPeriodDropdownOpen(false);
                      setPeriodOffset(0);
                      if (pKey === 'custom') {
                        setShowCustomRangePicker(true);
                      } else {
                        setPeriodFilter(pKey);
                      }
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-zinc-800 transition ${
                      periodFilter === pKey ? 'text-blue-400 font-bold bg-zinc-800/50' : 'text-zinc-300'
                    }`}
                  >
                    {pKey === 'this_month' && t('thisMonth')}
                    {pKey === 'calendar_month' && t('calendarMonth')}
                    {pKey === 'last_month' && t('lastMonth')}
                    {pKey === 'this_week' && t('thisWeek')}
                    {pKey === 'last_week' && t('lastWeek')}
                    {pKey === 'all_time' && t('allTime')}
                    {pKey === 'custom' && t('customRange')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPeriodOffset((p) => p + 1)}
            aria-label="Next Period"
            className="p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Reset Counter & Advanced Filter */}
        <div className="flex items-center gap-1">
          {/* Reset Counter Button (🔄 Reset Period) */}
          <button
            type="button"
            onClick={() => setIsResetPeriodModalOpen(true)}
            title={t('resetPeriod')}
            className={`p-2 rounded-full hover:bg-zinc-800 transition ${
              settings.resetStartDate ? 'text-blue-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Advanced Filter Button (🌪️ Filter) */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            title={t('filter')}
            className={`relative p-2 rounded-full hover:bg-zinc-800 transition ${
              hasActiveAdvancedFilter ? 'text-blue-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            {hasActiveAdvancedFilter && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
        </div>
      </header>

      {/* Custom Date Range Popover */}
      {showCustomRangePicker && (
        <div className="p-4 mx-4 mt-2 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase">{t('customRange')}</span>
            <button
              type="button"
              onClick={() => setShowCustomRangePicker(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
            <button
              type="button"
              onClick={() => setCustomTarget('start')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                customTarget === 'start'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Start: {customDateRange.startDate}
            </button>
            <button
              type="button"
              onClick={() => setCustomTarget('end')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                customTarget === 'end'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              End: {customDateRange.endDate}
            </button>
          </div>
          <MiniDateTimePicker
            date={customTarget === 'start' ? customDateRange.startDate : customDateRange.endDate}
            time="00:00"
            hasTime={false}
            onDateChange={(newD) => {
              if (customTarget === 'start') {
                setCustomDateRange({ ...customDateRange, startDate: newD });
              } else {
                setCustomDateRange({ ...customDateRange, endDate: newD });
              }
            }}
            onTimeChange={() => {}}
            onToggleHasTime={() => {}}
            lang={settings.language}
          />
          <button
            type="button"
            onClick={() => {
              setPeriodFilter('custom');
              setShowCustomRangePicker(false);
            }}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition shadow-lg shadow-blue-900/30"
          >
            {t('apply')}
          </button>
        </div>
      )}

      {/* 2. Sub-Navigation Tabs (Under Header): Daily vs Calendar */}
      <div className="px-4 pt-3 pb-1 max-w-2xl mx-auto w-full">
        <div className="flex p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800/80">
          <button
            type="button"
            onClick={() => setHomeSubView('daily')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              homeSubView === 'daily'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t('daily')}
          </button>
          <button
            type="button"
            onClick={() => setHomeSubView('calendar')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              homeSubView === 'calendar'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t('calendar')}
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 px-4 py-3 max-w-2xl mx-auto w-full space-y-4">
        {/* Smart Budget Alert Banner */}
        <SmartBudgetAlertBanner />

        {/* VIEW A: DAILY */}
        {homeSubView === 'daily' && (
          <div className="space-y-4">
            {/* Public Summary Block: INCOME (Green), EXPENSE (Red), BALANCE (Gold/White).
                Crucial: Calculated ONLY from Public accounts (isPrivate === false)! */}
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {t('totalBalance')} ({t('publicAccounts')})
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                  {formatCurrency(publicBalance, currencySymbol)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-zinc-800/80">
                {/* Total Income */}
                <div className="text-left">
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>{t('totalIncome')}</span>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-1">
                    {formatCurrency(publicIncome, currencySymbol)}
                  </div>
                </div>

                {/* Total Expense */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-xs font-bold text-red-400">
                    <span>{t('totalExpense')}</span>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono text-red-400 mt-1">
                    {formatCurrency(publicExpense, currencySymbol)}
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible Month & Day Transaction Blocks */}
            <GroupedTransactionList
              transactions={filteredTransactions}
              emptyMessage={t('noTransactions')}
            />
          </div>
        )}

        {/* VIEW B: CALENDAR */}
        {homeSubView === 'calendar' && (
          <div className="space-y-4">
            {/* Monthly Calendar Grid Card */}
            <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4 px-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonthOffset((p) => p - 1)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-base text-white">
                  {calendarDate.toLocaleDateString(settings.language === 'ar' ? 'ar-EG' : 'en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <button
                  type="button"
                  onClick={() => setCalendarMonthOffset((p) => p + 1)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {weekDayLabels.map((lbl, idx) => (
                  <div key={idx} className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider py-1">
                    {lbl}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  if (!cell.isCurrentMonth) {
                    return <div key={`empty_${idx}`} className="min-h-[80px]" />;
                  }

                  const isSelected = cell.dateStr === selectedCalendarDate;
                  const dayTxs = calendarDayTxsMap.get(cell.dateStr) || [];
                  const isToday = cell.dateStr === formatDateToYYYYMMDD(new Date());

                  const formatCompact = (val: number) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
                    return `${Math.round(val)}`;
                  };

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => setSelectedCalendarDate(cell.dateStr)}
                      className={`min-h-[80px] p-1 rounded-xl flex flex-col justify-between items-center transition relative border overflow-hidden ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-500 ring-1 ring-blue-500 shadow-md'
                          : isToday
                          ? 'bg-zinc-800/80 border-zinc-700'
                          : 'bg-zinc-950/60 border-zinc-800/60 hover:bg-zinc-800/40'
                      }`}
                    >
                      <span
                        className={`text-xs font-bold leading-none pt-0.5 ${
                          isSelected
                            ? 'text-white'
                            : isToday
                            ? 'text-blue-400'
                            : 'text-zinc-300'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Mini Transaction Amounts in non-overlapping micro-rows */}
                      <div className="w-full flex flex-col gap-1 overflow-hidden my-auto py-0.5">
                        {dayTxs.slice(0, dayTxs.length >= 3 ? 2 : 3).map((tx) => (
                          <div
                            key={tx.id}
                            className={`text-[9px] font-mono leading-tight truncate w-full px-0.5 py-0.5 rounded text-center font-bold ${
                              tx.type === 'income'
                                ? 'text-emerald-400 bg-emerald-950/70 border border-emerald-900/40'
                                : tx.type === 'expense'
                                ? 'text-red-400 bg-red-950/70 border border-red-900/40'
                                : 'text-blue-400 bg-blue-950/70 border border-blue-900/40'
                            }`}
                          >
                            {formatCompact(tx.amount)}
                          </div>
                        ))}
                        {dayTxs.length >= 3 && (
                          <div className="text-[8px] font-bold text-amber-300 bg-amber-950/60 border border-amber-900/40 rounded px-0.5 py-0.5 text-center leading-tight truncate">
                            +{dayTxs.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Transactions Block below calendar */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>{selectedCalendarDate}</span>
                </h4>
                <span className="text-xs text-zinc-500 font-mono">
                  {selectedCalendarDayTxs.length} {t('transactionsCount')}
                </span>
              </div>

              <GroupedTransactionList
                transactions={selectedCalendarDayTxs}
                emptyMessage={t('noTransactionsDay')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
