import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Users, ShieldCheck, RefreshCw, Trash2, Key } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Account, Transaction } from '../types';
import {
  auth,
  publishSharedAccount,
  stopSharingAccount,
  listenToSharedAccount,
  SharedAccountData,
} from '../utils/firebase';

interface SharedAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  transactions: Transaction[];
}

export const SharedAccountModal: React.FC<SharedAccountModalProps> = ({
  isOpen,
  onClose,
  account,
  transactions,
}) => {
  const { settings, showToast } = useApp();
  const isArabic = settings.language === 'ar';

  const [sharedId, setSharedId] = useState<string>(`share_${account.id}`);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = listenToSharedAccount(`share_${account.id}`, (data) => {
      setIsShared(!!data);
    });
    return () => unsub();
  }, [isOpen, account.id]);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const user = auth.currentUser;
      const ownerUid = user ? user.uid : 'device_local_owner';
      const ownerEmail = user?.email || user?.displayName || 'Family Account Owner';

      const id = await publishSharedAccount(ownerUid, ownerEmail, account, transactions);
      setSharedId(id);
      setIsShared(true);
      showToast(
        isArabic ? 'تم تفعيل المشاركة السحابية الحية للحساب!' : 'Account shared to live cloud sync!',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to share account', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStopSharing = async () => {
    try {
      await stopSharingAccount(`share_${account.id}`);
      setIsShared(false);
      showToast(isArabic ? 'تم إيقاف مشاركة الحساب' : 'Account sharing stopped', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Error stopping share', 'error');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sharedId);
    setIsCopied(true);
    showToast(isArabic ? 'تم نسخ رمز المشاركة للحافظة!' : 'Share code copied to clipboard!', 'info');
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl p-6 text-white overflow-hidden transition-all duration-200 ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isArabic ? 'المشاركة الحية للحساب' : 'Live Shared Account'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {account.icon} {account.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {isArabic
              ? 'شارك هذا الحساب المالي مع عائلتك أو شريكك لمزامنة الرصيد والمعاملات لحظياً عبر السحابة المشفرة.'
              : 'Collaborate on this account with partners or family. Balances and transactions sync in real time securely.'}
          </p>

          {isShared ? (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isArabic ? 'المزامنة الحية نشطة' : 'Live Sync Active'}</span>
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono">Encrypted</span>
              </div>

              {/* Share Code & Link Box */}
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1 font-semibold uppercase">
                  {isArabic ? 'رمز ورابط المشاركة الحية' : 'Account Share Code & Link'}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-amber-300 truncate select-all">
                    {sharedId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white transition active:scale-95 cursor-pointer"
                    title="Copy Code"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-300" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const url = new URL(`shared-view.html?sharedAccountId=${encodeURIComponent(sharedId)}`, window.location.href).href;
                        navigator.clipboard.writeText(url);
                        showToast(isArabic ? 'تم نسخ الرابط المباشر بنجاح!' : 'Direct link copied to clipboard!', 'success');
                      } catch {
                        navigator.clipboard.writeText(sharedId);
                        showToast(isArabic ? 'تم نسخ الرمز بنجاح!' : 'Code copied to clipboard!', 'info');
                      }
                    }}
                    className="px-2.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 text-xs font-semibold transition active:scale-95 cursor-pointer flex items-center gap-1"
                    title="Copy Direct Link"
                  >
                    <span>{isArabic ? 'رابط' : 'Link'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="flex-1 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                  <span>{isArabic ? 'تحديث السحابة' : 'Push Update'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStopSharing}
                  className="flex-1 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-800/60 text-red-400 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إيقاف المشاركة' : 'Stop Sharing'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>{isArabic ? 'جاهز للمشاركة الحية' : 'Ready to collaborate'}</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {isArabic
                  ? 'عند الضغط على تفعيل، سيتم إنشاء مفتاح مشفر يمكن لأي شخص مصرح له استخدامه لمزامنة الحساب.'
                  : 'Click below to publish this account and get an invite code for other devices.'}
              </p>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Share2 className="w-4 h-4" />
                <span>{isPublishing ? (isArabic ? 'جارٍ النشر...' : 'Publishing...') : (isArabic ? 'تفعيل المشاركة الحية' : 'Enable Live Cloud Sharing')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
