/**
 * Application Channel Configuration & Strict Channel Isolation Helpers
 * Exposes build-time channel ('stable' by default, 'beta' via vite build --mode beta),
 * channel-namespaced localStorage keys, cache isolation, and safe offline-aware channel navigation.
 */

export type AppChannel = 'stable' | 'beta';

export const APP_CHANNEL: AppChannel =
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_CHANNEL === 'beta'
    ? 'beta'
    : 'stable';

export const IS_BETA_BUILD: boolean = APP_CHANNEL === 'beta';

export const CHANNEL_STORAGE_SUFFIX: '_beta' | '_stable' = IS_BETA_BUILD ? '_beta' : '_stable';

export const PREFERRED_CHANNEL_KEY = 'mm_preferred_channel';

/**
 * Namespaces per-channel control keys (update state, what's new seen flags, reload loop guards)
 * so Stable and Beta never overwrite each other's lifecycle flags.
 */
export function channelKey(baseKey: string): string {
  return `${baseKey}${CHANNEL_STORAGE_SUFFIX}`;
}

/**
 * Reads the device-local preferred channel ('beta' | 'stable' | null).
 * Strictly local to this device — never synced to Firebase or Drive.
 */
export function getPreferredChannel(): AppChannel | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFERRED_CHANNEL_KEY);
    if (raw === 'beta' || raw === 'stable') return raw;
    if (localStorage.getItem('mm_join_beta') === 'true') return 'beta';
  } catch {}
  return null;
}

/**
 * Persists the device-local preferred channel without touching cloud settings.
 */
export function setPreferredChannel(ch: AppChannel | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (ch === null) {
      localStorage.removeItem(PREFERRED_CHANNEL_KEY);
      localStorage.removeItem('mm_join_beta');
    } else {
      localStorage.setItem(PREFERRED_CHANNEL_KEY, ch);
      if (ch === 'beta') {
        localStorage.setItem('mm_join_beta', 'true');
      } else {
        localStorage.removeItem('mm_join_beta');
      }
    }
  } catch {}
}

/**
 * Returns true ONLY if the given Cache Storage entry belongs to the active channel.
 * Guarantees that updating/refreshing Stable never wipes Beta caches and vice-versa.
 */
export function isCurrentChannelCacheName(cacheName: string): boolean {
  const name = cacheName.toLowerCase();
  if (IS_BETA_BUILD) {
    return name.includes('solv-beta') || name.includes('mm-beta') || name.includes('-beta');
  }
  // Stable: match solv-stable or legacy non-beta caches, never touch beta caches
  if (name.includes('beta')) return false;
  return true;
}

/**
 * Checks whether a Service Worker registration belongs to the current channel's scope.
 */
export function isRegistrationForCurrentChannel(reg: ServiceWorkerRegistration): boolean {
  try {
    const scopePath = new URL(reg.scope).pathname;
    const isRegBeta = /\/beta(\/|$)/.test(scopePath);
    return isRegBeta === IS_BETA_BUILD;
  } catch {
    return true;
  }
}

/**
 * Safely resolves the absolute stable and beta base URLs without hardcoded paths.
 * Derived from build config (import.meta.env.BASE_URL) and window.location.origin.
 */
function resolveChannelBaseUrls(): { stable: string; beta: string } {
  if (typeof window === 'undefined') {
    return { stable: 'http://localhost/', beta: 'http://localhost/beta/' };
  }

  const origin = window.location.origin;
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';

  if (baseUrl.startsWith('/')) {
    if (IS_BETA_BUILD) {
      const betaAbs = new URL(baseUrl, origin).href;
      const stableAbs = new URL('../', betaAbs).href;
      return { stable: stableAbs, beta: betaAbs };
    } else {
      const stableAbs = new URL(baseUrl, origin).href;
      const betaAbs = new URL('beta/', stableAbs).href;
      return { stable: stableAbs, beta: betaAbs };
    }
  }

  const pathname = window.location.pathname;
  if (IS_BETA_BUILD) {
    const betaEndIndex = pathname.lastIndexOf('beta/');
    const betaPath = betaEndIndex >= 0 ? pathname.substring(0, betaEndIndex + 5) : '/beta/';
    const betaAbs = new URL(betaPath, origin).href;
    const stablePath = betaPath.replace(/beta\/$/, '');
    const stableAbs = new URL(stablePath || '/', origin).href;
    return { stable: stableAbs, beta: betaAbs };
  } else {
    const lastSlashIndex = pathname.lastIndexOf('/');
    const stablePath = lastSlashIndex >= 0 ? pathname.substring(0, lastSlashIndex + 1) : '/';
    const stableAbs = new URL(stablePath, origin).href;
    const betaAbs = new URL('beta/', stableAbs).href;
    return { stable: stableAbs, beta: betaAbs };
  }
}

export const STABLE_BASE_URL: string = resolveChannelBaseUrls().stable;
export const BETA_BASE_URL: string = resolveChannelBaseUrls().beta;

/**
 * Verifies whether the Beta channel shell (index.html) is already cached in local Cache Storage
 * so we never redirect a user offline to an uncached path.
 */
export async function isBetaCachedOffline(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const cacheNames = await caches.keys();
    const betaCaches = cacheNames.filter((n) => {
      const lower = n.toLowerCase();
      return lower.includes('solv-beta') || lower.includes('mm-beta') || lower.includes('-beta');
    });
    for (const cName of betaCaches) {
      const cache = await caches.open(cName);
      const keys = await cache.keys();
      if (keys.some((req) => req.url.includes('index.html') || req.url.endsWith('/beta/'))) {
        return true;
      }
    }
  } catch {}
  return false;
}

let cachedBetaAvailability: boolean | null = null;

/**
 * Checks whether the beta channel version.json is reachable from the stable app.
 * Caches the result in memory and sessionStorage for the duration of the browser session.
 */
export async function checkBetaAvailability(forceRefresh = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!forceRefresh && cachedBetaAvailability !== null) {
    return cachedBetaAvailability;
  }

  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem('mm_beta_reachable');
      if (cached !== null) {
        cachedBetaAvailability = cached === 'true';
        return cachedBetaAvailability;
      }
    } catch {}
  }

  try {
    const betaVersionUrl = new URL('version.json', BETA_BASE_URL).href;
    const res = await fetch(`${betaVersionUrl}?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (res.status !== 200) {
      cachedBetaAvailability = false;
    } else {
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      cachedBetaAvailability = Boolean(json && json.channel === 'beta');
    }
  } catch {
    cachedBetaAvailability = false;
  }

  try {
    sessionStorage.setItem('mm_beta_reachable', String(cachedBetaAvailability));
  } catch {}

  return cachedBetaAvailability ?? false;
}

export function getBetaAppUrl(): string {
  return BETA_BASE_URL;
}

export function getStableAppUrl(): string {
  return STABLE_BASE_URL;
}

export function switchChannelWithHistoryUnwind(targetUrl: string, framesToUnwind: number = 0): void {
  if (typeof window === 'undefined') return;

  (window as any).__mm_switching_channel = true;

  if (framesToUnwind <= 0) {
    window.location.replace(targetUrl);
    return;
  }

  let replaced = false;
  const executeReplace = () => {
    if (replaced) return;
    replaced = true;
    window.location.replace(targetUrl);
  };

  const onPopState = () => {
    window.removeEventListener('popstate', onPopState);
    setTimeout(executeReplace, 50);
  };

  window.addEventListener('popstate', onPopState);
  setTimeout(executeReplace, 500);

  try {
    window.history.go(-framesToUnwind);
  } catch {
    executeReplace();
  }
}
