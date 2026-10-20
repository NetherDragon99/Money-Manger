import React from 'react';
import { Trash2, Share2, FolderPlus, X, CheckSquare, Square } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildShareUrl, encodeShareSnapshot } from '../utils/sharing';

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
    settings,
    showToast,
  } = useApp();

  const isArabic = settings.language === 'ar';

  if (!isTxMultiSelect && !isCategoryMultiSelect) return null;

  const isTx = isTxMultiSelect;
  const count = isTx ? selectedTxIds.length : selectedCategoryIds.length;

  const handleDelete = () => {
    if (count === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل' : 'Please select at least one item', 'info');
      return;
    }
    const confirmMsg = isArabic
      ? `هل أنت متأكد من حذف ${count} من العناصر المحددة؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Are you sure you want to delete ${count} selected items? This cannot be undone.`;
    if (window.confirm(confirmMsg)) {
      if (isTx) {
        deleteSelectedTxs();
      } else {
        deleteSelectedCategories();
      }
    }
  };

  const handleShareImmediate = async () => {
    if (count === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل للمشاركة' : 'Select at least one item to share', 'info');
      return;
    }

    try {
      if (isTx) {
        const selectedTxs = transactions.filter((t) => selectedTxIds.includes(t.id));
        const bundleAccounts = accounts.filter((a) =>
          selectedTxs.some((tx) => tx.accountId === a.id || tx.toAccountId === a.id)
        );
        const snapshotUrl = buildShareUrl({
          sharedData: encodeShareSnapshot({
            type: 'custom_share_bundle',
            title: isArabic ? `مجموعة معاملات مختارة (${count})` : `Selected Transactions Bundle (${count})`,
            createdAt: Date.now(),
            ownerName: settings.userProfile?.name || 'Owner',
            accounts: bundleAccounts,
            transactions: selectedTxs,
          }),
        });

        await navigator.clipboard.writeText(snapshotUrl);
        showToast(
          isArabic
            ? `تم إنشاء ونسخ رابط مشاركة لـ ${count} معاملة مختارة بنجاح!`
            : `Share link for ${count} selected transactions copied!`,
          'success'
        );
      } else {
        const selectedCats = categories.filter((c) => selectedCategoryIds.includes(c.id));
        const matchingTxs = transactions.filter((t) => t.categoryId && selectedCategoryIds.includes(t.categoryId));
        const snapshotUrl = buildShareUrl({
          sharedData: encodeShareSnapshot({
            type: 'custom_share_bundle',
            title: isArabic ? `مجموعة تصنيفات مختارة (${count})` : `Selected Categories Bundle (${count})`,
            createdAt: Date.now(),
            ownerName: settings.userProfile?.name || 'Owner',
            accounts,
            categories: selectedCats,
            transactions: matchingTxs,
          }),
        });

        await navigator.clipboard.writeText(snapshotUrl);
        showToast(
          isArabic
            ? `تم إنشاء ونسخ رابط مشاركة لـ ${count} تصنيف بنجاح!`
            : `Share link for ${count} selected categories copied!`,
          'success'
        );
      }
      if (isTx) clearTxSelection();
      else clearCategorySelection();
    } catch (err: any) {
      showToast(err?.message || 'Error generating share link', 'error');
    }
  };

  const handleAddToCustomGroup = async () => {
    if (count === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل' : 'Select at least one item', 'info');
      return;
    }

    try {
      const templateName = window.prompt(
        isArabic ? 'أدخل اسم قالب المشاركة المخصص:' : 'Enter a name for this Custom Share Template:',
        isTx ? `Batch Transactions (${count})` : `Custom Categories (${count})`
      );

      if (!templateName) return;

      const customBundle = {
        id: `template_${Date.now()}`,
        title: templateName.trim(),
        createdAt: Date.now(),
        itemType: isTx ? 'transactions' : 'categories',
        itemIds: isTx ? [...selectedTxIds] : [...selectedCategoryIds],
      };

      // Save to saved templates in localStorage
      const existing = JSON.parse(localStorage.getItem('saved_share_templates') || '[]');
      existing.unshift(customBundle);
      localStorage.setItem('saved_share_templates', JSON.stringify(existing));

      showToast(
        isArabic
          ? `تم حفظ "${templateName}" في قوالب المشاركة المخصصة!`
          : `Saved "${templateName}" to Custom Share Groups!`,
        'success'
      );

      if (isTx) clearTxSelection();
      else clearCategorySelection();
    } catch (err: any) {
      showToast(err?.message || 'Error saving custom template', 'error');
    }
  };

  const handleCancel = () => {
    if (isTx) clearTxSelection();
    else clearCategorySelection();
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 max-w-[480px] mx-auto px-3 pointer-events-none animate-in slide-in-from-bottom-5 duration-200">
      <div className="pointer-events-auto p-2.5 rounded-2xl bg-zinc-900/95 dark:bg-zinc-900/95 border border-zinc-750 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-2 text-white">
        {/* Count Badge & Cancel */}
        <div className="flex items-center gap-2 pl-1 rtl:pr-1 min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Cancel Multi-Select"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-blue-400 font-mono truncate">
            {count} {isArabic ? 'محدد' : 'selected'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Share Selected */}
          <button
            type="button"
            onClick={handleShareImmediate}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer"
            title={isArabic ? 'مشاركة فورية' : 'Share Selected'}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isArabic ? 'مشاركة' : 'Share'}</span>
          </button>

          {/* Add to Custom Template Group */}
          <button
            type="button"
            onClick={handleAddToCustomGroup}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer"
            title={isArabic ? 'إضافة لقالب مخصص' : 'Save as Template'}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isArabic ? 'قالب' : 'Template'}</span>
          </button>

          {/* Delete Selected */}
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 text-red-300 border border-red-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer"
            title={isArabic ? 'حذف المحدد' : 'Delete Selected'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isArabic ? 'حذف' : 'Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
