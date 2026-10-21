import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Trash2,
  Share2,
  Landmark,
  Tags,
  Receipt,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import { formatCurrency } from '../utils/dateCycle';

interface SelectionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: 'share' | 'delete';
  onConfirm: (items: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
  }) => void;
}

export const SelectionReviewModal: React.FC<SelectionReviewModalProps> = ({
  isOpen,
  onClose,
  actionType,
  onConfirm,
}) => {
  const {
    accounts,
    categories,
    transactions,
    selectedAccountIds,
    selectedCategoryIds,
    selectedTxIds,
    settings,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';

  // Local checked state for review
  const [checkedAccountIds, setCheckedAccountIds] = useState<string[]>([]);
  const [checkedCategoryIds, setCheckedCategoryIds] = useState<string[]>([]);
  const [checkedTxIds, setCheckedTxIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCheckedAccountIds([...selectedAccountIds]);
      setCheckedCategoryIds([...selectedCategoryIds]);
      setCheckedTxIds([...selectedTxIds]);
    }
  }, [isOpen, selectedAccountIds, selectedCategoryIds, selectedTxIds]);

  if (!isOpen) return null;

  const reviewedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));
  const reviewedCategories = categories.filter((c) => selectedCategoryIds.includes(c.id));
  const reviewedTransactions = transactions.filter((t) => selectedTxIds.includes(t.id));

  const totalSelectedCount =
    checkedAccountIds.length + checkedCategoryIds.length + checkedTxIds.length;

  const toggleAccount = (id: string) => {
    setCheckedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id: string) => {
    setCheckedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTransaction = (id: string) => {
    setCheckedTxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleProceed = () => {
    if (totalSelectedCount === 0) return;
    const finalAccounts = accounts.filter((a) => checkedAccountIds.includes(a.id));
    const finalCategories = categories.filter((c) => checkedCategoryIds.includes(c.id));
    const finalTransactions = transactions.filter((t) => checkedTxIds.includes(t.id));

    onConfirm({
      accounts: finalAccounts,
      categories: finalCategories,
      transactions: finalTransactions,
    });
  };

  const isShare = actionType === 'share';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={onClose}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90dvh] my-auto bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 overscroll-contain"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isShare
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {isShare ? <Share2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'مراجعة العناصر المحددة' : 'Review Selected Items'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isShare
                  ? isArabic
                    ? 'اختر العناصر التي ترغب في تضمينها في صفحة المشاركة'
                    : 'Choose the exact items you want to include in this Share'
                  : isArabic
                  ? 'راجع العناصر المحددة قبل تأكيد الحذف النهائي'
                  : 'Verify selected items before permanent deletion'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section 1: Accounts */}
          {reviewedAccounts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isArabic ? 'الحسابات' : 'Accounts'}</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {checkedAccountIds.length}/{reviewedAccounts.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {reviewedAccounts.map((acc) => {
                  const isChecked = checkedAccountIds.includes(acc.id);
                  return (
                    <div
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-zinc-900 border-zinc-700 shadow-sm'
                          : 'bg-zinc-950/60 border-zinc-900 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition border ${
                            isChecked
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-zinc-900 border-zinc-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-lg">{acc.icon}</span>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white block truncate">
                            {acc.name}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">
                            {formatCurrency(acc.balance, currencySymbol, isArabic ? 'ar' : 'en')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Categories */}
          {reviewedCategories.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Tags className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isArabic ? 'التصنيفات' : 'Categories'}</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {checkedCategoryIds.length}/{reviewedCategories.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {reviewedCategories.map((cat) => {
                  const isChecked = checkedCategoryIds.includes(cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-zinc-900 border-zinc-700 shadow-sm'
                          : 'bg-zinc-950/60 border-zinc-900 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition border ${
                            isChecked
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-zinc-900 border-zinc-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-lg">{cat.icon}</span>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white block truncate">
                            {cat.name}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {cat.type === 'expense'
                              ? isArabic
                                ? 'مصروف'
                                : 'Expense'
                              : isArabic
                              ? 'دخل'
                              : 'Income'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Transactions */}
          {reviewedTransactions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isArabic ? 'المعاملات' : 'Transactions'}</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {checkedTxIds.length}/{reviewedTransactions.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {reviewedTransactions.map((tx) => {
                  const isChecked = checkedTxIds.includes(tx.id);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => toggleTransaction(tx.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-zinc-900 border-zinc-700 shadow-sm'
                          : 'bg-zinc-950/60 border-zinc-900 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition border ${
                            isChecked
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-zinc-900 border-zinc-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-lg">{tx.categoryIcon || '💸'}</span>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white block truncate">
                            {tx.description || tx.categoryName || 'Transaction'}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {tx.date}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-mono font-bold shrink-0 ${
                          tx.type === 'income'
                            ? 'text-emerald-400'
                            : tx.type === 'expense'
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalSelectedCount === 0 && (
            <div className="py-8 text-center text-zinc-500 text-xs">
              {isArabic ? 'لم يتم تحديد أي عنصر' : 'No items selected'}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={totalSelectedCount === 0}
            className={`flex-2 py-2.5 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isShare
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40'
                : 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
            }`}
          >
            {isShare ? <Share2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            <span>
              {isShare
                ? isArabic
                  ? `تأكيد ومشاركة (${totalSelectedCount})`
                  : `Confirm & Share (${totalSelectedCount})`
                : isArabic
                ? `تأكيد وحذف (${totalSelectedCount})`
                : `Confirm & Delete (${totalSelectedCount})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
