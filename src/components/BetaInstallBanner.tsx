import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { IS_BETA_BUILD } from '../utils/channel';
import { installPwa } from '../utils/pwaInstall';
import { useApp } from '../context/AppContext';

export const BetaInstallBanner: React.FC = () => {
  const { settings, showToast } = useApp();
  const isArabic = settings.language === 'ar';

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mm_dismiss_beta_install_banner') === 'true';
    } catch {
      return false;
    }
  });

  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  const [hasPrompt, setHasPrompt] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt);
  });

  useEffect(() => {
    if (!IS_BETA_BUILD) return;

    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(standalone);
    };

    const handlePrompt = () => {
      setHasPrompt(true);
    };

    const handleInstalled = () => {
      setDismissed(true);
      try {
        localStorage.setItem('mm_dismiss_beta_install_banner', 'true');
      } catch {}
    };

    window.addEventListener('pwa-install-ready', handlePrompt);
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const mql = window.matchMedia('(display-mode: standalone)');
    if (mql?.addEventListener) {
      mql.addEventListener('change', checkStandalone);
    }

    return () => {
      window.removeEventListener('pwa-install-ready', handlePrompt);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      if (mql?.removeEventListener) {
        mql.removeEventListener('change', checkStandalone);
      }
    };
  }, []);

  // Only show inside beta build and if not dismissed
  if (!IS_BETA_BUILD || dismissed) return null;

  // Show if in browser tab (!isStandalone) OR if beforeinstallprompt is active even in standalone window
  // (which occurs when running cross-channel inside a stable-installed standalone window)
  const shouldShow = !isStandalone || hasPrompt;
  if (!shouldShow) return null;

  const handleInstall = () => {
    installPwa({
      isArabic,
      showToast,
    });
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('mm_dismiss_beta_install_banner', 'true');
    } catch {}
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed top-2 inset-x-2 sm:inset-x-auto sm:end-4 sm:max-w-md z-50 p-2.5 sm:p-3 rounded-2xl bg-zinc-900/95 backdrop-blur-md border border-blue-500/30 shadow-2xl flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-3 duration-300"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
          <Download className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-xs truncate">
            {isArabic ? 'تثبيت تطبيق بيتا' : 'Install the Beta app'}
          </p>
          <p className="text-[10px] text-zinc-400 leading-tight line-clamp-2">
            {isArabic
              ? 'يظل إصدار بيتا مفتوحاً ومستقلاً بعد الإغلاق عند تثبيته كتطبيق منفصل.'
              : 'Beta stays open after closing when installed as its own app.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstall}
          className="min-h-[32px] px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition shadow-sm cursor-pointer"
        >
          {isArabic ? 'تثبيت' : 'Install'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={isArabic ? 'إغلاق' : 'Dismiss'}
          className="w-7 h-7 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
