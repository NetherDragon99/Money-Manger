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
  Folder,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildShareUrl, encodeShareSnapshot } from '../utils/sharing';
import { format16DigitId, cleanNumericId } from '../utils/userId';
import {
  createNewShareFolder,
  appendToExistingShareFolder,
  sendShareFolderToRecipient,
  loadMyShareFolders,
  deduceFolderMetadata,
  ShareFolder,
} from '../utils/shareFolders';

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
    showConfirm,
  } = useApp();

  const isArabic = settings.language === 'ar';

  // Sub-modal states for in-app flows (No browser prompts/alerts)
  const [isShareFolderModalOpen, setIsShareFolderModalOpen] = useState(false);
  const [isInstantShareModalOpen, setIsInstantShareModalOpen] = useState(false);
  const [recipient16DigitId, setRecipient16DigitId] = useState('');
  const [isSendingToRecipient, setIsSendingToRecipient] = useState(false);

  // Folder creation / selection state
  const [customFolderName, setCustomFolderName] = useState('');
  const [selectedExistingFolderId, setSelectedExistingFolderId] = useState<string>('new');

  if (!isTxMultiSelect && !isCategoryMultiSelect) return null;

  const isTx = isTxMultiSelect;
  const count = isTx ? selectedTxIds.length : selectedCategoryIds.length;

  const selectedTxs = isTx ? transactions.filter((t) => selectedTxIds.includes(t.id)) : [];
  const selectedCats = !isTx ? categories.filter((c) => selectedCategoryIds.includes(c.id)) : [];
  const relatedAccounts = isTx
    ? accounts.filter((a) => selectedTxs.some((tx) => tx.accountId === a.id || tx.toAccountId === a.id))
    : accounts;

  // Auto-deduced metadata preview
  const autoMeta = deduceFolderMetadata(
    [],
    selectedCats,
    selectedTxs,
    isArabic
  );

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
      const snapshotTitle = customFolderName.trim() || autoMeta.name;
      const snapshotUrl = buildShareUrl({
        sharedData: encodeShareSnapshot({
          type: 'custom_share_bundle',
          title: snapshotTitle,
          createdAt: Date.now(),
          ownerName: settings.userProfile?.name || 'User',
          accounts: relatedAccounts,
          categories: selectedCats,
          transactions: selectedTxs,
        }),
      });

      await navigator.clipboard.writeText(snapshotUrl);
      showToast(
        isArabic
          ? `تم نسخ رابط المشاركة (${snapshotTitle}) بنجاح!`
          : `Share link (${snapshotTitle}) copied to clipboard!`,
        'success'
      );

      setIsInstantShareModalOpen(false);
      if (isTx) clearTxSelection();
      else clearCategorySelection();
    } catch (err: any) {
      showToast(err?.message || 'Error generating share link', 'error');
    }
  };

  const handleSaveToShareFolder = (e: React.FormEvent) => {
    e.preventDefault();

    let targetFolder: ShareFolder | null = null;
    const myNumericId = settings.userProfile?.numericId || '0000000000000000';
    const myName = settings.userProfile?.name || 'User';

    if (selectedExistingFolderId === 'new') {
      targetFolder = createNewShareFolder({
        customName: customFolderName.trim() || undefined,
        accounts: [],
        categories: selectedCats,
        transactions: selectedTxs,
        ownerNumericId: myNumericId,
        ownerName: myName,
        isArabic,
      });
      showToast(
        isArabic
          ? `تم إنشاء مجلد المشاركة "${targetFolder.name}" بنجاح!`
          : `Share Folder "${targetFolder.name}" created successfully!`,
        'success'
      );
    } else {
      targetFolder = appendToExistingShareFolder(selectedExistingFolderId, {
        categories: selectedCats,
        transactions: selectedTxs,
      });
      if (targetFolder) {
        showToast(
          isArabic
            ? `تمت إضافة العناصر إلى مجلد "${targetFolder.name}"!`
            : `Items added to Share Folder "${targetFolder.name}"!`,
          'success'
        );
      }
    }

    setIsShareFolderModalOpen(false);
    setCustomFolderName('');
    if (isTx) clearTxSelection();
    else clearCategorySelection();
  };

  const handleSendToFriendId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = cleanNumericId(recipient16DigitId);
    if (cleanId.length !== 16) {
      showToast(
        isArabic
          ? 'يرجى إدخال معرّف صديق رقمي صحيح مكون من 16 رقماً'
          : 'Please enter a valid 16-digit Numeric ID',
        'error'
      );
      return;
    }

    setIsSendingToRecipient(true);
    try {
      // 1. Create the dedicated share folder snapshot
      const myNumericId = settings.userProfile?.numericId || '0000000000000000';
      const myName = settings.userProfile?.name || 'User';

      const folder = createNewShareFolder({
        customName: customFolderName.trim() || undefined,
        accounts: relatedAccounts,
        categories: selectedCats,
        transactions: selectedTxs,
        ownerNumericId: myNumericId,
        ownerName: myName,
        isArabic,
      });

      // 2. Deliver directly into friend's inbox
      const res = await sendShareFolderToRecipient(folder, cleanId);

      if (res.success) {
        showToast(
          isArabic
            ? `تم إرسال مجلد "${folder.name}" بنجاح إلى المعرّف (${format16DigitId(cleanId)})!`
            : `Folder "${folder.name}" successfully sent to ID (${format16DigitId(cleanId)})!`,
          'success'
        );
        setIsInstantShareModalOpen(false);
        setRecipient16DigitId('');
        setCustomFolderName('');
        if (isTx) clearTxSelection();
        else clearCategorySelection();
      } else {
        showToast(
          isArabic
            ? `فشل في الإرسال: ${res.error || 'خطأ في الاتصال'}`
            : `Send failed: ${res.error || 'Network error'}`,
          'error'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Error sending folder', 'error');
    } finally {
      setIsSendingToRecipient(false);
    }
  };

  const handleCancel = () => {
    if (isTx) clearTxSelection();
    else clearCategorySelection();
  };

  const existingFolders = loadMyShareFolders();

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
            {/* Share / Send Instant Button */}
            <button
              type="button"
              onClick={() => setIsInstantShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
              title={isArabic ? 'مشاركة وإرسال فوري' : 'Share / Send'}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isArabic ? 'مشاركة' : 'Share'}</span>
            </button>

            {/* Dedicated Share Folder Button (Completely separated from Categories) */}
            <button
              type="button"
              onClick={() => setIsShareFolderModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm"
              title={isArabic ? 'حفظ في مجلد مشاركة' : 'Save to Share Folder'}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'مجلد مشاركة' : 'Share Folder'}</span>
            </button>

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

      {/* 1. Modal: Save to Dedicated Share Folder (Item 6) */}
      {isShareFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 text-white space-y-4 animate-in zoom-in-95 duration-200"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isArabic ? 'حفظ في مجلد مشاركة' : 'Save to Share Folder'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {isArabic
                      ? 'مجلدات مخصصة للمشاركة فقط ولا تؤثر على تصنيفات المصاريف'
                      : 'Dedicated to sharing only — does not alter spending categories'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareFolderModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveToShareFolder} className="space-y-3.5">
              {/* Option A: Pick an existing folder */}
              {existingFolders.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {isArabic ? 'اختر مجلداً موجوداً:' : 'Select existing folder:'}
                  </label>
                  <select
                    value={selectedExistingFolderId}
                    onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="new">
                      {isArabic ? '✨ إنشاء مجلد مشاركة جديد' : '✨ Create new share folder'}
                    </option>
                    {existingFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.icon} {f.name} ({f.itemCount} items)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Option B: Create new folder */}
              {selectedExistingFolderId === 'new' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {isArabic ? 'اسم المجلد:' : 'Folder Name:'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-lg">{autoMeta.icon}</span>
                    <input
                      type="text"
                      value={customFolderName}
                      onChange={(e) => setCustomFolderName(e.target.value)}
                      placeholder={autoMeta.name}
                      className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {isArabic
                      ? 'يأخذ المجلد اسم وأيقونة العنصر تلقائياً إن كان مفرداً أو اسماً عاماً إن كان مختلطاً.'
                      : 'Inherits name & icon automatically for single items, or default for mixed.'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg cursor-pointer"
              >
                {isArabic ? 'حفظ المجلد' : 'Save Folder'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Instant Share to 16-Digit Numeric ID or Snapshot Link (Item 7) */}
      {isInstantShareModalOpen && (
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
                  <p className="text-[11px] text-zinc-400">
                    {autoMeta.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInstantShareModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Method A: Instant Direct Send via 16-Digit Numeric ID */}
            <form onSubmit={handleSendToFriendId} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1">
                  {isArabic ? 'إرسال فوري إلى المعرّف (16 رقماً):' : 'Direct Send via 16-Digit Numeric ID:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={19} // allows 16 digits + 3 spaces
                    value={format16DigitId(recipient16DigitId)}
                    onChange={(e) => setRecipient16DigitId(cleanNumericId(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono tracking-wider text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={isSendingToRecipient || cleanNumericId(recipient16DigitId).length !== 16}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition shadow cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingToRecipient ? '...' : isArabic ? 'إرسال' : 'Send'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {isArabic
                    ? 'يصل المجلد مباشرة إلى هاتف صديقك في قسم "مشتركة معي" فور إدخال معرّفه المكون من 16 رقماً.'
                    : 'Delivers folder directly to friend\'s "Shared with Me" inbox using their 16-digit ID.'}
                </p>
              </div>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {isArabic ? 'أو عبر الرابط' : 'OR VIA LINK'}
              </span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {/* Method B: Copy Shareable Link */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>{isArabic ? 'نسخ رابط المشاهدة المباشر' : 'Copy Direct Snapshot Link'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
