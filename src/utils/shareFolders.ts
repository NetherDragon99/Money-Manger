import { rtdb } from './firebase';
import { ref, set, get, remove, onValue, off } from 'firebase/database';
import { cleanNumericId, format16DigitId } from './userId';
import { Account, Category, Transaction } from '../types';

export interface ShareMember {
  numericId: string;
  name: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted';
  addedAt: number;
}

export interface ShareFolderPayload {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export interface ShareFolder {
  id: string;
  name: string;
  icon: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  ownerNumericId: string;
  ownerName: string;
  permission: 'view_only' | 'allow_import_edit';
  members: ShareMember[];
  itemType: 'single_account' | 'single_category' | 'single_tx' | 'mixed';
  itemCount: number;
  payload: ShareFolderPayload;
  recipientNumericId?: string;
}

const STORAGE_MY_FOLDERS_KEY = 'pwa_finance_share_folders_v3';
const STORAGE_RECEIVED_FOLDERS_KEY = 'pwa_finance_received_share_folders_v3';

/**
 * Load user's created Share Pages from LocalStorage
 */
export function loadMyShareFolders(): ShareFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_MY_FOLDERS_KEY) || localStorage.getItem('pwa_finance_share_folders_v2');
    if (!raw) return [];
    const list = JSON.parse(raw) as ShareFolder[];
    return list.map((f) => ({
      ...f,
      members: f.members || [],
      permission: f.permission || 'allow_import_edit',
      payload: {
        accounts: f.payload?.accounts || [],
        categories: f.payload?.categories || [],
        transactions: f.payload?.transactions || [],
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Persist user's created Share Pages to LocalStorage
 */
export function saveMyShareFolders(folders: ShareFolder[]): void {
  try {
    localStorage.setItem(STORAGE_MY_FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save local share folders:', err);
  }
}

/**
 * Load received Share Pages ("Shared With Me") from LocalStorage
 */
export function loadReceivedShareFolders(): ShareFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECEIVED_FOLDERS_KEY) || localStorage.getItem('pwa_finance_received_share_folders_v2');
    if (!raw) return [];
    const list = JSON.parse(raw) as ShareFolder[];
    return list.map((f) => ({
      ...f,
      members: f.members || [],
      permission: f.permission || 'allow_import_edit',
      payload: {
        accounts: f.payload?.accounts || [],
        categories: f.payload?.categories || [],
        transactions: f.payload?.transactions || [],
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Persist received Share Pages to LocalStorage
 */
export function saveReceivedShareFolders(folders: ShareFolder[]): void {
  try {
    localStorage.setItem(STORAGE_RECEIVED_FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save received share folders:', err);
  }
}

/**
 * Auto-deduce Folder Name and Icon from selected item(s)
 * - Single Account: inherits Account Name + Icon
 * - Single Category: inherits Category Name + Icon
 * - Single Transaction: inherits Transaction Description/Category + Icon
 * - Multiple or empty: default name ("شير جديد #N" / "Shared Page #N") and folder icon (📁)
 */
export function deduceFolderMetadata(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  isArabic: boolean
): { name: string; icon: string; itemType: ShareFolder['itemType'] } {
  // Case 1: Exactly 1 account
  if (accounts.length === 1 && categories.length === 0 && transactions.length === 0) {
    return {
      name: accounts[0].name,
      icon: accounts[0].icon || '🏦',
      itemType: 'single_account',
    };
  }

  // Case 2: Exactly 1 category
  if (categories.length === 1 && accounts.length === 0 && transactions.length === 0) {
    return {
      name: categories[0].name,
      icon: categories[0].icon || '🏷️',
      itemType: 'single_category',
    };
  }

  // Case 3: Exactly 1 transaction
  if (transactions.length === 1 && accounts.length === 0 && categories.length === 0) {
    const tx = transactions[0];
    const desc = tx.description?.trim();
    return {
      name: desc || tx.categoryName || (isArabic ? 'معاملة مالية' : 'Transaction Item'),
      icon: tx.type === 'income' ? '💵' : tx.type === 'transfer' ? '🔁' : '💳',
      itemType: 'single_tx',
    };
  }

  // Case 4: Multiple or mixed items -> default template name & folder icon
  const total = accounts.length + categories.length + transactions.length;
  const count = loadMyShareFolders().length + 1;
  return {
    name: isArabic ? `شير جديد #${count}` : `Shared Page #${count}`,
    icon: '📁',
    itemType: total > 0 ? 'mixed' : 'mixed',
  };
}

/**
 * Sync folder to Firebase RTDB for universal web viewing and member real-time syncing
 */
export async function syncFolderToCloud(folder: ShareFolder): Promise<void> {
  try {
    const cloudRef = ref(rtdb, `sharedBundles/${folder.id}`);
    await set(cloudRef, folder);

    // Also update member inboxes
    for (const member of folder.members) {
      const inboxRef = ref(rtdb, `inboxByNumericId/${member.numericId}/${folder.id}`);
      await set(inboxRef, folder);
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to sync folder to cloud:', err);
  }
}

/**
 * Create a new standalone Share Page / Template
 */
export function createNewShareFolder(params: {
  customName?: string;
  customIcon?: string;
  customDescription?: string;
  accounts?: Account[];
  categories?: Category[];
  transactions?: Transaction[];
  ownerNumericId: string;
  ownerName: string;
  permission?: 'view_only' | 'allow_import_edit';
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
    id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    icon,
    description: params.customDescription?.trim() || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerNumericId: cleanNumericId(params.ownerNumericId),
    ownerName: params.ownerName || 'User',
    permission: params.permission || 'allow_import_edit',
    members: [],
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

  // Background cloud sync
  syncFolderToCloud(folder);

  return folder;
}

/**
 * Append items to an existing Share Page
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
  syncFolderToCloud(updatedFolder);

  return updatedFolder;
}

/**
 * Remove a specific item from a Share Page
 */
export function removeItemFromShareFolder(
  folderId: string,
  itemType: 'account' | 'category' | 'transaction',
  itemId: string
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return null;

  const folder = existing[idx];
  let nextAccounts = folder.payload.accounts;
  let nextCategories = folder.payload.categories;
  let nextTransactions = folder.payload.transactions;

  if (itemType === 'account') {
    nextAccounts = nextAccounts.filter((a) => a.id !== itemId);
  } else if (itemType === 'category') {
    nextCategories = nextCategories.filter((c) => c.id !== itemId);
  } else {
    nextTransactions = nextTransactions.filter((t) => t.id !== itemId);
  }

  const updatedFolder: ShareFolder = {
    ...folder,
    updatedAt: Date.now(),
    itemCount: nextAccounts.length + nextCategories.length + nextTransactions.length,
    payload: {
      accounts: nextAccounts,
      categories: nextCategories,
      transactions: nextTransactions,
    },
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);
  syncFolderToCloud(updatedFolder);

  return updatedFolder;
}

/**
 * Update Share Page settings (name, icon, description, permission)
 */
export function updateShareFolderSettings(
  folderId: string,
  updates: {
    name?: string;
    icon?: string;
    description?: string;
    permission?: 'view_only' | 'allow_import_edit';
  }
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return null;

  const folder = existing[idx];
  const updatedFolder: ShareFolder = {
    ...folder,
    name: updates.name?.trim() || folder.name,
    icon: updates.icon?.trim() || folder.icon,
    description: updates.description !== undefined ? updates.description.trim() : folder.description,
    permission: updates.permission || folder.permission,
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);
  syncFolderToCloud(updatedFolder);

  return updatedFolder;
}

/**
 * Delete a Share Page permanently
 */
export async function deleteShareFolder(folderId: string): Promise<void> {
  const existing = loadMyShareFolders();
  const folder = existing.find((f) => f.id === folderId);
  const updated = existing.filter((f) => f.id !== folderId);
  saveMyShareFolders(updated);

  try {
    // Remove from cloud
    const cloudRef = ref(rtdb, `sharedBundles/${folderId}`);
    await remove(cloudRef);

    // Remove from member inboxes
    if (folder) {
      for (const member of folder.members) {
        const inboxRef = ref(rtdb, `inboxByNumericId/${member.numericId}/${folderId}`);
        await remove(inboxRef);
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove folder from cloud:', err);
  }
}

/**
 * Add a member to a Share Page by 16-Digit Numeric ID
 */
export async function addMemberToShareFolder(
  folderId: string,
  member16DigitId: string,
  memberName?: string,
  role: 'viewer' | 'editor' = 'viewer'
): Promise<{ success: boolean; folder?: ShareFolder; error?: string }> {
  const cleanId = cleanNumericId(member16DigitId);
  if (cleanId.length !== 16) {
    return { success: false, error: 'Invalid ID. Must be 16 digits.' };
  }

  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) {
    return { success: false, error: 'Share page not found' };
  }

  const folder = existing[idx];
  if (folder.members.some((m) => m.numericId === cleanId)) {
    return { success: false, error: 'Member is already added to this share' };
  }

  const newMember: ShareMember = {
    numericId: cleanId,
    name: memberName || `User ${format16DigitId(cleanId).slice(0, 4)}`,
    role,
    status: 'pending',
    addedAt: Date.now(),
  };

  const updatedFolder: ShareFolder = {
    ...folder,
    members: [...folder.members, newMember],
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);

  try {
    // Deliver to recipient's inbox in Firebase RTDB
    const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}/${folder.id}`);
    await set(inboxRef, updatedFolder);

    // Update cloud bundle
    const cloudRef = ref(rtdb, `sharedBundles/${folder.id}`);
    await set(cloudRef, updatedFolder);

    return { success: true, folder: updatedFolder };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to deliver to recipient' };
  }
}

/**
 * Remove / Revoke a member from a Share Page
 */
export async function removeMemberFromShareFolder(
  folderId: string,
  member16DigitId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanId = cleanNumericId(member16DigitId);
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return { success: false };

  const folder = existing[idx];
  const updatedFolder: ShareFolder = {
    ...folder,
    members: folder.members.filter((m) => m.numericId !== cleanId),
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);

  try {
    // Delete from recipient's inbox
    const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}/${folder.id}`);
    await remove(inboxRef);

    // Update cloud bundle
    const cloudRef = ref(rtdb, `sharedBundles/${folder.id}`);
    await set(cloudRef, updatedFolder);
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove member from cloud inbox:', err);
  }

  return { success: true, folder: updatedFolder };
}

/**
 * Accept a share invitation in "Shared With Me"
 */
export async function acceptShareInvitation(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const received = loadReceivedShareFolders();
  const cleanId = cleanNumericId(my16DigitId);

  const updated = received.map((f) => {
    if (f.id === folderId) {
      return {
        ...f,
        members: f.members.map((m) => (m.numericId === cleanId ? { ...m, status: 'accepted' as const } : m)),
      };
    }
    return f;
  });

  saveReceivedShareFolders(updated);

  try {
    const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}/members`);
    const snap = await get(inboxRef);
    if (snap.exists()) {
      const members = snap.val() as ShareMember[];
      if (Array.isArray(members)) {
        const nextMembers = members.map((m) => (m.numericId === cleanId ? { ...m, status: 'accepted' } : m));
        await set(inboxRef, nextMembers);
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to update accepted status in cloud:', err);
  }
}

/**
 * Reject / Decline a share invitation
 */
export async function rejectShareInvitation(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const received = loadReceivedShareFolders().filter((f) => f.id !== folderId);
  saveReceivedShareFolders(received);

  const cleanId = cleanNumericId(my16DigitId);
  try {
    const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`);
    await remove(inboxRef);
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove rejected share from cloud:', err);
  }
}

/**
 * Leave / Remove a shared folder from "Shared With Me"
 */
export async function leaveShareFolder(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  await rejectShareInvitation(folderId, my16DigitId);
}

/**
 * Send Share Page to a recipient's 16-digit ID
 */
export async function sendShareFolderToRecipient(
  folder: ShareFolder,
  recipient16DigitId: string
): Promise<{ success: boolean; error?: string }> {
  return addMemberToShareFolder(folder.id, recipient16DigitId);
}

/**
 * Fetch a share folder from Firebase cloud by ID
 */
export async function fetchShareFolderFromCloud(folderId: string): Promise<ShareFolder | null> {
  try {
    const cloudRef = ref(rtdb, `sharedBundles/${folderId}`);
    const snap = await get(cloudRef);
    if (snap.exists()) {
      return snap.val() as ShareFolder;
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch share folder from cloud:', err);
  }
  return null;
}

/**
 * Generate clean public web share URL for non-app users
 */
export function generateShareUrl(folder: ShareFolder): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?share=${encodeURIComponent(folder.id)}`;
}

/**
 * Real-time listener for incoming share folders into user's 16-digit inbox
 */
export function listenToMyNumericIdInbox(
  my16DigitId: string,
  onNewFolderReceived: (folder: ShareFolder) => void
): () => void {
  const cleanId = cleanNumericId(my16DigitId);
  if (cleanId.length !== 16) return () => {};

  const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}`);
  const seenIds = new Set(loadReceivedShareFolders().map((f) => f.id));

  const callback = (snapshot: any) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    if (!data) return;

    Object.keys(data).forEach((key) => {
      const item = data[key] as ShareFolder;
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
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
