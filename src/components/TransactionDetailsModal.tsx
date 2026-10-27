import { TransferBadge } from './TransferBadge';
import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { navigateBack } from '../context/NavigationContext';
import { X, Trash2, Edit3, ArrowRight, Share2, RefreshCw } from 'lucide-react';
import { getHistoricalBalance, getTransferHistoricalBalances } from '../utils/balanceEngine';
import { formatCurrency, formatFullDateTime } from '../utils/dateCycle';

export const TransactionDetailsModal: React.FC = () => {
  const {
    viewingTx,
    closeTxDetailsModal,
    openEditTxModal,
    deleteTransaction,
    accounts,
    transactions,
    settings,
    showConfirm,
    openShareModal,
    t,
  } = useApp();

  const [isClosing, setIsClosing] = React.useState(false);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      closeTxDetailsModal();
    }, 180);
  };

  const account = useMemo(() => {
    if (!viewingTx) return undefined;
    return accounts.find((a) => a.id === viewingTx.accountId);
  }, [viewingTx, accounts]);

  const toAccount = useMemo(() => {
    if (!viewingTx || !viewingTx.toAccountId) return undefined;
    return accounts.find((a) => a.id === viewingTx.toAccountId);
  }, [viewingTx, accounts]);

  const historicalBalances = useMemo(() => {
    if (!viewingTx || !account) return null;
    return getHistoricalBalance(viewingTx.id, account, transactions);
  }, [viewingTx, account, transactions]);

  const transferBalances = useMemo(() => {
    if (!viewingTx || viewingTx.type !== 'transfer' || !account || !toAccount) return null;
    return getTransferHistoricalBalances(viewingTx, accounts, transactions);
  }, [viewingTx, account, toAccount, accounts, transactions]);

  if (!viewingTx) return null;

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: settings.language === 'ar' ? 'حذف المعاملة' : 'Delete Transaction',
      message: t('confirmDeleteTransaction'),
      confirmText: settings.language === 'ar' ? 'حذف' : 'Delete',
      isDanger: true,
    });
    if (confirmed) {
      deleteTransaction(viewingTx.id);
      handleAnimatedClose();
    }
  };

  const handleEdit = () => {
    const txToEdit = viewingTx;
    handleAnimatedClose();
    setTimeout(() => {
      openEditTxModal(txToEdit);
    }, 190);
  };

  const currencySymbol = settings.currencySymbol || '£';
  const isTransfer = viewingTx.type === 'transfer';

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[80] flex items-end sm:items-center landscape:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 landscape:p-2 overflow-y-auto overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[92dvh] my-auto flex flex-col rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-6 landscape:p-4 text-white space-y-6 landscape:space-y-4 overflow-y-auto transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <h3 className="text-base font-bold text-zinc-300">{t('transactionDetails')}</h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const tx = viewingTx;
                handleAnimatedClose();
                setTimeout(() => {
                  openShareModal({ transactions: [tx] });
                }, 190);
              }}
              className="p-1.5 rounded-xl hover:bg-zinc-800 text-purple-400 hover:text-purple-300 transition cursor-pointer"
              title="Share Transaction"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="p-1 rounded-full text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Big Icon & Main Info */}
        <div className="flex flex-col items-center text-center space-y-2">
          {isTransfer ? (
            <div className="p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-lg">
              <TransferBadge
                fromIcon={viewingTx.fromAccountIcon || account?.icon}
                fromName={viewingTx.fromAccountName || account?.name}
                fromColor={account?.color}
                toIcon={viewingTx.toAccountIcon || toAccount?.icon}
                toName={viewingTx.toAccountName || toAccount?.name}
                toColor={toAccount?.color}
                size="md"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl shadow-lg">
              {viewingTx.categoryIcon || '💵'}
            </div>
          )}
          <div>
            <h4 className="text-xl font-bold text-white">
              {isTransfer
                ? (settings.language === 'ar'
                    ? `من ${viewingTx.fromAccountName || account?.name || 'حساب'} إلى ${viewingTx.toAccountName || toAccount?.name || 'حساب'}`
                    : `From ${viewingTx.fromAccountName || account?.name || 'Account'} → To ${viewingTx.toAccountName || toAccount?.name || 'Account'}`)
                : viewingTx.description || viewingTx.categoryName || 'Transaction'}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              {formatFullDateTime(viewingTx.date, viewingTx.time, settings.language)}
            </p>
          </div>

          {/* Account indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/80 text-xs font-medium text-zinc-300">
              {isTransfer ? (
                <span className="flex items-center gap-1.5">
                  <span>{account?.icon} {account?.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>{toAccount?.icon} {toAccount?.name}</span>
                </span>
              ) : (
                <span>{account?.icon} {account?.name}</span>
              )}
            </div>

            {Boolean(viewingTx.isFromRecurring || viewingTx.recurringRuleId) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-semibold text-amber-300 shadow-sm shadow-amber-950/40">
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {settings.language === 'ar' ? 'معاملة متكررة تلقائية' : 'Automated Recurring Transaction'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Balance Breakdown: Dual-Account Breakdown for Transfers, Single-Account 3-Box for Income/Expense */}
        {isTransfer && transferBalances ? (
          <div className="space-y-3">
            {/* Source Account (From) Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{transferBalances.fromAccountIcon}</span>
                  <span className="text-xs font-bold text-white truncate max-w-[150px]">
                    {transferBalances.fromAccountName}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {settings.language === 'ar' ? 'المحول منه' : 'Source'}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-red-400">
                  -{formatCurrency(transferBalances.amount, currencySymbol, settings.language)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                    {t('balanceBefore')}
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5 block truncate">
                    {formatCurrency(transferBalances.fromBalanceBefore, currencySymbol, settings.language)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                    {t('balanceAfter')}
                  </span>
                  <span className="text-xs font-mono font-bold text-red-400 mt-0.5 block truncate">
                    {formatCurrency(transferBalances.fromBalanceAfter, currencySymbol, settings.language)}
                  </span>
                </div>
              </div>
            </div>

            {/* Destination Account (To) Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{transferBalances.toAccountIcon}</span>
                  <span className="text-xs font-bold text-white truncate max-w-[150px]">
                    {transferBalances.toAccountName}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {settings.language === 'ar' ? 'المحول إليه' : 'Destination'}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  +{formatCurrency(transferBalances.amount, currencySymbol, settings.language)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                    {t('balanceBefore')}
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-200 mt-0.5 block truncate">
                    {formatCurrency(transferBalances.toBalanceBefore, currencySymbol, settings.language)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/60 text-center">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                    {t('balanceAfter')}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block truncate">
                    {formatCurrency(transferBalances.toBalanceAfter, currencySymbol, settings.language)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          historicalBalances && (
            <div className="grid grid-cols-3 gap-2">
              {/* Balance Before */}
              <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 text-center flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  {t('balanceBefore')}
                </span>
                <span className="text-xs font-mono font-bold text-zinc-200 mt-1 truncate">
                  {formatCurrency(historicalBalances.balanceBefore, currencySymbol, settings.language)}
                </span>
              </div>

              {/* Transaction Amount */}
              <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 text-center flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Amount
                </span>
                <span
                  className={`text-xs font-mono font-black mt-1 truncate ${
                    viewingTx.type === 'income'
                      ? 'text-emerald-400'
                      : viewingTx.type === 'expense'
                      ? 'text-red-400'
                      : 'text-blue-400'
                  }`}
                >
                  {viewingTx.type === 'income' ? '+' : viewingTx.type === 'expense' ? '-' : ''}
                  {formatCurrency(viewingTx.amount, currencySymbol, settings.language)}
                </span>
              </div>

              {/* Balance After */}
              <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 text-center flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  {t('balanceAfter')}
                </span>
                <span className="text-xs font-mono font-bold text-white mt-1 truncate">
                  {formatCurrency(historicalBalances.balanceAfter, currencySymbol, settings.language)}
                </span>
              </div>
            </div>
          )
        )}

        {/* Action Buttons at Bottom */}
        <div className="flex gap-3 pt-2">
          {/* Delete Button (Red) */}
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm font-semibold active:scale-95 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('deleteTransaction')}</span>
          </button>

          {/* Edit Button (Blue) - Available for all transactions including initial/adjustment */}
          <button
            type="button"
            onClick={handleEdit}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold active:scale-95 shadow-lg shadow-blue-900/30 transition cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>{t('editTransaction')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
