import React from 'react';
import { Transaction } from '../types';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatTime12h } from '../utils/dateCycle';

interface TransactionItemProps {
  transaction: Transaction;
  onClick: () => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onClick }) => {
  const { accounts, settings } = useApp();

  const isTransfer = transaction.type === 'transfer';
  const fromAccount = accounts.find((a) => a.id === transaction.accountId);
  const toAccount = accounts.find((a) => a.id === transaction.toAccountId);

  // Center Top Title logic:
  // If description provided: description as bold title.
  // Fallback: if description empty, show Category Name as bold title!
  // For Transfers: "FromAccountName > ToAccountName"
  let title = '';
  if (isTransfer) {
    title = `${fromAccount?.name || 'Account'} > ${toAccount?.name || 'Account'}`;
  } else if (transaction.description && transaction.description.trim() !== '') {
    title = transaction.description;
  } else {
    title = transaction.categoryName || 'Transaction';
  }

  // Center Bottom (Subtitle) logic:
  // Format: hh:mm AM/PM • Category Name (if description was provided).
  // If description was empty (so Category Name is already the main title), show ONLY hh:mm AM/PM (do NOT repeat the category name!).
  // If time was not specified, show Date only.
  const timeFormatted = transaction.time ? formatTime12h(transaction.time, settings.language) : '';
  let subtitle = '';

  if (isTransfer) {
    subtitle = timeFormatted ? `${timeFormatted} • Transfer` : 'Transfer';
  } else {
    const hasCustomDescription = Boolean(transaction.description && transaction.description.trim() !== '');
    if (hasCustomDescription) {
      if (timeFormatted) {
        subtitle = `${timeFormatted} • ${transaction.categoryName || ''}`;
      } else {
        subtitle = transaction.categoryName || '';
      }
    } else {
      // Description was empty, Category Name is already title -> show ONLY hh:mm AM/PM or Date
      subtitle = timeFormatted || transaction.date;
    }
  }

  // Amount formatting & colors
  // Red (£ 40) for Expense, Green (£ 100) for Income, Blue/Gold (£ 100) for Transfer.
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
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 active:scale-[0.99] transition cursor-pointer group"
    >
      {/* Left: Category Emoji Icon inside a rounded tinted square */}
      <div className="flex items-center gap-3.5 min-w-0">
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
        <div className="min-w-0 text-left">
          <div className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs group-hover:text-blue-300 transition">
            {title}
          </div>
          <div className="text-xs text-zinc-400 truncate mt-0.5">
            {subtitle}
          </div>
        </div>
      </div>

      {/* Right: Amount */}
      <div className="text-right shrink-0 pl-2">
        <div className={`text-sm font-mono font-bold ${amountColorClass}`}>
          {amountSign}{formatCurrency(transaction.amount, currencySymbol)}
        </div>
      </div>
    </div>
  );
};
