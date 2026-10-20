import { rtdb } from './firebase';
import { ref, set, push, onValue, off } from 'firebase/database';
import { cleanNumericId, format16DigitId } from './userId';
import { Account, Category, Transaction } from '../types';

export interface ShareFolderPayload {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export interface ShareFolder {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  ownerNumericId: string;
  ownerName: string;
  itemType: 'single_account' | 'single_category' | 'single_tx' | 'mixed';
  itemCount: number;
  payload: ShareFolderPayload;
  recipientNumericId?: string;
}

const STORAGE_MY_FOLDERS_KEY = 'pwa_finance_share_folders_v2';
const STORAGE_RECEIVED_FOLDERS_KEY = 'pwa_finance_received_share_folders_v2';

/**
 * Load all user-created dedicated Share Folders from LocalStorage
 */
export function loadMyShareFolders(): ShareFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_MY_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persist user-created dedicated Share Folders to LocalStorage
 */
export function saveMyShareFolders(folders: ShareFolder[]): void {
  try {
    localStorage.setItem(STORAGE_MY_FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save local share folders:', err);
  }
}

/**
 * Load all received Share Folders sent by friends
 */
export function loadReceivedShareFolders(): ShareFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECEIVED_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persist received Share Folders to LocalStorage
 */
export function saveReceivedShareFolders(folders: ShareFolder[]): void {
  try {
    localStorage.setItem(STORAGE_RECEIVED_FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save received share folders:', err);
  }
}

/**
 * Automatically determine Folder Name, Icon, and ItemType based on selected items
 */
export function deduceFolderMetadata(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  isArabic: boolean
): { name: string; icon: string; itemType: ShareFolder['itemType'] } {
  // Case 1: Exactly 1 account selected
  if (accounts.length === 1 && categories.length === 0 && transactions.length === 0) {
    return {
      name: accounts[0].name,
      icon: accounts[0].icon || '🏦',
      itemType: 'single_account',
    };
  }

  // Case 2: Exactly 1 category selected
  if (categories.length === 1 && accounts.length === 0) {
    return {
      name: categories[0].name,
      icon: categories[0].icon || '🏷️',
      itemType: 'single_category',
    };
  }

  // Case 3: Exactly 1 transaction selected
  if (transactions.length === 1 && accounts.length === 0 && categories.length === 0) {
    const tx = transactions[0];
    return {
      name: tx.description?.trim() || (isArabic ? 'معاملة فردية' : 'Single Transaction'),
      icon: tx.type === 'income' ? '💵' : tx.type === 'transfer' ? '🔁' : '💳',
      itemType: 'single_tx',
    };
  }

  // Case 4: Multiple or mixed items -> Default bundle metadata
  const totalItems = accounts.length + categories.length + transactions.length;
  return {
    name: isArabic ? `مجموعة مشاركة (${totalItems})` : `Share Bundle (${totalItems})`,
    icon: '📁',
    itemType: 'mixed',
  };
}

/**
 * Create a new standalone Share Folder (NEVER creates or alters spending categories!)
 */
export function createNewShareFolder(params: {
  customName?: string;
  customIcon?: string;
  accounts?: Account[];
  categories?: Category[];
  transactions?: Transaction[];
  ownerNumericId: string;
  ownerName: string;
  isArabic: boolean;
}): ShareFolder {
  const accounts = params.accounts || [];
  const categories = params.categories || [];
  const transactions = params.transactions || [];

  const autoMeta = deduceFolderMetadata(accounts, categories, transactions, params.isArabic);
  const name = params.customName?.trim() || autoMeta.name;
  const icon = params.customIcon?.trim() || autoMeta.icon;
  const itemCount = accounts.length + categories.length + transactions.length;

  const folder: ShareFolder = {
    id: `share_folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    icon,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerNumericId: params.ownerNumericId,
    ownerName: params.ownerName || 'User',
    itemType: autoMeta.itemType,
    itemCount,
    payload: {
      accounts,
      categories,
      transactions,
    },
  };

  const existing = loadMyShareFolders();
  const updated = [folder, ...existing];
  saveMyShareFolders(updated);

  return folder;
}

/**
 * Add items to an existing Share Folder
 */
export function appendToExistingShareFolder(
  folderId: string,
  newItems: { accounts?: Account[]; categories?: Category[]; transactions?: Transaction[] }
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return null;

  const folder = existing[idx];
  const combinedAccounts = [...folder.payload.accounts];
  const combinedCategories = [...folder.payload.categories];
  const combinedTransactions = [...folder.payload.transactions];

  newItems.accounts?.forEach((acc) => {
    if (!combinedAccounts.some((a) => a.id === acc.id)) combinedAccounts.push(acc);
  });
  newItems.categories?.forEach((cat) => {
    if (!combinedCategories.some((c) => c.id === cat.id)) combinedCategories.push(cat);
  });
  newItems.transactions?.forEach((tx) => {
    if (!combinedTransactions.some((t) => t.id === tx.id)) combinedTransactions.push(tx);
  });

  const updatedFolder: ShareFolder = {
    ...folder,
    updatedAt: Date.now(),
    itemCount: combinedAccounts.length + combinedCategories.length + combinedTransactions.length,
    payload: {
      accounts: combinedAccounts,
      categories: combinedCategories,
      transactions: combinedTransactions,
    },
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);
  return updatedFolder;
}

/**
 * Send a Share Folder directly to a friend's 16-Digit Numeric ID via Firebase RTDB
 */
export async function sendShareFolderToRecipient(
  folder: ShareFolder,
  recipient16DigitId: string
): Promise<{ success: boolean; error?: string }> {
  const cleanRecipientId = cleanNumericId(recipient16DigitId);
  if (cleanRecipientId.length !== 16) {
    return {
      success: false,
      error: 'Invalid recipient ID. Must be exactly 16 digits.',
    };
  }

  try {
    const bundlePayload = {
      ...folder,
      recipientNumericId: cleanRecipientId,
      deliveredAt: Date.now(),
    };

    // 1. Deliver directly into the recipient's numeric ID inbox
    const recipientInboxRef = ref(rtdb, `inboxByNumericId/${cleanRecipientId}/${folder.id}`);
    await set(recipientInboxRef, bundlePayload);

    // 2. Publish to universal sharedBundles registry
    const sharedBundleRef = ref(rtdb, `sharedBundles/${folder.id}`);
    await set(sharedBundleRef, bundlePayload);

    return { success: true };
  } catch (err: any) {
    console.error('[ShareFolders] Failed to send share folder:', err);
    return {
      success: false,
      error: err?.message || 'Network error delivering share folder',
    };
  }
}

/**
 * Listen for live incoming share folders on the user's 16-digit numeric ID inbox
 */
export function listenToMyNumericIdInbox(
  my16DigitId: string,
  onNewFolderReceived: (folder: ShareFolder) => void
): () => void {
  const cleanId = cleanNumericId(my16DigitId);
  if (cleanId.length !== 16) return () => {};

  const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}`);

  // Track already seen IDs locally to only trigger callback on truly new/updated items
  const seenIds = new Set(loadReceivedShareFolders().map((f) => f.id));

  const callback = (snapshot: any) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    if (!data) return;

    Object.keys(data).forEach((key) => {
      const item = data[key] as ShareFolder;
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);

        // Save to received folders list
        const received = loadReceivedShareFolders();
        if (!received.some((r) => r.id === item.id)) {
          saveReceivedShareFolders([item, ...received]);
        }

        onNewFolderReceived(item);
      }
    });
  };

  onValue(inboxRef, callback);

  return () => {
    off(inboxRef, 'value', callback);
  };
}
