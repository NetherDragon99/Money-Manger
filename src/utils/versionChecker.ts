/**
 * In-App Version Checker and Automatic Update Engine
 * Performs background version checks and coordinates seamless client-side updates.
 */

import { IS_BETA_BUILD, APP_CHANNEL } from './channel';

export const CURRENT_APP_VERSION = '1.1.63';
const BACKUP_VERSION_ENDPOINT = 'NetherDragon99/Money-Manger';
const AUTO_UPDATE_STORAGE_KEY = 'mm_auto_update_enabled';

/**
 * Centralized version label formatting helper.
 * Driven by IS_BETA_BUILD:
 * - Beta build: returns `Beta vX.Y.Z`
 * - Stable build: returns `vX.Y.Z`
 * Strips any existing 'Beta', 'beta', or 'v' prefixes to ensure 'Beta' is never doubled.
 */
export function formatVersionLabel(version: string = CURRENT_APP_VERSION): string {
  if (!version) return IS_BETA_BUILD ? 'Beta' : '';
  const clean = String(version)
    .replace(/^beta\s*/i, '')
    .replace(/^v/i, '')
    .trim();
  return IS_BETA_BUILD ? `Beta v${clean}` : `v${clean}`;
}

export interface StableReleaseCheckResult {
  hasNewerStable: boolean;
  stableVersion: string;
  stableBaseUrl: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  channel?: 'stable' | 'beta';
  isBeta?: boolean;
  source: 'version-file' | 'cloud-api' | 'none';
}

/**
 * Checks whether automatic background updates are enabled by the user.
 * Defaults to true for a seamless, hands-free experience.
 */
export function isAutoUpdateEnabled(): boolean {
  try {
    const saved = localStorage.getItem(AUTO_UPDATE_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

/**
 * Persists the user's preference for automatic background updates.
 */
export function setAutoUpdateEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_UPDATE_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('mm_auto_update_changed', { detail: enabled }));
  } catch {}
}

export function compareVersions(current: string, latest: string): boolean {
  try {
    const curParts = current.replace(/[^0-9.]/g, '').split('.').map(Number);
    const latParts = latest.replace(/[^0-9.]/g, '').split('.').map(Number);
    for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
      const c = curParts[i] || 0;
      const l = latParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
  } catch {
    return latest !== current;
  }
  return false;
}

/**
 * In the BETA build only, checks the stable channel's version.json to determine
 * whether an official stable release newer than the beta's baseline stableVersion is available.
 * Fails silently on any network or parsing error.
 */
export async function checkForNewerOfficialRelease(): Promise<StableReleaseCheckResult | null> {
  if (!IS_BETA_BUILD) return null;
  if (typeof window === 'undefined') return null;

  try {
    let stableBaseUrl = '/';
    let stableVersionUrl = '/version.json';

    const { pathname, href } = window.location;
    if (pathname.includes('/beta/')) {
      try {
        stableBaseUrl = new URL('../', href).href;
        stableVersionUrl = new URL('../version.json', href).href;
      } catch {
        stableBaseUrl = pathname.replace(/\/beta\/.*$/, '/');
        stableVersionUrl = `${stableBaseUrl}version.json`;
      }
    } else if (pathname.startsWith('/Money-Manger')) {
      stableBaseUrl = '/Money-Manger/';
      stableVersionUrl = '/Money-Manger/version.json';
    } else {
      stableBaseUrl = './';
      stableVersionUrl = './version.json';
    }

    const res = await fetch(`${stableVersionUrl}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Accept: 'application/json' },
    });

    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;

    const data = JSON.parse(text);
    if (!data || !data.version) return null;

    // Baseline is beta's own stableVersion field if available, or CURRENT_APP_VERSION
    const baselineVersion = data.stableVersion || CURRENT_APP_VERSION;
    if (compareVersions(baselineVersion, data.version)) {
      return {
        hasNewerStable: true,
        stableVersion: data.version,
        stableBaseUrl,
      };
    }
  } catch {
    // Fail silently on any network error
  }

  return null;
}

export async function checkForAppUpdates(): Promise<UpdateCheckResult> {
  // If offline, do not block
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      source: 'none',
    };
  }

  // 1. Check live version.json on deployed host (bypassing browser cache)
  try {
    const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL)
      ? import.meta.env.BASE_URL
      : (typeof window !== 'undefined' && window.location.pathname.startsWith('/Money-Manger') ? '/Money-Manger/' : './');
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const versionUrl = `${cleanBase}version.json?_t=${Date.now()}`;
    const res = await fetch(versionUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Accept: 'application/json' },
    });
    if (res.ok) {
      const text = await res.text();
      // Guard against HTML 404/SPA responses starting with '<'
      if (text && !text.trim().startsWith('<')) {
        try {
          const data = JSON.parse(text);
          if (data && data.version && compareVersions(CURRENT_APP_VERSION, data.version)) {
            return {
              hasUpdate: true,
              currentVersion: CURRENT_APP_VERSION,
              latestVersion: data.version,
              channel: data.channel || APP_CHANNEL,
              isBeta: typeof data.isBeta === 'boolean' ? data.isBeta : IS_BETA_BUILD,
              source: 'version-file',
            };
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  } catch (err) {
    console.warn('[VersionChecker] Could not fetch live version.json:', err);
  }

  // 2. Secondary fallback: query cloud repository endpoint
  try {
    const branch = IS_BETA_BUILD ? 'beta' : 'main';
    const res = await fetch(`https://api.github.com/repos/${BACKUP_VERSION_ENDPOINT}/commits/${branch}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        try {
          const commitData = JSON.parse(text);
          const message = commitData?.commit?.message || '';
          // Check if commit message mentions a newer version (e.g. 2.0.0 or 1.0.x)
          const versionMatch = message.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
          if (versionMatch) {
            const foundVersion = versionMatch[1];
            if (compareVersions(CURRENT_APP_VERSION, foundVersion)) {
              return {
                hasUpdate: true,
                currentVersion: CURRENT_APP_VERSION,
                latestVersion: foundVersion,
                channel: APP_CHANNEL,
                isBeta: IS_BETA_BUILD,
                source: 'cloud-api',
              };
            }
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  } catch (err) {
    console.warn('[VersionChecker] Could not check cloud endpoint:', err);
  }

  return {
    hasUpdate: false,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
    source: 'none',
  };
}

/**
 * Clears outdated Service Worker caches, updates worker registrations,
 * reports progress steps, and seamlessly reloads the application.
 */
export async function applyLatestAppUpdate(onProgress?: (step: string) => void): Promise<void> {
  try {
    onProgress?.('service_worker');
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        try {
          await reg.update();
        } catch {}
      }
    }

    onProgress?.('cache_cleanup');
    // Delete old application runtime caches to fetch fresh assets
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (!name.includes('offline-permanent-user-data')) {
          try {
            await caches.delete(name);
          } catch {}
        }
      }
    }

    onProgress?.('reloading');
  } catch (err) {
    console.error('[VersionChecker] Error while refreshing caches:', err);
  } finally {
    // Force reload bypassing browser cache
    window.location.reload();
  }
}
