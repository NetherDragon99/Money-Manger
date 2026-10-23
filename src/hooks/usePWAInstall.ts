import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined') {
      const win = window as any;
      return win.deferredPwaPrompt || win.deferredPWAInstallPrompt || null;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect standalone mode (opened from Home Screen without browser address bar)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

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
    window.addEventListener('pwa-install-ready', handleEarlyPromptReady);

    const win = window as any;
    if (win.deferredPwaPrompt || win.deferredPWAInstallPrompt) {
      setDeferredPrompt(win.deferredPwaPrompt || win.deferredPWAInstallPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-install-ready', handleEarlyPromptReady);
    };
  }, []);

  const install = async () => {
    const win = window as any;
    const promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined'
        ? win.deferredPwaPrompt || win.deferredPWAInstallPrompt
        : null);

    if (!promptEvent || typeof promptEvent.prompt !== 'function') return false;

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        win.deferredPwaPrompt = null;
        win.deferredPWAInstallPrompt = null;
        return true;
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
    }
    return false;
  };

  return {
    isInstallable:
      !!deferredPrompt ||
      (typeof window !== 'undefined' &&
        !!((window as any).deferredPwaPrompt || (window as any).deferredPWAInstallPrompt)),
    isInstalled,
    isIOS,
    install,
    deferredPrompt,
  };
}
