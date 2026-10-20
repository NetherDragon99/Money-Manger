import React, { useState } from 'react';
import {
  Trash2,
  Share2,
  FolderPlus,
  X,
  Check,
  Plus,
  Send,
  Copy,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildShareUrl, encodeShareSnapshot } from '../utils/sharing';
import { lookupUserByNumericId } from '../utils/userId';
import { rtdb } from '../utils/firebase';
import { ref, push, set } from 'firebase/database';
import { Category } from '../types';

export const MultiSelectActionBar: React.FC = () => {
  const {
    isTxMultiSelect,
    selectedTxIds,
    clearTxSelection,
    deleteSelectedTxs,
    batchAssignCategory,
    transactions,
    accounts,
    isCategoryMultiSelect,
    selectedCategoryIds,
    clearCategorySelection,
    deleteSelectedCategories,
    categories,
    addCategory,
    settings,
    showToast,
    showConfirm,
  } = useApp();

  const isArabic = settings.language === 'ar';

  // Sub-modal states for in-app flows (No browser prompts/alerts)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareFriendId, setShareFriendId] = useState('');
  const [isSendingToFriend, setIsSendingToFriend] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);

  if (!isTxMultiSelect && !isCategoryMultiSelect) return null;

  const isTx = isTxMultiSelect;
  const count = isTx ? selectedTxIds.length : selectedCategoryIds.length;

  const handleDelete = async () => {
    if (count === 0) {
      showToast(isArabic ? 'يرجى اختيار عنصر واحد على الأقل' : 'Please select at least one item', 'info');
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
      if (isTx) {
        deleteSelectedTxs();
      } else {
        deleteSelectedCategories();
      }
    }
  };

  const handleCopyShareLink = async () => {
    if (count === 0) return;

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
            ? `تم نسخ رابط مشاركة ${count} معاملة مختارة بنجاح!`
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
            ? `تم نسخ رابط مشاركة ${count} تصنيف بنجاح!`
            : `Share link for ${count} selected categories copied!`,
          'success'
        );
      }
      setIsShareModalOpen(false);
      if (isTx) clearTxSelection();
      else clearCategorySelection();
    } catch (err: any) {
      showToast(err?.message || 'Error generating share link', 'error');
    }
  };

  const handleSendToFriendId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = shareFriendId.trim();
    if (!/^\d{8,10}$/.test(cleanId)) {
      showToast(
        isArabic ? 'يرجى إدخال معرّف رقمي صالح (8 إلى 10 أرقام)' : 'Please enter a valid 8-to-10 digit Numeric ID',
        'info'
      );
      return;
    }

    setIsSendingToFriend(true);
    try {
      const recipient = await lookupUserByNumericId(cleanId);
      if (!recipient || !recipient.uid) {
        showToast(
          isArabic
            ? 'لم يتم العثور على مستخدم بهذا المعرف الرقمي في السحابة'
            : 'No user found with this Numeric ID in the Cloud',
          'error'
        );
        return;
      }

      const selectedTxs = transactions.filter((t) => selectedTxIds.includes(t.id));
      const bundleAccounts = accounts.filter((a) =>
        selectedTxs.some((tx) => tx.accountId === a.id || tx.toAccountId === a.id)
      );

      // Push to recipient's shared inbox in Firebase RTDB
      const inboxRef = ref(rtdb, `users/${recipient.uid}/sharedInbox`);
      const newBundleRef = push(inboxRef);
      await set(newBundleRef, {
        id: newBundleRef.key,
        fromNumericId: settings.userProfile?.numericId || 'anonymous',
        fromName: settings.userProfile?.name || 'Friend',
        type: 'custom_share_bundle',
        title: isArabic ? `معاملات مشتركة (${count})` : `Shared Transactions (${count})`,
        createdAt: Date.now(),
        accounts: bundleAccounts,
        transactions: selectedTxs,
      });

      showToast(
        isArabic
          ? `تم إرسال المعاملات بنجاح إلى "${recipient.displayName || recipient.email || cleanId}"!`
          : `Transactions successfully sent to "${recipient.displayName || recipient.email || cleanId}"!`,
        'success'
      );

      setIsShareModalOpen(false);
      setShareFriendId('');
      clearTxSelection();
    } catch (err: any) {
      showToast(err?.message || 'Failed to send bundle', 'error');
    } finally {
      setIsSendingToFriend(false);
    }
  };

  const handleSelectCategory = (cat: Category) => {
    if (isTx) {
      batchAssignCategory(selectedTxIds, cat);
      setIsGroupModalOpen(false);
    }
  };

  const handleCreateNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newCat: Omit<Category, 'id'> = {
      name: newCatName.trim(),
      icon: '📁',
      type: 'expense',
      budgetLimit: 0,
    };
    addCategory(newCat);
    setNewCatName('');
    setIsCreatingNewCat(false);
    showToast(isArabic ? `تم إنشاء التصنيف "${newCat.name}" بنجاح` : `Created category "${newCat.name}"`, 'success');
  };

  const handleCancel = () => {
    if (isTx) clearTxSelection();
    else clearCategorySelection();
  };

  return (
    <>
      {/* Floating Action Bar: Responsive width across Mobile, Tablet & Desktop */}
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Share Selected Button */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
              title={isArabic ? 'مشاركة العناصر المحددة' : 'Share Selected'}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'مشاركة' : 'Share'}</span>
            </button>

            {/* Add to Group / Assign Category Button */}
            {isTx && (
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
                title={isArabic ? 'تعيين تصنيف أو مجموعة' : 'Assign to Group'}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'المجموعة' : 'Group'}</span>
              </button>
            )}

            {/* Delete Selected Button */}
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/40 text-red-300 border border-red-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
              title={isArabic ? 'حذف المحدد' : 'Delete Selected'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'حذف' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* In-App Share Selected Modal (Item 14: Snapshot Link or Send via Numeric ID) */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 text-white space-y-4 animate-in zoom-in-95 duration-200"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isArabic ? `مشاركة ${count} عنصر` : `Share ${count} Selected Items`}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {isArabic ? 'اختر طريقة المشاركة الفورية' : 'Choose instant sharing method'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Copy Instant Share Link */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="w-full p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 flex items-center gap-3 text-left rtl:text-right transition cursor-pointer active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white">
                  {isArabic ? 'نسخ رابط المشاهدة المباشر' : 'Copy Share Link Snapshot'}
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  {isArabic ? 'رابط مباشر يحتوي على المعاملات المحددة' : 'Generate standalone shareable link'}
                </div>
              </div>
            </button>

            {/* Option 2: Send directly via 8-digit Numeric ID */}
            {isTx && (
              <form onSubmit={handleSendToFriendId} className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    {isArabic ? 'إرسال لصديق عبر المعرف الرقمي' : 'Send via Friend Numeric ID'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    value={shareFriendId}
                    onChange={(e) => setShareFriendId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 83491025"
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-mono text-xs placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingToFriend || shareFriendId.length < 8}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingToFriend ? '...' : isArabic ? 'إرسال' : 'Send'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* In-App "Assign Category / Group" Modal (Item 15) */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm max-h-[85vh] rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 text-white flex flex-col space-y-4 animate-in zoom-in-95 duration-200"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isArabic ? `تعيين تصنيف لـ ${count} معاملة` : `Assign Category to ${count} Txs`}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {isArabic ? 'اختر تصنيفاً موجوداً أو أنشئ مجموعة جديدة' : 'Choose existing or create a new group'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Create New Category Toggle */}
            {isCreatingNewCat ? (
              <form onSubmit={handleCreateNewCategory} className="flex gap-2 shrink-0">
                <input
                  type="text"
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={isArabic ? 'اسم التصنيف الجديد...' : 'New category name...'}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewCat(false)}
                  className="px-2.5 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingNewCat(true)}
                className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isArabic ? '+ إنشاء تصنيف / مجموعة جديدة' : '+ Create New Category / Group'}</span>
              </button>
            )}

            {/* List of existing categories to pick */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 flex items-center justify-between transition cursor-pointer text-left rtl:text-right active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{cat.icon || '📁'}</span>
                    <span className="text-xs font-bold text-white truncate">{cat.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 capitalize">{cat.type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
