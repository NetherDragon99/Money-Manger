import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { checkForAppUpdates, applyLatestAppUpdate } from '../utils/versionChecker';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstalled, install } = usePWAInstall();
  const { settings, showToast } = useApp();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleInstallToHomeScreen = async () => {
    try {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      const promptEvent = win?.deferredPwaPrompt || win?.deferredPWAInstallPrompt;

      if (promptEvent && typeof promptEvent.prompt === 'function') {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'accepted') {
          showToast(
            settings.language === 'ar'
              ? 'تم تثبيت التطبيق بنجاح كـ تطبيق مستقل!'
              : 'App installed successfully as a standalone app!',
            'success'
          );
          if (win) {
            win.deferredPwaPrompt = null;
            win.deferredPWAInstallPrompt = null;
          }
          return;
        }
      } else {
        const accepted = await install();
        if (accepted) {
          showToast(
            settings.language === 'ar'
              ? 'تم تثبيت التطبيق بنجاح!'
              : 'App installed successfully!',
            'success'
          );
          return;
        }
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }

    showToast(
      settings.language === 'ar'
        ? 'يمكنك تثبيت التطبيق مباشرة من خيارات المتصفح (⋮) -> تثبيت التطبيق.'
        : 'You can install the app directly via browser options (⋮) -> Install App.',
      'info'
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
