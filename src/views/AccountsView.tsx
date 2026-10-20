import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Lock,
  Plus,
  Check,
  Menu,
} from 'lucide-react';
import {
  getMonthCycleRange,
  isTransactionInRange,
  formatCurrency,
} from '../utils/dateCycle';
import { getLocalizedCurrencySymbol } from '../utils/currencies';
import { useHeaderScroll } from '../hooks/useHeaderScroll';

export const AccountsView: React.FC = React.memo(() => {
  const {
    accounts,
    transactions,
    settings,
    setSelectedAccountId,
    openAddAccountModal,
    reorderAccounts,
    setIsSharedHubModalOpen,
    setIsSidebarOpen,
    importSingleAccountData,
    showToast,
    t,
  } = useApp();

  const isHeaderVisible = useHeaderScroll();

  const handleMoveAccount = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= accounts.length) return;
    const copy = [...accounts];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    reorderAccounts(copy);
    showToast(
      settings.language === 'ar'
        ? targetIndex === 0
          ? `أصبح حساب "${moved.name}" الحساب الأساسي الافتراضي`
          : 'تم تحديث أولوية الحسابات'
        : targetIndex === 0
          ? `"${moved.name}" is now the primary default account`
          : 'Account priority updated',
      'info'
    );
  };

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

  const currencySymbol = getLocalizedCurrencySymbol(settings.currencySymbol, settings.language);

  return (
    <div className="bg-black text-white flex flex-col pb-24 px-4 py-3 max-w-md md:max-w-4xl lg:max-w-6xl mx-auto w-full space-y-5 animate-in fade-in">
      {/* Header with Universal Sidebar Access & Smart Auto-Hide on Scroll (Standardized h-16) */}
      <header className={`sticky top-0 z-30 h-16 bg-black/90 backdrop-blur-md -mx-4 px-4 border-b border-zinc-800/80 flex items-center justify-between transition-transform duration-300 ease-in-out ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="flex items-center gap-2">
          {/* Universal Sidebar Menu Button (☰) */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Menu"
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-800 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">{t('accounts')}</h2>
            <p className="text-[10px] sm:text-xs text-zinc-400">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} managed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddAccountModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition cursor-pointer shadow active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addAccount')}</span>
          </button>
        </div>
      </header>

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
          <span className="text-[11px] text-zinc-500">
            {settings.language === 'ar' ? 'الأول هو الأساسي الافتراضي' : 'Top account is primary default'}
          </span>
        </div>

        {/* Quick Link to Shared Accounts Hub ("Shared With Me" - Item 13) */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-zinc-900 to-purple-950/40 border border-blue-500/30 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/25 text-blue-400 flex items-center justify-center text-sm shadow-inner">
              👥
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {settings.language === 'ar' ? 'الحسابات المشتركة معي' : 'Shared With Me'}
              </div>
              <div className="text-[10px] text-zinc-400">
                {settings.language === 'ar' ? 'متابعة وتصفح الحسابات السحابية المشتركة لحظياً' : 'Browse live shared & followed accounts'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSharedHubModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
          >
            {settings.language === 'ar' ? 'عرض الحسابات' : 'View Hub'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {accounts.map((acc, index) => {
            const metrics = accountMonthMetricsMap.get(acc.id) || { income: 0, expense: 0 };
            const isPrimary = index === 0;
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                role="button"
                tabIndex={0}
                className="p-4 rounded-3xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99] transition cursor-pointer group shadow-lg"
              >
                {/* Dedicated Top Card Header Bar: Separates Reorder Controls from Balance */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50 mb-3">
                  {/* Reorder Arrows with priority index */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-mono text-zinc-500 mr-0.5">#{index + 1}</span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveAccount(index, 'up');
                      }}
                      className="p-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 disabled:hover:bg-zinc-950 transition cursor-pointer"
                      title="Move Up (Higher Priority)"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === accounts.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveAccount(index, 'down');
                      }}
                      className="p-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 disabled:hover:bg-zinc-950 transition cursor-pointer"
                      title="Move Down (Lower Priority)"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isPrimary && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <Check className="w-2.5 h-2.5 text-blue-400" />
                        <span>{settings.language === 'ar' ? 'الأساسي' : 'Primary'}</span>
                      </span>
                    )}
                    {acc.isPrivate && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="w-3 h-3" />
                        {t('privateAccount')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Row: Account Emoji Icon + Account Name + Balance on right */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
                      {acc.icon}
                    </div>
                    <div className="min-w-0">
                      <span className="text-base font-bold text-white truncate max-w-[150px] sm:max-w-xs group-hover:text-blue-300 transition block">
                        {acc.name}
                      </span>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {acc.customMonthStartDay === 'default'
                          ? `Start: Day ${settings.defaultMonthStartDay}`
                          : `Start: Day ${acc.customMonthStartDay}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black font-mono text-white">
                        {formatCurrency(acc.balance, currencySymbol)}
                      </span>
                    </div>
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
});
