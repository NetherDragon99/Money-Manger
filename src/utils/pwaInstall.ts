/**
 * Shared PWA Installation & Offline Readiness Helper
 * Guarantees direct native WebAPK / Standalone Home Screen Installation without intrusive instruction popups,
 * plus live offline cache status verification isolated strictly to the active channel.
 */

import { isCurrentChannelCacheName, isRegistrationForCurrentChannel } from './channel';

export interface InstallPwaOptions {
  isArabic?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onInstalled?: () => void;
}

export interface OfflineReadinessStatus {
  isReady: boolean;
  cachedCount: number;
  swActive: boolean;
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
}

/**
 * Checks whether the current channel's Service Worker is active AND its Workbox precache holds index.html.
 */
export async function getOfflineReadinessStatus(): Promise<OfflineReadinessStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('caches' in window)) {
    return { isReady: false, cachedCount: 0, swActive: false };
  }

  try {
    let swActive = Boolean(navigator.serviceWorker.controller);
    if (!swActive) {
      const regs = await navigator.serviceWorker.getRegistrations();
      swActive = regs.some((r) => isRegistrationForCurrentChannel(r) && Boolean(r.active));
    }

    const cacheNames = await caches.keys();
    let cachedCount = 0;
    let hasIndexHtml = false;

    for (const name of cacheNames) {
      if (!isCurrentChannelCacheName(name)) continue;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      cachedCount += keys.length;
      if (keys.some((req) => req.url.includes('index.html') || req.url.endsWith('/'))) {
        hasIndexHtml = true;
      }
    }

    return {
      isReady: swActive && hasIndexHtml && cachedCount > 0,
      cachedCount,
      swActive,
    };
  } catch {
    return { isReady: false, cachedCount: 0, swActive: false };
  }
}

/**
 * Safely updates the current channel's Service Worker & verifies its offline cache
 * without EVER deleting precached files.
 */
export async function warmAndVerifyOfflineCache(): Promise<OfflineReadinessStatus> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (!isRegistrationForCurrentChannel(reg)) continue;
        if (typeof navigator === 'undefined' || navigator.onLine) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
    } catch {}
  }

  return getOfflineReadinessStatus();
}

export async function installPwa(options?: InstallPwaOptions): Promise<boolean> {
  const isArabic = options?.isArabic ?? false;
  const showToast = options?.showToast;

  // IMPORTANT: The promptEvent.prompt() MUST be invoked as the very first synchronous statement
  // inside the user click gesture. Nothing must be awaited before promptEvent.prompt().
  const promptEvent =
    typeof window !== 'undefined'
      ? window.deferredPwaPrompt || window.deferredPWAInstallPrompt
      : null;

  if (promptEvent && typeof promptEvent.prompt === 'function') {
    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.deferredPwaPrompt = null;
      window.deferredPWAInstallPrompt = null;

      if (choice?.outcome === 'accepted') {
        if (showToast) {
          showToast(
            isArabic
              ? 'تم تثبيت solv بنجاح كتطبيق مستقل!'
              : 'solv installed successfully as a standalone app!',
            'success'
          );
        }
        options?.onInstalled?.();
        window.dispatchEvent(new CustomEvent('app-installed-event'));
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Native install prompt error:', err);
    }
  }

  // Fallback 1: App is already installed and running standalone
  if (isStandaloneApp()) {
    if (showToast) {
      showToast(
        isArabic
          ? 'تطبيق solv مثبت بالفعل ويعمل كتطبيق مستقل!'
          : 'solv is already installed and running as a standalone app!',
        'success'
      );
    }
    return true;
  }

  // Fallback 2: iOS Safari detection (Apple blocks programmatic beforeinstallprompt)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);

  if (isIOS) {
    if (showToast) {
      showToast(
        isArabic
          ? 'لتثبيت solv على iPhone/iPad: اضغط زر المشاركة (Share) واختر "إضافة إلى الشاشة الرئيسية".'
          : 'To install solv on iOS: tap Share and select "Add to Home Screen".',
        'info'
      );
    }
    return false;
  }

  // Fallback 3: Non-iOS when native prompt isn't held right now — warm offline cache & inform cleanly
  // (NEVER pop up multi-step installation instructions dialog/toast!)
  const readiness = await warmAndVerifyOfflineCache();
  if (showToast) {
    showToast(
      isArabic
        ? readiness.isReady
          ? 'ملفات solv جاهزة للأوفلاين — سيظهر التثبيت التلقائي فور سماح المتصفح.'
          : 'جاري تجهيز ملفات solv للأوفلاين...'
        : readiness.isReady
        ? 'solv is cached for offline use — install prompt will trigger when browser allows.'
        : 'Preparing solv offline files...',
      readiness.isReady ? 'success' : 'info'
    );
  }

  return false;
}
