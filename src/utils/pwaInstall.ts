/**
 * Shared PWA Installation Helper
 * Guarantees native WebAPK / Standalone Home Screen Installation
 */

export interface InstallPwaOptions {
  isArabic?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onInstalled?: () => void;
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
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
      // Trigger native browser install dialog synchronously inside user gesture
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.deferredPwaPrompt = null;
      window.deferredPWAInstallPrompt = null;

      if (choice?.outcome === 'accepted') {
        if (showToast) {
          showToast(
            isArabic
              ? 'تم تثبيت التطبيق بنجاح كـ تطبيق مستقل!'
              : 'App installed successfully as a standalone app!',
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
          ? 'التطبيق مثبت بالفعل ويعمل كتطبيق مستقل على جهازك!'
          : 'App is already installed and running as a standalone app on your device!',
        'success'
      );
    }
    return true;
  }

  // Fallback 2: iOS Safari detection
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
          ? 'لتثبيت التطبيق على iPhone/iPad: اضغط على زر المشاركة (Share) في المتصفح ثم اختر "إضافة إلى الشاشة الرئيسية (Add to Home Screen)".'
          : 'To install on iOS: tap the browser Share button and select "Add to Home Screen".',
        'info'
      );
    }
    return false;
  }

  // Fallback 3: Other browsers / unsupported / prompt already consumed
  if (showToast) {
    showToast(
      isArabic
        ? 'لتثبيت التطبيق على جهازك: افتح قائمة المتصفح (⋮ أو زر المشاركة) واختر "إضافة إلى الشاشة الرئيسية" أو "تثبيت التطبيق".'
        : 'To install the app: open the browser menu (⋮ or Share) and select "Add to Home Screen" or "Install App".',
      'info'
    );
  }

  return false;
}
