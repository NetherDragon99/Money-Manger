import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import { TransactionItem } from './TransactionItem';
import { ChevronDown, ChevronRight, Check, Minus } from 'lucide-react';
import {
  getMonthHeaderTitle,
  getDayHeaderTitle,
  formatCurrency,
} from '../utils/dateCycle';

interface GroupedTransactionListProps {
  transactions: Transaction[];
  emptyMessage?: string;
  hideAccountBadge?: boolean;
}

export const GroupedTransactionList: React.FC<GroupedTransactionListProps> = ({
  transactions,
  emptyMessage,
  hideAccountBadge = false,
}) => {
  const {
    openTxDetailsModal,
    settings,
    t,
    selectedTxIds,
    isTxMultiSelect,
    toggleBatchTxs,
  } = useApp();

  const isArabic = settings.language === 'ar';

  // Collapsed state sets: keys are "YYYY-MM" or "YYYY-MM-DD"
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const toggleDay = (dayKey: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // Group by Month -> Day
  const groupedData = useMemo(() => {
    // Sort transactions descending (newest first for user view)
    const sorted = [...transactions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      if (timeA !== timeB) return timeB.localeCompare(timeA);
      return b.createdAt - a.createdAt;
    });

    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        monthNet: number;
        daysMap: Map<string, { dayKey: string; dayNet: number; txs: Transaction[] }>;
      }
    >();

    for (const tx of sorted) {
      const monthKey = tx.date.slice(0, 7); // "YYYY-MM"
      const dayKey = tx.date; // "YYYY-MM-DD"

      let monthEntry = monthsMap.get(monthKey);
      if (!monthEntry) {
        monthEntry = { monthKey, monthNet: 0, daysMap: new Map() };
        monthsMap.set(monthKey, monthEntry);
      }

      let dayEntry = monthEntry.daysMap.get(dayKey);
      if (!dayEntry) {
        dayEntry = { dayKey, dayNet: 0, txs: [] };
        monthEntry.daysMap.set(dayKey, dayEntry);
      }

      dayEntry.txs.push(tx);

      // Delta
      let delta = 0;
      if (tx.type === 'income') delta = tx.amount;
      else if (tx.type === 'expense') delta = -tx.amount;
      // Note: transfer between accounts doesn't affect global net unless viewed in single account, but we can reflect its nominal effect

      monthEntry.monthNet += delta;
      dayEntry.dayNet += delta;
    }

    return Array.from(monthsMap.values()).map((m) => ({
      ...m,
      days: Array.from(m.daysMap.values()),
    }));
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="py-12 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-zinc-500">
        <p className="text-sm font-medium">{emptyMessage || t('noTransactions')}</p>
      </div>
    );
  }

  const currencySymbol = settings.currencySymbol || '£';

  return (
    <div className="space-y-4">
      {groupedData.map((monthGroup) => {
        const isMonthCollapsed = Boolean(collapsedMonths[monthGroup.monthKey]);
        const monthTitle = getMonthHeaderTitle(monthGroup.monthKey, settings.language);
        const isMonthPositive = monthGroup.monthNet >= 0;

        const monthTxIds = monthGroup.days.flatMap((d) => d.txs).map((t) => t.id);
        const isAllMonthSelected = monthTxIds.length > 0 && monthTxIds.every((id) => selectedTxIds.includes(id));
        const isPartialMonthSelected = !isAllMonthSelected && monthTxIds.some((id) => selectedTxIds.includes(id));

        return (
          <div
            key={monthGroup.monthKey}
            className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg"
          >
            {/* Month Header with Select All Checkbox */}
            <div
              onClick={() => {
                if (isTxMultiSelect) {
                  toggleBatchTxs(monthTxIds);
                } else {
                  toggleMonth(monthGroup.monthKey);
                }
              }}
              className="w-full flex items-center justify-between px-3.5 py-3 bg-zinc-900/90 hover:bg-zinc-800/90 text-left rtl:text-right transition border-b border-zinc-800/60 cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2.5 font-bold text-white text-sm min-w-0">
                {/* Select All Checkbox for Month */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBatchTxs(monthTxIds);
                  }}
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition border cursor-pointer shrink-0 ${
                    isAllMonthSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-600/50'
                      : isPartialMonthSelected
                      ? 'bg-blue-600/40 border-blue-500 text-white'
                      : isTxMultiSelect
                      ? 'bg-zinc-950 border-zinc-700 text-transparent hover:border-blue-400'
                      : 'bg-zinc-900/80 border-zinc-700/80 text-transparent hover:border-blue-400 opacity-60 group-hover:opacity-100'
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

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMonth(monthGroup.monthKey);
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
                {formatCurrency(monthGroup.monthNet, currencySymbol)}
              </div>
            </div>

            {/* Days list inside Month */}
            {!isMonthCollapsed && (
              <div className="p-2 sm:p-3 space-y-3">
                {monthGroup.days.map((dayGroup) => {
                  const isDayCollapsed = Boolean(collapsedDays[dayGroup.dayKey]);
                  const dayTitle = getDayHeaderTitle(dayGroup.dayKey, settings.language);
                  const isDayPositive = dayGroup.dayNet >= 0;
                  const dayTxIds = dayGroup.txs.map((t) => t.id);
                  const isAllDaySelected = dayTxIds.length > 0 && dayTxIds.every((id) => selectedTxIds.includes(id));
                  const isPartialDaySelected = !isAllDaySelected && dayTxIds.some((id) => selectedTxIds.includes(id));

                  return (
                    <div
                      key={dayGroup.dayKey}
                      className="rounded-xl bg-zinc-900/40 border border-zinc-800/50 overflow-hidden"
                    >
                      {/* Day Header with Select All Checkbox */}
                      <div
                        onClick={() => {
                          if (isTxMultiSelect) {
                            toggleBatchTxs(dayTxIds);
                          } else {
                            toggleDay(dayGroup.dayKey);
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 text-left rtl:text-right transition border-b border-zinc-800/40 cursor-pointer select-none group"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 min-w-0">
                          {/* Select All Checkbox for Day */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBatchTxs(dayTxIds);
                            }}
                            className={`w-4.5 h-4.5 rounded-md flex items-center justify-center transition border cursor-pointer shrink-0 ${
                              isAllDaySelected
                                ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-600/50'
                                : isPartialDaySelected
                                ? 'bg-blue-600/40 border-blue-500 text-white'
                                : isTxMultiSelect
                                ? 'bg-zinc-950 border-zinc-700 text-transparent hover:border-blue-400'
                                : 'bg-zinc-900/80 border-zinc-700/80 text-transparent hover:border-blue-400 opacity-60 group-hover:opacity-100'
                            }`}
                            title={
                              isAllDaySelected
                                ? (isArabic ? 'إلغاء تحديد اليوم بالكامل' : 'Deselect Entire Day')
                                : (isArabic ? 'تحديد اليوم بالكامل' : 'Select Entire Day')
                            }
                          >
                            {isPartialDaySelected ? (
                              <Minus className="w-3 h-3 text-white" />
                            ) : (
                              <Check className={`w-3 h-3 ${isAllDaySelected ? 'text-white' : 'opacity-0'}`} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDay(dayGroup.dayKey);
                            }}
                            className="p-0.5 -m-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition cursor-pointer"
                          >
                            {isDayCollapsed ? (
                              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <span className="truncate">{dayTitle}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            ({dayTxIds.length})
                          </span>
                        </div>

                        <div
                          className={`text-[11px] font-mono font-semibold shrink-0 ${
                            isDayPositive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isDayPositive ? '+' : ''}
                          {formatCurrency(dayGroup.dayNet, currencySymbol)}
                        </div>
                      </div>

                      {/* Transactions for this Day */}
                      {!isDayCollapsed && (
                        <div className="p-2 space-y-2">
                          {dayGroup.txs.map((tx) => (
                            <TransactionItem
                              key={tx.id}
                              transaction={tx}
                              onClick={() => openTxDetailsModal(tx)}
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
      })}
    </div>
  );
};
