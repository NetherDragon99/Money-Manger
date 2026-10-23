import { rtdb, auth, getCachedAuthUser } from './firebase';
import { ref, set, get, remove, onValue, off, update } from 'firebase/database';
import { cleanNumericId, format16DigitId, getOrCreateNumericId } from './userId';
import { Account, Category, Transaction } from '../types';
import { getTransferHistoricalBalances } from './balanceEngine';
import { encodeShareSnapshot } from './sharing';
import {
  queueOfflineShareUpdate,
  isSpacePendingOfflineSync,
  removeSpaceFromOfflineQueue,
  queueOfflineShareDelete,
} from './persistQueue';

let activeShareModalOpenCount = 0;

/**
 * Tracks whether a Share creation or settings modal is currently open in the UI.
 * Remote onValue listeners will never overwrite local cache/form state while a modal is open.
 */
export function setShareModalOpenState(isOpen: boolean): void {
  if (isOpen) {
    activeShareModalOpenCount = Math.max(1, activeShareModalOpenCount + 1);
  } else {
    activeShareModalOpenCount = Math.max(0, activeShareModalOpenCount - 1);
  }
  if (typeof window !== 'undefined') {
    (window as any).__mmShareModalOpen = activeShareModalOpenCount > 0;
  }
}

export function isShareModalCurrentlyOpen(): boolean {
  if (activeShareModalOpenCount > 0) return true;
  if (typeof window !== 'undefined' && Boolean((window as any).__mmShareModalOpen)) return true;
  return false;
}

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
  status: 'pending' | 'accepted' | 'active';
  addedAt: number;
  notified?: boolean;
  notifiedAt?: number;
}

export interface UserProfileCard {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  uid?: string;
  updatedAt: number;
  driveAccessGranted?: boolean;
  drivePromptResolved?: boolean;
}

export interface ShareFolderPayload {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export interface ShareFolder {
  id: string;
  name: string;
  accountName?: string;
  icon: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  ownerNumericId: string;
  owner16DigitId?: string;
  ownerUid?: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerPhotoURL?: string;
  permission: 'view_only' | 'allow_import_edit';
  member16Ids?: string[];
  members: ShareMember[];
  accounts?: Account[];
  categories?: Category[];
  transactions?: Transaction[];
  itemType: 'single_account' | 'single_category' | 'single_tx' | 'mixed';
  itemCount: number;
  payload: ShareFolderPayload;
  recipientNumericId?: string;
  isCreatedByMe?: boolean;
  isReceivedShare?: boolean;
  deleted?: boolean;
  v3Schema?: boolean;
  notifiedMembers?: Record<string, boolean>;
}

export const SPACES_V3_CACHE_KEY = 'mm_spaces_v3_cache';
export const SHARE_V3_CLEAN_RESET_KEY = 'mm_share_v3_clean_reset';
export const SHARE_V3_CLOUD_PURGE_KEY = 'mm_share_v3_cloud_purge_done';
export const NOTIFIED_SHARES_V3_KEY = 'mm_notified_shares_v3';
const STORAGE_KNOWN_CONTACTS_KEY = 'pwa_finance_known_contacts_v1';

export const SEEN_NOTIFICATIONS_STORAGE_KEY = 'mm_seen_share_notifications';
export const PERMANENT_NOTIFIED_SHARE_IDS_KEY = 'mm_notified_share_ids_perm';
export const MY_CREATED_SHARE_IDS_KEY = 'mm_my_created_share_ids';
export const DISMISSED_SHARE_IDS_KEY = 'mm_dismissed_share_ids';

/**
 * Strict 16-digit ID sanitization (strips all non-digit characters)
 */
export function normalize16DigitId(rawId: string | null | undefined): string {
  if (!rawId) return '';
  return String(rawId).replace(/\D/g, '');
}

/**
 * Normalizes a share ID by trimming and stripping any leading 'share_' prefix
 * so that canonical path shared_accounts/share_${id} never duplicates 'share_'.
 */
export function normalizeShareId(id?: string | null): string {
  if (!id) return '';
  return String(id).replace(/^share_/, '').trim();
}

/**
 * Returns the ONE canonical Firebase RTDB path for a space:
 * shared_accounts/share_${normalizeShareId(spaceId)}
 */
export function getCanonicalSharePath(spaceId: string): string {
  const cleanId = normalizeShareId(spaceId);
  return `shared_accounts/share_${cleanId}`;
}

/**
 * Deeply sanitizes any object or payload for Firebase RTDB by eliminating all
 * `undefined` properties, functions, and symbols.
 */
export function deepSanitizeForFirebase<T>(val: T): T {
  if (val === undefined || val === null) return null as any;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch (err) {
    console.warn('[ShareFolders] deepSanitizeForFirebase serialization fallback:', err);
    return val;
  }
}

/**
 * One-Time Startup Migration & Legacy Purge (guarded by localStorage.getItem('mm_share_v3_clean_reset')).
 * 1. Wipes all old corrupted local share keys so the device starts 100% clean.
 * 2. Deletes legacy nodes under Firebase RTDB shared_accounts (slot_*, inbox_*, profile_directory_*,
 *    profile_shares_*, invite_*, dismissed_*, and pre-v3 corrupted share nodes) while preserving user profile cards.
 */
export async function executeOneTimeV3ShareCleanReset(): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  const isLocalResetDone = localStorage.getItem(SHARE_V3_CLEAN_RESET_KEY) === 'true';
  if (!isLocalResetDone) {
    try {
      const legacyLocalKeys = [
        'pwa_finance_share_folders_v3',
        'pwa_finance_received_share_folders_v3',
        'pwa_finance_share_folders_v2',
        'pwa_finance_received_share_folders_v2',
        'pwa_finance_share_folders_v1',
        'pwa_finance_received_share_folders_v1',
        'mm_seen_share_notifications',
        'mm_notified_share_ids_perm',
        'mm_my_created_share_ids',
        'mm_dismissed_share_ids',
        'mm_offline_share_sync_queue',
      ];
      for (const key of legacyLocalKeys) {
        localStorage.removeItem(key);
      }
      localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify([]));
      localStorage.setItem(SHARE_V3_CLEAN_RESET_KEY, 'true');
    } catch (err) {
      console.warn('[ShareFolders] Local V3 clean reset error:', err);
    }
  }

  // Also execute one-time cloud legacy node cleanup when online & authenticated
  const isCloudPurgeDone = localStorage.getItem(SHARE_V3_CLOUD_PURGE_KEY) === 'true';
  if (!isCloudPurgeDone && typeof navigator !== 'undefined' && navigator.onLine) {
    const uid = auth.currentUser?.uid || getCachedAuthUser()?.uid;
    if (!uid) return;

    try {
      const snap = await get(ref(rtdb, 'shared_accounts'));
      if (snap.exists() && snap.val()) {
        const data = snap.val();
        const removePromises: Promise<any>[] = [];

        for (const key of Object.keys(data)) {
          // Keep user profile lookup cards intact
          if (key.startsWith('profile_') && !key.startsWith('profile_directory_') && !key.startsWith('profile_shares_')) {
            continue;
          }
          const nodeVal = data[key];
          const isLegacyNode =
            key.startsWith('slot_') ||
            key.startsWith('inbox_') ||
            key.startsWith('profile_directory_') ||
            key.startsWith('profile_shares_') ||
            key.startsWith('invite_') ||
            key.startsWith('dismissed_') ||
            !key.startsWith('share_') ||
            !nodeVal ||
            nodeVal.v3Schema !== true;

          if (isLegacyNode) {
            removePromises.push(remove(ref(rtdb, `shared_accounts/${key}`)).catch(() => {}));
          }
        }

        // Also clean legacy root collections if accessible
        removePromises.push(remove(ref(rtdb, 'sharedBundles')).catch(() => {}));
        removePromises.push(remove(ref(rtdb, 'inboxByNumericId')).catch(() => {}));

        await Promise.allSettled(removePromises);
      }
      localStorage.setItem(SHARE_V3_CLOUD_PURGE_KEY, 'true');
    } catch (err) {
      console.warn('[ShareFolders] Cloud V3 legacy cleanup note:', err);
    }
  }
}

/**
 * Helper: Resolve current user's UID and clean 16-digit ID
 */
function resolveCurrentIdentity(custom16Id?: string, customUid?: string): { myUid: string; myClean16Id: string } {
  const myUid = customUid || auth.currentUser?.uid || getCachedAuthUser()?.uid || '';
  let myClean16Id = normalize16DigitId(custom16Id);
  if (myClean16Id.length !== 16) {
    try {
      const rawSettings = localStorage.getItem('pwa_finance_settings_v1');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        const prof16 = normalize16DigitId(parsed?.userProfile?.numericId);
        if (prof16.length === 16) myClean16Id = prof16;
      }
    } catch {}
  }
  if (myClean16Id.length !== 16) {
    myClean16Id = normalize16DigitId(getOrCreateNumericId());
  }
  return { myUid, myClean16Id };
}

/**
 * Strict UI & Cache Sorting Rule 1:
 * Returns true if the space belongs in "Shared by Me":
 * (space.ownerUid === currentUser.uid || cleanId(space.owner16DigitId) === myClean16Id)
 */
export function isSpaceOwnedByUser(
  space: Partial<ShareFolder> | null | undefined,
  myClean16Id?: string,
  currentUserUid?: string
): boolean {
  if (!space) return false;
  const { myUid, myClean16Id: resolved16 } = resolveCurrentIdentity(myClean16Id, currentUserUid);
  const spaceOwner16 = normalize16DigitId(space.owner16DigitId || space.ownerNumericId);
  const spaceOwnerUid = String(space.ownerUid || '').trim();

  if (myUid && spaceOwnerUid && spaceOwnerUid === myUid) {
    return true;
  }
  if (resolved16 && resolved16.length === 16 && spaceOwner16 && spaceOwner16 === resolved16) {
    return true;
  }
  return false;
}

/**
 * Strict UI & Cache Sorting Rule 2:
 * Returns true if the space belongs in "Shared with Me":
 * member16Ids includes myClean16Id and ownerUid !== currentUser.uid (and owner16DigitId !== myClean16Id)
 */
export function isSpaceSharedWithUser(
  space: Partial<ShareFolder> | null | undefined,
  myClean16Id?: string,
  currentUserUid?: string
): boolean {
  if (!space) return false;
  const { myUid, myClean16Id: resolved16 } = resolveCurrentIdentity(myClean16Id, currentUserUid);
  if (!resolved16 || resolved16.length !== 16) return false;

  // Must NOT be owned by current user
  if (isSpaceOwnedByUser(space, resolved16, myUid)) {
    return false;
  }

  const member16Ids = extractMember16Ids(space);
  return member16Ids.includes(resolved16);
}

/**
 * Extracts normalized 16-digit member IDs array from a space
 */
export function extractMember16Ids(space: Partial<ShareFolder> | any): string[] {
  const set = new Set<string>();
  if (Array.isArray(space?.member16Ids)) {
    for (const id of space.member16Ids) {
      const clean = normalize16DigitId(id);
      if (clean.length === 16) set.add(clean);
    }
  }
  if (Array.isArray(space?.members)) {
    for (const m of space.members) {
      const clean = normalize16DigitId(m?.numericId);
      if (clean.length === 16) set.add(clean);
    }
  }
  const owner16 = normalize16DigitId(space?.owner16DigitId || space?.ownerNumericId);
  if (owner16.length === 16) {
    set.add(owner16);
  }
  return Array.from(set);
}

/**
 * Ensures transfer transactions preserve and embed their full metadata
 * when serializing transactions into a Share Space or updating live shares.
 */
