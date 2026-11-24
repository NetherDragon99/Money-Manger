import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { Transaction, TransactionSortBy } from '../types';
import { useAppData, useAppUI, useAppActions } from '../context/AppContext';
import { TransactionItem } from './TransactionItem';
import { ChevronDown, ChevronRight, Check, Minus } from 'lucide-react';
import {
  getMonthHeaderTitle,
  getDayHeaderTitle,
  formatCurrency,
  isManualAdjustment,
  getEffectiveTransactionAmount,
} from '../utils/dateCycle';
import { useLongPress } from '../hooks/useLongPress';

const CHUNK_SIZE = 60;

interface MonthHeaderRowProps {
  monthKey: string;
  monthTitle: string;
  monthNet: number;
  monthTxIds: string[];
  isMonthCollapsed: boolean;
  toggleMonth: (key: string) => void;
  isTxMultiSelect: boolean;
  selectedTxIdSet: Set<string>;
  toggleBatchTxs: (ids: string[]) => void;
  currencySymbol: string;
  isArabic: boolean;
}

const MonthHeaderRowBase: React.FC<MonthHeaderRowProps> = ({
  monthKey,
  monthTitle,
  monthNet,
  monthTxIds,
  isMonthCollapsed,
  toggleMonth,
  isTxMultiSelect,
  selectedTxIdSet,
  toggleBatchTxs,
  currencySymbol,
  isArabic,
}) => {
  const isAllMonthSelected = monthTxIds.length > 0 && monthTxIds.every((id) => selectedTxIdSet.has(id));
  const isPartialMonthSelected = !isAllMonthSelected && monthTxIds.some((id) => selectedTxIdSet.has(id));
  const isMonthPositive = monthNet >= 0;

  const { handlers } = useLongPress({
    onLongPress: () => {
      if (monthTxIds.length === 0) return;
      if (!isAllMonthSelected) {
        toggleBatchTxs(monthTxIds);
      } else {
        toggleBatchTxs(monthTxIds);
        toggleBatchTxs(monthTxIds);
      }
    },
    onClick: () => {
      if (isTxMultiSelect) {
        toggleBatchTxs(monthTxIds);
      } else {
        toggleMonth(monthKey);
      }
    },
  });

  return (
    <div
      {...handlers}
      className="w-full flex items-center justify-between px-3.5 py-3 bg-zinc-900/90 hover:bg-zinc-800/90 text-left rtl:text-right transition border-b border-zinc-800/60 cursor-pointer select-none group"
    >
      <div className="flex items-center gap-2.5 font-bold text-white text-sm min-w-0">
        {/* Select All Checkbox for Month: hidden by default until Global Multi-Select is active */}
        {isTxMultiSelect && (
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleBatchTxs(monthTxIds);
            }}
            className={`w-5 h-5 rounded-lg flex items-center justify-center transition border cursor-pointer shrink-0 ${
              isAllMonthSelected
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-600/40'
                : isPartialMonthSelected
                ? 'bg-emerald-600/40 border-emerald-500 text-white'
                : 'bg-zinc-950 border-zinc-700 text-transparent hover:border-emerald-400'
            }`}
            title={
              isAllMonthSelected
                ? (isArabic ? 'إلغاء تحديد الشهر بالكامل' : 'Deselect Entire Month')
                : (isArabic ? 'تحديد الشهر بالكامل' : 'Select Entire Month')
            }
          >
            {isPartialMonthSelected ? (
              <Minus className="w-3.5 h-3.5 text-white" />
            ) : (
              <Check className={`w-3.5 h-3.5 ${isAllMonthSelected ? 'text-white' : 'opacity-0'}`} />
            )}
          </button>
        )}

        <button
          type="button"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleMonth(monthKey);
          }}
          className="p-1 -m-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          {isMonthCollapsed ? (
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        <span className="truncate">{monthTitle}</span>
        <span className="text-[10px] text-zinc-500 font-mono font-normal">
          ({monthTxIds.length})
        </span>
      </div>

      <div
        className={`text-xs font-mono font-bold shrink-0 ${
          isMonthPositive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isMonthPositive ? '+' : ''}
        {formatCurrency(monthNet, currencySymbol)}
      </div>
    </div>
  );
};

const MonthHeaderRow = memo(MonthHeaderRowBase);

interface DayHeaderRowProps {
  dayKey: string;
  dayTitle: string;
  dayNet: number;
  dayTxIds: string[];
  isDayCollapsed: boolean;
  toggleDay: (key: string) => void;
  isTxMultiSelect: boolean;
  selectedTxIdSet: Set<string>;
  toggleBatchTxs: (ids: string[]) => void;
  currencySymbol: string;
  isArabic: boolean;
}

const DayHeaderRowBase: React.FC<DayHeaderRowProps> = ({
  dayKey,
  dayTitle,
  dayNet,
  dayTxIds,
  isDayCollapsed,
  toggleDay,
  isTxMultiSelect,
  selectedTxIdSet,
  toggleBatchTxs,
  currencySymbol,
  isArabic,
}) => {
  const isAllDaySelected = dayTxIds.length > 0 && dayTxIds.every((id) => selectedTxIdSet.has(id));
  const isPartialDaySelected = !isAllDaySelected && dayTxIds.some((id) => selectedTxIdSet.has(id));
  const isDayPositive = dayNet >= 0;

  const { handlers } = useLongPress({
    onLongPress: () => {
      if (dayTxIds.length === 0) return;
      if (!isAllDaySelected) {
        toggleBatchTxs(dayTxIds);
      } else {
        toggleBatchTxs(dayTxIds);
        toggleBatchTxs(dayTxIds);
      }
    },
    onClick: () => {
      if (isTxMultiSelect) {
        toggleBatchTxs(dayTxIds);
      } else {
        toggleDay(dayKey);
      }
    },
  });

  return (
    <div
      {...handlers}
      className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 text-left rtl:text-right transition border-b border-zinc-800/40 cursor-pointer select-none group"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 min-w-0">
        {/* Select All Checkbox for Day: hidden by default until Global Multi-Select is active */}
        {isTxMultiSelect && (
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleBatchTxs(dayTxIds);
            }}
            className={`w-4.5 h-4.5 rounded-md flex items-center justify-center transition border cursor-pointer shrink-0 ${
              isAllDaySelected
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-600/40'
                : isPartialDaySelected
                ? 'bg-emerald-600/40 border-emerald-500 text-white'
                : 'bg-zinc-950 border-zinc-700 text-transparent hover:border-emerald-400'
            }`}
            title={
              isAllDaySelected
                ? (isArabic ? 'إلغاء تحديد اليوم بالكامل' : 'Deselect Entire Day')
                : (isArabic ? 'تحديد اليوم بالكامل' : 'Select Entire Day')
            }
          >
            {isPartialDaySelected ? (
              <Minus className="w-3.5 h-3.5 text-white" />
            ) : (
              <Check className={`w-3.5 h-3.5 ${isAllDaySelected ? 'text-white' : 'opacity-0'}`} />
            )}
          </button>
        )}

        <button
          type="button"
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleDay(dayKey);
          }}
          className="p-1 -m-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          {isDayCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        <span className="truncate">{dayTitle}</span>
        <span className="text-[10px] text-zinc-500 font-mono font-normal">
          ({dayTxIds.length})
        </span>
      </div>

      <div
        className={`text-xs font-mono font-bold shrink-0 ${
          isDayPositive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isDayPositive ? '+' : ''}
        {formatCurrency(dayNet, currencySymbol)}
      </div>
    </div>
  );
};

