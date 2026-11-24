import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { useAppData, useAppUI, useAppActions } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import {
  ArrowLeft,
  MoreVertical,
  Edit,
  Download,
  Upload,
  Trash2,
  Plus,
  ArrowDown,
  ArrowUp,
  Search,
  X,
  Share2,
} from 'lucide-react';
import { AdvancedFilter, PeriodFilterType, DateRange } from '../types';
import {
  resolveDateRange,
  isTransactionInRange,
  formatCurrency,
  isManualAdjustment,
  DEFAULT_ADVANCED_FILTER,
  applyAdvancedTransactionFilter,
  countActiveAdvancedFilters,
} from '../utils/dateCycle';
import { getTransactionBudgetPool } from '../utils/smartBudgetEngine';
import { exportAccountAsJSON } from '../utils/storage';
import { GroupedTransactionList } from './GroupedTransactionList';
import { getAccountTransactions } from '../utils/balanceEngine';
import { TransactionFilterBar } from './TransactionFilterBar';
import { AdvancedFilterModal } from './AdvancedFilterModal';

const AccountDetailsViewBase: React.FC = () => {
  const {
    accounts,
    categories,
    transactions,
    settings,
    accountsById,
    categoriesById,
    t,
  } = useAppData();
  const { selectedAccountId } = useAppUI();
  const {
    openEditAccountModal,
    deleteAccount,
    deleteAccountWithBalanceTransfer,
    openRemainingBalanceModal,
    openShareModal,
    openAddTxModal,
    importSingleAccountData,
    showToast,
    showConfirm,
  } = useAppActions();

  const account = useMemo(() => {
    return selectedAccountId ? accountsById.get(selectedAccountId) : undefined;
  }, [accountsById, selectedAccountId]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [menuOpen]);

  const [searchQuery, setSearchQuery] = useState('');
  const [periodType, setPeriodType] = useState<PeriodFilterType>('app_month');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  });
  const [accAdvancedFilter, setAccAdvancedFilter] = useState<AdvancedFilter>(() => ({
    ...DEFAULT_ADVANCED_FILTER,
  }));
  const [isAccFilterOpen, setIsAccFilterOpen] = useState(false);

  // Isolate filter & duration state cleanly whenever user opens a different account
  useEffect(() => {
    setPeriodType('app_month');
    setPeriodOffset(0);
    setAccAdvancedFilter({ ...DEFAULT_ADVANCED_FILTER });
    setIsAccFilterOpen(false);
    setSearchQuery('');
  }, [selectedAccountId]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Month start day for this account
  const effectiveMonthStart =
    account?.customMonthStartDay === 'default' || !account?.customMonthStartDay
      ? settings.defaultMonthStartDay
      : account.customMonthStartDay;

  // Active Date Range
  const activeDateRange = useMemo(() => {
    return resolveDateRange(
      periodType,
      settings.weekStartDay,
      effectiveMonthStart,
      periodOffset,
      customRange
    );
  }, [periodType, settings.weekStartDay, effectiveMonthStart, periodOffset, customRange]);

  const currencySymbol = settings.currencySymbol || '£';
  const fixedCategoryIds = settings.smartBudget?.baseline?.fixedCategoryIds;

  // Account's transactions
  const accountAllTxs = useMemo(() => {
    if (!account) return [];
    return getAccountTransactions(account.id, transactions);
  }, [account, transactions]);

  // Scoped by Duration first (drives scoped AdvancedFilterModal categories & slider)
  const durationTxs = useMemo(() => {
    return accountAllTxs.filter((tx) => isTransactionInRange(tx, activeDateRange));
  }, [accountAllTxs, activeDateRange]);

  // Then filtered by Account Advanced Filters + Search Query + Sort
  const filteredTxs = useMemo(() => {
    return applyAdvancedTransactionFilter(durationTxs, accAdvancedFilter, {
      accounts,
      accountsById,
      categories,
      currencySymbol,
      searchQuery,
      resolveBudgetPool: (tx) => getTransactionBudgetPool(tx, fixedCategoryIds, categories),
    });
  }, [
    durationTxs,
    accAdvancedFilter,
    accounts,
    accountsById,
    categories,
    currencySymbol,
    searchQuery,
    fixedCategoryIds,
  ]);

  const activeAccFilterCount = useMemo(
    () => countActiveAdvancedFilters(accAdvancedFilter, { hideAccounts: true }),
    [accAdvancedFilter]
  );

  const handleOpenAccFilter = useCallback(() => setIsAccFilterOpen(true), []);
  const handleCloseAccFilter = useCallback(() => setIsAccFilterOpen(false), []);
  const handleClearAccFilter = useCallback(
    () => setAccAdvancedFilter({ ...DEFAULT_ADVANCED_FILTER }),
    []
  );

  // Income & Expense for period (internal transfers between any accounts are never counted as expenses)
  const { totalIncome, totalExpense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    if (!account) return { totalIncome: 0, totalExpense: 0 };

    for (const tx of filteredTxs) {
      if (tx.type === 'transfer' || Boolean(tx.toAccountId) || isManualAdjustment(tx)) {
        continue;
      }
      if (tx.type === 'income' && tx.accountId === account.id) {
        inc += tx.amount;
      } else if (tx.type === 'expense' && tx.accountId === account.id) {
        exp += tx.amount;
      }
    }
    return { totalIncome: inc, totalExpense: exp };
  }, [filteredTxs, account]);

  if (!account) return null;

  const handleExport = () => {
    exportAccountAsJSON(account, transactions);
    setMenuOpen(false);
    showToast(t('exportedSuccess'), 'success');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.account && Array.isArray(parsed.transactions)) {
          importSingleAccountData(parsed.account, parsed.transactions);
        } else {
          showToast(t('invalidFileError'), 'error');
        }
      } catch (err) {
        console.error(err);
        showToast(t('invalidFileError'), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (account.balance !== 0) {
      openRemainingBalanceModal([account], (targetAccountId?: string) => {
        deleteAccountWithBalanceTransfer(account.id, targetAccountId);
      });
      return;
    }

    const confirmed = await showConfirm({
      title: settings.language === 'ar' ? 'حذف الحساب' : 'Delete Account',
      message: t('confirmDeleteAccount'),
      confirmText: settings.language === 'ar' ? 'حذف' : 'Delete',
      isDanger: true,
    });
    if (confirmed) {
      deleteAccount(account.id);
    }
  };

  const roleBadgeLabel =
    account.accountRole === 'savings'
      ? t('roleSavings')
      : account.accountRole === 'investment'
      ? t('roleInvestment')
      : null;

  return (
    <div className="bg-black text-white flex flex-col pb-24 animate-in fade-in">
      {/* Hidden file input for account import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Header: Left Back Arrow, Center Account Icon + Name, Right Three-dots Menu */}
      <header className="app-header-sticky-safe sticky top-0 z-40 bg-black/95 px-4 py-3.5 flex items-center justify-between border-b border-zinc-800/80">
        <button
          type="button"
          onClick={() => navigateBack()}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 font-bold text-base text-white">
          <span className="text-2xl">{account.icon}</span>
          <span className="truncate max-w-[180px]">{account.name}</span>
          {roleBadgeLabel && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {roleBadgeLabel}
            </span>
          )}
          {account.isPrivate && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {t('privateAccount')}
            </span>
          )}
        </div>

        {/* Right: Three-dots Menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 -mr-2 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 mt-2 w-52 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl py-1.5 z-50 text-xs font-semibold"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openEditAccountModal(account);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-800 text-zinc-200 transition"
              >
                <Edit className="w-4 h-4 text-blue-400" />
                <span>{t('editAccount')}</span>
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-800 text-zinc-200 transition"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>{t('exportAccountData')}</span>
              </button>
              <button
                type="button"
                onClick={handleImportClick}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-800 text-zinc-200 transition"
              >
                <Upload className="w-4 h-4 text-purple-400" />
                <span>{t('importAccountData')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openShareModal({ accounts: [account], transactions: accountAllTxs });
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-800 text-zinc-200 transition"
              >
                <Share2 className="w-4 h-4 text-purple-400" />
                <span>{settings.language === 'ar' ? 'مشاركة الحساب' : 'Share Account'}</span>
              </button>
              <div className="my-1 border-t border-zinc-800" />
              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-red-500/20 text-red-400 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('deleteAccount')}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 px-4 py-4 w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto space-y-4">
        {/* Independent Scoped Duration & Filter Bar */}
        <TransactionFilterBar
          periodFilter={periodType}
          onPeriodChange={setPeriodType}
          periodOffset={periodOffset}
          onPeriodOffsetChange={setPeriodOffset}
          customDateRange={customRange}
          onCustomDateRangeChange={setCustomRange}
          advancedFilter={accAdvancedFilter}
          onUpdateAdvancedFilter={setAccAdvancedFilter}
          onClearAdvancedFilter={handleClearAccFilter}
          onOpenFilterModal={handleOpenAccFilter}
          activeAdvancedCount={activeAccFilterCount}
          resolvedDateRange={activeDateRange}
          categoriesById={categoriesById}
          accountsById={accountsById}
          language={settings.language}
          currency={currencySymbol}
          hideAccountChips={true}
        />

        {/* Summary Block */}
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl relative overflow-hidden">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t('totalBalance')}
            </span>
            <div className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
              {formatCurrency(account.balance, currencySymbol)}
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
                {formatCurrency(totalIncome, currencySymbol)}
              </div>
            </div>

            {/* Bottom Right: Total Expense */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xs font-bold text-red-400">
                <span>{t('totalExpense')}</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-red-400 mt-1">
                {formatCurrency(totalExpense, currencySymbol)}
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar for Transactions */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              settings.language === 'ar'
                ? 'البحث في المعاملات (الملاحظات، التصنيف، المبلغ)...'
                : 'Search transactions (notes, category, amount)...'
            }
            className="w-full pl-10 pr-10 rtl:pl-10 rtl:pr-10 py-2.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Transactions List: Grouped by Month & Year, then by Day */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Transactions ({filteredTxs.length})
            </h4>
          </div>
          <GroupedTransactionList
            transactions={filteredTxs}
            sortBy={accAdvancedFilter.sortBy}
            emptyMessage={searchQuery ? (settings.language === 'ar' ? 'لا توجد نتائج بحث مطابقة' : 'No matching search results') : (settings.language === 'ar' ? `لا توجد معاملات في هذه الفترة لـ ${account.name}` : `No transactions in this period for ${account.name}`)}
          />
        </div>
      </div>

      {/* Scoped Account Filter Modal (reflects only this account + active duration) */}
      {isAccFilterOpen && (
        <AdvancedFilterModal
          isOpen={isAccFilterOpen}
          onClose={handleCloseAccFilter}
          scopedTransactions={durationTxs}
          initialFilter={accAdvancedFilter}
          onApplyFilter={setAccAdvancedFilter}
          onClearFilter={handleClearAccFilter}
          hideAccountPicker={true}
          hideAccountVisibility={true}
        />
      )}

      {/* Floating Action Button (+): Pre-selects this specific account, responsive container */}
      <div className="fixed bottom-6 md:bottom-8 right-4 md:right-8 rtl:right-auto rtl:left-4 md:rtl:left-8 end-4 md:end-8 pointer-events-none z-40">
        <button
          type="button"
          onClick={() => openAddTxModal(account.id)}
          aria-label="Add Transaction"
          className="pointer-events-auto w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-black flex items-center justify-center shadow-2xl shadow-emerald-950/60 transition cursor-pointer border border-emerald-400/40"
        >
          <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[2.75]" />
        </button>
      </div>
    </div>
  );
};

export const AccountDetailsView = memo(AccountDetailsViewBase);