export function enrichShareTransaction(
  tx: Transaction,
  availableAccounts?: Account[],
  allTransactions?: Transaction[]
): Transaction {
  if (!tx) return tx;
  const enriched: Transaction = { ...tx };

  if (enriched.type === 'transfer') {
    const accList = availableAccounts || [];
    const fromAcc = accList.find((a) => a.id === enriched.accountId);
    const toAcc = enriched.toAccountId ? accList.find((a) => a.id === enriched.toAccountId) : undefined;

    if (!enriched.fromAccountName && fromAcc) {
      enriched.fromAccountName = fromAcc.name;
    }
    if (!enriched.fromAccountIcon && fromAcc) {
      enriched.fromAccountIcon = fromAcc.icon;
    }
    if (!enriched.toAccountName && toAcc) {
      enriched.toAccountName = toAcc.name;
    }
    if (!enriched.toAccountIcon && toAcc) {
      enriched.toAccountIcon = toAcc.icon;
    }

    if (!enriched.note && enriched.description) {
      enriched.note = enriched.description;
    } else if (!enriched.description && enriched.note) {
      enriched.description = enriched.note;
    }

    if (
      enriched.fromBalanceBefore === undefined ||
      enriched.fromBalanceAfter === undefined ||
      enriched.toBalanceBefore === undefined ||
      enriched.toBalanceAfter === undefined
    ) {
      if (allTransactions && allTransactions.length > 0 && accList.length > 0) {
        try {
          const hist = getTransferHistoricalBalances(enriched, accList, allTransactions);
          if (hist) {
            if (enriched.fromBalanceBefore === undefined) enriched.fromBalanceBefore = hist.fromBalanceBefore;
            if (enriched.fromBalanceAfter === undefined) enriched.fromBalanceAfter = hist.fromBalanceAfter;
            if (enriched.toBalanceBefore === undefined) enriched.toBalanceBefore = hist.toBalanceBefore;
            if (enriched.toBalanceAfter === undefined) enriched.toBalanceAfter = hist.toBalanceAfter;
            if (!enriched.fromAccountName) enriched.fromAccountName = hist.fromAccountName;
            if (!enriched.fromAccountIcon) enriched.fromAccountIcon = hist.fromAccountIcon;
            if (!enriched.toAccountName) enriched.toAccountName = hist.toAccountName;
            if (!enriched.toAccountIcon) enriched.toAccountIcon = hist.toAccountIcon;
          }
        } catch {}
      }
    }
  }

  return enriched;
}

/**
 * Load all cached spaces from unified V3 localStorage ('mm_spaces_v3_cache')
 */
export function loadAllSpacesV3(): ShareFolder[] {
  if (typeof localStorage === 'undefined') return [];
  // Ensure one-time migration has run before reading
  if (localStorage.getItem(SHARE_V3_CLEAN_RESET_KEY) !== 'true') {
    executeOneTimeV3ShareCleanReset().catch(() => {});
  }
  try {
    const raw = localStorage.getItem(SPACES_V3_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const dismissed = getDismissedShareIds();
    const result: ShareFolder[] = [];
    for (const item of parsed) {
      if (!item || item.deleted === true) continue;
      const norm = normalizeParsedShareFolder(item, item.id);
      if (norm && !dismissed.has(normalizeShareId(norm.id))) {
        result.push(norm);
      }
    }
    result.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return result;
  } catch {
    return [];
  }
}

/**
 * Save all spaces to unified V3 localStorage ('mm_spaces_v3_cache')
 */
export function saveAllSpacesV3(spaces: ShareFolder[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = new Map<string, ShareFolder>();
    const dismissed = getDismissedShareIds();
    for (const s of spaces) {
      if (!s || !s.id || s.deleted === true) continue;
      const cleanId = normalizeShareId(s.id);
      if (!cleanId || dismissed.has(cleanId)) continue;
      const normalized = normalizeParsedShareFolder(s, cleanId);
      if (normalized) {
        map.set(cleanId, normalized);
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save mm_spaces_v3_cache:', err);
  }
}

/**
 * Immediately upserts a single space into 'mm_spaces_v3_cache'
 */
export function upsertSpaceInV3Cache(space: ShareFolder): ShareFolder {
  const cleanId = normalizeShareId(space.id);
  const all = loadAllSpacesV3();
  const existing = all.find((s) => normalizeShareId(s.id) === cleanId);

  const mergedMembers = Array.isArray(space.members)
    ? space.members.map((m) => {
        const cleanMid = normalize16DigitId(m.numericId);
        const prevM = existing?.members?.find((em) => normalize16DigitId(em.numericId) === cleanMid);
        return {
          ...m,
          ...(m.notified || prevM?.notified ? { notified: true, notifiedAt: m.notifiedAt || prevM?.notifiedAt || Date.now() } : {}),
        };
      })
    : space.members;

  const mergedNotifiedMembers =
    existing?.notifiedMembers || space.notifiedMembers
      ? { ...(existing?.notifiedMembers || {}), ...(space.notifiedMembers || {}) }
      : undefined;

  const normalized =
    normalizeParsedShareFolder(
      {
        ...space,
        id: cleanId,
        members: mergedMembers,
        ...(mergedNotifiedMembers ? { notifiedMembers: mergedNotifiedMembers } : {}),
      },
      cleanId
    ) || space;
  const next = all.filter((s) => normalizeShareId(s.id) !== cleanId);
  next.unshift(normalized);
  saveAllSpacesV3(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: next }));
  }
  return normalized;
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
 * Resolves the owner's actual profile photo URL dynamically across folder metadata,
 * current userProfile, cached contacts, and Firebase Auth.
 */
export function resolveOwnerPhoto(
  folder: { ownerPhotoURL?: string; ownerAvatar?: string; owner16DigitId?: string; ownerNumericId?: string; ownerUid?: string },
  currentProfile?: { photoURL?: string; customAvatarUrl?: string; avatar?: string; avatarEmoji?: string; numericId?: string; uid?: string } | null
): string {
  if (folder?.ownerPhotoURL && folder.ownerPhotoURL.trim()) {
    return folder.ownerPhotoURL.trim();
  }
  if (folder?.ownerAvatar && (folder.ownerAvatar.startsWith('http') || folder.ownerAvatar.startsWith('data:image'))) {
    return folder.ownerAvatar.trim();
  }
  const owner16 = normalize16DigitId(folder?.owner16DigitId || folder?.ownerNumericId);
  const myClean16 = currentProfile?.numericId ? normalize16DigitId(currentProfile.numericId) : '';
  const myUid = currentProfile?.uid || auth.currentUser?.uid || '';
  const isCurrentOwner = (owner16 && myClean16 && owner16 === myClean16) || Boolean(folder?.ownerUid && myUid && folder.ownerUid === myUid);

  if (isCurrentOwner && currentProfile) {
    const profPhoto = currentProfile.customAvatarUrl || currentProfile.photoURL || (currentProfile.avatar && currentProfile.avatar.startsWith('http') ? currentProfile.avatar : '');
    if (profPhoto) return profPhoto.trim();
  }
  if (owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL && cached.photoURL.trim()) {
      return cached.photoURL.trim();
    }
  }
  if (isCurrentOwner && auth.currentUser?.photoURL) {
    return auth.currentUser.photoURL.trim();
  }
  return '';
}

/**
 * Dynamically queries shared_accounts/profile_${owner16DigitId} if the owner's photo
 * is missing, caching the result and returning the resolved photo URL.
 */
export async function ensureOwnerPhotoLoaded(folder: ShareFolder): Promise<string> {
  const existing = resolveOwnerPhoto(folder);
  if (existing) return existing;
  const owner16 = normalize16DigitId(folder.owner16DigitId || folder.ownerNumericId);
  if (owner16.length === 16) {
    const card = await fetchUserProfileCard(owner16);
    if (card?.photoURL) {
      folder.ownerPhotoURL = card.photoURL;
      return card.photoURL;
    }
  }
  return '';
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
 * Automatically publish user's public lookup card to Firebase RTDB at shared_accounts/profile_${clean16Id}
 */
export async function publishUserProfileCard(profile: {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  uid?: string;
  driveAccessGranted?: boolean;
  drivePromptResolved?: boolean;
}): Promise<void> {
  const clean16Id = String(profile.numericId || '').replace(/\D/g, '');
  if (clean16Id.length !== 16) return;

  const currentUid = auth.currentUser?.uid || profile.uid || '';
  const userName = profile.name || auth.currentUser?.displayName || 'User';
  const userAvatar = profile.photoURL || profile.avatar || auth.currentUser?.photoURL || '';
  const avatarEmoji = profile.avatar || '👤';

  saveKnownContact({
    numericId: clean16Id,
    name: userName,
    avatar: avatarEmoji,
    photoURL: userAvatar,
    uid: currentUid,
    driveAccessGranted: profile.driveAccessGranted,
    drivePromptResolved: profile.drivePromptResolved,
  });

  if (!currentUid) return;

  try {
    const cardData: any = {
      ownerUid: auth.currentUser?.uid || currentUid,
      accountName: (userName || 'User').slice(0, 100),
      updatedAt: Date.now(),
      numericId: clean16Id,
      name: userName,
      photoURL: userAvatar,
      avatar: avatarEmoji,
      uid: currentUid,
    };
    if (typeof profile.driveAccessGranted === 'boolean') {
      cardData.driveAccessGranted = profile.driveAccessGranted;
    }
    if (typeof profile.drivePromptResolved === 'boolean') {
      cardData.drivePromptResolved = profile.drivePromptResolved;
    }
    await set(ref(rtdb, `shared_accounts/profile_${clean16Id}`), deepSanitizeForFirebase(cardData));
  } catch (err) {
    console.warn('[ShareFolders] Failed to publish user profile card to RTDB:', err);
  }

  try {
    const userProfileUpdates: any = {
      numeric16Id: clean16Id,
      numericId: clean16Id,
      name: userName,
      photoURL: userAvatar,
      avatar: avatarEmoji,
      updatedAt: Date.now(),
    };
    if (typeof profile.driveAccessGranted === 'boolean') {
      userProfileUpdates.driveAccessGranted = profile.driveAccessGranted;
    }
    if (typeof profile.drivePromptResolved === 'boolean') {
      userProfileUpdates.drivePromptResolved = profile.drivePromptResolved;
    }
    await update(ref(rtdb, `users/${currentUid}/profile`), deepSanitizeForFirebase(userProfileUpdates));
    await set(ref(rtdb, `users/${currentUid}/numeric16Id`), clean16Id);
  } catch (err) {
    console.warn('[ShareFolders] Failed to save numeric16Id under users/profile in RTDB:', err);
  }

  try {
    await set(ref(rtdb, `numericIds/${clean16Id}`), deepSanitizeForFirebase({
      uid: currentUid,
      displayName: userName,
      name: userName,
      photoURL: userAvatar,
      avatar: avatarEmoji,
      email: auth.currentUser?.email || '',
      updatedAt: Date.now(),
    }));
  } catch {}

  try {
    await propagateUserProfileToAllSharedSpaces({
      numericId: clean16Id,
      name: userName,
      avatar: avatarEmoji,
      photoURL: userAvatar,
      uid: currentUid,
    });
  } catch (propErr) {
    console.warn('[ShareFolders] Failed to propagate user profile to shared spaces:', propErr);
  }
}

/**
 * Live Profile Name & Photo Propagation Across All Shared Spaces:
 * Updates ownerName/ownerAvatar on owned spaces and member entry on joined spaces
 * at the single canonical path shared_accounts/share_${space.id}.
 */
export async function propagateUserProfileToAllSharedSpaces(profile: {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  uid?: string;
}): Promise<void> {
  const clean16Id = normalize16DigitId(profile.numericId);
  if (clean16Id.length !== 16) return;

  const currentUid = auth.currentUser?.uid || profile.uid || '';
  const userName = (profile.name || 'User').trim();
  const avatarEmoji = profile.avatar || '👤';
  const photoURL = profile.photoURL || '';

  const allSpaces = loadAllSpacesV3();
  let anyChanged = false;

  const updatedSpaces = allSpaces.map((folder) => {
    const isOwner = isSpaceOwnedByUser(folder, clean16Id, currentUid);
    let folderChanged = false;
    let nextFolder = { ...folder };

    if (isOwner) {
      if (
        nextFolder.ownerName !== userName ||
        nextFolder.ownerAvatar !== avatarEmoji ||
        nextFolder.ownerPhotoURL !== photoURL
      ) {
        folderChanged = true;
        nextFolder = {
          ...nextFolder,
          ownerName: userName,
          ownerAvatar: avatarEmoji,
          ownerPhotoURL: photoURL,
          updatedAt: Date.now(),
        };
      }
    }

    const updatedMembers = (nextFolder.members || []).map((m) => {
      if (normalize16DigitId(m.numericId) === clean16Id) {
        if (m.name !== userName || m.avatar !== avatarEmoji || m.photoURL !== photoURL) {
          folderChanged = true;
          return {
            ...m,
            name: userName,
            avatar: avatarEmoji,
            photoURL,
          };
        }
      }
      return m;
    });

    if (folderChanged) {
      anyChanged = true;
      return {
        ...nextFolder,
        members: updatedMembers,
        updatedAt: Date.now(),
      };
    }
    return folder;
  });

  if (anyChanged) {
    saveAllSpacesV3(updatedSpaces);
    for (const space of updatedSpaces) {
      await syncFolderToCloud(space, true).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: updatedSpaces }));
      window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: loadReceivedShareFolders() }));
    }
  }
}

