import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadOfflineAppBundle } from '../utils/offlineBundle';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const { t, settings, accounts, categories, transactions, showToast } = useApp();

  const handleDownloadAndInstall = async () => {
    // 1. If native PWA browser installation is available, trigger native home-screen install prompt
    if (isInstallable) {
      try {
        const accepted = await install();
        if (accepted) {
          showToast(
            settings.language === 'ar'
              ? 'تم تثبيت التطبيق على الشاشة الرئيسية بنجاح!'
              : 'App installed to your Home Screen successfully!',
            'success'
          );
          return;
        }
      } catch (err) {
        console.warn('Native install prompt error:', err);
      }
    }

    // 2. Trigger direct file download of the standalone application package to device storage
    try {
      downloadOfflineAppBundle(
        { accounts, categories, transactions, settings },
        settings.language || 'en'
      );
      showToast(
        settings.language === 'ar'
          ? 'تم تنزيل حزمة التطبيق إلى ذاكرة جهازك بنجاح!'
          : 'App downloaded directly to your device storage!',
        'success'
      );
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <>
      {isInstalled ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-emerald-400">
          <Check className="w-4 h-4 shrink-0" />
          <span>{t('installedPWA')}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleDownloadAndInstall}
          className={`flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium shadow-lg shadow-blue-900/30 transition cursor-pointer ${
            compact ? 'px-3 py-1.5 text-xs' : 'w-full py-2.5 text-sm'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{t('installApp')}</span>
        </button>
      )}
    </>
  );
};
