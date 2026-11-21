/**
 * Safe Auto-Update Service & Pre-Update Backup Snapshot Engine
 * Coordinates Service Worker registration (registerType: 'prompt'),
 * pre-update local snapshots in IndexedDB, graceful sync flushing,
 * channel-isolated update state, and offline-safe Beta persistence.
 */

import { registerSW } from 'virtual:pwa-register';
import { getItemFromIndexedDB, saveItemToIndexedDB, saveFullDataToIndexedDB } from './indexedDB';
import { loadInitialData } from './storage';
import { loadRecurringTransactions } from './recurring';
import { CURRENT_APP_VERSION, formatVersionLabel, isAutoUpdateEnabled } from './versionChecker';
import {
  IS_BETA_BUILD,
  BETA_BASE_URL,
  channelKey,
  getPreferredChannel,
  setPreferredChannel,
  isBetaCachedOffline,
} from './channel';
import { auth } from './firebase';
import { flushGranularDirtyQueue } from './autoBackup';
import { Account, Category, Transaction, AppSettings, RecurringTransaction } from '../types';

export const PRE_UPDATE_BACKUP_KEY = 'mm_pre_update_backup';
const COLD_START_UPDATE_KEY = channelKey('mm_apply_update_on_cold_start');
const ATTEMPT_TIMESTAMP_KEY = channelKey('mm_update_attempt_ts');
const ATTEMPT_COUNT_KEY = channelKey('mm_update_attempt_cnt');

export interface PreUpdateSnapshot {
  id: string;
  version: string;
  versionLabel: string;
  channel: 'stable' | 'beta';
  timestamp: number;
  createdAt: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  settings: AppSettings;
  recurringTransactions: RecurringTransaction[];
}

let updateServiceWorkerFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let isUpdateReadyState = false;

/**
 * Reconciles the device-local channel preference at startup.
 * Guarantees a Beta user is NEVER kicked out of Beta by cloud settings or offline restarts,
 * and NEVER redirected offline to an uncached Beta route.
 */
export function reconcileBetaChannelStartup(): void {
  if (typeof window === 'undefined') return;
  try {
    if (IS_BETA_BUILD) {
      // Explicitly launched inside Beta: always lock local channel preference to beta
      setPreferredChannel('beta');
      return;
    }

    const pref = getPreferredChannel();
    if (pref === 'beta') {
      if (!window.location.pathname.includes('/beta/')) {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          console.log('[AutoUpdate] Beta preference active & online. Redirecting to Beta channel...');
          window.location.replace(BETA_BASE_URL);
        } else {
          // Offline safety check: only redirect if Beta's offline precache actually exists locally!
          isBetaCachedOffline()
            .then((cached) => {
              if (cached) {
                console.log('[AutoUpdate] Beta cache verified offline. Redirecting cleanly to Beta...');
                window.location.replace(BETA_BASE_URL);
              } else {
                // Keep mm_preferred_channel intact — NEVER kick user out of beta!
                console.warn('[AutoUpdate] Beta not cached offline yet; keeping subscription safe on fallback.');
                window.dispatchEvent(new CustomEvent('mm_beta_offline_fallback'));
              }
            })
            .catch(() => {});
        }
      }
    }
  } catch {}
}

/**
 * Cross-channel cache cleanup: when the Beta app opens, stale Stable-only caches
 * are evicted (and vice-versa). This guarantees the browser never serves a
 * previous-channel's stale assets when the user switches between Stable and Beta.
 *
 * Rules:
 * - Beta build  → delete any cache whose name does NOT contain 'beta'
 *                 and does NOT match a known cross-channel shared name.
 * - Stable build → delete any cache whose name contains 'beta'.
 * Only runs when Cache Storage is available and skips on errors silently.
 */