/**
 * Fetch a user profile card from shared_accounts/profile_${clean16Id}
 */
export async function fetchUserProfileCard(numericId: string): Promise<UserProfileCard | null> {
  const clean16Id = String(numericId || '').replace(/\D/g, '');
  if (clean16Id.length !== 16) return null;

  // Offline-first guard: if offline, return cached contact immediately with 0 network wait
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getKnownContact(clean16Id);
  }

  // 1. Primary query: shared_accounts/profile_${clean16Id}
  try {
    const snap = await withTimeout(get(ref(rtdb, `shared_accounts/profile_${clean16Id}`)), 3000);
    if (snap.exists()) {
      const val = snap.val() as any;
      const card: UserProfileCard = {
        numericId: clean16Id,
        name: val.name || val.accountName || `User ${clean16Id.slice(0, 4)}`,
        avatar: val.avatar || '👤',
        photoURL: val.photoURL || '',
        uid: val.uid || val.ownerUid,
        updatedAt: val.updatedAt || Date.now(),
      };
      saveKnownContact(card);
      return card;
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch profile from profile_${clean16Id}:', err);
  }

  // 2. Fallback check: numericIds/${clean16Id}
  try {
    const numSnap = await get(ref(rtdb, `numericIds/${clean16Id}`));
    if (numSnap.exists()) {
      const data = numSnap.val();
      let photoURL = data.photoURL || '';
      let avatar = data.avatar || '👤';
      let name = data.displayName || data.name || data.email?.split('@')[0] || `User ${clean16Id.slice(0, 4)}`;
      if (data.uid) {
        try {
          const userSnap = await get(ref(rtdb, `users/${data.uid}`));
          if (userSnap.exists()) {
            const u = userSnap.val();
            if (u.profile?.name) name = u.profile.name;
            else if (u.name) name = u.name;
            else if (u.displayName) name = u.displayName;

            if (u.profile?.photoURL || u.customAvatarUrl || u.photoURL) {
              photoURL = u.profile?.photoURL || u.customAvatarUrl || u.photoURL;
            }
            if (u.profile?.avatar || u.avatarEmoji) {
              avatar = u.profile?.avatar || u.avatarEmoji;
            }
          }
        } catch {}
      }
      const card: UserProfileCard = {
        numericId: clean16Id,
        name,
        avatar,
        photoURL,
        uid: data.uid,
        updatedAt: data.updatedAt || Date.now(),
      };
      saveKnownContact(card);
      return card;
    }
  } catch {}

  // 3. Fallback check: scan shared_accounts entries for matching owner16DigitId or member numericId
  try {
    const sharedSnap = await get(ref(rtdb, 'shared_accounts'));
    if (sharedSnap.exists() && sharedSnap.val()) {
      const entries = sharedSnap.val();
      for (const key of Object.keys(entries)) {
        const item = entries[key];
        if (!item || typeof item !== 'object') continue;
        const candidateId = normalize16DigitId(
          item.numericId || item.owner16DigitId || item.ownerNumericId
        );
        if (candidateId === clean16Id) {
          const card: UserProfileCard = {
            numericId: clean16Id,
            name: item.name || item.ownerName || item.accountName || `User ${clean16Id.slice(0, 4)}`,
            avatar: item.avatar || item.ownerAvatar || '👤',
            photoURL: item.photoURL || item.ownerPhotoURL || '',
            uid: item.uid || item.ownerUid,
            updatedAt: item.updatedAt || Date.now(),
          };
          saveKnownContact(card);
          return card;
        }
        if (Array.isArray(item.members)) {
          const member = item.members.find(
            (m: any) => normalize16DigitId(m?.numericId) === clean16Id
          );
          if (member) {
            const card: UserProfileCard = {
              numericId: clean16Id,
              name: member.name || `User ${clean16Id.slice(0, 4)}`,
              avatar: member.avatar || '👤',
              photoURL: member.photoURL || '',
              updatedAt: member.addedAt || Date.now(),
            };
            saveKnownContact(card);
            return card;
          }
        }
      }
    }
  } catch {}

  // 4. Fallback check: local known contacts cache
  const cached = getKnownContact(clean16Id);
  if (cached) {
    return cached;
  }

  return null;
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
 * Load user's owned Share Spaces ("Shared by Me") from unified 'mm_spaces_v3_cache'
 * Filtered strictly by: (space.ownerUid === currentUser.uid || cleanId(space.owner16DigitId) === myClean16Id)
 */
export function loadMyShareFolders(): ShareFolder[] {
  const all = loadAllSpacesV3();
  return all.filter((space) => isSpaceOwnedByUser(space));
}

/**
 * Persist user's owned Share Spaces into unified 'mm_spaces_v3_cache'
 * Preserves any "Shared with Me" spaces in the unified cache.
 */
export function saveMyShareFolders(folders: ShareFolder[]): void {
  const all = loadAllSpacesV3();
  const received = all.filter((space) => !isSpaceOwnedByUser(space));
  const normalizedOwned = (folders || []).map((f) => ({
    ...f,
    isCreatedByMe: true,
    isReceivedShare: false,
  }));
  saveAllSpacesV3([...normalizedOwned, ...received]);
}

/**
 * Load received Share Spaces ("Shared with Me") from unified 'mm_spaces_v3_cache'
 * Filtered strictly by: member16Ids.includes(myClean16Id) && space.ownerUid !== currentUser.uid
 */
export function loadReceivedShareFolders(): ShareFolder[] {
  const all = loadAllSpacesV3();
  return all.filter((space) => isSpaceSharedWithUser(space));
}

/**
 * Persist received Share Spaces into unified 'mm_spaces_v3_cache'
 * Preserves any owned ("Shared by Me") spaces in the unified cache.
 */
export function saveReceivedShareFolders(folders: ShareFolder[]): void {
  const all = loadAllSpacesV3();
  const owned = all.filter((space) => isSpaceOwnedByUser(space));
  const ownedIds = new Set(owned.map((o) => normalizeShareId(o.id)));
  const normalizedReceived = (folders || [])
    .filter((f) => f && f.id && !ownedIds.has(normalizeShareId(f.id)) && !isSpaceOwnedByUser(f))
    .map((f) => ({
      ...f,
      isCreatedByMe: false,
      isReceivedShare: true,
    }));
  saveAllSpacesV3([...owned, ...normalizedReceived]);
}

const inMemoryNotifiedSharesV3 = new Set<string>();

/**
 * Loads the permanent Set of notified share IDs from localStorage ('mm_notified_shares_v3'
 * and legacy 'mm_notified_share_ids_perm'). All IDs are normalized without 'share_' prefix.
 */
export function getNotifiedSharesV3(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set(inMemoryNotifiedSharesV3);
  try {
    const rawV3 = localStorage.getItem(NOTIFIED_SHARES_V3_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const clean = normalizeShareId(item);
          if (clean) inMemoryNotifiedSharesV3.add(clean);
        }
      }
    }
    const rawLegacy = localStorage.getItem(PERMANENT_NOTIFIED_SHARE_IDS_KEY);
    if (rawLegacy) {
      const parsedLegacy = JSON.parse(rawLegacy);
      if (Array.isArray(parsedLegacy)) {
        for (const item of parsedLegacy) {
          const clean = normalizeShareId(item);
          if (clean) inMemoryNotifiedSharesV3.add(clean);
        }
      }
    }
  } catch {}
  return new Set(inMemoryNotifiedSharesV3);
}

export function getNotifiedShareIdsPerm(): Set<string> {
  return getNotifiedSharesV3();
}

export function isShareIdNotifiedPerm(id?: string | null): boolean {
  const clean = normalizeShareId(id);
  if (!clean) return true;
  return getNotifiedSharesV3().has(clean);
}

