import { parseFormattedNumber } from './formatters';
import { Account, Category, Transaction, AppSettings, AppData, RecurringTransaction } from '../types';
import { DEFAULT_ACCOUNTS, INITIAL_CATEGORIES, DEFAULT_SETTINGS } from './constants';
import { syncAllAccountBalances } from './balanceEngine';
import { saveItemToIndexedDB, saveFullDataToIndexedDB } from './indexedDB';
import { debouncedPersist } from './persistQueue';
import {
  loadMyShareFolders,
  saveMyShareFolders,
  loadReceivedShareFolders,
  saveReceivedShareFolders,
  ShareFolder,
} from './shareFolders';

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

// Immediate writers (used by the debounced queue)
function writeNow(key: string, storeName: 'accounts' | 'categories' | 'transactions' | 'settings', value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to save ${storeName} to localStorage:`, err);
  }
  // Permanently sync to IndexedDB
  saveItemToIndexedDB(storeName, value as any);
}

// Debounced (400ms) persistence so JSON serialization never blocks UI interactions
export function saveAccounts(accounts: Account[]): void {
  debouncedPersist(ACCOUNTS_KEY, () => writeNow(ACCOUNTS_KEY, 'accounts', accounts));
}

export function saveCategories(categories: Category[]): void {
  debouncedPersist(CATEGORIES_KEY, () => writeNow(CATEGORIES_KEY, 'categories', categories));
}

export function saveTransactions(transactions: Transaction[]): void {
  debouncedPersist(TRANSACTIONS_KEY, () => writeNow(TRANSACTIONS_KEY, 'transactions', transactions));
}

export function saveSettings(settings: AppSettings): void {
  debouncedPersist(SETTINGS_KEY, () => writeNow(SETTINGS_KEY, 'settings', settings));
}

/**
 * Exports full app data as a downloadable JSON file
 */
export function exportAllDataAsJSON(data: AppData): void {
  const exportPayload = {
    version: '1.1.57',
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
    version: '1.1.57',
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

export interface ParsedBackupPreview {
  valid: boolean;
  error?: string;
  version?: string;
  exportDate?: string;
  appName?: string;
  accountsCount: number;
  categoriesCount: number;
  transactionsCount: number;
  budgetsCount: number;
  sharedSpacesCount: number;
  rawPayload?: any;
}

export interface CustomImportConfig {
  importAccounts: boolean;
  importCategories: boolean;
  importTransactions: boolean;
  importBudgets: boolean;
  importSharedSpaces: boolean;
  mode: 'merge' | 'replace';
}

export interface CustomImportResult {
  updatedAccounts: Account[];
  updatedCategories: Category[];
  updatedTransactions: Transaction[];
  updatedRecurring?: RecurringTransaction[];
  importedCounts: {
    accounts: number;
    categories: number;
    transactions: number;
    budgets: number;
    sharedSpaces: number;
  };
}

/**
 * Safely parses and inspects any backup/export JSON file,
 * detecting counts of accounts, categories, transactions, budgets, and shared spaces.
 */
export function parseBackupFile(jsonString: string): ParsedBackupPreview {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return {
        valid: false,
        error: 'Empty or invalid file content',
        accountsCount: 0,
        categoriesCount: 0,
        transactionsCount: 0,
        budgetsCount: 0,
        sharedSpacesCount: 0,
      };
    }

    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        error: 'JSON root must be an object',
        accountsCount: 0,
        categoriesCount: 0,
        transactionsCount: 0,
        budgetsCount: 0,
        sharedSpacesCount: 0,
      };
    }

    const accountsCount = Array.isArray(parsed.accounts)
      ? parsed.accounts.length
      : parsed.account && typeof parsed.account === 'object'
      ? 1
      : 0;

    const categoriesCount = Array.isArray(parsed.categories) ? parsed.categories.length : 0;

    const transactionsCount = Array.isArray(parsed.transactions) ? parsed.transactions.length : 0;

    let budgetsCount = 0;
    if (Array.isArray(parsed.budgets)) {
      budgetsCount = parsed.budgets.length;
    } else if (Array.isArray(parsed.categories)) {
      budgetsCount = parsed.categories.filter(
        (c: any) => c && typeof c.budgetLimit === 'number' && c.budgetLimit > 0
      ).length;
    }

    let sharedSpacesCount = 0;
    if (parsed.sharedSpaces && typeof parsed.sharedSpaces === 'object') {
      const myCount = Array.isArray(parsed.sharedSpaces.myFolders) ? parsed.sharedSpaces.myFolders.length : 0;
      const recvCount = Array.isArray(parsed.sharedSpaces.receivedFolders)
        ? parsed.sharedSpaces.receivedFolders.length
        : 0;
      sharedSpacesCount = myCount + recvCount;
    } else if (Array.isArray(parsed.sharedFolders)) {
      sharedSpacesCount = parsed.sharedFolders.length;
    } else {
      const myCount = Array.isArray(parsed.myFolders) ? parsed.myFolders.length : 0;
      const recvCount = Array.isArray(parsed.receivedFolders) ? parsed.receivedFolders.length : 0;
      sharedSpacesCount = myCount + recvCount;
    }

    return {
      valid: true,
      version: parsed.version,
      exportDate: parsed.exportDate || parsed.backupDate,
      appName: parsed.appName,
      accountsCount,
      categoriesCount,
      transactionsCount,
      budgetsCount,
      sharedSpacesCount,
      rawPayload: parsed,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || 'Failed to parse JSON file',
      accountsCount: 0,
      categoriesCount: 0,
      transactionsCount: 0,
      budgetsCount: 0,
      sharedSpacesCount: 0,
    };
  }
}

/**
 * Executes granular custom import, merging or replacing selected sections,
 * synchronizing account balances, and updating localStorage and IndexedDB immediately.
 */
export function executeCustomDataImport(
  currentState: AppData & { recurringTransactions?: RecurringTransaction[] },
  payload: any,
  config: CustomImportConfig
): CustomImportResult {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload provided for import');
  }

  let finalAccounts = [...currentState.accounts];
  let finalCategories = [...currentState.categories];
  let finalTransactions = [...currentState.transactions];
  let finalRecurring = currentState.recurringTransactions ? [...currentState.recurringTransactions] : [];

  let importedAccountsCount = 0;
  let importedCategoriesCount = 0;
  let importedTransactionsCount = 0;
  let importedBudgetsCount = 0;
  let importedSharedSpacesCount = 0;

  // 1. ACCOUNTS IMPORT
  if (config.importAccounts) {
    const incomingAccounts: Account[] = Array.isArray(payload.accounts)
      ? payload.accounts
      : payload.account && typeof payload.account === 'object'
      ? [payload.account]
      : [];

    if (config.mode === 'replace') {
      if (incomingAccounts.length > 0) {
        finalAccounts = incomingAccounts.map((a) => ({
          ...a,
          balance: parseFormattedNumber(a.balance),
        }));
        importedAccountsCount = incomingAccounts.length;
      }
    } else {
      // Merge mode: Deduplicate by account.id
      for (const incAcc of incomingAccounts) {
        if (!incAcc || !incAcc.id) continue;
        const existingIdx = finalAccounts.findIndex((a) => a.id === incAcc.id);
        const cleanAcc = {
          ...incAcc,
          balance: parseFormattedNumber(incAcc.balance),
        };
        if (existingIdx >= 0) {
          finalAccounts[existingIdx] = { ...finalAccounts[existingIdx], ...cleanAcc };
        } else {
          finalAccounts.push(cleanAcc);
        }
        importedAccountsCount++;
      }
    }
  }

  // 2. CATEGORIES & BUDGETS IMPORT
  if (config.importCategories) {
    const incomingCategories: Category[] = Array.isArray(payload.categories) ? payload.categories : [];

    if (config.mode === 'replace') {
      if (incomingCategories.length > 0) {
        finalCategories = incomingCategories.map((cat) => ({
          ...cat,
          budgetLimit: config.importBudgets ? (typeof cat.budgetLimit === 'number' ? cat.budgetLimit : 0) : 0,
        }));
        importedCategoriesCount = incomingCategories.length;
        if (config.importBudgets) {
          importedBudgetsCount = finalCategories.filter((c) => c.budgetLimit > 0).length;
        }
      }
    } else {
      // Merge mode: Deduplicate by id or matching normalized name and type
      for (const incCat of incomingCategories) {
        if (!incCat || !incCat.name) continue;
        const existingIdx = finalCategories.findIndex(
          (c) =>
            c.id === incCat.id ||
            (c.name.trim().toLowerCase() === incCat.name.trim().toLowerCase() && c.type === incCat.type)
        );

        if (existingIdx >= 0) {
          const existingLimit = finalCategories[existingIdx].budgetLimit || 0;
          finalCategories[existingIdx] = {
            ...finalCategories[existingIdx],
            ...incCat,
            budgetLimit: config.importBudgets
              ? (typeof incCat.budgetLimit === 'number' ? incCat.budgetLimit : existingLimit)
              : existingLimit,
          };
        } else {
          finalCategories.push({
            ...incCat,
            budgetLimit: config.importBudgets
              ? (typeof incCat.budgetLimit === 'number' ? incCat.budgetLimit : 0)
              : 0,
          });
        }
        importedCategoriesCount++;
        if (config.importBudgets && typeof incCat.budgetLimit === 'number' && incCat.budgetLimit > 0) {
          importedBudgetsCount++;
        }
      }
    }
  } else if (config.importBudgets) {
    // If user selected ONLY budgets without replacing categories, update existing categories' budget limits
    const incomingCategories: Category[] = Array.isArray(payload.categories) ? payload.categories : [];
    for (const incCat of incomingCategories) {
      if (!incCat || typeof incCat.budgetLimit !== 'number' || incCat.budgetLimit <= 0) continue;
      const existingIdx = finalCategories.findIndex(
        (c) =>
          c.id === incCat.id ||
          (c.name.trim().toLowerCase() === incCat.name.trim().toLowerCase() && c.type === incCat.type)
      );
      if (existingIdx >= 0) {
        finalCategories[existingIdx] = {
          ...finalCategories[existingIdx],
          budgetLimit: incCat.budgetLimit,
        };
        importedBudgetsCount++;
      }
    }
  }

  // 3. TRANSACTIONS IMPORT
  if (config.importTransactions) {
    const incomingTxs: Transaction[] = Array.isArray(payload.transactions) ? payload.transactions : [];

    const sanitizedTxs = incomingTxs.map((tx) => ({
      ...tx,
      amount: parseFormattedNumber(tx.amount),
    }));
    if (config.mode === 'replace') {
      finalTransactions = sanitizedTxs;
      importedTransactionsCount = sanitizedTxs.length;

      // Also replace recurring transactions if present in backup
      if (Array.isArray(payload.recurringTransactions)) {
        finalRecurring = payload.recurringTransactions;
      }
    } else {
      // Merge mode: Deduplicate by transaction.id
      const existingTxIds = new Set(finalTransactions.map((t) => t.id));
      for (const rawTx of incomingTxs) {
        if (!rawTx || !rawTx.id) continue;
        const tx = {
          ...rawTx,
          amount: parseFormattedNumber(rawTx.amount),
        };
        if (!existingTxIds.has(tx.id)) {
          finalTransactions.push(tx);
          existingTxIds.add(tx.id);
          importedTransactionsCount++;
        }
      }

      // Merge recurring rules
      if (Array.isArray(payload.recurringTransactions)) {
        const existingRecurIds = new Set(finalRecurring.map((r) => r.id));
        for (const recur of payload.recurringTransactions) {
          if (recur && recur.id && !existingRecurIds.has(recur.id)) {
            finalRecurring.push(recur);
            existingRecurIds.add(recur.id);
          }
        }
      }
    }
  }

  // 4. SHARED SPACES IMPORT
  if (config.importSharedSpaces) {
    const incomingMyFolders: ShareFolder[] =
      payload.sharedSpaces?.myFolders ||
      payload.myFolders ||
      (Array.isArray(payload.sharedFolders) ? payload.sharedFolders : []);
    const incomingRecvFolders: ShareFolder[] =
      payload.sharedSpaces?.receivedFolders || payload.receivedFolders || [];

    if (config.mode === 'replace') {
      if (Array.isArray(incomingMyFolders)) {
        saveMyShareFolders(incomingMyFolders);
        importedSharedSpacesCount += incomingMyFolders.length;
      }
      if (Array.isArray(incomingRecvFolders)) {
        saveReceivedShareFolders(incomingRecvFolders);
        importedSharedSpacesCount += incomingRecvFolders.length;
      }
    } else {
      // Merge mode: deduplicate by folder.id
      if (Array.isArray(incomingMyFolders) && incomingMyFolders.length > 0) {
        const currentMy = loadMyShareFolders();
        const map = new Map<string, ShareFolder>();
        currentMy.forEach((f) => map.set(f.id, f));
        incomingMyFolders.forEach((f) => {
          if (f && f.id) {
            map.set(f.id, { ...(map.get(f.id) || {}), ...f });
            importedSharedSpacesCount++;
          }
        });
        saveMyShareFolders(Array.from(map.values()));
      }

      if (Array.isArray(incomingRecvFolders) && incomingRecvFolders.length > 0) {
        const currentRecv = loadReceivedShareFolders();
        const map = new Map<string, ShareFolder>();
        currentRecv.forEach((f) => map.set(f.id, f));
        incomingRecvFolders.forEach((f) => {
          if (f && f.id) {
            map.set(f.id, { ...(map.get(f.id) || {}), ...f });
            importedSharedSpacesCount++;
          }
        });
        saveReceivedShareFolders(Array.from(map.values()));
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('shared_folders_updated'));
    } catch {}
  }

  // 5. ACCURATE BALANCE RECALCULATION
  finalAccounts = syncAllAccountBalances(finalAccounts, finalTransactions);

  // 6. IMMEDIATE STORAGE & INDEXEDDB SYNCHRONIZATION
  writeNow(ACCOUNTS_KEY, 'accounts', finalAccounts);
  writeNow(CATEGORIES_KEY, 'categories', finalCategories);
  writeNow(TRANSACTIONS_KEY, 'transactions', finalTransactions);
  if (finalRecurring.length > 0) {
    try {
      localStorage.setItem('pwa_finance_recurring_transactions', JSON.stringify(finalRecurring));
    } catch {}
  }

  saveFullDataToIndexedDB({
    accounts: finalAccounts,
    categories: finalCategories,
    transactions: finalTransactions,
    settings: currentState.settings,
  });

  return {
    updatedAccounts: finalAccounts,
    updatedCategories: finalCategories,
    updatedTransactions: finalTransactions,
    updatedRecurring: finalRecurring,
    importedCounts: {
      accounts: importedAccountsCount,
      categories: importedCategoriesCount,
      transactions: importedTransactionsCount,
      budgets: importedBudgetsCount,
      sharedSpaces: importedSharedSpacesCount,
    },
  };
}
