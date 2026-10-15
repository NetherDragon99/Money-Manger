import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Lock,
  Plus,
} from 'lucide-react';
import {
  getMonthCycleRange,
  isTransactionInRange,
  formatCurrency,
} from '../utils/dateCycle';

export const AccountsView: React.FC = () => {
  const {
    accounts,
    transactions,
    settings,
    setSelectedAccountId,
    openAddAccountModal,
    t,
  } = useApp();

  // Current month cycle range (using default month start day)
  const currentMonthRange = useMemo(() => {
    return getMonthCycleRange(new Date(), settings.defaultMonthStartDay, 0);
  }, [settings.defaultMonthStartDay]);

  // CRITICAL RULE: Global Net Worth Summary Block sums ALL ACCOUNTS (Both Public AND Private)!
  const { totalGlobalBalance, totalGlobalIncome, totalGlobalExpense } = useMemo(() => {
    // Total Balance = sum of ALL accounts
    const bal = accounts.reduce((acc, a) => acc + a.balance, 0);

    let inc = 0;
    let exp = 0;

    for (const tx of transactions) {
      if (isTransactionInRange(tx, currentMonthRange)) {
        if (tx.type === 'income') inc += tx.amount;
        if (tx.type === 'expense') exp += tx.amount;
        // Internal transfers between owned accounts don't alter overall net worth
      }
    }

    return {
      totalGlobalBalance: bal,
      totalGlobalIncome: inc,
      totalGlobalExpense: exp,
    };
  }, [accounts, transactions, currentMonthRange]);

  // Per-Account Income and Expense for the current month
  const accountMonthMetricsMap = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();

    for (const acc of accounts) {
      map.set(acc.id, { income: 0, expense: 0 });
    }

    for (const tx of transactions) {
      if (isTransactionInRange(tx, currentMonthRange)) {
        if (tx.type === 'income') {
          const m = map.get(tx.accountId);
          if (m) m.income += tx.amount;
        } else if (tx.type === 'expense') {
          const m = map.get(tx.accountId);
          if (m) m.expense += tx.amount;
        } else if (tx.type === 'transfer') {
          // Source account sent transfer: counts as expense for this account
          const mFrom = map.get(tx.accountId);
          if (mFrom) mFrom.expense += tx.amount;
          // Destination account received transfer: counts as income for this account
          if (tx.toAccountId) {
            const mTo = map.get(tx.toAccountId);
            if (mTo) mTo.income += tx.amount;
          }
        }
      }
    }

    return map;
  }, [accounts, transactions, currentMonthRange]);

  const currencySymbol = settings.currencySymbol || '£';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-28 px-4 py-4 max-w-2xl mx-auto w-full space-y-5 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight">{t('accounts')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} managed
          </p>
        </div>
        <button
          type="button"
          onClick={openAddAccountModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-blue-400 hover:text-white hover:border-zinc-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addAccount')}</span>
        </button>
      </div>

      {/* Global Net Worth Summary Block:
          Top Center: TOTAL BALANCE in large White text.
          Bottom Left: ↓ TOTAL INCOME (Green).
          Bottom Right: ↑ TOTAL EXPENSE (Red).
          CRITICAL RULE: Sums ALL ACCOUNTS (Both Public AND Private)! */}
      <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {t('netWorth')} (All Accounts)
          </span>
          <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
            {formatCurrency(totalGlobalBalance, currencySymbol)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-zinc-800/80">
          {/* Bottom Left: Total Income */}
          <div className="text-left">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{t('totalIncome')}</span>
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-1">
              {formatCurrency(totalGlobalIncome, currencySymbol)}
            </div>
          </div>

          {/* Bottom Right: Total Expense */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-xs font-bold text-red-400">
              <span>{t('totalExpense')}</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black font-mono text-red-400 mt-1">
              {formatCurrency(totalGlobalExpense, currencySymbol)}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Accounts
          </h3>
          <span className="text-[11px] text-zinc-500">Tap for details & transactions</span>
        </div>

        <div className="space-y-3">
          {accounts.map((acc) => {
            const metrics = accountMonthMetricsMap.get(acc.id) || { income: 0, expense: 0 };
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                role="button"
                tabIndex={0}
                className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition cursor-pointer group shadow-lg"
              >
                {/* Top Row: Account Emoji Icon + Account Name (with subtle 🔒 Private badge if private) + Current Balance on right */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
                      {acc.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white truncate max-w-[150px] sm:max-w-xs group-hover:text-blue-300 transition">
                          {acc.name}
                        </span>
                        {acc.isPrivate && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Lock className="w-3 h-3" />
                            {t('privateAccount')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {acc.customMonthStartDay === 'default'
                          ? `Start: Day ${settings.defaultMonthStartDay}`
                          : `Start: Day ${acc.customMonthStartDay}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="text-base sm:text-lg font-black font-mono text-white">
                      {formatCurrency(acc.balance, currencySymbol)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
                  </div>
                </div>

                {/* Bottom Row (split inside card):
                    INCOME £ X ↓ (Green) on the left | EXPENSES £ Y ↑ (Red) on the right for current month */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-zinc-800/60 text-xs">
                  <div className="flex items-center gap-1 text-emerald-400 font-medium">
                    <span className="text-zinc-500">{t('income')}:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(metrics.income, currencySymbol)}
                    </span>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex items-center justify-end gap-1 text-red-400 font-medium">
                    <span className="text-zinc-500">{t('expense')}:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(metrics.expense, currencySymbol)}
                    </span>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