export async function purgeOtherChannelCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  // Throttle: only run once per browser session to avoid startup latency
  const SESSION_KEY = `mm_cache_purge_done_${IS_BETA_BUILD ? 'beta' : 'stable'}`;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
  } catch { /* ignore */ }

  try {
    const allCacheNames = await caches.keys();
    const toDelete: string[] = allCacheNames.filter((name) => {
      const lower = name.toLowerCase();
      if (IS_BETA_BUILD) {
        // Keep beta caches, delete obsolete stable-only caches
        // e.g. 'solv-stable', 'solv-stable-google-fonts', 'solv-stable-avatars'
        const isStaleStable =
          (lower.includes('solv-stable') || lower.includes('mm-stable')) &&
          !lower.includes('beta');
        return isStaleStable;
      } else {
        // Keep stable caches, delete beta caches
        // e.g. 'solv-beta', 'solv-beta-google-fonts', 'solv-beta-avatars'
        return lower.includes('solv-beta') || lower.includes('mm-beta');
      }
    });

    if (toDelete.length > 0) {
      console.log(`[AutoUpdate] Purging ${toDelete.length} other-channel cache(s):`, toDelete);
      await Promise.all(toDelete.map((n) => caches.delete(n).catch(() => {})));
    }

    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
  } catch (err) {
    console.warn('[AutoUpdate] Cross-channel cache purge skipped:', err);
  }
}

function dispatchToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app_toast', {
        detail: { message, type },
      })
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function createPreUpdateSnapshot(): Promise<PreUpdateSnapshot> {
  const initial = loadInitialData();
  const recurring = loadRecurringTransactions();

  const snapshot: PreUpdateSnapshot = {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    version: CURRENT_APP_VERSION,
    versionLabel: formatVersionLabel(CURRENT_APP_VERSION),
    channel: IS_BETA_BUILD ? 'beta' : 'stable',
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
    accounts: initial.accounts || [],
    categories: initial.categories || [],
    transactions: initial.transactions || [],
    settings: initial.settings || ({} as AppSettings),
    recurringTransactions: recurring || [],
  };

  try {
    const existing = (await getItemFromIndexedDB<PreUpdateSnapshot[]>(PRE_UPDATE_BACKUP_KEY)) || [];
    const list = Array.isArray(existing) ? existing : [];
    const updated = [snapshot, ...list].slice(0, 2);
    await saveItemToIndexedDB(PRE_UPDATE_BACKUP_KEY, updated);
  } catch (err) {
    console.error('[AutoUpdate] Error saving pre-update snapshot to IndexedDB:', err);
    throw err;
  }

  return snapshot;
}

