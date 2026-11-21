import { SwipeableTabs } from '../components/SwipeableTabs';
import React, { useState, useMemo, memo, useCallback } from 'react';
import { useAppData, useAppUI, useAppActions } from '../context/AppContext';
import {
  Menu,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Calendar as CalendarIcon,
  Search,
  X,
  Check,
  Wallet,
} from 'lucide-react';
import { Transaction } from '../types';
import {
  resolveDateRange,
  isTransactionInRange,
  formatCurrency,
  padZero,
  formatDateToYYYYMMDD,
  getDaysInMonth,
  isManualAdjustment,
  applyAdvancedTransactionFilter,
  countActiveAdvancedFilters,
} from '../utils/dateCycle';
import { GroupedTransactionList } from '../components/GroupedTransactionList';
import { TransactionFilterBar } from '../components/TransactionFilterBar';
import { SmartBudgetAlertBanner } from '../components/SmartBudgetAlertBanner';
import { getTransactionBudgetPool } from '../utils/smartBudgetEngine';
import { IS_BETA_BUILD } from '../utils/channel';
import { useLongPress } from '../hooks/useLongPress';

const HomeViewBase: React.FC<{ isBarsVisible?: boolean }> = () => {
  const {
    accounts,
    categories,
    transactions,
    settings,
    accountsById,
    categoriesById,
    smartBudgetEvaluation,
    t,
  } = useAppData();
  const {
    homeSubView,
    periodFilter,
    periodOffset,
    customDateRange,
    advancedFilter,
    selectedTxIds,
    isTxMultiSelect,
  } = useAppUI();
  const {
    setHomeSubView,
    setPeriodFilter,
    setPeriodOffset,
    setCustomDateRange,
    setAdvancedFilter,
    clearAdvancedFilter,
    setIsSidebarOpen,
    setIsResetPeriodModalOpen,
    setIsFilterModalOpen,
    toggleBatchTxs,
    setCurrentTab,
    setIsSmartBudgetModalOpen,
  } = useAppActions();

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';
  const fixedCategoryIds = settings.smartBudget?.baseline?.fixedCategoryIds;

  const [searchQuery, setSearchQuery] = useState('');

  // Calendar view specific state
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    formatDateToYYYYMMDD(new Date())
  );

  // Filter out private accounts for Home summary!
  const publicAccountIds = useMemo(() => {
    return new Set(accounts.filter((a) => !a.isPrivate).map((a) => a.id));
  }, [accounts]);

  const publicAccounts = useMemo(() => {
    return accounts.filter((a) => !a.isPrivate);
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

  // Scope first to active duration, then apply scoped filters + search + sort
  const durationTransactions = useMemo(
    () => transactions.filter((tx) => isTransactionInRange(tx, activeDateRange)),
    [transactions, activeDateRange]
  );

  const filteredTransactions = useMemo(() => {
    return applyAdvancedTransactionFilter(durationTransactions, advancedFilter, {
      accounts,
      accountsById,
      categories,
      currencySymbol,
      searchQuery,
      resolveBudgetPool: (tx) => getTransactionBudgetPool(tx, fixedCategoryIds, categories),
    });
  }, [
    durationTransactions,
    advancedFilter,
    accounts,
    accountsById,
    categories,
    currencySymbol,
    searchQuery,
    fixedCategoryIds,
  ]);

  const handleOpenFilterModal = useCallback(() => {
    setIsFilterModalOpen(true);
  }, [setIsFilterModalOpen]);

  // Public Summary Calculation: INCOME, EXPENSE, BALANCE
  // Crucial: Calculated ONLY from Public accounts (isPrivate === false)!
  const { publicIncome, publicExpense, publicBalance } = useMemo(() => {
    let inc = 0;
    let exp = 0;

    for (const tx of filteredTransactions) {
      // Internal transfers and manual balance adjustments are NEVER counted as spending/income
      if (tx.type === 'transfer' || Boolean(tx.toAccountId) || isManualAdjustment(tx)) continue;
      const tax = typeof tx.taxAmount === 'number' && !isNaN(tx.taxAmount) ? Math.max(0, tx.taxAmount) : 0;
      const effectiveTotal = tx.amount + tax;
      if (tx.type === 'income') {
        if (publicAccountIds.has(tx.accountId)) {
          inc += effectiveTotal;
        }
      } else if (tx.type === 'expense') {
        if (publicAccountIds.has(tx.accountId)) {
          exp += effectiveTotal;
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

  const calendarDayTxIds = useMemo(() => selectedCalendarDayTxs.map((t) => t.id), [selectedCalendarDayTxs]);
  const isAllCalendarDaySelected = calendarDayTxIds.length > 0 && calendarDayTxIds.every((id) => selectedTxIds.includes(id));

  const { handlers: calendarDayHeaderHandlers } = useLongPress({
    onLongPress: () => {
      if (calendarDayTxIds.length === 0) return;
      if (!isAllCalendarDaySelected) {
        toggleBatchTxs(calendarDayTxIds);
      } else {
        toggleBatchTxs(calendarDayTxIds);
        toggleBatchTxs(calendarDayTxIds);
      }
    },
    onClick: () => {
      if (isTxMultiSelect) {
        toggleBatchTxs(calendarDayTxIds);
      }
    },
  });

  const todayRemaining = smartBudgetEvaluation.dailyStatus.todayRemaining;
  const allowanceState = smartBudgetEvaluation.dailyStatus.allowanceState;

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

  const activeFiltersCount = useMemo(
    () => countActiveAdvancedFilters(advancedFilter),
    [advancedFilter]
  );

  return (
    <div className="bg-black text-white flex flex-col pb-24 pt-16 animate-in fade-in">
      {/* 1. Top Header Bar with GPU CSS Auto-Hide on Scroll */}
      <header className="app-auto-header fixed top-0 left-0 right-0 max-w-full md:max-w-7xl landscape:max-w-none mx-auto z-20 h-16 landscape:h-14 px-4 bg-black/95 border-b border-zinc-800/80 flex items-center justify-between">
        {/* Left: Hamburger Menu Button (☰) */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open Menu"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-800 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: solv Brand Mark */}
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt="solv"
            className="w-7 h-7 rounded-lg shrink-0"
          />
          <span className="text-base font-black tracking-tight text-white">solv</span>
          {IS_BETA_BUILD && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">
              Beta
            </span>
          )}
        </div>

        {/* Right: Reset Counter Button */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsResetPeriodModalOpen(true)}
            title={t('resetPeriod')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-800 transition cursor-pointer ${
              settings.resetStartDate ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* View Content: Responsive Tablet & Desktop Container (Item 2) */}
      <div className="flex-1 px-4 py-3 w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto space-y-4">
        {/* Primary Duration & Scoped Filters Bar */}
        <TransactionFilterBar
          periodFilter={periodFilter}
          onPeriodChange={setPeriodFilter}
          periodOffset={periodOffset}
          onPeriodOffsetChange={setPeriodOffset}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
          advancedFilter={advancedFilter}
          onUpdateAdvancedFilter={setAdvancedFilter}
          onClearAdvancedFilter={clearAdvancedFilter}
          onOpenFilterModal={handleOpenFilterModal}
          activeAdvancedCount={activeFiltersCount}
          resolvedDateRange={activeDateRange}
          categoriesById={categoriesById}
          accountsById={accountsById}
          language={settings.language}
          currency={currencySymbol}
          resetStartDate={settings.resetStartDate}
        />

        {/* Safe-to-Spend Today Pill (Neatly on its own row under header, hidden when Smart Budget is paused) */}
        {!smartBudgetEvaluation.isPaused && (
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <button
              type="button"
              onClick={() => setIsSmartBudgetModalOpen(true)}
              title={isArabic ? 'المتبقي اليوم (الميزانية الذكية)' : 'Remaining Today (Smart Budget)'}
              className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer shadow-sm ${
                allowanceState === 'true_deficit'
                  ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400'
                  : allowanceState === 'heads_up'
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  allowanceState === 'true_deficit'
                    ? 'bg-red-400'
                    : allowanceState === 'heads_up'
                    ? 'bg-amber-400'
                    : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span>
                {isArabic ? 'المتبقي اليوم:' : 'Remaining Today:'}
              </span>
              <span className="font-mono font-black">
                {formatCurrency(Math.max(0, todayRemaining), currencySymbol)}
              </span>
              {todayRemaining < 0 && allowanceState !== 'true_deficit' && (
                <span className="text-[11px] font-medium text-amber-300/90">
                  ({isArabic ? `الأيام الجاية: ${formatCurrency(smartBudgetEvaluation.dailyStatus.upcomingDailyAllowance, currencySymbol)}` : `Next days: ${formatCurrency(smartBudgetEvaluation.dailyStatus.upcomingDailyAllowance, currencySymbol)}`})
                </span>
              )}
            </button>
          </div>
        )}

        {/* Smart Budget Alert Banner */}
        <SmartBudgetAlertBanner />

        {/* Real-time Search Input Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              settings.language === 'ar'
                ? 'بحث في المعاملات (الملاحظة، الفئة، التاريخ، المبلغ)...'
                : 'Search transactions by note, category, date, amount...'
            }
            className="w-full pl-10 pr-10 rtl:pl-10 rtl:pr-10 py-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/80 transition shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Summary Banner when Searching */}
        {searchQuery.trim() && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-950/35 border border-emerald-900/50 text-xs text-emerald-300">
            <span>
              {settings.language === 'ar'
                ? `نتائج البحث عن "${searchQuery}": ${filteredTransactions.length} معاملة`
                : `Search results for "${searchQuery}": ${filteredTransactions.length} transaction(s)`}
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-emerald-400 hover:text-white underline cursor-pointer"
            >
              {settings.language === 'ar' ? 'إلغاء البحث' : 'Clear search'}
            </button>
          </div>
        )}

                {/* 1:1 Finger-Tracking Carousel for Daily vs Calendar */}
        <SwipeableTabs
          tabs={[
            { id: 'daily', label: t('daily') },
            { id: 'calendar', label: t('calendar') },
          ]}
          activeTab={homeSubView}
          onChange={(tab) => setHomeSubView(tab as 'daily' | 'calendar')}
          onBoundaryDrag={(direction, deltaX, phase) => {
            if (direction === 'start') {
              window.dispatchEvent(
                new CustomEvent('mm-sidebar-drag', {
                  detail: { phase, deltaX, isRtl: settings.language === 'ar' },
                })
              );
            }
          }}
        >
          <div className="pb-16 sm:pb-20">
            <div className="space-y-4 landscape:space-y-0 landscape:grid landscape:grid-cols-12 landscape:gap-5 landscape:items-start">
            {/* Left Summary Column: Sticky on md/landscape with Quick Accounts Balance Breakdown */}
            <div className="landscape:col-span-5 space-y-4 md:sticky landscape:sticky top-4 self-start max-h-[calc(100dvh-6rem)] overflow-y-auto no-scrollbar">
              {/* Public Summary Block: INCOME (Green), EXPENSE (Red), BALANCE (Gold/White).
                  Crucial: Calculated ONLY from Public accounts (isPrivate === false)! */}
              <div className="p-6 landscape:p-4 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden">
                <div className="md:grid md:grid-cols-3 md:items-center md:gap-6 landscape:block landscape:space-y-3">
                  <div className="text-center md:text-start landscape:text-start md:col-span-1 space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {t('totalBalance')} ({t('publicAccounts')})
                    </span>
                    <div className="text-3xl sm:text-4xl landscape:text-2xl font-black font-mono text-white tracking-tight">
                      {formatCurrency(publicBalance, currencySymbol)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 md:mt-0 pt-5 md:pt-0 border-t md:border-t-0 md:border-s md:border-zinc-800/80 md:ps-6 md:col-span-2 landscape:mt-3 landscape:pt-3 landscape:border-t landscape:border-zinc-800/80 landscape:border-s-0 landscape:ps-0">
                    {/* Total Income */}
                    <div className="text-left rtl:text-right">
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <ArrowDown className="w-3.5 h-3.5" />
                        <span>{t('totalIncome')}</span>
                      </div>
                      <div className="text-base sm:text-lg landscape:text-base font-black font-mono text-emerald-400 mt-1">
                        {formatCurrency(publicIncome, currencySymbol)}
                      </div>
                    </div>

                    {/* Total Expense */}
                    <div className="text-right rtl:text-left">
                      <div className="flex items-center justify-end rtl:justify-start gap-1 text-xs font-bold text-red-400">
                        <span>{t('totalExpense')}</span>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-base sm:text-lg landscape:text-base font-black font-mono text-red-400 mt-1">
                        {formatCurrency(publicExpense, currencySymbol)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Quick Accounts Balance Breakdown */}
              {publicAccounts.length > 0 && (
                <div className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {isArabic ? 'أرصدة الحسابات' : 'Accounts Balance'}
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {publicAccounts.length} {isArabic ? 'حسابات عامة نشطة' : 'active public accounts'}
                        </span>
                      </div>
                    </div>
                    {setCurrentTab && (
                      <button
                        type="button"
                        onClick={() => setCurrentTab('accounts')}
                        className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                      >
                        {isArabic ? 'إدارة' : 'Manage'}
                      </button>
                    )}
                  </div>

                  {/* Compact Accounts List */}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar pr-0.5">
                    {publicAccounts.map((account) => {
                      const isNegative = account.balance < 0;
                      return (
                        <div
                          key={account.id}
                          onClick={() => setCurrentTab && setCurrentTab('accounts')}
                          className="flex items-center justify-between px-3 py-2 rounded-2xl bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800/50 transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base shrink-0 group-hover:scale-110 transition-transform">
                              {account.icon || '💳'}
                            </span>
                            <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                              {account.name}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-bold font-mono shrink-0 rtl:mr-2 ltr:ml-2 ${
                              isNegative
                                ? 'text-rose-400'
                                : account.balance > 0
                                ? 'text-emerald-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {formatCurrency(account.balance, currencySymbol, settings.language)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Month & Day Transaction Blocks with Account Badge Hidden */}
            <div className="landscape:col-span-7">
              <GroupedTransactionList
                transactions={filteredTransactions}
                emptyMessage={searchQuery ? (settings.language === 'ar' ? 'لا توجد نتائج بحث مطابقة' : 'No matching search results') : t('noTransactions')}
                hideAccountBadge={true}
                sortBy={advancedFilter.sortBy}
              />
            </div>
          </div>
          </div>
          <div className="pb-16 sm:pb-20">
            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 landscape:space-y-0 landscape:grid landscape:grid-cols-12 landscape:gap-5 items-start">
            {/* Monthly Calendar Grid Card */}
            <div className="lg:col-span-7 landscape:col-span-7 p-4 sm:p-5 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl">
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
                          ? 'bg-emerald-600/25 border-emerald-500 ring-1 ring-emerald-500 shadow-md'
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
                            ? 'text-emerald-400'
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

            {/* Selected Day Transactions Block below calendar in portrait, beside it in landscape/desktop */}
            <div className="lg:col-span-5 landscape:col-span-5 space-y-2 lg:sticky lg:top-20 landscape:sticky landscape:top-16">
              <div className="flex items-center justify-between px-1">
                <h4
                  {...calendarDayHeaderHandlers}
                  className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{selectedCalendarDate}</span>
                </h4>
                <div className="flex items-center gap-2">
                  {selectedCalendarDayTxs.length > 0 && isTxMultiSelect && (
                    <button
                      type="button"
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBatchTxs(calendarDayTxIds);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                        isAllCalendarDaySelected
                          ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                      title={
                        isAllCalendarDaySelected
                          ? (settings.language === 'ar' ? 'إلغاء تحديد معاملات اليوم' : 'Deselect Day')
                          : (settings.language === 'ar' ? 'تحديد كافة معاملات اليوم' : 'Select Day')
                      }
                    >
                      <Check className="w-3 h-3" />
                      <span>
                        {isAllCalendarDaySelected
                          ? (settings.language === 'ar' ? 'إلغاء التحديد' : 'Deselect')
                          : (settings.language === 'ar' ? 'تحديد الكل' : 'Select All')}
                      </span>
                    </button>
                  )}
                  <span className="text-xs text-zinc-500 font-mono">
                    {selectedCalendarDayTxs.length} {t('transactionsCount')}
                  </span>
                </div>
              </div>

              <GroupedTransactionList
                transactions={selectedCalendarDayTxs}
                emptyMessage={t('noTransactionsDay')}
                hideAccountBadge={true}
              />
            </div>
          </div>
          </div>
        </SwipeableTabs>
      </div>
    </div>
  );
};

export const HomeView = memo(HomeViewBase);