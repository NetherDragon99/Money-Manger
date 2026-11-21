import { useEffect, useState } from 'react';
import {
  installPwa,
  isStandaloneApp,
  getOfflineReadinessStatus,
  warmAndVerifyOfflineCache,
  type OfflineReadinessStatus,
} from '../utils/pwaInstall';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      return win.deferredPwaPrompt || win.deferredPWAInstallPrompt || null;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneApp());
  const [isIOS, setIsIOS] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState<OfflineReadinessStatus>({
    isReady: false,
    cachedCount: 0,
    swActive: false,
  });

  useEffect(() => {
    setIsInstalled(isStandaloneApp());

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const refreshOfflineStatus = () => {
      getOfflineReadinessStatus()
        .then(setOfflineStatus)
        .catch(() => {});
    };

    refreshOfflineStatus();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      const win = window as any;
      win.deferredPwaPrompt = promptEvent;
      win.deferredPWAInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      const win = window as any;
      win.deferredPwaPrompt = null;
      win.deferredPWAInstallPrompt = null;
    };

    const handleEarlyPromptReady = (e?: any) => {
      const win = window as any;
      const promptEvent = e?.detail || win.deferredPwaPrompt || win.deferredPWAInstallPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('app-installed-event', handleAppInstalled);
    window.addEventListener('pwa-install-ready', handleEarlyPromptReady);
    window.addEventListener('solv_offline_ready', refreshOfflineStatus);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', refreshOfflineStatus);
    }

    const win = window as any;
    if (win.deferredPwaPrompt || win.deferredPWAInstallPrompt) {
      setDeferredPrompt(win.deferredPwaPrompt || win.deferredPWAInstallPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('app-installed-event', handleAppInstalled);
      window.removeEventListener('pwa-install-ready', handleEarlyPromptReady);
      window.removeEventListener('solv_offline_ready', refreshOfflineStatus);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', refreshOfflineStatus);
      }
    };
  }, []);

  const install = async () => {
    return installPwa();
  };

  const refreshCache = async () => {
    const status = await warmAndVerifyOfflineCache();
    setOfflineStatus(status);
    return status;
  };

  return {
    isInstallable:
      !isInstalled &&
      (!!deferredPrompt ||
        (typeof window !== 'undefined' &&
          !!((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt))),
    isInstalled,
    isIOS,
    install,
    deferredPrompt,
    offlineStatus,
    refreshCache,
  };
}
