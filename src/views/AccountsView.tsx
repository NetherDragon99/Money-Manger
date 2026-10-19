import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Lock,
  Plus,
  Users,
  X,
  Check,
} from 'lucide-react';
import {
  getMonthCycleRange,
  isTransactionInRange,
  formatCurrency,
} from '../utils/dateCycle';
import { listenToSharedAccount } from '../utils/firebase';

export const AccountsView: React.FC = () => {
  const {
    accounts,
    transactions,
    settings,
    setSelectedAccountId,
    openAddAccountModal,
    reorderAccounts,
    setIsSharedHubModalOpen,
    importSingleAccountData,
    showToast,
    t,
  } = useApp();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

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

  const handleJoinShared = () => {
    const cleanCode = joinCode.trim();
    if (!cleanCode) return;
    setIsJoining(true);
    listenToSharedAccount(cleanCode, (data) => {
      setIsJoining(false);
      if (data && data.account) {
        importSingleAccountData(data.account, data.transactions || []);
        setShowJoinModal(false);
        setJoinCode('');
        showToast(
          settings.language === 'ar'
            ? `تم الانضمام ومزامنة حساب ${data.account.name} بنجاح!`
            : `Joined and synced shared account "${data.account.name}"!`,
          'success'
        );
      } else {
        showToast(
          settings.language === 'ar'
            ? 'رمز الحساب المشترك غير صالح أو تم إيقافه'
            : 'Invalid or inactive shared account code',
          'error'
        );
      }
    });
  };

  const currencySymbol = settings.currencySymbol || '£';

  return (
    <div className="bg-black text-white flex flex-col pb-24 px-4 py-4 max-w-2xl mx-auto w-full space-y-5 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight">{t('accounts')}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} managed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSharedHubModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800 text-xs font-semibold text-cyan-300 hover:text-white hover:border-cyan-600 transition cursor-pointer shadow-sm active:scale-95"
            title="Shared Accounts Hub"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>{settings.language === 'ar' ? 'الحسابات المشتركة' : 'Shared Hub'}</span>
          </button>
          <button
            type="button"
            onClick={openAddAccountModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition cursor-pointer shadow active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addAccount')}</span>
          </button>
        </div>
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

      {/* Dedicated Shared Accounts Hub Section */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-zinc-900 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>{settings.language === 'ar' ? 'مركز الحسابات المشتركة' : 'Shared Accounts Hub'}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {settings.language === 'ar' ? 'مباشر' : 'Live'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate mt-0.5">
              {settings.language === 'ar'
                ? 'مشاركة الصفحات للقراءة ومتابعة حسابات الشركاء والعائلة'
                : 'Share read-only pages & follow family accounts live'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsSharedHubModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white text-xs font-bold transition shadow-md shrink-0 cursor-pointer"
        >
          {settings.language === 'ar' ? 'فتح المركز' : 'Open Hub'}
        </button>
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

        <div className="space-y-3">
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
                {/* Top Row: Account Emoji Icon + Account Name (with subtle 🔒 Private badge if private) + Current Balance on right */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
                      {acc.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-white truncate max-w-[130px] sm:max-w-xs group-hover:text-blue-300 transition">
                          {acc.name}
                        </span>
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
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {acc.customMonthStartDay === 'default'
                          ? `Start: Day ${settings.defaultMonthStartDay}`
                          : `Start: Day ${acc.customMonthStartDay}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    {/* Reorder Arrows with stopPropagation */}
                    <div className="flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
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

      {/* Join Shared Account Modal */}
      {showJoinModal && (
        <div
          onClick={() => setShowJoinModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-5 text-white space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold">
                  {settings.language === 'ar' ? 'الانضمام لحساب مشترك' : 'Join Shared Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              {settings.language === 'ar'
                ? 'أدخل رمز المشاركة الذي استلمته من شريكك (يبدأ بـ share_):'
                : 'Enter the invite code shared with you by your partner (starts with share_):'}
            </p>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="share_..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-semibold hover:text-white"
              >
                {settings.language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!joinCode.trim() || isJoining}
                onClick={handleJoinShared}
                className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold shadow transition"
              >
                {isJoining ? 'Connecting...' : (settings.language === 'ar' ? 'انضمام ومزامنة' : 'Join & Sync')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
