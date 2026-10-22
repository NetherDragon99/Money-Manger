import React, { useMemo } from 'react';
import { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatTime12h } from '../utils/dateCycle';
import { getTransferHistoricalBalances } from '../utils/balanceEngine';
import { Check } from 'lucide-react';
import { useLongPress } from '../hooks/useLongPress';

interface TransactionItemProps {
  transaction: Transaction;
  onClick: () => void;
  hideAccountBadge?: boolean;
}

const TransactionItemBase: React.FC<TransactionItemProps> = ({
  transaction,
  onClick,
  hideAccountBadge = false,
}) => {
  const {
    accounts,
    transactions,
    settings,
    isTxMultiSelect,
    selectedTxIds,
    toggleTxSelection,
    startTxMultiSelect,
  } = useApp();

  const isSelected = selectedTxIds.includes(transaction.id);

  const { handlers } = useLongPress({
    onLongPress: () => {
      startTxMultiSelect(transaction.id);
    },
    onClick: (e) => {
      if (isTxMultiSelect) {
        e.stopPropagation();
        toggleTxSelection(transaction.id);
      } else {
        onClick();
      }
    },
  });

  const isTransfer = transaction.type === 'transfer';
  const fromAccount = accounts.find((a) => a.id === transaction.accountId);
  const toAccount = accounts.find((a) => a.id === transaction.toAccountId);

  const transferBalances = useMemo(() => {
    if (!isTransfer || !fromAccount || !toAccount) return null;
    return getTransferHistoricalBalances(transaction, accounts, transactions);
  }, [isTransfer, transaction, fromAccount, toAccount, accounts, transactions]);

  let title = '';
  if (isTransfer) {
    if (hideAccountBadge) {
      title = transaction.description && transaction.description.trim() !== ''
        ? transaction.description
        : (settings.language === 'ar' ? 'تحويل' : 'Transfer');
    } else {
      title = `${fromAccount?.name || 'Account'} > ${toAccount?.name || 'Account'}`;
    }
  } else if (transaction.description && transaction.description.trim() !== '') {
    title = transaction.description;
  } else {
    title = transaction.categoryName || 'Transaction';
  }

  const timeFormatted = transaction.time ? formatTime12h(transaction.time, settings.language) : '';
  let subtitle = '';

  if (isTransfer) {
    const transferLabel = settings.language === 'ar' ? 'تحويل' : 'Transfer';
    const hasCustomDescription = Boolean(transaction.description && transaction.description.trim() !== '');
    if (hideAccountBadge) {
      if (hasCustomDescription) {
        subtitle = `${timeFormatted ? `${timeFormatted} • ` : ''}${transferLabel} • ${transaction.date}`;
      } else {
        subtitle = timeFormatted ? `${timeFormatted} • ${transaction.date}` : transaction.date;
      }
    } else {
      subtitle = timeFormatted ? `${timeFormatted} • ${transferLabel}` : transferLabel;
    }
  } else {
    const hasCustomDescription = Boolean(transaction.description && transaction.description.trim() !== '');
    if (hasCustomDescription) {
      subtitle = hideAccountBadge
        ? `${timeFormatted ? `${timeFormatted} • ` : ''}${transaction.categoryName || ''} • ${transaction.date}`
        : (timeFormatted ? `${timeFormatted} • ${transaction.categoryName || ''}` : transaction.categoryName || '');
    } else {
      subtitle = hideAccountBadge
        ? (timeFormatted ? `${timeFormatted} • ${transaction.date}` : transaction.date)
        : (timeFormatted || transaction.date);
    }
  }

  const currencySymbol = settings.currencySymbol || '£';
  let amountColorClass = 'text-blue-400';
  let amountSign = '';
  if (transaction.type === 'income') {
    amountColorClass = 'text-emerald-500';
    amountSign = '+';
  } else if (transaction.type === 'expense') {
    amountColorClass = 'text-red-500';
    amountSign = '-';
  } else {
    amountColorClass = 'text-blue-400';
  }

  return (
    <div
      {...handlers}
      onContextMenu={(e) => {
        e.preventDefault();
        startTxMultiSelect(transaction.id);
      }}
      role="button"
      tabIndex={0}
      className={`flex flex-col p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer group select-none ${
        isSelected
          ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/50'
          : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-zinc-800/80 active:scale-[0.99]'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        {/* Left: Checkbox in multi-select mode + Category Emoji */}
        <div className="flex items-center gap-3 min-w-0">
          {isTxMultiSelect && (
            <div
              className={`w-5 h-5 rounded-lg flex items-center justify-center transition border ${
                isSelected
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-950 border-zinc-700 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
              transaction.type === 'income'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : transaction.type === 'expense'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}
          >
            {isTransfer ? '⇄' : transaction.categoryIcon || '💵'}
          </div>

          {/* Center: Title & Subtitle */}
          <div className="min-w-0 text-left rtl:text-right">
            <div className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs group-hover:text-blue-300 transition">
              {title}
            </div>
            <div className="text-xs text-zinc-400 truncate mt-0.5">
              {subtitle}
            </div>
          </div>
        </div>

        {/* Right: Amount */}
        <div className="text-right rtl:text-left shrink-0 pl-2 rtl:pr-2">
          <div className={`text-sm font-mono font-bold ${amountColorClass}`}>
            {amountSign}{formatCurrency(transaction.amount, currencySymbol, settings.language)}
          </div>
        </div>
      </div>

      {/* Transfer: Before & After Balances for BOTH accounts */}
      {isTransfer && transferBalances && (
        <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[10px] font-mono">
          <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/80 px-2 py-0.5 rounded-lg max-w-full">
            <span className="text-xs shrink-0">{transferBalances.fromAccountIcon}</span>
            <span className="font-semibold text-zinc-300 truncate max-w-[85px] sm:max-w-[110px]">
              {transferBalances.fromAccountName}:
            </span>
            <span className="text-zinc-400">{formatCurrency(transferBalances.fromBalanceBefore, currencySymbol, settings.language)}</span>
            <span className="text-red-400 font-bold">→</span>
            <span className="font-bold text-red-400">{formatCurrency(transferBalances.fromBalanceAfter, currencySymbol, settings.language)}</span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/80 px-2 py-0.5 rounded-lg max-w-full">
            <span className="text-xs shrink-0">{transferBalances.toAccountIcon}</span>
            <span className="font-semibold text-zinc-300 truncate max-w-[85px] sm:max-w-[110px]">
              {transferBalances.toAccountName}:
            </span>
            <span className="text-zinc-400">{formatCurrency(transferBalances.toBalanceBefore, currencySymbol, settings.language)}</span>
            <span className="text-emerald-400 font-bold">→</span>
            <span className="font-bold text-emerald-400">{formatCurrency(transferBalances.toBalanceAfter, currencySymbol, settings.language)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const TransactionItem = React.memo(TransactionItemBase);
