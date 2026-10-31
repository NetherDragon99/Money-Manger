import React from 'react';
import { ArrowRight, Check, RefreshCw, Trash2 } from 'lucide-react';
import { Account, Transaction } from '../types';
import { formatCurrency } from '../utils/dateCycle';

export interface TransferCardProps {
  transaction: Transaction;
  fromAccount?: Account;
  toAccount?: Account;
  fromName?: string;
  toName?: string;
  fromIcon?: string;
  toIcon?: string;
  fromColor?: string;
  toColor?: string;
  currencySymbol?: string;
  language?: 'ar' | 'en';
  isSelected?: boolean;
  isMultiSelect?: boolean;
  timeFormatted?: string;
  historicalBalances?: {
    fromBalanceBefore?: number;
    fromBalanceAfter?: number;
    toBalanceBefore?: number;
    toBalanceAfter?: number;
    fromAccountName?: string;
    fromAccountIcon?: string;
    toAccountName?: string;
    toAccountIcon?: string;
  } | null;
  authorBadge?: React.ReactNode;
  canEdit?: boolean;
  onDeleteClick?: (tx: Transaction, title: string, icon?: string) => void;
  handlers?: any;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}

function renderAccountIcon(icon?: string, name?: string, color?: string, defaultLetter = 'A') {
  const trimmedIcon = (icon || '').trim();
  if (trimmedIcon) {
    return (
      <span
        className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-xs shrink-0 select-none bg-zinc-900/80 border border-zinc-700/60 leading-none"
        style={color ? { borderColor: `${color}88` } : undefined}
      >
        {trimmedIcon}
      </span>
    );
  }
  // Fallback for deleted accounts: first letter of fromAccountName/toAccountName
  const letter = (name || defaultLetter).trim().charAt(0).toUpperCase() || defaultLetter;
  return (
    <span
      className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 select-none bg-zinc-800 border border-zinc-700 text-zinc-200 leading-none"
      style={color ? { borderColor: `${color}88` } : undefined}
    >
      {letter}
    </span>
  );
}

