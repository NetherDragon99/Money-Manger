/**
 * IndexedDB Permanent Storage Layer for Personal Finance Tracker
 * Provides persistent, quota-exempt device storage that survives browser cache clearings.
 */

import { AppData, Account, Category, Transaction, AppSettings, RecurringTransaction } from '../types';
import { migrateRecurringRule } from './recurring';

const DB_NAME = 'PersonalFinanceTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data_store';
export const PRE_MIGRATION_BACKUP_KEY = 'mm_pre_migration_backup';
const MAX_PRE_MIGRATION_SNAPSHOTS = 2;

export interface PreMigrationSnapshot {
  id: string;
  migrationName: string;
  createdAt: number;
  createdAtISO: string;
  uid: string | null;
  isGuest: boolean;
  data: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    settings: AppSettings | null;
    recurringTransactions: RecurringTransaction[];
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Requests permanent storage persistence from the browser
 * Prevents OS/browser from automatically evicting IndexedDB under low storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Device permanent storage persisted: ${isPersisted}`);
      return isPersisted;
    } catch (e) {
      console.warn('[Storage] Could not request persistence:', e);
    }
  }
  return false;
}

/**
 * Saves a key-value pair to IndexedDB permanently
 */
export async function saveItemToIndexedDB<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error(`[IndexedDB] Error saving ${key}:`, err);
  }
}

/**
 * Reads a key-value pair from IndexedDB
 */
export async function getItemFromIndexedDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result !== undefined ? request.result : null);
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error loading ${key}:`, err);
    return null;
  }
}

/**
 * Loads entire app data bundle from permanent IndexedDB storage
 */
export async function loadFullDataFromIndexedDB(): Promise<(Partial<AppData> & { recurringTransactions?: RecurringTransaction[] }) | null> {
  try {
    const [accounts, categories, transactions, settings, recurringTransactions] = await Promise.all([
      getItemFromIndexedDB<Account[]>('accounts'),
      getItemFromIndexedDB<Category[]>('categories'),
      getItemFromIndexedDB<Transaction[]>('transactions'),
      getItemFromIndexedDB<AppSettings>('settings'),
      getItemFromIndexedDB<RecurringTransaction[]>('recurring_transactions'),
    ]);

    if (!accounts && !categories && !transactions && !settings && !recurringTransactions) {
      return null;
    }

    const data: Partial<AppData> & { recurringTransactions?: RecurringTransaction[] } = {};
    if (accounts && Array.isArray(accounts)) data.accounts = accounts;
    if (categories && Array.isArray(categories)) data.categories = categories;
    if (transactions && Array.isArray(transactions)) data.transactions = transactions;
    if (settings && typeof settings === 'object') data.settings = settings;
    if (recurringTransactions && Array.isArray(recurringTransactions)) {
      data.recurringTransactions = recurringTransactions.map(migrateRecurringRule);
    }

    return data;
  } catch (err) {
    console.error('[IndexedDB] Failed to load full app data:', err);
    return null;
  }
}

/**
 * Saves all app collections to permanent IndexedDB in a single transaction
 */
export async function saveFullDataToIndexedDB(
  data: AppData & { recurringTransactions?: RecurringTransaction[] }
): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.put(data.accounts, 'accounts');
      store.put(data.categories, 'categories');
      store.put(data.transactions, 'transactions');
      store.put(data.settings, 'settings');
      if (data.recurringTransactions) {
        store.put(data.recurringTransactions.map(migrateRecurringRule), 'recurring_transactions');
      }
      store.put(new Date().toISOString(), 'last_saved_at');
      store.put('1.1.65', 'version');

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.error('[IndexedDB] Failed to save full data bundle:', err);
  }
}

function safeParseLocalStorage<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Retrieves all saved pre-migration snapshots from IndexedDB (`mm_pre_migration_backup`).
 */
export async function getPreMigrationSnapshots(): Promise<PreMigrationSnapshot[]> {
  try {
    const raw = await getItemFromIndexedDB<PreMigrationSnapshot[] | PreMigrationSnapshot>(
      PRE_MIGRATION_BACKUP_KEY
    );
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return [raw];
    return [];
  } catch {
    return [];
  }
}

/**
 * Saves an automatic pre-migration snapshot in IndexedDB under key `mm_pre_migration_backup`.
 * Retains the latest 2 snapshots and works for both signed-in users and guests.
 */
export async function savePreMigrationSnapshot(
  migrationName: string,
  currentState?: Partial<AppData> & {
    recurringTransactions?: RecurringTransaction[];
    uid?: string | null;
  }
): Promise<PreMigrationSnapshot | null> {
  try {
    const idbData = await loadFullDataFromIndexedDB();

    const accounts =
      currentState?.accounts ??
      idbData?.accounts ??
      safeParseLocalStorage<Account[]>('pwa_finance_accounts_v2', []);
    const categories =
      currentState?.categories ??
      idbData?.categories ??
      safeParseLocalStorage<Category[]>('pwa_finance_categories_v2', []);
    const transactions =
      currentState?.transactions ??
      idbData?.transactions ??
      safeParseLocalStorage<Transaction[]>('pwa_finance_transactions_v2', []);
    const settings =
      currentState?.settings ??
      idbData?.settings ??
      safeParseLocalStorage<AppSettings | null>('pwa_finance_settings_v2', null);
    const recurringTransactions =
      currentState?.recurringTransactions ??
      idbData?.recurringTransactions ??
      safeParseLocalStorage<RecurringTransaction[]>('pwa_finance_recurring_v1', []);

    let resolvedUid: string | null = currentState?.uid ?? settings?.userProfile?.uid ?? null;
    if (!resolvedUid && typeof localStorage !== 'undefined') {
      try {
        const cachedUser = safeParseLocalStorage<{ uid?: string } | null>('mm_cached_auth_user', null);
        if (cachedUser?.uid) resolvedUid = cachedUser.uid;
      } catch {}
    }

    const now = Date.now();
    const snapshot: PreMigrationSnapshot = {
      id: `pre_mig_${now}_${Math.random().toString(36).slice(2, 7)}`,
      migrationName,
      createdAt: now,
      createdAtISO: new Date(now).toISOString(),
      uid: resolvedUid,
      isGuest: !resolvedUid,
      data: JSON.parse(
        JSON.stringify({
          accounts,
          categories,
          transactions,
          settings,
          recurringTransactions,
        })
      ),
    };

    const existing = await getPreMigrationSnapshots();
    const updated = [snapshot, ...existing].slice(0, MAX_PRE_MIGRATION_SNAPSHOTS);
    await saveItemToIndexedDB(PRE_MIGRATION_BACKUP_KEY, updated);
    return snapshot;
  } catch (err) {
    console.warn(`[IndexedDB] Failed to save pre-migration snapshot (${migrationName}):`, err);
    return null;
  }
}