export function markShareIdsNotifiedPerm(ids: (string | undefined | null)[] | Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const seen = getNotifiedSharesV3();
    ids.forEach((id) => {
      const clean = normalizeShareId(id);
      if (clean) {
        seen.add(clean);
        inMemoryNotifiedSharesV3.add(clean);
      }
    });
    const list = Array.from(seen).slice(-500);
    localStorage.setItem(NOTIFIED_SHARES_V3_KEY, JSON.stringify(list));
    localStorage.setItem(PERMANENT_NOTIFIED_SHARE_IDS_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Syncs users/${uid}/notifiedShares from Firebase RTDB into local 'mm_notified_shares_v3'
 */
export async function syncCloudNotifiedSharesToLocal(customUid?: string): Promise<Set<string>> {
  const uid = customUid || auth.currentUser?.uid || getCachedAuthUser()?.uid || '';
  if (!uid) return getNotifiedSharesV3();
  try {
    const snap = await get(ref(rtdb, `users/${uid}/notifiedShares`));
    if (snap.exists() && snap.val() && typeof snap.val() === 'object') {
      const val = snap.val();
      const cloudIds: string[] = [];
      for (const [key, isNotified] of Object.entries(val)) {
        if (isNotified) {
          const clean = normalizeShareId(key);
          if (clean) cloudIds.push(clean);
        }
      }
      if (cloudIds.length > 0) {
        markShareIdsNotifiedPerm(cloudIds);
      }
    }
  } catch {}
  return getNotifiedSharesV3();
}

/**
 * Checks whether a space has ALREADY been notified (or should never be notified because user is owner):
 * (1) Returns true if space.ownerUid === currentUser.uid or cleanId(space.owner16DigitId) === myClean16Id
 * (2) Returns true if normalized space.id is in 'mm_notified_shares_v3'
 * (3) Returns true if recipient's member entry has member.notified === true or space.notifiedMembers[myClean16Id] === true
 */
export function isShareNotifiedEverywhere(
  space: Partial<ShareFolder> | null | undefined,
  myClean16Id: string,
  currentUid?: string
): boolean {
  if (!space || !space.id) return true;
  const cleanSid = normalizeShareId(space.id);
  if (!cleanSid) return true;

  const cleanMy16 = normalize16DigitId(myClean16Id);
  const cleanOwner16 = normalize16DigitId(space.owner16DigitId || space.ownerNumericId);
  const effectiveUid = currentUid || auth.currentUser?.uid || getCachedAuthUser()?.uid || '';

  // (1) NEVER notify if space.ownerUid === currentUser.uid or cleanId(space.owner16DigitId) === myClean16Id
  if (
    (effectiveUid && space.ownerUid && space.ownerUid === effectiveUid) ||
    (cleanMy16 && cleanOwner16 && cleanOwner16 === cleanMy16) ||
    isSpaceOwnedByUser(space, cleanMy16, effectiveUid)
  ) {
    return true;
  }

  // (2) Check local 'mm_notified_shares_v3'
  if (getNotifiedSharesV3().has(cleanSid)) {
    return true;
  }

  // (3) Check cloud member.notified flag or space.notifiedMembers map
  if (cleanMy16) {
    const myMember = (space.members || []).find(
      (m) => normalize16DigitId(m.numericId) === cleanMy16
    );
    if (myMember?.notified === true || Boolean(space.notifiedMembers?.[cleanMy16])) {
      markShareIdsNotifiedPerm([cleanSid]);
      return true;
    }
  }

  return false;
}

/**
 * Immediately records space.id as notified in BOTH localStorage ('mm_notified_shares_v3')
 * AND Firebase RTDB (users/${uid}/notifiedShares/${space.id} = true and member.notified = true).
 */
export async function recordShareNotifiedEverywhere(
  space: ShareFolder,
  myClean16Id: string,
  currentUid?: string
): Promise<void> {
  if (!space || !space.id) return;
  const cleanSid = normalizeShareId(space.id);
  if (!cleanSid) return;

  const cleanMy16 = normalize16DigitId(myClean16Id);
  const effectiveUid = currentUid || auth.currentUser?.uid || getCachedAuthUser()?.uid || '';
  const now = Date.now();

  // 1. Immediately record in 'mm_notified_shares_v3' (synchronous localStorage + in-memory Set)
  markShareIdsNotifiedPerm([cleanSid]);
  markShareNotificationsSeen([cleanSid, space.id, computeShareNotificationHash(space)]);

  // 2. Update local V3 cache member entry with notified: true
  const updatedMembers = (space.members || []).map((m) =>
    normalize16DigitId(m.numericId) === cleanMy16
      ? { ...m, notified: true, notifiedAt: now }
      : m
  );
  const updatedNotifiedMembers = {
    ...(space.notifiedMembers || {}),
    ...(cleanMy16 ? { [cleanMy16]: true } : {}),
  };
  upsertSpaceInV3Cache({
    ...space,
    members: updatedMembers,
    notifiedMembers: updatedNotifiedMembers,
  });

  // 3. Persist to Firebase RTDB: users/${uid}/notifiedShares/${space.id} = true AND member.notified = true
  try {
    if (effectiveUid) {
      await set(ref(rtdb, `users/${effectiveUid}/notifiedShares/${cleanSid}`), true).catch(() => {});
    }
    if (cleanMy16.length === 16) {
      const canonicalPath = getCanonicalSharePath(cleanSid);
      const snap = await get(ref(rtdb, canonicalPath));
      if (snap.exists() && snap.val()) {
        const cloudVal = snap.val();
        const cloudMembers = Array.isArray(cloudVal.members) ? cloudVal.members : [];
        let memberFound = false;
        const nextCloudMembers = cloudMembers.map((cm: any) => {
          if (normalize16DigitId(cm?.numericId) === cleanMy16) {
            memberFound = true;
            return { ...cm, notified: true, notifiedAt: now };
          }
          return cm;
        });
        const updates: Record<string, any> = {
          [`notifiedMembers/${cleanMy16}`]: true,
        };
        if (memberFound) {
          updates.members = nextCloudMembers;
        }
        await update(ref(rtdb, canonicalPath), deepSanitizeForFirebase(updates)).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed recording cloud notified flag:', err);
  }
}

export function getMyCreatedShareIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(MY_CREATED_SHARE_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((id) => normalizeShareId(id)).filter(Boolean));
    }
  } catch {}
  return new Set();
}

export function isShareCreatedByMe(id?: string | null): boolean {
  const clean = normalizeShareId(id);
  if (!clean) return false;
  return getMyCreatedShareIds().has(clean);
}

export function markShareCreatedByMe(id?: string | null): void {
  const clean = normalizeShareId(id);
  if (!clean || typeof localStorage === 'undefined') return;
  try {
    const set = getMyCreatedShareIds();
    set.add(clean);
    const list = Array.from(set).slice(-500);
    localStorage.setItem(MY_CREATED_SHARE_IDS_KEY, JSON.stringify(list));
  } catch {}
}

export function getDismissedShareIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_SHARE_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((id) => normalizeShareId(id)).filter(Boolean));
    }
  } catch {}
  return new Set();
}

export function isShareDismissed(id?: string | null): boolean {
  const clean = normalizeShareId(id);
  if (!clean) return false;
  return getDismissedShareIds().has(clean);
}

export async function dismissShareId(shareId: string, _my16DigitId?: string): Promise<void> {
  const cleanShareId = normalizeShareId(shareId);
  if (!cleanShareId) return;

  if (typeof localStorage !== 'undefined') {
    try {
      const set = getDismissedShareIds();
      set.add(cleanShareId);
      const list = Array.from(set).slice(-500);
      localStorage.setItem(DISMISSED_SHARE_IDS_KEY, JSON.stringify(list));
    } catch {}
  }

  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    try {
      await set(ref(rtdb, `user_dismissed_shares/${currentUid}/${cleanShareId}`), true);
    } catch {}
  }
}

/**
 * Purges a deleted or dismissed space from 'mm_spaces_v3_cache' and dispatches UI events.
 */
export function purgeDeletedShareSpace(shareId: string): void {
  const cleanSid = normalizeShareId(shareId);
  if (!cleanSid) return;

  const all = loadAllSpacesV3();
  const next = all.filter((f) => normalizeShareId(f.id) !== cleanSid);
  if (next.length !== all.length) {
    saveAllSpacesV3(next);
  }

  if (typeof window !== 'undefined') {
    const nextReceived = next.filter((s) => isSpaceSharedWithUser(s));
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: nextReceived }));
    window.dispatchEvent(new CustomEvent('share_space_purged', { detail: { shareId: cleanSid } }));
  }
}

export function getSeenShareNotificationHashes(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
    if (typeof parsed === 'object' && parsed !== null) return new Set(Object.keys(parsed));
  } catch {}
  return new Set();
}

export function computeShareNotificationHash(folder: Partial<ShareFolder>): string {
  if (!folder || !folder.id) return '';
  const cleanId = normalizeShareId(folder.id);
  const owner = folder.owner16DigitId || folder.ownerNumericId || folder.ownerUid || folder.ownerName || '';
  return `share_invite_${cleanId}_${owner}`;
}

export function markShareNotificationsSeen(hashes: string[] | Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const seen = getSeenShareNotificationHashes();
    hashes.forEach((h) => {
      if (h) seen.add(h);
    });
    const list = Array.from(seen).slice(-300);
    localStorage.setItem(SEEN_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function isShareNotificationSeen(hash: string): boolean {
  if (!hash) return true;
  return getSeenShareNotificationHashes().has(hash);
}

/**
 * Partition & repair spaces in 'mm_spaces_v3_cache' strictly by:
 * - "Shared by Me": (space.ownerUid === currentUser.uid || cleanId(space.owner16DigitId) === myClean16Id)
 * - "Shared with Me": member16Ids.includes(myClean16Id) && space.ownerUid !== currentUser.uid
 */
export function repairAndMigrateSharedSpaces(
  myNumericId?: string,
  currentUserUid?: string
): { myFolders: ShareFolder[]; receivedFolders: ShareFolder[] } {
  const { myUid, myClean16Id } = resolveCurrentIdentity(myNumericId, currentUserUid);
  const all = loadAllSpacesV3();

  const myFolders: ShareFolder[] = [];
  const receivedFolders: ShareFolder[] = [];

  for (const space of all) {
    if (!space || !space.id || space.deleted === true) continue;
    if (isSpaceOwnedByUser(space, myClean16Id, myUid)) {
      myFolders.push({
        ...space,
        isCreatedByMe: true,
        isReceivedShare: false,
      });
    } else if (isSpaceSharedWithUser(space, myClean16Id, myUid)) {
      receivedFolders.push({
        ...space,
        isCreatedByMe: false,
        isReceivedShare: true,
      });
    }
  }

  return { myFolders, receivedFolders };
}

/**
 * Saves or updates a ShareFolder immediately in 'mm_spaces_v3_cache' and triggers cloud sync
 * to canonical path shared_accounts/share_${space.id}.
 */
export function saveShareFolder(folder: ShareFolder): ShareFolder {
  if (!folder || !folder.id) return folder;
  const saved = upsertSpaceInV3Cache(folder);
  syncFolderToCloud(saved);
  return saved;
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
      if (share) return normalizeShareId(share);
    }
  } catch {}
  return normalizeShareId(trimmed);
}

/**
 * Build canonical V3 Firebase payload for shared_accounts/share_${space.id} containing:
 * { id, name, icon, ownerUid, owner16DigitId, ownerName, ownerAvatar, member16Ids: string[],
 *   members: ShareMember[], accounts, categories, transactions, createdAt, updatedAt, accountName: name }
 */
