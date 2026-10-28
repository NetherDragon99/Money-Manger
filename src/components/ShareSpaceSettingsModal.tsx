import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Settings, Trash2, Check, Smile, Sparkles, AlertTriangle, Loader2, Copy, RotateCw, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ShareFolder,
  updateShareFolderSettings,
  deleteShareFolder,
  ensureShareLinkToken,
  regenerateSecureShareLink,
  isSpaceOwnedByUser,
  normalize16DigitId,
} from '../utils/shareFolders';
import { EmojiPickerModal } from './EmojiPickerModal';

interface ShareSpaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ShareFolder;
  onUpdated: (updatedFolder: ShareFolder) => void;
  onDeleted: () => void;
}

const POPULAR_SPACE_ICONS = [
  '📁', '💼', '🏦', '💰', '🏠', '🛒', '✈️', '🚗',
  '👥', '🏢', '📊', '🎁', '🎉', '🍔', '🧾', '💸',
  '💎', '🔒', '🎯', '💡', '🏷️', '📦', '🔑', '☕',
];

export const ShareSpaceSettingsModal: React.FC<ShareSpaceSettingsModalProps> = ({
  isOpen,
  onClose,
  folder,
  onUpdated,
  onDeleted,
}) => {
  const { settings, showToast, showConfirm } = useApp();
  const isArabic = settings.language === 'ar';

  const [name, setName] = useState(() => folder?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(() => folder?.icon || '📁');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const cleanMyId = useMemo(() => {
    return normalize16DigitId(settings?.userProfile?.numericId);
  }, [settings?.userProfile?.numericId]);
  const isOwner = isSpaceOwnedByUser(folder, cleanMyId);

  const handleCopySecureLink = async () => {
    try {
      const { folder: updated, shareUrl } = await ensureShareLinkToken(folder);
      onUpdated(updated);
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      showToast(isArabic ? 'تم نسخ الرابط الآمن بنجاح!' : 'Secure link copied!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast(isArabic ? 'تعذر نسخ الرابط' : 'Failed to copy link', 'error');
    }
  };

  const handleRegenerateSecureLink = async () => {
    const confirmed = await showConfirm({
      title: isArabic ? 'إعادة إنشاء رابط آمن' : 'Regenerate Secure Link',
      message: isArabic
        ? 'هل ترغب في إعادة إنشاء الرابط الآمن؟\nسيتم إبطال وإلغاء الرابط القديم فوراً، وإنشاء رمز وصول سري جديد ونسخه إلى الحافظة.'
        : 'Are you sure you want to regenerate the secure link?\nThe previous link will be immediately revoked, and a new 128-bit secret link will be generated and copied to your clipboard.',
      confirmText: isArabic ? 'إعادة إنشاء ونسخ' : 'Regenerate & Copy',
      isDanger: false,
    });
    if (!confirmed) return;

    setIsRegenerating(true);
    try {
      const { folder: updated, shareUrl } = await regenerateSecureShareLink(folder);
      onUpdated(updated);
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      showToast(
        isArabic
          ? 'تم إلغاء الرابط القديم وإنشاء رابط آمن جديد ونسخه للحافظة بنجاح!'
          : 'Old link revoked. New secure link created and copied!',
        'success'
      );
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.warn('[ShareSpaceSettings] Regenerate error:', err);
      showToast(isArabic ? 'تعذر إعادة إنشاء الرابط' : 'Failed to regenerate link', 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Initialize local form state strictly ONCE when the modal transitions from closed to open
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setName(folder?.name || '');
      setSelectedIcon(folder?.icon || '📁');
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast(isArabic ? 'يرجى إدخال اسم للمساحة' : 'Please enter a space name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updated = updateShareFolderSettings(folder.id, {
        name: cleanName,
        icon: selectedIcon || '📁',
      });

      if (updated) {
        onUpdated(updated);
        showToast(
          isArabic ? 'تم تحديث إعدادات المساحة بنجاح ومزامنتها سحابياً!' : 'Space settings updated and synced to cloud!',
          'success'
        );
        onClose();
      } else {
        showToast(isArabic ? 'تعذر حفظ التعديلات' : 'Failed to save settings', 'error');
      }
    } catch (err) {
      console.warn('[ShareSpaceSettings] Save error:', err);
      showToast(isArabic ? 'حدث خطأ أثناء الحفظ' : 'An error occurred while saving', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSpace = async () => {
    const confirmed = await showConfirm({
      title: isArabic ? 'حذف مساحة المشاركة نهائياً' : 'Permanently Delete Share Space',
      message: isArabic
        ? `هل أنت متأكد تماماً من حذف مساحة "${folder.name}"؟\nسيتم حذفها نهائياً من حسابك، ومن خوادم السحابة، وإلغاء وصول جميع الأعضاء ومسحها من صناديقهم.`
        : `Are you sure you want to permanently delete "${folder.name}"?\nIt will be permanently removed from your app, erased from Firebase RTDB cloud, and removed from all members' inboxes.`,
      confirmText: isArabic ? 'حذف نهائي' : 'Delete Permanently',
      isDanger: true,
    });

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteShareFolder(folder.id, folder);
      showToast(isArabic ? 'تم حذف مساحة المشاركة نهائياً' : 'Share space permanently deleted', 'info');
      onDeleted();
      onClose();
    } catch (err) {
      console.warn('[ShareSpaceSettings] Delete error:', err);
      showToast(isArabic ? 'حدث خطأ أثناء حذف المساحة' : 'Error deleting share space', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        dir={isArabic ? 'rtl' : 'ltr'}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {isArabic ? 'إعدادات مساحة المشاركة' : 'Share Space Settings'}
                </h2>
                <p className="text-xs text-zinc-400">
                  {isArabic ? 'تعديل الاسم والأيقونة أو حذف المساحة' : 'Edit name, icon, or delete this space'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-6">
            {/* Space Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                {isArabic ? 'اسم المساحة المشتركة' : 'Share Space Name'}
              </label>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl shrink-0">
                  {selectedIcon || '📁'}
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isArabic ? 'مثال: مصاريف المنزل المشتركة' : 'e.g. Shared Household Expenses'}
                  maxLength={60}
                  className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-2xl text-sm text-white placeholder-zinc-500 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Icon Selector Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  {isArabic ? 'أيقونة المساحة' : 'Space Icon'}
                </label>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEmojiPickerOpen(true);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 transition cursor-pointer"
                  title={isArabic ? 'عرض المزيد من الرموز' : 'Show more icons'}
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'عرض المزيد...' : 'Show more...'}</span>
                </button>
              </div>

              <div className="grid grid-cols-8 gap-2 p-3 bg-zinc-900/60 rounded-2xl border border-zinc-850">
                {POPULAR_SPACE_ICONS.map((icon) => {
                  const isSelected = selectedIcon === icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedIcon(icon);
                      }}
                      className={`h-10 rounded-xl flex items-center justify-center text-xl transition cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-purple-600/30 border-2 border-purple-500 scale-105 shadow-md shadow-purple-500/20'
                          : 'hover:bg-zinc-800/80 border border-transparent'
                      }`}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Secure Share Link Section */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    {isArabic ? 'رابط المشاركة الآمن' : 'Secure Share Link'}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full font-mono">
                  {folder.shareLinkToken ? (isArabic ? 'مفعل' : 'Active') : (isArabic ? 'جاهز للتوليد' : 'Ready')}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {isArabic
                  ? 'رابط مشفر بـ 128 بت يتيح للمشاهدين الاطلاع على المعاملات والحسابات بدون كشف معرفات أو حسابات الأعضاء.'
                  : 'A 128-bit secret link allowing viewers to see transactions and accounts without exposing any member identities.'}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopySecureLink}
                  className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{isCopied ? (isArabic ? 'تم النسخ!' : 'Copied!') : (isArabic ? 'نسخ الرابط الآمن' : 'Copy Secure Link')}</span>
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleRegenerateSecureLink}
                    disabled={isRegenerating}
                    className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    title={isArabic ? 'إلغاء الرابط السابق وإنشاء رابط جديد' : 'Revoke previous link and create a new one'}
                  >
                    <RotateCw className={`w-3.5 h-3.5 text-blue-400 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>{isArabic ? 'إعادة إنشاء رابط آمن' : 'Regenerate secure link'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Save & Cancel Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="flex-1 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold text-sm transition cursor-pointer active:scale-98"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting || !name.trim()}
                className="flex-1 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 active:scale-98"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{isArabic ? 'حفظ التعديلات' : 'Save Changes'}</span>
              </button>
            </div>
          </form>

          {/* Danger Zone: Permanently Delete Share Space */}
          <div className="pt-4 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>{isArabic ? 'منطقة الخطر' : 'Danger Zone'}</span>
            </div>

            <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-red-300">
                  {isArabic ? 'حذف مساحة المشاركة نهائياً' : 'Delete Space Permanently'}
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  {isArabic
                    ? 'سيتم حذف هذه المساحة نهائياً من حسابك، ومن خوادم السحابية، وإلغاء وصول جميع الأعضاء ومسحها من صناديقهم.'
                    : 'Permanently deletes this share space, removes all data from Firebase cloud, and revokes access for all invited members.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDeleteSpace}
                disabled={isDeleting || isSaving}
                className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                )}
                <span>{isArabic ? 'حذف مساحة المشاركة نهائياً' : 'Permanently Delete Space'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelect={(emoji) => {
          setSelectedIcon(emoji);
          setIsEmojiPickerOpen(false);
        }}
        title={isArabic ? 'اختر أيقونة المساحة' : 'Choose Space Icon'}
      />
    </>
  );
};
