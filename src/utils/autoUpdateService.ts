/**
 * Safe Auto-Update Service & Pre-Update Backup Snapshot Engine
 * Coordinates Service Worker registration (registerType: 'prompt'),
 * pre-update local snapshots in IndexedDB, graceful sync flushing,
 * work-loss protection, and reload-loop safeguards.
 */

import { registerSW } from 'virtual:pwa-register';
import { getItemFromIndexedDB, saveItemToIndexedDB, saveFullDataToIndexedDB } from './indexedDB';
import { loadInitialData } from './storage';
import { loadRecurringTransactions } from './recurring';
import { CURRENT_APP_VERSION, formatVersionLabel, isAutoUpdateEnabled } from './versionChecker';
import { IS_BETA_BUILD } from './channel';
import { auth } from './firebase';
import { flushGranularDirtyQueue } from './autoBackup';
import { Account, Category, Transaction, AppSettings, RecurringTransaction } from '../types';

export const PRE_UPDATE_BACKUP_KEY = 'mm_pre_update_backup';
const COLD_START_UPDATE_KEY = 'mm_apply_update_on_cold_start';
const ATTEMPT_TIMESTAMP_KEY = 'mm_update_attempt_ts';
const ATTEMPT_COUNT_KEY = 'mm_update_attempt_cnt';

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
 * Reconciles the mm_join_beta localStorage flag to the active build channel.
 */
export function reconcileBetaChannelStartup(): void {
  if (typeof window === 'undefined') return;
  try {
    if (IS_BETA_BUILD) {
      localStorage.setItem('mm_join_beta', 'true');
    } else {
      localStorage.removeItem('mm_join_beta');
    }
  } catch {}
}

/**
 * Helper to dispatch UI toasts from non-React background operations.
 */
function dispatchToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app_toast', {
        detail: { message, type },
      })
    );
  }
}

/**
 * Awaits a promise with an enforced timeout.
 */
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

/**
 * Creates a permanent pre-update snapshot of all user data in IndexedDB.
 * Retains only the latest 2 snapshots. Works completely offline and for guest users.
 */
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
    // Keep only the latest 2 snapshots
    const updated = [snapshot, ...list].slice(0, 2);
    await saveItemToIndexedDB(PRE_UPDATE_BACKUP_KEY, updated);
  } catch (err) {
    console.error('[AutoUpdate] Error saving pre-update snapshot to IndexedDB:', err);
    throw err;
  }

  return snapshot;
}

/**
 * Retrieves the stored pre-update snapshots from IndexedDB.
 */
export async function getPreUpdateSnapshots(): Promise<PreUpdateSnapshot[]> {
  try {
    const list = await getItemFromIndexedDB<PreUpdateSnapshot[]>(PRE_UPDATE_BACKUP_KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves the most recent pre-update snapshot.
 */
export async function getLatestPreUpdateSnapshot(): Promise<PreUpdateSnapshot | null> {
  const list = await getPreUpdateSnapshots();
  return list.length > 0 ? list[0] : null;
}

/**
 * Restores user data from a pre-update snapshot.
 */
export async function restoreFromPreUpdateSnapshot(snapshotId?: string): Promise<boolean> {
  try {
    const snapshots = await getPreUpdateSnapshots();
    if (snapshots.length === 0) return false;

    const target = snapshotId
      ? snapshots.find((s) => s.id === snapshotId)
      : snapshots[0];

    if (!target) return false;

    // 1. Restore to localStorage
    if (target.accounts) localStorage.setItem('pwa_finance_accounts', JSON.stringify(target.accounts));
    if (target.categories) localStorage.setItem('pwa_finance_categories', JSON.stringify(target.categories));
    if (target.transactions) localStorage.setItem('pwa_finance_transactions', JSON.stringify(target.transactions));
    if (target.settings) localStorage.setItem('pwa_finance_settings', JSON.stringify(target.settings));
    if (target.recurringTransactions) {
      localStorage.setItem('recurring_transactions', JSON.stringify(target.recurringTransactions));
    }

    // 2. Restore to IndexedDB permanent storage
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

/**
 * Flushes pending dirty queue changes to cloud if signed in and sync is unlocked.
 */
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

/**
 * Prevents update application while the user could lose unsaved work.
 * Checks for open dialogs/modals, active text input/editing, and ongoing sync flushes.
 */
export function canSafelyReloadNow(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Any modal open in React tree or DOM
  if ((window as any).__isAnyModalOpen) return false;
  if (document.querySelector('[role="dialog"]') || document.querySelector('.modal-backdrop-anim')) {
    return false;
  }

  // 2. User currently typing in an input or textarea
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')
  ) {
    return false;
  }

  // 3. Ongoing sync flush in progress
  if ((window as any).__isSyncFlushRunning) {
    return false;
  }

  return true;
}

/**
 * SessionStorage guard preventing infinite reload loops.
 */
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

/**
 * Safely applies an update:
 * 1. Takes pre-update IndexedDB snapshot (8s timeout).
 * 2. Flushes sync if signed in & unlocked (8s timeout).
 * 3. Notifies errors via toast without blocking reload.
 * 4. Calls updateServiceWorker(true) or reloads cleanly.
 */
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

  // 1. Pre-update snapshot (8-second timeout)
  try {
    await withTimeout(createPreUpdateSnapshot(), 8000, 'Pre-update snapshot');
    console.log('[AutoUpdate] Pre-update snapshot saved.');
  } catch (err: any) {
    console.warn('[AutoUpdate] Pre-update snapshot warning:', err);
    dispatchToast(err?.message || 'Snapshot creation timed out', 'error');
  }

  // 2. Sync flush (8-second timeout)
  try {
    await withTimeout(flushPendingSyncIfEligible(), 8000, 'Cloud sync flush');
    console.log('[AutoUpdate] Cloud sync flushed.');
  } catch (err: any) {
    console.warn('[AutoUpdate] Sync flush warning:', err);
    dispatchToast(err?.message || 'Sync flush timed out', 'error');
  }

  try {
    localStorage.removeItem(COLD_START_UPDATE_KEY);
  } catch {}

  // 3. Activate new service worker & reload
  try {
    if (updateServiceWorkerFn) {
      await updateServiceWorkerFn(true);
    } else {
      window.location.reload();
    }
    return true;
  } catch (err) {
    console.error('[AutoUpdate] Error triggering updateServiceWorker:', err);
    window.location.reload();
    return true;
  }
}

/**
 * Checks and applies any update queued from a previous session on cold start.
 */
export async function checkAndApplyColdStartUpdate(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const isPending = localStorage.getItem(COLD_START_UPDATE_KEY) === 'true';
    if (isPending && isAutoUpdateEnabled()) {
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

/**
 * Initializes VitePWA registration with prompt mode.
 * Wires the onNeedRefresh callback to safe snapshot & update flow.
 */
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
        console.log('[AutoUpdate] PWA is cached and ready for offline use');
      },
      onRegisterError(err) {
        console.warn('[AutoUpdate] Service worker registration error:', err);
      },
    });
  } catch (err) {
    console.warn('[AutoUpdate] Failed to initialize PWA registerSW:', err);
  }
}
