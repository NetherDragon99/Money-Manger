/**
 * Stored-Data Safety Guard
 * Prevents older builds (e.g. stable) from corrupting, overwriting, or migrating
 * data created or updated by newer builds (e.g. beta).
 */

export const SCHEMA_VERSION_STORAGE_KEY = 'mm_schema_version';
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Returns the schema version stored in local storage, or null if none.
 */
export function getStoredSchemaVersion(): number | null {
  try {
    const raw = localStorage.getItem(SCHEMA_VERSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Writes the current supported schema version to local storage,
 * but only if the stored version is missing or older/equal.
 * Never downgrades a newer stored schema version.
 */
export function writeCurrentSchemaVersion(): void {
  try {
    const stored = getStoredSchemaVersion();
    if (stored === null || stored <= CURRENT_SCHEMA_VERSION) {
      localStorage.setItem(SCHEMA_VERSION_STORAGE_KEY, String(CURRENT_SCHEMA_VERSION));
    }
  } catch {
    // Non-fatal if storage quota is exceeded
  }
}

/**
 * Checks whether stored data was written by a newer schema version than this build supports.
 */
export function isStoredSchemaNewer(): boolean {
  const stored = getStoredSchemaVersion();
  return stored !== null && stored > CURRENT_SCHEMA_VERSION;
}

/**
 * Calculates the target URL to navigate the user back to the Beta app.
 */
export function getBetaAppUrl(): string {
  try {
    if (typeof window === 'undefined') return './beta/';
    const { origin, pathname } = window.location;
    if (pathname.includes('/beta/')) return window.location.href;
    if (pathname.startsWith('/Money-Manger')) {
      return `${origin}/Money-Manger/beta/`;
    }
    const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return `${origin}${cleanPath}beta/`;
  } catch {
    return './beta/';
  }
}
