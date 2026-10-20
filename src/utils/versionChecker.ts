/**
 * GitHub & PWA Version Checker and Auto-Updater
 * Checks for newest versions on every launch and triggers instant updates.
 */

export const CURRENT_APP_VERSION = '1.1.6';
const GITHUB_REPO = 'NetherDragon99/Money-Manger';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  source: 'version-file' | 'github-api' | 'none';
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

  // 2. Fallback: check GitHub API for newest commit message or release
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main?_t=${Date.now()}`, {
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
                source: 'github-api',
              };
            }
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  } catch (err) {
    console.warn('[VersionChecker] Could not check GitHub API:', err);
  }

  return {
    hasUpdate: false,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
    source: 'none',
  };
}

/**
 * Forces Service Worker and caches to update and reloads the application
 */
export async function applyLatestAppUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    }
    // Delete old application runtime caches to fetch fresh assets
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (!name.includes('offline-permanent-user-data')) {
          await caches.delete(name);
        }
      }
    }
  } catch (err) {
    console.error('[VersionChecker] Error while refreshing caches:', err);
  } finally {
    // Force reload bypassing browser cache
    window.location.reload();
  }
}
