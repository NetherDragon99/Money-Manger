import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { checkForAppUpdates, applyLatestAppUpdate } from '../utils/versionChecker';
import { PWAInstallProgressModal } from './PWAInstallProgressModal';

export const PWAInstallButton: React.FC<{ compact?: boolean; deferredPrompt?: any }> = ({
  compact = false,
  deferredPrompt,
}) => {
  const { isInstalled } = usePWAInstall();
  const { settings, showToast } = useApp();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleInstallToHomeScreen = () => {
    const promptEvent = (window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt || deferredPrompt;
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      promptEvent.prompt();
      if (promptEvent.userChoice && typeof promptEvent.userChoice.then === 'function') {
        promptEvent.userChoice
          .then((choice: any) => {
            (window as any).deferredPwaPrompt = null;
            (window as any).deferredPWAInstallPrompt = null;
            if (choice?.outcome === 'accepted') {
              showToast(
                settings.language === 'ar'
                  ? 'تم تثبيت التطبيق بنجاح على جهازك!'
                  : 'App installed successfully to your device!',
                'success'
              );
            }
          })
          .catch(() => {});
      }
      return;
    }

    const isArabic = settings.language === 'ar';
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        Boolean((window.navigator as any).standalone));

    if (isStandalone || isInstalled) {
      showToast(
        isArabic
          ? 'التطبيق مثبت بالفعل ويعمل كتطبيق مستقل على جهازك!'
          : 'App is already installed and running as a standalone app on your device!',
        'success'
      );
      return;
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (/iphone|ipad|ipod/.test(ua)) {
      showToast(
        isArabic
          ? 'لتثبيت التطبيق على iPhone/iPad: اضغط زر المشاركة (Share) في المتصفح ثم اختر "إضافة إلى الشاشة الرئيسية (Add to Home Screen)".'
          : 'To install on iOS: tap the browser Share button and select "Add to Home Screen".',
        'info',
        undefined,
        6500
      );
      return;
    }

    window.dispatchEvent(new CustomEvent('open-pwa-offline-modal'));
  };

  const handleManualUpdateCheck = async () => {
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdates();
      if (result.hasUpdate) {
        showToast(
          settings.language === 'ar'
            ? `تم العثور على إصدار أحدث (v${result.latestVersion}). جارٍ التحديث الآن...`
            : `New version found (v${result.latestVersion}). Updating now...`,
          'info'
        );
        setTimeout(() => {
          applyLatestAppUpdate();
        }, 800);
      } else {
        showToast(
          settings.language === 'ar'
            ? 'تطبيقك مُحدّث بالكامل إلى أحدث إصدار!'
            : 'Your app is up to date with the latest version!',
          'success'
        );
      }
    } catch {
      showToast('Could not check for updates right now', 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="space-y-2 w-full">
      {isInstalled ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              {settings.language === 'ar'
                ? 'مثبت على الشاشة الرئيسية (بدون شريط متصفح)'
                : 'Installed on Home Screen (Standalone)'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualUpdateCheck}
            disabled={checkingUpdate}
            aria-label="Check for updates"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstallToHomeScreen}
          className={`flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium shadow-lg shadow-blue-900/30 transition cursor-pointer ${
            compact ? 'px-3 py-1.5 text-xs' : 'w-full py-2.5 text-sm'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{settings.language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}</span>
        </button>
      )}
    </div>
  );
};
