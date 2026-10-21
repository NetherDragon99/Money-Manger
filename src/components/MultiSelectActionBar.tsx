import React from 'react';
import {
  Trash2,
  Share2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const MultiSelectActionBar: React.FC = () => {
  const {
    isTxMultiSelect,
    selectedTxIds,
    clearTxSelection,
    deleteSelectedTxs,
    transactions,
    accounts,
    isCategoryMultiSelect,
    selectedCategoryIds,
    clearCategorySelection,
    deleteSelectedCategories,
    categories,
    isAccountMultiSelect,
    selectedAccountIds,
    clearAccountSelection,
    deleteMultipleAccounts,
    openRemainingBalanceModal,
    openShareModal,
    settings,
    showToast,
    showConfirm,
  } = useApp();

  const isArabic = settings.language === 'ar';

  if (!isTxMultiSelect && !isCategoryMultiSelect && !isAccountMultiSelect) return null;

  const count = isTxMultiSelect
    ? selectedTxIds.length
    : isCategoryMultiSelect
    ? selectedCategoryIds.length
    : selectedAccountIds.length;

  const selectedTxs = isTxMultiSelect ? transactions.filter((t) => selectedTxIds.includes(t.id)) : [];
  const selectedCats = isCategoryMultiSelect ? categories.filter((c) => selectedCategoryIds.includes(c.id)) : [];
  const selectedAccs = isAccountMultiSelect ? accounts.filter((a) => selectedAccountIds.includes(a.id)) : [];
  const relatedAccounts = isTxMultiSelect
    ? accounts.filter((a) => selectedTxs.some((tx) => tx.accountId === a.id || tx.toAccountId === a.id))
    : selectedAccs;

  const handleShare = () => {
    if (count === 0) return;
    openShareModal({
      accounts: selectedAccs,
      categories: selectedCats,
      transactions: selectedTxs,
    });
  };

  const handleDelete = async () => {
    if (count === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل' : 'Please select at least one item', 'info');
      return;
    }

    if (isAccountMultiSelect) {
      // Check if accounts have non-zero balance (Item 8)
      const hasNonZeroBalance = selectedAccs.some((a) => a.balance !== 0);
      const remainingCount = accounts.length - selectedAccs.length;

      if (remainingCount < 1) {
        showToast(
          isArabic
            ? 'لا يمكن حذف كافة الحسابات. يجب الإبقاء على حساب واحد على الأقل.'
            : 'Cannot delete all accounts. At least one must remain.',
          'error'
        );
        return;
      }

      if (hasNonZeroBalance) {
        // Open Remaining Balance Resolution Modal
        openRemainingBalanceModal(selectedAccs, (targetAccountId) => {
          deleteMultipleAccounts(selectedAccountIds, targetAccountId);
        });
        return;
      }

      // If all selected accounts have zero balance, confirm and delete
      const confirmMsg = isArabic
        ? `هل أنت متأكد من حذف ${count} من الحسابات المحددة؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Are you sure you want to delete ${count} selected accounts? This action cannot be undone.`;

      const confirmed = await showConfirm({
        title: isArabic ? 'تأكيد حذف الحسابات' : 'Confirm Delete Accounts',
        message: confirmMsg,
        confirmText: isArabic ? 'حذف' : 'Delete',
        isDanger: true,
      });

      if (confirmed) {
        deleteMultipleAccounts(selectedAccountIds);
      }
      return;
    }

    const confirmMsg = isArabic
      ? `هل أنت متأكد من حذف ${count} من العناصر المحددة؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Are you sure you want to delete ${count} selected items? This action cannot be undone.`;

    const confirmed = await showConfirm({
      title: isArabic ? 'تأكيد الحذف الجماعي' : 'Confirm Batch Deletion',
      message: confirmMsg,
      confirmText: isArabic ? 'حذف المحدد' : 'Delete Selected',
      isDanger: true,
    });

    if (confirmed) {
      if (isTxMultiSelect) {
        deleteSelectedTxs();
      } else if (isCategoryMultiSelect) {
        deleteSelectedCategories();
      }
    }
  };

  const handleCancel = () => {
    if (isTxMultiSelect) clearTxSelection();
    if (isCategoryMultiSelect) clearCategorySelection();
    if (isAccountMultiSelect) clearAccountSelection();
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto px-4 pointer-events-none animate-in slide-in-from-bottom-5 duration-200">
      <div className="pointer-events-auto p-2.5 rounded-2xl bg-zinc-900/95 border border-zinc-750 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-white">
        {/* Count Badge & Cancel */}
        <div className="flex items-center gap-2 pl-1 rtl:pr-1 min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer active:scale-95"
            title="Cancel Multi-Select"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-blue-400 font-mono truncate">
            {count} {isArabic ? 'محدد' : 'selected'}
          </span>
        </div>

        {/* Actions: Share & Delete */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            disabled={count === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-40"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isArabic ? 'مشاركة' : 'Share'}</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={count === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 border border-red-500/40 text-red-300 text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isArabic ? 'حذف' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
