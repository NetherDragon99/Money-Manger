import React, { useMemo } from 'react';
import { TransferCard } from './TransferCard';
import { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatTime12h } from '../utils/dateCycle';
import { getTransferHistoricalBalances } from '../utils/balanceEngine';
import { Check, RefreshCw } from 'lucide-react';
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

  const fromName = fromAccount?.name || transaction.fromAccountName || (settings.language === 'ar' ? 'حساب' : 'Account');
  const toName = toAccount?.name || transaction.toAccountName || (settings.language === 'ar' ? 'حساب' : 'Account');
  const fromIcon = fromAccount?.icon || transaction.fromAccountIcon;
  const toIcon = toAccount?.icon || transaction.toAccountIcon;
  const currencySymbol = settings.currencySymbol || '£';
  const timeFormatted = transaction.time ? formatTime12h(transaction.time, settings.language) : '';

  // Render unified responsive TransferCard for all transfer transactions
  if (isTransfer) {
    return (
      <TransferCard
        transaction={transaction}
        fromAccount={fromAccount}
        toAccount={toAccount}
        fromName={fromName}
        toName={toName}
        fromIcon={fromIcon}
        toIcon={toIcon}
        fromColor={fromAccount?.color}
        toColor={toAccount?.color}
        currencySymbol={currencySymbol}
        language={settings.language}
        isSelected={isSelected}
        isMultiSelect={isTxMultiSelect}
        timeFormatted={timeFormatted}
        historicalBalances={transferBalances}
        handlers={handlers}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          startTxMultiSelect(transaction.id);
        }}
      />
    );
  }

  let title = '';
  if (transaction.description && transaction.description.trim() !== '') {
    title = transaction.description;
  } else {
    title = transaction.categoryName || 'Transaction';
  }

  let subtitle = '';
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
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {transaction.categoryIcon || '💵'}
          </div>

          {/* Center: Title & Subtitle */}
          <div className="min-w-0 text-left rtl:text-right">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-xs group-hover:text-blue-300 transition">
                {title}
              </span>
              {Boolean(transaction.isFromRecurring || transaction.recurringRuleId) && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
                  title={settings.language === 'ar' ? 'معاملة متكررة تلقائية' : 'Automated Recurring'}
                >
                  <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                  <span className="hidden xs:inline text-[9px]">{settings.language === 'ar' ? 'دورية' : 'Recurring'}</span>
                </span>
              )}
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
    </div>
  );
};

export const TransactionItem = React.memo(TransactionItemBase);
