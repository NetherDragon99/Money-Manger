/**
 * IndexedDB Permanent Storage Layer for Personal Finance Tracker
 * Provides persistent, quota-exempt device storage that survives browser cache clearings.
 */

import { AppData, Account, Category, Transaction, AppSettings } from '../types';

const DB_NAME = 'PersonalFinanceTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data_store';

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
export async function loadFullDataFromIndexedDB(): Promise<Partial<AppData> | null> {
  try {
    const [accounts, categories, transactions, settings] = await Promise.all([
      getItemFromIndexedDB<Account[]>('accounts'),
      getItemFromIndexedDB<Category[]>('categories'),
      getItemFromIndexedDB<Transaction[]>('transactions'),
      getItemFromIndexedDB<AppSettings>('settings'),
    ]);

    if (!accounts && !categories && !transactions && !settings) {
      return null;
    }

    const data: Partial<AppData> = {};
    if (accounts && Array.isArray(accounts)) data.accounts = accounts;
    if (categories && Array.isArray(categories)) data.categories = categories;
    if (transactions && Array.isArray(transactions)) data.transactions = transactions;
    if (settings && typeof settings === 'object') data.settings = settings;

    return data;
  } catch (err) {
    console.error('[IndexedDB] Failed to load full app data:', err);
    return null;
  }
}

/**
 * Saves all app collections to permanent IndexedDB in a single transaction
 */
export async function saveFullDataToIndexedDB(data: AppData): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.put(data.accounts, 'accounts');
      store.put(data.categories, 'categories');
      store.put(data.transactions, 'transactions');
      store.put(data.settings, 'settings');
      store.put(new Date().toISOString(), 'last_saved_at');
      store.put('1.1.49', 'version');

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
