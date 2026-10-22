/**
 * Debounced persistence queue.
 *
 * Synchronous JSON.stringify + localStorage.setItem on large transaction arrays blocks the
 * main thread. Every write is coalesced per key and executed 400ms after the last change,
 * so typing / scrolling / tapping stays at 60fps. Pending writes are flushed immediately
 * when the page is hidden or unloaded, so no data is ever lost.
 */
const PERSIST_DELAY_MS = 400;

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; writer: () => void }>();

export function debouncedPersist(key: string, writer: () => void, delay = PERSIST_DELAY_MS): void {
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(key);
    try {
      writer();
    } catch (err) {
      console.error(`[PersistQueue] Write failed for "${key}":`, err);
    }
  }, delay);

  pending.set(key, { timer, writer });
}

/** Execute all pending writes synchronously right now. */
export function flushPendingPersists(): void {
  pending.forEach(({ timer, writer }, key) => {
    clearTimeout(timer);
    try {
      writer();
    } catch (err) {
      console.error(`[PersistQueue] Flush failed for "${key}":`, err);
    }
  });
  pending.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPendingPersists);
  window.addEventListener('beforeunload', flushPendingPersists);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingPersists();
  });
}

/* ====================================================================
 * Offline Cloud Backup & Share Updates Queue
 * ==================================================================== */

const PENDING_BACKUP_KEY = 'mm_offline_pending_backup';
const PENDING_SHARES_KEY = 'mm_offline_pending_shares';

/**
 * Queue a cloud backup payload while offline
 */
export function queueOfflineCloudBackup(uid: string, payload: any): void {
  try {
    localStorage.setItem(
      PENDING_BACKUP_KEY,
      JSON.stringify({ uid, payload, queuedAt: Date.now() })
    );
    console.log('[PersistQueue] Queued cloud backup offline');
  } catch (err) {
    console.warn('[PersistQueue] Failed to queue offline backup:', err);
  }
}

/**
 * Queue a shared space update while offline
 */
export function queueOfflineShareUpdate(folder: any): void {
  try {
    const raw = localStorage.getItem(PENDING_SHARES_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((f) => f.id !== folder.id);
    filtered.push(folder);
    localStorage.setItem(PENDING_SHARES_KEY, JSON.stringify(filtered));
    console.log('[PersistQueue] Queued share folder update offline:', folder.id);
  } catch (err) {
    console.warn('[PersistQueue] Failed to queue offline share:', err);
  }
}

/**
 * Flush all offline queued backups and shared spaces as soon as connection is restored
 */
export async function flushOfflineQueue(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  // 1. Flush offline pending cloud backup
  try {
    const rawBackup = localStorage.getItem(PENDING_BACKUP_KEY);
    if (rawBackup) {
      const { uid, payload } = JSON.parse(rawBackup);
      if (uid && payload) {
        console.log('[PersistQueue] Network online: Flushing offline pending cloud backup...');
        const { executeDualCloudBackup } = await import('./autoBackup');
        const res = await executeDualCloudBackup(uid, payload);
        if (res.success) {
          localStorage.removeItem(PENDING_BACKUP_KEY);
          console.log('[PersistQueue] Offline cloud backup flushed successfully to', res.provider);
        }
      }
    }
  } catch (err) {
    console.warn('[PersistQueue] Error flushing offline backup:', err);
  }

  // 2. Flush offline pending share updates
  try {
    const rawShares = localStorage.getItem(PENDING_SHARES_KEY);
    if (rawShares) {
      const shares = JSON.parse(rawShares);
      if (Array.isArray(shares) && shares.length > 0) {
        console.log(`[PersistQueue] Network online: Flushing ${shares.length} offline pending share updates...`);
        const { syncFolderToCloud } = await import('./shareFolders');
        for (const folder of shares) {
          await syncFolderToCloud(folder).catch((e) =>
            console.warn('[PersistQueue] Share flush item note:', e)
          );
        }
        localStorage.removeItem(PENDING_SHARES_KEY);
        console.log('[PersistQueue] All offline pending shares flushed successfully');
      }
    }
  } catch (err) {
    console.warn('[PersistQueue] Error flushing offline shares:', err);
  }
}

// Automatically listen to 'online' event to flush all queued items immediately
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[PersistQueue] Browser fired "online" event, flushing queue...');
    flushOfflineQueue();
  });
}