const DayHeaderRow = memo(DayHeaderRowBase);

interface GroupedTransactionListProps {
  transactions: Transaction[];
  emptyMessage?: string;
  hideAccountBadge?: boolean;
  sortBy?: TransactionSortBy;
}

const GroupedTransactionListBase: React.FC<GroupedTransactionListProps> = ({
  transactions,
  emptyMessage,
  hideAccountBadge = false,
  sortBy = 'date_desc',
}) => {
  const { accountsById, settings, t } = useAppData();
  const { selectedTxIds, isTxMultiSelect } = useAppUI();
  const {
    openTxDetailsModal,
    toggleBatchTxs,
    toggleTxSelection,
    startTxMultiSelect,
  } = useAppActions();

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';
  const selectedTxIdSet = useMemo(() => new Set(selectedTxIds), [selectedTxIds]);

  // Collapsed state sets: keys are "YYYY-MM" or "YYYY-MM-DD"
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  // Progressive chunking state (renders up to 60 items at a time for smooth 120fps scrolling)
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const firstTxId = transactions[0]?.id || '';

  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [transactions.length, sortBy, firstTxId]);

  useEffect(() => {
    if (visibleCount >= transactions.length) return;
    const node = loadMoreSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(transactions.length, prev + CHUNK_SIZE));
        }
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, transactions.length]);

  const toggleMonth = useCallback((monthKey: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  }, []);

  const toggleDay = useCallback((dayKey: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  }, []);

  const isAmountSort = sortBy === 'amount_desc' || sortBy === 'amount_asc';

  // Flat sorted transactions for amount-based sorts
  const flatSortedTransactions = useMemo(() => {
    if (!isAmountSort) return [];
    const dir = sortBy === 'amount_asc' ? 1 : -1;
    return [...transactions].sort((a, b) => {
      const amtDiff = (getEffectiveTransactionAmount(a) - getEffectiveTransactionAmount(b)) * dir;
      if (Math.abs(amtDiff) > 0.0001) return amtDiff;
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt - a.createdAt;
    });
  }, [transactions, sortBy, isAmountSort]);

  // Group by Month -> Day for chronological sorts (date_desc / date_asc)
  const groupedData = useMemo(() => {
    if (isAmountSort) return [];
    const dir = sortBy === 'date_asc' ? 1 : -1;
    const sorted = [...transactions].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date) * dir;
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      if (timeA !== timeB) return timeA.localeCompare(timeB) * dir;
      return (a.createdAt - b.createdAt) * dir;
    });

    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        monthNet: number;
        monthTxIds: string[];
        daysMap: Map<string, { dayKey: string; dayNet: number; dayTxIds: string[]; txs: Transaction[] }>;
      }
    >();

    for (const tx of sorted) {
      const monthKey = tx.date.slice(0, 7); // "YYYY-MM"
      const dayKey = tx.date; // "YYYY-MM-DD"

      let monthEntry = monthsMap.get(monthKey);
      if (!monthEntry) {
        monthEntry = { monthKey, monthNet: 0, monthTxIds: [], daysMap: new Map() };
        monthsMap.set(monthKey, monthEntry);
      }

      let dayEntry = monthEntry.daysMap.get(dayKey);
      if (!dayEntry) {
        dayEntry = { dayKey, dayNet: 0, dayTxIds: [], txs: [] };
        monthEntry.daysMap.set(dayKey, dayEntry);
      }

      dayEntry.txs.push(tx);
      dayEntry.dayTxIds.push(tx.id);
      monthEntry.monthTxIds.push(tx.id);

      // Delta - exclude manual balance adjustments so day and month totals reflect real activity
      let delta = 0;
      if (!isManualAdjustment(tx)) {
        if (tx.type === 'income') delta = tx.amount;
        else if (tx.type === 'expense') delta = -tx.amount;
      }

      monthEntry.monthNet += delta;
      dayEntry.dayNet += delta;
    }

    return Array.from(monthsMap.values()).map((m) => ({
      monthKey: m.monthKey,
      monthNet: m.monthNet,
      monthTxIds: m.monthTxIds,
      days: Array.from(m.daysMap.values()),
    }));
  }, [transactions, sortBy, isAmountSort]);

  // Progressive slice across Month/Day structure without changing true net/counts in headers
  const { chunkedGroups, hasMoreGrouped } = useMemo(() => {
    if (isAmountSort) return { chunkedGroups: [] as typeof groupedData, hasMoreGrouped: false };
    let budget = visibleCount;
    let truncated = false;
    const out: typeof groupedData = [];

    for (const m of groupedData) {
      if (budget <= 0) {
        truncated = true;
        break;
      }
      if (collapsedMonths[m.monthKey]) {
        out.push(m);
        continue;
      }
      const slicedDays: typeof m.days = [];
      for (const d of m.days) {
        if (budget <= 0) {
          truncated = true;
          break;
        }
        if (collapsedDays[d.dayKey]) {
          slicedDays.push(d);
          continue;
        }
        if (d.txs.length <= budget) {
          slicedDays.push(d);
          budget -= d.txs.length;
        } else {
          slicedDays.push({
            ...d,
            txs: d.txs.slice(0, budget),
          });
          budget = 0;
          truncated = true;
        }
      }
      out.push({
        ...m,
        days: slicedDays,
      });
    }
    return { chunkedGroups: out, hasMoreGrouped: truncated };
  }, [groupedData, visibleCount, collapsedMonths, collapsedDays, isAmountSort]);

  if (transactions.length === 0) {
    return (
      <div className="py-12 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500">
        <p className="text-sm font-medium">{emptyMessage || t('noTransactions')}</p>
      </div>
    );
  }

  const hasMore = isAmountSort ? visibleCount < flatSortedTransactions.length : hasMoreGrouped;

  return (
    <div className="space-y-4">
      {isAmountSort ? (
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg">
          <div className="px-3.5 py-2.5 bg-zinc-900/90 border-b border-zinc-800/60 flex items-center justify-between text-xs font-bold text-zinc-300">
            <span>
              {sortBy === 'amount_desc'
                ? (isArabic ? 'مرتبة حسب الأكبر قيمة' : 'Sorted: Highest Amount First')
                : (isArabic ? 'مرتبة حسب الأصغر قيمة' : 'Sorted: Lowest Amount First')}
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              {flatSortedTransactions.length}
            </span>
          </div>
          <div className="p-2 sm:p-3 space-y-2">
            {flatSortedTransactions.slice(0, visibleCount).map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                fromAccount={accountsById.get(tx.accountId)}
                toAccount={tx.toAccountId ? accountsById.get(tx.toAccountId) : undefined}
                currencySymbol={currencySymbol}
                language={settings.language}
                isSelected={selectedTxIdSet.has(tx.id)}
                isTxMultiSelect={isTxMultiSelect}
                onOpenDetails={openTxDetailsModal}
                onToggleSelection={toggleTxSelection}
                onStartMultiSelect={startTxMultiSelect}
                hideAccountBadge={hideAccountBadge}
              />
            ))}
          </div>
        </div>
      ) : (
        chunkedGroups.map((monthGroup) => {
          const isMonthCollapsed = Boolean(collapsedMonths[monthGroup.monthKey]);
          const monthTitle = getMonthHeaderTitle(monthGroup.monthKey, settings.language);

          return (
            <div
              key={monthGroup.monthKey}
              className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg"
            >
              {/* Month Header with Select All Checkbox */}
              <MonthHeaderRow
                monthKey={monthGroup.monthKey}
                monthTitle={monthTitle}
                monthNet={monthGroup.monthNet}
                monthTxIds={monthGroup.monthTxIds}
                isMonthCollapsed={isMonthCollapsed}
                toggleMonth={toggleMonth}
                isTxMultiSelect={isTxMultiSelect}
                selectedTxIdSet={selectedTxIdSet}
                toggleBatchTxs={toggleBatchTxs}
                currencySymbol={currencySymbol}
                isArabic={isArabic}
              />

              {/* Days list inside Month */}
              {!isMonthCollapsed && (
                <div className="p-2 sm:p-3 space-y-3">
                  {monthGroup.days.map((dayGroup) => {
                    const isDayCollapsed = Boolean(collapsedDays[dayGroup.dayKey]);
                    const dayTitle = getDayHeaderTitle(dayGroup.dayKey, settings.language);

                    return (
                      <div
                        key={dayGroup.dayKey}
                        className="rounded-xl bg-zinc-900/40 border border-zinc-800/50 overflow-hidden"
                      >
                        {/* Day Header with Select All Checkbox */}
                        <DayHeaderRow
                          dayKey={dayGroup.dayKey}
                          dayTitle={dayTitle}
                          dayNet={dayGroup.dayNet}
                          dayTxIds={dayGroup.dayTxIds}
                          isDayCollapsed={isDayCollapsed}
                          toggleDay={toggleDay}
                          isTxMultiSelect={isTxMultiSelect}
                          selectedTxIdSet={selectedTxIdSet}
                          toggleBatchTxs={toggleBatchTxs}
                          currencySymbol={currencySymbol}
                          isArabic={isArabic}
                        />

                        {/* Transactions for this Day */}
                        {!isDayCollapsed && (
                          <div className="p-2 space-y-2">
                            {dayGroup.txs.map((tx) => (
                              <TransactionItem
                                key={tx.id}
                                transaction={tx}
                                fromAccount={accountsById.get(tx.accountId)}
                                toAccount={tx.toAccountId ? accountsById.get(tx.toAccountId) : undefined}
                                currencySymbol={currencySymbol}
                                language={settings.language}
                                isSelected={selectedTxIdSet.has(tx.id)}
                                isTxMultiSelect={isTxMultiSelect}
                                onOpenDetails={openTxDetailsModal}
                                onToggleSelection={toggleTxSelection}
                                onStartMultiSelect={startTxMultiSelect}
                                hideAccountBadge={hideAccountBadge}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {hasMore && (
        <div ref={loadMoreSentinelRef} className="pt-1 pb-3 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(transactions.length, prev + CHUNK_SIZE))}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition cursor-pointer"
          >
            {isArabic
              ? `عرض المزيد (${transactions.length - visibleCount} متبقية)`
              : `Load more (${transactions.length - visibleCount} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
};

export const GroupedTransactionList = memo(GroupedTransactionListBase);
