/**
 * Recurring Transactions Manager Modal
 * View, trigger, and manage scheduled recurring expenses and incomes
 */

import React, { useState } from 'react';
import { X, RefreshCw, Calendar, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RecurringTransaction } from '../types';

interface RecurringTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAddModal: () => void;
}

export const RecurringTransactionsModal: React.FC<RecurringTransactionsModalProps> = ({
  isOpen,
  onClose,
  onOpenAddModal,
}) => {
  const {
    recurringTransactions,
    deleteRecurringTransaction,
    processDueRecurring,
    settings,
    accounts,
    showToast,
  } = useApp();
  const isArabic = settings.language === 'ar';
  const [isClosing, setIsClosing] = useState(false);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const handleProcessNow = () => {
    const processedCount = processDueRecurring();
    if (processedCount > 0) {
      showToast(
        isArabic
          ? `تم ترحيل ${processedCount} معاملة دورية بنجاح!`
          : `Processed ${processedCount} recurring transaction(s)!`,
        'success'
      );
    } else {
      showToast(
        isArabic ? 'لا توجد معاملات دورية مستحقة اليوم' : 'No recurring transactions due today',
        'info'
      );
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
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'المعاملات المتكررة المجدولة' : 'Recurring Transactions'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isArabic ? 'إدارة المصاريف والدخول الدورية التلقائية' : 'Manage automatic scheduled expenses & income'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-xl shrink-0">
                    {item.categoryIcon || '🔄'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">
                        {item.description || item.categoryName || 'Recurring'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 capitalize shrink-0">
                        {item.frequency}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                      <span>{getAccountName(item.accountId)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-zinc-500 font-mono">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {isArabic ? 'الاستحقاق:' : 'Due:'} {item.nextDueDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`font-mono text-sm font-black ${
                      item.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'}
                    {settings.currencySymbol}
                    {item.amount.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRecurringTransaction(item.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleProcessNow}
            className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isArabic ? 'ترحيل المستحق الآن' : 'Process Due Now'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleAnimatedClose();
              setTimeout(onOpenAddModal, 200);
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
