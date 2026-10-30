/**
 * Application Channel Configuration
 * Exposes build-time channel ('stable' by default, 'beta' via vite build --mode beta)
 * and safe channel navigation & reachability helpers.
 */

export type AppChannel = 'stable' | 'beta';

export const APP_CHANNEL: AppChannel =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_CHANNEL === 'beta')
    ? 'beta'
    : 'stable';

export const IS_BETA_BUILD: boolean = APP_CHANNEL === 'beta';

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

  // Absolute base configured by Vite (e.g. /Money-Manger/ or /Money-Manger/beta/ or /)
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

  // Relative base './' (e.g. local preview or relative deployment)
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

let cachedBetaAvailability: boolean | null = null;

/**
 * Checks whether the beta channel version.json is reachable from the stable app.
 * Caches the result in memory and sessionStorage for the duration of the browser session.
 */
export async function checkBetaAvailability(forceRefresh = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!forceRefresh && cachedBetaAvailability !== null) {
    return cachedBetaAvailability;
  }

  // Check sessionStorage cache for this session
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
    // GitHub Pages can answer 200 with an HTML fallback for missing files:
    // reachable ONLY when HTTP 200 AND the body is JSON with channel === 'beta'.
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

/**
 * Returns the exact safe target URL for navigating to the Beta app from Stable.
 */
export function getBetaAppUrl(): string {
  return BETA_BASE_URL;
}

/**
 * Returns the exact safe target URL for navigating to the Stable app from Beta.
 */
export function getStableAppUrl(): string {
  return STABLE_BASE_URL;
}

/**
 * Unwinds the app's internal history frames, then replaces the current window location
 * with the target channel URL so old-channel entries cannot be reached with Back.
 */
export function switchChannelWithHistoryUnwind(targetUrl: string, framesToUnwind: number = 0): void {
  if (typeof window === 'undefined') return;

  // Signal to NavigationContext that we are intentionally unwinding to switch channels
  (window as any).__mm_switching_channel = true;

  // If there are no frames to unwind, replace immediately
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