export async function getPreUpdateSnapshots(): Promise<PreUpdateSnapshot[]> {
  try {
    const list = await getItemFromIndexedDB<PreUpdateSnapshot[]>(PRE_UPDATE_BACKUP_KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function getLatestPreUpdateSnapshot(): Promise<PreUpdateSnapshot | null> {
  const list = await getPreUpdateSnapshots();
  return list.length > 0 ? list[0] : null;
}

export async function restoreFromPreUpdateSnapshot(snapshotId?: string): Promise<boolean> {
  try {
    const snapshots = await getPreUpdateSnapshots();
    if (snapshots.length === 0) return false;

    const target = snapshotId
      ? snapshots.find((s) => s.id === snapshotId)
      : snapshots[0];

    if (!target) return false;

    if (target.accounts) localStorage.setItem('pwa_finance_accounts', JSON.stringify(target.accounts));
    if (target.categories) localStorage.setItem('pwa_finance_categories', JSON.stringify(target.categories));
    if (target.transactions) localStorage.setItem('pwa_finance_transactions', JSON.stringify(target.transactions));
    if (target.settings) localStorage.setItem('pwa_finance_settings', JSON.stringify(target.settings));
    if (target.recurringTransactions) {
      localStorage.setItem('recurring_transactions', JSON.stringify(target.recurringTransactions));
    }

    await saveFullDataToIndexedDB({
      accounts: target.accounts || [],
      categories: target.categories || [],
      transactions: target.transactions || [],
      settings: target.settings || ({} as AppSettings),
      recurringTransactions: target.recurringTransactions || [],
    });

    return true;
  } catch (err) {
    console.error('[AutoUpdate] Failed to restore from pre-update snapshot:', err);
    return false;
  }
}

export async function flushPendingSyncIfEligible(): Promise<number> {
  if (typeof window === 'undefined' || !navigator.onLine) return 0;
  try {
    const currentUserUid = auth?.currentUser?.uid;
    const boundUid = localStorage.getItem('mm_bound_account_uid');
    const isSyncLocked = localStorage.getItem('mm_sync_locked') === 'true';

    if (currentUserUid && boundUid === currentUserUid && !isSyncLocked) {
      return await flushGranularDirtyQueue(currentUserUid);
    }
  } catch (err) {
    console.warn('[AutoUpdate] Sync flush failed:', err);
    throw err;
  }
  return 0;
}

export function canSafelyReloadNow(): boolean {
  if (typeof window === 'undefined') return false;

  if ((window as any).__isAnyModalOpen) return false;
  if (document.querySelector('[role="dialog"]') || document.querySelector('.modal-backdrop-anim')) {
    return false;
  }

  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')
  ) {
    return false;
  }

  if ((window as any).__isSyncFlushRunning) {
    return false;
  }

  return true;
}

function checkReloadLoopGuard(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return true;
  try {
    const now = Date.now();
    const lastAttempt = Number(sessionStorage.getItem(ATTEMPT_TIMESTAMP_KEY) || 0);
    const count = Number(sessionStorage.getItem(ATTEMPT_COUNT_KEY) || 0);

    if (now - lastAttempt < 15000 && count >= 2) {
      console.warn('[AutoUpdate] Loop guard active: suppressing auto-reload.');
      return false;
    }

    sessionStorage.setItem(ATTEMPT_TIMESTAMP_KEY, String(now));
    sessionStorage.setItem(ATTEMPT_COUNT_KEY, String(count + 1));
    return true;
  } catch {
    return true;
  }
}

export async function applyUpdateSafely(options?: { isColdStart?: boolean; force?: boolean }): Promise<boolean> {
  const force = options?.force ?? false;

  if (!force && !canSafelyReloadNow()) {
    console.log('[AutoUpdate] Deferring update until next cold start or user confirmation.');
    try {
      localStorage.setItem(COLD_START_UPDATE_KEY, 'true');
    } catch {}
    dispatchUpdateReadyEvent();
    return false;
  }

  if (!checkReloadLoopGuard()) {
    dispatchToast('Update reload loop prevented. Tap to update manually.', 'info');
    dispatchUpdateReadyEvent();
    return false;
  }

  // Never force reload when completely offline unless SW waiting already exists locally
  try {
    await withTimeout(createPreUpdateSnapshot(), 8000, 'Pre-update snapshot');
  } catch (err: any) {
    console.warn('[AutoUpdate] Pre-update snapshot warning:', err);
  }

  try {
    await withTimeout(flushPendingSyncIfEligible(), 8000, 'Cloud sync flush');
  } catch (err: any) {
    console.warn('[AutoUpdate] Sync flush warning:', err);
  }

  try {
    localStorage.removeItem(COLD_START_UPDATE_KEY);
  } catch {}

  try {
    if (updateServiceWorkerFn) {
      await updateServiceWorkerFn(true);
    } else if (typeof navigator === 'undefined' || navigator.onLine) {
      window.location.reload();
    }
    return true;
  } catch (err) {
    console.error('[AutoUpdate] Error triggering updateServiceWorker:', err);
    if (typeof navigator === 'undefined' || navigator.onLine) {
      window.location.reload();
    }
    return true;
  }
}

export async function checkAndApplyColdStartUpdate(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const isPending = localStorage.getItem(COLD_START_UPDATE_KEY) === 'true';
    if (isPending && isAutoUpdateEnabled() && (typeof navigator === 'undefined' || navigator.onLine)) {
      localStorage.removeItem(COLD_START_UPDATE_KEY);
      console.log('[AutoUpdate] Applying queued update on cold start');
      return await applyUpdateSafely({ isColdStart: true });
    }
  } catch {}
  return false;
}

function dispatchUpdateReadyEvent() {
  isUpdateReadyState = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mm_update_ready'));
  }
}

export function getIsUpdateReady(): boolean {
  return isUpdateReadyState;
}

export function initPwaAutoUpdate(onRefreshCallback?: () => void): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    updateServiceWorkerFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[AutoUpdate] onNeedRefresh triggered from Service Worker');
        dispatchUpdateReadyEvent();

        if (onRefreshCallback) {
          onRefreshCallback();
        }

        if (isAutoUpdateEnabled()) {
          if (canSafelyReloadNow()) {
            applyUpdateSafely();
          } else {
            console.log('[AutoUpdate] Unsaved inputs or active modals present; deferring reload.');
            try {
              localStorage.setItem(COLD_START_UPDATE_KEY, 'true');
            } catch {}
          }
        }
      },
      onOfflineReady() {
        console.log('[AutoUpdate] solv is precached and ready for offline use');
        window.dispatchEvent(new CustomEvent('solv_offline_ready'));
      },
      onRegisterError(err) {
        console.warn('[AutoUpdate] Service worker registration error:', err);
      },
    });
  } catch (err) {
    console.warn('[AutoUpdate] Failed to initialize PWA registerSW:', err);
  }
}
