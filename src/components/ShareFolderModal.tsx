import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import {
  FolderPlus,
  Send,
  Copy,
  X,
  Folder,
  Check,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { format16DigitId, cleanNumericId } from '../utils/userId';
import {
  createNewShareFolder,
  appendToExistingShareFolder,
  sendShareFolderToRecipient,
  loadMyShareFolders,
  deduceFolderMetadata,
  generateShareUrl,
  ShareFolder,
} from '../utils/shareFolders';

export const ShareFolderModal: React.FC = () => {
  const {
    shareModalState,
    closeShareModal,
    settings,
    showToast,
    clearTxSelection,
    clearCategorySelection,
    clearAccountSelection,
  } = useApp();

  if (!shareModalState || !shareModalState.isOpen) {
    return null;
  }

  const isArabic = settings.language === 'ar';
  const accounts: Account[] = shareModalState.accounts || [];
  const categories: Category[] = shareModalState.categories || [];
  const transactions: Transaction[] = shareModalState.transactions || [];
  const totalItems = accounts.length + categories.length + transactions.length;

  const autoMeta = deduceFolderMetadata(accounts, categories, transactions, isArabic);
  const existingFolders = loadMyShareFolders();

  const [folderMode, setFolderMode] = useState<'new' | 'existing'>(
    existingFolders.length > 0 ? 'existing' : 'new'
  );
  const [customFolderName, setCustomFolderName] = useState(autoMeta.name);
  const [customFolderIcon, setCustomFolderIcon] = useState(autoMeta.icon);
  const [selectedExistingId, setSelectedExistingId] = useState(existingFolders[0]?.id || '');

  // Direct Send via 16-digit ID
  const [recipient16DigitId, setRecipient16DigitId] = useState('');
  const [isSending, setIsSending] = useState(false);

  const myNumericId = settings.userProfile?.numericId || '0000000000000000';
  const myName = settings.userProfile?.name || 'User';

  const getOrCreateFolder = (): ShareFolder | null => {
    if (folderMode === 'new' || existingFolders.length === 0) {
      return createNewShareFolder({
        customName: customFolderName.trim() || autoMeta.name,
        customIcon: customFolderIcon.trim() || autoMeta.icon,
        accounts,
        categories,
        transactions,
        ownerNumericId: myNumericId,
        ownerName: myName,
        isArabic,
      });
    } else {
      if (!selectedExistingId) return null;
      return appendToExistingShareFolder(selectedExistingId, {
        accounts,
        categories,
        transactions,
      });
    }
  };

  const cleanupAndClose = () => {
    clearTxSelection();
    clearCategorySelection();
    clearAccountSelection();
    closeShareModal();
  };

  // 1. Direct Send via 16-digit ID
  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = cleanNumericId(recipient16DigitId);
    if (cleanId.length !== 16) {
      showToast(
        isArabic
          ? 'يرجى إدخال معرّف رقمي صحيح مكون من 16 رقماً'
          : 'Please enter a valid 16-digit Numeric ID',
        'error'
      );
      return;
    }

    const folder = getOrCreateFolder();
    if (!folder) {
      showToast(isArabic ? 'تعذر إنشاء صفحة المشاركة' : 'Failed to create share page', 'error');
      return;
    }

    setIsSending(true);
    try {
      const res = await sendShareFolderToRecipient(folder, cleanId);
      if (res.success) {
        showToast(
          isArabic
            ? `تم إرسال شير "${folder.name}" بنجاح إلى المعرّف (${format16DigitId(cleanId)})!`
            : `Share "${folder.name}" successfully sent to (${format16DigitId(cleanId)})!`,
          'success'
        );
        cleanupAndClose();
      } else {
        showToast(
          isArabic
            ? `فشل في الإرسال: ${res.error || 'خطأ في الاتصال'}`
            : `Send failed: ${res.error || 'Network error'}`,
          'error'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Error delivering share', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // 2. Copy Share Link
  const handleCopyLink = async () => {
    const folder = getOrCreateFolder();
    if (!folder) return;

    try {
      const shareUrl = generateShareUrl(folder);
      await navigator.clipboard.writeText(shareUrl);
      showToast(
        isArabic
          ? `تم نسخ رابط المشاركة لشير "${folder.name}" بنجاح!`
          : `Public share link for "${folder.name}" copied to clipboard!`,
        'success'
      );
      cleanupAndClose();
    } catch (err: any) {
      showToast(err?.message || 'Error generating link', 'error');
    }
  };

  // 3. Save / Append Folder
  const handleSaveOnly = () => {
    const folder = getOrCreateFolder();
    if (folder) {
      showToast(
        isArabic
          ? `تم حفظ وتحديث صفحة المشاركة "${folder.name}" بنجاح!`
          : `Share Page "${folder.name}" updated successfully!`,
        'success'
      );
      cleanupAndClose();
    }
  };

  return (
    <div
      onClick={closeShareModal}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 text-white space-y-4 animate-in zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'نظام المشاركة (صفحات وقوالب)' : 'Share Page & Template'}
              </h3>
              <p className="text-xs text-zinc-400">
                {totalItems} {isArabic ? 'عناصر محددة للمشاركة' : 'items selected'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeShareModal}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Items Badges */}
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300">
          {accounts.length > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
              🏦 {accounts.length} {isArabic ? 'حسابات' : 'Accounts'}
            </span>
          )}
          {categories.length > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              🏷️ {categories.length} {isArabic ? 'تصنيفات' : 'Categories'}
            </span>
          )}
          {transactions.length > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
              💳 {transactions.length} {isArabic ? 'معاملات' : 'Transactions'}
            </span>
          )}
        </div>

        {/* Choice: Add to Existing Share vs Create New Share */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
            {isArabic ? 'طريقة المشاركة:' : 'Share Destination Mode:'}
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              disabled={existingFolders.length === 0}
              onClick={() => setFolderMode('existing')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 ${
                folderMode === 'existing'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إضافة لشير موجود' : 'Add to Existing'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFolderMode('new')}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                folderMode === 'new'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isArabic ? 'إنشاء شير جديد' : 'Create New Share'}</span>
            </button>
          </div>
        </div>

        {/* Option A: Select Existing Share Page */}
        {folderMode === 'existing' && existingFolders.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {isArabic ? 'اختر صفحة الشير للإضافة إليها:' : 'Select Share Page to Append to:'}
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {existingFolders.map((f) => {
                const isSelected = selectedExistingId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedExistingId(f.id)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-md'
                        : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-850 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl">{f.icon || '📁'}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{f.name}</div>
                        <div className="text-[10px] text-zinc-400">
                          {f.itemCount} {isArabic ? 'عناصر حالية' : 'current items'} •{' '}
                          {f.members.length} {isArabic ? 'أعضاء' : 'members'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Option B: Create New Share Page */}
        {folderMode === 'new' && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {isArabic ? 'اسم وأيقونة صفحة الشير الجديدة:' : 'New Share Page Name & Icon:'}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-zinc-900 border border-zinc-800">
              <input
                type="text"
                value={customFolderIcon}
                onChange={(e) => setCustomFolderIcon(e.target.value)}
                maxLength={4}
                className="w-10 text-center text-lg bg-zinc-950 rounded-xl border border-zinc-700 py-1"
                title="Icon / Emoji"
              />
              <input
                type="text"
                value={customFolderName}
                onChange={(e) => setCustomFolderName(e.target.value)}
                placeholder={autoMeta.name}
                className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              {totalItems === 1
                ? isArabic
                  ? 'تم وراثة اسم وأيقونة العنصر المختار تلقائياً.'
                  : 'Automatically inherited the name and icon of your chosen item.'
                : isArabic
                ? 'اسم وايقونة افتراضية لمجموعة العناصر.'
                : 'Default template name & icon for your selected items.'}
            </p>
          </div>
        )}

        {/* Send to 16-Digit ID */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-3">
          <form onSubmit={handleSendDirect} className="space-y-2">
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {isArabic ? 'إرسال فوري لشخص بالـ 16 رقماً:' : 'Send to Person via 16-Digit ID:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={19}
                value={format16DigitId(recipient16DigitId)}
                onChange={(e) => setRecipient16DigitId(cleanNumericId(e.target.value))}
                placeholder="1234 5678 9012 3456"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono tracking-wider text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={isSending || cleanNumericId(recipient16DigitId).length !== 16}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition shadow cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? '...' : isArabic ? 'إرسال' : 'Send'}</span>
              </button>
            </div>
          </form>

          {/* Action Buttons: Copy Web Link & Save */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-semibold text-zinc-200 transition cursor-pointer active:scale-95"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span>{isArabic ? 'نسخ رابط الويب' : 'Copy Web Link'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveOnly}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-semibold text-blue-300 transition cursor-pointer active:scale-95"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>{isArabic ? 'حفظ في الشير' : 'Save to Share'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
