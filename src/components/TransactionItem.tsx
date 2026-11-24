import React from 'react';
import { TransferCard } from './TransferCard';
import { Account, Transaction } from '../types';
import { formatCurrency, formatTime12h, isManualAdjustment } from '../utils/dateCycle';
import { Check, RefreshCw } from 'lucide-react';
import { useLongPress } from '../hooks/useLongPress';

interface TransactionItemProps {
  transaction: Transaction;
  fromAccount?: Account;
  toAccount?: Account;
  currencySymbol: string;
  language: 'en' | 'ar';
  isSelected: boolean;
  isTxMultiSelect: boolean;
  onOpenDetails: (tx: Transaction) => void;
  onToggleSelection: (id: string) => void;
  onStartMultiSelect: (id: string) => void;
  hideAccountBadge?: boolean;
}

const TransactionItemBase: React.FC<TransactionItemProps> = ({
  transaction,
  fromAccount,
  toAccount,
  currencySymbol,
  language,
  isSelected,
  isTxMultiSelect,
  onOpenDetails,
  onToggleSelection,
  onStartMultiSelect,
  hideAccountBadge = false,
}) => {
  const { handlers } = useLongPress({
    onLongPress: () => {
      onStartMultiSelect(transaction.id);
    },
    onClick: (e) => {
      if (isTxMultiSelect) {
        e.stopPropagation();
        onToggleSelection(transaction.id);
      } else {
        onOpenDetails(transaction);
      }
    },
  });

  const isTransfer = transaction.type === 'transfer';

  const fromName = fromAccount?.name || transaction.fromAccountName || (language === 'ar' ? 'حساب' : 'Account');
  const toName = toAccount?.name || transaction.toAccountName || (language === 'ar' ? 'حساب' : 'Account');
  const fromIcon = fromAccount?.icon || transaction.fromAccountIcon;
  const toIcon = toAccount?.icon || transaction.toAccountIcon;
  const timeFormatted = transaction.time ? formatTime12h(transaction.time, language) : '';

  // Render unified responsive TransferCard for all transfer transactions (uses stored snapshot balances cleanly)
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
        language={language}
        isSelected={isSelected}
        isMultiSelect={isTxMultiSelect}
        timeFormatted={timeFormatted}
        historicalBalances={null}
        handlers={handlers}
        onClick={() => onOpenDetails(transaction)}
        onContextMenu={(e) => {
          e.preventDefault();
          onStartMultiSelect(transaction.id);
        }}
      />
    );
  }

  const isAdjustment = Boolean(transaction.isAdjustment || isManualAdjustment(transaction));

  if (isAdjustment) {
    const adjAccount = fromAccount;
    const balanceAfter =
      transaction.balanceAfter !== undefined
        ? transaction.balanceAfter
        : (adjAccount?.balance ?? transaction.amount);
    const delta =
      transaction.delta !== undefined
        ? transaction.delta
        : (transaction.type === 'income' ? transaction.amount : -transaction.amount);
    const isDeltaPositive = delta > 0;
    const isDeltaZero = Math.abs(delta) < 0.001;
    const deltaPillText = isDeltaZero
      ? formatCurrency(0, currencySymbol, language)
      : isDeltaPositive
      ? `+${formatCurrency(Math.abs(delta), currencySymbol, language)}`
      : `-${formatCurrency(Math.abs(delta), currencySymbol, language)}`;

    const titleText = adjAccount?.name || transaction.categoryName || (language === 'ar' ? 'حساب' : 'Account');
    const subtitleText = language === 'ar' ? 'تعديل رصيد يدوي' : 'Manual Balance Adjustment';

    return (
      <div
        {...handlers}
        onContextMenu={(e) => {
          e.preventDefault();
          onStartMultiSelect(transaction.id);
        }}
        role="button"
        tabIndex={0}
        className={`tx-row-perf flex flex-col p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer group select-none ${
          isSelected
            ? 'bg-emerald-950/35 border-emerald-500/80 shadow-md shadow-emerald-950/50'
            : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-zinc-800/80 active:scale-[0.99]'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          {/* Left: Checkbox in multi-select mode + Adjustment Icon */}
          <div className="flex items-center gap-3 min-w-0">
            {isTxMultiSelect && (
              <div
                className={`w-5 h-5 rounded-lg flex items-center justify-center transition border ${
                  isSelected
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-zinc-950 border-zinc-700 text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}

            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
              {adjAccount?.icon || transaction.categoryIcon || '⚙️'}
            </div>

            {/* Center: Title & Subtitle */}
            <div className="min-w-0 text-left rtl:text-right">
              <span className="text-sm font-bold text-white line-clamp-1 break-words group-hover:text-emerald-300 transition">
                {titleText}
              </span>
              <div className="text-xs text-zinc-400 truncate mt-0.5">
                {subtitleText} {timeFormatted ? `• ${timeFormatted}` : ''}
              </div>
            </div>
          </div>

          {/* Right: NEW balance (primary large figure) + signed delta small pill */}
          <div className="text-right rtl:text-left shrink-0 pl-2 rtl:pr-2 flex flex-col items-end rtl:items-start gap-1">
            <div className="text-sm sm:text-base font-mono font-bold text-white">
              {formatCurrency(balanceAfter, currencySymbol, language)}
            </div>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                isDeltaPositive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : isDeltaZero
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}
            >
              {deltaPillText}
            </span>
          </div>
        </div>
      </div>
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

  const tax = typeof transaction.taxAmount === 'number' && !isNaN(transaction.taxAmount) ? Math.max(0, transaction.taxAmount) : 0;
  const effectiveAmount = transaction.amount + tax;

  return (
    <div
      {...handlers}
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMultiSelect(transaction.id);
      }}
      role="button"
      tabIndex={0}
      className={`tx-row-perf flex flex-col p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer group select-none ${
        isSelected
          ? 'bg-emerald-950/35 border-emerald-500/80 shadow-md shadow-emerald-950/50'
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
                  ? 'bg-emerald-600 border-emerald-500 text-white'
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
              <span className="text-sm font-bold text-white line-clamp-2 break-words group-hover:text-emerald-300 transition">
                {title}
              </span>
              {Boolean(transaction.isFromRecurring || transaction.recurringRuleId) && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
                  title={language === 'ar' ? 'معاملة متكررة تلقائية' : 'Automated Recurring'}
                >
                  <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                  <span className="hidden xs:inline text-[9px]">{language === 'ar' ? 'دورية' : 'Recurring'}</span>
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
            {amountSign}{formatCurrency(effectiveAmount, currencySymbol, language)}
          </div>
          {tax > 0 && (
            <div className="text-[10px] text-zinc-400 font-mono">
              ({formatCurrency(transaction.amount, currencySymbol, language)} + {formatCurrency(tax, currencySymbol, language)})
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TransactionItem = React.memo(TransactionItemBase);
