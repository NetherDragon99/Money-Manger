/**
 * In-App Version Checker and Automatic Update Engine
 * Performs background version checks and coordinates safe, offline-preserving client-side updates.
 */

import {
  IS_BETA_BUILD,
  APP_CHANNEL,
  STABLE_BASE_URL,
  isCurrentChannelCacheName,
  isRegistrationForCurrentChannel,
} from './channel';

export const CURRENT_APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? String(__APP_VERSION__) : '2.0.1';

export const STABLE_BASELINE_VERSION: string =
  typeof __STABLE_BASELINE_VERSION__ !== 'undefined' && __STABLE_BASELINE_VERSION__
    ? String(__STABLE_BASELINE_VERSION__)
    : CURRENT_APP_VERSION;

export const BUILD_ID: string =
  typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any).VITE_BUILD_ID
    ? String((import.meta.env as any).VITE_BUILD_ID).trim()
    : '';

const BACKUP_VERSION_ENDPOINT = 'NetherDragon99/solv';
const AUTO_UPDATE_STORAGE_KEY = 'mm_auto_update_enabled';

export function formatVersionLabel(
  version: string = CURRENT_APP_VERSION,
  includeBuildId: boolean = false
): string {
  if (!version) return IS_BETA_BUILD ? 'Beta' : '';
  const clean = String(version)
    .replace(/^beta\s*/i, '')
    .replace(/^v/i, '')
    .trim();
  const baseLabel = IS_BETA_BUILD ? `Beta v${clean}` : `v${clean}`;
  if (includeBuildId && BUILD_ID) {
    return `${baseLabel} · ${BUILD_ID}`;
  }
  return baseLabel;
}

export function formatFullVersionWithBuild(version: string = CURRENT_APP_VERSION): string {
  return formatVersionLabel(version, true);
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

export function isAutoUpdateEnabled(): boolean {
  try {
    const saved = localStorage.getItem(AUTO_UPDATE_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

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
 * whether an official stable release newer than this beta's baseline stableVersion is available.
 * Fails silently on any network or parsing error.
 */
export async function checkForNewerOfficialRelease(): Promise<StableReleaseCheckResult | null> {
  if (!IS_BETA_BUILD) return null;
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  try {
    const stableBaseUrl = STABLE_BASE_URL;
    const stableVersionUrl = new URL('version.json', STABLE_BASE_URL).href;

    const res = await fetch(`${stableVersionUrl}?_t=${Date.now()}`, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Accept: 'application/json' },
    });

    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;

    const data = JSON.parse(text);
    if (!data || !data.version) return null;

    // Compare live stable version against this Beta build's recorded stable baseline
    if (compareVersions(STABLE_BASELINE_VERSION, data.version)) {
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
    const baseUrl =
      typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
        ? import.meta.env.BASE_URL
        : typeof window !== 'undefined' && window.location.pathname.startsWith('/solv')
        ? '/solv/'
        : typeof window !== 'undefined' && window.location.pathname.startsWith('/Money-Manger')
        ? '/Money-Manger/'
        : './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const versionUrl = `${cleanBase}version.json?_t=${Date.now()}`;
    const res = await fetch(versionUrl, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Accept: 'application/json' },
    });
    if (res.ok) {
      const text = await res.text();
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
    const res = await fetch(
      `https://api.github.com/repos/${BACKUP_VERSION_ENDPOINT}/commits/${branch}?_t=${Date.now()}`,
      {
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github.v3+json' },
      }
    );
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<')) {
        try {
          const commitData = JSON.parse(text);
          const message = commitData?.commit?.message || '';
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
 * Safely updates ONLY the current channel's Service Worker without EVER deleting
 * Workbox precaches or another channel's caches (preventing offline breakage).
 */
export async function applyLatestAppUpdate(onProgress?: (step: string) => void): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  try {
    onProgress?.('service_worker');
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (!isRegistrationForCurrentChannel(reg)) continue;
        try {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        } catch {}
      }
    }

    onProgress?.('cache_cleanup');
    // Only clear non-precache runtime caches belonging strictly to the current channel
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (!isCurrentChannelCacheName(name)) continue;
        // NEVER delete Workbox precache! Workbox manages precache diffing automatically.
        if (name.includes('workbox-precache')) continue;
        if (name.includes('offline-permanent-user-data')) continue;
        try {
          await caches.delete(name);
        } catch {}
      }
    }

    onProgress?.('reloading');
  } catch (err) {
    console.error('[VersionChecker] Error while updating SW cleanly:', err);
  } finally {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      window.location.reload();
    }
  }
}
