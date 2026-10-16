import { Account, Category, Transaction, AppSettings, AppData } from '../types';
import { DEFAULT_ACCOUNTS, INITIAL_CATEGORIES, DEFAULT_SETTINGS } from './constants';
import { syncAllAccountBalances } from './balanceEngine';
import { saveItemToIndexedDB } from './indexedDB';

const ACCOUNTS_KEY = 'pwa_finance_accounts';
const CATEGORIES_KEY = 'pwa_finance_categories';
const TRANSACTIONS_KEY = 'pwa_finance_transactions';
const SETTINGS_KEY = 'pwa_finance_settings';

export function loadInitialData(): AppData {
  try {
    const rawAccounts = localStorage.getItem(ACCOUNTS_KEY);
    const rawCategories = localStorage.getItem(CATEGORIES_KEY);
    const rawTransactions = localStorage.getItem(TRANSACTIONS_KEY);
    const rawSettings = localStorage.getItem(SETTINGS_KEY);

    let accounts: Account[] = DEFAULT_ACCOUNTS;
    let categories: Category[] = INITIAL_CATEGORIES;
    let transactions: Transaction[] = [];
    let settings: AppSettings = DEFAULT_SETTINGS;

    try {
      if (rawAccounts) {
        const parsed = JSON.parse(rawAccounts);
        if (Array.isArray(parsed) && parsed.length > 0) accounts = parsed;
      }
    } catch {}

    try {
      if (rawCategories) {
        const parsed = JSON.parse(rawCategories);
        if (Array.isArray(parsed) && parsed.length > 0) categories = parsed;
      }
    } catch {}

    try {
      if (rawTransactions) {
        const parsed = JSON.parse(rawTransactions);
        if (Array.isArray(parsed)) transactions = parsed;
      }
    } catch {}

    try {
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed && typeof parsed === 'object') {
          settings = { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch {}

    // Always ensure balances accurately match transaction history
    accounts = syncAllAccountBalances(accounts, transactions);

    return { accounts, categories, transactions, settings };
  } catch (error) {
    console.error('Error loading data from localStorage:', error);
    return {
      accounts: DEFAULT_ACCOUNTS,
      categories: INITIAL_CATEGORIES,
      transactions: [],
      settings: DEFAULT_SETTINGS,
    };
  }
}

export function saveAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save accounts to localStorage:', err);
  }
  // Permanently sync to IndexedDB
  saveItemToIndexedDB('accounts', accounts);
}

export function saveCategories(categories: Category[]): void {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error('Failed to save categories to localStorage:', err);
  }
  // Permanently sync to IndexedDB
  saveItemToIndexedDB('categories', categories);
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.error('Failed to save transactions to localStorage:', err);
  }
  // Permanently sync to IndexedDB
  saveItemToIndexedDB('transactions', transactions);
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
  // Permanently sync to IndexedDB
  saveItemToIndexedDB('settings', settings);
}

/**
 * Exports full app data as a downloadable JSON file
 */
export function exportAllDataAsJSON(data: AppData): void {
  const exportPayload = {
    version: '1.0.9',
    exportDate: new Date().toISOString(),
    ...data,
  };
  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports single account data and its transactions
 */
export function exportAccountAsJSON(account: Account, allTransactions: Transaction[]): void {
  const accountTransactions = allTransactions.filter(
    (tx) => tx.accountId === account.id || tx.toAccountId === account.id
  );
  const payload = {
    version: '1.0.9',
    type: 'single_account_backup',
    exportDate: new Date().toISOString(),
    account,
    transactions: accountTransactions,
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = account.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.download = `account_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
