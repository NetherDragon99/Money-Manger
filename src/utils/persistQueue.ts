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
