/**
 * Safely resolves the active app language ('en' | 'ar') without depending on React hooks or context.
 * Reads from the exact settings storage key used by storage.ts/AppContext ('pwa_finance_settings'),
 * then falls back to direct language keys, document.documentElement.lang, navigator.language,
 * and defaults safely to 'en'.
 */
export function getActiveLanguage(): 'en' | 'ar' {
  if (typeof window === 'undefined') return 'en';
  try {
    // 1. Check exact storage key used by storage.ts / AppContext
    const rawSettings = localStorage.getItem('pwa_finance_settings');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed && typeof parsed === 'object') {
        if (parsed.language === 'ar') return 'ar';
        if (parsed.language === 'en') return 'en';
      }
    }

    // 2. Check direct language keys if saved individually
    const direct = localStorage.getItem('language') || localStorage.getItem('app_language');
    if (direct === 'ar') return 'ar';
    if (direct === 'en') return 'en';

    // 3. Check document element lang attribute
    const docLang = document.documentElement.lang?.toLowerCase();
    if (docLang?.startsWith('ar')) return 'ar';
    if (docLang?.startsWith('en')) return 'en';

    // 4. Check navigator language
    const navLang = navigator.language?.toLowerCase();
    if (navLang?.startsWith('ar')) return 'ar';
    if (navLang?.startsWith('en')) return 'en';
  } catch {
    // Return default on storage or JSON parse exceptions
  }
  return 'en';
}

/**
 * Safely resets app cache (Service Workers, Cache Storage, sessionStorage)
 * without touching localStorage or IndexedDB financial data, accounts, or settings.
 */
export async function resetAppCacheSafely(): Promise<void> {
  const isAr = getActiveLanguage() === 'ar';
  const confirmMsg = isAr
    ? 'هل أنت متأكد من رغبتك في إعادة تعيين ذاكرة التخزين المؤقت للتطبيق؟ لن يتم حذف أي من بياناتك المالية أو حساباتك المحفوظة.'
    : 'Are you sure you want to reset the app cache? None of your financial data, accounts, or settings will be deleted.';

  if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
    return;
  }

  try {
    // 1. Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
  } catch {
    // Ignore SW unregister errors
  }

  try {
    // 2. Delete Cache Storage entries
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch {
    // Ignore cache storage errors
  }

  try {
    // 3. Clear sessionStorage ONLY (never touching localStorage or IndexedDB!)
    sessionStorage.clear();
  } catch {
    // Ignore sessionStorage errors
  }

  // 4. Reload page cleanly
  window.location.reload();
}
