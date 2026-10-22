/**
 * In-App Version Checker and Automatic Update Engine
 * Performs background version checks and coordinates seamless client-side updates.
 */

export const CURRENT_APP_VERSION = '1.1.37';
const BACKUP_VERSION_ENDPOINT = 'NetherDragon99/Money-Manger';
const AUTO_UPDATE_STORAGE_KEY = 'mm_auto_update_enabled';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
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

function compareVersions(current: string, latest: string): boolean {
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
    const isGhPages = window.location.pathname.startsWith('/Money-Manger');
    const base = isGhPages ? '/Money-Manger/' : '/';
    const versionUrl = `${base}version.json?_t=${Date.now()}`;
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
    const res = await fetch(`https://api.github.com/repos/${BACKUP_VERSION_ENDPOINT}/commits/main?_t=${Date.now()}`, {
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
