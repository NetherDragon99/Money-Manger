import React, { useState, useEffect } from 'react';
import { HardDrive, X, CloudCheck, ShieldCheck, Check } from 'lucide-react';
import {
  auth,
  getCachedAuthUser,
  getGoogleDriveAccessToken,
  requestGoogleDriveStorageAccess,
} from '../utils/firebase';
import { useApp } from '../context/AppContext';

export const DriveStoragePromptModal: React.FC = () => {
  const { settings, showToast, triggerCloudBackupNow, isAppLocked } = useApp();
  const isArabic = settings.language === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // If app is currently locked by PIN or biometrics, wait until unlocked
    if (isAppLocked) return;

    const user = auth.currentUser || getCachedAuthUser();
    const uid = user?.uid || settings.userProfile?.uid;

    if (!uid) return;

    const promptedKey = `mm_drive_perm_prompted_${uid}`;
    const alreadyPrompted = localStorage.getItem(promptedKey) === 'true';

    // If user already has an active Google Drive token, permanently mark prompted and exit
    if (getGoogleDriveAccessToken()) {
      try {
        localStorage.setItem(promptedKey, 'true');
      } catch {}
      return;
    }

    // If never prompted before, show one-time optional prompt
    if (!alreadyPrompted) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isAppLocked, settings.userProfile?.uid]);

  // Handle hardware Back button on Android / PopState
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      markPromptedAndClose();
    };

    window.history.pushState({ driveStoragePrompt: true }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const markPromptedAndClose = () => {
    const user = auth.currentUser || getCachedAuthUser();
    const uid = user?.uid || settings.userProfile?.uid;
    if (uid) {
      try {
        localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
      } catch {}
    }
    setIsOpen(false);
  };

  const handleGrant = async () => {
    const user = auth.currentUser || getCachedAuthUser();
    const uid = user?.uid || settings.userProfile?.uid;
    setIsRequesting(true);
    try {
      const res = await requestGoogleDriveStorageAccess(uid);
      if (res.success) {
        showToast(
          isArabic
            ? 'تم منح صلاحية التخزين وتفعيل النسخ على Google Drive بنجاح!'
            : 'Storage access granted and Google Drive backup activated!',
          'success'
        );
      } else {
        showToast(
          isArabic
            ? 'تم التحويل التلقائي إلى النسخ الاحتياطي عبر الخادم السحابي'
            : 'Switched to secure Cloud Server backup',
          'info'
        );
      }
      // Trigger cloud backup immediately
      triggerCloudBackupNow().catch((e) =>
        console.warn('[DriveStoragePrompt] Cloud backup error:', e)
      );
    } catch (err) {
      console.warn('[DriveStoragePrompt] Grant error:', err);
    } finally {
      if (uid) {
        try {
          localStorage.setItem(`mm_drive_perm_prompted_${uid}`, 'true');
        } catch {}
      }
      setIsRequesting(false);
      setIsOpen(false);
    }
  };

  const handleDeny = () => {
    markPromptedAndClose();
    // Seamlessly fallback to Firebase RTDB server
    triggerCloudBackupNow().catch((e) =>
      console.warn('[DriveStoragePrompt] Fallback server backup error:', e)
    );
    showToast(
      isArabic
        ? 'تم تفعيل النسخ الاحتياطي التلقائي عبر الخادم السحابي'
        : 'Automatic backup active on secure Cloud Server',
      'info'
    );
  };

  const handleClose = () => {
    markPromptedAndClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 sm:p-6 space-y-5 text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-blue-500/20 blur-2xl pointer-events-none rounded-full" />

        {/* Close Button (✕) */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95"
          aria-label={isArabic ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="flex justify-center pt-2">
          <div className="relative">
            <div className="w-16 h-16 rounded-3xl bg-blue-600/15 border-2 border-blue-500/30 text-blue-400 flex items-center justify-center shadow-lg shadow-blue-950/50">
              <HardDrive className="w-8 h-8 text-blue-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-950 text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white tracking-tight">
            {isArabic ? 'النسخ الاحتياطي عبر Google Drive' : 'Google Drive Cloud Backup'}
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed px-1">
            {isArabic
              ? 'هل ترغب في منح صلاحية التخزين لحفظ نسخة احتياطية مشفرة من بياناتك تلقائياً على Google Drive الخاص بك؟ في حال التخطي، سيتم استخدام خادمنا السحابي المشفر تلقائياً.'
              : 'Would you like to grant storage access to automatically save an encrypted backup of your data on your personal Google Drive? If skipped, our secure cloud server is used automatically.'}
          </p>
        </div>

        {/* Security & Feature Badges */}
        <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 text-left space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-zinc-300">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {isArabic
                ? 'ملف نسخ احتياطي خاص ومشفر في مساحتك السحابية'
                : 'Private encrypted backup file in your cloud storage'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-300">
            <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              {isArabic
                ? 'تحويل تلقائي سلس للخادم السحابي عند عدم التوفر'
                : 'Seamless automatic server fallback if unavailable'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Explicitly labeled "Grant Storage Access / منح صلاحية التخزين" (NEVER "Sign in Required" or "Continue with Google") */}
          <button
            type="button"
            onClick={handleGrant}
            disabled={isRequesting}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-900/30 transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <HardDrive className="w-4 h-4" />
            <span>
              {isRequesting
                ? isArabic
                  ? 'جاري التحقق...'
                  : 'Requesting Access...'
                : isArabic
                ? 'منح صلاحية التخزين'
                : 'Grant Storage Access'}
            </span>
          </button>

          {/* Optional Deny / Dismiss Button */}
          <button
            type="button"
            onClick={handleDeny}
            disabled={isRequesting}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>
              {isArabic
                ? 'ليس الآن (استخدام الخادم السحابي فقط)'
                : 'Not Now (Use Cloud Server Only)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
