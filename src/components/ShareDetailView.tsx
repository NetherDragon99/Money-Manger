import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Share2,
  Copy,
  Users,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Landmark,
  Tags,
  Receipt,
  Download,
  ExternalLink,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
  X,
  Shield,
  Edit3,
  LogOut,
  Loader2,
  Settings,
  AlertTriangle,
  Calendar,
  Filter,
  Folder,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import { auth } from '../utils/firebase';
import { format16DigitId, cleanNumericId, format16DigitInput, getOrCreateNumericId } from '../utils/userId';
import { UserSearchPicker } from './UserSearchPicker';
import { ShareSpaceSettingsModal } from './ShareSpaceSettingsModal';
import {
  ShareFolder,
  ShareMember,
  subscribeToShareFolder,
  fetchShareFolderFromCloud,
  subscribeToMyInbox,
  fetchMyInboxOnce,
  saveReceivedShareFolders,
  addTransactionToShareFolder,
  removeItemFromShareFolder,
  removeItemsFromShareFolderSmart,
  addMemberToShareFolder,
  removeMemberFromShareFolder,
  removeAllMembersFromShareFolder,
  leaveShareFolder,
  updateMemberRoleInShareFolder,
  updateMemberDetailsInShareFolder,
  syncFolderToCloud,
  generateShareUrl,
  fetchUserProfileCard,
  getAvatarColorGradient,
  getMemberInitials,
} from '../utils/shareFolders';
import {
  formatCurrency,
  formatDateToYYYYMMDD,
  formatTimeToHHMM,
  getDayHeaderTitle,
  getMonthHeaderTitle,
  formatTime12h,
} from '../utils/dateCycle';

interface ShareDetailViewProps {
  folder: ShareFolder;
  onExit: () => void;
}

