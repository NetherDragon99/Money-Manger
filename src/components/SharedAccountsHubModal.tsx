import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Share2,
  Copy,
  Trash2,
  Check,
  Plus,
  Radio,
  Send,
  Folder,
  Eye,
  ArrowLeft,
  Settings,
  ShieldCheck,
  CheckCircle,
  Clock,
  UserX,
  ChevronRight,
  ExternalLink,
  Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import { format16DigitId, cleanNumericId } from '../utils/userId';
import {
  loadMyShareFolders,
  loadReceivedShareFolders,
  saveMyShareFolders,
  saveReceivedShareFolders,
  createNewShareFolder,
  appendToExistingShareFolder,
  removeItemFromShareFolder,
  updateShareFolderSettings,
  deleteShareFolder,
  addMemberToShareFolder,
  removeMemberFromShareFolder,
  acceptShareInvitation,
  rejectShareInvitation,
  leaveShareFolder,
  generateShareUrl,
  fetchShareFolderFromCloud,
  ShareFolder,
} from '../utils/shareFolders';

interface SharedAccountsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SharedAccountsHubModal: React.FC<SharedAccountsHubModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    settings,
    accounts,
    categories,
    transactions,
    importSharedItems,
    openSharedLiveView,
    showToast,
    showConfirm,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const myNumericId = settings.userProfile?.numericId || '0000000000000000';
  const myName = settings.userProfile?.name || 'User';

  const [activeTab, setActiveTab] = useState<'my_shares' | 'shared_with_me'>('my_shares');
  const [myFolders, setMyFolders] = useState<ShareFolder[]>(() => loadMyShareFolders());
  const [receivedFolders, setReceivedFolders] = useState<ShareFolder[]>(() => loadReceivedShareFolders());

  // Active Managing Share Page
  const [managingFolderId, setManagingFolderId] = useState<string | null>(null);

  // Active Viewing Received Share Page
  const [viewingFolder, setViewingFolder] = useState<ShareFolder | null>(null);

  // Add Member State
  const [newMemberId, setNewMemberId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Add Item to Share State
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<'account' | 'category' | 'transaction'>('account');
  const [selectedItemIdToAdd, setSelectedItemIdToAdd] = useState('');

  // Selective Import State inside viewing folder
  const [isSelectiveMode, setIsSelectiveMode] = useState(false);
  const [selectedImportAccIds, setSelectedImportAccIds] = useState<string[]>([]);
  const [selectedImportCatIds, setSelectedImportCatIds] = useState<string[]>([]);
  const [selectedImportTxIds, setSelectedImportTxIds] = useState<string[]>([]);

  // Refresh data on mount or open
  useEffect(() => {
    if (isOpen) {
      setMyFolders(loadMyShareFolders());
      setReceivedFolders(loadReceivedShareFolders());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const managingFolder = myFolders.find((f) => f.id === managingFolderId) || null;

  const handleCopyLink = async (folder: ShareFolder) => {
    try {
      const url = generateShareUrl(folder);
      await navigator.clipboard.writeText(url);
      showToast(
        isArabic ? `تم نسخ رابط المشاركة لشير "${folder.name}"!` : `Share link for "${folder.name}" copied!`,
        'success'
      );
    } catch {
      showToast(isArabic ? 'تعذر نسخ الرابط' : 'Failed to copy link', 'error');
    }
  };

  const handleDeleteFolder = async (folder: ShareFolder) => {
    const ok = await showConfirm({
      title: isArabic ? 'حذف صفحة المشاركة' : 'Delete Share Page',
      message: isArabic
        ? `هل أنت متأكد من حذف صفحة "${folder.name}" تماماً؟ سيتم إلغاء وصول جميع الأعضاء.`
        : `Are you sure you want to delete "${folder.name}"? Access will be revoked for all members.`,
      confirmText: isArabic ? 'حذف نهائي' : 'Delete',
      isDanger: true,
    });
    if (!ok) return;

    await deleteShareFolder(folder.id);
    const updated = loadMyShareFolders();
    setMyFolders(updated);
    if (managingFolderId === folder.id) setManagingFolderId(null);
    showToast(isArabic ? 'تم حذف صفحة المشاركة بنجاح' : 'Share page deleted', 'info');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingFolder) return;
    const cleanId = cleanNumericId(newMemberId);
    if (cleanId.length !== 16) {
      showToast(
        isArabic ? 'يرجى إدخال معرّف صحيح مكون من 16 رقماً' : 'Please enter a valid 16-digit ID',
        'error'
      );
      return;
    }

    setIsAddingMember(true);
    try {
      const res = await addMemberToShareFolder(managingFolder.id, cleanId);
      if (res.success && res.folder) {
        setMyFolders(loadMyShareFolders());
        setNewMemberId('');
        showToast(
          isArabic
            ? `تمت إضافة العضو (${format16DigitId(cleanId)}) بنجاح!`
            : `Member (${format16DigitId(cleanId)}) added successfully!`,
          'success'
        );
      } else {
        showToast(res.error || (isArabic ? 'فشل إضافة العضو' : 'Failed to add member'), 'error');
      }
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberNumericId: string) => {
    if (!managingFolder) return;
    const ok = await showConfirm({
      title: isArabic ? 'إلغاء وصول العضو' : 'Revoke Member Access',
      message: isArabic
        ? `هل تريد إزالة هذا العضو وإلغاء وصوله لشير "${managingFolder.name}"؟`
        : `Revoke this member's access to "${managingFolder.name}"?`,
      confirmText: isArabic ? 'إلغاء الوصول' : 'Revoke',
      isDanger: true,
    });
    if (!ok) return;

    const res = await removeMemberFromShareFolder(managingFolder.id, memberNumericId);
    if (res.success) {
      setMyFolders(loadMyShareFolders());
      showToast(isArabic ? 'تم إلغاء وصول العضو بنجاح' : 'Member access revoked', 'info');
    }
  };

  const handleRemoveItem = (itemType: 'account' | 'category' | 'transaction', itemId: string) => {
    if (!managingFolder) return;
    const updated = removeItemFromShareFolder(managingFolder.id, itemType, itemId);
    if (updated) {
      setMyFolders(loadMyShareFolders());
      showToast(isArabic ? 'تم حذف العنصر من الشير' : 'Item removed from share', 'info');
    }
  };

  const handleAddItemToShare = () => {
    if (!managingFolder || !selectedItemIdToAdd) return;
    if (selectedItemType === 'account') {
      const acc = accounts.find((a) => a.id === selectedItemIdToAdd);
      if (acc) appendToExistingShareFolder(managingFolder.id, { accounts: [acc] });
    } else if (selectedItemType === 'category') {
      const cat = categories.find((c) => c.id === selectedItemIdToAdd);
      if (cat) appendToExistingShareFolder(managingFolder.id, { categories: [cat] });
    } else {
      const tx = transactions.find((t) => t.id === selectedItemIdToAdd);
      if (tx) appendToExistingShareFolder(managingFolder.id, { transactions: [tx] });
    }
    setMyFolders(loadMyShareFolders());
    setIsAddItemModalOpen(false);
    setSelectedItemIdToAdd('');
    showToast(isArabic ? 'تمت إضافة العنصر إلى صفحة الشير' : 'Item added to share page', 'success');
  };

  const handleAcceptInvite = async (folder: ShareFolder) => {
    await acceptShareInvitation(folder.id, myNumericId);
    setReceivedFolders(loadReceivedShareFolders());
    showToast(
      isArabic ? `تم قبول دعوة مشاركة "${folder.name}"!` : `Accepted invitation for "${folder.name}"!`,
      'success'
    );
  };

  const handleRejectInvite = async (folder: ShareFolder) => {
    await rejectShareInvitation(folder.id, myNumericId);
    setReceivedFolders(loadReceivedShareFolders());
    showToast(isArabic ? 'تم رفض الدعوة' : 'Invitation declined', 'info');
  };

  const handleLeaveShare = async (folder: ShareFolder) => {
    const ok = await showConfirm({
      title: isArabic ? 'إزالة الشير من حسابي' : 'Remove Shared Page',
      message: isArabic
        ? `هل تريد مغادرة وحذف صفحة "${folder.name}" من قائمة المشاركات المستلمة؟`
        : `Leave and remove "${folder.name}" from your received shares?`,
      confirmText: isArabic ? 'إزالة' : 'Remove',
      isDanger: true,
    });
    if (!ok) return;

    await leaveShareFolder(folder.id, myNumericId);
    setReceivedFolders(loadReceivedShareFolders());
    if (viewingFolder?.id === folder.id) setViewingFolder(null);
    showToast(isArabic ? 'تمت إزالة الشير من قائمتك' : 'Shared page removed', 'info');
  };

  // Full Import
  const handleImportAll = (folder: ShareFolder) => {
    const res = importSharedItems({
      accounts: folder.payload.accounts,
      categories: folder.payload.categories,
      transactions: folder.payload.transactions,
    });
    showToast(
      isArabic
        ? `تم الاستيراد بنجاح! (${res.accountsCount} حسابات، ${res.categoriesCount} تصنيفات، ${res.txsCount} معاملات)`
        : `Successfully imported! (${res.accountsCount} accounts, ${res.categoriesCount} categories, ${res.txsCount} transactions)`,
      'success'
    );
  };

  // Selective Import
  const handleImportSelected = (folder: ShareFolder) => {
    const chosenAccounts = folder.payload.accounts.filter((a) => selectedImportAccIds.includes(a.id));
    const chosenCategories = folder.payload.categories.filter((c) => selectedImportCatIds.includes(c.id));
    const chosenTransactions = folder.payload.transactions.filter((t) => selectedImportTxIds.includes(t.id));

    if (chosenAccounts.length === 0 && chosenCategories.length === 0 && chosenTransactions.length === 0) {
      showToast(isArabic ? 'يرجى تحديد عنصر واحد على الأقل' : 'Please select at least one item', 'info');
      return;
    }

    const res = importSharedItems({
      accounts: chosenAccounts,
      categories: chosenCategories,
      transactions: chosenTransactions,
    });

    showToast(
      isArabic
        ? `تم استيراد العناصر المحددة! (${res.accountsCount} حسابات، ${res.categoriesCount} تصنيفات، ${res.txsCount} معاملات)`
        : `Imported selected items! (${res.accountsCount} accounts, ${res.categoriesCount} categories, ${res.txsCount} transactions)`,
      'success'
    );
    setIsSelectiveMode(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg md:max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 sm:p-6 text-white space-y-4 animate-in zoom-in-95 duration-200 max-h-[92dvh] overflow-y-auto flex flex-col"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            {managingFolderId || viewingFolder ? (
              <button
                type="button"
                onClick={() => {
                  setManagingFolderId(null);
                  setViewingFolder(null);
                  setIsSelectiveMode(false);
                }}
                className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-850 flex items-center justify-center text-zinc-300 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-lg">
                👥
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-white">
                {managingFolder
                  ? `${isArabic ? 'إدارة صفحة:' : 'Manage:'} ${managingFolder.name}`
                  : viewingFolder
                  ? `${isArabic ? 'تصفح:' : 'Browse:'} ${viewingFolder.name}`
                  : isArabic
                  ? 'مركز المشاركات (Share Hub)'
                  : 'Share Pages Hub'}
              </h3>
              <p className="text-xs text-zinc-400">
                {managingFolder
                  ? `${managingFolder.itemCount} ${isArabic ? 'عناصر' : 'items'} • ${managingFolder.members.length} ${isArabic ? 'أعضاء' : 'members'}`
                  : viewingFolder
                  ? `${isArabic ? 'بواسطة' : 'By'} ${viewingFolder.ownerName}`
                  : isArabic
                  ? 'إدارة صفحات وقوالب المشاركة ومتابعة الحسابات المشتركة'
                  : 'Manage share templates and live collaborative pages'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* VIEW 1: MANAGE CREATED SHARE PAGE */}
        {managingFolder ? (
          <div className="space-y-4 animate-in fade-in">
            {/* Quick Settings & Permissions */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {isArabic ? 'إعدادات وصلاحيات الشير' : 'Share Settings & Role'}
                </span>
                <span className="text-xs font-mono text-zinc-500">{managingFolder.icon}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = managingFolder.permission === 'view_only' ? 'allow_import_edit' : 'view_only';
                    updateShareFolderSettings(managingFolder.id, { permission: next });
                    setMyFolders(loadMyShareFolders());
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    managingFolder.permission === 'view_only'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {managingFolder.permission === 'view_only'
                      ? isArabic
                        ? 'للمشاهدة فقط'
                        : 'View Only'
                      : isArabic
                      ? 'سماح بالاستيراد'
                      : 'Allow Import'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyLink(managingFolder)}
                  className="py-2 px-3 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-bold text-blue-400 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{isArabic ? 'نسخ رابط الويب' : 'Copy Web Link'}</span>
                </button>
              </div>
            </div>

            {/* Members Section (16-Digit IDs) */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {isArabic ? 'الأعضاء والأشخاص المضافين' : 'Members & People'} ({managingFolder.members.length})
                </span>
              </div>

              {/* Add Member Input */}
              <form onSubmit={handleAddMember} className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  value={format16DigitId(newMemberId)}
                  onChange={(e) => setNewMemberId(cleanNumericId(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono tracking-wider text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={isAddingMember || cleanNumericId(newMemberId).length !== 16}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إضافة' : 'Add'}</span>
                </button>
              </form>

              {/* Members List */}
              {managingFolder.members.length === 0 ? (
                <p className="text-xs text-zinc-500 py-1 text-center">
                  {isArabic ? 'لم تتم إضافة أي أشخاص بعد. أضف شخصاً بالمعرف المكون من 16 رقماً.' : 'No members added yet. Add someone by their 16-digit ID.'}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {managingFolder.members.map((m) => (
                    <div
                      key={m.numericId}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-mono font-bold text-zinc-200">
                          {format16DigitId(m.numericId)}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                          <span>{m.role === 'editor' ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}</span>
                          <span>•</span>
                          <span className={m.status === 'accepted' ? 'text-emerald-400' : 'text-amber-400'}>
                            {m.status === 'accepted' ? (isArabic ? 'مقبول' : 'Accepted') : (isArabic ? 'معلق' : 'Pending')}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.numericId)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition cursor-pointer"
                        title={isArabic ? 'إلغاء الوصول' : 'Revoke Access'}
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contents Section (Accounts, Categories, Transactions) */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {isArabic ? 'محتويات الشير' : 'Shared Items'} ({managingFolder.itemCount})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إضافة عناصر' : 'Add Items'}</span>
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {managingFolder.payload.accounts.map((a) => (
                  <div key={a.id} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                    <span className="truncate">🏦 {a.name} ({a.balance})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('account', a.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {managingFolder.payload.categories.map((c) => (
                  <div key={c.id} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                    <span className="truncate">🏷️ {c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('category', c.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {managingFolder.payload.transactions.map((t) => (
                  <div key={t.id} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                    <span className="truncate">💳 {t.description || t.categoryName} ({t.amount})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('transaction', t.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone: Delete Share Page */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => handleDeleteFolder(managingFolder)}
                className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isArabic ? 'حذف صفحة الشير نهائياً' : 'Delete Share Page'}</span>
              </button>
            </div>
          </div>
        ) : viewingFolder ? (
          /* VIEW 2: BROWSE & IMPORT RECEIVED SHARE PAGE */
          <div className="space-y-4 animate-in fade-in">
            {/* Owner Info & Import Bar */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    <span>{viewingFolder.icon}</span>
                    <span>{viewingFolder.name}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {isArabic ? 'المرسل:' : 'Sent by:'} {viewingFolder.ownerName} ({format16DigitId(viewingFolder.ownerNumericId)})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLeaveShare(viewingFolder)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-red-950/40 border border-zinc-700 text-zinc-400 hover:text-red-400 text-xs font-semibold transition cursor-pointer"
                >
                  {isArabic ? 'إزالة الشير' : 'Leave Share'}
                </button>
              </div>

              {/* Two Import Modes */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => handleImportAll(viewingFolder)}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>{isArabic ? 'إضافة كل العناصر لحسابي' : 'Add All to My Account'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSelectiveMode(!isSelectiveMode);
                    if (!isSelectiveMode) {
                      setSelectedImportAccIds(viewingFolder.payload.accounts.map((a) => a.id));
                      setSelectedImportCatIds(viewingFolder.payload.categories.map((c) => c.id));
                      setSelectedImportTxIds(viewingFolder.payload.transactions.map((t) => t.id));
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelectiveMode
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{isArabic ? 'اختيار عناصر معينة' : 'Select Specific Items'}</span>
                </button>
              </div>

              {isSelectiveMode && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleImportSelected(viewingFolder)}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isArabic ? 'استيراد العناصر المختارة فقط' : 'Import Selected Items'} (
                      {selectedImportAccIds.length + selectedImportCatIds.length + selectedImportTxIds.length})
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Contents View */}
            <div className="space-y-3">
              {/* Accounts */}
              {viewingFolder.payload.accounts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase text-zinc-400">
                    🏦 {isArabic ? 'الحسابات' : 'Accounts'} ({viewingFolder.payload.accounts.length})
                  </div>
                  {viewingFolder.payload.accounts.map((a) => {
                    const isChecked = selectedImportAccIds.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        onClick={() => {
                          if (isSelectiveMode) {
                            setSelectedImportAccIds((prev) =>
                              prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                            );
                          }
                        }}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between text-xs ${
                          isSelectiveMode ? 'cursor-pointer' : ''
                        } ${
                          isChecked && isSelectiveMode
                            ? 'bg-blue-950/40 border-blue-500'
                            : 'bg-zinc-900 border-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelectiveMode && (
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          )}
                          <span className="text-lg">{a.icon}</span>
                          <span className="font-bold text-white">{a.name}</span>
                        </div>
                        <span className="font-mono text-zinc-300 font-bold">{a.balance}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Categories */}
              {viewingFolder.payload.categories.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase text-zinc-400">
                    🏷️ {isArabic ? 'التصنيفات' : 'Categories'} ({viewingFolder.payload.categories.length})
                  </div>
                  {viewingFolder.payload.categories.map((c) => {
                    const isChecked = selectedImportCatIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (isSelectiveMode) {
                            setSelectedImportCatIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }
                        }}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between text-xs ${
                          isSelectiveMode ? 'cursor-pointer' : ''
                        } ${
                          isChecked && isSelectiveMode
                            ? 'bg-blue-950/40 border-blue-500'
                            : 'bg-zinc-900 border-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelectiveMode && (
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          )}
                          <span className="text-lg">{c.icon}</span>
                          <span className="font-bold text-white">{c.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Transactions */}
              {viewingFolder.payload.transactions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase text-zinc-400">
                    💳 {isArabic ? 'المعاملات' : 'Transactions'} ({viewingFolder.payload.transactions.length})
                  </div>
                  {viewingFolder.payload.transactions.map((t) => {
                    const isChecked = selectedImportTxIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          if (isSelectiveMode) {
                            setSelectedImportTxIds((prev) =>
                              prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                            );
                          }
                        }}
                        className={`p-3 rounded-2xl border transition flex items-center justify-between text-xs ${
                          isSelectiveMode ? 'cursor-pointer' : ''
                        } ${
                          isChecked && isSelectiveMode
                            ? 'bg-blue-950/40 border-blue-500'
                            : 'bg-zinc-900 border-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSelectiveMode && (
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700 bg-zinc-950'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white truncate max-w-[160px]">
                              {t.description || t.categoryName}
                            </div>
                            <div className="text-[10px] text-zinc-500">{t.date}</div>
                          </div>
                        </div>
                        <span className={`font-mono font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.amount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW 3: MAIN HUB (TABS: MY SHARES vs SHARED WITH ME) */
          <div className="space-y-4">
            {/* Tabs Bar */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('my_shares')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'my_shares'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{isArabic ? 'صفحات الشير الخاصة بي' : 'My Share Pages'} ({myFolders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('shared_with_me')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'shared_with_me'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isArabic ? 'مشارك معي' : 'Shared With Me'} ({receivedFolders.length})</span>
              </button>
            </div>

            {/* TAB 1: MY SHARES */}
            {activeTab === 'my_shares' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-zinc-400 font-medium">
                    {isArabic ? 'صفحات وقوالب شير محفوظة يمكنك تعديلها وإضافة أعضاء لها' : 'Created Share Pages with live member collaboration'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newFolder = createNewShareFolder({
                        customName: isArabic ? `شير جديد #${myFolders.length + 1}` : `Shared Page #${myFolders.length + 1}`,
                        ownerNumericId: myNumericId,
                        ownerName: myName,
                        isArabic,
                      });
                      setMyFolders(loadMyShareFolders());
                      setManagingFolderId(newFolder.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isArabic ? 'إنشاء صفحة شير' : 'New Share Page'}</span>
                  </button>
                </div>

                {myFolders.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
                    <div className="text-3xl">📁</div>
                    <div className="text-sm font-bold text-white">
                      {isArabic ? 'لا توجد صفحات شير بعد' : 'No Share Pages Created Yet'}
                    </div>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                      {isArabic
                        ? 'حدد معاملات أو حسابات بالضغط المطول واضغط مشاركة، أو اضغط على الزر أعلاه لإنشاء صفحة شير جديدة.'
                        : 'Long-press items and tap Share, or click the button above to create a share template.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {myFolders.map((f) => (
                      <div
                        key={f.id}
                        className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition flex items-center justify-between"
                      >
                        <div
                          onClick={() => setManagingFolderId(f.id)}
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                        >
                          <span className="text-2xl">{f.icon || '📁'}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate hover:text-blue-300 transition">
                              {f.name}
                            </div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span>{f.itemCount} {isArabic ? 'عناصر' : 'items'}</span>
                              <span>•</span>
                              <span>{f.members.length} {isArabic ? 'أعضاء' : 'members'}</span>
                              <span>•</span>
                              <span className="text-blue-400">
                                {f.permission === 'view_only' ? (isArabic ? 'مشاهدة' : 'View') : (isArabic ? 'استيراد' : 'Import')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(f)}
                            className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
                            title={isArabic ? 'نسخ رابط الويب' : 'Copy Public Web Link'}
                          >
                            <Copy className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setManagingFolderId(f.id)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer active:scale-95"
                          >
                            {isArabic ? 'إدارة' : 'Manage'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SHARED WITH ME */}
            {activeTab === 'shared_with_me' && (
              <div className="space-y-3">
                {receivedFolders.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
                    <div className="text-3xl">👥</div>
                    <div className="text-sm font-bold text-white">
                      {isArabic ? 'لا توجد مشاركات مستلمة حالياً' : 'No Shares Received Yet'}
                    </div>
                    <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                      {isArabic
                        ? 'عندما يقوم صديق بإضافتك عبر معرّفك المكون من 16 رقماً، ستظهر مشاركته هنا فوراً.'
                        : 'When someone shares with your 16-digit ID, their share page appears here.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {receivedFolders.map((f) => {
                      const myMemberRecord = f.members.find((m) => m.numericId === cleanNumericId(myNumericId));
                      const isPending = !myMemberRecord || myMemberRecord.status === 'pending';

                      return (
                        <div
                          key={f.id}
                          className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 transition flex items-center justify-between"
                        >
                          <div
                            onClick={() => setViewingFolder(f)}
                            className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                          >
                            <span className="text-2xl">{f.icon || '📁'}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate hover:text-blue-300 transition">
                                {f.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">
                                {isArabic ? 'المرسل:' : 'From:'} {f.ownerName} • {f.itemCount} {isArabic ? 'عناصر' : 'items'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pl-2">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptInvite(f)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer active:scale-95"
                                >
                                  {isArabic ? 'قبول' : 'Accept'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectInvite(f)}
                                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 text-xs font-semibold transition cursor-pointer"
                                >
                                  {isArabic ? 'رفض' : 'Decline'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setViewingFolder(f)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer active:scale-95"
                              >
                                {isArabic ? 'تصفح واستيراد' : 'Browse & Import'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODAL: ADD ITEM TO SHARE PAGE */}
        {isAddItemModalOpen && managingFolder && (
          <div
            onClick={() => setIsAddItemModalOpen(false)}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 p-5 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h4 className="text-sm font-bold text-white">
                  {isArabic ? 'إضافة عنصر إلى الشير' : 'Add Item to Share Page'}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="p-1 rounded-full text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-900 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemType('account');
                    setSelectedItemIdToAdd('');
                  }}
                  className={`py-1.5 rounded-lg transition ${
                    selectedItemType === 'account' ? 'bg-blue-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  {isArabic ? 'حساب' : 'Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemType('category');
                    setSelectedItemIdToAdd('');
                  }}
                  className={`py-1.5 rounded-lg transition ${
                    selectedItemType === 'category' ? 'bg-blue-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  {isArabic ? 'تصنيف' : 'Category'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemType('transaction');
                    setSelectedItemIdToAdd('');
                  }}
                  className={`py-1.5 rounded-lg transition ${
                    selectedItemType === 'transaction' ? 'bg-blue-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  {isArabic ? 'معاملة' : 'Transaction'}
                </button>
              </div>

              {/* Item Dropdown */}
              <select
                value={selectedItemIdToAdd}
                onChange={(e) => setSelectedItemIdToAdd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">{isArabic ? '-- اختر عنصراً --' : '-- Choose item --'}</option>
                {selectedItemType === 'account' &&
                  accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name} ({a.balance})
                    </option>
                  ))}
                {selectedItemType === 'category' &&
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                {selectedItemType === 'transaction' &&
                  transactions.slice(0, 50).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.description || t.categoryName} ({t.amount})
                    </option>
                  ))}
              </select>

              <button
                type="button"
                disabled={!selectedItemIdToAdd}
                onClick={handleAddItemToShare}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition shadow"
              >
                {isArabic ? 'إضافة إلى صفحة الشير' : 'Add to Share Page'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
