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
    const betaVersionUrl = new URL('beta/version.json', window.location.href).href;
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
  if (typeof window === 'undefined') return './beta/';
  try {
    return new URL('beta/', window.location.href).href;
  } catch {
    return './beta/';
  }
}

/**
 * Returns the exact safe target URL for navigating to the Stable app from Beta.
 */
export function getStableAppUrl(): string {
  if (typeof window === 'undefined') return '../';
  try {
    return new URL('../', window.location.href).href;
  } catch {
    return '../';
  }
}
