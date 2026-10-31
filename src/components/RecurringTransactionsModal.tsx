import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, Plus, Trash2, CheckCircle2, Clock, Check, Pause, Play, CalendarClock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RecurringTransaction } from '../types';
import { formatNumberWithCommas } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { getScheduleSummaryText, getNextNOccurrences } from '../utils/recurring';

interface RecurringTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
}

interface RecurringItemRowProps {
  item: RecurringTransaction;
  isMultiSelect: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onStartMultiSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: RecurringTransaction) => void;
  onToggleAutoProcess: (item: RecurringTransaction) => void;
  accountName: string;
  toAccountName?: string;
  currencySymbol: string;
  isArabic: boolean;
}

const RecurringItemRow: React.FC<RecurringItemRowProps> = ({
  item,
  isMultiSelect,
  isSelected,
  onToggleSelect,
  onStartMultiSelect,
  onDelete,
  onEdit,
  onToggleAutoProcess,
  accountName,
  toAccountName,
  currencySymbol,
  isArabic,
}) => {
  const [showNext5, setShowNext5] = useState<boolean>(false);
  const next5 = useMemo(() => {
    if (!showNext5) return [];
    return getNextNOccurrences(item, 5, Date.now(), isArabic ? 'ar' : 'en');
  }, [showNext5, item, isArabic]);

  const { handlers } = useLongPress({
    onLongPress: () => {
      onStartMultiSelect(item.id);
    },
    onClick: () => {
      if (isMultiSelect) {
        onToggleSelect(item.id);
      } else {
        onEdit(item);
      }
    },
  });

  const scheduleSummary = getScheduleSummaryText(item, isArabic ? 'ar' : 'en');
  const titleText =
    item.description?.trim() ||
    item.categoryName?.trim() ||
    (item.type === 'transfer'
      ? isArabic
        ? 'تحويل دوري'
        : 'Recurring Transfer'
      : isArabic
      ? 'معاملة متكررة'
      : 'Recurring');

  const accountLabel =
    item.type === 'transfer' && toAccountName
      ? `${accountName} ${isArabic ? '←' : '→'} ${toAccountName}`
      : accountName;

  const isPaused = item.autoProcess === false;

  return (
    <div
      {...handlers}
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMultiSelect(item.id);
      }}
      className={`p-3.5 rounded-2xl border transition select-none flex flex-col gap-2.5 min-w-0 ${
        isSelected
          ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/40 cursor-pointer'
          : isPaused
          ? 'bg-zinc-900/35 hover:border-zinc-700 border-zinc-800/60 opacity-85 cursor-pointer'
          : isMultiSelect
          ? 'bg-zinc-900/60 hover:bg-zinc-850 border-zinc-800/80 cursor-pointer'
          : 'bg-zinc-900/60 hover:border-zinc-700 border-zinc-800/80 cursor-pointer'
      }`}
    >
      {/* Row 1: Icon + Full Title (up to 2 lines) & Account Name + Amount */}
      <div className="flex items-start justify-between gap-2.5 w-full min-w-0">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {isMultiSelect && (
            <div
              className={`w-5 h-5 mt-1 rounded-lg flex items-center justify-center transition border shrink-0 ${
                isSelected
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-950 border-zinc-700 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          )}

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-lg sm:text-xl shrink-0">
            {item.type === 'transfer' ? '🔄' : item.categoryIcon || '🔄'}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2 break-words"
              title={titleText}
            >
              {titleText}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5 leading-snug break-words">
              {accountLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 text-right rtl:text-left">
          <span
            className={`font-mono text-xs sm:text-sm font-bold whitespace-nowrap ${
              item.type === 'income'
                ? 'text-emerald-400'
                : item.type === 'transfer'
                ? 'text-blue-400'
                : 'text-red-400'
            }`}
          >
            {item.type === 'income' ? '+' : item.type === 'transfer' ? '⇄ ' : '-'}
            {currencySymbol}
            {formatNumberWithCommas(item.amount, 2)}
          </span>
          {item.type === 'transfer' && item.transferFee && item.transferFee > 0 ? (
            <span className="text-[9.5px] font-mono text-amber-300/90 whitespace-nowrap">
              +{currencySymbol}
              {formatNumberWithCommas(item.transferFee, 2)} {isArabic ? 'رسوم' : 'fee'}
            </span>
          ) : null}
        </div>
      </div>

      {/* Row 2: Dedicated Readable Schedule Summary Banner (no single-letter truncation) */}
      <div className="w-full px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-1.5 min-w-0">
        <CalendarClock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <span className="text-[11px] text-blue-200 leading-relaxed break-words min-w-0 flex-1">
          {scheduleSummary}
        </span>
      </div>

      {/* Row 3: Next Due Date + Active/Paused Toggle + Next 5 Preview + Delete */}
      <div className="flex items-center justify-between gap-2 flex-wrap w-full pt-0.5">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 font-mono min-w-0">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-zinc-400">{isArabic ? 'الاستحقاق القادم:' : 'Next Due:'}</span>
          <span className="font-semibold text-amber-300">{item.nextDueDate}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ms-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAutoProcess(item);
            }}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
              isPaused
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
            }`}
            title={
              isPaused
                ? isArabic
                  ? 'القاعدة متوقفة مؤقتاً — اضغط للتفعيل من الآن'
                  : 'Rule paused — tap to resume from now'
                : isArabic
                ? 'القاعدة نشطة — اضغط للإيقاف المؤقت'
                : 'Rule active — tap to pause'
            }
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3" />
                <span>{isArabic ? 'متوقف' : 'Paused'}</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                <span>{isArabic ? 'نشط' : 'Active'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowNext5((prev) => !prev);
            }}
            className="px-2 py-1 rounded-lg text-[10px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-blue-400 font-semibold transition cursor-pointer"
            title={isArabic ? 'عرض الـ5 مرات القادمة' : 'Preview next 5 occurrences'}
          >
            {showNext5 ? (isArabic ? 'إخفاء' : 'Hide') : (isArabic ? 'الـ5 القادمة' : 'Next 5')}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
            title={isArabic ? 'حذف القاعدة' : 'Delete rule'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showNext5 && (
        <div className="w-full mt-1 pt-2 border-t border-zinc-800/80 space-y-1">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>{isArabic ? 'الـ5 مرات القادمة للتنفيذ' : 'Next 5 Occurrences'}</span>
            <span className="text-[9px] text-zinc-500 font-mono">{next5.length} / 5</span>
          </div>
          {next5.length === 0 ? (
            <div className="text-[10.5px] text-zinc-500 italic py-1 text-center">
              {isArabic ? 'لا توجد معاملات مجدولة قادمة' : 'No upcoming occurrences scheduled'}
            </div>
          ) : (
            next5.map((occ, idx) => (
              <div
                key={`${occ.date}_${occ.time}_${idx}`}
                className="flex items-center justify-between px-2 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800/50 text-xs font-mono gap-2"
              >
                <div className="flex items-center gap-1.5 text-zinc-300 min-w-0 flex-wrap">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 text-[8.5px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-zinc-200">{occ.dayName}</span>
                  <span className="text-zinc-500 text-[10.5px]">{occ.formattedDate}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-700/60 text-[10px] font-bold text-blue-300 shrink-0">
                  {occ.formattedTime}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const RecurringTransactionsModal: React.FC<RecurringTransactionsModalProps> = ({
  isOpen,
  onClose,
  onOpenAddModal,
}) => {
  const {
    recurringTransactions,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    processDueRecurring,
    executeManualRecurringRules,
    openAddTxModal,
    openEditRecurringModal,
    settings,
    accounts,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const [isClosing, setIsClosing] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const isMultiSelect = selectedRuleIds.length > 0;

  // Auto-check recurring transactions on modal open
  useEffect(() => {
    processDueRecurring(false);
  }, []);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setSelectedRuleIds([]);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const handleEditRule = (item: RecurringTransaction) => {
    handleAnimatedClose();
    // Opens the full transaction modal pre-filled with the rule's details & schedule
    setTimeout(() => {
      openEditRecurringModal(item);
    }, 200);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedRuleIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleStartMultiSelect = (id: string) => {
    if (!selectedRuleIds.includes(id)) {
      setSelectedRuleIds((prev) => [...prev, id]);
    }
  };

  const handleProcessNow = () => {
    if (selectedRuleIds.length > 0) {
      // Execute ONLY the selected rules without altering their future schedule
      executeManualRecurringRules(selectedRuleIds);
      setSelectedRuleIds([]);
    } else {
      // Prompt user with confirmation before processing all active rules
      const message = isArabic
        ? 'تنفيذ جميع القواعد النشطة الآن؟'
        : 'Process all active rules now?';
      if (window.confirm(message)) {
        processDueRecurring(true);
      }
    }
  };

  const handleToggleAutoProcess = (item: RecurringTransaction) => {
    updateRecurringTransaction({
      ...item,
      autoProcess: !item.autoProcess,
    });
  };

  if (!isOpen) return null;

  const getAccountName = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? acc.name : isArabic ? 'حساب غير معروف' : 'Unknown Account';
  };

  return (
    <div
      onClick={handleAnimatedClose}
      onTouchMove={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-md overscroll-contain transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[90dvh] my-auto rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl flex flex-col text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">
                {isArabic ? 'المعاملات المتكررة المجدولة' : 'Recurring Transactions'}
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {isMultiSelect
                  ? (isArabic ? `تم تحديد ${selectedRuleIds.length} قواعد` : `${selectedRuleIds.length} rules selected`)
                  : (isArabic ? 'إدارة المصاريف والدخول الدورية التلقائية' : 'Manage automatic scheduled expenses & income')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMultiSelect && (
              <button
                type="button"
                onClick={() => setSelectedRuleIds([])}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition cursor-pointer"
              >
                {isArabic ? 'إلغاء' : 'Clear'}
              </button>
            )}
            <button
              type="button"
              onClick={handleAnimatedClose}
              className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {recurringTransactions.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 flex flex-col items-center">
              <RefreshCw className="w-12 h-12 stroke-[1.5] text-zinc-700 mb-3" />
              <p className="text-sm font-semibold">
                {isArabic ? 'لا توجد معاملات دورية مجدولة بعد' : 'No recurring transactions scheduled yet'}
              </p>
              <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                {isArabic
                  ? 'يمكنك جدولة المعاملات المتكررة (إيجار، راتب، اشتراكات) عند إضافة أي معاملة.'
                  : 'Schedule recurring rent, salary, or subscriptions directly from the Add Transaction screen.'}
              </p>
            </div>
          ) : (
            recurringTransactions.map((item) => (
              <RecurringItemRow
                key={item.id}
                item={item}
                isMultiSelect={isMultiSelect}
                isSelected={selectedRuleIds.includes(item.id)}
                onToggleSelect={handleToggleSelect}
                onStartMultiSelect={handleStartMultiSelect}
                onDelete={deleteRecurringTransaction}
                onEdit={handleEditRule}
                onToggleAutoProcess={handleToggleAutoProcess}
                accountName={getAccountName(item.accountId)}
                toAccountName={item.toAccountId ? getAccountName(item.toAccountId) : undefined}
                currencySymbol={settings.currencySymbol || '£'}
                isArabic={isArabic}
              />
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleProcessNow}
            className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
              isMultiSelect
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-750 text-zinc-300 hover:text-white'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${isMultiSelect ? 'text-white' : 'text-emerald-400'}`} />
            <span>
              {isMultiSelect
                ? (isArabic ? `تنفيذ المحدد (${selectedRuleIds.length})` : `Process Selected (${selectedRuleIds.length})`)
                : (isArabic ? 'ترحيل المستحق الآن' : 'Process Due Now')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleAnimatedClose();
              // AUTO-ENABLE TOGGLE: Opens AddTransactionModal with isRecurring pre-selected/checked automatically!
              setTimeout(() => {
                openAddTxModal(undefined, undefined, true);
              }, 200);
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>{isArabic ? 'جدولة معاملة' : 'New Recurring'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