export function buildFullSharePayload(folder: ShareFolder): ShareFolder & {
  id: string;
  name: string;
  icon: string;
  ownerUid: string;
  owner16DigitId: string;
  ownerName: string;
  ownerAvatar: string;
  member16Ids: string[];
  members: ShareMember[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  createdAt: number;
  updatedAt: number;
  accountName: string;
  v3Schema: boolean;
} {
  const cleanFolder: ShareFolder = JSON.parse(JSON.stringify(folder));
  const canonicalId = normalizeShareId(cleanFolder.id);
  const now = Date.now();

  const originalOwner16 = normalize16DigitId(cleanFolder.owner16DigitId || cleanFolder.ownerNumericId);
  const isMeOwner = isSpaceOwnedByUser(cleanFolder);
  const ownerUid =
    cleanFolder.ownerUid ||
    (isMeOwner && auth.currentUser?.uid ? auth.currentUser.uid : originalOwner16 || 'authenticated_user');
  const ownerName = cleanFolder.ownerName || (originalOwner16 ? `User ${originalOwner16.slice(0, 4)}` : 'User');
  let ownerAvatar = cleanFolder.ownerAvatar || '👤';
  let ownerPhotoURL = (
    cleanFolder.ownerPhotoURL ||
    (cleanFolder.ownerAvatar && cleanFolder.ownerAvatar.startsWith('http') ? cleanFolder.ownerAvatar : '')
  ).trim();

  if (!ownerPhotoURL && originalOwner16) {
    const cached = getKnownContact(originalOwner16);
    if (cached?.photoURL) ownerPhotoURL = cached.photoURL.trim();
    if (cached?.avatar && ownerAvatar === '👤') ownerAvatar = cached.avatar;
  }
  if (!ownerPhotoURL && isMeOwner && auth.currentUser?.photoURL) {
    ownerPhotoURL = auth.currentUser.photoURL.trim();
  }

  let hasOwnerInMembers = false;
  const member16Set = new Set<string>();
  if (originalOwner16.length === 16) {
    member16Set.add(originalOwner16);
  }
  if (Array.isArray(cleanFolder.member16Ids)) {
    for (const id of cleanFolder.member16Ids) {
      const c = normalize16DigitId(id);
      if (c.length === 16) member16Set.add(c);
    }
  }

  const normalizedMembers: ShareMember[] = (cleanFolder.members || []).map((m: any) => {
    const cleanMid = normalize16DigitId(m.numericId);
    const isOwnerMember = cleanMid.length === 16 && cleanMid === originalOwner16;
    if (isOwnerMember) hasOwnerInMembers = true;
    if (cleanMid.length === 16) member16Set.add(cleanMid);

    return {
      ...m,
      numericId: cleanMid,
      name: isOwnerMember ? ownerName : (m.name || 'User'),
      avatar: m.avatar || (isOwnerMember ? ownerAvatar : '👤'),
      photoURL: (m.photoURL || (isOwnerMember ? ownerPhotoURL : '')).trim(),
      role: isOwnerMember ? 'editor' : (m.role || 'viewer'),
      status: 'active' as const,
      addedAt: m.addedAt || now,
    };
  });

  if (!hasOwnerInMembers && originalOwner16.length === 16) {
    normalizedMembers.unshift({
      numericId: originalOwner16,
      name: ownerName,
      avatar: ownerAvatar,
      photoURL: ownerPhotoURL,
      role: 'editor',
      status: 'active',
      addedAt: cleanFolder.createdAt || now,
    });
  }

  const accounts: Account[] = Array.isArray(cleanFolder.payload?.accounts)
    ? cleanFolder.payload.accounts
    : Array.isArray(cleanFolder.accounts)
    ? cleanFolder.accounts
    : [];

  const categories: Category[] = Array.isArray(cleanFolder.payload?.categories)
    ? cleanFolder.payload.categories
    : Array.isArray(cleanFolder.categories)
    ? cleanFolder.categories
    : [];

  const rawTxs: Transaction[] = Array.isArray(cleanFolder.payload?.transactions)
    ? cleanFolder.payload.transactions
    : Array.isArray(cleanFolder.transactions)
    ? cleanFolder.transactions
    : [];

  const transactions = rawTxs.map((t) => enrichShareTransaction(t, accounts));
  const name = String(cleanFolder.name || cleanFolder.accountName || 'Shared Space').trim();
  const accountName = name.slice(0, 100);
  const member16Ids = Array.from(member16Set);

  return deepSanitizeForFirebase({
    ...cleanFolder,
    id: canonicalId,
    name,
    accountName,
    icon: cleanFolder.icon || '📁',
    description: cleanFolder.description || '',
    ownerUid,
    ownerNumericId: originalOwner16,
    owner16DigitId: originalOwner16,
    ownerName,
    ownerAvatar,
    ownerPhotoURL,
    permission: cleanFolder.permission || 'allow_import_edit',
    member16Ids,
    members: normalizedMembers,
    accounts,
    categories,
    transactions,
    payload: {
      accounts,
      categories,
      transactions,
    },
    itemType: cleanFolder.itemType || 'mixed',
    itemCount: accounts.length + categories.length + transactions.length,
    createdAt: cleanFolder.createdAt || now,
    updatedAt: cleanFolder.updatedAt || now,
    v3Schema: true,
  });
}

/**
 * Normalize a raw RTDB or localStorage object into a ShareFolder
 */
export function normalizeParsedShareFolder(val: any, fallbackId?: string): ShareFolder | null {
  if (!val || typeof val !== 'object' || val.deleted === true) return null;
  const rawId = val.id || fallbackId;
  if (!rawId || typeof rawId !== 'string') return null;
  const id = normalizeShareId(rawId);
  if (!id) return null;

  const owner16 = normalize16DigitId(
    val.owner16DigitId ||
      val.ownerNumericId ||
      val.ownerNumeric16Id ||
      val.ownerId ||
      (val.ownerUid && /^\d{16}$/.test(val.ownerUid) ? val.ownerUid : '')
  );
  const ownerUid = val.ownerUid || '';
  const ownerName = val.ownerName || val.ownerDisplayName || (owner16 ? `User ${owner16.slice(0, 4)}` : 'User');
  let ownerAvatar = val.ownerAvatar || '👤';
  let ownerPhotoURL = (
    val.ownerPhotoURL ||
    (val.ownerAvatar && val.ownerAvatar.startsWith('http') ? val.ownerAvatar : '')
  ).trim();

  if (!ownerPhotoURL && owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL) ownerPhotoURL = cached.photoURL.trim();
    if (cached?.avatar && ownerAvatar === '👤') ownerAvatar = cached.avatar;
  }

  let members: ShareMember[] = [];
  if (Array.isArray(val.members)) {
    members = val.members.map((m: any) => ({
      numericId: normalize16DigitId(m.numericId),
      name: m.name || 'User',
      avatar: m.avatar || '👤',
      photoURL: m.photoURL || '',
      role: m.role || 'viewer',
      status: (m.status === 'pending' ? 'pending' : 'active') as 'pending' | 'accepted' | 'active',
      addedAt: m.addedAt || Date.now(),
      ...(m.notified ? { notified: true } : {}),
      ...(m.notifiedAt ? { notifiedAt: m.notifiedAt } : {}),
    }));
  }

  let hasOwner = false;
  members = members.map((m) => {
    if (m.numericId === owner16 && owner16.length === 16) {
      hasOwner = true;
      return {
        ...m,
        name: m.name && m.name !== 'User' ? m.name : ownerName,
        photoURL: m.photoURL || ownerPhotoURL,
        avatar: m.avatar || ownerAvatar,
        role: 'editor',
      };
    }
    return m;
  });

  if (!hasOwner && owner16.length === 16) {
    members.unshift({
      numericId: owner16,
      name: ownerName,
      avatar: ownerAvatar,
      photoURL: ownerPhotoURL,
      role: 'editor',
      status: 'active',
      addedAt: val.createdAt || Date.now(),
    });
  }

  const member16Set = new Set<string>();
  if (owner16.length === 16) member16Set.add(owner16);
  if (Array.isArray(val.member16Ids)) {
    for (const mid of val.member16Ids) {
      const c = normalize16DigitId(mid);
      if (c.length === 16) member16Set.add(c);
    }
  }
  for (const m of members) {
    const c = normalize16DigitId(m.numericId);
    if (c.length === 16) member16Set.add(c);
  }
  const member16Ids = Array.from(member16Set);

  const accounts: Account[] = Array.isArray(val.accounts)
    ? val.accounts
    : Array.isArray(val.payload?.accounts)
    ? val.payload.accounts
    : [];

  const categories: Category[] = Array.isArray(val.categories)
    ? val.categories
    : Array.isArray(val.payload?.categories)
    ? val.payload.categories
    : [];

  const rawTransactions: Transaction[] = Array.isArray(val.transactions)
    ? val.transactions
    : Array.isArray(val.payload?.transactions)
    ? val.payload.transactions
    : [];

  const transactions = rawTransactions.map((t) => enrichShareTransaction(t, accounts));
  const payload: ShareFolderPayload = {
    accounts,
    categories,
    transactions,
  };

  const name = val.name || val.accountName || 'Shared Space';
  const itemCount = accounts.length + categories.length + transactions.length;

  const isOwned = isSpaceOwnedByUser({ ownerUid, owner16DigitId: owner16 });

  return {
    id,
    name,
    accountName: name,
    icon: val.icon || '📁',
    description: val.description || '',
    createdAt: val.createdAt || val.updatedAt || Date.now(),
    updatedAt: val.updatedAt || Date.now(),
    ownerNumericId: owner16,
    owner16DigitId: owner16,
    ownerUid,
    ownerName,
    ownerAvatar,
    ownerPhotoURL,
    permission: val.permission || 'allow_import_edit',
    member16Ids,
    members,
    accounts,
    categories,
    transactions,
    itemType: val.itemType || 'mixed',
    itemCount,
    payload,
    recipientNumericId: val.recipientNumericId,
    ...(val.notifiedMembers && typeof val.notifiedMembers === 'object' ? { notifiedMembers: val.notifiedMembers } : {}),
    isCreatedByMe: isOwned,
    isReceivedShare: !isOwned,
    v3Schema: true,
  };
}

export function parseFoldersFromInboxData(data: any): ShareFolder[] {
  if (!data || typeof data !== 'object') return [];
  if (data.id && (data.payload || data.members || data.accounts || data.transactions)) {
    const single = normalizeParsedShareFolder(data);
    return single ? [single] : [];
  }
  const folderMap = new Map<string, ShareFolder>();
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('profile_')) continue;
    if (val && typeof val === 'object') {
      const parsed = normalizeParsedShareFolder(val, key);
      if (parsed) {
        folderMap.set(parsed.id, parsed);
      }
    }
  }
  const folders = Array.from(folderMap.values());
  folders.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return folders;
}

/**
 * Register and save a received share folder (from an invitation link or cloud lookup)
 * into 'mm_spaces_v3_cache' and join as an active member in canonical shared_accounts/share_${space.id}.
 */
export async function registerReceivedShareFolder(
  folder: ShareFolder,
  myNumericId?: string,
  myName?: string,
  myAvatar?: string,
  myPhotoURL?: string
): Promise<ShareFolder> {
  const cleanId = normalize16DigitId(myNumericId || getOrCreateNumericId());
  const isOwner = isSpaceOwnedByUser(folder, cleanId);

  let updatedMembers = Array.isArray(folder.members) ? [...folder.members] : [];
  if (!isOwner && cleanId.length === 16) {
    const existingMemberIdx = updatedMembers.findIndex((m) => normalize16DigitId(m.numericId) === cleanId);
    if (existingMemberIdx === -1) {
      updatedMembers.push({
        numericId: cleanId,
        name: myName || 'User',
        avatar: myAvatar || '👤',
        photoURL: myPhotoURL || '',
        role: 'viewer',
        status: 'active',
        addedAt: Date.now(),
      });
    } else {
      updatedMembers[existingMemberIdx] = {
        ...updatedMembers[existingMemberIdx],
        status: 'active',
      };
    }
  }

  const member16Ids = extractMember16Ids({ ...folder, members: updatedMembers });
  if (cleanId.length === 16 && !member16Ids.includes(cleanId)) {
    member16Ids.push(cleanId);
  }

  const finalFolder: ShareFolder = {
    ...folder,
    id: normalizeShareId(folder.id),
    member16Ids,
    members: updatedMembers,
    isCreatedByMe: isOwner,
    isReceivedShare: !isOwner,
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(finalFolder);
  markShareIdsNotifiedPerm([saved.id]);
  markShareNotificationsSeen([saved.id, computeShareNotificationHash(saved)]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: loadReceivedShareFolders() }));
  }

  await syncFolderToCloud(saved, true).catch(() => {});
  return saved;
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

const lastSyncedFolderSignatures = new Map<string, string>();

/**
 * Computes a concise signature of all content fields in a ShareFolder.
 */
export function computeFolderContentSignature(folder: ShareFolder): string {
  if (!folder) return '';
  const txs = folder.payload?.transactions || folder.transactions || [];
  const accs = folder.payload?.accounts || folder.accounts || [];
  const cats = folder.payload?.categories || folder.categories || [];
  const txsSig = txs
    .map((t) => `${t.id}_${t.amount}_${t.type}_${t.date}_${t.accountId}_${t.toAccountId || ''}_${t.categoryName || ''}`)
    .join(';');
  const accsSig = accs
    .map((a) => `${a.id}_${a.balance}_${a.name}_${a.icon || ''}`)
    .join(';');
  const catsSig = cats
    .map((c) => `${c.id}_${c.name}_${c.icon || ''}`)
    .join(';');
  const membersSig = (folder.members || [])
    .map((m) => `${m.numericId}_${m.name}_${m.role}_${m.avatar || ''}_${m.photoURL || ''}`)
    .join(';');
  return `${normalizeShareId(folder.id)}|${folder.name}|${folder.icon || ''}|${folder.ownerName}|${folder.ownerAvatar || ''}|${folder.ownerPhotoURL || ''}|${folder.owner16DigitId || ''}|${membersSig}|${accsSig}|${catsSig}|${txsSig}`;
}

