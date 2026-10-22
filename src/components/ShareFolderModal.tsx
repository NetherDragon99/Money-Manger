import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  Loader2,
  Smile,
  Lock,
  Users,
} from 'lucide-react';
import { auth, getCachedAuthUser } from '../utils/firebase';
import { User } from 'firebase/auth';
import { format16DigitId, cleanNumericId, format16DigitInput, getOrCreateNumericId } from '../utils/userId';
import { UserSearchPicker } from './UserSearchPicker';
import {
  createNewShareFolder,
  appendToExistingShareFolder,
  sendShareFolderToRecipient,
  syncFolderToCloud,
  loadMyShareFolders,
  deduceFolderMetadata,
  generateShareUrl,
  publishUserProfileCard,
  ShareFolder,
  UserProfileCard,
} from '../utils/shareFolders';

const POPULAR_SHARE_ICONS = ['📁', '💼', '🏠', '👥', '🛒', '✈️', '💰', '🍽️', '🚗', '🎓', '🏥', '🎉', '🎁', '⚡', '🌟', '💎'];

export const ShareFolderModal: React.FC = () => {
  const {
    shareModalState,
    closeShareModal,
    settings,
    showToast,
    clearTxSelection,
    clearCategorySelection,
    clearAccountSelection,
    transactions: allAppTransactions,
    openEmojiPicker,
    setIsUserProfileModalOpen,
  } = useApp();

  const isArabic = settings.language === 'ar';

  const resolveActiveUser = () => {
    if (auth.currentUser) return auth.currentUser;
    const cached = getCachedAuthUser();
    if (cached?.uid) return cached;
    if (settings.userProfile?.uid) {
      return {
        uid: settings.userProfile.uid,
        displayName: settings.userProfile.name,
        photoURL: settings.userProfile.customAvatarUrl,
        email: '',
      };
    }
    return null;
  };

  const [currentUser, setCurrentUser] = useState<any>(() => resolveActiveUser());

  useEffect(() => {
    const active = resolveActiveUser();
    if (active) setCurrentUser(active);

    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        const fallback = resolveActiveUser();
        setCurrentUser(fallback);
      }
    });
    return () => unsub();
  }, [shareModalState?.isOpen, settings.userProfile?.uid, settings.userProfile?.numericId]);

  const isAuthenticated = Boolean(
    currentUser?.uid ||
    auth.currentUser?.uid ||
    getCachedAuthUser()?.uid ||
    settings.userProfile?.uid
  );
  const accounts: Account[] = shareModalState?.accounts || [];
  const categories: Category[] = shareModalState?.categories || [];
  const transactions: Transaction[] = shareModalState?.transactions || [];

  // Automatically fetch and deduplicate all transactions belonging to selected accounts and categories
  const resolvedTransactions = useMemo(() => {
    const selectedAccIds = new Set(accounts.map((a) => a.id));
    const selectedCatIds = new Set(categories.map((c) => c.id));
    const txMap = new Map<string, Transaction>();

    // 1. Explicitly selected transactions
    for (const tx of transactions) {
      txMap.set(tx.id, tx);
    }

    // 2. Fetch all transactions belonging to selected accounts
    if (selectedAccIds.size > 0 && allAppTransactions) {
      for (const tx of allAppTransactions) {
        if (
          (tx.accountId && selectedAccIds.has(tx.accountId)) ||
          (tx.toAccountId && selectedAccIds.has(tx.toAccountId))
        ) {
          txMap.set(tx.id, tx);
        }
      }
    }

    // 3. Fetch all transactions belonging to selected categories
    if (selectedCatIds.size > 0 && allAppTransactions) {
      for (const tx of allAppTransactions) {
        if (tx.categoryId && selectedCatIds.has(tx.categoryId)) {
          txMap.set(tx.id, tx);
        }
      }
    }

    return Array.from(txMap.values());
  }, [accounts, categories, transactions, allAppTransactions]);

  const totalItems = accounts.length + categories.length + resolvedTransactions.length;

  const autoMeta = useMemo(
    () => deduceFolderMetadata(accounts, categories, resolvedTransactions, isArabic),
    [accounts, categories, resolvedTransactions, isArabic]
  );

  const [existingFolders, setExistingFolders] = useState<ShareFolder[]>([]);
  const [folderMode, setFolderMode] = useState<'new' | 'existing'>('new');
  const [customFolderName, setCustomFolderName] = useState('');
  const [customFolderIcon, setCustomFolderIcon] = useState('');
  const [selectedExistingId, setSelectedExistingId] = useState('');

  // Direct Send via 16-digit ID
  const [recipient16DigitId, setRecipient16DigitId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [selectedRecipientUser, setSelectedRecipientUser] = useState<UserProfileCard | null>(null);
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const myNumericId = settings.userProfile?.numericId || '0000000000000000';
  const myName = settings.userProfile?.name || 'User';

  // Strictly reset all fields on every modal open so each share starts 100% fresh & register profile to cloud
  useEffect(() => {
    if (shareModalState?.isOpen) {
      const folders = loadMyShareFolders();
      setExistingFolders(folders);
      setFolderMode('new'); // ALWAYS default to clean, brand-new share!
      setRecipient16DigitId('');
      setRecipientName('');
      setSelectedRecipientUser(null);
      setCustomFolderName(autoMeta.name);
      setCustomFolderIcon(autoMeta.icon);
      setSelectedExistingId(folders[0]?.id || '');

      // Trigger profile cloud-registration immediately on open if signed in
      const user = auth.currentUser || currentUser;
      if (user) {
        const clean16 = cleanNumericId(myNumericId) || getOrCreateNumericId();
        if (clean16.length === 16) {
          publishUserProfileCard({
            numericId: clean16,
            name: myName,
            avatar: settings.userProfile?.avatarEmoji || '👤',
            photoURL: settings.userProfile?.customAvatarUrl || user.photoURL || '',
            uid: user.uid,
          });
        }
      }
    }
  }, [shareModalState?.isOpen, autoMeta.name, autoMeta.icon, currentUser, myNumericId, myName, settings.userProfile]);

  if (!shareModalState || !shareModalState.isOpen) {
    return null;
  }

  const getOrCreateFolder = (): ShareFolder | null => {
    if (folderMode === 'new' || existingFolders.length === 0) {
      return createNewShareFolder({
        customName: customFolderName.trim() || autoMeta.name,
        customIcon: customFolderIcon.trim() || autoMeta.icon,
        accounts,
        categories,
        transactions: resolvedTransactions,
        ownerNumericId: myNumericId,
        ownerName: myName,
        isArabic,
      });
    } else {
      if (!selectedExistingId) return null;
      return appendToExistingShareFolder(selectedExistingId, {
        accounts,
        categories,
        transactions: resolvedTransactions,
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
    const cleanId = cleanNumericId(selectedRecipientUser?.numericId || recipient16DigitId);
    if (cleanId.length !== 16) {
      showToast(
        isArabic
          ? 'يرجى اختيار مستخدم صالح أولاً'
          : 'Please select a valid user first',
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
      const res = await sendShareFolderToRecipient(
        folder,
        cleanId,
        recipientName.trim() || selectedRecipientUser?.name,
        selectedRecipientUser?.avatar,
        selectedRecipientUser?.photoURL
      );
      if (res.success) {
        showToast(
          isArabic
            ? `تم إرسال شير "${folder.name}" بنجاح إلى (${recipientName.trim() || format16DigitId(cleanId)})!`
            : `Share "${folder.name}" successfully sent to (${recipientName.trim() || format16DigitId(cleanId)})!`,
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
      // Ensure folder is synced to cloud immediately before copying
      await syncFolderToCloud(folder);
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
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain"
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
            <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
              🏦 {accounts.length} {isArabic ? 'حسابات' : 'Accounts'}
            </span>
          )}
          {categories.length > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              🏷️ {categories.length} {isArabic ? 'تصنيفات' : 'Categories'}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
            💳 {resolvedTransactions.length} {isArabic ? 'معاملة مجمعة بدون تكرار' : 'Transactions (Deduplicated)'}
          </span>
        </div>

        {!isAuthenticated ? (
          /* Guest Mode: Prominent Sign In Required Block */
          <div className="py-8 px-2 flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-purple-600/20 border-2 border-purple-500/40 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-950/40">
              <Lock className="w-8 h-8 text-purple-300" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-white">
                {isArabic ? 'تسجيل الدخول مطلوب للمشاركة' : 'Sign in Required to Share'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                {isArabic
                  ? 'ميزات المشاركة السحابية الجماعية والمعرّف الرقمي المكون من 16 رقماً متاحة فقط للحسابات المسجلة. يرجى تسجيل الدخول لحفظ ومزامنة الشير.'
                  : 'Cloud sharing features and 16-digit recipient invites are exclusively available to authenticated accounts. Please sign in to create and sync shared spaces.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                closeShareModal();
                setIsUserProfileModalOpen(true);
              }}
              className="w-full max-w-xs py-3 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs shadow-xl shadow-purple-600/25 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <Users className="w-4 h-4" />
              <span>{isArabic ? 'تسجيل الدخول الآن' : 'Sign In Now'}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Choice: Create New Share vs Add to Existing Share */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
            {isArabic ? 'طريقة المشاركة:' : 'Share Destination Mode:'}
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
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
              <span>{isArabic ? 'شير جديد (نظيف)' : 'New Share (Clean)'}</span>
            </button>
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
              <span>{isArabic ? 'إضافة لشير سابق' : 'Add to Existing'}</span>
            </button>
          </div>
        </div>

        {/* Option A: Create New Share Page */}
        {folderMode === 'new' && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {isArabic ? 'اسم وأيقونة صفحة الشير الجديدة:' : 'New Share Page Name & Icon:'}
              </label>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {isArabic ? 'شير نظيف بدون أعضاء' : 'Clean & empty members'}
              </span>
            </div>
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

            {/* Icon Selector Grid with Explicit type="button" on Show More */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  {isArabic ? 'أيقونة الشير:' : 'Share Icon:'}
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openEmojiPicker((emoji) => setCustomFolderIcon(emoji));
                  }}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition cursor-pointer"
                  title={isArabic ? 'عرض المزيد من الرموز' : 'Show more icons'}
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'المزيد من الرموز...' : 'Show more...'}</span>
                </button>
              </div>

              <div className="grid grid-cols-8 gap-1.5 p-2 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                {POPULAR_SHARE_ICONS.map((icon) => {
                  const isSelected = (customFolderIcon || autoMeta.icon) === icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCustomFolderIcon(icon);
                      }}
                      className={`h-9 rounded-xl flex items-center justify-center text-lg transition cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-blue-600/30 border-2 border-blue-500 scale-105 shadow-sm'
                          : 'hover:bg-zinc-800 border border-transparent'
                      }`}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">
              {totalItems === 1
                ? isArabic
                  ? 'تم وراثة اسم وأيقونة العنصر المختار تلقائياً.'
                  : 'Automatically inherited the name and icon of your chosen item.'
                : isArabic
                ? 'اسم وأيقونة مخصصة لمجموعة العناصر المحددة.'
                : 'Default template name & icon for your selected items.'}
            </p>
          </div>
        )}

        {/* Option B: Select Existing Share Page */}
        {folderMode === 'existing' && existingFolders.length > 0 && (
          <div className="space-y-2 animate-in fade-in duration-150">
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

        {/* Send to 16-Digit ID */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-3">
          <form onSubmit={handleSendDirect} className="space-y-3">
            <UserSearchPicker
              selectedUser={selectedRecipientUser}
              onSelectUser={(u) => {
                setSelectedRecipientUser(u);
                if (u) {
                  setRecipient16DigitId(u.numericId);
                  setRecipientName(u.name);
                } else {
                  setRecipient16DigitId('');
                  setRecipientName('');
                }
              }}
              onVerifyingChange={setIsVerifyingRecipient}
              currentUserId={myNumericId}
              accentColor="blue"
              isArabic={isArabic}
              label={isArabic ? 'إرسال فوري لمستخدم بالمعرّف الرقمي:' : 'Send to User via 16-Digit ID:'}
            />

            {/* Always visible Add / Send Share button: disabled while typing/verifying/not found */}
            <button
              type="submit"
              disabled={isSending || isVerifyingRecipient || !selectedRecipientUser}
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition shadow flex items-center justify-center gap-2 ${
                selectedRecipientUser && !isVerifyingRecipient && !isSending
                  ? 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white cursor-pointer shadow-blue-900/30'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
              }`}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isArabic ? 'جارٍ الإرسال والتسليم...' : 'Sending Share...'}</span>
                </>
              ) : isVerifyingRecipient ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                  <span>{isArabic ? 'جارٍ التحقق...' : 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {selectedRecipientUser
                      ? (isArabic ? `تأكيد وإرسال الشير إلى ${selectedRecipientUser.name || 'المستخدم'}` : `Confirm & Send Share to ${selectedRecipientUser.name || 'User'}`)
                      : (isArabic ? 'إرسال الشير للمستخدم' : 'Send Share to User')}
                  </span>
                </>
              )}
            </button>
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
          </>
        )}
      </div>
    </div>
  );
};