export const TransferCard: React.FC<TransferCardProps> = ({
  transaction,
  fromAccount,
  toAccount,
  fromName,
  toName,
  fromIcon,
  toIcon,
  fromColor,
  toColor,
  currencySymbol = '£',
  language = 'ar',
  isSelected = false,
  isMultiSelect = false,
  timeFormatted = '',
  historicalBalances,
  authorBadge,
  canEdit = false,
  onDeleteClick,
  handlers,
  onClick,
  onContextMenu,
  className = '',
}) => {
  const isArabic = language === 'ar';

  const effectiveFromName =
    fromName ||
    fromAccount?.name ||
    transaction.fromAccountName ||
    (isArabic ? 'حساب' : 'Account');

  const effectiveToName =
    toName ||
    toAccount?.name ||
    transaction.toAccountName ||
    (isArabic ? 'حساب' : 'Account');

  const effectiveFromIcon = fromIcon || fromAccount?.icon || transaction.fromAccountIcon;
  const effectiveToIcon = toIcon || toAccount?.icon || transaction.toAccountIcon;
  const effectiveFromColor = fromColor || fromAccount?.color;
  const effectiveToColor = toColor || toAccount?.color;

  const defaultTransferLabel = isArabic ? 'تحويل بين الحسابات' : 'Account Transfer';
  const hasCustomDescription = Boolean(
    transaction.description && transaction.description.trim() !== ''
  );

  const transferTitle = isArabic
    ? `من ${effectiveFromName} إلى ${effectiveToName}`
    : `From ${effectiveFromName} → To ${effectiveToName}`;

  // Dual Historical Balances resolution: check prop first, then transaction fields
  const fromBalBefore = historicalBalances?.fromBalanceBefore ?? transaction.fromBalanceBefore;
  const fromBalAfter = historicalBalances?.fromBalanceAfter ?? transaction.fromBalanceAfter;
  const toBalBefore = historicalBalances?.toBalanceBefore ?? transaction.toBalanceBefore;
  const toBalAfter = historicalBalances?.toBalanceAfter ?? transaction.toBalanceAfter;
  const fromAccIcon = historicalBalances?.fromAccountIcon || effectiveFromIcon || '🏦';
  const toAccIcon = historicalBalances?.toAccountIcon || effectiveToIcon || '🏦';
  const fromAccName = historicalBalances?.fromAccountName || effectiveFromName;
  const toAccName = historicalBalances?.toAccountName || effectiveToName;

  const hasDualBalances =
    (fromBalBefore !== undefined && fromBalAfter !== undefined) ||
    (toBalBefore !== undefined && toBalAfter !== undefined);

  return (
    <div
      {...handlers}
      onClick={(e) => {
        if (handlers?.onClick) {
          handlers.onClick(e);
        } else if (onClick) {
          onClick();
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          onContextMenu(e);
        } else if (handlers?.onContextMenu) {
          handlers.onContextMenu(e);
        }
      }}
      role="button"
      tabIndex={0}
      className={`flex flex-col p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer group select-none ${
        isSelected
          ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/50'
          : 'bg-zinc-900/90 hover:bg-zinc-800/90 border-zinc-800/80 active:scale-[0.99]'
      } ${className}`}
    >
      {/* Top Main Section: Route Structure (Left) + Amount (Right) */}
      <div className="flex items-start justify-between gap-2.5 w-full">
        {/* Route Container + Checkbox with min-w-0 to prevent flex blowout */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Multi-Select Checkbox */}
          {isMultiSelect && (
            <div className="pt-1 shrink-0">
              <div
                className={`w-5 h-5 rounded-lg flex items-center justify-center transition border ${
                  isSelected
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-950 border-zinc-700 text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
          )}

          {/* Two-row pill structure on narrow viewports (< sm), responsive inline on wider screens */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1 min-w-0 max-w-full">
            {/* Source Account (From) Pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/25 min-w-0 max-w-full"
              style={effectiveFromColor ? { borderColor: `${effectiveFromColor}66` } : undefined}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 shrink-0">
                {isArabic ? 'من' : 'From'}
              </span>
              {renderAccountIcon(effectiveFromIcon, effectiveFromName, effectiveFromColor, 'S')}
              <span className="text-xs sm:text-sm font-bold text-white min-w-0 break-words leading-tight">
                {effectiveFromName}
              </span>
            </div>

            {/* Directional Arrow Indicator (Flipped in RTL) */}
            <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 self-center sm:self-auto shadow-sm my-0.5 sm:my-0">
              <ArrowRight className="w-3 h-3 stroke-[2.5] rtl:rotate-180 transition-transform" />
            </div>

            {/* Destination Account (To) Pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 min-w-0 max-w-full"
              style={effectiveToColor ? { borderColor: `${effectiveToColor}66` } : undefined}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">
                {isArabic ? 'إلى' : 'To'}
              </span>
              {renderAccountIcon(effectiveToIcon, effectiveToName, effectiveToColor, 'D')}
              <span className="text-xs sm:text-sm font-bold text-white min-w-0 break-words leading-tight">
                {effectiveToName}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Formatted Amount (Always 100% visible, never clipped) + Actions */}
        <div className="flex flex-col items-end shrink-0 pt-0.5 text-right rtl:text-left pl-1 rtl:pr-1 rtl:pl-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm sm:text-base font-mono font-bold text-blue-400 shrink-0 min-w-fit">
              {formatCurrency(transaction.amount, currencySymbol, isArabic ? 'ar' : 'en')}
            </div>

            {/* Optional Delete Button (Used in ShareDetailView) */}
            {canEdit && onDeleteClick && !isMultiSelect && (
              <button
                type="button"
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(transaction, transferTitle, '⇄');
                }}
                className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer shrink-0"
                title={isArabic ? 'حذف المعاملة' : 'Delete Transaction'}
                aria-label={isArabic ? 'حذف' : 'Delete'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {Boolean(transaction.transferFee && transaction.transferFee > 0) && (
            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35 shrink-0">
              <span>
                {isArabic
                  ? `+ رسوم: ${formatCurrency(transaction.transferFee!, currencySymbol, 'ar')}`
                  : `+ Fee: ${formatCurrency(transaction.transferFee!, currencySymbol, 'en')}`}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Subtitle / Metadata Row: Category/Title, Custom Note, Time, Recurring badge */}
      <div className="mt-2 text-xs text-zinc-400 flex flex-wrap items-center gap-1.5 min-w-0 leading-normal">
        <span className="inline-flex items-center gap-1 text-blue-400 font-semibold text-[11px] sm:text-xs">
          <span>⇄</span>
          <span>{defaultTransferLabel}</span>
        </span>

        {hasCustomDescription && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-300 break-words font-medium">
              {transaction.description}
            </span>
          </>
        )}

        {timeFormatted && (
          <>
            <span className="text-zinc-600">•</span>
            <span className="font-mono text-zinc-400 text-[11px]">{timeFormatted}</span>
          </>
        )}

        {Boolean(transaction.isFromRecurring || transaction.recurringRuleId) && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
            title={isArabic ? 'معاملة متكررة تلقائياً' : 'Automated Recurring'}
          >
            <RefreshCw className="w-2.5 h-2.5 shrink-0" />
            <span className="text-[9px]">{isArabic ? 'دورية' : 'Recurring'}</span>
          </span>
        )}

        {authorBadge}
      </div>

      {/* Dual Balances (Before → After for both accounts) */}
      {hasDualBalances && (
        <div className="mt-2 pt-2 border-t border-zinc-800/60 flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[10px] font-mono w-full">
          {fromBalBefore !== undefined && fromBalAfter !== undefined && (
            <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/80 px-2 py-0.5 rounded-lg max-w-full min-w-0 break-words">
              <span className="text-xs shrink-0">{fromAccIcon}</span>
              <span className="font-semibold text-zinc-300 truncate max-w-[85px] sm:max-w-[120px]">
                {fromAccName}:
              </span>
              <span className="text-zinc-400">
                {formatCurrency(fromBalBefore, currencySymbol, isArabic ? 'ar' : 'en')}
              </span>
              <span className="text-red-400 font-bold rtl:rotate-180">→</span>
              <span className="font-bold text-red-400">
                {formatCurrency(fromBalAfter, currencySymbol, isArabic ? 'ar' : 'en')}
              </span>
            </div>
          )}

          {toBalBefore !== undefined && toBalAfter !== undefined && (
            <div className="flex items-center gap-1 bg-zinc-950/90 border border-zinc-800/80 px-2 py-0.5 rounded-lg max-w-full min-w-0 break-words">
              <span className="text-xs shrink-0">{toAccIcon}</span>
              <span className="font-semibold text-zinc-300 truncate max-w-[85px] sm:max-w-[120px]">
                {toAccName}:
              </span>
              <span className="text-zinc-400">
                {formatCurrency(toBalBefore, currencySymbol, isArabic ? 'ar' : 'en')}
              </span>
              <span className="text-emerald-400 font-bold rtl:rotate-180">→</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(toBalAfter, currencySymbol, isArabic ? 'ar' : 'en')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
