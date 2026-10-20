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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Transaction } from '../types';
import {
  auth,
  publishSharedAccount,
  stopSharingAccount,
  listenToSharedAccount,
  SharedAccountData,
} from '../utils/firebase';
import { buildShareUrl, encodeShareSnapshot } from '../utils/sharing';

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
    openEditAccountModal,
    showToast,
    showConfirm,
    openSharedLiveView,
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

  // Follow input
  const [joinInput, setJoinInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Share new picker state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

    // Handle full URL pasted
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
        // Add to followed accounts
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

        // Optionally import into local accounts
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

  // Match accounts sharing
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
                {isArabic ? 'مركز الحسابات المشتركة' : 'Shared Accounts Hub'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isArabic ? 'مشاركة ومتابعة الحسابات لحظياً' : 'Live collaboration & read-only pages'}
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

        {/* Tab Switcher: My Shared Pages vs Followed Shared Accounts */}
        <div className="px-5 pt-3.5 pb-2 border-b border-zinc-800/60 bg-zinc-900/20">
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
              {isArabic ? 'صفحاتي المشتركة' : 'My Shared Pages'} ({sharedAccountsList.length})
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
              {isArabic ? 'مشتركة معي' : 'Shared with Me'} ({followedAccounts.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'my_shared' ? (
            /* TAB 1: My Shared Pages */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {isArabic ? 'الحسابات التي أشاركها' : 'Accounts I am Sharing'}
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {isArabic
                      ? 'يمكن لأي شخص لديه الرابط مشاهدة الرصيد والمعاملات بدون تسجيل الدخول.'
                      : 'Anyone with the link can view live balance and transactions without logging in.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(!isPickerOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'مشاركة حساب' : 'Share Account'}</span>
                </button>
              </div>

              {/* Picker Drawer if opened */}
              {isPickerOpen && (
                <div className="p-3.5 rounded-2xl bg-zinc-900 border border-blue-500/40 space-y-2.5 animate-in fade-in">
                  <span className="block text-xs font-bold text-white">
                    {isArabic ? 'اختر حساباً لمشاركته:' : 'Choose an account to share:'}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {accounts.map((acc) => {
                      const isAlreadyShared = mySharedIds.includes(`share_${acc.id}`);
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          disabled={isAlreadyShared}
                          onClick={() => handleShareAccount(acc)}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition cursor-pointer ${
                            isAlreadyShared
                              ? 'bg-zinc-950/40 border border-zinc-800 text-zinc-500 opacity-60'
                              : 'bg-zinc-950 border border-zinc-800 hover:border-blue-500 hover:bg-zinc-850 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-xl">{acc.icon}</span>
                            <span className="font-semibold truncate">{acc.name}</span>
                          </div>
                          {isAlreadyShared ? (
                            <span className="text-[10px] text-emerald-400 font-bold shrink-0">Shared</span>
                          ) : (
                            <Share2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* List of Shared Accounts */}
              {sharedAccountsList.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 text-zinc-400 space-y-3">
                  <div className="text-3xl">🔗</div>
                  <p className="text-sm font-semibold text-white">
                    {isArabic ? 'لم تقم بمشاركة أي حساب بعد' : 'No shared accounts published yet'}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {isArabic
                      ? 'شارك أي حساب مالي لإنشاء صفحة ويب مباشرة ومحدثة فورياً للمشاهدة بدون كلمة مرور.'
                      : 'Share any account to generate a live, real-time read-only web page for partners or family.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isArabic ? 'مشاركة حساب الآن' : 'Share an Account Now'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedAccountsList.map((acc) => {
                    const sharedId = `share_${acc.id}`;
                    const isCopied = copiedId === sharedId;

                    return (
                      <div
                        key={acc.id}
                        className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800/80 space-y-3 shadow-md hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl">
                              {acc.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{acc.name}</span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
                                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                                  <span>Live</span>
                                </span>
                              </div>
                              <div className="text-xs font-mono font-bold text-zinc-300 mt-0.5">
                                {settings.currencySymbol || '£'}{acc.balance.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Open Live View */}
                            <button
                              type="button"
                              onClick={() => handleOpenViewer(sharedId)}
                              title="Open Live Shared Page"
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-blue-400 hover:text-white transition cursor-pointer"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {/* Copy Link */}
                            <button
                              type="button"
                              onClick={() => handleCopyLink(sharedId)}
                              title="Copy Share Link"
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 hover:text-white transition cursor-pointer"
                            >
                              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>

                            {/* Edit Account */}
                            <button
                              type="button"
                              onClick={() => {
                                handleAnimatedClose();
                                openEditAccountModal(acc);
                              }}
                              title="Edit Account"
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Revoke / Stop Sharing */}
                            <button
                              type="button"
                              onClick={() => handleStopSharing(sharedId)}
                              disabled={revokingId === sharedId}
                              title="Stop Sharing"
                              className="p-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 text-red-400 hover:text-red-300 transition cursor-pointer disabled:opacity-50"
                            >
                              {revokingId === sharedId ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Link Display Snippet */}
                        <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-850 text-[11px] font-mono text-zinc-400">
                          <span className="truncate pr-2">
                            ?sharedAccountId={sharedId}
                          </span>
                          <span className="text-[10px] text-blue-400 shrink-0 font-bold">
                            {isArabic ? 'نشط' : 'Active'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: Followed Shared Accounts */
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {isArabic ? 'متابعة حساب مشارك جديد' : 'Follow a Shared Account'}
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {isArabic
                    ? 'أدخل رمز المشاركة أو الرابط الممنوح لك لمتابعة رصيد الحساب مباشرة.'
                    : 'Paste the shared account ID or link to follow its live balance and transactions.'}
                </p>
              </div>

              {/* Join Input Bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  placeholder={
                    isArabic
                      ? 'ألصق الرمز أو الرابط هنا (share_...)'
                      : 'Paste ID or link (e.g. share_acc_...)'
                  }
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition"
                />
                <button
                  type="button"
                  disabled={isJoining || !joinInput.trim()}
                  onClick={handleJoinAccount}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition shadow cursor-pointer shrink-0"
                >
                  {isJoining ? '...' : isArabic ? 'متابعة ومزامنة' : 'Follow & Sync'}
                </button>
              </div>

              {/* Followed Accounts List */}
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {isArabic ? 'الحسابات التي أتابعها' : 'Accounts Shared with Me'} ({followedAccounts.length})
                </h5>

                {followedAccounts.length === 0 ? (
                  <div className="text-center py-10 px-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 text-zinc-400 space-y-2">
                    <div className="text-2xl">👥</div>
                    <p className="text-xs font-semibold text-white">
                      {isArabic ? 'لا توجد حسابات متابعة حتى الآن' : 'No followed accounts yet'}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {isArabic
                        ? 'عندما يشارك معك شخص حسابه المالي، أدخل رمزه بالأعلى لمتابعته مباشرة.'
                        : 'When someone shares an account with you, enter their ID above to track it.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
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
                            title="Open Live View"
                            className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 transition cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnfollow(item.id)}
                            title="Unfollow"
                            className="p-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 text-red-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
