import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Users,
  Share2,
  Copy,
  Trash2,
  Check,
  Plus,
  Send,
  Eye,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Download,
  Folder,
  UserCheck,
  Clock,
  Sparkles,
  LogOut,
  Loader2,
  Settings,
  Lock,
} from 'lucide-react';
import { auth, loginWithGoogle, getCachedAuthUser } from '../utils/firebase';
import { User } from 'firebase/auth';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import { format16DigitId, cleanNumericId, format16DigitInput, getOrCreateNumericId } from '../utils/userId';
import { UserSearchPicker } from './UserSearchPicker';
import { ShareSpaceSettingsModal } from './ShareSpaceSettingsModal';
import {
  loadMyShareFolders,
  loadReceivedShareFolders,
  repairAndMigrateSharedSpaces,
  saveMyShareFolders,
  saveReceivedShareFolders,
  syncFolderToCloud,
  syncShareFolderToCloud,
  deleteShareFolder,
  addMemberToShareFolder,
  removeMemberFromShareFolder,
  acceptShareInvitation,
  rejectShareInvitation,
  leaveShareFolder,
  generateShareUrl,
  subscribeToMyInbox,
  fetchMyInboxOnce,
  ShareFolder,
  publishUserProfileCard,
  getAvatarColorGradient,
  getMemberInitials,
  UserProfileCard,
} from '../utils/shareFolders';
import { ShareDetailView } from './ShareDetailView';

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
    openShareModal,
    showToast,
    showConfirm,
    setIsUserProfileModalOpen,
    setIsEditingSpace: setGlobalIsEditingSpace,
    setEditingShareId: setGlobalEditingShareId,
  } = useApp();

  const isArabic = settings.language === 'ar';
  const myName = settings.userProfile?.name || 'User';

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
  }, [isOpen, settings.userProfile?.uid, settings.userProfile?.numericId]);

  const isAuthenticated = Boolean(
    currentUser?.uid ||
    auth.currentUser?.uid ||
    getCachedAuthUser()?.uid ||
    settings.userProfile?.uid
  );

  const myCleanNumericId =
    cleanNumericId(settings.userProfile?.numericId || '') ||
    (isAuthenticated ? getOrCreateNumericId() : '');

  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsSigningInWithGoogle(true);
      const user = await loginWithGoogle();
      if (user) {
        setCurrentUser(user);
      }
      showToast(isArabic ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!', 'success');
    } catch (err: any) {
      if (err?.message && err.message.includes('Redirecting')) {
        return;
      }
      showToast(err?.message || (isArabic ? 'فشل تسجيل الدخول' : 'Sign in failed'), 'error');
    } finally {
      setIsSigningInWithGoogle(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'my_shares' | 'shared_with_me'>('my_shares');
  const [myFolders, setMyFolders] = useState<ShareFolder[]>(() => loadMyShareFolders());
  const [receivedFolders, setReceivedFolders] = useState<ShareFolder[]>(() => loadReceivedShareFolders());

  // Full-screen native detail page view state
  const [activeShareDetailFolder, setActiveShareDetailFolder] = useState<ShareFolder | null>(null);

  // Dedicated Share Space Settings / Edit Space Modal state without premature render resets
  const [activeSettingsSpace, setActiveSettingsSpace] = useState<ShareFolder | null>(null);
  const activeSettingsSpaceRef = useRef<ShareFolder | null>(null);
  activeSettingsSpaceRef.current = activeSettingsSpace;

  const handleOpenEditSpace = (folder: ShareFolder, e?: React.MouseEvent) => {
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

  // When hub closes or unmounts, safely clear edit space and detail view states
  useEffect(() => {
    if (!isOpen) {
      handleCloseEditSpace();
      setActiveShareDetailFolder(null);
    }
  }, [isOpen]);

  // Quick invite inside modal state
  const [invitingFolderId, setInvitingFolderId] = useState<string | null>(null);
  const [invite16Id, setInvite16Id] = useState('');
  const [inviteSelectedUser, setInviteSelectedUser] = useState<UserProfileCard | null>(null);
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Automatically publish user's public lookup card on open (only if signed in)
  useEffect(() => {
    const user = auth.currentUser || currentUser;
    if (isOpen && user) {
      const clean16 = myCleanNumericId || getOrCreateNumericId();
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
  }, [isOpen, currentUser, myCleanNumericId, myName, settings.userProfile]);

  // Dual Sync 1: Real-time inbox listener on Firebase RTDB (only if signed in)
  useEffect(() => {
    if (!isOpen || !isAuthenticated || myCleanNumericId.length !== 16) return;
    const unsub = subscribeToMyInbox(myCleanNumericId, (liveReceived) => {
      if (liveReceived && Array.isArray(liveReceived)) {
        setReceivedFolders(liveReceived);
        saveReceivedShareFolders(liveReceived);
      }
    });
    return () => unsub();
  }, [isOpen, isAuthenticated, myCleanNumericId]);

  // Dual Sync 2: Automatic 3-second periodic polling loop (only if signed in)
  useEffect(() => {
    if (!isOpen || !isAuthenticated || myCleanNumericId.length !== 16) return;

    let isMounted = true;
    const pollInbox = async () => {
      try {
        const live = await fetchMyInboxOnce(myCleanNumericId);
        if (isMounted && live && Array.isArray(live)) {
          setReceivedFolders((prev) => {
            if (
              live.length !== prev.length ||
              JSON.stringify(live.map((f) => [f.id, f.updatedAt, f.members.length])) !==
                JSON.stringify(prev.map((f) => [f.id, f.updatedAt, f.members.length]))
            ) {
              saveReceivedShareFolders(live);
              return live;
            }
            return prev;
          });
        }
      } catch (err) {
        // Quiet poll error handling
      }
    };

    pollInbox();
    const intervalId = setInterval(pollInbox, 3000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isOpen, isAuthenticated, myCleanNumericId]);

  // Real-time listener on custom events when inbox is updated globally or hub is opened
  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setReceivedFolders(e.detail);
      }
    };
    const handleOpenHub = (e: any) => {
      if (e?.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
      if (e?.detail?.folderId) {
        const received = loadReceivedShareFolders();
        const found = received.find((f) => f.id === e.detail.folderId);
        if (found) {
          setActiveShareDetailFolder(found);
        }
      }
    };
    window.addEventListener('received_shares_updated', handleUpdated);
    window.addEventListener('open_shared_accounts_hub', handleOpenHub);
    return () => {
      window.removeEventListener('received_shares_updated', handleUpdated);
      window.removeEventListener('open_shared_accounts_hub', handleOpenHub);
    };
  }, []);

  // (3) Automatically repair and migrate locally cached shared spaces on open or identity change
  useEffect(() => {
    if (isOpen) {
      const { myFolders: migratedMy, receivedFolders: migratedReceived } = repairAndMigrateSharedSpaces(
        myCleanNumericId,
        currentUser?.uid
      );
      setMyFolders(migratedMy);
      setReceivedFolders(migratedReceived);
    }
  }, [isOpen, myCleanNumericId, currentUser]);

  // (2) Strictly filter "Shared by Me" to ONLY display spaces where cleanId(space.owner16DigitId) === myClean16Id (or space.ownerUid === currentUser.uid)
  const displayedMyFolders = useMemo(() => {
    return myFolders.filter((space) => {
      const owner16 = cleanNumericId(space.owner16DigitId || space.ownerNumericId);
      const isOwnerBy16 = myCleanNumericId && owner16 && owner16 === myCleanNumericId;
      const isOwnerByUid = currentUser?.uid && space.ownerUid && space.ownerUid === currentUser.uid;
      return isOwnerBy16 || isOwnerByUid;
    });
  }, [myFolders, myCleanNumericId, currentUser]);

  // (2) Strictly filter "Shared with Me" to display all spaces where cleanId(space.owner16DigitId) !== myClean16Id (including pending & accepted)
  const displayedReceivedFolders = useMemo(() => {
    const combinedMap = new Map<string, ShareFolder>();
    for (const f of receivedFolders) {
      if (f && f.id) combinedMap.set(f.id, f);
    }
    for (const f of myFolders) {
      const owner16 = cleanNumericId(f.owner16DigitId || f.ownerNumericId);
      const isOwner = (myCleanNumericId && owner16 && owner16 === myCleanNumericId) ||
                      (currentUser?.uid && f.ownerUid && f.ownerUid === currentUser.uid);
      if (!isOwner && f && f.id) {
        combinedMap.set(f.id, f);
      }
    }

    return Array.from(combinedMap.values()).filter((space) => {
      const owner16 = cleanNumericId(space.owner16DigitId || space.ownerNumericId);
      const isOwner = (myCleanNumericId && owner16 && owner16 === myCleanNumericId) ||
                      (currentUser?.uid && space.ownerUid && space.ownerUid === currentUser.uid);
      return !isOwner;
    });
  }, [receivedFolders, myFolders, myCleanNumericId, currentUser]);

  if (!isOpen) return null;

  // If viewing dedicated full-screen ShareDetailView
  if (activeShareDetailFolder) {
    return (
      <ShareDetailView
        folder={activeShareDetailFolder}
        onExit={() => {
          setActiveShareDetailFolder(null);
          const { myFolders: refreshedMy, receivedFolders: refreshedReceived } = repairAndMigrateSharedSpaces(
            myCleanNumericId,
            currentUser?.uid
          );
          setMyFolders(refreshedMy);
          setReceivedFolders(refreshedReceived);
        }}
      />
    );
  }

  const handleCopyLink = async (folder: ShareFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await syncFolderToCloud(folder);
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

  const handleDeleteFolder = async (folder: ShareFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
    showToast(isArabic ? 'تم حذف صفحة المشاركة بنجاح' : 'Share page deleted', 'info');
  };

  const handleAddMember = async (folderId: string, e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = cleanNumericId(inviteSelectedUser?.numericId || invite16Id);
    if (cleanId.length !== 16) {
      showToast(isArabic ? 'يرجى اختيار مستخدم صالح أولاً' : 'Please select a valid user first', 'error');
      return;
    }

    setIsSendingInvite(true);
    const res = await addMemberToShareFolder(
      folderId,
      cleanId,
      inviteSelectedUser?.name,
      'viewer',
      inviteSelectedUser?.avatar,
      inviteSelectedUser?.photoURL
    );
    setIsSendingInvite(false);

    if (res.success && res.folder) {
      await syncShareFolderToCloud(res.folder).catch(() => {});
      setMyFolders(loadMyShareFolders());
      setInvite16Id('');
      setInviteSelectedUser(null);
      setInvitingFolderId(null);
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

  const handleLeaveSharedFolder = async (folder: ShareFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ok = await showConfirm({
      title: isArabic ? 'مغادرة صفحة المشاركة' : 'Leave Share Space',
      message: isArabic
        ? `هل أنت متأكد من مغادرة شير "${folder.name}"؟ ستفقد الوصول إلى هذه العناصر إلا إذا تمت دعوتك مجدداً.`
        : `Are you sure you want to leave "${folder.name}"? You will lose access unless invited again.`,
      confirmText: isArabic ? 'نعم، مغادرة' : 'Leave',
      isDanger: true,
    });
    if (!ok) return;

    await leaveShareFolder(folder.id, myCleanNumericId);
    const updated = loadReceivedShareFolders().filter((f) => f.id !== folder.id);
    setReceivedFolders(updated);
    showToast(isArabic ? 'تمت مغادرة المشاركة بنجاح' : 'Left share successfully', 'info');
  };

  const handleAcceptInvite = async (folder: ShareFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await acceptShareInvitation(folder.id, myCleanNumericId);
    setReceivedFolders(loadReceivedShareFolders());
    showToast(isArabic ? 'تم قبول الدعوة بنجاح!' : 'Invite accepted!', 'success');
  };

  const handleDeclineInvite = async (folder: ShareFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await rejectShareInvitation(folder.id, myCleanNumericId);
    setReceivedFolders(loadReceivedShareFolders());
    showToast(isArabic ? 'تم رفض الدعوة' : 'Invite declined', 'info');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in overscroll-contain"
      onClick={onClose}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg md:max-w-2xl max-h-[92dvh] my-auto bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 overscroll-contain"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{isArabic ? 'مركز المشاركة المالي' : 'Shared Spaces Hub'}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {isArabic
                  ? 'مشاركة الحسابات والتصنيفات والمعاملات بالمعرّف الرقمي لحظياً'
                  : 'Real-time collaborative financial spaces & instant member sync'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isAuthenticated ? (
          /* Guest Mode: Prominent Sign In Required Block */
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-purple-600/20 border-2 border-purple-500/40 text-purple-400 flex items-center justify-center shadow-xl shadow-purple-950/40">
                <Lock className="w-10 h-10 text-purple-300" />
              </div>
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-blue-600 border-2 border-zinc-950 text-white flex items-center justify-center shadow-md">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="max-w-md space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isArabic ? 'المشاركة السحابية مقيدة' : 'Cloud Sharing Restricted'}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {isArabic ? 'تسجيل الدخول مطلوب' : 'Sign in Required'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {isArabic
                  ? 'المعرّف المالي المكوّن من 16 رقماً ومساحات المشاركة السحابية المشفرة متاحة حصرياً للمستخدمين المسجلين. سجّل دخولك الآن لحفظ مساحاتك المشتركة، ودعوة جهات اتصالك، ومزامنة معاملاتك لحظياً وبأمان.'
                  : 'The 16-digit Financial ID and real-time collaborative shared spaces are exclusively accessible to authenticated accounts. Sign in to create shared spaces, invite members, and sync financial transactions securely in real-time.'}
              </p>
            </div>

            <div className="w-full max-w-sm pt-2 space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSigningInWithGoogle}
                className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-sm shadow-xl shadow-white/10 transition cursor-pointer flex items-center justify-center gap-3 active:scale-98 disabled:opacity-50"
              >
                {isSigningInWithGoogle ? (
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>
                  {isArabic
                    ? 'تسجيل الدخول باستخدام جوجل'
                    : 'Continue with Google'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  setIsUserProfileModalOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer hover:bg-zinc-900"
              >
                {isArabic ? 'إدارة الملف الشخصي' : 'Manage Profile'}
              </button>

              <p className="text-[11px] text-zinc-500">
                {isArabic
                  ? 'تسجيل الدخول يتيح لك مزامنة بياناتك على جميع أجهزتك مجاناً وبأمان.'
                  : 'Signing in allows multi-device real-time sync safely and for free.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* User's 16-Digit Identity Banner */}
            <div className="px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-850 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">
                {isArabic ? 'معرّفك الرقمي (16 رقم):' : 'Your 16-Digit ID:'}
              </span>
              <span className="font-bold text-purple-300 tracking-wider">
                {format16DigitId(myCleanNumericId || '0000000000000000')}
              </span>
            </div>

        {/* Two Dedicated Tabs: "Shared by Me" (أنا مشيره) and "Shared with Me" (متشير معايا) */}
        <div className="p-3 border-b border-zinc-800/60 bg-zinc-950/90 shrink-0">
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900/90 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('my_shares')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'my_shares'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>{isArabic ? 'قسم أنا مشيره' : 'Shared by Me'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300">
                {displayedMyFolders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('shared_with_me')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'shared_with_me'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-purple-400" />
              <span>{isArabic ? 'قسم متشير معايا' : 'Shared with Me'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
                {displayedReceivedFolders.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content Feed: Task-Style Block Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* SECTION 1: Shared by Me */}
          {activeTab === 'my_shares' && (
            <>
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {isArabic ? 'صفحات ومجلدات المشاركة النشطة' : 'Your Active Share Spaces'}
                </span>
                <button
                  type="button"
                  onClick={() => openShareModal({})}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إنشاء شير جديد' : 'New Share'}</span>
                </button>
              </div>

              {displayedMyFolders.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-xl">
                    📁
                  </div>
                  <p className="text-xs text-zinc-500">
                    {isArabic
                      ? 'لم تقم بمشاركة أي حسابات أو تصنيفات بعد. اضغط "إنشاء شير جديد" للبدء.'
                      : 'You have not created any shared spaces yet. Tap "New Share" to begin.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedMyFolders.map((folder) => {
                    const isInviting = invitingFolderId === folder.id;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setActiveShareDetailFolder(folder)}
                        className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-850 transition cursor-pointer space-y-3 shadow-md group"
                      >
                        {/* Task-style Card Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
                              {folder.icon || '📁'}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-bold text-white block truncate group-hover:text-purple-300 transition">
                                {folder.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                <span>{folder.itemCount} {isArabic ? 'عنصر' : 'items'}</span>
                                <span>·</span>
                                <span>{folder.members.length} {isArabic ? 'أعضاء' : 'members'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleCopyLink(folder, e)}
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                              title={isArabic ? 'نسخ الرابط' : 'Copy Link'}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvitingFolderId(isInviting ? null : folder.id)}
                              className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 transition cursor-pointer"
                              title={isArabic ? 'دعوة عضو' : 'Invite Member'}
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditSpace(folder, e);
                              }}
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                              title={isArabic ? 'إعدادات المساحة' : 'Space Settings'}
                              aria-label={isArabic ? 'إعدادات المساحة' : 'Space Settings'}
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFolder(folder, e)}
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-red-500/20 border border-zinc-800 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                              title={isArabic ? 'حذف المساحة' : 'Delete Share'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Member Badges List */}
                        {folder.members.length > 0 && (
                          <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/50 overflow-x-auto py-1">
                            {folder.members.map((m) => (
                              <div
                                key={m.numericId}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs shrink-0"
                              >
                                {m.photoURL ? (
                                  <img src={m.photoURL} alt={m.name} className="w-4 h-4 rounded-full object-cover" />
                                ) : m.avatar && m.avatar !== '👤' ? (
                                  <span className="text-[11px]">{m.avatar}</span>
                                ) : (
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-tr ${getAvatarColorGradient(
                                      m.numericId || m.name
                                    )}`}
                                  >
                                    {getMemberInitials(m.name, m.numericId).slice(0, 1)}
                                  </span>
                                )}
                                <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[80px]">
                                  {m.name}
                                </span>
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                    m.status === 'accepted'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}
                                >
                                  {isArabic ? 'نشط' : 'Active'}
                                </span>

                                {/* Quick Remove Member with Undo */}
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
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
                                      setMyFolders((prev) => prev.map((f) => (f.id === folder.id ? res.folder! : f)));
                                      showToast(
                                        isArabic ? `تم استبعاد "${m.name}" بنجاح` : `Member "${m.name}" removed`,
                                        'info',
                                        {
                                          label: isArabic ? 'تراجع' : 'Undo',
                                          onClick: async () => {
                                            await addMemberToShareFolder(folder.id, backupMember.numericId, backupMember.name, backupMember.role);
                                            setMyFolders(loadMyShareFolders());
                                            showToast(isArabic ? 'تمت استعادة العضو بنجاح' : 'Member restored', 'success');
                                          },
                                        },
                                        5000
                                      );
                                    }
                                  }}
                                  className="p-0.5 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition cursor-pointer shrink-0"
                                  title={isArabic ? 'استبعاد العضو' : 'Remove Member'}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline Add Member Box */}
                        {isInviting && (
                          <form
                            onSubmit={(e) => handleAddMember(folder.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="pt-2 border-t border-zinc-800 space-y-2.5 animate-in fade-in"
                          >
                            <UserSearchPicker
                              selectedUser={inviteSelectedUser}
                              onSelectUser={(u) => {
                                setInviteSelectedUser(u);
                                if (u) {
                                  setInvite16Id(u.numericId);
                                } else {
                                  setInvite16Id('');
                                }
                              }}
                              onVerifyingChange={setIsVerifyingInvite}
                              currentUserId={myCleanNumericId}
                              accentColor="purple"
                              isArabic={isArabic}
                              autoFocus
                            />

                            {/* Always visible Add / Invite button */}
                            <button
                              type="submit"
                              disabled={isSendingInvite || isVerifyingInvite || !inviteSelectedUser}
                              className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                inviteSelectedUser && !isVerifyingInvite && !isSendingInvite
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-purple-900/30 active:scale-95'
                                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {isSendingInvite ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>{isArabic ? 'جارٍ الإرسال...' : 'Sending...'}</span>
                                </>
                              ) : isVerifyingInvite ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                                  <span>{isArabic ? 'جارٍ التحقق...' : 'Verifying...'}</span>
                                </>
                              ) : (
                                <>
                                  <Users className="w-3.5 h-3.5" />
                                  <span>
                                    {inviteSelectedUser
                                      ? (isArabic ? `تأكيد وإضافة ${inviteSelectedUser.name || 'المستخدم'} للشير` : `Confirm & Add ${inviteSelectedUser.name || 'User'}`)
                                      : (isArabic ? 'إضافة / دعوة' : 'Add / Invite')}
                                  </span>
                                </>
                              )}
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* SECTION 2: Shared with Me */}
          {activeTab === 'shared_with_me' && (
            <>
              <div className="pb-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {isArabic ? 'دعوات ومجلدات تمت مشاركتها معك' : 'Spaces Shared with You'}
                </span>
              </div>

              {displayedReceivedFolders.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-xl">
                    📬
                  </div>
                  <p className="text-xs text-zinc-500">
                    {isArabic
                      ? 'لا توجد دعوات مشاركة واردة حالياً. شارك معرّفك الرقمي مع أصدقائك لتلقي الحسابات.'
                      : 'No incoming share invites. Share your 16-digit ID with others to receive shares.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedReceivedFolders.map((folder) => {
                    const myEntry = folder.members?.find((m) => cleanNumericId(m.numericId) === myCleanNumericId);
                    const isPending = myEntry?.status === 'pending';
                    const isEditor = myEntry?.role === 'editor';

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setActiveShareDetailFolder(folder)}
                        className={`p-3.5 rounded-2xl bg-zinc-900 border ${
                          isPending ? 'border-amber-500/40 bg-zinc-900/90' : 'border-zinc-800 hover:border-zinc-700'
                        } hover:bg-zinc-850 transition cursor-pointer space-y-3 shadow-md group`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition">
                              {folder.icon || '📁'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition">
                                  {folder.name}
                                </span>
                                {isPending ? (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>{isArabic ? 'دعوة معلقة' : 'Pending Invite'}</span>
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold">
                                    {isEditor ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                                <span>{isArabic ? 'المالك:' : 'Owner:'} {folder.ownerName}</span>
                                <span>·</span>
                                <span>{folder.itemCount} {isArabic ? 'عنصر' : 'items'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Pending Accept/Decline vs Active Leave/Open */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleAcceptInvite(folder, e)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-md shadow-emerald-950/40"
                                  title={isArabic ? 'قبول الدعوة' : 'Accept Invite'}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isArabic ? 'قبول' : 'Accept'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeclineInvite(folder, e)}
                                  className="px-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                                  title={isArabic ? 'رفض الدعوة' : 'Decline Invite'}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>{isArabic ? 'رفض' : 'Decline'}</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleLeaveSharedFolder(folder, e)}
                                  className="px-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-red-950/40 border border-zinc-800 hover:border-red-500/30 text-zinc-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                                  title={isArabic ? 'مغادرة المشاركة' : 'Leave Share'}
                                >
                                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                                  <span>{isArabic ? 'مغادرة' : 'Leave'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveShareDetailFolder(folder)}
                                  className="p-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                                  title={isArabic ? 'فتح وعرض' : 'Open & View'}
                                >
                                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        </>
        )}
      </div>

      {/* Dedicated Share Space Settings Modal - High Priority Layer */}
      {activeSettingsSpace && (
        <ShareSpaceSettingsModal
          isOpen={!!activeSettingsSpace}
          onClose={handleCloseEditSpace}
          folder={activeSettingsSpace}
          onUpdated={(updated) => {
            const next = loadMyShareFolders();
            setMyFolders(next);
            handleCloseEditSpace();
          }}
          onDeleted={() => {
            const next = loadMyShareFolders();
            setMyFolders(next);
            handleCloseEditSpace();
          }}
        />
      )}
    </div>
  );
};
