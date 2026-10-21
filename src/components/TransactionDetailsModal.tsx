import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { X, Trash2, Edit3, ArrowRight, Share2 } from 'lucide-react';
import { getHistoricalBalance } from '../utils/balanceEngine';
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
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-6 text-white space-y-6 overflow-hidden transition-all duration-200 ${
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
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-3xl shadow-lg">
            {isTransfer ? '⇄' : viewingTx.categoryIcon || '💵'}
          </div>
          <div>
            <h4 className="text-xl font-bold text-white">
              {viewingTx.description
                ? viewingTx.description
                : isTransfer
                ? `${account?.name} → ${toAccount?.name}`
                : viewingTx.categoryName || 'Transaction'}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              {formatFullDateTime(viewingTx.date, viewingTx.time, settings.language)}
            </p>
          </div>

          {/* Account indicator */}
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
        </div>

        {/* 3 Historical Balance Cards (CRITICAL MATH) */}
        {historicalBalances && (
          <div className="grid grid-cols-3 gap-2">
            {/* Balance Before */}
            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 text-center flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                {t('balanceBefore')}
              </span>
              <span className="text-xs font-mono font-bold text-zinc-200 mt-1 truncate">
                {formatCurrency(historicalBalances.balanceBefore, currencySymbol)}
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
                {formatCurrency(viewingTx.amount, currencySymbol)}
              </span>
            </div>

            {/* Balance After */}
            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 text-center flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                {t('balanceAfter')}
              </span>
              <span className="text-xs font-mono font-bold text-white mt-1 truncate">
                {formatCurrency(historicalBalances.balanceAfter, currencySymbol)}
              </span>
            </div>
          </div>
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