/**
 * Sync Share Space to the ONE canonical path: shared_accounts/share_${space.id}
 * Persists locally in 'mm_spaces_v3_cache' immediately and syncs to Firebase whenever online.
 */
export async function syncFolderToCloud(folder: ShareFolder, forceWrite = false): Promise<void> {
  if (!folder || !folder.id) return;

  // Always ensure space is persisted in local cache ('mm_spaces_v3_cache') and React state first
  const savedLocal = upsertSpaceInV3Cache(folder);
  const canonicalPayload = buildFullSharePayload(savedLocal);

  // If offline, queue for sync as soon as network is restored
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineShareUpdate(canonicalPayload);
    return;
  }

  const currentSig = computeFolderContentSignature(canonicalPayload);
  const lastSig = lastSyncedFolderSignatures.get(canonicalPayload.id);
  if (!forceWrite && lastSig && lastSig === currentSig) {
    return;
  }
  lastSyncedFolderSignatures.set(canonicalPayload.id, currentSig);

  const canonicalPath = getCanonicalSharePath(canonicalPayload.id);

  try {
    await set(ref(rtdb, canonicalPath), canonicalPayload);
    removeSpaceFromOfflineQueue(canonicalPayload.id);
  } catch (err) {
    console.warn(`[ShareFolders] Failed to write canonical space ${canonicalPath}:`, err);
    queueOfflineShareUpdate(canonicalPayload);
  }
}

export const syncShareFolderToCloud = syncFolderToCloud;

/**
 * Automatically synchronize owned Share Spaces with live app data (accounts, categories, transactions)
 * and broadcast updates to shared_accounts/share_${space.id} in real time.
 */
export function syncShareFoldersWithMainData(
  allAccounts: Account[],
  allCategories: Category[],
  allTransactions: Transaction[]
): void {
  const allSpaces = loadAllSpacesV3();
  if (allSpaces.length === 0) return;

  let anyChanged = false;
  const updatedSpaces = allSpaces.map((folder) => {
    // Only auto-overwrite from personal accounts/categories/transactions on spaces owned by current user
    if (!isSpaceOwnedByUser(folder)) return folder;
    if (!folder.payload) return folder;

    const folderAccountIds = new Set(folder.payload.accounts.map((a) => a.id));
    const folderCategoryIds = new Set(folder.payload.categories.map((c) => c.id));
    const folderTxIds = new Set(folder.payload.transactions.map((t) => t.id));

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

    const nextTxs = allTransactions
      .filter((t) => {
        if (t.accountId && folderAccountIds.has(t.accountId)) return true;
        if (t.toAccountId && folderAccountIds.has(t.toAccountId)) return true;
        if (t.categoryId && folderCategoryIds.has(t.categoryId)) return true;
        if (folderTxIds.has(t.id)) return true;
        return false;
      })
      .map((t) => enrichShareTransaction(t, nextAccounts, allTransactions));

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
        accounts: nextAccounts,
        categories: nextCategories,
        transactions: nextTxs,
        payload: {
          accounts: nextAccounts,
          categories: nextCategories,
          transactions: nextTxs,
        },
      };
      syncFolderToCloud(updatedFolder);
      return updatedFolder;
    }

    return folder;
  });

  if (anyChanged) {
    saveAllSpacesV3(updatedSpaces);
  }
}

/**
 * Create a new standalone Share Space, immediately persist to 'mm_spaces_v3_cache',
 * and sync to shared_accounts/share_${space.id}
 */
export function createNewShareFolder(params: {
  customName?: string;
  customIcon?: string;
  customDescription?: string;
  accounts?: Account[];
  categories?: Category[];
  transactions?: Transaction[];
  ownerNumericId: string;
  owner16DigitId?: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerPhotoURL?: string;
  ownerUid?: string;
  permission?: 'view_only' | 'allow_import_edit';
  isArabic: boolean;
}): ShareFolder {
  const accounts = params.accounts || [];
  const categories = params.categories || [];
  const rawTransactions = params.transactions || [];
  const transactions = rawTransactions.map((t) => enrichShareTransaction(t, accounts));

  const autoMeta = deduceFolderMetadata(accounts, categories, transactions, params.isArabic);
  const name = params.customName?.trim() || autoMeta.name;
  const icon = params.customIcon?.trim() || autoMeta.icon;
  const itemCount = accounts.length + categories.length + transactions.length;

  const owner16 = normalize16DigitId(params.owner16DigitId || params.ownerNumericId || getOrCreateNumericId());
  const ownerUid = params.ownerUid || auth.currentUser?.uid || getCachedAuthUser()?.uid || owner16;
  const ownerName = params.ownerName || 'User';
  let ownerPhoto = (params.ownerPhotoURL || '').trim();
  let ownerAvatar = params.ownerAvatar || '👤';

  if (!ownerPhoto && owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL) ownerPhoto = cached.photoURL.trim();
    if (cached?.avatar && ownerAvatar === '👤') ownerAvatar = cached.avatar;
  }
  if (!ownerPhoto && auth.currentUser?.photoURL) {
    ownerPhoto = auth.currentUser.photoURL.trim();
  }

  const now = Date.now();
  const cleanId = `${now}_${Math.random().toString(36).slice(2, 7)}`;

  const ownerMember: ShareMember = {
    numericId: owner16,
    name: ownerName,
    avatar: ownerAvatar,
    photoURL: ownerPhoto,
    role: 'editor',
    status: 'active',
    addedAt: now,
  };

  const folder: ShareFolder = {
    id: cleanId,
    name,
    accountName: name,
    icon,
    description: params.customDescription?.trim() || '',
    createdAt: now,
    updatedAt: now,
    ownerNumericId: owner16,
    owner16DigitId: owner16,
    ownerUid,
    ownerName,
    ownerAvatar,
    ownerPhotoURL: ownerPhoto,
    permission: params.permission || 'allow_import_edit',
    member16Ids: owner16 ? [owner16] : [],
    members: [ownerMember],
    accounts,
    categories,
    transactions,
    itemType: autoMeta.itemType,
    itemCount,
    payload: {
      accounts,
      categories,
      transactions,
    },
    isCreatedByMe: true,
    isReceivedShare: false,
    v3Schema: true,
  };

  markShareCreatedByMe(folder.id);
  const saved = upsertSpaceInV3Cache(folder);
  syncFolderToCloud(saved, true);

  return saved;
}

/**
 * Append items to an existing Share Space
 */
export function appendToExistingShareFolder(
  folderId: string,
  newItems: { accounts?: Account[]; categories?: Category[]; transactions?: Transaction[] }
): ShareFolder | null {
  const cleanId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const folder = all.find((f) => normalizeShareId(f.id) === cleanId);
  if (!folder) return null;

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
    const enriched = enrichShareTransaction(tx, combinedAccounts);
    if (!combinedTransactions.some((t) => t.id === enriched.id)) combinedTransactions.push(enriched);
  });

  const updatedFolder: ShareFolder = {
    ...folder,
    updatedAt: Date.now(),
    itemCount: combinedAccounts.length + combinedCategories.length + combinedTransactions.length,
    accounts: combinedAccounts,
    categories: combinedCategories,
    transactions: combinedTransactions,
    payload: {
      accounts: combinedAccounts,
      categories: combinedCategories,
      transactions: combinedTransactions,
    },
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  syncFolderToCloud(saved, true);
  return saved;
}

/**
 * Add or update transaction inside a Share Space
 */
export function addTransactionToShareFolder(
  folderId: string,
  tx: Transaction
): ShareFolder | null {
  const cleanId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const targetFolder = all.find((f) => normalizeShareId(f.id) === cleanId);
  if (!targetFolder) return null;

  const enrichedTx = enrichShareTransaction(tx, targetFolder.payload.accounts);
  const txs = [...targetFolder.payload.transactions];
  const existingTxIdx = txs.findIndex((t) => t.id === enrichedTx.id);
  if (existingTxIdx !== -1) {
    txs[existingTxIdx] = enrichedTx;
  } else {
    txs.unshift(enrichedTx);
  }

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: targetFolder.payload.accounts.length + targetFolder.payload.categories.length + txs.length,
    transactions: txs,
    payload: {
      ...targetFolder.payload,
      transactions: txs,
    },
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  syncFolderToCloud(saved, true);
  return saved;
}

export const updateTransactionInShareFolder = addTransactionToShareFolder;

/**
 * Update any item (account, category, transaction) in a Share Space
 */
export function updateItemInShareFolder(
  folderId: string,
  itemType: 'account' | 'category' | 'transaction',
  updatedItem: Account | Category | Transaction
): ShareFolder | null {
  const cleanId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const targetFolder = all.find((f) => normalizeShareId(f.id) === cleanId);
  if (!targetFolder) return null;

  const nextAccounts = [...targetFolder.payload.accounts];
  const nextCategories = [...targetFolder.payload.categories];
  const nextTransactions = [...targetFolder.payload.transactions];

  if (itemType === 'account') {
    const idx = nextAccounts.findIndex((a) => a.id === updatedItem.id);
    if (idx !== -1) nextAccounts[idx] = updatedItem as Account;
    else nextAccounts.push(updatedItem as Account);
  } else if (itemType === 'category') {
    const idx = nextCategories.findIndex((c) => c.id === updatedItem.id);
    if (idx !== -1) nextCategories[idx] = updatedItem as Category;
    else nextCategories.push(updatedItem as Category);
  } else {
    const enrichedTx = enrichShareTransaction(updatedItem as Transaction, nextAccounts);
    const idx = nextTransactions.findIndex((t) => t.id === enrichedTx.id);
    if (idx !== -1) nextTransactions[idx] = enrichedTx;
    else nextTransactions.unshift(enrichedTx);
  }

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: nextAccounts.length + nextCategories.length + nextTransactions.length,
    accounts: nextAccounts,
    categories: nextCategories,
    transactions: nextTransactions,
    payload: {
      accounts: nextAccounts,
      categories: nextCategories,
      transactions: nextTransactions,
    },
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  syncFolderToCloud(saved, true);
  return saved;
}

/**
 * Remove a specific item from a Share Space
 */
export function removeItemFromShareFolder(
  folderId: string,
  itemType: 'account' | 'category' | 'transaction',
  itemId: string
): ShareFolder | null {
  const cleanId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const folder = all.find((f) => normalizeShareId(f.id) === cleanId);
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
    accounts: nextAccounts,
    categories: nextCategories,
    transactions: nextTransactions,
    payload: {
      accounts: nextAccounts,
      categories: nextCategories,
      transactions: nextTransactions,
    },
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  syncFolderToCloud(saved, true);
  return saved;
}

/**
 * Smart deletion from a Share Space
 */
