import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Category, Transaction } from '../types';
import { format16DigitId, cleanNumericId, format16DigitInput } from '../utils/userId';
import { UserSearchPicker } from './UserSearchPicker';
import {
  loadMyShareFolders,
  loadReceivedShareFolders,
  saveMyShareFolders,
  saveReceivedShareFolders,
  deleteShareFolder,
  addMemberToShareFolder,
  removeMemberFromShareFolder,
  acceptShareInvitation,
  rejectShareInvitation,
  leaveShareFolder,
  generateShareUrl,
  subscribeToMyInbox,
  subscribeToShareFolder,
  fetchShareFolderFromCloud,
  extractShareIdFromUrl,
  registerReceivedShareFolder,
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
  } = useApp();

  const isArabic = settings.language === 'ar';
  const myCleanNumericId = cleanNumericId(settings.userProfile?.numericId || '');
  const myName = settings.userProfile?.name || 'User';

  const [activeTab, setActiveTab] = useState<'my_shares' | 'shared_with_me'>('my_shares');
  const [myFolders, setMyFolders] = useState<ShareFolder[]>(() => loadMyShareFolders());
  const [receivedFolders, setReceivedFolders] = useState<ShareFolder[]>(() => loadReceivedShareFolders());

  // Full-screen native detail page view state
  const [activeShareDetailFolder, setActiveShareDetailFolder] = useState<ShareFolder | null>(null);

  // Quick invite inside modal state
  const [invitingFolderId, setInvitingFolderId] = useState<string | null>(null);
  const [invite16Id, setInvite16Id] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSelectedUser, setInviteSelectedUser] = useState<UserProfileCard | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Join via link state
  const [joinLinkInput, setJoinLinkInput] = useState('');
  const [isJoiningByLink, setIsJoiningByLink] = useState(false);

  // Automatically publish user's public lookup card on open
  useEffect(() => {
    if (isOpen && myCleanNumericId.length === 16) {
      publishUserProfileCard({
        numericId: myCleanNumericId,
        name: myName,
        avatar: settings.userProfile?.avatarEmoji || '👤',
        photoURL: settings.userProfile?.customAvatarUrl || '',
      });
    }
  }, [isOpen, myCleanNumericId, myName, settings.userProfile]);

  // Real-time inbox listener on Firebase RTDB (shared_accounts/inbox_${myCleanNumericId})
  useEffect(() => {
    if (!isOpen || myCleanNumericId.length !== 16) return;
    const unsub = subscribeToMyInbox(myCleanNumericId, (liveReceived) => {
      if (liveReceived && Array.isArray(liveReceived)) {
        setReceivedFolders(liveReceived);
        saveReceivedShareFolders(liveReceived);
      }
    });
    return () => unsub();
  }, [isOpen, myCleanNumericId]);

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

  // Real-time listener for current user's created share pages
  useEffect(() => {
    if (isOpen) {
      setMyFolders(loadMyShareFolders());
      setReceivedFolders(loadReceivedShareFolders());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // If viewing dedicated full-screen ShareDetailView
  if (activeShareDetailFolder) {
    return (
      <ShareDetailView
        folder={activeShareDetailFolder}
        onExit={() => {
          setActiveShareDetailFolder(null);
          setMyFolders(loadMyShareFolders());
          setReceivedFolders(loadReceivedShareFolders());
        }}
      />
    );
  }

  const handleCopyLink = async (folder: ShareFolder, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
      inviteName.trim() || inviteSelectedUser?.name,
      'viewer',
      inviteSelectedUser?.avatar,
      inviteSelectedUser?.photoURL
    );
    setIsSendingInvite(false);

    if (res.success && res.folder) {
      setMyFolders(loadMyShareFolders());
      setInvite16Id('');
      setInviteName('');
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

  const handleJoinByLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const shareId = extractShareIdFromUrl(joinLinkInput);
    if (!shareId) {
      showToast(isArabic ? 'يرجى إدخال رابط أو كود شير صحيح' : 'Please enter a valid share link or ID', 'error');
      return;
    }

    setIsJoiningByLink(true);
    try {
      const folder = await fetchShareFolderFromCloud(shareId);
      if (folder) {
        const registered = await registerReceivedShareFolder(
          folder,
          myCleanNumericId,
          myName,
          settings.userProfile?.avatarEmoji,
          settings.userProfile?.customAvatarUrl
        );
        const updated = loadReceivedShareFolders();
        setReceivedFolders(updated);
        setJoinLinkInput('');
        setActiveShareDetailFolder(registered);
        showToast(
          isArabic
            ? `تم الانضمام إلى شير "${folder.name}" بنجاح!`
            : `Joined "${folder.name}" successfully!`,
          'success'
        );
      } else {
        showToast(
          isArabic
            ? 'لم يتم العثور على هذا الشير، يرجى التأكد من صحة الرابط أو الكود'
            : 'Share space not found, please verify link or ID',
          'error'
        );
      }
    } catch {
      showToast(isArabic ? 'حدث خطأ أثناء الانضمام' : 'Error joining share', 'error');
    } finally {
      setIsJoiningByLink(false);
    }
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
                {myFolders.length}
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
                {receivedFolders.length}
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

              {myFolders.length === 0 ? (
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
                  {myFolders.map((folder) => {
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
                              title="Copy Link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvitingFolderId(isInviting ? null : folder.id)}
                              className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 transition cursor-pointer"
                              title="Invite Member"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFolder(folder, e)}
                              className="p-2 rounded-xl bg-zinc-950 hover:bg-red-500/20 border border-zinc-800 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                              title="Delete Share"
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
                                  setInviteName(u.name);
                                } else {
                                  setInvite16Id('');
                                  setInviteName('');
                                }
                              }}
                              currentUserId={myCleanNumericId}
                              accentColor="purple"
                              isArabic={isArabic}
                              autoFocus
                            />

                            {inviteSelectedUser && (
                              <div className="flex items-center gap-2 animate-in fade-in">
                                <input
                                  type="text"
                                  placeholder={inviteSelectedUser.name || (isArabic ? 'اسم أو لقب العضو (اختياري)' : 'Name or Nickname (optional)')}
                                  value={inviteName}
                                  onChange={(e) => setInviteName(e.target.value)}
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-750 text-xs text-white focus:outline-none focus:border-purple-500"
                                />
                                <button
                                  type="submit"
                                  disabled={isSendingInvite || !inviteSelectedUser}
                                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                >
                                  <Users className="w-3 h-3" />
                                  <span>{isSendingInvite ? (isArabic ? 'إرسال...' : 'Sending...') : (isArabic ? 'دعوة' : 'Invite')}</span>
                                </button>
                              </div>
                            )}
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

              {/* Join via Share Link / Code Input Bar */}
              <form onSubmit={handleJoinByLink} className="flex gap-2">
                <input
                  type="text"
                  value={joinLinkInput}
                  onChange={(e) => setJoinLinkInput(e.target.value)}
                  placeholder={isArabic ? 'ألصق رابط شير أو كود للانضمام الفوري...' : 'Paste share link or ID to join...'}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition"
                />
                <button
                  type="submit"
                  disabled={isJoiningByLink || !joinLinkInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isJoiningByLink ? '...' : isArabic ? 'انضمام' : 'Join'}</span>
                </button>
              </form>

              {receivedFolders.length === 0 ? (
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
                  {receivedFolders.map((folder) => {
                    const myEntry = folder.members?.find((m) => cleanNumericId(m.numericId) === myCleanNumericId);
                    const isEditor = myEntry?.role === 'editor';

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setActiveShareDetailFolder(folder)}
                        className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 transition cursor-pointer space-y-3 shadow-md group"
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
                                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold">
                                  {isEditor ? (isArabic ? 'محرر' : 'Editor') : (isArabic ? 'مشاهد' : 'Viewer')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                                <span>{isArabic ? 'المالك:' : 'Owner:'} {folder.ownerName}</span>
                                <span>·</span>
                                <span>{folder.itemCount} {isArabic ? 'عنصر' : 'items'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Leave & Open */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
};
