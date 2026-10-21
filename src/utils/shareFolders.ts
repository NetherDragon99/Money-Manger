import { rtdb } from './firebase';
import { ref, set, get, remove, onValue, off } from 'firebase/database';
import { cleanNumericId, format16DigitId } from './userId';
import { Account, Category, Transaction } from '../types';
import { encodeShareSnapshot } from './sharing';

/**
 * 10-second timeout guard on Firebase RTDB calls
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  errorMsg?: string
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg || `Operation timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export interface ShareMember {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted';
  addedAt: number;
}

export interface UserProfileCard {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  updatedAt: number;
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
  ownerAvatar?: string;
  ownerPhotoURL?: string;
  permission: 'view_only' | 'allow_import_edit';
  members: ShareMember[];
  itemType: 'single_account' | 'single_category' | 'single_tx' | 'mixed';
  itemCount: number;
  payload: ShareFolderPayload;
  recipientNumericId?: string;
}

const STORAGE_MY_FOLDERS_KEY = 'pwa_finance_share_folders_v3';
const STORAGE_RECEIVED_FOLDERS_KEY = 'pwa_finance_received_share_folders_v3';
const STORAGE_KNOWN_CONTACTS_KEY = 'pwa_finance_known_contacts_v1';

/**
 * Strict 16-digit ID sanitization (strips all non-digit characters)
 */
export function normalize16DigitId(rawId: string | null | undefined): string {
  if (!rawId) return '';
  return String(rawId).replace(/\D/g, '');
}

/**
 * Load locally cached known contacts (16-digit ID -> UserProfileCard)
 */
