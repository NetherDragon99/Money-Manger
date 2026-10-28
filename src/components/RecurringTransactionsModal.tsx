import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Plus, Trash2, CheckCircle2, Clock, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RecurringTransaction } from '../types';
import { formatNumberWithCommas } from '../utils/formatters';
import { useLongPress } from '../hooks/useLongPress';
import { getScheduleSummaryText } from '../utils/recurring';

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
  accountName: string;
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
  accountName,
  currencySymbol,
  isArabic,
}) => {
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

  const getFrequencyDisplay = () => {
    return getScheduleSummaryText(item, isArabic ? 'ar' : 'en');
  };

  return (
    <div
      {...handlers}
      onContextMenu={(e) => {
        e.preventDefault();
        onStartMultiSelect(item.id);
      }}
      className={`p-3.5 rounded-2xl border transition select-none flex items-center justify-between gap-3 ${
        isSelected
          ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/40 cursor-pointer'
          : isMultiSelect
          ? 'bg-zinc-900/60 hover:bg-zinc-850 border-zinc-800/80 cursor-pointer'
          : 'bg-zinc-900/60 hover:border-zinc-700 border-zinc-800/80 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isMultiSelect && (
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center transition border shrink-0 ${
              isSelected
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-zinc-950 border-zinc-700 text-transparent'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        )}

        <div className="w-10 h-10 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-xl shrink-0">
          {item.categoryIcon || '🔄'}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white truncate">
              {item.description || item.categoryName || 'Recurring'}
            </span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0 truncate max-w-[150px] sm:max-w-[220px]"
              title={getFrequencyDisplay()}
            >
              {getFrequencyDisplay()}
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 truncate">
            <span className="truncate">{accountName}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-zinc-400 font-mono shrink-0">
              <Clock className="w-3 h-3 text-amber-400" />
              {isArabic ? 'الاستحقاق:' : 'Due:'} {item.nextDueDate}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`font-mono text-sm font-bold ${
            item.type === 'income' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {item.type === 'income' ? '+' : '-'}
          {currencySymbol}
          {formatNumberWithCommas(item.amount, 2)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
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

  if (!isOpen) return null;

  const getAccountName = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    return acc ? acc.name : 'Unknown Account';
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
                accountName={getAccountName(item.accountId)}
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
