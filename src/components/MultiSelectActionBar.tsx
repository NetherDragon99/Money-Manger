import React, { useState } from 'react';
import {
  Trash2,
  Share2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SelectionReviewModal } from './SelectionReviewModal';
import { Account, Category, Transaction } from '../types';

export const MultiSelectActionBar: React.FC = () => {
  const {
    isTxMultiSelect,
    selectedTxIds,
    clearTxSelection,
    transactions,
    accounts,
    isCategoryMultiSelect,
    selectedCategoryIds,
    clearCategorySelection,
    categories,
    isAccountMultiSelect,
    selectedAccountIds,
    clearAccountSelection,
    deleteMultipleAccounts,
    deleteSelectedTxs,
    deleteSelectedCategories,
    openRemainingBalanceModal,
    openShareModal,
    settings,
    showToast,
    showConfirm,
  } = useApp();

  const isArabic = settings.language === 'ar';

  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    actionType: 'share' | 'delete';
  }>({
    isOpen: false,
    actionType: 'share',
  });

  const totalCount =
    selectedAccountIds.length + selectedCategoryIds.length + selectedTxIds.length;

  if (
    !isTxMultiSelect &&
    !isCategoryMultiSelect &&
    !isAccountMultiSelect &&
    totalCount === 0
  ) {
    return null;
  }

  // Build Grouped Breakdown Text: e.g. "2 Accounts · 3 Transactions" (as chosen by user in Phase 1)
  const breakdownParts: string[] = [];
  if (selectedAccountIds.length > 0) {
    breakdownParts.push(
      isArabic
        ? `${selectedAccountIds.length} حسابات`
        : `${selectedAccountIds.length} Account${selectedAccountIds.length > 1 ? 's' : ''}`
    );
  }
  if (selectedCategoryIds.length > 0) {
    breakdownParts.push(
      isArabic
        ? `${selectedCategoryIds.length} تصنيفات`
        : `${selectedCategoryIds.length} Categor${selectedCategoryIds.length > 1 ? 'ies' : 'y'}`
    );
  }
  if (selectedTxIds.length > 0) {
    breakdownParts.push(
      isArabic
        ? `${selectedTxIds.length} معاملات`
        : `${selectedTxIds.length} Trx`
    );
  }

  const breakdownLabel =
    breakdownParts.length > 0
      ? breakdownParts.join(' · ')
      : `${totalCount} ${isArabic ? 'عناصر' : 'items'}`;

  const handleCancel = () => {
    clearAccountSelection();
    clearCategorySelection();
    clearTxSelection();
  };

  const handleOpenReview = (actionType: 'share' | 'delete') => {
    if (totalCount === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل' : 'Please select at least one item', 'info');
      return;
    }
    setReviewModal({ isOpen: true, actionType });
  };

  const handleConfirmReview = async (items: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
  }) => {
    setReviewModal({ isOpen: false, actionType: 'share' });

    if (reviewModal.actionType === 'share') {
      openShareModal({
        accounts: items.accounts,
        categories: items.categories,
        transactions: items.transactions,
      });
      return;
    }

    // Action: Delete
    const accountsToDelete = items.accounts;
    const categoriesToDelete = items.categories;
    const txsToDelete = items.transactions;

    // If accounts are included, check balance
    if (accountsToDelete.length > 0) {
      const remainingCount = accounts.length - accountsToDelete.length;
      if (remainingCount < 1) {
        showToast(
          isArabic
            ? 'لا يمكن حذف كافة الحسابات. يجب الإبقاء على حساب واحد على الأقل.'
            : 'Cannot delete all accounts. At least one must remain.',
          'error'
        );
        return;
      }

      const hasNonZeroBalance = accountsToDelete.some((a) => a.balance !== 0);
      if (hasNonZeroBalance) {
        openRemainingBalanceModal(accountsToDelete, (targetAccountId) => {
          deleteMultipleAccounts(
            accountsToDelete.map((a) => a.id),
            targetAccountId
          );
          if (categoriesToDelete.length > 0) {
            deleteSelectedCategories();
          }
          if (txsToDelete.length > 0) {
            deleteSelectedTxs();
          }
          handleCancel();
        });
        return;
      }
    }

    // Direct deletion with confirmation
    const totalToDelete =
      accountsToDelete.length + categoriesToDelete.length + txsToDelete.length;

    const confirmMsg = isArabic
      ? `هل أنت متأكد من حذف ${totalToDelete} من العناصر المحددة نهائياً؟`
      : `Are you sure you want to permanently delete ${totalToDelete} selected items?`;

    const confirmed = await showConfirm({
      title: isArabic ? 'تأكيد الحذف النهائي' : 'Confirm Permanent Deletion',
      message: confirmMsg,
      confirmText: isArabic ? 'حذف نهائي' : 'Delete',
      isDanger: true,
    });

    if (confirmed) {
      if (accountsToDelete.length > 0) {
        deleteMultipleAccounts(accountsToDelete.map((a) => a.id));
      }
      if (categoriesToDelete.length > 0) {
        deleteSelectedCategories();
      }
      if (txsToDelete.length > 0) {
        deleteSelectedTxs();
      }
      handleCancel();
    }
  };

  return (
    <>
      <div className="fixed bottom-20 md:bottom-24 landscape:bottom-14 left-0 right-0 z-40 w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 pointer-events-none animate-in slide-in-from-bottom-5 duration-200">
        <div className="pointer-events-auto p-2.5 rounded-2xl bg-zinc-900/95 border border-zinc-750 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-white">
          {/* Count Badge & Cancel */}
          <div className="flex items-center gap-2 pl-1 rtl:pr-1 min-w-0">
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer active:scale-95 shrink-0"
              title="Cancel Multi-Select"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                {totalCount}
              </span>
              <span className="text-xs font-semibold text-zinc-200 truncate">
                {breakdownLabel}
              </span>
            </div>
          </div>

          {/* Actions: Review -> Share & Delete */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenReview('share')}
              disabled={totalCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-40"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'مشاركة' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenReview('delete')}
              disabled={totalCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 border border-red-500/40 text-red-300 text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'حذف' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Action Selection Review Modal */}
      <SelectionReviewModal
        isOpen={reviewModal.isOpen}
        onClose={() => setReviewModal({ ...reviewModal, isOpen: false })}
        actionType={reviewModal.actionType}
        onConfirm={handleConfirmReview}
      />
    </>
  );
};
