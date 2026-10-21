import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import { format16DigitId, cleanNumericId, format16DigitInput } from '../utils/userId';
import { UserSearchPicker } from './UserSearchPicker';
import {
  ShareFolder,
  ShareMember,
  subscribeToShareFolder,
  fetchShareFolderFromCloud,
  addTransactionToShareFolder,
  removeItemFromShareFolder,
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
import { formatCurrency, formatDateToYYYYMMDD, formatTimeToHHMM } from '../utils/dateCycle';

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
  } = useApp();

  const isArabic = settings.language === 'ar';
  const currencySymbol = settings.currencySymbol || '£';
  const myCleanNumericId = cleanNumericId(settings.userProfile?.numericId || '');

  const [folder, setFolder] = useState<ShareFolder>(initialFolder);
  const [isCopied, setIsCopied] = useState(false);

  // Accordion collapsed state for accounts and categories
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  // Quick Add Transaction Modal inside Share View
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');

  // Add Member State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [selectedMemberUser, setSelectedMemberUser] = useState<any>(null);
  const [isVerifyingMember, setIsVerifyingMember] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState('');

  // Dedicated Transaction Deletion Options Modal State with Explicit Exit & Cancel
  const [deleteTxTarget, setDeleteTxTarget] = useState<{
    id: string;
    description: string;
    amount: number;
    type: string;
  } | null>(null);

  // Dual Sync 1: Subscribe to real-time updates for this folder from Firebase RTDB
  useEffect(() => {
    if (!initialFolder.id) return;
    const unsub = subscribeToShareFolder(initialFolder.id, (liveFolder) => {
      if (liveFolder) {
        setFolder(liveFolder);
      }
    });
    return () => unsub();
  }, [initialFolder.id]);

  // Dual Sync 2: Automatic 4-second periodic polling loop fetching active shared_accounts/share_${shareId}
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
              return live;
            }
            return prev;
          });
        }
      } catch (err) {
        // Quiet poll error handling
      }
    };

    const intervalId = setInterval(pollActiveShare, 4000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [initialFolder.id]);

  const isOwner = folder.ownerNumericId === myCleanNumericId;
  const myMemberEntry = folder.members.find((m) => m.numericId === myCleanNumericId);
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

  const toggleAccountAccordion = (id: string) => {
    setExpandedAccountIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategoryAccordion = (id: string) => {
    setExpandedCategoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const handleDeleteItem = async (
    itemType: 'account' | 'category' | 'transaction',
    itemId: string,
    itemName: string
  ) => {
    if (!canEdit) {
      showToast(isArabic ? 'لا تملك صلاحية التعديل' : 'You do not have edit permission', 'error');
      return;
    }

    // Phase 1 choice: when deleting from share, open dedicated options modal with explicit Cancel & Exit
    if (itemType === 'transaction') {
      const tx = folder.payload?.transactions?.find((t: Transaction) => t.id === itemId);
      setDeleteTxTarget({
        id: itemId,
        description: itemName || tx?.description || (isArabic ? 'معاملة بدون وصف' : 'Transaction'),
        amount: tx?.amount || 0,
        type: tx?.type || 'expense',
      });
      return;
    }

    // Accounts or Categories
    const ok = await showConfirm({
      title: isArabic ? 'إزالة العنصر من المشاركة' : 'Remove from Share',
      message: isArabic
        ? `هل تريد إزالة "${itemName}" من صفحة المشاركة؟`
        : `Remove "${itemName}" from this share folder?`,
      confirmText: isArabic ? 'إزالة' : 'Remove',
      isDanger: true,
    });
    if (!ok) return;

    const updated = removeItemFromShareFolder(folder.id, itemType, itemId);
    if (updated) setFolder(updated);
    showToast(isArabic ? 'تمت الإزالة من المشاركة' : 'Removed from share', 'info');
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
      <div className="w-full max-w-full md:max-w-5xl lg:max-w-6xl mx-auto min-h-screen flex flex-col bg-black pb-20">
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

          {/* Members Bar */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-200 block">
                  {isArabic ? 'الأعضاء المشاركون' : 'Share Members'} ({folder.members.length + 1})
                </span>
                <div className="flex items-center gap-1.5 mt-1 overflow-x-auto py-0.5">
                  {/* Owner avatar */}
                  <div
                    title={folder.ownerName}
                    className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0 overflow-hidden"
                  >
                    {folder.ownerPhotoURL ? (
                      <img src={folder.ownerPhotoURL} alt={folder.ownerName} className="w-full h-full object-cover" />
                    ) : (
                      <span>{folder.ownerAvatar || getMemberInitials(folder.ownerName, folder.ownerNumericId)}</span>
                    )}
                  </div>

                  {/* Members avatars */}
                  <div
                    onClick={() => isOwner && setIsManageMembersOpen(true)}
                    className={`flex items-center -space-x-1.5 rtl:space-x-reverse ${isOwner ? 'cursor-pointer hover:opacity-85 transition' : ''}`}
                    title={isOwner ? (isArabic ? 'إدارة الأعضاء' : 'Manage Members') : undefined}
                  >
                    {folder.members.map((m) => (
                      <div
                        key={m.numericId}
                        title={`${m.name} (${m.status})`}
                        className={`relative w-7 h-7 rounded-full border border-purple-500/50 flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarColorGradient(m.numericId || m.name)}`}
                      >
                        {m.photoURL ? (
                          <img src={m.photoURL} alt={m.name} className="w-full h-full object-cover" />
                        ) : m.avatar && m.avatar !== '👤' ? (
                          <span>{m.avatar}</span>
                        ) : (
                          <span>{getMemberInitials(m.name, m.numericId)}</span>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-black ${
                            m.status === 'accepted' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
                    <span>{isArabic ? 'إدارة الأعضاء' : 'Manage'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-zinc-700/60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إضافة عضو' : 'Add Member'}</span>
                </button>
              </div>
            )}
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

          {/* SECTION 1: Collapsible Full Accounts (Accordion Cards) */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-400" />
                <span>{isArabic ? 'الحسابات المضمنة' : 'Included Accounts'}</span>
              </h3>

              <div className="space-y-2">
                {accounts.map((acc) => {
                  const isExpanded = !!expandedAccountIds[acc.id];
                  const accTxs = transactions.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id);

                  return (
                    <div
                      key={acc.id}
                      className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-sm transition"
                    >
                      {/* Accordion Header Block */}
                      <div
                        onClick={() => toggleAccountAccordion(acc.id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-850 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{acc.icon}</span>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-white block truncate">
                              {acc.name}
                            </span>
                            <span className="text-xs font-mono text-zinc-400">
                              {formatCurrency(acc.balance, currencySymbol, isArabic ? 'ar' : 'en')} · {accTxs.length} {isArabic ? 'معاملة' : 'txs'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem('account', acc.id, acc.name);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                              title="Remove Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="text-zinc-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Accordion Expandable Content: Child Transactions */}
                      {isExpanded && (
                        <div className="p-3 bg-zinc-950/70 border-t border-zinc-850 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                          {accTxs.length === 0 ? (
                            <div className="text-xs text-zinc-500 py-3 text-center">
                              {isArabic ? 'لا توجد معاملات مسجلة لهذا الحساب' : 'No transactions recorded for this account'}
                            </div>
                          ) : (
                            accTxs.map((tx) => (
                              <div
                                key={tx.id}
                                className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span>{tx.categoryIcon || '💸'}</span>
                                  <div className="min-w-0">
                                    <span className="font-medium text-white truncate block">
                                      {tx.description}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      {tx.date}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`font-mono font-bold ${
                                    tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {tx.type === 'income' ? '+' : '-'}
                                  {formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: Collapsible Full Categories (Accordion Cards) */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
                <Tags className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isArabic ? 'التصنيفات المضمنة' : 'Included Categories'}</span>
              </h3>

              <div className="space-y-2">
                {categories.map((cat) => {
                  const isExpanded = !!expandedCategoryIds[cat.id];
                  const catTxs = transactions.filter(
                    (t) => t.categoryId === cat.id || t.categoryName === cat.name
                  );

                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-sm transition"
                    >
                      {/* Accordion Header Block */}
                      <div
                        onClick={() => toggleCategoryAccordion(cat.id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-850 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{cat.icon}</span>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-white block truncate">
                              {cat.name}
                            </span>
                            <span className="text-xs text-zinc-400">
                              {cat.type === 'expense'
                                ? isArabic
                                  ? 'مصروف'
                                  : 'Expense'
                                : isArabic
                                ? 'دخل'
                                : 'Income'}{' '}
                              · {catTxs.length} {isArabic ? 'معاملة' : 'txs'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem('category', cat.id, cat.name);
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                              title="Remove Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="text-zinc-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Accordion Expandable Content: Child Transactions */}
                      {isExpanded && (
                        <div className="p-3 bg-zinc-950/70 border-t border-zinc-850 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                          {catTxs.length === 0 ? (
                            <div className="text-xs text-zinc-500 py-3 text-center">
                              {isArabic ? 'لا توجد معاملات مسجلة لهذا التصنيف' : 'No transactions recorded for this category'}
                            </div>
                          ) : (
                            catTxs.map((tx) => (
                              <div
                                key={tx.id}
                                className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span>{tx.categoryIcon || '💸'}</span>
                                  <div className="min-w-0">
                                    <span className="font-medium text-white truncate block">
                                      {tx.description}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      {tx.date}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={`font-mono font-bold ${
                                    tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {tx.type === 'income' ? '+' : '-'}
                                  {formatCurrency(tx.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: Individual Transactions / Activity Feed */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>{isArabic ? 'كافة المعاملات والأنشطة' : 'All Transactions & Activity'}</span>
              <span className="font-mono text-[10px] text-zinc-500">({transactions.length})</span>
            </h3>

            {transactions.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-850 text-center text-xs text-zinc-500">
                {isArabic ? 'لا توجد معاملات في هذه المشاركة بعد' : 'No transactions inside this share space yet'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between hover:bg-zinc-850 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-base shrink-0">
                        {tx.categoryIcon || '💸'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-white block truncate">
                          {tx.description || tx.categoryName}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <span>{tx.categoryName}</span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{tx.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-sm font-bold ${
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
                          onClick={() => handleDeleteItem('transaction', tx.id, tx.description)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                          title="Remove Transaction"
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

      {/* Modal: Remove Transaction Options with Explicit Exit & Cancel Buttons */}
      {deleteTxTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
          onClick={() => setDeleteTxTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm max-h-[92dvh] overflow-y-auto my-auto bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4 relative"
            dir={isArabic ? 'rtl' : 'ltr'}
          >
            {/* Header with Exit (X) Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isArabic ? 'خيارات إزالة المعاملة' : 'Remove Transaction Options'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {deleteTxTarget.description} • {formatCurrency(deleteTxTarget.amount, currencySymbol, isArabic ? 'ar' : 'en')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTxTarget(null)}
                className="p-1.5 rounded-full hover:bg-zinc-850 text-zinc-400 hover:text-white transition cursor-pointer"
                title={isArabic ? 'إغلاق' : 'Close'}
                aria-label={isArabic ? 'إغلاق' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {isArabic
                ? 'يرجى تحديد الإجراء المطلوب تنفيذه على هذه المعاملة:'
                : 'Please select what you would like to do with this transaction:'}
            </p>

            {/* Action 1: Remove from share only */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const updated = removeItemFromShareFolder(folder.id, 'transaction', deleteTxTarget.id);
                  if (updated) setFolder(updated);
                  setDeleteTxTarget(null);
                  showToast(isArabic ? 'تمت إزالة المعاملة من الشير فقط (موجودة بحسابك)' : 'Removed from Share only', 'info');
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 hover:border-zinc-650 text-start flex items-center gap-3 transition cursor-pointer active:scale-98 group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white">
                    {isArabic ? 'إزالة من الشير فقط' : 'Remove from Share Only'}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {isArabic
                      ? 'تبقى في حسابك الشخصي كما هي، وتُحذف فقط من هذه المساحة المشتركة'
                      : 'Keeps it safe in your personal account, only removes from this share'}
                  </div>
                </div>
              </button>

              {/* Action 2: Delete everywhere permanently */}
              <button
                type="button"
                onClick={() => {
                  deleteTransaction(deleteTxTarget.id);
                  const updated = removeItemFromShareFolder(folder.id, 'transaction', deleteTxTarget.id);
                  if (updated) setFolder(updated);
                  setDeleteTxTarget(null);
                  showToast(isArabic ? 'تم حذف المعاملة نهائياً من كل مكان' : 'Transaction deleted everywhere', 'info');
                }}
                className="w-full p-3 rounded-2xl bg-red-950/30 hover:bg-red-900/40 border border-red-500/40 hover:border-red-500/60 text-start flex items-center gap-3 transition cursor-pointer active:scale-98 group"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-red-300">
                    {isArabic ? 'حذف نهائياً من كل مكان' : 'Delete Permanently Everywhere'}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {isArabic
                      ? 'حذف المعاملة من حسابك الشخصي ومن الشير نهائياً ولا يمكن التراجع'
                      : 'Deletes from both your account and share folder permanently'}
                  </div>
                </div>
              </button>
            </div>

            {/* Explicit Cancel & Exit Button */}
            <div className="pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setDeleteTxTarget(null)}
                className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white text-xs font-bold transition cursor-pointer border border-zinc-800 flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isArabic ? 'إلغاء وتراجع (عدم الحذف)' : 'Cancel & Exit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