export function removeItemsFromShareFolderSmart(
  folderId: string,
  params: {
    deletedAccountIds?: string[];
    deletedCategoryIds?: string[];
    deletedTxIds: string[];
  }
): ShareFolder | null {
  const cleanId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const targetFolder = all.find((f) => normalizeShareId(f.id) === cleanId);
  if (!targetFolder) return null;

  const deletedTxSet = new Set(params.deletedTxIds || []);
  const deletedAccSet = new Set(params.deletedAccountIds || []);
  const deletedCatSet = new Set(params.deletedCategoryIds || []);

  const remainingTxs = (targetFolder.payload.transactions || []).filter(
    (t) => !deletedTxSet.has(t.id)
  );

  const accIdsWithRemainingTxs = new Set(
    remainingTxs.flatMap((t) => [t.accountId, t.toAccountId].filter(Boolean))
  );
  const catIdsWithRemainingTxs = new Set(
    remainingTxs.map((t) => t.categoryId).filter(Boolean)
  );
  const catNamesWithRemainingTxs = new Set(
    remainingTxs.map((t) => t.categoryName).filter(Boolean)
  );

  const remainingAccounts = (targetFolder.payload.accounts || []).filter((acc) => {
    if (deletedAccSet.has(acc.id)) return false;
    const hadTxs = (targetFolder.payload.transactions || []).some(
      (t) => t.accountId === acc.id || t.toAccountId === acc.id
    );
    if (hadTxs && !accIdsWithRemainingTxs.has(acc.id)) {
      return false;
    }
    return true;
  });

  const remainingCategories = (targetFolder.payload.categories || []).filter((cat) => {
    if (deletedCatSet.has(cat.id)) return false;
    const hadTxs = (targetFolder.payload.transactions || []).some(
      (t) => t.categoryId === cat.id || t.categoryName === cat.name
    );
    if (hadTxs && !catIdsWithRemainingTxs.has(cat.id) && !catNamesWithRemainingTxs.has(cat.name)) {
      return false;
    }
    return true;
  });

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: remainingAccounts.length + remainingCategories.length + remainingTxs.length,
    accounts: remainingAccounts,
    categories: remainingCategories,
    transactions: remainingTxs,
    payload: {
      accounts: remainingAccounts,
      categories: remainingCategories,
      transactions: remainingTxs,
    },
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  syncFolderToCloud(saved, true);
  return saved;
}

/**
 * Update Share Space settings (name, icon, description, permission)
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
  const cleanId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const folder = all.find((f) => normalizeShareId(f.id) === cleanId);
  if (!folder) return null;

  const nextName = updates.name?.trim() || folder.name;
  const updatedFolder: ShareFolder = {
    ...folder,
    name: nextName,
    accountName: nextName,
    icon: updates.icon?.trim() || folder.icon,
    description: updates.description !== undefined ? updates.description.trim() : folder.description,
    permission: updates.permission || folder.permission,
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  syncFolderToCloud(saved, true);
  return saved;
}

/**
 * Delete a Share Space permanently from local cache and canonical path shared_accounts/share_${space.id}
 */
export async function deleteShareFolder(folderId: string, _folderData?: ShareFolder): Promise<void> {
  const cleanShareId = normalizeShareId(folderId);
  if (!cleanShareId) return;

  removeSpaceFromOfflineQueue(cleanShareId);
  await dismissShareId(cleanShareId);
  purgeDeletedShareSpace(cleanShareId);
  lastSyncedFolderSignatures.delete(cleanShareId);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineShareDelete(cleanShareId);
    return;
  }

  const canonicalPath = getCanonicalSharePath(cleanShareId);
  try {
    await remove(ref(rtdb, canonicalPath));
  } catch (err) {
    // Fallback to tombstone if remove is restricted by security rules
    try {
      await set(ref(rtdb, canonicalPath), {
        id: cleanShareId,
        deleted: true,
        updatedAt: Date.now(),
        ownerUid: auth.currentUser?.uid || 'authenticated_user',
        accountName: 'Deleted',
        v3Schema: true,
      });
    } catch (e2) {
      console.warn(`[ShareFolders] Failed deleting ${canonicalPath}:`, e2);
      queueOfflineShareDelete(cleanShareId);
    }
  }
}

/**
 * Add a member to a Share Space by 16-Digit Numeric ID
 */
export async function addMemberToShareFolder(
  folderId: string,
  member16DigitId: string,
  memberName?: string,
  role: 'viewer' | 'editor' = 'viewer',
  memberAvatar?: string,
  memberPhotoURL?: string
): Promise<{ success: boolean; folder?: ShareFolder; error?: string; cloudSynced?: boolean }> {
  const cleanMemberId = normalize16DigitId(member16DigitId);
  if (cleanMemberId.length !== 16) {
    return { success: false, error: 'Invalid ID. Must be 16 digits.' };
  }

  const profileCard = await fetchUserProfileCard(cleanMemberId);
  const localContact = getKnownContact(cleanMemberId);

  const trimmedName = memberName?.trim();
  const resolvedName =
    trimmedName ||
    (profileCard?.name && profileCard.name !== 'User' ? profileCard.name : '') ||
    (localContact?.name && localContact.name !== 'User' ? localContact.name : '') ||
    `User ${format16DigitId(cleanMemberId).slice(0, 4)}`;

  const resolvedAvatar = memberAvatar || profileCard?.avatar || localContact?.avatar || '👤';
  const resolvedPhotoURL = memberPhotoURL || profileCard?.photoURL || localContact?.photoURL || '';

  saveKnownContact({
    numericId: cleanMemberId,
    name: resolvedName,
    avatar: resolvedAvatar,
    photoURL: resolvedPhotoURL,
    updatedAt: Date.now(),
  });

  const cleanFolderId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const folder = all.find((f) => normalizeShareId(f.id) === cleanFolderId);
  if (!folder) {
    return { success: false, error: 'Share page not found' };
  }

  if (folder.members.some((m) => normalize16DigitId(m.numericId) === cleanMemberId)) {
    return { success: false, error: 'Member is already added to this share' };
  }

  const newMember: ShareMember = {
    numericId: cleanMemberId,
    name: resolvedName,
    avatar: resolvedAvatar,
    photoURL: resolvedPhotoURL,
    role,
    status: 'active',
    addedAt: Date.now(),
  };

  const nextMembers = [...folder.members, newMember];
  const nextMember16Ids = extractMember16Ids({ ...folder, members: nextMembers });
  if (!nextMember16Ids.includes(cleanMemberId)) {
    nextMember16Ids.push(cleanMemberId);
  }

  const updatedFolder: ShareFolder = {
    ...folder,
    member16Ids: nextMember16Ids,
    members: nextMembers,
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);

  let cloudSynced = true;
  try {
    await syncFolderToCloud(saved, true);
  } catch (err) {
    console.warn('[ShareFolders] Cloud sync deferred on addMember:', err);
    cloudSynced = false;
  }

  return { success: true, folder: saved, cloudSynced };
}

/**
 * Update member details (custom nickname/name, role, or avatar)
 */
