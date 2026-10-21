import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Share2,
  ExternalLink,
  Copy,
  Trash2,
  Check,
  Plus,
  RefreshCw,
  Edit,
  ShieldCheck,
  Radio,
  Send,
  Folder,
  Eye,
  ArrowDownLeft,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Transaction } from '../types';
import {
  auth,
  publishSharedAccount,
  stopSharingAccount,
  listenToSharedAccount,
} from '../utils/firebase';
import { buildShareUrl } from '../utils/sharing';
import { format16DigitId, cleanNumericId } from '../utils/userId';
import {
  loadMyShareFolders,
  loadReceivedShareFolders,
  saveReceivedShareFolders,
  saveMyShareFolders,
  sendShareFolderToRecipient,
  createNewShareFolder,
  ShareFolder,
} from '../utils/shareFolders';

interface SharedAccountsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FollowedAccountItem {
  id: string;
  name: string;
  icon: string;
  balance: number;
  ownerEmail?: string;
  lastUpdated?: number;
}

const STORAGE_FOLLOWED_KEY = 'pwa_finance_followed_accounts';
const STORAGE_MY_SHARED_KEY = 'pwa_finance_my_shared_ids';

export const SharedAccountsHubModal: React.FC<SharedAccountsHubModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    accounts,
    transactions,
    settings,
    showToast,
    showConfirm,
    openSharedLiveView,
    openShareModal,
    importSingleAccountData,
  } = useApp();
  const isArabic = settings.language === 'ar';

  const [activeTab, setActiveTab] = useState<'my_shared' | 'shared_with_me'>('my_shared');
  const [isClosing, setIsClosing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // My shared account IDs
  const [mySharedIds, setMySharedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MY_SHARED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Followed shared accounts
  const [followedAccounts, setFollowedAccounts] = useState<FollowedAccountItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FOLLOWED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Share Folders (Item 6 & 7)
  const [myShareFolders, setMyShareFolders] = useState<ShareFolder[]>(() => loadMyShareFolders());
  const [receivedShareFolders, setReceivedShareFolders] = useState<ShareFolder[]>(() =>
    loadReceivedShareFolders()
  );

  // Direct Share via 16-Digit ID input state
  const [target16DigitId, setTarget16DigitId] = useState('');
  const [selectedFolderToSend, setSelectedFolderToSend] = useState<string>('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [copiedMyId, setCopiedMyId] = useState(false);

  // Follow input
  const [joinInput, setJoinInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Share new picker state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reload folders when modal opens
  useEffect(() => {
    if (isOpen) {
      setMyShareFolders(loadMyShareFolders());
      setReceivedShareFolders(loadReceivedShareFolders());
    }
  }, [isOpen]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MY_SHARED_KEY, JSON.stringify(mySharedIds));
    } catch {}
  }, [mySharedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FOLLOWED_KEY, JSON.stringify(followedAccounts));
    } catch {}
  }, [followedAccounts]);

  // Real-time listener for followed accounts
  useEffect(() => {
    if (!isOpen || followedAccounts.length === 0) return;

    const unsubs = followedAccounts.map((item) => {
      return listenToSharedAccount(item.id, (data) => {
        if (data && data.account) {
          setFollowedAccounts((prev) =>
            prev.map((acc) =>
              acc.id === item.id
                ? {
                    ...acc,
                    name: data.account.name,
                    icon: data.account.icon,
                    balance: data.account.balance,
                    ownerEmail: data.ownerEmail,
                    lastUpdated: data.updatedAt,
                  }
                : acc
            )
          );
        }
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [isOpen, followedAccounts.length]);

  if (!isOpen) return null;

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const my16DigitId = settings.userProfile?.numericId || '0000000000000000';

  const handleCopyMyNumericId = () => {
    navigator.clipboard.writeText(my16DigitId);
    setCopiedMyId(true);
    showToast(
      isArabic
        ? `تم نسخ معرّفك الرقمي (${format16DigitId(my16DigitId)}) للحافظة!`
        : `Your 16-Digit ID (${format16DigitId(my16DigitId)}) copied!`,
      'success'
    );
    setTimeout(() => setCopiedMyId(false), 2000);
  };

  const handleShareAccount = async (account: Account) => {
    setIsPublishing(true);
    try {
      const user = auth.currentUser;
      const ownerUid = user ? user.uid : 'local_device_user';
      const ownerEmail = user?.email || user?.displayName || 'Family Account Owner';

      const sharedId = await publishSharedAccount(ownerUid, ownerEmail, account, transactions);

      if (!mySharedIds.includes(sharedId)) {
        setMySharedIds((prev) => [...prev, sharedId]);
      }
      setIsPickerOpen(false);
      showToast(
        isArabic
          ? `تم إنشاء ومشاركة صفحة الحساب "${account.name}" بنجاح!`
          : `Live shared page created for "${account.name}"!`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to share account', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStopSharing = async (sharedId: string) => {
    const confirmed = await showConfirm({
      title: isArabic ? 'إيقاف المشاركة السحابية' : 'Stop Cloud Sharing',
      message: isArabic
        ? 'هل أنت متأكد من إلغاء مشاركة هذا الحساب؟ سيتوقف المتابعون عن تلقي التحديثات.'
        : 'Are you sure you want to stop sharing this account? Followers will no longer receive live updates.',
      confirmText: isArabic ? 'إيقاف المشاركة' : 'Stop Sharing',
      isDanger: true,
    });
    if (!confirmed) return;

    setRevokingId(sharedId);
    try {
      await stopSharingAccount(sharedId);
      setMySharedIds((prev) => prev.filter((id) => id !== sharedId));
      showToast(
        isArabic ? 'تم إيقاف وإلغاء مشاركة الحساب السحابية' : 'Shared page revoked and stopped',
        'info'
      );
    } catch (err: any) {
      showToast(err?.message || 'Error revoking share', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  const handleDeleteShareFolder = (folderId: string) => {
    const updated = myShareFolders.filter((f) => f.id !== folderId);
    setMyShareFolders(updated);
    saveMyShareFolders(updated);
    showToast(isArabic ? 'تم حذف مجلد المشاركة' : 'Share folder deleted', 'info');
  };

  const handleDeleteReceivedFolder = (folderId: string) => {
    const updated = receivedShareFolders.filter((f) => f.id !== folderId);
    setReceivedShareFolders(updated);
    saveReceivedShareFolders(updated);
    showToast(isArabic ? 'تمت إزالة المجلد المشترك' : 'Removed received folder', 'info');
  };

  const handleSendFolderToId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = cleanNumericId(target16DigitId);
    if (cleanTarget.length !== 16) {
      showToast(
        isArabic
          ? 'يرجى إدخال معرّف صديق صحيح مكون من 16 رقماً'
          : 'Please enter a valid 16-digit recipient ID',
        'error'
      );
      return;
    }

    if (!selectedFolderToSend && myShareFolders.length > 0) {
      showToast(
        isArabic ? 'يرجى اختيار المجلد المراد مشاركته' : 'Please select a folder to share',
        'info'
      );
      return;
    }

    const folder = myShareFolders.find((f) => f.id === selectedFolderToSend) || myShareFolders[0];
    if (!folder) {
      showToast(
        isArabic ? 'لا توجد مجلدات مشاركة بعد. أنشئ مجلداً أولاً!' : 'No share folders available yet!',
        'info'
      );
      return;
    }

    setIsSendingDirect(true);
    try {
      const res = await sendShareFolderToRecipient(folder, cleanTarget);
      if (res.success) {
        showToast(
          isArabic
            ? `تم إرسال مجلد "${folder.name}" بنجاح إلى المعرّف (${format16DigitId(cleanTarget)})!`
            : `Folder "${folder.name}" successfully sent to (${format16DigitId(cleanTarget)})!`,
          'success'
        );
        setTarget16DigitId('');
      } else {
        showToast(
          isArabic ? `فشل الإرسال: ${res.error}` : `Failed to send: ${res.error}`,
          'error'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Error sending folder', 'error');
    } finally {
      setIsSendingDirect(false);
    }
  };

  const getSharedAccountUrl = (sharedId: string): string => {
    return buildShareUrl({ sharedAccountId: sharedId });
  };

  const handleCopyLink = (sharedId: string) => {
    const url = getSharedAccountUrl(sharedId);
    navigator.clipboard.writeText(url);
    setCopiedId(sharedId);
    showToast(
      isArabic ? 'تم نسخ رابط الحساب المشترك للحافظة!' : 'Live shared link copied to clipboard!',
      'success'
    );
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenViewer = (sharedId: string) => {
    handleAnimatedClose();
    setTimeout(() => {
      openSharedLiveView(sharedId);
    }, 190);
  };

  const handleJoinAccount = () => {
    let cleanCode = joinInput.trim();
    if (!cleanCode) return;

    if (cleanCode.includes('sharedAccountId=')) {
      try {
        const u = new URL(cleanCode);
        cleanCode = u.searchParams.get('sharedAccountId') || cleanCode;
      } catch {
        const match = cleanCode.match(/sharedAccountId=([^&]+)/);
        if (match) cleanCode = match[1];
      }
    }

    setIsJoining(true);
    listenToSharedAccount(cleanCode, (data) => {
      setIsJoining(false);
      if (data && data.account) {
        setFollowedAccounts((prev) => {
          if (prev.some((a) => a.id === cleanCode)) return prev;
          return [
            ...prev,
            {
              id: cleanCode,
              name: data.account.name,
              icon: data.account.icon,
              balance: data.account.balance,
              ownerEmail: data.ownerEmail,
              lastUpdated: data.updatedAt,
            },
          ];
        });

        importSingleAccountData(data.account, data.transactions || []);
        setJoinInput('');
        showToast(
          isArabic
            ? `تمت متابعة ومزامنة حساب "${data.account.name}" بنجاح!`
            : `Followed and synced "${data.account.name}" in real time!`,
          'success'
        );
      } else {
        showToast(
          isArabic
            ? 'رمز الحساب المشترك غير صالح أو لم يعد متاحاً'
            : 'Invalid or inactive shared account code',
          'error'
        );
      }
    });
  };

  const handleUnfollow = (id: string) => {
    setFollowedAccounts((prev) => prev.filter((a) => a.id !== id));
    showToast(isArabic ? 'تمت إزالة الحساب من قائمة المتابعة' : 'Unfollowed shared account', 'info');
  };

  const sharedAccountsList = accounts.filter((acc) =>
    mySharedIds.includes(`share_${acc.id}`)
  );

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isArabic ? 'مركز المشاركة والحسابات' : 'Shared Accounts & Hub'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isArabic ? 'مشاركة المجلدات والحسابات لحظياً' : 'Live sharing & instant numeric delivery'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User's Own 16-Digit ID Banner with 1-Tap Copy */}
        <div className="px-5 py-2.5 bg-blue-950/30 border-b border-blue-900/30 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-blue-300 uppercase tracking-wider">
              {isArabic ? 'معرّفك الرقمي للمشاركة (16 رقماً):' : 'Your 16-Digit Numeric ID:'}
            </span>
            <span className="block text-xs font-mono font-bold text-white tracking-wider mt-0.5 select-all truncate">
              {format16DigitId(my16DigitId)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyMyNumericId}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 active:scale-95 ${
              copiedMyId
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white shadow-sm'
            }`}
          >
            {copiedMyId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedMyId ? (isArabic ? 'تم النسخ' : 'Copied') : isArabic ? 'نسخ معرّفي' : 'Copy My ID'}</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-900/20">
          <div className="flex p-1 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('my_shared')}
              className={`flex-1 py-2 rounded-xl transition text-center cursor-pointer ${
                activeTab === 'my_shared'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isArabic ? 'مشاركاتي' : 'My Shared'} ({sharedAccountsList.length + myShareFolders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shared_with_me')}
              className={`flex-1 py-2 rounded-xl transition text-center cursor-pointer ${
                activeTab === 'shared_with_me'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isArabic ? 'مشتركة معي' : 'Shared with Me'} ({followedAccounts.length + receivedShareFolders.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'my_shared' ? (
            /* TAB 1: My Shared Items & Add Someone by 16-Digit ID (Item 5) */
            <div className="space-y-5">
              {/* Add / Direct Send via 16-Digit ID Input Box (Item 5 user request) */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-blue-500/30 space-y-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    {isArabic ? 'إرسال مجلد مشاركة لصديق بمعرّفه (16 رقماً)' : 'Send Share Folder to Friend by 16-Digit ID'}
                  </h4>
                </div>

                <form onSubmit={handleSendFolderToId} className="space-y-2.5">
                  {myShareFolders.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">
                        {isArabic ? 'اختر المجلد المراد إرساله:' : 'Select folder to send:'}
                      </label>
                      <select
                        value={selectedFolderToSend || myShareFolders[0]?.id}
                        onChange={(e) => setSelectedFolderToSend(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        {myShareFolders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.icon} {f.name} ({f.itemCount} items)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={19}
                      value={format16DigitId(target16DigitId)}
                      onChange={(e) => setTarget16DigitId(cleanNumericId(e.target.value))}
                      placeholder={isArabic ? 'أدخل معرّف الصديق (16 رقماً)' : 'Enter 16-Digit Friend ID'}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono tracking-wider text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={isSendingDirect || cleanNumericId(target16DigitId).length !== 16}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition shadow cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingDirect ? '...' : isArabic ? 'إرسال' : 'Send'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* My Share Folders List (Item 6) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isArabic ? 'مجلدات المشاركة المستقلة' : 'My Share Folders'}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({myShareFolders.length})</span>
                  </h4>
                </div>

                {myShareFolders.length === 0 ? (
                  <div className="text-center py-6 px-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/60 text-zinc-500 text-xs">
                    {isArabic
                      ? 'لا توجد مجلدات مشاركة بعد. حدد معاملات من الصفحة الرئيسية واضغط "مجلد مشاركة" لإنشاء مجلد فوري.'
                      : 'No share folders yet. Multi-select items from Home view and tap "Share Folder".'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myShareFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">{folder.icon}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">{folder.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              {folder.itemCount} {isArabic ? 'عناصر' : 'items'} •{' '}
                              {new Date(folder.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFolderToSend(folder.id);
                              showToast(
                                isArabic ? 'تم اختيار المجلد للإرسال بالأعلى' : 'Folder selected for sending above',
                                'info'
                              );
                            }}
                            className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-blue-400 text-xs transition cursor-pointer"
                            title="Select to send"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShareFolder(folder.id)}
                            className="p-2 rounded-xl bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 text-red-400 text-xs transition cursor-pointer"
                            title="Delete Folder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shared Live Accounts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {isArabic ? 'الحسابات التي أشاركها عبر الرابط' : 'Accounts Shared via Link'} ({sharedAccountsList.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[11px] font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isArabic ? 'مشاركة حساب' : 'Share Account'}</span>
                  </button>
                </div>

                {isPickerOpen && (
                  <div className="p-3 rounded-2xl bg-zinc-900 border border-blue-500/40 space-y-2 animate-in fade-in">
                    <span className="block text-xs font-bold text-white">
                      {isArabic ? 'اختر حساباً لمشاركته مباشرة:' : 'Choose an account to share:'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {accounts.map((acc) => {
                        const isAlreadyShared = mySharedIds.includes(`share_${acc.id}`);
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            disabled={isAlreadyShared}
                            onClick={() => { setIsPickerOpen(false); openShareModal({ accounts: [acc] }); }}
                            className={`flex items-center justify-between p-2 rounded-xl text-left text-xs transition cursor-pointer ${
                              isAlreadyShared
                                ? 'bg-zinc-950/40 border border-zinc-800 text-zinc-500 opacity-60'
                                : 'bg-zinc-950 border border-zinc-800 hover:border-blue-500 hover:bg-zinc-850 text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span>{acc.icon}</span>
                              <span className="truncate">{acc.name}</span>
                            </div>
                            {isAlreadyShared ? (
                              <span className="text-[10px] text-emerald-400 font-bold shrink-0">Shared</span>
                            ) : (
                              <Share2 className="w-3 h-3 text-blue-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sharedAccountsList.map((acc) => {
                  const sharedId = `share_${acc.id}`;
                  const isCopied = copiedId === sharedId;

                  return (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 shadow-md"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0">{acc.icon}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{acc.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">ID: {sharedId}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(sharedId)}
                          className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-blue-400 text-xs transition cursor-pointer"
                          title="Copy Link"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenViewer(sharedId)}
                          className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 text-xs transition cursor-pointer"
                          title="Open Live View"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={revokingId === sharedId}
                          onClick={() => handleStopSharing(sharedId)}
                          className="p-2 rounded-xl bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 text-red-400 text-xs transition cursor-pointer"
                          title="Stop Sharing"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* TAB 2: Shared With Me (Received Folders & Followed Accounts) */
            <div className="space-y-5">
              {/* Follow via link / code */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {isArabic ? 'متابعة رابط أو رمز مشاركة' : 'Follow Shared Account / Code'}
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder={
                      isArabic ? 'ألصق الرمز أو الرابط هنا' : 'Paste ID or link'
                    }
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition"
                  />
                  <button
                    type="button"
                    disabled={isJoining || !joinInput.trim()}
                    onClick={handleJoinAccount}
                    className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition shadow cursor-pointer shrink-0"
                  >
                    {isJoining ? '...' : isArabic ? 'متابعة' : 'Follow'}
                  </button>
                </div>
              </div>

              {/* Received Share Folders from Friends (Delivered via 16-Digit ID) */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isArabic ? 'المجلدات المرسلة لي' : 'Folders Received via My ID'}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">({receivedShareFolders.length})</span>
                </h5>

                {receivedShareFolders.length === 0 ? (
                  <div className="text-center py-6 px-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/60 text-zinc-500 text-xs">
                    {isArabic
                      ? 'لم تتلق أي مجلدات بعد. شارك معرّفك المكون من 16 رقماً مع أصدقائك ليرسلوا لك مجلداتهم مباشرة!'
                      : 'No received folders yet. Give your 16-digit ID to friends to receive folders directly!'}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {receivedShareFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 shadow-md"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">{folder.icon}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">{folder.name}</span>
                            <span className="text-[10px] text-emerald-400 font-semibold block">
                              {isArabic ? 'من' : 'From'}: {folder.ownerName} ({format16DigitId(folder.ownerNumericId)})
                            </span>
                            <span className="text-[9px] text-zinc-500">
                              {folder.itemCount} {isArabic ? 'عناصر' : 'items'} •{' '}
                              {folder.payload.transactions.length} txs
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              // Open Live View with folder snapshot
                              handleAnimatedClose();
                              setTimeout(() => {
                                openSharedLiveView(undefined, {
                                  title: folder.name,
                                  ownerName: folder.ownerName,
                                  createdAt: folder.createdAt,
                                  accounts: folder.payload.accounts,
                                  categories: folder.payload.categories,
                                  transactions: folder.payload.transactions,
                                });
                              }, 190);
                            }}
                            className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 transition cursor-pointer"
                            title="View Folder Content"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReceivedFolder(folder.id)}
                            className="p-2 rounded-xl bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 text-red-400 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Followed Accounts */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {isArabic ? 'الحسابات المتابعة عبر الرابط' : 'Followed Accounts via Link'} ({followedAccounts.length})
                </h5>

                {followedAccounts.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl shrink-0">
                        {item.icon || '🏦'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{item.name}</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[9px] font-bold">
                            Live
                          </span>
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                          {settings.currencySymbol || '£'}{Number(item.balance || 0).toFixed(2)}
                        </div>
                        {item.ownerEmail && (
                          <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                            by {item.ownerEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenViewer(item.id)}
                        className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 transition cursor-pointer"
                        title="Open Live View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnfollow(item.id)}
                        className="p-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 text-red-400 transition cursor-pointer"
                        title="Unfollow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white transition cursor-pointer"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