export const ShareDetailView: React.FC<ShareDetailViewProps> = ({ folder: initialFolder, onExit }) => {
  const {
    settings,
    addTransaction,
    deleteTransaction,
    importSharedItems,
    showToast,
    showConfirm,
    setIsEditingSpace: setGlobalIsEditingSpace,
    setEditingShareId: setGlobalEditingShareId,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';
  const myCleanNumericId = cleanNumericId(settings.userProfile?.numericId || '') || getOrCreateNumericId();

  const [folder, setFolder] = useState<ShareFolder>(initialFolder);
  const [isCopied, setIsCopied] = useState(false);

  // Collapsed state sets for grouped timeline (months and days)
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  // Active filter by included account or category
  const [activeEntityFilter, setActiveEntityFilter] = useState<{
    type: 'account' | 'category';
    id: string;
    name: string;
    icon: string;
  } | null>(null);

  // Quick Add Transaction Modal inside Share View
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');

  // Add Member State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  // Dedicated Share Space Settings / Edit Space Modal state without premature render resets
  const [activeSettingsSpace, setActiveSettingsSpace] = useState<ShareFolder | null>(null);
  const activeSettingsSpaceRef = useRef<ShareFolder | null>(null);
  activeSettingsSpaceRef.current = activeSettingsSpace;

  const handleOpenEditSpace = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveSettingsSpace(folder);
    setGlobalIsEditingSpace?.(true);
    setGlobalEditingShareId?.(folder.id);
  };

  const handleCloseEditSpace = () => {
    setActiveSettingsSpace(null);
    setGlobalIsEditingSpace?.(false);
    setGlobalEditingShareId?.(null);
  };

  // Hardware Back button / Popstate handling: closes edit space when active without wiping on render
  useEffect(() => {
    const handlePop = () => {
      if (activeSettingsSpaceRef.current) {
        handleCloseEditSpace();
      }
    };

    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, []);

  // When unmounting ShareDetailView, safely clean up
  useEffect(() => {
    return () => {
      handleCloseEditSpace();
    };
  }, []);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedMemberUser, setSelectedMemberUser] = useState<any>(null);
  const [isVerifyingMember, setIsVerifyingMember] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState('');

  // Pre-Delete Review Modal State (with overlap warning & smart cleanup)
  const [preDeleteState, setPreDeleteState] = useState<{
    targetType: 'account' | 'category' | 'transaction';
    targetId: string;
    targetName: string;
    targetIcon?: string;
    candidates: Array<{
      tx: Transaction;
      overlappingWith: Array<{
        type: 'account' | 'category';
        name: string;
        icon: string;
      }>;
    }>;
    selectedTxIds: Set<string>;
    deleteFromPersonal: boolean;
  } | null>(null);

  // Dual Sync 1: Subscribe to real-time updates for this folder from Firebase RTDB
  useEffect(() => {
    if (!initialFolder.id) return;
    const unsub = subscribeToShareFolder(initialFolder.id, (liveFolder) => {
      if (liveFolder) {
        setFolder((prev) => ({
          ...liveFolder,
          ownerNumericId: liveFolder.ownerNumericId || prev.ownerNumericId,
          owner16DigitId: liveFolder.owner16DigitId || prev.owner16DigitId || liveFolder.ownerNumericId || prev.ownerNumericId,
          ownerUid: liveFolder.ownerUid || prev.ownerUid,
          ownerName: liveFolder.ownerName || prev.ownerName,
          ownerAvatar: liveFolder.ownerAvatar || prev.ownerAvatar,
          ownerPhotoURL: liveFolder.ownerPhotoURL || prev.ownerPhotoURL,
        }));
      }
    });
    return () => unsub();
  }, [initialFolder.id]);

  // Dual Sync 2: Automatic 3-second periodic polling loop fetching active shared_accounts/share_${shareId}
  useEffect(() => {
    if (!initialFolder.id) return;

    let isMounted = true;
    const pollActiveShare = async () => {
      try {
        const live = await fetchShareFolderFromCloud(initialFolder.id);
        if (isMounted && live) {
          setFolder((prev) => {
            if (
              live.updatedAt !== prev.updatedAt ||
              live.members.length !== prev.members.length ||
              live.payload.transactions.length !== prev.payload.transactions.length ||
              live.payload.accounts.length !== prev.payload.accounts.length
            ) {
              return {
                ...live,
                ownerNumericId: live.ownerNumericId || prev.ownerNumericId,
                owner16DigitId: live.owner16DigitId || prev.owner16DigitId || live.ownerNumericId || prev.ownerNumericId,
                ownerUid: live.ownerUid || prev.ownerUid,
                ownerName: live.ownerName || prev.ownerName,
                ownerAvatar: live.ownerAvatar || prev.ownerAvatar,
                ownerPhotoURL: live.ownerPhotoURL || prev.ownerPhotoURL,
              };
            }
            return prev;
          });
        }
      } catch (err) {
        // Quiet poll error handling
      }
    };

    pollActiveShare();
    const intervalId = setInterval(pollActiveShare, 3000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [initialFolder.id]);

  // Dual Sync 3: Real-time listener & 3-second periodic polling for incoming shares while Detail View is open
  useEffect(() => {
    if (myCleanNumericId.length !== 16) return;
    const unsub = subscribeToMyInbox(myCleanNumericId, (liveReceived) => {
      if (liveReceived && Array.isArray(liveReceived)) {
        saveReceivedShareFolders(liveReceived);
      }
    });

    let isMounted = true;
    const pollInbox = async () => {
      try {
        const live = await fetchMyInboxOnce(myCleanNumericId);
        if (isMounted && live && Array.isArray(live)) {
          saveReceivedShareFolders(live);
        }
      } catch {}
    };

    pollInbox();
    const intervalId = setInterval(pollInbox, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      unsub();
    };
  }, [myCleanNumericId]);

  const folderOwner16 = cleanNumericId(folder.owner16DigitId || folder.ownerNumericId);
  const isOwner = (myCleanNumericId && folderOwner16 && folderOwner16 === myCleanNumericId) ||
                  (auth.currentUser?.uid && folder.ownerUid && folder.ownerUid === auth.currentUser.uid);
  const myMemberEntry = folder.members.find((m) => cleanNumericId(m.numericId) === myCleanNumericId);
  const canEdit = isOwner || folder.permission === 'allow_import_edit' || myMemberEntry?.role === 'editor';

  const accounts = folder.payload.accounts || [];
  const categories = folder.payload.categories || [];
  const transactions = folder.payload.transactions || [];

  // Total balance computation for the share
  const totalBalance = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.reduce((acc, a) => acc + a.balance, 0);
    }
    let inc = 0;
    let exp = 0;
    for (const t of transactions) {
      if (t.type === 'income') inc += t.amount;
      if (t.type === 'expense') exp += t.amount;
    }
    return inc - exp;
  }, [accounts, transactions]);

  // Displayed transactions (filtered by active entity or full list)
  const displayedTransactions = useMemo(() => {
    if (!activeEntityFilter) return transactions;
    if (activeEntityFilter.type === 'account') {
      return transactions.filter(
        (t) => t.accountId === activeEntityFilter.id || t.toAccountId === activeEntityFilter.id
      );
    }
    return transactions.filter(
      (t) => t.categoryId === activeEntityFilter.id || t.categoryName === activeEntityFilter.name
    );
  }, [transactions, activeEntityFilter]);

  // Group by Month -> Day identical to HomeView
  const groupedData = useMemo(() => {
    const sorted = [...displayedTransactions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      if (timeA !== timeB) return timeB.localeCompare(timeA);
      return b.createdAt - a.createdAt;
    });

    const monthsMap = new Map<
      string,
      {
        monthKey: string;
        monthNet: number;
        daysMap: Map<string, { dayKey: string; dayNet: number; txs: Transaction[] }>;
      }
    >();

    for (const tx of sorted) {
      const monthKey = tx.date.slice(0, 7); // "YYYY-MM"
      const dayKey = tx.date; // "YYYY-MM-DD"

      let monthEntry = monthsMap.get(monthKey);
      if (!monthEntry) {
        monthEntry = { monthKey, monthNet: 0, daysMap: new Map() };
        monthsMap.set(monthKey, monthEntry);
      }

      let dayEntry = monthEntry.daysMap.get(dayKey);
      if (!dayEntry) {
        dayEntry = { dayKey, dayNet: 0, txs: [] };
        monthEntry.daysMap.set(dayKey, dayEntry);
      }

      dayEntry.txs.push(tx);

      let delta = 0;
      if (tx.type === 'income') delta = tx.amount;
      else if (tx.type === 'expense') delta = -tx.amount;

      monthEntry.monthNet += delta;
      dayEntry.dayNet += delta;
    }

    return Array.from(monthsMap.values()).map((m) => ({
      ...m,
      days: Array.from(m.daysMap.values()),
    }));
  }, [displayedTransactions]);

  const handleCopyLink = async () => {
    try {
      await syncFolderToCloud(folder);
      const url = generateShareUrl(folder);
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      showToast(isArabic ? 'تم نسخ رابط المشاركة!' : 'Share link copied!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast(isArabic ? 'تعذر نسخ الرابط' : 'Failed to copy link', 'error');
    }
  };

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths((prev) => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const toggleDay = (dayKey: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));
  };

  // Pre-Delete Review: calculates candidates, detects overlap with accounts/categories, and opens modal
  const initiatePreDeleteReview = (
    type: 'account' | 'category' | 'transaction',
    id: string,
    name: string,
    icon?: string
  ) => {
    if (!canEdit) {
      showToast(isArabic ? 'لا تملك صلاحية التعديل' : 'You do not have edit permission', 'error');
      return;
    }

    const allTxs = folder.payload?.transactions || [];
    const allAccounts = folder.payload?.accounts || [];
    const allCategories = folder.payload?.categories || [];

    let candidateTxs: Transaction[] = [];

    if (type === 'account') {
      candidateTxs = allTxs.filter((t) => t.accountId === id || t.toAccountId === id);
    } else if (type === 'category') {
      candidateTxs = allTxs.filter((t) => t.categoryId === id || t.categoryName === name);
    } else {
      const found = allTxs.find((t) => t.id === id);
      if (found) candidateTxs = [found];
    }

    // Overlap detection
    const candidates = candidateTxs.map((tx) => {
      const overlappingWith: Array<{ type: 'account' | 'category'; name: string; icon: string }> = [];

      // Check overlap with other included accounts
      for (const acc of allAccounts) {
        if (type === 'account' && acc.id === id) continue;
        if (tx.accountId === acc.id || tx.toAccountId === acc.id) {
          overlappingWith.push({
            type: 'account',
            name: acc.name,
            icon: acc.icon || '🏦',
          });
        }
      }

      // Check overlap with other included categories
      for (const cat of allCategories) {
        if (type === 'category' && (cat.id === id || cat.name === name)) continue;
        if (tx.categoryId === cat.id || tx.categoryName === cat.name) {
          overlappingWith.push({
            type: 'category',
            name: cat.name,
            icon: cat.icon || '🏷️',
          });
        }
      }

      return {
        tx,
        overlappingWith,
      };
    });

    setPreDeleteState({
      targetType: type,
      targetId: id,
      targetName: name,
      targetIcon: icon,
      candidates,
      selectedTxIds: new Set(candidateTxs.map((t) => t.id)),
      deleteFromPersonal: false,
    });
  };

  // Confirm Pre-Delete: removes items smartly, auto-cleans empty accounts/categories, and updates cloud
  const handleConfirmPreDelete = async () => {
    if (!preDeleteState) return;

    const { targetType, targetId, selectedTxIds, deleteFromPersonal } = preDeleteState;
    const deletedTxIds = Array.from(selectedTxIds);

    // Optional sync deletion from personal feed
    if (deleteFromPersonal) {
      for (const txId of deletedTxIds) {
        deleteTransaction(txId);
      }
    }

    const deletedAccountIds = targetType === 'account' ? [targetId] : [];
    const deletedCategoryIds = targetType === 'category' ? [targetId] : [];

    const updated = removeItemsFromShareFolderSmart(folder.id, {
      deletedAccountIds,
      deletedCategoryIds,
      deletedTxIds,
    });

    if (updated) {
      setFolder(updated);
    }

    if (activeEntityFilter?.id === targetId) {
      setActiveEntityFilter(null);
    }

    setPreDeleteState(null);

    showToast(
      isArabic
        ? 'تم حذف العناصر وتحديث المساحة المشتركة تلقائياً'
        : 'Items deleted and share space auto-updated',
      'success'
    );
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(txAmount);
    if (!amountVal || amountVal <= 0) {
      showToast(isArabic ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
      return;
    }

    const now = new Date();
    const newTx: Transaction = {
      id: `tx_shared_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description: txDescription.trim() || (isArabic ? 'معاملة مشاركة' : 'Shared Transaction'),
      amount: amountVal,
      type: txType,
      date: formatDateToYYYYMMDD(now),
      time: formatTimeToHHMM(now),
      accountId: accounts[0]?.id || 'acc_default',
      categoryName: categories[0]?.name || (txType === 'expense' ? 'General Expense' : 'General Income'),
      categoryIcon: categories[0]?.icon || (txType === 'expense' ? '💸' : '💰'),
      createdAt: Date.now(),
    };

    // 1. Sync to Shared Folder
    const updated = addTransactionToShareFolder(folder.id, newTx);
    if (updated) setFolder(updated);

    // 2. Sync to Personal Home feed (as clarified by user in Phase 1)
    addTransaction(newTx);

    setTxAmount('');
    setTxDescription('');
    setIsAddTxOpen(false);
    showToast(
      isArabic
        ? 'تمت إضافة المعاملة ومزامنتها مع الشير وحسابك الشخصي!'
        : 'Transaction added and synced with both Share and Personal feed!',
      'success'
    );
  };



  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = cleanNumericId(selectedMemberUser?.numericId || newMemberId);
    if (cleanId.length !== 16) {
      showToast(isArabic ? 'يرجى اختيار مستخدم صالح أولاً' : 'Please select a valid user first', 'error');
      return;
    }

    setIsSubmittingMember(true);
    const res = await addMemberToShareFolder(
      folder.id,
      cleanId,
      newMemberName.trim() || selectedMemberUser?.name,
      'viewer',
      selectedMemberUser?.avatar,
      selectedMemberUser?.photoURL
    );
    setIsSubmittingMember(false);

    if (res.success && res.folder) {
      setFolder(res.folder);
      setNewMemberId('');
      setNewMemberName('');
      setSelectedMemberUser(null);
      setIsAddMemberOpen(false);
      showToast(
        res.cloudSynced === false
          ? (isArabic
              ? 'تمت إضافة العضو بنجاح محلياً! (بانتظار تحديث صلاحيات قواعد Firebase للمزامنة السحابية)'
              : 'Member added locally! (Firebase RTDB rules update needed for cloud sync)')
          : (isArabic
              ? 'تمت إضافة العضو وإرسال الدعوة لحظياً!'
              : 'Member added and invite sent instantly!'),
        res.cloudSynced === false ? 'info' : 'success'
      );
    } else {
      showToast(res.error || (isArabic ? 'فشلت إضافة العضو' : 'Failed to add member'), 'error');
    }
  };

  const handleImportAll = () => {
    const res = importSharedItems({
      accounts,
      categories,
      transactions,
    });
    showToast(
      isArabic
        ? `تم استيراد كافة عناصر الشير إلى حسابك الشخصي (${res.accountsCount} حسابات، ${res.categoriesCount} تصنيفات، ${res.txsCount} معاملات)!`
        : `Imported all share items to your personal feed (${res.accountsCount} accounts, ${res.categoriesCount} categories, ${res.txsCount} transactions)!`,
      'success'
    );
  };

  const handleLeaveShare = async () => {
    const ok = await showConfirm({
      title: isArabic ? 'مغادرة صفحة المشاركة' : 'Leave Share Space',
      message: isArabic
        ? `هل أنت متأكد من مغادرة شير "${folder.name}"؟ ستفقد إمكانية الوصول إلى هذه العناصر إلا إذا تمت دعوتك مجدداً.`
        : `Are you sure you want to leave "${folder.name}"? You will lose access unless invited again.`,
      confirmLabel: isArabic ? 'نعم، مغادرة' : 'Yes, Leave',
      cancelLabel: isArabic ? 'إلغاء' : 'Cancel',
      isDanger: true,
    });
    if (!ok) return;

    await leaveShareFolder(folder.id, myCleanNumericId);
    showToast(isArabic ? 'تمت مغادرة المشاركة بنجاح' : 'Left share successfully', 'info');
    onExit();
  };

  return (
    <div
      role="region"
      aria-label="Share Detail View"
      className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-y-auto animate-in fade-in"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-none md:max-w-7xl landscape:max-w-none mx-auto min-h-screen flex flex-col bg-black pb-20">
        {/* Top Header Bar: Styled Identically to HomeView Header */}
        <header className="sticky top-0 z-20 h-16 px-4 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onExit}
              aria-label="Go Back"
              className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 border border-zinc-800"
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">{folder.icon || '📁'}</span>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white truncate leading-tight">
                  {folder.name}
                </h1>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="truncate">
                    {isOwner ? (isArabic ? 'أنت المالك' : 'Owned by You') : `${isArabic ? 'المالك:' : 'Owner:'} ${folder.ownerName}`}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'رابط' : 'Link')}</span>
            </button>

            {isOwner && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditSpace(e);
                }}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title={isArabic ? 'إعدادات المساحة' : 'Space Settings'}
                aria-label={isArabic ? 'إعدادات المساحة' : 'Space Settings'}
              >
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">{isArabic ? 'الإعدادات' : 'Settings'}</span>
              </button>
            )}

            {!isOwner && (
              <>
                <button
                  type="button"
                  onClick={handleImportAll}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'استيراد للكل' : 'Import All'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLeaveShare}
                  className="px-2.5 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  title={isArabic ? 'مغادرة المشاركة' : 'Leave Share'}
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>{isArabic ? 'مغادرة' : 'Leave'}</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="p-4 space-y-4 flex-1">
          {/* Summary Metric Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{isArabic ? 'إجمالي الرصيد بالشير' : 'Total Share Balance'}</span>
              <span className="font-mono text-[11px] bg-zinc-800/80 px-2 py-0.5 rounded-full text-zinc-300">
                {folder.itemCount} {isArabic ? 'عنصر' : 'items'}
              </span>
            </div>
            <div className="text-3xl font-black font-mono tracking-tight text-white">
              {formatCurrency(totalBalance, currencySymbol, isArabic ? 'ar' : 'en')}
            </div>
          </div>

          {/* Members Bar - Two-Row Layout */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-3">
            {/* Row 1: Title on left, Action buttons on right */}
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-bold text-zinc-200 truncate">
                  {isArabic ? 'الأعضاء المشاركون' : 'Share Members'} ({folder.members.length + 1})
                </span>
              </div>

              {isOwner && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {folder.members.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsManageMembersOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-zinc-800"
                    >
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isArabic ? 'إدارة' : 'Manage'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm shadow-purple-950/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'إضافة عضو' : 'Add Member'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Row 2: Full-width horizontal list of member chips/avatars */}
            <div className="w-full overflow-x-auto pt-3 pb-1 flex items-center gap-2.5 no-scrollbar">
              {/* Owner Chip */}
              <div
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-950/70 border border-blue-500/30 shrink-0"
                title={`${folder.ownerName || 'Owner'} (${isArabic ? 'المالك' : 'Owner'})`}
              >
                <div className="shrink-0 w-10 h-10 rounded-full overflow-visible relative bg-blue-600/30 border border-blue-500/60 flex items-center justify-center text-xs font-bold text-blue-300">
                  {folder.ownerPhotoURL ? (
                    <img
                      src={folder.ownerPhotoURL}
                      alt={folder.ownerName}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span>{folder.ownerAvatar || getMemberInitials(folder.ownerName, folder.ownerNumericId)}</span>
                  )}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-zinc-900"
                    title={isArabic ? 'المالك' : 'Owner'}
                  />
                </div>
                <div className="flex flex-col min-w-0 pr-1 rtl:pr-0 rtl:pl-1">
                  <span className="text-xs font-bold text-white max-w-[120px] truncate leading-tight">
                    {folder.ownerName || 'Owner'}
                  </span>
                  <span className="text-[10px] font-semibold text-blue-400 leading-tight mt-0.5">
                    {isArabic ? 'المالك' : 'Owner'}
                  </span>
                </div>
              </div>

              {/* Members Chips */}
              {folder.members.map((m) => {
                const isCurrent = cleanNumericId(m.numericId) === myCleanNumericId;
                const isAccepted = m.status === 'accepted' || (m.status as string) === 'active';
                return (
                  <div
                    key={m.numericId}
                    onClick={() => isOwner && setIsManageMembersOpen(true)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 shrink-0 ${
                      isOwner ? 'cursor-pointer hover:border-purple-500/50 transition' : ''
                    }`}
                    title={`${m.name} (${m.role})`}
                  >
                    <div
                      className={`shrink-0 w-10 h-10 rounded-full overflow-visible relative flex items-center justify-center text-xs font-bold text-white border ${
                        isAccepted ? 'border-purple-500/60' : 'border-amber-500/60'
                      } bg-gradient-to-tr ${getAvatarColorGradient(m.numericId || m.name)}`}
                    >
                      {m.photoURL ? (
                        <img
                          src={m.photoURL}
                          alt={m.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : m.avatar && m.avatar !== '👤' ? (
                        <span className="text-base">{m.avatar}</span>
                      ) : (
                        <span>{getMemberInitials(m.name, m.numericId)}</span>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                          isAccepted ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={isAccepted ? 'Active' : 'Pending'}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 pr-1 rtl:pr-0 rtl:pl-1">
                      <span className="text-xs font-bold text-white max-w-[120px] truncate leading-tight">
                        {m.name || 'Member'}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-semibold text-zinc-400 capitalize leading-tight">
                          {m.role === 'editor'
                            ? isArabic
                              ? 'محرر'
                              : 'Editor'
                            : isArabic
                            ? 'مشاهد'
                            : 'Viewer'}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold leading-tight">
                            {isArabic ? 'أنت' : 'You'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Toolbar if Editor */}
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddTxOpen(true)}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isArabic ? 'تسجيل معاملة في هذا الشير' : 'Add Transaction in this Share'}</span>
              </button>
            </div>
          )}

          {/* CONTROL SECTION: Included Accounts & Categories */}
          {(accounts.length > 0 || categories.length > 0) && (
            <div className="p-4 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    {isArabic ? 'الحسابات والتصنيفات المضمنة' : 'Included Accounts & Categories'}
                  </h3>
                </div>
                {activeEntityFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveEntityFilter(null)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'عرض كافة المعاملات' : 'Show All'}</span>
                  </button>
                )}
              </div>

              {/* Accounts Bar */}
              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isArabic ? 'الحسابات المضمنة' : 'Included Accounts'} ({accounts.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((acc) => {
                      const accTxs = transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id);
                      const isSelected = activeEntityFilter?.type === 'account' && activeEntityFilter?.id === acc.id;

                      return (
                        <div
                          key={acc.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-blue-200 ring-1 ring-blue-500/50 shadow-sm'
                              : 'bg-zinc-950/80 hover:bg-zinc-850 border-zinc-800 text-zinc-200'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setActiveEntityFilter(null);
                            } else {
                              setActiveEntityFilter({
                                type: 'account',
                                id: acc.id,
                                name: acc.name,
                                icon: acc.icon || '🏦',
                              });
                            }
                          }}
                        >
                          <span className="text-xl">{acc.icon || '🏦'}</span>
                          <div className="min-w-0">
                            <span className="font-bold block leading-tight truncate max-w-[130px] sm:max-w-xs">{acc.name}</span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {formatCurrency(acc.balance, currencySymbol, isArabic ? 'ar' : 'en')} · {accTxs.length} {isArabic ? 'معاملة' : 'txs'}
                            </span>
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                initiatePreDeleteReview('account', acc.id, acc.name, acc.icon);
                              }}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer rtl:mr-1 ltr:ml-1 shrink-0"
                              title={isArabic ? 'إزالة الحساب من الشير' : 'Remove Account from Share'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Categories Bar */}
              {categories.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-zinc-800/60">
                  <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isArabic ? 'التصنيفات المضمنة' : 'Included Categories'} ({categories.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const catTxs = transactions.filter(
                        (t) => t.categoryId === cat.id || t.categoryName === cat.name
                      );
                      const isSelected = activeEntityFilter?.type === 'category' && activeEntityFilter?.id === cat.id;

                      return (
                        <div
                          key={cat.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/50 shadow-sm'
                              : 'bg-zinc-950/80 hover:bg-zinc-850 border-zinc-800 text-zinc-200'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setActiveEntityFilter(null);
                            } else {
                              setActiveEntityFilter({
                                type: 'category',
                                id: cat.id,
                                name: cat.name,
                                icon: cat.icon || '🏷️',
                              });
                            }
                          }}
                        >
                          <span className="text-xl">{cat.icon || '🏷️'}</span>
                          <div className="min-w-0">
                            <span className="font-bold block leading-tight truncate max-w-[130px] sm:max-w-xs">{cat.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              {catTxs.length} {isArabic ? 'معاملة' : 'txs'}
                            </span>
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                initiatePreDeleteReview('category', cat.id, cat.name, cat.icon);
                              }}
                              className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer rtl:mr-1 ltr:ml-1 shrink-0"
                              title={isArabic ? 'إزالة التصنيف من الشير' : 'Remove Category from Share'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Filter Pill if Filtering by specific entity */}
          {activeEntityFilter && (
            <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-blue-300 min-w-0">
                <Filter className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                <span className="truncate">
                  {isArabic ? 'تصفية حسب:' : 'Filtered by:'}{' '}
                  <span className="font-bold text-white">
                    {activeEntityFilter.icon} {activeEntityFilter.name}
                  </span>{' '}
                  ({displayedTransactions.length} {isArabic ? 'معاملة' : 'txs'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveEntityFilter(null)}
                className="px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
                <span>{isArabic ? 'إلغاء التصفية' : 'Clear'}</span>
              </button>
            </div>
          )}

          {/* SECTION: Timeline Grouped Identically to HomeView by Months and Days */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>{isArabic ? 'الجدول الزمني للمعاملات' : 'Transaction Timeline'}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  ({displayedTransactions.length})
                </span>
              </h3>
            </div>

            {displayedTransactions.length === 0 ? (
              <div className="py-12 px-4 rounded-3xl bg-zinc-900/40 border border-zinc-850 text-center text-xs text-zinc-500 space-y-1">
                <p className="font-medium text-zinc-400">
                  {activeEntityFilter
                    ? (isArabic
                        ? `لا توجد معاملات مسجلة مرتبطة بـ "${activeEntityFilter.name}"`
                        : `No transactions found for "${activeEntityFilter.name}"`)
                    : (isArabic
                        ? 'لا توجد معاملات في هذه المساحة المشتركة بعد'
                        : 'No transactions inside this share space yet')}
                </p>
                {activeEntityFilter && (
                  <button
                    type="button"
                    onClick={() => setActiveEntityFilter(null)}
                    className="text-blue-400 hover:text-blue-300 font-semibold pt-1 underline cursor-pointer"
                  >
                    {isArabic ? 'عرض كافة المعاملات' : 'Show All Transactions'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedData.map((monthGroup) => {
                  const isMonthCollapsed = Boolean(collapsedMonths[monthGroup.monthKey]);
                  const monthTitle = getMonthHeaderTitle(monthGroup.monthKey, isArabic ? 'ar' : 'en');
                  const isMonthPositive = monthGroup.monthNet >= 0;

                  return (
                    <div
                      key={monthGroup.monthKey}
                      className="rounded-3xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-lg"
                    >
                      {/* Month Header with Monthly Total */}
                      <button
                        type="button"
                        onClick={() => toggleMonth(monthGroup.monthKey)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/90 hover:bg-zinc-850 text-start transition border-b border-zinc-800/60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-bold text-white text-sm">
                          {isMonthCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-zinc-400 rtl:rotate-90 ltr:-rotate-90" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                          <span>{monthTitle}</span>
                        </div>
                        <div
                          className={`text-xs font-mono font-bold ${
                            isMonthPositive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isMonthPositive ? '+' : ''}
                          {formatCurrency(monthGroup.monthNet, currencySymbol, isArabic ? 'ar' : 'en')}
                        </div>
                      </button>

                      {/* Days list inside Month */}
                      {!isMonthCollapsed && (
                        <div className="p-2 sm:p-3 space-y-3">
                          {monthGroup.days.map((dayGroup) => {
                            const isDayCollapsed = Boolean(collapsedDays[dayGroup.dayKey]);
                            const dayTitle = getDayHeaderTitle(dayGroup.dayKey, isArabic ? 'ar' : 'en');
                            const isDayPositive = dayGroup.dayNet >= 0;

                            return (
                              <div
                                key={dayGroup.dayKey}
                                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/60 overflow-hidden"
                              >
                                {/* Day Header with Daily Total */}
                                <button
                                  type="button"
                                  onClick={() => toggleDay(dayGroup.dayKey)}
                                  className="w-full flex items-center justify-between px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-850 text-start transition border-b border-zinc-800/40 cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 font-semibold text-xs text-zinc-300">
                                    {isDayCollapsed ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500 rtl:rotate-90 ltr:-rotate-90" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                                    )}
                                    <span>{dayTitle}</span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      ({dayGroup.txs.length})
                                    </span>
                                  </div>
                                  <div
                                    className={`text-[11px] font-mono font-bold ${
                                      isDayPositive ? 'text-emerald-400' : 'text-red-400'
                                    }`}
                                  >
                                    {isDayPositive ? '+' : ''}
                                    {formatCurrency(dayGroup.dayNet, currencySymbol, isArabic ? 'ar' : 'en')}
                                  </div>
                                </button>

                                {/* Day Transactions */}
                                {!isDayCollapsed && (
                                  <div className="p-1.5 space-y-1">
                                    {dayGroup.txs.map((tx) => (
                                      <div
                                        key={tx.id}
                                        className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/60 flex items-center justify-between transition group"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-sm shrink-0">
                                            {tx.categoryIcon || '💸'}
                                          </div>
                                          <div className="min-w-0">
                                            <span className="text-xs font-semibold text-white block truncate">
                                              {tx.description || tx.categoryName}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                              <span className="truncate">{tx.categoryName}</span>
                                              {tx.time && (
                                                <>
                                                  <span>·</span>
                                                  <span className="font-mono text-zinc-500">
                                                    {formatTime12h(tx.time, isArabic ? 'ar' : 'en')}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <span
                                            className={`font-mono text-xs font-bold ${
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

                                          {canEdit && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                initiatePreDeleteReview(
                                                  'transaction',
                                                  tx.id,
                                                  tx.description || tx.categoryName || 'Transaction',
                                                  tx.categoryIcon
                                                )
                                              }
                                              className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                                              title={isArabic ? 'حذف المعاملة' : 'Delete Transaction'}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Quick Add Transaction */}
      {isAddTxOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={() => setIsAddTxOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto my-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              <span>{isArabic ? 'إضافة معاملة للشير' : 'Add Transaction to Share'}</span>
            </h3>

            <form onSubmit={handleAddTransaction} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    txType === 'expense' ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {isArabic ? 'مصروف' : 'Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    txType === 'income' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {isArabic ? 'دخل' : 'Income'}
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  {isArabic ? 'المبلغ' : 'Amount'}
                </label>
                <input
                  type="number"
                  step="any"
                  autoFocus
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  {isArabic ? 'الوصف' : 'Description'}
                </label>
                <input
                  type="text"
                  placeholder={isArabic ? 'مثال: مشتريات السوبرماركت' : 'e.g., Grocery Shopping'}
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold transition"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
                >
                  {isArabic ? 'حفظ المعاملة' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member by 16-Digit ID */}
      {isAddMemberOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={() => {
            setIsAddMemberOpen(false);
            setSelectedMemberUser(null);
            setNewMemberId('');
            setNewMemberName('');
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto my-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>{isArabic ? 'إضافة عضو بالمعرّف الرقمي' : 'Add Member by User ID'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddMemberOpen(false);
                  setSelectedMemberUser(null);
                  setNewMemberId('');
                  setNewMemberName('');
                }}
                className="p-1.5 rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {isArabic
                ? 'أدخل المعرّف المكوّن من 16 رقماً للبحث والتحقق من المستخدم، وسيظهر اسمه وصورته لتأكيد اختياره قبل الإرسال.'
                : 'Enter the 16-digit ID to search and verify the user. Their verified name and photo will appear for confirmation before inviting.'}
            </p>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <UserSearchPicker
                selectedUser={selectedMemberUser}
                onSelectUser={(u) => {
                  setSelectedMemberUser(u);
                  if (u) {
                    setNewMemberId(u.numericId);
                    setNewMemberName(u.name);
                  } else {
                    setNewMemberId('');
                    setNewMemberName('');
                  }
                }}
                onVerifyingChange={setIsVerifyingMember}
                currentUserId={myCleanNumericId}
                accentColor="purple"
                isArabic={isArabic}
                autoFocus
              />

              {selectedMemberUser && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="text-xs text-zinc-300 font-bold block">
                    {isArabic ? 'اسم أو لقب العضو (اختياري):' : 'Member Name or Nickname (optional):'}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    placeholder={selectedMemberUser.name || (isArabic ? 'مثال: أحمد، سارة...' : 'e.g. Ahmed, Sarah...')}
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMemberOpen(false);
                    setSelectedMemberUser(null);
                    setNewMemberId('');
                    setNewMemberName('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold transition cursor-pointer"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMember || isVerifyingMember || !selectedMemberUser}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 ${
                    selectedMemberUser && !isVerifyingMember && !isSubmittingMember
                      ? 'bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-purple-900/30 active:scale-95'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  {isSubmittingMember ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isArabic ? 'جارٍ الإرسال...' : 'Sending...'}</span>
                    </>
                  ) : isVerifyingMember ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                      <span>{isArabic ? 'جارٍ التحقق...' : 'Verifying...'}</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {selectedMemberUser
                          ? (isArabic ? `تأكيد وإضافة ${selectedMemberUser.name || 'العضو'}` : `Confirm & Add ${selectedMemberUser.name || 'Member'}`)
                          : (isArabic ? 'إرسال الدعوة' : 'Send Invite')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Member Management (Item 7) */}
      {isManageMembersOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={() => setIsManageMembersOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] my-auto flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isArabic ? 'إدارة الأعضاء والطلبات' : 'Manage Members & Requests'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {folder.members.length} {isArabic ? 'أعضاء في هذه المشاركة' : 'members in this share'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && folder.members.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = await showConfirm({
                        title: isArabic ? 'إفراغ جميع الأعضاء' : 'Remove All Members',
                        message: isArabic
                          ? 'هل تريد بالتأكيد إزالة جميع الأعضاء من صفحة المشاركة هذه والبدء من جديد؟'
                          : 'Are you sure you want to remove all members from this share and start fresh?',
                        confirmLabel: isArabic ? 'نعم، إفراغ الكل' : 'Remove All',
                        cancelLabel: isArabic ? 'تراجع' : 'Cancel',
                        isDanger: true,
                      });
                      if (!confirmed) return;
                      const res = await removeAllMembersFromShareFolder(folder.id);
                      if (res.success && res.folder) {
                        setFolder(res.folder);
                        showToast(isArabic ? 'تمت إزالة جميع الأعضاء بنجاح' : 'All members removed', 'success');
                      }
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 transition cursor-pointer"
                  >
                    {isArabic ? 'إفراغ الأعضاء' : 'Clear All'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsManageMembersOpen(false)}
                  className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 overscroll-contain">
              {/* Owner Display */}
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-sm font-bold text-blue-300 shrink-0 overflow-hidden">
                    {folder.ownerPhotoURL ? (
                      <img src={folder.ownerPhotoURL} alt={folder.ownerName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{folder.ownerAvatar || '👑'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                      <span>{folder.ownerName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                        {isArabic ? 'المالك' : 'Owner'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono mt-0.5">
                      {format16DigitId(folder.ownerNumericId)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Members List */}
              {folder.members.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-400">
                  {isArabic ? 'لا يوجد أعضاء مضافون حتى الآن. اضغط على "إضافة عضو" لمشاركة الصفحة.' : 'No members added yet. Click "Add Member" to share.'}
                </div>
              ) : (
                folder.members.map((m) => {
                  const isCurrentMember = cleanNumericId(m.numericId) === myCleanNumericId;
                  return (
                    <div
                      key={m.numericId}
                      className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full border border-purple-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarColorGradient(
                            m.numericId || m.name
                          )}`}
                        >
                          {m.photoURL ? (
                            <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" />
                          ) : m.avatar && m.avatar !== '👤' ? (
                            <span className="text-base">{m.avatar}</span>
                          ) : (
                            <span>{getMemberInitials(m.name, m.numericId)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                            {editingMemberId === m.numericId ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingMemberName}
                                  onChange={(e) => setEditingMemberName(e.target.value)}
                                  maxLength={30}
                                  className="px-2 py-0.5 rounded-lg bg-zinc-800 border border-purple-500 text-xs text-white focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (editingMemberName.trim()) {
                                      const res = await updateMemberDetailsInShareFolder(folder.id, m.numericId, {
                                        name: editingMemberName.trim(),
                                      });
                                      if (res.success && res.folder) {
                                        setFolder(res.folder);
                                      }
                                    }
                                    setEditingMemberId(null);
                                  }}
                                  className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                  title="Save"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(null)}
                                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span>{m.name}</span>
                                {isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMemberId(m.numericId);
                                      setEditingMemberName(m.name);
                                    }}
                                    className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                                    title={isArabic ? 'تعديل اسم أو لقب العضو' : 'Edit Member Name'}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </>
                            )}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {isArabic ? 'نشط' : 'Active'}
                            </span>
                            {isCurrentMember && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                                {isArabic ? 'أنت' : 'You'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                            {format16DigitId(m.numericId)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role Selector / Toggle for Owner */}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={async () => {
                              const nextRole = m.role === 'editor' ? 'viewer' : 'editor';
                              const res = await updateMemberRoleInShareFolder(folder.id, m.numericId, nextRole);
                              if (res.success && res.folder) {
                                setFolder(res.folder);
                                showToast(
                                  isArabic
                                    ? `تم تغيير صلاحية "${m.name}" إلى: ${nextRole === 'editor' ? 'محرر (تعديل)' : 'مشاهد (قراءة فقط)'}`
                                    : `Changed role for "${m.name}" to: ${nextRole === 'editor' ? 'Editor' : 'Viewer'}`,
                                  'info'
                                );
                              }
                            }}
                            className={`px-2 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                              m.role === 'editor'
                                ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                            }`}
                            title={isArabic ? 'تبديل الصلاحية بين محرر ومشاهد' : 'Toggle between Editor and Viewer'}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{m.role === 'editor' ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}</span>
                          </button>
                        )}

                        {/* Read-only Role Badge for Non-Owner */}
                        {!isOwner && (
                          <span
                            className={`px-2 py-1 rounded-xl text-xs font-semibold border flex items-center gap-1 ${
                              m.role === 'editor'
                                ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            <span>{m.role === 'editor' ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}</span>
                          </span>
                        )}

                        {/* Leave Button for Current Member */}
                        {!isOwner && isCurrentMember && (
                          <button
                            type="button"
                            onClick={handleLeaveShare}
                            className="px-2.5 py-1 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title={isArabic ? 'مغادرة المشاركة' : 'Leave Share'}
                          >
                            <LogOut className="w-3 h-3 text-red-400" />
                            <span>{isArabic ? 'مغادرة' : 'Leave'}</span>
                          </button>
                        )}

                        {/* Remove Member for Owner with 5s Undo */}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={async () => {
                              const confirmed = await showConfirm({
                                title: isArabic ? 'استبعاد العضو' : 'Remove Member',
                                message: isArabic
                                  ? `هل تريد بالتأكيد استبعاد العضو "${m.name}" من هذه المشاركة؟`
                                  : `Are you sure you want to remove member "${m.name}" from this share?`,
                                confirmLabel: isArabic ? 'تأكيد الاستبعاد' : 'Confirm',
                                cancelLabel: isArabic ? 'تراجع' : 'Cancel',
                                isDanger: true,
                              });
                              if (!confirmed) return;

                              const backupMember = { ...m };
                              const res = await removeMemberFromShareFolder(folder.id, m.numericId);
                              if (res.success && res.folder) {
                                setFolder(res.folder);
                                showToast(
                                  isArabic ? `تم استبعاد "${m.name}" بنجاح` : `Member "${m.name}" removed`,
                                  'info',
                                  {
                                    label: isArabic ? 'تراجع' : 'Undo',
                                    onClick: async () => {
                                      await addMemberToShareFolder(folder.id, backupMember.numericId, backupMember.name, backupMember.role);
                                      showToast(isArabic ? 'تمت استعادة العضو بنجاح' : 'Member restored', 'success');
                                    },
                                  },
                                  5000
                                );
                              }
                            }}
                            className="p-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/30 transition cursor-pointer"
                            title={isArabic ? 'استبعاد العضو' : 'Remove Member'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsManageMembersOpen(false);
                  setIsAddMemberOpen(true);
                }}
                className="w-full py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>{isArabic ? 'إضافة عضو جديد بالمعرّف الرقمي' : 'Add New Member by ID'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pre-Delete Review with Overlap Detection & Empty Entity Smart Cleanup */}
      {preDeleteState && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in overscroll-contain"
          onClick={() => setPreDeleteState(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto my-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {isArabic ? 'مراجعة العناصر قبل الحذف' : 'Pre-Delete Review'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isArabic ? 'أنت بصدد حذف:' : 'Deleting:'}{' '}
                    <span className="font-semibold text-zinc-200">
                      {preDeleteState.targetIcon || ''} {preDeleteState.targetName}
                    </span>{' '}
                    <span className="text-[11px] text-zinc-500">
                      ({preDeleteState.targetType === 'account'
                        ? isArabic ? 'حساب' : 'Account'
                        : preDeleteState.targetType === 'category'
                        ? isArabic ? 'تصنيف' : 'Category'
                        : isArabic ? 'معاملة' : 'Transaction'})
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreDeleteState(null)}
                className="p-1.5 rounded-full hover:bg-zinc-850 text-zinc-400 hover:text-white transition cursor-pointer"
                title={isArabic ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overlap Summary Warning if any overlapping transactions exist */}
            {preDeleteState.candidates.some((c) => c.overlappingWith.length > 0) && (
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <div className="font-bold">
                    {isArabic ? 'تنبيه المعاملات المتداخلة / المشتركة:' : 'Overlapping / Shared Transactions Warning:'}
                  </div>
                  <div>
                    {isArabic
                      ? 'بعض المعاملات أدناه مرتبطة بحسابات أو تصنيفات أخرى مضمنة بالشير. تم تمييزها بشارة تحذير باللون البرتقالي لتراجعها بدقة قبل التأكيد.'
                      : 'Some transactions below link to other included accounts or categories in this share. They are highlighted with an orange warning badge for careful review.'}
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Transactions List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {isArabic ? 'المعاملات المتأثرة بالحذف' : 'Transactions Affected by Deletion'}{' '}
                  ({preDeleteState.selectedTxIds.size} / {preDeleteState.candidates.length})
                </span>
                {preDeleteState.candidates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (preDeleteState.selectedTxIds.size === preDeleteState.candidates.length) {
                        setPreDeleteState((prev) => (prev ? { ...prev, selectedTxIds: new Set() } : null));
                      } else {
                        setPreDeleteState((prev) =>
                          prev
                            ? {
                                ...prev,
                                selectedTxIds: new Set(prev.candidates.map((c) => c.tx.id)),
                              }
                            : null
                        );
                      }
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    {preDeleteState.selectedTxIds.size === preDeleteState.candidates.length
                      ? (isArabic ? 'إلغاء تحديد الكل' : 'Deselect All')
                      : (isArabic ? 'تحديد الكل' : 'Select All')}
                  </button>
                )}
              </div>

              {preDeleteState.candidates.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-400">
                  {isArabic
                    ? 'لا توجد معاملات مسجلة مرتبطة بهذا العنصر في هذه المساحة المشتركة.'
                    : 'No recorded transactions associated with this entity in this share.'}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {preDeleteState.candidates.map(({ tx, overlappingWith }) => {
                    const isChecked = preDeleteState.selectedTxIds.has(tx.id);
                    const hasOverlap = overlappingWith.length > 0;

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setPreDeleteState((prev) => {
                            if (!prev) return null;
                            const nextSet = new Set(prev.selectedTxIds);
                            if (nextSet.has(tx.id)) {
                              nextSet.delete(tx.id);
                            } else {
                              nextSet.add(tx.id);
                            }
                            return { ...prev, selectedTxIds: nextSet };
                          });
                        }}
                        className={`p-3 rounded-2xl border transition cursor-pointer select-none space-y-1.5 ${
                          isChecked
                            ? 'bg-zinc-900/90 border-zinc-700'
                            : 'bg-zinc-950/40 border-zinc-850 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                            />
                            <span className="text-base">{tx.categoryIcon || '💸'}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white block truncate">
                                {tx.description || tx.categoryName}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {tx.date} {tx.time ? `· ${formatTime12h(tx.time, isArabic ? 'ar' : 'en')}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs font-mono font-bold shrink-0">
                            <span className={tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}>
                              {tx.type === 'income' ? '+' : '-'}
                              {formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                            </span>
                          </div>
                        </div>

                        {/* Overlap Badge */}
                        {hasOverlap && (
                          <div className="flex flex-wrap gap-1 pt-1 rtl:pr-6 ltr:pl-6">
                            {overlappingWith.map((ov, oIdx) => (
                              <span
                                key={oIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/50 text-[10px] font-semibold text-amber-300"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>
                                  {isArabic ? 'مشتركة مع' : 'Shared with'}: {ov.icon} {ov.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Automatic Cleanup Info Banner (Requirement 4) */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                {isArabic
                  ? 'تنظيف تلقائي ذكي: في حال تم حذف جميع المعاملات التابعة لأي حساب أو تصنيف داخل الشير، فسيتم حذفه تلقائياً من المساحة لمنع وجود عناصر فارغة.'
                  : 'Smart auto-cleanup: If all transactions belonging to an Account or Category inside this share are deleted, it will be automatically removed from the Share Space.'}
              </span>
            </div>

            {/* Delete from Personal Feed Checkbox */}
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-850 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preDeleteState.deleteFromPersonal}
                onChange={(e) => {
                  const val = e.target.checked;
                  setPreDeleteState((prev) => (prev ? { ...prev, deleteFromPersonal: val } : null));
                }}
                className="w-4 h-4 rounded text-red-600 focus:ring-0 bg-zinc-800 border-zinc-700"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-200 block">
                  {isArabic ? 'حذف المعاملات أيضاً من حسابي الشخصي' : 'Also delete transactions from my personal account'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {isArabic
                    ? 'إذا لم يتم التحديد، فستُحذف فقط من الشير وتبقى آمنة في سجلك الشخصي'
                    : 'If unchecked, items will be removed only from this share and remain safe in your feed'}
                </span>
              </div>
            </label>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setPreDeleteState(null)}
                className="flex-1 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                {isArabic ? 'إلغاء وتراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPreDelete}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isArabic ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Share Space Settings Modal - High Priority Layer */}
      {activeSettingsSpace && (
        <ShareSpaceSettingsModal
          isOpen={!!activeSettingsSpace}
          onClose={handleCloseEditSpace}
          folder={activeSettingsSpace}
          onUpdated={(updated) => {
            setFolder(updated);
            handleCloseEditSpace();
          }}
          onDeleted={() => {
            handleCloseEditSpace();
            onExit();
          }}
        />
      )}
    </div>
  );
};
