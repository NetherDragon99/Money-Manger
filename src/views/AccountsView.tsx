import React, { useMemo } from 'react';
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
import { useLongPress } from '../hooks/useLongPress';
import { Account } from '../types';

interface AccountCardProps {
  acc: Account;
  index: number;
  accountsLength: number;
  metrics: { income: number; expense: number };
  isPrimary: boolean;
  currencySymbol: string;
  isAccountMultiSelect: boolean;
  isSelected: boolean;
  onOpenDetails: () => void;
  onToggleSelection: () => void;
  onStartMultiSelect: () => void;
  onMoveAccount: (index: number, direction: 'up' | 'down') => void;
  t: (key: any) => string;
  language: 'en' | 'ar';
}

const AccountCard: React.FC<AccountCardProps> = ({
  acc,
  index,
  accountsLength,
  metrics,
  isPrimary,
  currencySymbol,
  isAccountMultiSelect,
  isSelected,
  onOpenDetails,
  onToggleSelection,
  onStartMultiSelect,
  onMoveAccount,
  t,
  language,
}) => {
  const { handlers } = useLongPress({
    onLongPress: () => {
      onStartMultiSelect();
    },
    onClick: () => {
      if (isAccountMultiSelect) {
        onToggleSelection();
      } else {
        onOpenDetails();
      }
    },
  });

  return (
    <div
      {...handlers}
      onClick={(e) => {
        if (isAccountMultiSelect) {
          e.preventDefault();
          onToggleSelection();
        } else {
          handlers.onClick?.(e);
        }
      }}
      data-no-swipe="true"
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMultiSelect();
      }}
      role="button"
      tabIndex={0}
      className={`p-4 rounded-3xl bg-zinc-900 border transition cursor-pointer group shadow-lg relative select-none ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-950/25'
          : 'border-zinc-800/80 hover:bg-zinc-850 hover:border-zinc-700 active:scale-[0.99]'
      }`}
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
              onMoveAccount(index, 'up');
            }}
            className="p-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 disabled:hover:bg-zinc-950 transition cursor-pointer"
            title="Move Up (Higher Priority)"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            disabled={index === accountsLength - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMoveAccount(index, 'down');
            }}
            className="p-1 rounded-md bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 disabled:hover:bg-zinc-950 transition cursor-pointer"
            title="Move Down (Lower Priority)"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {isAccountMultiSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition border cursor-pointer active:scale-90 ${
                isSelected
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                  : 'bg-zinc-950 border-zinc-700 hover:border-zinc-500 text-transparent'
              }`}
              title={isSelected ? 'Deselect' : 'Select'}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}
          {isPrimary && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
              <Check className="w-2.5 h-2.5 text-blue-400" />
              <span>{language === 'ar' ? 'الأساسي' : 'Primary'}</span>
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
                ? `Start: Day ${language === 'ar' ? 'الافتراضي' : 'Default'}`
                : `Start: Day ${acc.customMonthStartDay}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-2">
          <div className="text-right">
            <span className="text-base sm:text-lg font-black font-mono text-white">
              {formatCurrency(acc.balance, currencySymbol, language)}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-zinc-800/60 text-xs">
        <div className="flex items-center gap-1 text-emerald-400 font-medium">
          <span className="text-zinc-500">{t('income')}:</span>
          <span className="font-mono font-bold">
            {formatCurrency(metrics.income, currencySymbol, language)}
          </span>
          <ArrowDown className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center justify-end gap-1 text-red-400 font-medium">
          <span className="text-zinc-500">{t('expense')}:</span>
          <span className="font-mono font-bold">
            {formatCurrency(metrics.expense, currencySymbol, language)}
          </span>
          <ArrowUp className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

export const AccountsView: React.FC<{ isBarsVisible?: boolean }> = ({ isBarsVisible: propBarsVisible }) => {
  const {
    accounts,
    transactions,
    settings,
    setSelectedAccountId,
    openAddAccountModal,
    reorderAccounts,
    setIsSharedHubModalOpen,
    isAccountMultiSelect,
    selectedAccountIds,
    startAccountMultiSelect,
    toggleAccountSelection,
    clearAccountSelection,
    setIsSidebarOpen,
    showToast,
    t,
  } = useApp();

  const isHeaderVisible = propBarsVisible !== undefined ? propBarsVisible : true;

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
    const bal = accounts.reduce((acc, a) => acc + a.balance, 0);
    let inc = 0;
    let exp = 0;

    for (const tx of transactions) {
      if (isTransactionInRange(tx, currentMonthRange)) {
        if (tx.type === 'income') inc += tx.amount;
        if (tx.type === 'expense') exp += tx.amount;
      }
    }

    return {
      totalGlobalBalance: bal,
      totalGlobalIncome: inc,
      totalGlobalExpense: exp,
    };
  }, [accounts, transactions, currentMonthRange]);

  // Per-account Current Month Income/Expense Map
  const accountMonthMetricsMap = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const a of accounts) {
      map.set(a.id, { income: 0, expense: 0 });
    }
    for (const tx of transactions) {
      if (isTransactionInRange(tx, currentMonthRange)) {
        const entry = map.get(tx.accountId);
        if (entry) {
          if (tx.type === 'income') entry.income += tx.amount;
          if (tx.type === 'expense') entry.expense += tx.amount;
        }
      }
    }
    return map;
  }, [accounts, transactions, currentMonthRange]);

  const currencySymbol = getLocalizedCurrencySymbol(settings.currencySymbol, settings.language);

  return (
    <div className="w-full flex flex-col flex-1 pb-24 select-none">
      {/* 1. Unified Standard Top Header Bar Across All 5 Tabs */}
      <header
        style={{
          transform: isHeaderVisible ? 'translateY(0%)' : 'translateY(-110%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className={`fixed top-0 left-0 right-0 max-w-full md:max-w-5xl lg:max-w-6xl mx-auto z-20 h-16 px-4 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between ${
          isHeaderVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open Sidebar Menu"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-zinc-800 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer active:scale-95"
          >
            <Menu className="w-6 h-6 stroke-[2.2]" />
          </button>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              {t('accounts')}
            </h2>
            <div className="text-[11px] text-zinc-400">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </div>
          </div>
        </div>

        {/* Right Header Action: Add Account Button */}
        <button
          type="button"
          onClick={openAddAccountModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-900/30 transition cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addAccount')}</span>
        </button>
      </header>

      {/* Scrollable View Content Container */}
      <div className="pt-20 px-3.5 space-y-4">
        {/* Global Net Worth Dashboard Card */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t('netWorth')}
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              {accounts.length} {settings.language === 'ar' ? 'حسابات مسجلة' : 'Total Accounts'}
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
            {formatCurrency(totalGlobalBalance, currencySymbol, settings.language)}
          </div>

          {/* Current Month Cycle Income & Expense Summary */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/80">
            {/* Bottom Left: Total Income */}
            <div className="text-left">
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <ArrowDown className="w-3.5 h-3.5" />
                <span>{t('totalIncome')}</span>
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-1">
                {formatCurrency(totalGlobalIncome, currencySymbol, settings.language)}
              </div>
            </div>

            {/* Bottom Right: Total Expense */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xs font-bold text-red-400">
                <span>{t('totalExpense')}</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-red-400 mt-1">
                {formatCurrency(totalGlobalExpense, currencySymbol, settings.language)}
              </div>
            </div>
          </div>
        </div>

        {/* Accounts List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t('accounts')}
            </h3>
            <span className="text-[11px] text-zinc-500">
              {settings.language === 'ar' ? 'الأول هو الأساسي الافتراضي' : 'Top account is primary default'}
            </span>
          </div>

          {/* Quick Link to Shared Accounts Hub ("Shared With Me") */}
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
              const isSelected = selectedAccountIds.includes(acc.id);
              return (
                <AccountCard
                  key={acc.id}
                  acc={acc}
                  index={index}
                  accountsLength={accounts.length}
                  metrics={metrics}
                  isPrimary={isPrimary}
                  currencySymbol={currencySymbol}
                  isAccountMultiSelect={isAccountMultiSelect}
                  isSelected={isSelected}
                  onOpenDetails={() => setSelectedAccountId(acc.id)}
                  onToggleSelection={() => toggleAccountSelection(acc.id)}
                  onStartMultiSelect={() => startAccountMultiSelect(acc.id)}
                  onMoveAccount={handleMoveAccount}
                  t={t}
                  language={settings.language}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