export async function updateMemberDetailsInShareFolder(
  folderId: string,
  member16DigitId: string,
  updates: { name?: string; role?: 'viewer' | 'editor'; avatar?: string; photoURL?: string }
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanMemberId = normalize16DigitId(member16DigitId);
  const cleanFolderId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const targetFolder = all.find((f) => normalizeShareId(f.id) === cleanFolderId);
  if (!targetFolder) return { success: false };

  const updatedMembers = targetFolder.members.map((m) => {
    if (normalize16DigitId(m.numericId) === cleanMemberId) {
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
    member16Ids: extractMember16Ids({ ...targetFolder, members: updatedMembers }),
    members: updatedMembers,
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);

  if (updates.name) {
    saveKnownContact({
      numericId: cleanMemberId,
      name: updates.name.trim(),
    });
  }

  await syncFolderToCloud(saved, true);
  return { success: true, folder: saved };
}

export async function updateMemberRoleInShareFolder(
  folderId: string,
  member16DigitId: string,
  role: 'viewer' | 'editor'
): Promise<{ success: boolean; folder?: ShareFolder }> {
  return updateMemberDetailsInShareFolder(folderId, member16DigitId, { role });
}

/**
 * Remove / Revoke a member from a Share Space
 */
export async function removeMemberFromShareFolder(
  folderId: string,
  member16DigitId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanMemberId = normalize16DigitId(member16DigitId);
  const cleanFolderId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const targetFolder = all.find((f) => normalizeShareId(f.id) === cleanFolderId);
  if (!targetFolder) return { success: false };

  const nextMembers = targetFolder.members.filter((m) => normalize16DigitId(m.numericId) !== cleanMemberId);
  const nextMember16Ids = extractMember16Ids({
    ...targetFolder,
    member16Ids: (targetFolder.member16Ids || []).filter((id) => normalize16DigitId(id) !== cleanMemberId),
    members: nextMembers,
  });

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    member16Ids: nextMember16Ids,
    members: nextMembers,
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  await syncFolderToCloud(saved, true);
  return { success: true, folder: saved };
}

/**
 * Remove all non-owner members from a Share Space at once
 */
export async function removeAllMembersFromShareFolder(
  folderId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanFolderId = normalizeShareId(folderId);
  const all = loadAllSpacesV3();
  const folder = all.find((f) => normalizeShareId(f.id) === cleanFolderId);
  if (!folder) return { success: false };

  const owner16 = normalize16DigitId(folder.owner16DigitId || folder.ownerNumericId);
  const ownerMembers = folder.members.filter((m) => normalize16DigitId(m.numericId) === owner16);

  const updatedFolder: ShareFolder = {
    ...folder,
    member16Ids: owner16 ? [owner16] : [],
    members: ownerMembers,
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);
  await syncFolderToCloud(saved, true);
  return { success: true, folder: saved };
}

/**
 * Accept a share invitation in "Shared With Me"
 */
export async function acceptShareInvitation(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const cleanFolderId = normalizeShareId(folderId);
  const cleanId = normalize16DigitId(my16DigitId);
  const all = loadAllSpacesV3();
  const target = all.find((f) => normalizeShareId(f.id) === cleanFolderId);
  if (!target) return;

  const updated: ShareFolder = {
    ...target,
    members: target.members.map((m) =>
      normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'active' as const } : m
    ),
    updatedAt: Date.now(),
  };

  const saved = upsertSpaceInV3Cache(updated);
  markShareIdsNotifiedPerm([saved.id]);
  await syncFolderToCloud(saved, true);
}

/**
 * Reject / Decline a share invitation
 */
export async function rejectShareInvitation(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const cleanId = normalize16DigitId(my16DigitId || cleanNumericId(getOrCreateNumericId()));
  await leaveShareFolder(folderId, cleanId);
}

/**
 * Leave a shared space from "Shared With Me"
 */
export async function leaveShareFolder(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const cleanId = normalize16DigitId(my16DigitId || cleanNumericId(getOrCreateNumericId()));
  const cleanShareId = normalizeShareId(folderId);
  if (!cleanShareId) return;

  await dismissShareId(cleanShareId, cleanId);
  purgeDeletedShareSpace(cleanShareId);

  try {
    const cloudRef = ref(rtdb, getCanonicalSharePath(cleanShareId));
    const snap = await get(cloudRef);
    if (snap.exists() && snap.val()) {
      const cloudFolder = snap.val();
      const nextMembers = (Array.isArray(cloudFolder.members) ? cloudFolder.members : []).filter(
        (m: any) => normalize16DigitId(m.numericId) !== cleanId
      );
      const nextMember16Ids = (Array.isArray(cloudFolder.member16Ids) ? cloudFolder.member16Ids : []).filter(
        (id: string) => normalize16DigitId(id) !== cleanId
      );
      await update(cloudRef, {
        members: nextMembers,
        member16Ids: nextMember16Ids,
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to update cloud folder members on leave:', err);
  }
}

/**
 * Send Share Space to a recipient's 16-digit ID
 */
export async function sendShareFolderToRecipient(
  folder: ShareFolder,
  recipient16DigitId: string,
  recipientName?: string,
  recipientAvatar?: string,
  recipientPhotoURL?: string
): Promise<{ success: boolean; folder?: ShareFolder; error?: string }> {
  upsertSpaceInV3Cache(folder);
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
 * Fetch a share space from Firebase RTDB by ID from canonical path shared_accounts/share_${space.id}
 */
export async function fetchShareFolderFromCloud(folderId: string): Promise<ShareFolder | null> {
  const cleanId = normalizeShareId(folderId);
  if (!cleanId) return null;

  try {
    return await withTimeout(
      (async () => {
        const snap = await get(ref(rtdb, getCanonicalSharePath(cleanId)));
        if (snap.exists() && snap.val()) {
          const val = snap.val();
          if (val.deleted === true) {
            purgeDeletedShareSpace(cleanId);
            return null;
          }
          const parsed = normalizeParsedShareFolder(val, cleanId);
          if (parsed) {
            const localMatch = loadAllSpacesV3().find((s) => normalizeShareId(s.id) === cleanId);
            if (localMatch && (localMatch.updatedAt || 0) > (parsed.updatedAt || 0)) {
              syncFolderToCloud(localMatch, true).catch(() => {});
              return localMatch;
            }
            upsertSpaceInV3Cache(parsed);
            return parsed;
          }
        }
        const localFallback = loadAllSpacesV3().find((s) => normalizeShareId(s.id) === cleanId);
        return localFallback || null;
      })(),
      6000,
      'Share fetch timed out'
    );
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch share folder from cloud:', err);
  }
  return loadAllSpacesV3().find((s) => normalizeShareId(s.id) === cleanId) || null;
}

/**
 * Real-time listener on a specific Share Space at canonical path shared_accounts/share_${space.id}
 */
export function subscribeToShareFolder(
  folderId: string,
  callback: (folder: ShareFolder | null) => void
): () => void {
  const cleanId = normalizeShareId(folderId);
  if (!cleanId) return () => {};

  const canonicalRef = ref(rtdb, getCanonicalSharePath(cleanId));
  let lastEmittedSig = '';

  const listener = (snap: any) => {
    if (isShareModalCurrentlyOpen()) return;
    if (snap.exists() && snap.val()) {
      const val = snap.val();
      if (val.deleted === true) {
        purgeDeletedShareSpace(cleanId);
        callback(null);
        return;
      }
      const parsed = normalizeParsedShareFolder(val, cleanId);
      if (parsed) {
        // Merge remote updates ONLY when remote.updatedAt > local.updatedAt
        const localMatch = loadAllSpacesV3().find((s) => normalizeShareId(s.id) === cleanId);
        const effectiveFolder =
          localMatch && (parsed.updatedAt || 0) <= (localMatch.updatedAt || 0)
            ? localMatch
            : parsed;

        if (
          localMatch &&
          (localMatch.updatedAt || 0) > (parsed.updatedAt || 0) &&
          typeof navigator !== 'undefined' &&
          navigator.onLine
        ) {
          syncFolderToCloud(localMatch, true).catch(() => {});
        }

        const sig = `${effectiveFolder.updatedAt}_${computeFolderContentSignature(effectiveFolder)}`;
        if (sig !== lastEmittedSig) {
          lastEmittedSig = sig;
          upsertSpaceInV3Cache(effectiveFolder);
          callback(effectiveFolder);
        }
      }
    } else {
      // If space is owned by current user and pending offline sync (or offline), preserve it
      const localMatch = loadAllSpacesV3().find((s) => normalizeShareId(s.id) === cleanId);
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (
        localMatch &&
        isSpaceOwnedByUser(localMatch) &&
        (!isOnline || isSpacePendingOfflineSync(cleanId))
      ) {
        if (isOnline) {
          syncFolderToCloud(localMatch, true).catch(() => {});
        }
        callback(localMatch);
        return;
      }
      purgeDeletedShareSpace(cleanId);
      callback(null);
    }
  };

  onValue(canonicalRef, listener, (err) => console.warn('[ShareFolders] subscribeToShareFolder error:', err));

  return () => {
    off(canonicalRef, 'value', listener);
  };
}

/**
 * Merges a cloud snapshot of `shared_accounts` with local `'mm_spaces_v3_cache'`,
 * preserving any offline-created owned spaces and syncing them up to Firebase.
 */
function reconcileCloudSharedAccountsSnapshot(
  sharedAccountsVal: any,
  myClean16Id: string,
  currentUid?: string
): { ownedSpaces: ShareFolder[]; receivedSpaces: ShareFolder[]; allSpaces: ShareFolder[] } {
  const { myUid, myClean16Id: resolved16 } = resolveCurrentIdentity(myClean16Id, currentUid);
  const dismissedIds = getDismissedShareIds();

  // Never overwrite local cache while a share creation or settings modal is open
  if (isShareModalCurrentlyOpen()) {
    const { myFolders, receivedFolders } = repairAndMigrateSharedSpaces(resolved16, myUid);
    return {
      ownedSpaces: myFolders,
      receivedSpaces: receivedFolders,
      allSpaces: [...myFolders, ...receivedFolders],
    };
  }

  const cloudOwnedMap = new Map<string, ShareFolder>();
  const cloudReceivedMap = new Map<string, ShareFolder>();
  const deletedCloudIds = new Set<string>();

  if (sharedAccountsVal && typeof sharedAccountsVal === 'object') {
    for (const [key, rawVal] of Object.entries(sharedAccountsVal)) {
      if (!key.startsWith('share_')) continue;
      if (!rawVal || typeof rawVal !== 'object') continue;
      const val = rawVal as any;
      const cleanSid = normalizeShareId(val.id || key);
      if (!cleanSid) continue;

      if (val.deleted === true) {
        deletedCloudIds.add(cleanSid);
        continue;
      }
      if (dismissedIds.has(cleanSid)) continue;

      const parsed = normalizeParsedShareFolder(val, cleanSid);
      if (!parsed) continue;

      if (isSpaceOwnedByUser(parsed, resolved16, myUid)) {
        cloudOwnedMap.set(cleanSid, { ...parsed, isCreatedByMe: true, isReceivedShare: false });
      } else if (isSpaceSharedWithUser(parsed, resolved16, myUid)) {
        cloudReceivedMap.set(cleanSid, { ...parsed, isCreatedByMe: false, isReceivedShare: true });
      }
    }
  }

  // Merge with local 'mm_spaces_v3_cache':
  // - Only apply remote updates when remote.updatedAt > local.updatedAt
  // - Preserve offline-created/modified owned spaces and push them to cloud when online
  const localSpaces = loadAllSpacesV3();
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  for (const localSpace of localSpaces) {
    const cleanSid = normalizeShareId(localSpace.id);
    if (!cleanSid || deletedCloudIds.has(cleanSid) || dismissedIds.has(cleanSid)) continue;

    if (isSpaceOwnedByUser(localSpace, resolved16, myUid)) {
      const cloudVer = cloudOwnedMap.get(cleanSid);
      if (!cloudVer) {
        // Owned space exists locally on device: keep it if offline, pending offline sync, or created by me
        if (!isOnline || isSpacePendingOfflineSync(cleanSid) || isShareCreatedByMe(cleanSid)) {
          cloudOwnedMap.set(cleanSid, { ...localSpace, isCreatedByMe: true, isReceivedShare: false });
          if (isOnline) {
            syncFolderToCloud(localSpace, true).catch(() => {});
          }
        }
      } else if ((cloudVer.updatedAt || 0) <= (localSpace.updatedAt || 0)) {
        // Only merge remote when remote.updatedAt > local.updatedAt; otherwise keep localSpace
        cloudOwnedMap.set(cleanSid, { ...localSpace, isCreatedByMe: true, isReceivedShare: false });
        if (isOnline && (localSpace.updatedAt || 0) > (cloudVer.updatedAt || 0)) {
          syncFolderToCloud(localSpace, true).catch(() => {});
        }
      }
    } else if (isSpaceSharedWithUser(localSpace, resolved16, myUid)) {
      const cloudVer = cloudReceivedMap.get(cleanSid);
      if (cloudVer && (cloudVer.updatedAt || 0) <= (localSpace.updatedAt || 0)) {
        // Only merge remote when remote.updatedAt > local.updatedAt
        cloudReceivedMap.set(cleanSid, { ...localSpace, isCreatedByMe: false, isReceivedShare: true });
        if (isOnline && (localSpace.updatedAt || 0) > (cloudVer.updatedAt || 0)) {
          syncFolderToCloud(localSpace, true).catch(() => {});
        }
      }
    }
  }

  const ownedSpaces = Array.from(cloudOwnedMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const receivedSpaces = Array.from(cloudReceivedMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const allSpaces = [...ownedSpaces, ...receivedSpaces];

  saveAllSpacesV3(allSpaces);
  return { ownedSpaces, receivedSpaces, allSpaces };
}

/**
 * Single-shot fetch of user's spaces from the unified Firebase RTDB `shared_accounts` collection
 */
export async function fetchMyInboxOnce(my16DigitId: string): Promise<ShareFolder[]> {
  await executeOneTimeV3ShareCleanReset();
  const cleanId = normalize16DigitId(my16DigitId || getOrCreateNumericId());
  if (cleanId.length !== 16) return loadReceivedShareFolders();

  try {
    const snap = await get(ref(rtdb, 'shared_accounts'));
    const val = snap.exists() ? snap.val() : {};
    const { receivedSpaces, allSpaces } = reconcileCloudSharedAccountsSnapshot(val, cleanId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: allSpaces }));
      window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: receivedSpaces }));
    }
    return receivedSpaces;
  } catch (err) {
    console.warn('[ShareFolders] fetchMyInboxOnce error:', err);
    return loadReceivedShareFolders();
  }
}

/**
 * Real-time event-driven listener on unified `shared_accounts` collection.
 * Automatically reconciles owned ("Shared by Me") and joined ("Shared with Me") spaces
 * into `'mm_spaces_v3_cache'` and emits incoming shares to the callback.
 */
export function subscribeToMyInbox(
  my16DigitId: string,
  callback: (folders: ShareFolder[]) => void
): () => void {
  executeOneTimeV3ShareCleanReset().catch(() => {});
  const cleanId = normalize16DigitId(my16DigitId || getOrCreateNumericId());
  if (cleanId.length !== 16) return () => {};

  const sharedAccountsRef = ref(rtdb, 'shared_accounts');
  let lastEmittedSig = '';

  const listener = (snapshot: any) => {
    if (isShareModalCurrentlyOpen()) return;
    const val = snapshot.exists() && snapshot.val() ? snapshot.val() : {};
    const { receivedSpaces, allSpaces } = reconcileCloudSharedAccountsSnapshot(val, cleanId);

    const sig = allSpaces.map((s) => `${s.id}_${s.updatedAt || 0}_${s.members?.length || 0}`).join('|');
    if (sig !== lastEmittedSig) {
      lastEmittedSig = sig;
      callback(receivedSpaces);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: allSpaces }));
        window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: receivedSpaces }));
      }
    }
  };

  onValue(sharedAccountsRef, listener, (err) => {
    console.warn('[ShareFolders] shared_accounts onValue subscription error:', err);
  });

  return () => {
    off(sharedAccountsRef, 'value', listener);
  };
}

export const listenToMyNumericIdInbox = subscribeToMyInbox;

/**
 * Generate clean, live, dynamic public web share URL with fallback data snapshot
 */
export function generateShareUrl(folder: ShareFolder): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const cleanId = normalizeShareId(folder.id);
  const snapshotB64 = encodeShareSnapshot(folder);
  if (snapshotB64) {
    return `${base}?share=${encodeURIComponent(cleanId)}&data=${snapshotB64}`;
  }
  return `${base}?share=${encodeURIComponent(cleanId)}`;
}
