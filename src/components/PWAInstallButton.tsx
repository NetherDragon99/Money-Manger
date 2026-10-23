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
    const p = (window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt || deferredPrompt;
    if (p) {
      p.prompt();
      if (p.userChoice && typeof p.userChoice.then === 'function') {
        p.userChoice
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

    try {
      const appUrl = window.location.origin + window.location.pathname;
      const isWindows = /win/i.test(navigator.platform || ua);
      const blob = isWindows
        ? new Blob([`[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\n`], { type: 'application/internet-shortcut' })
        : new Blob(
            [
              `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${appUrl}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personal Finance Tracker</title></head><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><a href="${appUrl}" style="color:#3b82f6;font-size:18px;font-weight:bold;text-decoration:none">Open Personal Finance Tracker</a><script>window.location.replace(${JSON.stringify(appUrl)});</script></body></html>`,
            ],
            { type: 'text/html;charset=utf-8' }
          );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isWindows ? 'Money-Manager.url' : 'Money-Manager-App.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {}

    showToast(
      isArabic
        ? 'تم تنزيل اختصار التطبيق المباشر! لتثبيته كتطبيق كامل، افتح قائمة المتصفح (⋮) واختر "تثبيت التطبيق / الإضافة إلى الشاشة الرئيسية".'
        : 'Direct Web-Shortcut downloaded! To install as a native app, open your browser menu (⋮) and tap "Install App / Add to Home Screen".',
      'info',
      undefined,
      6500
    );
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
