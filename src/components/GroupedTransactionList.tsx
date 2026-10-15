import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import { TransactionItem } from './TransactionItem';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  getMonthHeaderTitle,
  getDayHeaderTitle,
  formatCurrency,
} from '../utils/dateCycle';

interface GroupedTransactionListProps {
  transactions: Transaction[];
  emptyMessage?: string;
}

export const GroupedTransactionList: React.FC<GroupedTransactionListProps> = ({
  transactions,
  emptyMessage,
}) => {
  const { openTxDetailsModal, settings, t } = useApp();

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

        return (
          <div
            key={monthGroup.monthKey}
            className="rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg"
          >
            {/* Month Header */}
            <button
              type="button"
              onClick={() => toggleMonth(monthGroup.monthKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/90 hover:bg-zinc-800/90 text-left transition border-b border-zinc-800/60"
            >
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                {isMonthCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
                <span>{monthTitle}</span>
              </div>
              <div
                className={`text-xs font-mono font-bold ${
                  isMonthPositive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {isMonthPositive ? '+' : ''}
                {formatCurrency(monthGroup.monthNet, currencySymbol)}
              </div>
            </button>

            {/* Days list inside Month */}
            {!isMonthCollapsed && (
              <div className="p-2 sm:p-3 space-y-3">
                {monthGroup.days.map((dayGroup) => {
                  const isDayCollapsed = Boolean(collapsedDays[dayGroup.dayKey]);
                  const dayTitle = getDayHeaderTitle(dayGroup.dayKey, settings.language);
                  const isDayPositive = dayGroup.dayNet >= 0;

                  return (
                    <div
                      key={dayGroup.dayKey}
                      className="rounded-xl bg-zinc-900/40 border border-zinc-800/50 overflow-hidden"
                    >
                      {/* Day Header */}
                      <button
                        type="button"
                        onClick={() => toggleDay(dayGroup.dayKey)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 hover:bg-zinc-800/50 text-left transition"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                          {isDayCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                          )}
                          <span>{dayTitle}</span>
                        </div>
                        <div
                          className={`text-[11px] font-mono font-semibold ${
                            isDayPositive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isDayPositive ? '+' : ''}
                          {formatCurrency(dayGroup.dayNet, currencySymbol)}
                        </div>
                      </button>

                      {/* Transactions for this Day */}
                      {!isDayCollapsed && (
                        <div className="p-2 space-y-2">
                          {dayGroup.txs.map((tx) => (
                            <TransactionItem
                              key={tx.id}
                              transaction={tx}
                              onClick={() => openTxDetailsModal(tx)}
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