export function loadKnownContacts(): Record<string, UserProfileCard> {
  try {
    const raw = localStorage.getItem(STORAGE_KNOWN_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save / Cache a known contact locally
 */
export function saveKnownContact(contact: Partial<UserProfileCard> & { numericId: string }): void {
  try {
    const cleanId = normalize16DigitId(contact.numericId);
    if (cleanId.length !== 16) return;
    const contacts = loadKnownContacts();
    contacts[cleanId] = {
      numericId: cleanId,
      name: contact.name || contacts[cleanId]?.name || `User ${cleanId.slice(0, 4)}`,
      avatar: contact.avatar || contacts[cleanId]?.avatar || '👤',
      photoURL: contact.photoURL !== undefined ? contact.photoURL : (contacts[cleanId]?.photoURL || ''),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KNOWN_CONTACTS_KEY, JSON.stringify(contacts));
  } catch (e) {
    console.warn('[ShareFolders] Failed to save contact:', e);
  }
}

/**
 * Retrieve a cached contact by 16-digit ID
 */
export function getKnownContact(numericId: string): UserProfileCard | null {
  const cleanId = normalize16DigitId(numericId);
  if (!cleanId) return null;
  const contacts = loadKnownContacts();
  return contacts[cleanId] || null;
}

/**
 * Generate a deterministic vibrant gradient background for user avatars
 */
export function getAvatarColorGradient(idOrName: string): string {
  const gradients = [
    'from-blue-600 to-indigo-700',
    'from-emerald-600 to-teal-700',
    'from-purple-600 to-pink-700',
    'from-amber-600 to-orange-700',
    'from-rose-600 to-red-700',
    'from-cyan-600 to-blue-700',
    'from-violet-600 to-purple-800',
  ];
  let hash = 0;
  for (let i = 0; i < (idOrName || '').length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

/**
 * Compute 1-2 letter uppercase initials for display when photo is absent
 */
export function getMemberInitials(name: string, numericId?: string): string {
  if (!name) {
    return numericId ? numericId.slice(-2) : '👤';
  }
  const clean = name.trim();
  if (clean.toLowerCase().startsWith('user ') && numericId) {
    return numericId.slice(-2);
  }
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Automatically publish user's public lookup card to Firebase RTDB at shared_accounts/profile_${cleanMy16DigitId}
 */
export async function publishUserProfileCard(profile: {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
}): Promise<void> {
  const cleanId = normalize16DigitId(profile.numericId);
  if (cleanId.length !== 16) return;

  saveKnownContact({
    numericId: cleanId,
    name: profile.name,
    avatar: profile.avatar,
    photoURL: profile.photoURL,
  });

  try {
    const card: UserProfileCard = {
      numericId: cleanId,
      name: profile.name || 'User',
      avatar: profile.avatar || '👤',
      photoURL: profile.photoURL || '',
      updatedAt: Date.now(),
    };
    await set(ref(rtdb, `shared_accounts/profile_${cleanId}`), card);
  } catch (err) {
    console.warn('[ShareFolders] Failed to publish user profile card to RTDB:', err);
  }
}

/**
 * Fetch a user profile card from shared_accounts/profile_${cleanId}
 * with fallback to numericIds/${cleanId}
 */
export async function fetchUserProfileCard(numericId: string): Promise<UserProfileCard | null> {
  const cleanId = normalize16DigitId(numericId);
  if (cleanId.length !== 16) return null;
  try {
    const snap = await get(ref(rtdb, `shared_accounts/profile_${cleanId}`));
    if (snap.exists()) {
      const card = snap.val() as UserProfileCard;
      saveKnownContact(card);
      return card;
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch profile card:', err);
  }

  // Fallback 1: check numericIds/${cleanId} in RTDB
  try {
    const numSnap = await get(ref(rtdb, `numericIds/${cleanId}`));
    if (numSnap.exists()) {
      const data = numSnap.val();
      let photoURL = '';
      let avatar = '👤';
      if (data.uid) {
        try {
          const userSnap = await get(ref(rtdb, `users/${data.uid}`));
          if (userSnap.exists()) {
            const u = userSnap.val();
            if (u.customAvatarUrl || u.photoURL) photoURL = u.customAvatarUrl || u.photoURL;
            if (u.avatarEmoji) avatar = u.avatarEmoji;
          }
        } catch {}
      }
      const card: UserProfileCard = {
        numericId: cleanId,
        name: data.displayName || data.email?.split('@')[0] || `User ${cleanId.slice(0, 4)}`,
        avatar,
        photoURL,
        updatedAt: data.updatedAt || Date.now(),
      };
      saveKnownContact(card);
      return card;
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to fallback search numericIds:', err);
  }

  return getKnownContact(cleanId);
}

/**
 * Real-time listener on shared_accounts/profile_${cleanId}
 */
export function subscribeToUserProfileCard(
  numericId: string,
  callback: (profile: UserProfileCard | null) => void
): () => void {
  const cleanId = normalize16DigitId(numericId);
  if (cleanId.length !== 16) return () => {};

  const profileRef = ref(rtdb, `shared_accounts/profile_${cleanId}`);
  const listener = (snap: any) => {
    if (snap.exists()) {
      callback(snap.val() as UserProfileCard);
    } else {
      callback(null);
    }
  };
  onValue(profileRef, listener);
  return () => {
    off(profileRef, 'value', listener);
  };
}

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
 * Extract share ID from raw input, handle full URL or query params or plain share ID
 */
export function extractShareIdFromUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('?')) {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.com/${trimmed}`);
      const share = parsed.searchParams.get('share') || parsed.searchParams.get('sharedAccountId');
      if (share) return share.trim();
    }
  } catch {}
  return trimmed;
}

/**
 * Register and save a received share folder (from an invitation link or cloud lookup)
 * into the local "Shared with Me" list, and join as an active member in RTDB.
 */
export async function registerReceivedShareFolder(
  folder: ShareFolder,
  myNumericId?: string,
  myName?: string,
  myAvatar?: string,
  myPhotoURL?: string
): Promise<ShareFolder> {
  const cleanId = myNumericId ? normalize16DigitId(myNumericId) : '';
  const isOwner = cleanId && cleanId.length === 16 && normalize16DigitId(folder.ownerNumericId) === cleanId;

  let updatedMembers = Array.isArray(folder.members) ? [...folder.members] : [];

  // If user is not the owner and has a 16-digit ID, ensure they are registered as an accepted member
  if (!isOwner && cleanId.length === 16) {
    const existingMemberIdx = updatedMembers.findIndex((m) => normalize16DigitId(m.numericId) === cleanId);
    if (existingMemberIdx === -1) {
      updatedMembers.push({
        numericId: cleanId,
        name: myName || 'User',
        avatar: myAvatar || '👤',
        photoURL: myPhotoURL || '',
        role: 'viewer',
        status: 'accepted',
        addedAt: Date.now(),
      });
    } else {
      updatedMembers[existingMemberIdx] = {
        ...updatedMembers[existingMemberIdx],
        status: 'accepted',
      };
    }
  }

  const finalFolder: ShareFolder = {
    ...folder,
    members: updatedMembers.map((m) => ({ ...m, status: 'accepted' as const })),
  };

  // 1. Save to local received share folders
  const currentReceived = loadReceivedShareFolders();
  const idx = currentReceived.findIndex((f) => f.id === finalFolder.id);
  let nextReceived: ShareFolder[];
  if (idx !== -1) {
    nextReceived = [...currentReceived];
    nextReceived[idx] = finalFolder;
  } else {
    nextReceived = [finalFolder, ...currentReceived];
  }
  saveReceivedShareFolders(nextReceived);

  // 2. Dispatch event to update any open modal or views immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: nextReceived }));
  }

  // 3. Sync member addition to Firebase RTDB cloud if recipient has 16-digit ID and is not owner
  if (!isOwner && cleanId.length === 16) {
    try {
      const cleanFolder = JSON.parse(JSON.stringify(finalFolder));
      // Put in user's inbox
      await set(ref(rtdb, `shared_accounts/inbox_${cleanId}/${finalFolder.id}`), cleanFolder);
      await set(ref(rtdb, `inboxByNumericId/${cleanId}/${finalFolder.id}`), cleanFolder);
      // Update cloud share folder members
      await set(ref(rtdb, `shared_accounts/share_${finalFolder.id}/members`), updatedMembers);
      await set(ref(rtdb, `sharedBundles/${finalFolder.id}/members`), updatedMembers);
    } catch (err) {
      console.warn('[ShareFolders] Failed to sync member join to cloud RTDB:', err);
    }
  }

  return finalFolder;
}

/**
 * Auto-deduce Folder Name and Icon from selected item(s)
 */
export function deduceFolderMetadata(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  isArabic: boolean
): { name: string; icon: string; itemType: ShareFolder['itemType'] } {
  if (accounts.length === 1 && categories.length === 0 && transactions.length === 0) {
    return {
      name: accounts[0].name,
      icon: accounts[0].icon || '🏦',
      itemType: 'single_account',
    };
  }

  if (categories.length === 1 && accounts.length === 0 && transactions.length === 0) {
    return {
      name: categories[0].name,
      icon: categories[0].icon || '🏷️',
      itemType: 'single_category',
    };
  }

  if (transactions.length === 1 && accounts.length === 0 && categories.length === 0) {
    const tx = transactions[0];
    return {
      name: tx.description?.trim() || tx.categoryName || (isArabic ? 'معاملة مالية' : 'Transaction'),
      icon: tx.categoryIcon || '💸',
      itemType: 'single_tx',
    };
  }

  const existingCount = loadMyShareFolders().length;
  return {
    name: isArabic ? `شير مالي #${existingCount + 1}` : `Shared Space #${existingCount + 1}`,
    icon: '📁',
    itemType: 'mixed',
  };
}

/**
 * Sync Share Page to Firebase RTDB at shared_accounts/${folder.id} and delivery to members
 */
export async function syncFolderToCloud(folder: ShareFolder): Promise<void> {
  try {
    // Sanitize any undefined properties (Firebase RTDB throws if any field is undefined)
    const cleanFolder: ShareFolder = JSON.parse(JSON.stringify(folder));

    await withTimeout(
      (async () => {
        // 1. Direct path
        await set(ref(rtdb, `shared_accounts/${cleanFolder.id}`), cleanFolder);
        // 2. Prefixed path
        await set(ref(rtdb, `shared_accounts/share_${cleanFolder.id}`), cleanFolder);
        // 3. Legacy fallback bundle paths
        await set(ref(rtdb, `sharedBundles/${cleanFolder.id}`), cleanFolder);
        await set(ref(rtdb, `sharedBundles/share_${cleanFolder.id}`), cleanFolder);

        // 4. Deliver to member inboxes
        for (const member of cleanFolder.members || []) {
          const cleanMemberId = normalize16DigitId(member.numericId);
          if (cleanMemberId.length === 16) {
            await set(ref(rtdb, `shared_accounts/inbox_${cleanMemberId}/${cleanFolder.id}`), cleanFolder);
            await set(ref(rtdb, `inboxByNumericId/${cleanMemberId}/${cleanFolder.id}`), cleanFolder);
          }
        }
      })(),
      10000,
      'Failed to sync share folder to cloud within 10s'
    );
  } catch (err) {
    console.warn('[ShareFolders] Failed to sync folder to cloud:', err);
  }
}

/**
 * Automatically synchronize created Share Pages with live app data (accounts, categories, transactions)
 * and broadcast the updates to Firebase RTDB in real time so external shared pages are 100% live!
 */
export function syncShareFoldersWithMainData(
  allAccounts: Account[],
  allCategories: Category[],
  allTransactions: Transaction[]
): void {
  const myFolders = loadMyShareFolders();
  if (!myFolders || myFolders.length === 0) return;

  let anyChanged = false;
  const updatedFolders = myFolders.map((folder) => {
    if (!folder.payload) return folder;

    const folderAccountIds = new Set(folder.payload.accounts.map((a) => a.id));
    const folderCategoryIds = new Set(folder.payload.categories.map((c) => c.id));
    const folderTxIds = new Set(folder.payload.transactions.map((t) => t.id));

    // 1. Update accounts inside folder with latest balance, name, and properties
    let accountsUpdated = false;
    const nextAccounts = folder.payload.accounts.map((acc) => {
      const latest = allAccounts.find((a) => a.id === acc.id);
      if (
        latest &&
        (latest.balance !== acc.balance ||
          latest.name !== acc.name ||
          latest.icon !== acc.icon ||
          latest.isPrivate !== acc.isPrivate)
      ) {
        accountsUpdated = true;
        return { ...latest };
      }
      return acc;
    });

    // 2. Update categories inside folder
    let categoriesUpdated = false;
    const nextCategories = folder.payload.categories.map((cat) => {
      const latest = allCategories.find((c) => c.id === cat.id);
      if (
        latest &&
        (latest.name !== cat.name ||
          latest.icon !== cat.icon ||
          latest.budgetLimit !== cat.budgetLimit)
      ) {
        categoriesUpdated = true;
        return { ...latest };
      }
      return cat;
    });

    // 3. Find latest transactions for this folder:
    // Any transaction that belongs to a shared account, or shared category,
    // or was explicitly part of the folder
    const nextTxs = allTransactions.filter((t) => {
      if (t.accountId && folderAccountIds.has(t.accountId)) return true;
      if (t.categoryId && folderCategoryIds.has(t.categoryId)) return true;
      if (folderTxIds.has(t.id)) return true;
      return false;
    });

    const txsChanged =
      nextTxs.length !== folder.payload.transactions.length ||
      JSON.stringify(nextTxs.map((t) => [t.id, t.amount, t.type, t.description, t.date])) !==
        JSON.stringify(
          folder.payload.transactions.map((t) => [t.id, t.amount, t.type, t.description, t.date])
        );

    if (accountsUpdated || categoriesUpdated || txsChanged) {
      anyChanged = true;
      const updatedFolder: ShareFolder = {
        ...folder,
        updatedAt: Date.now(),
        itemCount: nextAccounts.length + nextCategories.length + nextTxs.length,
        payload: {
          accounts: nextAccounts,
          categories: nextCategories,
          transactions: nextTxs,
        },
      };

      // Push real-time update to cloud!
      syncFolderToCloud(updatedFolder);
      return updatedFolder;
    }

    return folder;
  });

  if (anyChanged) {
    saveMyShareFolders(updatedFolders);
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
  ownerAvatar?: string;
  ownerPhotoURL?: string;
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
    ownerNumericId: normalize16DigitId(params.ownerNumericId),
    ownerName: params.ownerName || 'User',
    ownerAvatar: params.ownerAvatar || '👤',
    ownerPhotoURL: params.ownerPhotoURL || '',
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
 * Add or update transaction inside a Share Folder
 */
export function addTransactionToShareFolder(
  folderId: string,
  tx: Transaction
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const myIdx = existing.findIndex((f) => f.id === folderId);
  const received = loadReceivedShareFolders();
  const recvIdx = received.findIndex((f) => f.id === folderId);

  let targetFolder: ShareFolder | null = null;
  let isOwner = false;

  if (myIdx !== -1) {
    targetFolder = existing[myIdx];
    isOwner = true;
  } else if (recvIdx !== -1) {
    targetFolder = received[recvIdx];
  }

  if (!targetFolder) return null;

  const txs = [...targetFolder.payload.transactions];
  const existingTxIdx = txs.findIndex((t) => t.id === tx.id);
  if (existingTxIdx !== -1) {
    txs[existingTxIdx] = tx;
  } else {
    txs.unshift(tx);
  }

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: targetFolder.payload.accounts.length + targetFolder.payload.categories.length + txs.length,
    payload: {
      ...targetFolder.payload,
      transactions: txs,
    },
  };

  if (isOwner) {
    existing[myIdx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    received[recvIdx] = updatedFolder;
    saveReceivedShareFolders(received);
  }

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
  const myIdx = existing.findIndex((f) => f.id === folderId);
  const received = loadReceivedShareFolders();
  const recvIdx = received.findIndex((f) => f.id === folderId);

  let folder: ShareFolder | null = null;
  let isOwner = false;

  if (myIdx !== -1) {
    folder = existing[myIdx];
    isOwner = true;
  } else if (recvIdx !== -1) {
    folder = received[recvIdx];
  }

  if (!folder) return null;

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

  if (isOwner) {
    existing[myIdx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    received[recvIdx] = updatedFolder;
    saveReceivedShareFolders(received);
  }

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
    await remove(ref(rtdb, `shared_accounts/share_${folderId}`));
    await remove(ref(rtdb, `sharedBundles/${folderId}`));

    // Remove from member inboxes
    if (folder) {
      for (const member of folder.members) {
        const cleanId = normalize16DigitId(member.numericId);
        if (cleanId.length === 16) {
          await remove(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}`));
          await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`));
        }
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
  role: 'viewer' | 'editor' = 'viewer',
  memberAvatar?: string,
  memberPhotoURL?: string
): Promise<{ success: boolean; folder?: ShareFolder; error?: string; cloudSynced?: boolean }> {
  const cleanId = normalize16DigitId(member16DigitId);
  if (cleanId.length !== 16) {
    return { success: false, error: 'Invalid ID. Must be 16 digits.' };
  }

  // 1. Fetch target user's public profile card or check local known contacts
  const profileCard = await fetchUserProfileCard(cleanId);
  const localContact = getKnownContact(cleanId);

  const trimmedName = memberName?.trim();
  const resolvedName =
    trimmedName ||
    (profileCard?.name && profileCard.name !== 'User' ? profileCard.name : '') ||
    (localContact?.name && localContact.name !== 'User' ? localContact.name : '') ||
    `User ${format16DigitId(cleanId).slice(0, 4)}`;

  const resolvedAvatar = memberAvatar || profileCard?.avatar || localContact?.avatar || '👤';
  const resolvedPhotoURL = memberPhotoURL || profileCard?.photoURL || localContact?.photoURL || '';

  // Cache resolved contact locally
  saveKnownContact({
    numericId: cleanId,
    name: resolvedName,
    avatar: resolvedAvatar,
    photoURL: resolvedPhotoURL,
    updatedAt: Date.now(),
  });

  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) {
    return { success: false, error: 'Share page not found' };
  }

  const folder = existing[idx];
  if (folder.members.some((m) => normalize16DigitId(m.numericId) === cleanId)) {
    return { success: false, error: 'Member is already added to this share' };
  }

  const newMember: ShareMember = {
    numericId: cleanId,
    name: resolvedName,
    avatar: resolvedAvatar,
    photoURL: resolvedPhotoURL,
    role,
    status: 'accepted',
    addedAt: Date.now(),
  };

  const updatedFolder: ShareFolder = {
    ...folder,
    members: [...folder.members, newMember],
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);

  let cloudSynced = true;
  try {
    // Deliver to recipient's inbox in Firebase RTDB (sanitize any undefined values)
    const cleanFolder: ShareFolder = JSON.parse(JSON.stringify(updatedFolder));
    await withTimeout(
      (async () => {
        await set(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folder.id}`), cleanFolder);
        await set(ref(rtdb, `inboxByNumericId/${cleanId}/${folder.id}`), cleanFolder);
        await set(ref(rtdb, `shared_accounts/share_${folder.id}`), cleanFolder);
        await set(ref(rtdb, `sharedBundles/${folder.id}`), cleanFolder);
      })(),
      10000
    );
  } catch (err: any) {
    console.warn('[ShareFolders] Firebase delivery deferred or rules restricted:', err);
    cloudSynced = false;
  }

  return { success: true, folder: updatedFolder, cloudSynced };
}

/**
 * Update member details (custom nickname/name, role, or avatar)
 */
export async function updateMemberDetailsInShareFolder(
  folderId: string,
  member16DigitId: string,
  updates: { name?: string; role?: 'viewer' | 'editor'; avatar?: string; photoURL?: string }
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanId = normalize16DigitId(member16DigitId);
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  let targetFolder: ShareFolder | null = null;
  let isMyFolder = true;

  if (idx !== -1) {
    targetFolder = existing[idx];
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      targetFolder = received[rIdx];
      isMyFolder = false;
    }
  }

  if (!targetFolder) return { success: false };

  const updatedMembers = targetFolder.members.map((m) => {
    if (normalize16DigitId(m.numericId) === cleanId) {
      return {
        ...m,
        name: updates.name?.trim() || m.name,
        role: updates.role || m.role,
        avatar: updates.avatar || m.avatar,
        photoURL: updates.photoURL !== undefined ? updates.photoURL : m.photoURL,
      };
    }
    return m;
  });

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    members: updatedMembers,
    updatedAt: Date.now(),
  };

  if (isMyFolder && idx !== -1) {
    existing[idx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      received[rIdx] = updatedFolder;
      saveReceivedShareFolders(received);
    }
  }

  if (updates.name) {
    saveKnownContact({
      numericId: cleanId,
      name: updates.name.trim(),
    });
  }

  await syncFolderToCloud(updatedFolder);
  return { success: true, folder: updatedFolder };
}

export async function updateMemberRoleInShareFolder(
  folderId: string,
  member16DigitId: string,
  role: 'viewer' | 'editor'
): Promise<{ success: boolean; folder?: ShareFolder }> {
  return updateMemberDetailsInShareFolder(folderId, member16DigitId, { role });
}

/**
 * Remove / Revoke a member from a Share Page (strictly normalized ID matching)
 */
export async function removeMemberFromShareFolder(
  folderId: string,
  member16DigitId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanId = normalize16DigitId(member16DigitId);
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  let targetFolder: ShareFolder | null = null;
  let isMyFolder = true;

  if (idx !== -1) {
    targetFolder = existing[idx];
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      targetFolder = received[rIdx];
      isMyFolder = false;
    }
  }

  if (!targetFolder) return { success: false };

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    members: targetFolder.members.filter((m) => normalize16DigitId(m.numericId) !== cleanId),
    updatedAt: Date.now(),
  };

  if (isMyFolder && idx !== -1) {
    existing[idx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      received[rIdx] = updatedFolder;
      saveReceivedShareFolders(received);
    }
  }

  try {
    const cleanFolder: ShareFolder = JSON.parse(JSON.stringify(updatedFolder));
    // Delete from recipient's inbox
    await remove(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}`));
    await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`));

    // Update cloud bundle
    await set(ref(rtdb, `shared_accounts/share_${folderId}`), cleanFolder);
    await set(ref(rtdb, `sharedBundles/${folderId}`), cleanFolder);
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove member from cloud inbox:', err);
  }

  return { success: true, folder: updatedFolder };
}

/**
 * Remove all members from a Share Page at once
 */
export async function removeAllMembersFromShareFolder(
  folderId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return { success: false };

  const folder = existing[idx];
  const oldMembers = [...folder.members];
  const updatedFolder: ShareFolder = {
    ...folder,
    members: [],
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);

  try {
    const cleanFolder: ShareFolder = JSON.parse(JSON.stringify(updatedFolder));
    for (const m of oldMembers) {
      const cleanId = normalize16DigitId(m.numericId);
      if (cleanId.length === 16) {
        await remove(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}`));
        await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`));
      }
    }
    await set(ref(rtdb, `shared_accounts/share_${folderId}`), cleanFolder);
    await set(ref(rtdb, `sharedBundles/${folderId}`), cleanFolder);
  } catch (err) {
    console.warn('[ShareFolders] Failed to clear members from cloud:', err);
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
  const cleanId = normalize16DigitId(my16DigitId);

  const updated = received.map((f) => {
    if (f.id === folderId) {
      return {
        ...f,
        members: f.members.map((m) =>
          normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'accepted' as const } : m
        ),
      };
    }
    return f;
  });

  saveReceivedShareFolders(updated);

  try {
    const inboxRef = ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}/members`);
    const snap = await get(inboxRef);
    if (snap.exists()) {
      const members = snap.val() as ShareMember[];
      if (Array.isArray(members)) {
        const nextMembers = members.map((m) =>
          normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'accepted' } : m
        );
        await set(inboxRef, nextMembers);
      }
    }

    // Also update in cloud share
    const cloudMemberRef = ref(rtdb, `shared_accounts/share_${folderId}/members`);
    const cloudSnap = await get(cloudMemberRef);
    if (cloudSnap.exists()) {
      const cMembers = cloudSnap.val() as ShareMember[];
      if (Array.isArray(cMembers)) {
        const nextCMembers = cMembers.map((m) =>
          normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'accepted' } : m
        );
        await set(cloudMemberRef, nextCMembers);
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

  const cleanId = normalize16DigitId(my16DigitId);
  try {
    await remove(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}`));
    await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`));
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove rejected share from cloud:', err);
  }
}

/**
 * Leave a shared folder from "Shared With Me"
 * Cleans up local inbox, RTDB inbox, and removes user from cloud share members
 */
export async function leaveShareFolder(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const cleanId = normalize16DigitId(my16DigitId);

  // 1. Remove from local received folders
  const received = loadReceivedShareFolders().filter((f) => f.id !== folderId);
  saveReceivedShareFolders(received);

  // 2. Remove from recipient's inbox in Firebase RTDB
  try {
    await remove(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}`));
    await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`));
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove share from inbox on leave:', err);
  }

  // 3. Remove user from cloud share folder's members list
  try {
    const cloudFolderRef = ref(rtdb, `shared_accounts/share_${folderId}`);
    const snap = await get(cloudFolderRef);
    if (snap.exists()) {
      const cloudFolder = snap.val() as ShareFolder;
      if (cloudFolder && Array.isArray(cloudFolder.members)) {
        const nextMembers = cloudFolder.members.filter(
          (m) => normalize16DigitId(m.numericId) !== cleanId
        );
        const updatedCloudFolder: ShareFolder = {
          ...cloudFolder,
          members: nextMembers,
          updatedAt: Date.now(),
        };
        await set(cloudFolderRef, updatedCloudFolder);
        await set(ref(rtdb, `sharedBundles/${folderId}`), updatedCloudFolder);
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to update cloud folder members on leave:', err);
  }
}

/**
 * Send Share Page to a recipient's 16-digit ID
 */
export async function sendShareFolderToRecipient(
  folder: ShareFolder,
  recipient16DigitId: string,
  recipientName?: string,
  recipientAvatar?: string,
  recipientPhotoURL?: string
): Promise<{ success: boolean; error?: string }> {
  return addMemberToShareFolder(
    folder.id,
    recipient16DigitId,
    recipientName,
    'viewer',
    recipientAvatar,
    recipientPhotoURL
  );
}

/**
 * Fetch a share folder from Firebase cloud by ID
 */
export async function fetchShareFolderFromCloud(folderId: string): Promise<ShareFolder | null> {
  const cleanId = (folderId || '').trim();
  if (!cleanId) return null;

  try {
    return await withTimeout(
      (async () => {
        // Check candidate paths in order:
        const pathsToTry = [
          `shared_accounts/${cleanId}`,
          `shared_accounts/share_${cleanId}`,
          `sharedBundles/${cleanId}`,
          `sharedBundles/share_${cleanId}`,
        ];

        for (const p of pathsToTry) {
          try {
            const snap = await get(ref(rtdb, p));
            if (snap.exists() && snap.val()) {
              return snap.val() as ShareFolder;
            }
          } catch {}
        }
        return null;
      })(),
      10000,
      'Share fetch timed out'
    );
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch share folder from cloud:', err);
  }
  return null;
}

/**
 * Real-time listener on a specific Share Folder (shared_accounts/${folderId})
 */
export function subscribeToShareFolder(
  folderId: string,
  callback: (folder: ShareFolder | null) => void
): () => void {
  const cleanId = (folderId || '').trim();
  if (!cleanId) return () => {};

  const ref1 = ref(rtdb, `shared_accounts/${cleanId}`);
  const ref2 = ref(rtdb, `shared_accounts/share_${cleanId}`);

  let hasFound = false;
  const listener = (snap: any) => {
    if (snap.exists() && snap.val()) {
      hasFound = true;
      callback(snap.val() as ShareFolder);
    }
  };

  onValue(ref1, listener);
  onValue(ref2, listener);

  return () => {
    off(ref1, 'value', listener);
    off(ref2, 'value', listener);
  };
}

/**
 * Real-time listener for incoming share folders in user's 16-digit inbox
 * Listens to both modern and legacy inbox paths simultaneously for 100% instant delivery without refresh!
 */
export function subscribeToMyInbox(
  my16DigitId: string,
  callback: (folders: ShareFolder[]) => void
): () => void {
  const cleanId = normalize16DigitId(my16DigitId);
  if (cleanId.length !== 16) return () => {};

  const inboxRef = ref(rtdb, `shared_accounts/inbox_${cleanId}`);
  const fallbackRef = ref(rtdb, `inboxByNumericId/${cleanId}`);

  let primaryData: Record<string, ShareFolder> = {};
  let fallbackData: Record<string, ShareFolder> = {};

  const emitCombined = () => {
    const combined = { ...fallbackData, ...primaryData };
    const folders: ShareFolder[] = Object.values(combined).map((f) => ({
      ...f,
      members: (f.members || []).map((m) => ({ ...m, status: 'accepted' as const })),
    }));
    // Sort newest first
    folders.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    callback(folders);
  };

  const primaryListener = (snapshot: any) => {
    primaryData = snapshot.exists() && snapshot.val() ? snapshot.val() : {};
    emitCombined();
  };

  const fallbackListener = (snapshot: any) => {
    fallbackData = snapshot.exists() && snapshot.val() ? snapshot.val() : {};
    emitCombined();
  };

  onValue(inboxRef, primaryListener, (err) => {
    console.warn('[ShareFolders] Inbox subscription error:', err);
  });
  onValue(fallbackRef, fallbackListener, (err) => {
    console.warn('[ShareFolders] Fallback inbox error:', err);
  });

  return () => {
    off(inboxRef, 'value', primaryListener);
    off(fallbackRef, 'value', fallbackListener);
  };
}

/**
 * Legacy compatibility alias
 */
export const listenToMyNumericIdInbox = subscribeToMyInbox;

/**
 * Generate clean, live, dynamic public web share URL with fallback data snapshot
 * Includes encoded data snapshot for 0ms instant offline rendering & reliability,
 * and share ID for live real-time cloud sync.
 */
export function generateShareUrl(folder: ShareFolder): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const snapshotB64 = encodeShareSnapshot(folder);
  if (snapshotB64) {
    return `${base}?share=${encodeURIComponent(folder.id)}&data=${snapshotB64}`;
  }
  return `${base}?share=${encodeURIComponent(folder.id)}`;
}
