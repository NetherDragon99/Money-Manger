import { useState, useEffect, useMemo, useRef } from 'react';
import { rtdb, auth, getCachedAuthUser } from './firebase';
import { ref, set, get, remove, onValue, off, update, onChildAdded, onChildChanged, onChildRemoved } from 'firebase/database';
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
  invitedAt?: number;
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
  leftSpaces?: Record<string, number>;
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

export const MY_OWNED_SPACES_KEY = 'mm_my_owned_spaces';
export const RECEIVED_SPACES_KEY = 'mm_received_spaces';
export const SPACES_V3_CACHE_KEY = 'mm_spaces_v3_cache';
export const SHARE_V3_CLEAN_RESET_KEY = 'mm_share_v3_clean_reset';
export const SHARE_V3_CLOUD_PURGE_KEY = 'mm_share_v3_cloud_purge_done';
export const NOTIFIED_SHARE_IDS_FOREVER_KEY = 'mm_notified_share_ids_forever';
export const NOTIFIED_SHARE_TIMESTAMPS_KEY = 'mm_notified_share_timestamps';
export const NOTIFIED_SHARES_V3_KEY = 'mm_notified_shares_v3';
export const CLOUD_SLOTS_COUNT = 10;
const STORAGE_KNOWN_CONTACTS_KEY = 'pwa_finance_known_contacts_v1';

export const SEEN_NOTIFICATIONS_STORAGE_KEY = 'mm_seen_share_notifications';
export const PERMANENT_NOTIFIED_SHARE_IDS_KEY = 'mm_notified_share_ids_perm';
export const MY_CREATED_SHARE_IDS_KEY = 'mm_my_created_share_ids';
export const DISMISSED_SHARE_TIMESTAMPS_KEY = 'mm_dismissed_share_timestamps';
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
 * Safe startup migration into 'mm_my_owned_spaces' and 'mm_received_spaces'.
 * Never reads the root 'shared_accounts' collection (which is rejected by Firebase RTDB security rules).
 */
export async function executeOneTimeV3ShareCleanReset(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    const hasOwnedKey = localStorage.getItem(MY_OWNED_SPACES_KEY) !== null;
    const hasReceivedKey = localStorage.getItem(RECEIVED_SPACES_KEY) !== null;
    if (!hasOwnedKey || !hasReceivedKey) {
      const { myClean16Id } = resolveCurrentIdentity();
      const rawV3 = localStorage.getItem(SPACES_V3_CACHE_KEY);
      const rawLegacyOwned = localStorage.getItem('pwa_finance_share_folders_v3');
      const rawLegacyReceived = localStorage.getItem('pwa_finance_received_share_folders_v3');

      const ownedMap = new Map<string, any>();
      const receivedMap = new Map<string, any>();

      const ingestList = (rawStr: string | null) => {
        if (!rawStr) return;
        try {
          const arr = JSON.parse(rawStr);
          if (!Array.isArray(arr)) return;
          for (const item of arr) {
            if (!item || !item.id || item.deleted === true) continue;
            const cleanId = normalizeShareId(item.id);
            if (!cleanId) continue;
            const owner16 = normalize16DigitId(item.owner16DigitId || item.ownerNumericId);
            if (myClean16Id && owner16 && owner16 === myClean16Id) {
              ownedMap.set(cleanId, { ...item, id: cleanId, isCreatedByMe: true, isReceivedShare: false });
            } else if (owner16 && myClean16Id && owner16 !== myClean16Id) {
              receivedMap.set(cleanId, { ...item, id: cleanId, isCreatedByMe: false, isReceivedShare: true });
            } else if (item.isCreatedByMe === true && item.isReceivedShare !== true) {
              ownedMap.set(cleanId, { ...item, id: cleanId, isCreatedByMe: true, isReceivedShare: false });
            } else if (item.isReceivedShare === true) {
              receivedMap.set(cleanId, { ...item, id: cleanId, isCreatedByMe: false, isReceivedShare: true });
            }
          }
        } catch {}
      };

      ingestList(rawLegacyOwned);
      ingestList(rawLegacyReceived);
      ingestList(rawV3);

      if (!hasOwnedKey) {
        localStorage.setItem(MY_OWNED_SPACES_KEY, JSON.stringify(Array.from(ownedMap.values())));
      }
      if (!hasReceivedKey) {
        localStorage.setItem(RECEIVED_SPACES_KEY, JSON.stringify(Array.from(receivedMap.values())));
      }
    }
    localStorage.setItem(SHARE_V3_CLEAN_RESET_KEY, 'true');
  } catch (err) {
    console.warn('[ShareFolders] Storage migration note:', err);
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
      const rawSettings = localStorage.getItem('pwa_finance_settings_v1') || localStorage.getItem('pwa_finance_settings');
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
 * cleanId(space.owner16DigitId) === myClean16Id
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

  if (resolved16 && resolved16.length === 16 && spaceOwner16 && spaceOwner16.length === 16) {
    return spaceOwner16 === resolved16;
  }
  if (myUid && spaceOwnerUid && spaceOwnerUid === myUid && space.isReceivedShare !== true) {
    return true;
  }
  return false;
}

/**
 * Strict UI & Cache Sorting Rule 2:
 * Returns true if the space belongs in "Shared with Me":
 * cleanId(space.owner16DigitId) !== myClean16Id
 */
export function isSpaceSharedWithUser(
  space: Partial<ShareFolder> | null | undefined,
  myClean16Id?: string,
  currentUserUid?: string
): boolean {
  if (!space) return false;
  const { myUid, myClean16Id: resolved16 } = resolveCurrentIdentity(myClean16Id, currentUserUid);
  if (!resolved16 || resolved16.length !== 16) return false;

  const spaceOwner16 = normalize16DigitId(space.owner16DigitId || space.ownerNumericId);
  if (spaceOwner16 && spaceOwner16.length === 16) {
    return spaceOwner16 !== resolved16;
  }

  if (isSpaceOwnedByUser(space, resolved16, myUid)) {
    return false;
  }

  return true;
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
 * Load all cached spaces from 'mm_my_owned_spaces' and 'mm_received_spaces'
 */
export function loadAllSpacesV3(): ShareFolder[] {
  if (typeof localStorage === 'undefined') return [];
  if (
    localStorage.getItem(MY_OWNED_SPACES_KEY) === null &&
    localStorage.getItem(RECEIVED_SPACES_KEY) === null
  ) {
    executeOneTimeV3ShareCleanReset().catch(() => {});
  }
  const owned = loadMyShareFolders();
  const received = loadReceivedShareFolders();
  const map = new Map<string, ShareFolder>();
  for (const s of [...owned, ...received]) {
    if (s && s.id) {
      map.set(normalizeShareId(s.id), s);
    }
  }
  const result = Array.from(map.values());
  result.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return result;
}

/**
 * Save spaces by partitioning strictly into 'mm_my_owned_spaces' and 'mm_received_spaces'
 */
export function saveAllSpacesV3(spaces: ShareFolder[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const owned: ShareFolder[] = [];
    const received: ShareFolder[] = [];
    const dismissed = getDismissedShareIds();

    for (const s of spaces || []) {
      if (!s || !s.id || s.deleted === true) continue;
      const cleanId = normalizeShareId(s.id);
      if (!cleanId || dismissed.has(cleanId)) continue;
      const normalized = normalizeParsedShareFolder(s, cleanId);
      if (!normalized) continue;

      if (isSpaceOwnedByUser(normalized)) {
        owned.push({ ...normalized, isCreatedByMe: true, isReceivedShare: false });
      } else {
        received.push({ ...normalized, isCreatedByMe: false, isReceivedShare: true });
      }
    }

    saveMyShareFolders(owned);
    saveReceivedShareFolders(received);
    localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify([...owned, ...received]));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save spaces:', err);
  }
}

/**
 * Immediately upserts a single space into 'mm_my_owned_spaces' or 'mm_received_spaces'
 */
export function upsertSpaceInV3Cache(space: ShareFolder): ShareFolder {
  const cleanId = normalizeShareId(space.id);
  const ownedList = loadMyShareFolders();
  const receivedList = loadReceivedShareFolders();
  const existing =
    ownedList.find((s) => normalizeShareId(s.id) === cleanId) ||
    receivedList.find((s) => normalizeShareId(s.id) === cleanId);

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

  if (isSpaceOwnedByUser(normalized)) {
    const nextOwned = [
      { ...normalized, isCreatedByMe: true, isReceivedShare: false },
      ...ownedList.filter((s) => normalizeShareId(s.id) !== cleanId),
    ];
    saveMyShareFolders(nextOwned);
    const cleanedRec = receivedList.filter((s) => normalizeShareId(s.id) !== cleanId);
    if (cleanedRec.length !== receivedList.length) {
      saveReceivedShareFolders(cleanedRec);
    }
  } else {
    const nextReceived = [
      { ...normalized, isCreatedByMe: false, isReceivedShare: true },
      ...receivedList.filter((s) => normalizeShareId(s.id) !== cleanId),
    ];
    saveReceivedShareFolders(nextReceived);
    const cleanedOwned = ownedList.filter((s) => normalizeShareId(s.id) !== cleanId);
    if (cleanedOwned.length !== ownedList.length) {
      saveMyShareFolders(cleanedOwned);
    }
  }

  const allNext = [...loadMyShareFolders(), ...loadReceivedShareFolders()];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify(allNext));
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: allNext }));
  }
  return normalized;
}

const STORAGE_REMOVED_CONTACTS_KEY = 'mm_removed_contacts_v1';

export function getRemovedContactIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_REMOVED_CONTACTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function saveRemovedContactIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_REMOVED_CONTACTS_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

/**
 * Manually removes a contact from the saved directory by 16-digit ID.
 */
export function removeKnownContact(numericId: string): void {
  try {
    const cleanId = normalize16DigitId(numericId);
    if (!cleanId) return;
    const contacts = loadKnownContacts();
    delete contacts[cleanId];
    localStorage.setItem(STORAGE_KNOWN_CONTACTS_KEY, JSON.stringify(contacts));

    const removed = getRemovedContactIds();
    removed.add(cleanId);
    saveRemovedContactIds(removed);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('known_contacts_updated', { detail: { removedId: cleanId } }));
    }
  } catch (e) {
    console.warn('[ShareFolders] Failed to remove contact:', e);
  }
}

/**
 * Load locally cached known contacts (16-digit ID -> UserProfileCard), strictly keyed & deduplicated by 16-digit ID.
 */
export function loadKnownContacts(): Record<string, UserProfileCard> {
  try {
    const raw = localStorage.getItem(STORAGE_KNOWN_CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const normalized: Record<string, UserProfileCard> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (!val || typeof val !== 'object') continue;
      const cleanId = normalize16DigitId((val as any).numericId || key);
      if (cleanId.length === 16) {
        const rawPhoto = (val as any).photoURL || '';
        const cleanPhoto = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
        const cleanAvatar = (val as any).avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤');
        const existing = normalized[cleanId];
        const valUpdated = (val as any).updatedAt || 0;
        const existUpdated = existing?.updatedAt || 0;
        if (!existing || valUpdated >= existUpdated) {
          normalized[cleanId] = {
            numericId: cleanId,
            name: (val as any).name || existing?.name || `User ${cleanId.slice(0, 4)}`,
            avatar: cleanAvatar,
            photoURL: cleanPhoto,
            uid: (val as any).uid || existing?.uid,
            updatedAt: valUpdated || Date.now(),
          };
        }
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

/**
 * Safely verify if a string is a valid image URL (http, https, data:image, blob:)
 * rather than an emoji avatar or placeholder string.
 */
export function isRealPhotoUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Save / Cache a known contact locally, strictly keyed by unique 16-digit ID
 */
export function saveKnownContact(contact: Partial<UserProfileCard> & { numericId: string }): void {
  try {
    const cleanId = normalize16DigitId(contact.numericId);
    if (cleanId.length !== 16) return;
    const contacts = loadKnownContacts();
    const rawPhoto = contact.photoURL !== undefined ? contact.photoURL : (contacts[cleanId]?.photoURL || '');
    const cleanPhoto = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
    const cleanAvatar = contact.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : (contacts[cleanId]?.avatar || '👤'));
    contacts[cleanId] = {
      numericId: cleanId,
      name: contact.name || contacts[cleanId]?.name || `User ${cleanId.slice(0, 4)}`,
      avatar: cleanAvatar,
      photoURL: cleanPhoto,
      updatedAt: Date.now(),
      uid: contact.uid || contacts[cleanId]?.uid,
    };
    localStorage.setItem(STORAGE_KNOWN_CONTACTS_KEY, JSON.stringify(contacts));

    // Clear from removed set if re-saved
    const removed = getRemovedContactIds();
    if (removed.has(cleanId)) {
      removed.delete(cleanId);
      saveRemovedContactIds(removed);
    }
  } catch (e) {
    console.warn('[ShareFolders] Failed to save contact:', e);
  }
}

/**
 * Loads all saved and previously invited contacts, strictly deduplicated by unique 16-digit ID.
 * Merges contacts from localStorage with members from all user spaces,
 * excluding the current user and any manually removed IDs.
 */
export function loadDeduplicatedContacts(excludeId?: string): UserProfileCard[] {
  const cleanExclude = normalize16DigitId(excludeId || '');
  const removedSet = getRemovedContactIds();
  const contactsMap = loadKnownContacts();
  const map = new Map<string, UserProfileCard>();

  // 1. Ingest from contactsMap
  for (const [rawId, card] of Object.entries(contactsMap)) {
    const clean = normalize16DigitId(card.numericId || rawId);
    if (clean.length === 16 && clean !== cleanExclude && !removedSet.has(clean)) {
      const rawPhoto = card.photoURL || '';
      map.set(clean, {
        numericId: clean,
        name: card.name || `User ${clean.slice(0, 4)}`,
        avatar: card.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤'),
        photoURL: isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '',
        uid: card.uid,
        updatedAt: card.updatedAt || 0,
      });
    }
  }

  // 2. Ingest members from all current and historical spaces
  const allSpaces = loadAllSpacesV3();
  for (const space of allSpaces) {
    const owner16 = normalize16DigitId(space.owner16DigitId || space.ownerNumericId);
    if (owner16.length === 16 && owner16 !== cleanExclude && !removedSet.has(owner16)) {
      if (!map.has(owner16)) {
        const rawPhoto = space.ownerPhotoURL || '';
        map.set(owner16, {
          numericId: owner16,
          name: space.ownerName || `User ${owner16.slice(0, 4)}`,
          avatar: space.ownerAvatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤'),
          photoURL: isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '',
          uid: space.ownerUid,
          updatedAt: space.updatedAt || 0,
        });
      }
    }

    for (const m of space.members || []) {
      const mid = normalize16DigitId(m.numericId);
      if (mid.length === 16 && mid !== cleanExclude && !removedSet.has(mid)) {
        if (!map.has(mid)) {
          const rawPhoto = m.photoURL || '';
          map.set(mid, {
            numericId: mid,
            name: m.name || `User ${mid.slice(0, 4)}`,
            avatar: m.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤'),
            photoURL: isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '',
            uid: (m as any).uid,
            updatedAt: m.addedAt || m.invitedAt || space.updatedAt || 0,
          });
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Asynchronously verifies contacts against Firebase RTDB in parallel.
 * If a contact definitely does not exist on the server (snap.exists() === false),
 * it is pruned from local storage and from the active list.
 */
export async function pruneStaleContacts(
  contacts: UserProfileCard[],
  onPruned?: (prunedId: string) => void
): Promise<UserProfileCard[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return contacts;
  }

  const remaining: UserProfileCard[] = [];

  await Promise.all(
    contacts.map(async (contact) => {
      const cleanId = normalize16DigitId(contact.numericId);
      if (cleanId.length !== 16) return;

      try {
        const [profileSnap, numSnap] = await Promise.all([
          withTimeout(get(ref(rtdb, `shared_accounts/profile_${cleanId}`)), 3000).catch(() => null),
          withTimeout(get(ref(rtdb, `numericIds/${cleanId}`)), 3000).catch(() => null),
        ]);

        if (profileSnap?.exists() || numSnap?.exists()) {
          remaining.push(contact);
          return;
        }

        if (profileSnap !== null && numSnap !== null && !profileSnap.exists() && !numSnap.exists()) {
          console.info(`[ShareFolders] Pruning stale contact whose profile no longer exists on server: ${cleanId}`);
          removeKnownContact(cleanId);
          onPruned?.(cleanId);
          return;
        }

        remaining.push(contact);
      } catch {
        remaining.push(contact);
      }
    })
  );

  return remaining;
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
  if (folder?.ownerPhotoURL && isRealPhotoUrl(folder.ownerPhotoURL)) {
    return folder.ownerPhotoURL.trim();
  }
  if (folder?.ownerAvatar && isRealPhotoUrl(folder.ownerAvatar)) {
    return folder.ownerAvatar.trim();
  }
  const owner16 = normalize16DigitId(folder?.owner16DigitId || folder?.ownerNumericId);
  const myClean16 = currentProfile?.numericId ? normalize16DigitId(currentProfile.numericId) : '';
  const myUid = currentProfile?.uid || auth.currentUser?.uid || '';
  const isCurrentOwner = (owner16 && myClean16 && owner16 === myClean16) || Boolean(folder?.ownerUid && myUid && folder.ownerUid === myUid);

  if (isCurrentOwner && currentProfile) {
    const profPhoto = currentProfile.customAvatarUrl || currentProfile.photoURL || currentProfile.avatar || '';
    if (isRealPhotoUrl(profPhoto)) return profPhoto.trim();
  }
  if (owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL && isRealPhotoUrl(cached.photoURL)) {
      return cached.photoURL.trim();
    }
  }
  if (isCurrentOwner && auth.currentUser?.photoURL && isRealPhotoUrl(auth.currentUser.photoURL)) {
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

  const currentUid = auth.currentUser?.uid || profile.uid || `anon_${clean16Id}`;
  const userName = (profile.name || auth.currentUser?.displayName || 'User').trim();
  const rawPhoto = profile.photoURL || auth.currentUser?.photoURL || '';
  const photoURL = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
  const avatarEmoji = profile.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤');

  saveKnownContact({
    numericId: clean16Id,
    name: userName,
    avatar: avatarEmoji,
    photoURL: photoURL,
    uid: currentUid,
    driveAccessGranted: profile.driveAccessGranted,
    drivePromptResolved: profile.drivePromptResolved,
  });

  const cardData: any = {
    ownerUid: currentUid,
    accountName: (userName || 'User').slice(0, 100),
    updatedAt: Date.now(),
    numericId: clean16Id,
    name: userName,
    photoURL: photoURL,
    avatar: avatarEmoji,
    uid: currentUid,
  };
  if (typeof profile.driveAccessGranted === 'boolean') {
    cardData.driveAccessGranted = profile.driveAccessGranted;
  }
  if (typeof profile.drivePromptResolved === 'boolean') {
    cardData.drivePromptResolved = profile.drivePromptResolved;
  }

  try {
    await update(ref(rtdb, `shared_accounts/profile_${clean16Id}`), JSON.parse(JSON.stringify(cardData)));
  } catch (err) {
    console.warn('[ShareFolders] Failed to publish user profile card to RTDB:', err);
  }

  if (auth.currentUser?.uid || profile.uid) {
    const realUid = auth.currentUser?.uid || profile.uid!;
    try {
      const userProfileUpdates: any = {
        numeric16Id: clean16Id,
        numericId: clean16Id,
        name: userName,
        photoURL: photoURL,
        avatar: avatarEmoji,
        updatedAt: Date.now(),
      };
      if (typeof profile.driveAccessGranted === 'boolean') {
        userProfileUpdates.driveAccessGranted = profile.driveAccessGranted;
      }
      if (typeof profile.drivePromptResolved === 'boolean') {
        userProfileUpdates.drivePromptResolved = profile.drivePromptResolved;
      }
      await update(ref(rtdb, `users/${realUid}/profile`), deepSanitizeForFirebase(userProfileUpdates));
      await set(ref(rtdb, `users/${realUid}/numeric16Id`), clean16Id);
    } catch (err) {
      console.warn('[ShareFolders] Failed to save numeric16Id under users/profile in RTDB:', err);
    }
  }

  try {
    await set(ref(rtdb, `numericIds/${clean16Id}`), deepSanitizeForFirebase({
      uid: currentUid,
      displayName: userName,
      name: userName,
      photoURL: photoURL,
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
      photoURL: photoURL,
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
  const rawPhoto = profile.photoURL || '';
  const photoURL = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
  const avatarEmoji = profile.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤');

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
      const isOwner = isSpaceOwnedByUser(space, clean16Id, currentUid);
      const isMember = (space.members || []).some((m) => normalize16DigitId(m.numericId) === clean16Id);
      if (!isOwner && !isMember) continue;

      const spaceId = space.id;
      if (!spaceId) continue;

      if (isOwner) {
        update(ref(rtdb, `shared_accounts/share_${spaceId}`), deepSanitizeForFirebase({
          ownerName: userName,
          ownerAvatar: avatarEmoji,
          ownerPhotoURL: photoURL,
          members: space.members || [],
          updatedAt: Date.now(),
        })).catch((err) => console.warn(`[ShareFolders] Failed to push owner profile update for share_${spaceId}:`, err));
      } else {
        const memberIdx = (space.members || []).findIndex((m) => normalize16DigitId(m.numericId) === clean16Id);
        if (memberIdx !== -1) {
          update(ref(rtdb, `shared_accounts/share_${spaceId}/members/${memberIdx}`), deepSanitizeForFirebase({
            name: userName,
            avatar: avatarEmoji,
            photoURL: photoURL,
          })).catch((err) => console.warn(`[ShareFolders] Failed to update member profile in share_${spaceId}:`, err));
        }
      }
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
      const rawPhoto = val.photoURL || '';
      const photoURL = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
      const avatar = val.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤');
      const card: UserProfileCard = {
        numericId: clean16Id,
        name: val.name || val.accountName || `User ${clean16Id.slice(0, 4)}`,
        avatar,
        photoURL,
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

  // 3. Server queries completed without a match:
  // If online, the account was deleted or does not exist on the server -> prune from cache
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    removeKnownContact(clean16Id);
    return null;
  }

  // Fallback check only if offline or network unreachable
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
 * Load user's owned Share Spaces ("Shared by Me") from localStorage ('mm_my_owned_spaces')
 * Filtered strictly by: cleanId(space.owner16DigitId) === myClean16Id
 */
export function loadMyShareFolders(): ShareFolder[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    let raw = localStorage.getItem(MY_OWNED_SPACES_KEY);
    if (raw === null) {
      executeOneTimeV3ShareCleanReset().catch(() => {});
      raw = localStorage.getItem(MY_OWNED_SPACES_KEY) || localStorage.getItem(SPACES_V3_CACHE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const dismissed = getDismissedShareIds();
    const map = new Map<string, ShareFolder>();
    for (const item of parsed) {
      if (!item || item.deleted === true) continue;
      const norm = normalizeParsedShareFolder(item, item.id);
      if (norm && !dismissed.has(normalizeShareId(norm.id)) && isSpaceOwnedByUser(norm)) {
        map.set(normalizeShareId(norm.id), { ...norm, isCreatedByMe: true, isReceivedShare: false });
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return list;
  } catch {
    return [];
  }
}

/**
 * Persist user's owned Share Spaces into localStorage ('mm_my_owned_spaces')
 */
export function saveMyShareFolders(folders: ShareFolder[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const dismissed = getDismissedShareIds();
    const map = new Map<string, ShareFolder>();
    const ownedIds: string[] = [];
    for (const f of folders || []) {
      if (!f || !f.id || f.deleted === true) continue;
      const cleanId = normalizeShareId(f.id);
      if (!cleanId || dismissed.has(cleanId)) continue;
      const norm = normalizeParsedShareFolder(f, cleanId);
      if (norm && isSpaceOwnedByUser(norm)) {
        map.set(cleanId, { ...norm, isCreatedByMe: true, isReceivedShare: false });
        ownedIds.push(cleanId);
      }
    }
    if (ownedIds.length > 0) {
      markShareIdsNotifiedForever(ownedIds);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    localStorage.setItem(MY_OWNED_SPACES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save mm_my_owned_spaces:', err);
  }
}

/**
 * Load received Share Spaces ("Shared with Me") from localStorage ('mm_received_spaces')
 * Filtered strictly by: cleanId(space.owner16DigitId) !== myClean16Id
 */
export function loadReceivedShareFolders(): ShareFolder[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    let raw = localStorage.getItem(RECEIVED_SPACES_KEY);
    if (raw === null) {
      executeOneTimeV3ShareCleanReset().catch(() => {});
      raw = localStorage.getItem(RECEIVED_SPACES_KEY) || localStorage.getItem(SPACES_V3_CACHE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const dismissed = getDismissedShareIds();
    const map = new Map<string, ShareFolder>();
    for (const item of parsed) {
      if (!item || item.deleted === true) continue;
      const norm = normalizeParsedShareFolder(item, item.id);
      if (norm && !dismissed.has(normalizeShareId(norm.id)) && isSpaceSharedWithUser(norm)) {
        map.set(normalizeShareId(norm.id), { ...norm, isCreatedByMe: false, isReceivedShare: true });
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return list;
  } catch {
    return [];
  }
}

/**
 * Persist received Share Spaces into localStorage ('mm_received_spaces')
 */
export function saveReceivedShareFolders(folders: ShareFolder[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const dismissed = getDismissedShareIds();
    const map = new Map<string, ShareFolder>();
    for (const f of folders || []) {
      if (!f || !f.id || f.deleted === true) continue;
      const cleanId = normalizeShareId(f.id);
      if (!cleanId || dismissed.has(cleanId)) continue;
      const norm = normalizeParsedShareFolder(f, cleanId);
      if (norm && isSpaceSharedWithUser(norm)) {
        map.set(cleanId, { ...norm, isCreatedByMe: false, isReceivedShare: true });
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    localStorage.setItem(RECEIVED_SPACES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save mm_received_spaces:', err);
  }
}

const inMemoryNotifiedSharesForever = new Set<string>();
const inMemoryNotifiedShareTimestamps = new Map<string, number>();
const cloudNotifiedSharesCache = new Set<string>();
const inFlightNotificationLocks = new Set<string>();
let cloudNotifiedHydratedForUid: string | null = null;
let hasMigratedForeverRegistry = false;

export function getNotifiedShareTimestamps(): Record<string, number> {
  if (typeof localStorage === 'undefined') {
    const res: Record<string, number> = {};
    inMemoryNotifiedShareTimestamps.forEach((v, k) => {
      res[k] = v;
    });
    return res;
  }
  try {
    const raw = localStorage.getItem(NOTIFIED_SHARE_TIMESTAMPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === 'number') inMemoryNotifiedShareTimestamps.set(k, v);
        });
        return parsed;
      }
    }
  } catch {}
  const res: Record<string, number> = {};
  inMemoryNotifiedShareTimestamps.forEach((v, k) => {
    res[k] = v;
  });
  return res;
}

export function saveNotifiedShareTimestamps(map: Record<string, number>): void {
  Object.entries(map).forEach(([k, v]) => {
    if (typeof v === 'number') inMemoryNotifiedShareTimestamps.set(k, v);
  });
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NOTIFIED_SHARE_TIMESTAMPS_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Loads the permanent Set of notified share IDs from localStorage ('mm_notified_share_ids_forever'
 * plus legacy 'mm_notified_shares_v3' and 'mm_notified_share_ids_perm').
 * All IDs are normalized without 'share_' prefix.
 */
export function getNotifiedShareIdsForever(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set(inMemoryNotifiedSharesForever);
  try {
    const rawForever = localStorage.getItem(NOTIFIED_SHARE_IDS_FOREVER_KEY);
    if (rawForever) {
      const parsed = JSON.parse(rawForever);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const clean = normalizeShareId(item);
          if (clean) inMemoryNotifiedSharesForever.add(clean);
        }
      }
    }

    if (!hasMigratedForeverRegistry) {
      hasMigratedForeverRegistry = true;
      let addedFromLegacy = false;
      for (const legacyKey of [NOTIFIED_SHARES_V3_KEY, PERMANENT_NOTIFIED_SHARE_IDS_KEY, MY_CREATED_SHARE_IDS_KEY]) {
        const rawLeg = localStorage.getItem(legacyKey);
        if (rawLeg) {
          try {
            const parsedLeg = JSON.parse(rawLeg);
            if (Array.isArray(parsedLeg)) {
              for (const item of parsedLeg) {
                const clean = normalizeShareId(item);
                if (clean && !inMemoryNotifiedSharesForever.has(clean)) {
                  inMemoryNotifiedSharesForever.add(clean);
                  addedFromLegacy = true;
                }
              }
            }
          } catch {}
        }
      }
      if (addedFromLegacy || rawForever === null) {
        const list = Array.from(inMemoryNotifiedSharesForever).slice(-1000);
        localStorage.setItem(NOTIFIED_SHARE_IDS_FOREVER_KEY, JSON.stringify(list));
      }
    }
  } catch {}
  return new Set(inMemoryNotifiedSharesForever);
}

export function getNotifiedSharesV3(): Set<string> {
  return getNotifiedShareIdsForever();
}

export function getNotifiedShareIdsPerm(): Set<string> {
  return getNotifiedShareIdsForever();
}

export function isShareIdNotifiedForever(id?: string | null): boolean {
  const clean = normalizeShareId(id);
  if (!clean) return true;
  if (inMemoryNotifiedSharesForever.has(clean) || cloudNotifiedSharesCache.has(clean)) return true;
  return getNotifiedShareIdsForever().has(clean);
}

export function isShareIdNotifiedPerm(id?: string | null): boolean {
  return isShareIdNotifiedForever(id);
}

/**
 * Synchronously writes normalized share IDs (without 'share_' prefix) to in-memory Set
 * and localStorage ('mm_notified_share_ids_forever') before any next tick.
 */
export function markShareIdsNotifiedForever(ids: (string | undefined | null)[] | Set<string>): void {
  const seen = getNotifiedShareIdsForever();
  ids.forEach((id) => {
    const clean = normalizeShareId(id);
    if (clean) {
      seen.add(clean);
      inMemoryNotifiedSharesForever.add(clean);
    }
  });
  if (typeof localStorage !== 'undefined') {
    try {
      const list = Array.from(seen).slice(-1000);
      const serialized = JSON.stringify(list);
      localStorage.setItem(NOTIFIED_SHARE_IDS_FOREVER_KEY, serialized);
      localStorage.setItem(NOTIFIED_SHARES_V3_KEY, serialized);
      localStorage.setItem(PERMANENT_NOTIFIED_SHARE_IDS_KEY, serialized);
    } catch {}
  }
}

export function markShareIdsNotifiedPerm(ids: (string | undefined | null)[] | Set<string>): void {
  markShareIdsNotifiedForever(ids);
}

/**
 * Waits briefly for auth.currentUser if Firebase Auth is still hydrating on cold boot
 */
async function waitForAuthenticatedUid(fallbackUid?: string, timeoutMs: number = 1200): Promise<string> {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  if (!fallbackUid && !getCachedAuthUser()?.uid) return '';
  return new Promise<string>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        unsub();
        resolve(auth.currentUser?.uid || fallbackUid || getCachedAuthUser()?.uid || '');
      }
    }, timeoutMs);
    const unsub = auth.onAuthStateChanged((user) => {
      if (user?.uid && !settled) {
        settled = true;
        clearTimeout(timer);
        unsub();
        resolve(user.uid);
      }
    });
  });
}

/**
 * Syncs users/${uid}/notifiedShares from Firebase RTDB into local 'mm_notified_share_ids_forever'
 * and 'mm_notified_share_timestamps'.
 */
export async function syncCloudNotifiedSharesToLocal(customUid?: string): Promise<Set<string>> {
  const targetUid = await waitForAuthenticatedUid(customUid);
  if (!targetUid) return getNotifiedShareIdsForever();
  try {
    const snap = await get(ref(rtdb, `users/${targetUid}/notifiedShares`));
    const remoteSet = new Set<string>();
    const localTimestamps = getNotifiedShareTimestamps();
    let timestampsModified = false;

    if (snap.exists() && snap.val() && typeof snap.val() === 'object') {
      const val = snap.val();
      const cloudIds: string[] = [];
      for (const [key, rawVal] of Object.entries(val)) {
        if (rawVal) {
          const clean = normalizeShareId(key);
          if (clean) {
            cloudIds.push(clean);
            remoteSet.add(clean);
            cloudNotifiedSharesCache.add(clean);
            if (typeof rawVal === 'number' && rawVal > 0) {
              inMemoryNotifiedShareTimestamps.set(clean, rawVal);
              if (!localTimestamps[clean] || rawVal > localTimestamps[clean]) {
                localTimestamps[clean] = rawVal;
                timestampsModified = true;
              }
            } else if (rawVal === true && !localTimestamps[clean]) {
              localTimestamps[clean] = 1;
              timestampsModified = true;
            }
          }
        }
      }
      if (timestampsModified) {
        saveNotifiedShareTimestamps(localTimestamps);
      }
      if (cloudIds.length > 0) {
        markShareIdsNotifiedForever(cloudIds);
      }
    }
    cloudNotifiedHydratedForUid = targetUid;

    // Mirror any local 'mm_notified_share_ids_forever' entries that are missing in Firebase RTDB
    if (auth.currentUser?.uid === targetUid) {
      const localAll = getNotifiedShareIdsForever();
      const missingInCloud: Record<string, any> = {};
      let hasMissing = false;
      localAll.forEach((cid) => {
        if (cid && !remoteSet.has(cid)) {
          const ts = localTimestamps[cid] || Date.now();
          missingInCloud[cid] = ts;
          cloudNotifiedSharesCache.add(cid);
          hasMissing = true;
        }
      });
      if (hasMissing) {
        update(ref(rtdb, `users/${targetUid}/notifiedShares`), missingInCloud).catch(() => {});
      }
    }
  } catch {}
  return getNotifiedShareIdsForever();
}

/**
 * Clears the notification tracking state for a share so that if the user is re-invited later,
 * the new invitation will be treated as a fresh event and will trigger a notification.
 */
export function clearShareNotifiedState(
  shareId: string,
  _myClean16Id?: string,
  currentUid?: string
): void {
  const cleanSid = normalizeShareId(shareId);
  if (!cleanSid) return;

  inMemoryNotifiedSharesForever.delete(cleanSid);
  cloudNotifiedSharesCache.delete(cleanSid);
  inMemoryNotifiedShareTimestamps.delete(cleanSid);
  inFlightNotificationLocks.delete(cleanSid);

  if (typeof localStorage !== 'undefined') {
    try {
      const timestamps = getNotifiedShareTimestamps();
      if (timestamps[cleanSid] !== undefined) {
        delete timestamps[cleanSid];
        saveNotifiedShareTimestamps(timestamps);
      }
      const foreverSet = getNotifiedShareIdsForever();
      if (foreverSet.has(cleanSid)) {
        foreverSet.delete(cleanSid);
        const serialized = JSON.stringify(Array.from(foreverSet));
        localStorage.setItem(NOTIFIED_SHARE_IDS_FOREVER_KEY, serialized);
        localStorage.setItem(NOTIFIED_SHARES_V3_KEY, serialized);
        localStorage.setItem(PERMANENT_NOTIFIED_SHARE_IDS_KEY, serialized);
      }
      const seenHashes = getSeenShareNotificationHashes();
      let hashesModified = false;
      seenHashes.forEach((h) => {
        if (h.includes(cleanSid)) {
          seenHashes.delete(h);
          hashesModified = true;
        }
      });
      if (hashesModified) {
        localStorage.setItem(SEEN_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Array.from(seenHashes)));
      }
    } catch {}
  }

  const effectiveUid = auth.currentUser?.uid || currentUid || getCachedAuthUser()?.uid || '';
  if (effectiveUid) {
    remove(ref(rtdb, `users/${effectiveUid}/notifiedShares/${cleanSid}`)).catch(() => {});
  }
}

/**
 * Checks whether a space has ALREADY been notified (or should never be notified because user is owner):
 * (1) Returns true if space.ownerUid === currentUser.uid or cleanId(space.owner16DigitId) === myClean16Id
 * (2) Returns false if space has a newer candidateInvitedAt than previously recorded (re-invite!)
 * (3) Returns true if already notified for the active membership instance
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
    isSpaceOwnedByUser(space, cleanMy16, effectiveUid) ||
    isShareCreatedByMe(cleanSid)
  ) {
    markShareIdsNotifiedForever([cleanSid]);
    return true;
  }

  // (2) Smart Re-Invite Check:
  const targetMember = (space.members || []).find(
    (m) => cleanMy16 && normalize16DigitId(m.numericId) === cleanMy16
  );
  const candidateInvitedAt = targetMember?.invitedAt || targetMember?.addedAt || space.updatedAt || 0;

  const timestamps = getNotifiedShareTimestamps();
  const lastNotifiedAt = inMemoryNotifiedShareTimestamps.get(cleanSid) || timestamps[cleanSid] || 0;

  // Fresh re-invite check: if candidate has newer invitedAt than the last notification, treat as fresh!
  if (candidateInvitedAt > 0 && lastNotifiedAt > 0 && candidateInvitedAt > lastNotifiedAt) {
    return false;
  }

  // If already notified for this exact invite instance or newer, do not repeat!
  if (lastNotifiedAt > 0 && candidateInvitedAt <= lastNotifiedAt) {
    return true;
  }

  // (3) Check local 'mm_notified_share_ids_forever' and cloud cache for legacy records
  if (lastNotifiedAt === 0 && isShareIdNotifiedForever(cleanSid)) {
    const dismissedMap = getDismissedShareTimestamps();
    const dismissedAt = dismissedMap[cleanSid] || 0;
    if (dismissedAt > 0 && candidateInvitedAt > dismissedAt) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Immediately records cleanShareId and its invite timestamp in BOTH localStorage
 * AND Firebase RTDB at users/${currentUser.uid}/notifiedShares/${cleanShareId} = inviteTimestamp
 * synchronously before any next tick.
 */
export function recordShareNotifiedSynchronously(
  spaceOrShareId: Partial<ShareFolder> | string,
  myClean16Id?: string,
  currentUid?: string
): void {
  const rawId = typeof spaceOrShareId === 'string' ? spaceOrShareId : spaceOrShareId?.id;
  const cleanSid = normalizeShareId(rawId);
  if (!cleanSid) return;

  let inviteTimestamp = Date.now();
  if (typeof spaceOrShareId === 'object' && spaceOrShareId) {
    const cleanMy16 = normalize16DigitId(myClean16Id || '');
    const myMember = (spaceOrShareId.members || []).find(
      (m) => cleanMy16 && normalize16DigitId(m.numericId) === cleanMy16
    );
    inviteTimestamp = myMember?.invitedAt || myMember?.addedAt || spaceOrShareId.updatedAt || Date.now();
  }

  // 1. Synchronously update in-memory timestamp and map
  inMemoryNotifiedShareTimestamps.set(cleanSid, inviteTimestamp);
  const timestamps = getNotifiedShareTimestamps();
  timestamps[cleanSid] = inviteTimestamp;
  saveNotifiedShareTimestamps(timestamps);

  // 2. Synchronously write to 'mm_notified_share_ids_forever' and in-memory Set before any next tick
  cloudNotifiedSharesCache.add(cleanSid);
  markShareIdsNotifiedForever([cleanSid]);
  if (typeof spaceOrShareId === 'object' && spaceOrShareId) {
    markShareNotificationsSeen([cleanSid, spaceOrShareId.id || cleanSid, computeShareNotificationHash(spaceOrShareId)]);
  } else {
    markShareNotificationsSeen([cleanSid]);
  }

  // 3. Immediately trigger write to Firebase RTDB: users/${uid}/notifiedShares/${cleanSid} = inviteTimestamp
  const effectiveUid = auth.currentUser?.uid || currentUid || getCachedAuthUser()?.uid || '';
  if (effectiveUid) {
    set(ref(rtdb, `users/${effectiveUid}/notifiedShares/${cleanSid}`), inviteTimestamp).catch(() => {});
  }
  if (!auth.currentUser?.uid) {
    waitForAuthenticatedUid(effectiveUid, 4000)
      .then((authedUid) => {
        if (authedUid) {
          set(ref(rtdb, `users/${authedUid}/notifiedShares/${cleanSid}`), inviteTimestamp).catch(() => {});
        }
      })
      .catch(() => {});
  }
}

export async function recordShareNotifiedEverywhere(
  space: ShareFolder,
  myClean16Id: string,
  currentUid?: string
): Promise<void> {
  recordShareNotifiedSynchronously(space, myClean16Id, currentUid);
}

/**
 * Atomic, race-free gate for incoming share notifications:
 * - Never notifies if owner16DigitId === myClean16Id or ownerUid === currentUser.uid
 * - Checks timestamps, 'mm_notified_share_ids_forever' and users/${uid}/notifiedShares/${cleanShareId}
 * - Allows fresh notifications when re-invited with candidateInvitedAt > lastNotifiedAt
 * - Locks cleanShareId synchronously so concurrent slot/master/poll events cannot race
 * - If not notified, immediately writes timestamp to BOTH local and Firebase before returning true
 */
export async function shouldNotifyIncomingShareOnce(
  space: ShareFolder,
  myClean16Id: string,
  currentUid?: string
): Promise<boolean> {
  if (!space || !space.id || space.deleted === true) return false;
  const cleanSid = normalizeShareId(space.id);
  if (!cleanSid) return false;

  // 1. Fast synchronous check (owner check + local timestamps + 'mm_notified_share_ids_forever' + cloud cache)
  if (isShareNotifiedEverywhere(space, myClean16Id, currentUid)) {
    return false;
  }

  // 2. Synchronous in-flight lock so concurrent slot_0..9 / share_${id} / poll callbacks cannot race
  if (inFlightNotificationLocks.has(cleanSid)) {
    return false;
  }
  inFlightNotificationLocks.add(cleanSid);

  try {
    const effectiveUid = auth.currentUser?.uid || currentUid || getCachedAuthUser()?.uid || '';

    // 3. Check Firebase RTDB
    if (effectiveUid && (typeof navigator === 'undefined' || navigator.onLine)) {
      if (cloudNotifiedHydratedForUid !== effectiveUid) {
        await syncCloudNotifiedSharesToLocal(effectiveUid);
      } else if (auth.currentUser?.uid) {
        try {
          const itemSnap = await get(ref(rtdb, `users/${auth.currentUser.uid}/notifiedShares/${cleanSid}`));
          if (itemSnap.exists()) {
            const cloudVal = itemSnap.val();
            const cleanMy16 = normalize16DigitId(myClean16Id);
            const targetMember = (space.members || []).find(
              (m) => cleanMy16 && normalize16DigitId(m.numericId) === cleanMy16
            );
            const candidateInvitedAt = targetMember?.invitedAt || targetMember?.addedAt || space.updatedAt || 0;

            if (typeof cloudVal === 'number' && candidateInvitedAt > 0 && candidateInvitedAt > cloudVal) {
              // Fresh re-invite with newer timestamp!
            } else if (cloudVal === true || (typeof cloudVal === 'number' && candidateInvitedAt <= cloudVal)) {
              recordShareNotifiedSynchronously(space, myClean16Id, auth.currentUser.uid);
              return false;
            }
          }
        } catch {}
      }
    }

    // Re-check after cloud hydration
    if (isShareNotifiedEverywhere(space, myClean16Id, effectiveUid)) {
      return false;
    }

    // 4. Not present or fresh re-invite:
    recordShareNotifiedSynchronously(space, myClean16Id, effectiveUid);
    return true;
  } finally {
    inFlightNotificationLocks.delete(cleanSid);
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
    markShareIdsNotifiedForever([clean]);
  } catch {}
}

export function getDismissedShareTimestamps(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DISMISSED_SHARE_TIMESTAMPS_KEY);
    const map: Record<string, number> = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          const clean = normalizeShareId(k);
          if (clean && typeof v === 'number') {
            map[clean] = v;
          }
        }
      }
    }
    // Migration from legacy array
    const legacyRaw = localStorage.getItem(DISMISSED_SHARE_IDS_KEY);
    if (legacyRaw) {
      try {
        const legacyArr = JSON.parse(legacyRaw);
        if (Array.isArray(legacyArr)) {
          let updated = false;
          for (const item of legacyArr) {
            const clean = normalizeShareId(item);
            if (clean && !map[clean]) {
              map[clean] = Date.now();
              updated = true;
            }
          }
          if (updated && !raw) {
            localStorage.setItem(DISMISSED_SHARE_TIMESTAMPS_KEY, JSON.stringify(map));
          }
        }
      } catch {}
    }
    return map;
  } catch {
    return {};
  }
}

export function saveDismissedShareTimestamps(map: Record<string, number>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_SHARE_TIMESTAMPS_KEY, JSON.stringify(map));
    localStorage.setItem(DISMISSED_SHARE_IDS_KEY, JSON.stringify(Object.keys(map)));
  } catch {}
}

export function getDismissedShareIds(): Set<string> {
  const map = getDismissedShareTimestamps();
  return new Set(Object.keys(map));
}

export function clearDismissedShare(shareId?: string | null): void {
  const clean = normalizeShareId(shareId);
  if (!clean) return;
  const map = getDismissedShareTimestamps();
  if (map[clean] !== undefined) {
    delete map[clean];
    saveDismissedShareTimestamps(map);
  }
  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    remove(ref(rtdb, `user_dismissed_shares/${currentUid}/${clean}`)).catch(() => {});
  }
}

export function isShareDismissed(id?: string | null, candidateInvitedAt?: number): boolean {
  const clean = normalizeShareId(id);
  if (!clean) return false;
  const timestamps = getDismissedShareTimestamps();
  const dismissedAt = timestamps[clean];
  if (!dismissedAt) return false;

  // If slot.invitedAt > (dismissedMap[shareId] || 0), automatically clear the dismissal and show the re-invited space immediately!
  if (candidateInvitedAt && candidateInvitedAt > dismissedAt) {
    clearDismissedShare(clean);
    return false;
  }
  return true;
}

export async function dismissShareId(shareId: string, _my16DigitId?: string, timestamp: number = Date.now()): Promise<void> {
  const cleanShareId = normalizeShareId(shareId);
  if (!cleanShareId) return;

  const map = getDismissedShareTimestamps();
  map[cleanShareId] = timestamp;
  saveDismissedShareTimestamps(map);

  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    try {
      await set(ref(rtdb, `user_dismissed_shares/${currentUid}/${cleanShareId}`), timestamp);
    } catch {}
  }
}


/**
 * Hook that maintains deduplicated live onValue listeners on shared_accounts/profile_${memberClean16Id}.
 * Automatically attaches listeners for new IDs and detaches listeners when IDs are removed or on unmount.
 */
export function useLiveMemberProfiles(
  member16Ids: (string | undefined | null)[]
): Record<string, UserProfileCard> {
  const [profiles, setProfiles] = useState<Record<string, UserProfileCard>>(() => {
    const initial: Record<string, UserProfileCard> = {};
    for (const rawId of member16Ids || []) {
      const clean = normalize16DigitId(rawId);
      if (clean.length === 16) {
        const cached = getKnownContact(clean);
        if (cached) initial[clean] = cached;
      }
    }
    return initial;
  });

  const listenersRef = useRef<Map<string, () => void>>(new Map());

  // Stabilize unique clean 16-digit IDs list
  const cleanIds = useMemo(() => {
    const set = new Set<string>();
    for (const rawId of member16Ids || []) {
      const clean = normalize16DigitId(rawId);
      if (clean.length === 16) set.add(clean);
    }
    return Array.from(set).sort();
  }, [JSON.stringify(member16Ids || [])]);

  useEffect(() => {
    const nextSet = new Set(cleanIds);
    const currentListeners = listenersRef.current;

    // 1. Detach listeners for IDs that are no longer in cleanIds
    for (const [id, unsub] of currentListeners.entries()) {
      if (!nextSet.has(id)) {
        unsub();
        currentListeners.delete(id);
      }
    }

    // 2. Attach new listeners for newly added cleanIds
    for (const id of cleanIds) {
      if (!currentListeners.has(id)) {
        const profileRef = ref(rtdb, `shared_accounts/profile_${id}`);
        const listener = (snap: any) => {
          if (snap.exists() && snap.val()) {
            const val = snap.val();
            const rawPhoto = val.photoURL || '';
            const photoURL = isRealPhotoUrl(rawPhoto) ? rawPhoto.trim() : '';
            const avatar = val.avatar || (!isRealPhotoUrl(rawPhoto) && rawPhoto ? rawPhoto : '👤');
            const card: UserProfileCard = {
              numericId: id,
              name: val.name || val.accountName || `User ${id.slice(0, 4)}`,
              avatar,
              photoURL,
              uid: val.uid || val.ownerUid,
              updatedAt: val.updatedAt || Date.now(),
              leftSpaces: val.leftSpaces || {},
              driveAccessGranted: val.driveAccessGranted,
              drivePromptResolved: val.drivePromptResolved,
            };
            saveKnownContact(card);
            setProfiles((prev) => ({
              ...prev,
              [id]: card,
            }));
          }
        };
        onValue(profileRef, listener);
        currentListeners.set(id, () => off(profileRef, 'value', listener));
      }
    }
  }, [cleanIds]);

  // Guaranteed unmount cleanup
  useEffect(() => {
    const listeners = listenersRef.current;
    return () => {
      for (const unsub of listeners.values()) {
        unsub();
      }
      listeners.clear();
    };
  }, []);

  return profiles;
}

export function isMemberActiveInSpace(
  member: ShareMember,
  spaceId: string,
  memberProfile?: any
): boolean {
  if (!member) return false;
  const cleanSid = normalizeShareId(spaceId);
  const invitedAt = member.invitedAt || member.addedAt || 0;
  const leftAt = memberProfile?.leftSpaces?.[cleanSid] || 0;
  if (leftAt && leftAt >= invitedAt) {
    return false;
  }
  return true;
}

export function purgeDeletedShareSpace(shareId: string): void {
  const cleanSid = normalizeShareId(shareId);
  if (!cleanSid) return;

  const owned = loadMyShareFolders().filter((f) => normalizeShareId(f.id) !== cleanSid);
  const received = loadReceivedShareFolders().filter((f) => normalizeShareId(f.id) !== cleanSid);
  saveMyShareFolders(owned);
  saveReceivedShareFolders(received);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify([...owned, ...received]));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    const next = [...owned, ...received];
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: received }));
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
 * Partition & repair spaces in 'mm_my_owned_spaces' and 'mm_received_spaces' strictly by:
 * - "Shared by Me": cleanId(space.owner16DigitId) === myClean16Id
 * - "Shared with Me": cleanId(space.owner16DigitId) !== myClean16Id
 */
export function repairAndMigrateSharedSpaces(
  myNumericId?: string,
  currentUserUid?: string
): { myFolders: ShareFolder[]; receivedFolders: ShareFolder[] } {
  const { myUid, myClean16Id } = resolveCurrentIdentity(myNumericId, currentUserUid);
  const all = loadAllSpacesV3();
  const dismissed = getDismissedShareIds();

  const myFolders: ShareFolder[] = [];
  const receivedFolders: ShareFolder[] = [];

  for (const space of all) {
    if (!space || !space.id || space.deleted === true) continue;
    const cleanSid = normalizeShareId(space.id);
    if (dismissed.has(cleanSid)) continue;

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

  saveMyShareFolders(myFolders);
  saveReceivedShareFolders(receivedFolders);

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

  const extractTxs = (c: any): Transaction[] => (Array.isArray(c) ? c.filter(Boolean) : (c && typeof c === 'object') ? Object.values(c).filter(Boolean) as Transaction[] : []);
  const rawTransactions: Transaction[] = extractTxs(val.transactions).length > 0 ? extractTxs(val.transactions) : extractTxs(val.payload?.transactions);

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

  const cleanPhotoURL = isRealPhotoUrl(myPhotoURL) ? (myPhotoURL || '').trim() : '';
  const cleanAvatar = myAvatar || (!isRealPhotoUrl(myPhotoURL) && myPhotoURL ? myPhotoURL : '👤');
  let updatedMembers = Array.isArray(folder.members) ? [...folder.members] : [];
  if (!isOwner && cleanId.length === 16) {
    const existingMemberIdx = updatedMembers.findIndex((m) => normalize16DigitId(m.numericId) === cleanId);
    if (existingMemberIdx === -1) {
      updatedMembers.push({
        numericId: cleanId,
        name: myName || 'User',
        avatar: cleanAvatar,
        photoURL: cleanPhotoURL,
        role: 'viewer',
        status: 'active',
        addedAt: Date.now(),
      });
    } else {
      updatedMembers[existingMemberIdx] = {
        ...updatedMembers[existingMemberIdx],
        name: myName || updatedMembers[existingMemberIdx].name,
        avatar: cleanAvatar,
        photoURL: cleanPhotoURL,
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
 * Writes a space into the first available deterministic slot (0..9) for targetClean16Id:
 * shared_accounts/slot_${targetClean16Id}_${i}
 */
export async function writeSpaceToCloudSlots(
  targetClean16Id: string,
  space: ShareFolder,
  fullSanitizedSpace: any,
  senderUid?: string
): Promise<boolean> {
  const cleanTarget = normalize16DigitId(targetClean16Id);
  if (cleanTarget.length !== 16) return false;

  const rawShareId = normalizeShareId(space.id);
  const myClean16Id = normalize16DigitId(space.owner16DigitId || space.ownerNumericId || getOrCreateNumericId());
  if (cleanTarget === myClean16Id) return false;

  const effectiveUid = auth.currentUser?.uid || senderUid || space.ownerUid || 'authenticated_user';
  const now = Date.now();

  const targetMember = (fullSanitizedSpace.members || []).find(
    (m: any) => normalize16DigitId(m.numericId) === cleanTarget
  );
  const memberInvitedAt = targetMember?.invitedAt || targetMember?.addedAt || now;

  const slotPayload = JSON.parse(
    JSON.stringify({
      ...fullSanitizedSpace,
      ownerUid: effectiveUid,
      accountName: (space.name || 'Share').slice(0, 100),
      updatedAt: now,
      shareId: space.id,
      rawShareId,
      invitedAt: memberInvitedAt,
      target16Id: cleanTarget,
      sender16Id: myClean16Id,
      space: {
        ...fullSanitizedSpace,
        invitedAt: memberInvitedAt,
      },
    })
  );
  delete (slotPayload as any).kicked;
  delete (slotPayload as any).deleted;
  if (slotPayload.space) {
    delete slotPayload.space.kicked;
    delete slotPayload.space.deleted;
  }

  // Scan i = 0..9 with get() and use first slot that is empty, kicked/deleted, or already holds same shareId.
  // Wrap each slot write in try/catch and move on to next slot if write is rejected with PERMISSION_DENIED.
  let writtenSuccessfully = false;
  for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
    try {
      const snap = await get(ref(rtdb, `shared_accounts/slot_${cleanTarget}_${i}`));
      const val = snap.exists() ? snap.val() : null;
      const isSlotEmpty = !val;
      const isSlotKickedOrDeleted = val?.kicked === true || val?.deleted === true;
      const isSameShare = normalizeShareId(val?.shareId || val?.rawShareId || val?.space?.id || val?.id) === rawShareId;
      const isOwnedByMe = val?.ownerUid === effectiveUid;

      if (isSlotEmpty || isSlotKickedOrDeleted || isSameShare || isOwnedByMe) {
        try {
          await set(ref(rtdb, `shared_accounts/slot_${cleanTarget}_${i}`), slotPayload);
          writtenSuccessfully = true;
          break;
        } catch (writeErr: any) {
          console.warn(`[ShareFolders] Slot write rejected at slot_${cleanTarget}_${i} (${writeErr?.message || writeErr}), moving to next slot`);
          continue;
        }
      }
    } catch {
      try {
        await set(ref(rtdb, `shared_accounts/slot_${cleanTarget}_${i}`), slotPayload);
        writtenSuccessfully = true;
        break;
      } catch {}
    }
  }

  // Backup write to profile_shares_${cleanTarget}_${rawShareId} and inboxByNumericId
  try {
    await set(ref(rtdb, `shared_accounts/profile_shares_${cleanTarget}_${rawShareId}`), slotPayload);
  } catch {}
  try {
    await set(ref(rtdb, `inboxByNumericId/${cleanTarget}/${rawShareId}`), slotPayload);
  } catch {}

  return writtenSuccessfully;
}

/**
 * Cleans up a member's deterministic slots (0..9) for a deleted or revoked shareId
 */
export async function clearMemberSlotsForShare(
  targetClean16Id: string,
  shareId: string,
  markTombstone = false
): Promise<void> {
  const cleanTarget = normalize16DigitId(targetClean16Id);
  const rawShareId = normalizeShareId(shareId);
  if (cleanTarget.length !== 16 || !rawShareId) return;

  const effectiveUid = auth.currentUser?.uid || 'authenticated_user';

  for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
    try {
      const slotRef = ref(rtdb, `shared_accounts/slot_${cleanTarget}_${i}`);
      const snap = await get(slotRef);
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        const candidateId = normalizeShareId(val.shareId || val.rawShareId || val.space?.id || val.id);
        if (candidateId === rawShareId) {
          try {
            await remove(slotRef);
          } catch {
            if (markTombstone) {
              await set(slotRef, {
                ownerUid: val.ownerUid || effectiveUid,
                accountName: 'Removed',
                updatedAt: Date.now(),
                shareId: rawShareId,
                target16Id: cleanTarget,
                kicked: true,
                deleted: true,
                leftAt: Date.now(),
              }).catch(() => {});
            }
          }
        }
      }
    } catch {}
  }

  try {
    await remove(ref(rtdb, `shared_accounts/profile_shares_${cleanTarget}_${rawShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/invite_${cleanTarget}_${rawShareId}`));
  } catch {}
}

/**
 * Sync Share Space to master node shared_accounts/share_${space.id} AND deterministic member slots (0..9).
 * Persists locally in 'mm_my_owned_spaces' / 'mm_received_spaces' immediately and syncs to Firebase when online.
 */
export async function syncFolderToCloud(folder: ShareFolder, forceWrite = false): Promise<void> {
  if (!folder || !folder.id) return;

  // Always ensure space is persisted in local cache ('mm_my_owned_spaces' / 'mm_received_spaces') first
  const savedLocal = upsertSpaceInV3Cache(folder);
  const rawPayload = buildFullSharePayload(savedLocal);
  const rawShareId = normalizeShareId(rawPayload.id);
  const myClean16 = normalize16DigitId(getOrCreateNumericId());
  const folderOwner16 = normalize16DigitId(rawPayload.owner16DigitId || rawPayload.ownerNumericId || myClean16);
  const isMeOwner = isSpaceOwnedByUser(rawPayload, myClean16);
  const effectiveOwnerUid = isMeOwner
    ? auth.currentUser?.uid || rawPayload.ownerUid || 'authenticated_user'
    : rawPayload.ownerUid || auth.currentUser?.uid || 'authenticated_user';

  const fullSanitizedSpace = JSON.parse(
    JSON.stringify({
      ...rawPayload,
      id: rawShareId,
      ownerUid: effectiveOwnerUid,
      accountName: (savedLocal.name || 'Share').slice(0, 100),
      updatedAt: Date.now(),
      owner16DigitId: folderOwner16,
      ownerNumericId: folderOwner16,
      ownerName: rawPayload.ownerName || 'User',
      ownerAvatar: rawPayload.ownerAvatar || '👤',
      member16Ids: rawPayload.member16Ids || [],
      members: rawPayload.members || [],
      accounts: rawPayload.accounts || [],
      categories: rawPayload.categories || [],
      transactions: rawPayload.transactions || [],
    })
  );

  // If offline, queue for sync as soon as network is restored
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineShareUpdate(fullSanitizedSpace);
    return;
  }

  const currentSig = computeFolderContentSignature(fullSanitizedSpace);
  const lastSig = lastSyncedFolderSignatures.get(rawShareId);
  if (!forceWrite && lastSig && lastSig === currentSig) {
    return;
  }
  lastSyncedFolderSignatures.set(rawShareId, currentSig);

  // 1. Write master space to shared_accounts/share_${space.id}
  let masterSynced = false;
  try {
    await set(ref(rtdb, `shared_accounts/share_${rawShareId}`), fullSanitizedSpace);
    masterSynced = true;
    removeSpaceFromOfflineQueue(rawShareId);
  } catch (err) {
    console.warn(`[ShareFolders] Failed to write master space share_${rawShareId}:`, err);
    queueOfflineShareUpdate(fullSanitizedSpace);
  }

  // 2. Also write alias shared_accounts/${folder.id} if different
  if (folder.id !== `share_${rawShareId}`) {
    try {
      await set(ref(rtdb, `shared_accounts/${folder.id}`), fullSanitizedSpace);
    } catch {}
  }

  // 3. Scan i = 0..9 for each member and write slot with try/catch fallback
  const member16Set = new Set<string>();
  for (const m of fullSanitizedSpace.members || []) {
    const cleanMid = normalize16DigitId(m?.numericId);
    if (cleanMid.length === 16 && cleanMid !== folderOwner16) {
      member16Set.add(cleanMid);
    }
  }
  for (const mid of fullSanitizedSpace.member16Ids || []) {
    const cleanMid = normalize16DigitId(mid);
    if (cleanMid.length === 16 && cleanMid !== folderOwner16) {
      member16Set.add(cleanMid);
    }
  }

  for (const targetClean16Id of Array.from(member16Set)) {
    const targetMember = (fullSanitizedSpace.members || []).find(
      (m: any) => normalize16DigitId(m.numericId) === targetClean16Id
    );
    const memberInvitedAt = targetMember?.invitedAt || targetMember?.addedAt || Date.now();

    const slotEntry = JSON.parse(
      JSON.stringify({
        ...fullSanitizedSpace,
        ownerUid: auth.currentUser?.uid || effectiveOwnerUid,
        accountName: (savedLocal.name || 'Share').slice(0, 100),
        updatedAt: Date.now(),
        shareId: rawShareId,
        invitedAt: memberInvitedAt,
        target16Id: targetClean16Id,
        sender16Id: folderOwner16,
        space: {
          ...fullSanitizedSpace,
          invitedAt: memberInvitedAt,
        },
      })
    );
    delete (slotEntry as any).kicked;
    delete (slotEntry as any).deleted;
    if (slotEntry.space) {
      delete slotEntry.space.kicked;
      delete slotEntry.space.deleted;
    }

    // Scan slots 0..9 and try first empty, kicked/deleted, or matching slot with try/catch
    let slotWritten = false;
    for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
      try {
        const snap = await get(ref(rtdb, `shared_accounts/slot_${targetClean16Id}_${i}`));
        const val = snap.exists() ? snap.val() : null;
        const isSlotEmpty = !val;
        const isSlotKickedOrDeleted = val?.kicked === true || val?.deleted === true;
        const isSameShare = normalizeShareId(val?.shareId || val?.rawShareId || val?.space?.id || val?.id) === rawShareId;
        const isOwnedByMe = val?.ownerUid === (auth.currentUser?.uid || effectiveOwnerUid);

        if (isSlotEmpty || isSlotKickedOrDeleted || isSameShare || isOwnedByMe) {
          try {
            await set(ref(rtdb, `shared_accounts/slot_${targetClean16Id}_${i}`), slotEntry);
            slotWritten = true;
            break;
          } catch (writeErr: any) {
            console.warn(`[ShareFolders] Slot delivery failed for ${targetClean16Id} at slot ${i} (${writeErr?.message || writeErr}), trying next slot`);
            continue;
          }
        }
      } catch {
        try {
          await set(ref(rtdb, `shared_accounts/slot_${targetClean16Id}_${i}`), slotEntry);
          slotWritten = true;
          break;
        } catch {}
      }
    }

    // Extra child-key fallback: profile_shares_${targetClean16Id}_${rawShareId} and inboxByNumericId
    try {
      await set(ref(rtdb, `shared_accounts/profile_shares_${targetClean16Id}_${rawShareId}`), slotEntry);
    } catch {}
    try {
      await set(ref(rtdb, `inboxByNumericId/${targetClean16Id}/${rawShareId}`), slotEntry);
    } catch {}
  }

  if (masterSynced) {
    removeSpaceFromOfflineQueue(rawShareId);
  }
}

export const syncShareFolderToCloud = syncFolderToCloud;

/**
 * Automatically propagate any transaction added/edited/deleted in HomeView or AccountsView
 * into any linked Shared Space in real time (updating only the changed item path).
 */
/**
 * Push ONLY a single transaction delta to the shared space's cloud node
 * without re-uploading the entire shared space or the entire transaction array.
 * Uses lightweight RTDB multi-path update so child listeners fire with minimal bandwidth.
 */
export async function pushTransactionDeltaToCloud(
  spaceId: string,
  action: 'add' | 'update' | 'delete',
  txOrId: Transaction | string
): Promise<void> {
  const cleanId = normalizeShareId(spaceId);
  if (!cleanId) return;

  const txId = typeof txOrId === 'string' ? txOrId : txOrId.id;
  if (!txId) return;

  const now = Date.now();
  const canonicalPath = getCanonicalSharePath(cleanId);

  let deltaValue: any = null;
  if (action !== 'delete' && typeof txOrId === 'object') {
    deltaValue = deepSanitizeForFirebase(txOrId);
  }

  const updates: Record<string, any> = {
    [`transactions/${txId}`]: deltaValue,
    [`payload/transactions/${txId}`]: deltaValue,
    updatedAt: now,
  };

  try {
    await update(ref(rtdb, canonicalPath), updates);
  } catch (err) {
    console.warn(`[ShareFolders] Failed pushing transaction delta for ${txId} in ${cleanId}:`, err);
  }

  if (spaceId !== `share_${cleanId}` && cleanId !== spaceId) {
    try {
      await update(ref(rtdb, `shared_accounts/${spaceId}`), updates);
    } catch {}
  }
}

export async function propagateTransactionToLinkedSpaces(
  action: 'add' | 'update' | 'delete',
  tx: Transaction,
  allAccounts?: Account[]
): Promise<void> {
  if (!tx || !tx.id) return;
  const allSpaces = loadAllSpacesV3();
  if (allSpaces.length === 0) return;

  const txId = tx.id;
  const txAccountId = tx.accountId;
  const txToAccountId = tx.toAccountId;
  const explicitShareId = (tx as any).shareId ? normalizeShareId((tx as any).shareId) : '';

  let anySpaceChanged = false;
  const updatedSpaces: ShareFolder[] = [];

  for (const space of allSpaces) {
    if (!space || !space.id) continue;
    const cleanSpaceId = normalizeShareId(space.id);
    const spaceAccounts = space.payload?.accounts || space.accounts || [];
    const spaceAccountIds = new Set(spaceAccounts.map((a) => a.id));

    const isLinkedByAccount =
      Boolean(txAccountId && spaceAccountIds.has(txAccountId)) ||
      Boolean(txToAccountId && spaceAccountIds.has(txToAccountId));

    const existingTxs = space.payload?.transactions || space.transactions || [];
    const existingIdx = existingTxs.findIndex((t) => t.id === txId);
    const isLinkedByTx = existingIdx !== -1;
    const isLinkedByExplicitShare = Boolean(explicitShareId && explicitShareId === cleanSpaceId);

    if (!isLinkedByAccount && !isLinkedByTx && !isLinkedByExplicitShare) {
      updatedSpaces.push(space);
      continue;
    }

    // Moved OUT of a shared account: an updated tx that no longer touches any account of this
    // space (and is not explicitly bound to it) must be removed from the space.
    const movedOut =
      action === 'update' && isLinkedByTx && !isLinkedByAccount && !isLinkedByExplicitShare;
    const effectiveAction: 'add' | 'update' | 'delete' = movedOut ? 'delete' : action;

    const nextTxs = [...existingTxs];
    let changed = false;
    let enrichedTx: Transaction | null = null;

    if (effectiveAction === 'delete') {
      if (existingIdx !== -1) {
        nextTxs.splice(existingIdx, 1);
        changed = true;
      }
    } else if (effectiveAction === 'add') {
      enrichedTx = enrichShareTransaction(tx, spaceAccounts);
      if (existingIdx !== -1) {
        nextTxs[existingIdx] = enrichedTx;
      } else {
        nextTxs.unshift(enrichedTx);
      }
      changed = true;
    } else if (effectiveAction === 'update') {
      enrichedTx = enrichShareTransaction(tx, spaceAccounts);
      if (existingIdx !== -1) {
        nextTxs[existingIdx] = enrichedTx;
        changed = true;
      } else if (isLinkedByAccount || isLinkedByExplicitShare) {
        nextTxs.unshift(enrichedTx);
        changed = true;
      }
    }

    if (changed) {
      anySpaceChanged = true;
      const nextSpace: ShareFolder = {
        ...space,
        updatedAt: Date.now(),
        transactions: nextTxs,
        itemCount: spaceAccounts.length + (space.payload?.categories?.length || space.categories?.length || 0) + nextTxs.length,
        payload: {
          accounts: spaceAccounts,
          categories: space.payload?.categories || space.categories || [],
          transactions: nextTxs,
        },
      };
      upsertSpaceInV3Cache(nextSpace);

      // Low-bandwidth granular delta push: NEVER re-upload the whole space
      pushTransactionDeltaToCloud(space.id, effectiveAction, enrichedTx || tx).catch(() => {});

      updatedSpaces.push(nextSpace);
    } else {
      updatedSpaces.push(space);
    }
  }

  if (anySpaceChanged) {
    saveAllSpacesV3(updatedSpaces);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: updatedSpaces }));
    }
  }
}

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
  pushTransactionDeltaToCloud(cleanId, 'add', enrichedTx).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: loadAllSpacesV3() }));
  }
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
  if (itemType === 'transaction') {
    pushTransactionDeltaToCloud(cleanId, 'delete', itemId).catch(() => {});
  } else {
    syncFolderToCloud(saved, true).catch(() => {});
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: loadAllSpacesV3() }));
  }
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
  for (const txId of params.deletedTxIds || []) {
    pushTransactionDeltaToCloud(cleanId, 'delete', txId).catch(() => {});
  }
  if ((params.deletedAccountIds && params.deletedAccountIds.length > 0) || (params.deletedCategoryIds && params.deletedCategoryIds.length > 0)) {
    syncFolderToCloud(saved, true).catch(() => {});
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: loadAllSpacesV3() }));
  }
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
 * Delete a Share Space permanently from local cache, master node shared_accounts/share_${space.id},
 * and all member delivery slots (slot_${member16Id}_0..9)
 */
export async function deleteShareFolder(folderId: string, folderData?: ShareFolder): Promise<void> {
  const cleanShareId = normalizeShareId(folderId);
  if (!cleanShareId) return;

  const existingSpace =
    folderData ||
    loadMyShareFolders().find((f) => normalizeShareId(f.id) === cleanShareId) ||
    loadReceivedShareFolders().find((f) => normalizeShareId(f.id) === cleanShareId);

  const memberIdsToClean = new Set<string>();
  if (existingSpace) {
    for (const m of existingSpace.members || []) {
      const cid = normalize16DigitId(m.numericId);
      if (cid.length === 16) memberIdsToClean.add(cid);
    }
    for (const mid of existingSpace.member16Ids || []) {
      const cid = normalize16DigitId(mid);
      if (cid.length === 16) memberIdsToClean.add(cid);
    }
  }

  removeSpaceFromOfflineQueue(cleanShareId);
  await dismissShareId(cleanShareId);
  purgeDeletedShareSpace(cleanShareId);
  lastSyncedFolderSignatures.delete(cleanShareId);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineShareDelete(cleanShareId);
    return;
  }

  const canonicalPath = getCanonicalSharePath(cleanShareId);
  const effectiveUid = auth.currentUser?.uid || 'authenticated_user';
  try {
    await set(ref(rtdb, canonicalPath), {
      id: cleanShareId,
      deleted: true,
      updatedAt: Date.now(),
      ownerUid: effectiveUid,
      accountName: 'Deleted',
    });
    await remove(ref(rtdb, canonicalPath)).catch(() => {});
  } catch (err) {
    console.warn(`[ShareFolders] Failed deleting ${canonicalPath}:`, err);
    queueOfflineShareDelete(cleanShareId);
  }

  try {
    await remove(ref(rtdb, `shared_accounts/${cleanShareId}`)).catch(() => {});
  } catch {}

  for (const member16 of Array.from(memberIdsToClean)) {
    await clearMemberSlotsForShare(member16, cleanShareId, true).catch(() => {});
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

  const now = Date.now();
  const existingMemberIdx = folder.members.findIndex((m) => normalize16DigitId(m.numericId) === cleanMemberId);
  let nextMembers: ShareMember[];

  if (existingMemberIdx !== -1) {
    // Re-invite member: stamp fresh invitedAt = Date.now()
    const existing = folder.members[existingMemberIdx];
    const updatedMember: ShareMember = {
      ...existing,
      name: resolvedName || existing.name,
      avatar: resolvedAvatar || existing.avatar,
      photoURL: resolvedPhotoURL || existing.photoURL,
      role: role || existing.role,
      status: 'active',
      addedAt: now,
      invitedAt: now,
    };
    nextMembers = [...folder.members];
    nextMembers[existingMemberIdx] = updatedMember;
  } else {
    // New member: stamp fresh invitedAt = Date.now()
    const newMember: ShareMember = {
      numericId: cleanMemberId,
      name: resolvedName,
      avatar: resolvedAvatar,
      photoURL: resolvedPhotoURL,
      role,
      status: 'active',
      addedAt: now,
      invitedAt: now,
    };
    nextMembers = [...folder.members, newMember];
  }

  const nextMember16Ids = extractMember16Ids({ ...folder, members: nextMembers });
  if (!nextMember16Ids.includes(cleanMemberId)) {
    nextMember16Ids.push(cleanMemberId);
  }

  const updatedFolder: ShareFolder = {
    ...folder,
    member16Ids: nextMember16Ids,
    members: nextMembers,
    updatedAt: now,
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
 * Remove / Revoke a member from a Share Space (Admin Kick):
 * - Scan shared_accounts/slot_${memberClean16Id}_0..9 with get() to find matching shareId slotIndex
 * - Remove member's 16-digit ID from shared_accounts/share_${shareId} (preserving existing ownerUid)
 * - Write { kicked: true, deleted: true, leftAt: Date.now(), shareId, updatedAt: Date.now(), ownerUid: existingSlotOwnerUid || space.ownerUid || auth.currentUser.uid, accountName: 'Removed' } to slot (inside try/catch)
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

  const kickTimestamp = Date.now();

  // 1. Scan shared_accounts/slot_${memberClean16Id}_0..9 with get() to find matching shareId slotIndex and existingSlotOwnerUid
  let slotIndex = -1;
  let existingSlotOwnerUid = '';
  for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
    try {
      const snap = await get(ref(rtdb, `shared_accounts/slot_${cleanMemberId}_${i}`));
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        const candidateId = normalizeShareId(val.shareId || val.rawShareId || val.space?.id || val.id);
        if (candidateId === cleanFolderId) {
          slotIndex = i;
          existingSlotOwnerUid = val.ownerUid || '';
          break;
        }
      }
    } catch {}
  }

  // 2. Remove member's 16-digit ID from shared_accounts/share_${shareId} preserving existing ownerUid inside try/catch
  const nextMembers = targetFolder.members.filter((m) => normalize16DigitId(m.numericId) !== cleanMemberId);
  const nextMember16Ids = extractMember16Ids({
    ...targetFolder,
    member16Ids: (targetFolder.member16Ids || []).filter((id) => normalize16DigitId(id) !== cleanMemberId),
    members: nextMembers,
  }).filter((id) => id !== cleanMemberId);

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    member16Ids: nextMember16Ids,
    members: nextMembers,
    updatedAt: kickTimestamp,
  };

  const saved = upsertSpaceInV3Cache(updatedFolder);

  try {
    const canonicalRef = ref(rtdb, getCanonicalSharePath(cleanFolderId));
    const fullPayload = buildFullSharePayload(saved);
    await update(canonicalRef, {
      members: fullPayload.members,
      member16Ids: fullPayload.member16Ids,
      updatedAt: kickTimestamp,
      ownerUid: targetFolder.ownerUid || auth.currentUser?.uid || 'authenticated_user',
      accountName: targetFolder.name || 'Share',
    });
  } catch (mErr) {
    console.warn('[ShareFolders] Failed updating master node on member kick:', mErr);
  }

  // 3. Write tombstone to shared_accounts/slot_${memberClean16Id}_${slotIndex} inside try/catch
  const effectiveTombstoneOwnerUid =
    existingSlotOwnerUid || targetFolder.ownerUid || auth.currentUser?.uid || 'authenticated_user';

  const tombstonePayload = JSON.parse(
    JSON.stringify({
      kicked: true,
      deleted: true,
      leftAt: kickTimestamp,
      shareId: cleanFolderId,
      rawShareId: cleanFolderId,
      target16Id: cleanMemberId,
      updatedAt: kickTimestamp,
      ownerUid: effectiveTombstoneOwnerUid,
      accountName: 'Removed',
    })
  );

  if (slotIndex !== -1) {
    try {
      await set(ref(rtdb, `shared_accounts/slot_${cleanMemberId}_${slotIndex}`), tombstonePayload);
    } catch (slotErr) {
      console.warn(`[ShareFolders] Failed writing tombstone to slot_${cleanMemberId}_${slotIndex}:`, slotErr);
    }
  } else {
    for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
      try {
        await set(ref(rtdb, `shared_accounts/slot_${cleanMemberId}_${i}`), tombstonePayload);
        break;
      } catch {}
    }
  }

  try {
    await remove(ref(rtdb, `shared_accounts/profile_shares_${cleanMemberId}_${cleanFolderId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `inboxByNumericId/${cleanMemberId}/${cleanFolderId}`));
  } catch {}
  clearShareNotifiedState(cleanFolderId, cleanMemberId);

  await syncFolderToCloud(saved, true).catch(() => {});
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
  const removedMembers = folder.members.filter((m) => normalize16DigitId(m.numericId) !== owner16);

  for (const rm of removedMembers) {
    await removeMemberFromShareFolder(cleanFolderId, rm.numericId).catch(() => {});
  }

  const refreshed = loadAllSpacesV3().find((f) => normalizeShareId(f.id) === cleanFolderId);
  return { success: true, folder: refreshed || folder };
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
 * Leave a shared space from "Shared With Me":
 * - Adds shareId to 'mm_dismissed_share_timestamps' and hides space instantly
 * - Scans slot_${cleanId}_0..9 with get() to find matching slotIndex and existingSlotOwnerUid
 * - Writes tombstone { kicked: true, deleted: true, leftAt: Date.now(), shareId, updatedAt: Date.now(), ownerUid, accountName: 'Removed' } to slot inside try/catch
 * - Removes member from shared_accounts/share_${shareId} inside try/catch
 * - Records leave signal in member's own profile node via multi-path update:
 *   update(ref(db, `shared_accounts/profile_${myClean16Id}`), { [`leftSpaces/${shareId}`]: Date.now(), ownerUid, accountName, updatedAt })
 */
export async function leaveShareFolder(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const cleanId = normalize16DigitId(my16DigitId || cleanNumericId(getOrCreateNumericId()));
  const cleanShareId = normalizeShareId(folderId);
  if (!cleanShareId) return;

  const leaveTimestamp = Date.now();

  // 1. Add to mm_dismissed_share_timestamps, purge locally, and clear notified state
  await dismissShareId(cleanShareId, cleanId, leaveTimestamp);
  purgeDeletedShareSpace(cleanShareId);
  clearShareNotifiedState(cleanShareId, cleanId);

  // 2. Scan slot_0..9 with get() to find matching slotIndex and existingSlotOwnerUid
  let slotIndex = -1;
  let existingSlotOwnerUid = '';
  for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
    try {
      const snap = await get(ref(rtdb, `shared_accounts/slot_${cleanId}_${i}`));
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        const candidateId = normalizeShareId(val.shareId || val.rawShareId || val.space?.id || val.id);
        if (candidateId === cleanShareId) {
          slotIndex = i;
          existingSlotOwnerUid = val.ownerUid || '';
          break;
        }
      }
    } catch {}
  }

  // 3. Write tombstone to slot inside try/catch
  const effectiveUid = auth.currentUser?.uid || resolveCurrentIdentity(cleanId).myUid || 'authenticated_user';
  const effectiveSlotOwner = existingSlotOwnerUid || effectiveUid;

  const tombstonePayload = JSON.parse(
    JSON.stringify({
      kicked: true,
      deleted: true,
      leftAt: leaveTimestamp,
      shareId: cleanShareId,
      rawShareId: cleanShareId,
      target16Id: cleanId,
      updatedAt: leaveTimestamp,
      ownerUid: effectiveSlotOwner,
      accountName: 'Removed',
    })
  );

  if (slotIndex !== -1) {
    try {
      await set(ref(rtdb, `shared_accounts/slot_${cleanId}_${slotIndex}`), tombstonePayload);
    } catch (err) {
      console.warn(`[ShareFolders] Failed writing tombstone on leave to slot_${cleanId}_${slotIndex}:`, err);
    }
  }

  // 4. Remove member from shared_accounts/share_${shareId} preserving ownerUid inside try/catch
  try {
    const cloudRef = ref(rtdb, getCanonicalSharePath(cleanShareId));
    const snap = await get(cloudRef);
    if (snap.exists() && snap.val()) {
      const cloudFolder = snap.val();
      const existingOwnerUid = cloudFolder.ownerUid || 'authenticated_user';
      const nextMembers = (Array.isArray(cloudFolder.members) ? cloudFolder.members : []).filter(
        (m: any) => normalize16DigitId(m.numericId) !== cleanId
      );
      const nextMember16Ids = (Array.isArray(cloudFolder.member16Ids) ? cloudFolder.member16Ids : []).filter(
        (id: string) => normalize16DigitId(id) !== cleanId
      );
      await update(cloudRef, {
        members: nextMembers,
        member16Ids: nextMember16Ids,
        updatedAt: leaveTimestamp,
        ownerUid: existingOwnerUid,
        accountName: cloudFolder.name || cloudFolder.accountName || 'Share',
      });
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to update cloud folder members on leave:', err);
  }

  // 5. Multi-path update on leaving member's own profile node touching ONLY leftSpaces child
  if (cleanId) {
    try {
      const currentName = auth.currentUser?.displayName || 'User';
      await update(ref(rtdb, `shared_accounts/profile_${cleanId}`), {
        [`leftSpaces/${cleanShareId}`]: leaveTimestamp,
        ownerUid: effectiveUid,
        accountName: currentName.slice(0, 100),
        updatedAt: leaveTimestamp,
      });
    } catch (profErr) {
      console.warn('[ShareFolders] Failed updating leftSpaces in profile:', profErr);
    }
  }

  try {
    await remove(ref(rtdb, `shared_accounts/profile_shares_${cleanId}_${cleanShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${cleanShareId}`));
  } catch {}
}

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

  const canonicalPath = getCanonicalSharePath(cleanId);
  const txsRef = ref(rtdb, `${canonicalPath}/transactions`);

  const localMatch = loadAllSpacesV3().find((s) => normalizeShareId(s.id) === cleanId);
  let currentFolder: ShareFolder = localMatch
    ? JSON.parse(JSON.stringify(localMatch))
    : {
        id: cleanId,
        name: 'Shared Space',
        accountName: 'Shared Space',
        icon: '📁',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerNumericId: '',
        owner16DigitId: '',
        ownerUid: '',
        ownerName: 'User',
        ownerAvatar: '👤',
        permission: 'allow_import_edit',
        member16Ids: [],
        members: [],
        accounts: [],
        categories: [],
        transactions: [],
        itemCount: 0,
        payload: {
          accounts: [],
          categories: [],
          transactions: [],
        },
      };

  const txsMap = new Map<string, Transaction>();
  for (const t of currentFolder.payload?.transactions || currentFolder.transactions || []) {
    if (t && t.id) {
      txsMap.set(t.id, t);
    }
  }

  let lastEmittedSig = '';
  const emitUpdate = () => {
    if (isShareModalCurrentlyOpen()) return;
    const sortedTxs = Array.from(txsMap.values()).sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (b.time || '00:00').localeCompare(a.time || '00:00');
    });

    const accounts = currentFolder.payload?.accounts || currentFolder.accounts || [];
    const categories = currentFolder.payload?.categories || currentFolder.categories || [];

    currentFolder.payload = {
      accounts,
      categories,
      transactions: sortedTxs,
    };
    currentFolder.transactions = sortedTxs;
    currentFolder.accounts = accounts;
    currentFolder.categories = categories;
    currentFolder.itemCount = accounts.length + categories.length + sortedTxs.length;

    const sig = `${currentFolder.updatedAt}_${computeFolderContentSignature(currentFolder)}`;
    if (sig !== lastEmittedSig) {
      lastEmittedSig = sig;
      upsertSpaceInV3Cache(currentFolder);
      callback({
        ...currentFolder,
        payload: { ...currentFolder.payload },
      });
    }
  };

  // 1. Lightweight RTDB child listeners: ONLY pushes/receives changed item deltas over WebSocket (zero polling)
  const unsubChildAdded = onChildAdded(
    txsRef,
    (snap) => {
      if (!snap.exists()) return;
      const val = snap.val();
      if (!val || typeof val !== 'object') return;
      const txId = val.id || snap.key;
      const accounts = currentFolder.payload?.accounts || currentFolder.accounts || [];
      const enriched = enrichShareTransaction({ ...val, id: txId }, accounts);
      const existing = txsMap.get(txId);
      if (existing && JSON.stringify(existing) === JSON.stringify(enriched)) {
        return;
      }
      txsMap.set(txId, enriched);
      currentFolder.updatedAt = Math.max(
        currentFolder.updatedAt || 0,
        enriched.createdAt || enriched.updatedAt || Date.now()
      );
      emitUpdate();
    },
    (err) => console.warn('[ShareFolders] onChildAdded error:', err)
  );

  const unsubChildChanged = onChildChanged(
    txsRef,
    (snap) => {
      if (!snap.exists()) return;
      const val = snap.val();
      if (!val || typeof val !== 'object') return;
      const txId = val.id || snap.key;
      const accounts = currentFolder.payload?.accounts || currentFolder.accounts || [];
      const enriched = enrichShareTransaction({ ...val, id: txId }, accounts);
      txsMap.set(txId, enriched);
      currentFolder.updatedAt = Math.max(
        currentFolder.updatedAt || 0,
        enriched.createdAt || enriched.updatedAt || Date.now()
      );
      emitUpdate();
    },
    (err) => console.warn('[ShareFolders] onChildChanged error:', err)
  );

  const unsubChildRemoved = onChildRemoved(
    txsRef,
    (snap) => {
      const key = snap.key;
      const val = snap.val();
      const targetId = val?.id || key;
      let removed = false;
      if (txsMap.has(targetId)) {
        txsMap.delete(targetId);
        removed = true;
      } else {
        for (const [k, v] of txsMap) {
          if (v.id === targetId || k === key) {
            txsMap.delete(k);
            removed = true;
            break;
          }
        }
      }
      if (removed) {
        currentFolder.updatedAt = Date.now();
        emitUpdate();
      }
    },
    (err) => console.warn('[ShareFolders] onChildRemoved error:', err)
  );

  // 2. Focused listeners on metadata / accounts / categories / members / deletion
  const unsubMembers = onValue(ref(rtdb, `${canonicalPath}/members`), (snap) => {
    if (!snap.exists()) return;
    const val = snap.val();
    if (Array.isArray(val)) {
      currentFolder.members = val;
      emitUpdate();
    }
  });

  const unsubAccounts = onValue(ref(rtdb, `${canonicalPath}/accounts`), (snap) => {
    if (!snap.exists()) return;
    const val = snap.val();
    if (Array.isArray(val)) {
      currentFolder.accounts = val;
      if (currentFolder.payload) currentFolder.payload.accounts = val;
      emitUpdate();
    }
  });

  const unsubCategories = onValue(ref(rtdb, `${canonicalPath}/categories`), (snap) => {
    if (!snap.exists()) return;
    const val = snap.val();
    if (Array.isArray(val)) {
      currentFolder.categories = val;
      if (currentFolder.payload) currentFolder.payload.categories = val;
      emitUpdate();
    }
  });

  const unsubName = onValue(ref(rtdb, `${canonicalPath}/accountName`), (snap) => {
    if (!snap.exists()) return;
    const val = snap.val();
    if (typeof val === 'string' && val.trim()) {
      currentFolder.name = val;
      currentFolder.accountName = val;
      emitUpdate();
    }
  });

  const unsubDeleted = onValue(ref(rtdb, `${canonicalPath}/deleted`), (snap) => {
    if (snap.exists() && snap.val() === true) {
      purgeDeletedShareSpace(cleanId);
      callback(null);
    }
  });

  // 3. Initial load: if not locally cached or missing accounts, fetch baseline metadata once
  if (!localMatch || !localMatch.payload?.accounts?.length) {
    get(ref(rtdb, canonicalPath))
      .then((snap) => {
        if (snap.exists() && snap.val()) {
          const val = snap.val();
          if (val.deleted === true) {
            purgeDeletedShareSpace(cleanId);
            callback(null);
            return;
          }
          const parsed = normalizeParsedShareFolder(val, cleanId);
          if (parsed) {
            currentFolder = { ...parsed };
            for (const t of parsed.payload?.transactions || []) {
              if (t && t.id) txsMap.set(t.id, t);
            }
            emitUpdate();
          }
        }
      })
      .catch(() => {});
  } else {
    emitUpdate();
  }

  return () => {
    unsubChildAdded();
    unsubChildChanged();
    unsubChildRemoved();
    unsubMembers();
    unsubAccounts();
    unsubCategories();
    unsubName();
    unsubDeleted();
  };
}

/**
 * Keeps lightweight, real-time RTDB child listeners attached to all active user shared spaces
 * so that any transaction added/edited/deleted from ANYWHERE updates the space locally in real-time.
 */
export function subscribeToActiveSpacesTransactions(): () => void {
  const activeUnsubs = new Map<string, () => void>();

  const attachToSpaces = () => {
    const allSpaces = loadAllSpacesV3();
    const currentIds = new Set<string>();

    for (const space of allSpaces) {
      if (!space || !space.id) continue;
      const cleanId = normalizeShareId(space.id);
      if (!cleanId) continue;
      currentIds.add(cleanId);

      if (activeUnsubs.has(cleanId)) continue;

      const canonicalPath = getCanonicalSharePath(cleanId);
      const txsRef = ref(rtdb, `${canonicalPath}/transactions`);

      const unsubAdded = onChildAdded(
        txsRef,
        (snap) => {
          if (!snap.exists()) return;
          const val = snap.val();
          if (!val || typeof val !== 'object') return;
          const txId = val.id || snap.key;

          const all = loadAllSpacesV3();
          const target = all.find((s) => normalizeShareId(s.id) === cleanId);
          if (!target) return;

          const spaceAccounts = target.payload?.accounts || target.accounts || [];
          const enriched = enrichShareTransaction({ ...val, id: txId }, spaceAccounts);
          const existingTxs = [...(target.payload?.transactions || target.transactions || [])];
          const existingIdx = existingTxs.findIndex((t) => t.id === txId);

          if (existingIdx !== -1) {
            if (JSON.stringify(existingTxs[existingIdx]) === JSON.stringify(enriched)) {
              return;
            }
            existingTxs[existingIdx] = enriched;
          } else {
            existingTxs.unshift(enriched);
          }

          const nextSpace: ShareFolder = {
            ...target,
            updatedAt: Math.max(
              target.updatedAt || 0,
              enriched.createdAt || enriched.updatedAt || Date.now()
            ),
            transactions: existingTxs,
            itemCount:
              spaceAccounts.length +
              (target.payload?.categories?.length || target.categories?.length || 0) +
              existingTxs.length,
            payload: {
              accounts: spaceAccounts,
              categories: target.payload?.categories || target.categories || [],
              transactions: existingTxs,
            },
          };
          upsertSpaceInV3Cache(nextSpace);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('spaces_v3_updated', { detail: loadAllSpacesV3() })
            );
          }
        },
        () => {}
      );

      const unsubChanged = onChildChanged(
        txsRef,
        (snap) => {
          if (!snap.exists()) return;
          const val = snap.val();
          if (!val || typeof val !== 'object') return;
          const txId = val.id || snap.key;

          const all = loadAllSpacesV3();
          const target = all.find((s) => normalizeShareId(s.id) === cleanId);
          if (!target) return;

          const spaceAccounts = target.payload?.accounts || target.accounts || [];
          const enriched = enrichShareTransaction({ ...val, id: txId }, spaceAccounts);
          const existingTxs = [...(target.payload?.transactions || target.transactions || [])];
          const existingIdx = existingTxs.findIndex((t) => t.id === txId);

          if (existingIdx !== -1) {
            existingTxs[existingIdx] = enriched;
          } else {
            existingTxs.unshift(enriched);
          }

          const nextSpace: ShareFolder = {
            ...target,
            updatedAt: Math.max(
              target.updatedAt || 0,
              enriched.createdAt || enriched.updatedAt || Date.now()
            ),
            transactions: existingTxs,
            itemCount:
              spaceAccounts.length +
              (target.payload?.categories?.length || target.categories?.length || 0) +
              existingTxs.length,
            payload: {
              accounts: spaceAccounts,
              categories: target.payload?.categories || target.categories || [],
              transactions: existingTxs,
            },
          };
          upsertSpaceInV3Cache(nextSpace);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('spaces_v3_updated', { detail: loadAllSpacesV3() })
            );
          }
        },
        () => {}
      );

      const unsubRemoved = onChildRemoved(
        txsRef,
        (snap) => {
          const key = snap.key;
          const val = snap.val();
          const targetId = val?.id || key;

          const all = loadAllSpacesV3();
          const target = all.find((s) => normalizeShareId(s.id) === cleanId);
          if (!target) return;

          const existingTxs = target.payload?.transactions || target.transactions || [];
          const filtered = existingTxs.filter((t) => t.id !== targetId && t.id !== key);
          if (filtered.length === existingTxs.length) return;

          const nextSpace: ShareFolder = {
            ...target,
            updatedAt: Date.now(),
            transactions: filtered,
            itemCount:
              (target.payload?.accounts?.length || 0) +
              (target.payload?.categories?.length || 0) +
              filtered.length,
            payload: {
              accounts: target.payload?.accounts || target.accounts || [],
              categories: target.payload?.categories || target.categories || [],
              transactions: filtered,
            },
          };
          upsertSpaceInV3Cache(nextSpace);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('spaces_v3_updated', { detail: loadAllSpacesV3() })
            );
          }
        },
        () => {}
      );

      activeUnsubs.set(cleanId, () => {
        unsubAdded();
        unsubChanged();
        unsubRemoved();
      });
    }

    // Clean up spaces that are no longer in allSpaces
    for (const [id, unsub] of activeUnsubs.entries()) {
      if (!currentIds.has(id)) {
        unsub();
        activeUnsubs.delete(id);
      }
    }
  };

  attachToSpaces();

  const handleSpacesChanged = () => {
    attachToSpaces();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('spaces_v3_updated', handleSpacesChanged);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('spaces_v3_updated', handleSpacesChanged);
    }
    for (const unsub of activeUnsubs.values()) {
      unsub();
    }
    activeUnsubs.clear();
  };
}

/**
 * Single-shot fetch of user's incoming shares using Promise.allSettled on deterministic slots (0..9):
 * shared_accounts/slot_${myClean16Id}_0 through shared_accounts/slot_${myClean16Id}_9
 * and master share nodes shared_accounts/share_${shareId}.
 * NEVER reads the root 'shared_accounts' collection!
 */
export async function fetchMyInboxOnce(my16DigitId: string): Promise<ShareFolder[]> {
  await executeOneTimeV3ShareCleanReset();
  const cleanId = normalize16DigitId(my16DigitId || getOrCreateNumericId());
  if (cleanId.length !== 16) return loadReceivedShareFolders();
  if (isShareModalCurrentlyOpen()) return loadReceivedShareFolders();

  const candidateShareIds = new Set<string>();
  const embeddedSlotSpaces = new Map<string, any>();

  try {
    const slotPromises = Array.from({ length: CLOUD_SLOTS_COUNT }, (_, i) =>
      get(ref(rtdb, `shared_accounts/slot_${cleanId}_${i}`))
    );
    const slotResults = await Promise.allSettled(slotPromises);

    slotResults.forEach((res) => {
      if (res.status !== 'fulfilled' || !res.value.exists()) return;
      const val = res.value.val();
      if (!val || typeof val !== 'object') return;
      const rawSpace = val.space || val;
      const rawId = normalizeShareId(val.shareId || val.rawShareId || rawSpace?.id || val.id);
      if (!rawId) return;

      if (val.kicked === true || val.deleted === true || rawSpace?.deleted === true) {
        purgeDeletedShareSpace(rawId);
        return;
      }

      const slotInvitedAt = val.invitedAt || rawSpace?.invitedAt || rawSpace?.updatedAt || val.updatedAt || 0;
      if (isShareDismissed(rawId, slotInvitedAt)) return;

      candidateShareIds.add(rawId);
      if (rawSpace && typeof rawSpace === 'object') {
        embeddedSlotSpaces.set(rawId, rawSpace);
      }
    });

    const localReceived = loadReceivedShareFolders();
    const localReceivedMap = new Map<string, ShareFolder>();
    for (const rec of localReceived) {
      const cid = normalizeShareId(rec.id);
      if (cid && !isShareDismissed(cid)) {
        candidateShareIds.add(cid);
        localReceivedMap.set(cid, rec);
        if (!embeddedSlotSpaces.has(cid)) {
          embeddedSlotSpaces.set(cid, rec);
        }
      }
    }

    const masterPromises = Array.from(candidateShareIds).map(async (rawShareId) => {
      try {
        const mSnap = await get(ref(rtdb, `shared_accounts/share_${rawShareId}`));
        if (mSnap.exists() && mSnap.val()) {
          const val = mSnap.val();
          if (val.deleted === true) {
            purgeDeletedShareSpace(rawShareId);
            return null;
          }
          const parsed = normalizeParsedShareFolder(val, rawShareId);
          if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
            const targetMember = (parsed.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
            const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || parsed.updatedAt || 0;
            if (isShareDismissed(rawShareId, invitedAt)) {
              return null;
            }
            const localVer = localReceivedMap.get(rawShareId);
            if (localVer && (parsed.updatedAt || 0) <= (localVer.updatedAt || 0)) {
              return { ...localVer, isCreatedByMe: false, isReceivedShare: true };
            }
            return { ...parsed, isCreatedByMe: false, isReceivedShare: true };
          }
        }
      } catch {}

      try {
        const pSnap = await get(ref(rtdb, `shared_accounts/profile_shares_${cleanId}_${rawShareId}`));
        if (pSnap.exists() && pSnap.val()) {
          const val = pSnap.val();
          const rawSpace = val.space || val;
          if (val.deleted === true || rawSpace?.deleted === true) {
            purgeDeletedShareSpace(rawShareId);
            return null;
          }
          const parsed = normalizeParsedShareFolder(rawSpace, rawShareId);
          if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
            const targetMember = (parsed.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
            const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || parsed.updatedAt || 0;
            if (isShareDismissed(rawShareId, invitedAt)) {
              return null;
            }
            return { ...parsed, isCreatedByMe: false, isReceivedShare: true };
          }
        }
      } catch {}

      const embedded = embeddedSlotSpaces.get(rawShareId);
      if (embedded) {
        if (embedded.deleted === true) {
          purgeDeletedShareSpace(rawShareId);
          return null;
        }
        const parsed = normalizeParsedShareFolder(embedded, rawShareId);
        if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
          const targetMember = (parsed.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
          const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || parsed.updatedAt || 0;
          if (isShareDismissed(rawShareId, invitedAt)) {
            return null;
          }
          return { ...parsed, isCreatedByMe: false, isReceivedShare: true };
        }
      }

      return null;
    });

    const settledMasters = await Promise.allSettled(masterPromises);
    const finalReceivedMap = new Map<string, ShareFolder>();

    settledMasters.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        finalReceivedMap.set(normalizeShareId(res.value.id), res.value);
      }
    });

    const receivedSpaces = Array.from(finalReceivedMap.values()).filter(
      (f) => {
        const targetMember = (f.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
        const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || f.updatedAt || 0;
        return !isShareDismissed(normalizeShareId(f.id), invitedAt) && isSpaceSharedWithUser(f, cleanId);
      }
    );
    receivedSpaces.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    saveReceivedShareFolders(receivedSpaces);
    const allSpaces = [...loadMyShareFolders(), ...receivedSpaces];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify(allSpaces));
      } catch {}
    }
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
 * Real-time receiver listener using individual child onValue listeners directly on:
 * - shared_accounts/slot_${myClean16Id}_0 through shared_accounts/slot_${myClean16Id}_9
 * - and each discovered shared_accounts/share_${shareId}.
 * NEVER attaches a listener to the root ref(db, 'shared_accounts')!
 */
export function subscribeToMyInbox(
  my16DigitId: string,
  callback: (folders: ShareFolder[]) => void
): () => void {
  executeOneTimeV3ShareCleanReset().catch(() => {});
  const cleanId = normalize16DigitId(my16DigitId || getOrCreateNumericId());
  if (cleanId.length !== 16) return () => {};

  const cleanups: (() => void)[] = [];
  const activeMasterSubs = new Map<string, () => void>();
  const slotSpacesMap = new Map<number, ShareFolder | null>();
  const masterSpacesMap = new Map<string, ShareFolder>();

  let emitTimer: any = null;
  let lastEmittedSig = '';

  const emitCombined = () => {
    const combinedMap = new Map<string, ShareFolder>();

    for (const localRec of loadReceivedShareFolders()) {
      const cid = normalizeShareId(localRec.id);
      const targetMember = (localRec.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
      const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || localRec.updatedAt || 0;
      if (cid && !isShareDismissed(cid, invitedAt) && isSpaceSharedWithUser(localRec, cleanId)) {
        combinedMap.set(cid, { ...localRec, isCreatedByMe: false, isReceivedShare: true });
      }
    }

    slotSpacesMap.forEach((slotFolder) => {
      if (!slotFolder || !slotFolder.id) return;
      const cid = normalizeShareId(slotFolder.id);
      const targetMember = (slotFolder.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
      const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || slotFolder.updatedAt || 0;
      if (!cid || isShareDismissed(cid, invitedAt) || !isSpaceSharedWithUser(slotFolder, cleanId)) return;
      const existing = combinedMap.get(cid);
      if (!existing || (slotFolder.updatedAt || 0) > (existing.updatedAt || 0)) {
        combinedMap.set(cid, { ...slotFolder, isCreatedByMe: false, isReceivedShare: true });
      }
    });

    masterSpacesMap.forEach((masterFolder, rawId) => {
      const cid = normalizeShareId(masterFolder.id || rawId);
      const targetMember = (masterFolder.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
      const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || masterFolder.updatedAt || 0;
      if (!cid || isShareDismissed(cid, invitedAt) || !isSpaceSharedWithUser(masterFolder, cleanId)) return;
      const existing = combinedMap.get(cid);
      if (!existing || (masterFolder.updatedAt || 0) >= (existing.updatedAt || 0)) {
        combinedMap.set(cid, { ...masterFolder, isCreatedByMe: false, isReceivedShare: true });
      }
    });

    const receivedSpaces = Array.from(combinedMap.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
    );

    const sig = receivedSpaces
      .map((s) => `${s.id}_${s.updatedAt || 0}_${s.members?.length || 0}_${s.itemCount || 0}`)
      .join('|');

    if (sig !== lastEmittedSig) {
      lastEmittedSig = sig;
      saveReceivedShareFolders(receivedSpaces);
      const allSpaces = [...loadMyShareFolders(), ...receivedSpaces];
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SPACES_V3_CACHE_KEY, JSON.stringify(allSpaces));
        } catch {}
      }
      callback(receivedSpaces);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spaces_v3_updated', { detail: allSpaces }));
        window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: receivedSpaces }));
      }
    }
  };

  const scheduleEmit = () => {
    if (emitTimer) clearTimeout(emitTimer);
    emitTimer = setTimeout(emitCombined, 50);
  };

  cleanups.push(() => {
    if (emitTimer) clearTimeout(emitTimer);
  });

  const subscribeMasterShare = (shareId: string) => {
    const rawShareId = normalizeShareId(shareId);
    if (!rawShareId || activeMasterSubs.has(rawShareId)) return;

    const masterRef = ref(rtdb, `shared_accounts/share_${rawShareId}`);
    const masterListener = (snap: any) => {
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        if (val.deleted === true) {
          masterSpacesMap.delete(rawShareId);
          purgeDeletedShareSpace(rawShareId);
          scheduleEmit();
          return;
        }
        const parsed = normalizeParsedShareFolder(val, rawShareId);
        if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
          const targetMember = (parsed.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
          const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || parsed.updatedAt || 0;
          if (isShareDismissed(rawShareId, invitedAt)) return;

          masterSpacesMap.set(rawShareId, { ...parsed, isCreatedByMe: false, isReceivedShare: true });
          scheduleEmit();
        }
      } else if (!snap.exists()) {
        masterSpacesMap.delete(rawShareId);
        purgeDeletedShareSpace(rawShareId);
        scheduleEmit();
      }
    };

    onValue(masterRef, masterListener, () => {});

    const profShareRef = ref(rtdb, `shared_accounts/profile_shares_${cleanId}_${rawShareId}`);
    const profListener = (pSnap: any) => {
      if (pSnap.exists() && pSnap.val()) {
        const val = pSnap.val();
        const rawSpace = val.space || val;
        if (val.deleted === true || rawSpace?.deleted === true) {
          masterSpacesMap.delete(rawShareId);
          purgeDeletedShareSpace(rawShareId);
          scheduleEmit();
          return;
        }
        const parsed = normalizeParsedShareFolder(rawSpace, rawShareId);
        if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
          const targetMember = (parsed.members || []).find((m) => normalize16DigitId(m.numericId) === cleanId);
          const invitedAt = targetMember?.invitedAt || targetMember?.addedAt || parsed.updatedAt || 0;
          if (isShareDismissed(rawShareId, invitedAt)) return;

          const prev = masterSpacesMap.get(rawShareId);
          if (!prev || (parsed.updatedAt || 0) >= (prev.updatedAt || 0)) {
            masterSpacesMap.set(rawShareId, { ...parsed, isCreatedByMe: false, isReceivedShare: true });
            scheduleEmit();
          }
        }
      }
    };

    onValue(profShareRef, profListener, () => {});

    activeMasterSubs.set(rawShareId, () => {
      off(masterRef, 'value', masterListener);
      off(profShareRef, 'value', profListener);
    });
  };

  for (const rec of loadReceivedShareFolders()) {
    if (rec?.id) {
      subscribeMasterShare(rec.id);
    }
  }

  for (const owned of loadMyShareFolders()) {
    const rawOwnedId = normalizeShareId(owned.id);
    if (!rawOwnedId) continue;
    const ownedRef = ref(rtdb, `shared_accounts/share_${rawOwnedId}`);
    const ownedListener = (snap: any) => {
      if (isShareModalCurrentlyOpen()) return;
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        if (val.deleted === true) return;
        const parsed = normalizeParsedShareFolder(val, rawOwnedId);
        if (parsed && isSpaceOwnedByUser(parsed, cleanId)) {
          const localOwned = loadMyShareFolders().find((f) => normalizeShareId(f.id) === rawOwnedId);
          if (!localOwned || (parsed.updatedAt || 0) > (localOwned.updatedAt || 0)) {
            upsertSpaceInV3Cache({ ...parsed, isCreatedByMe: true, isReceivedShare: false });
          }
        }
      }
    };
    onValue(ownedRef, ownedListener, () => {});
    cleanups.push(() => off(ownedRef, 'value', ownedListener));
  }

  for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
    const slotRef = ref(rtdb, `shared_accounts/slot_${cleanId}_${i}`);
    const slotListener = (snap: any) => {
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        const rawSpace = val.space || val;
        const rawShareId = normalizeShareId(val.shareId || val.rawShareId || rawSpace?.id || val.id);

        if (val.kicked === true || val.deleted === true || rawSpace?.deleted === true) {
          slotSpacesMap.set(i, null);
          if (rawShareId) {
            masterSpacesMap.delete(rawShareId);
            purgeDeletedShareSpace(rawShareId);
            clearShareNotifiedState(rawShareId, cleanId);
          }
          scheduleEmit();
          return;
        }

        const slotInvitedAt = val.invitedAt || rawSpace?.invitedAt || rawSpace?.updatedAt || val.updatedAt || 0;
        if (!rawShareId || isShareDismissed(rawShareId, slotInvitedAt)) {
          slotSpacesMap.set(i, null);
          return;
        }

        subscribeMasterShare(rawShareId);

        const parsed = normalizeParsedShareFolder(rawSpace, rawShareId);
        if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
          slotSpacesMap.set(i, { ...parsed, isCreatedByMe: false, isReceivedShare: true });
          scheduleEmit();
        }
      } else {
        slotSpacesMap.set(i, null);
        scheduleEmit();
      }
    };

    onValue(slotRef, slotListener, () => {});
    cleanups.push(() => off(slotRef, 'value', slotListener));
  }

  // Real-time listener directly on inboxByNumericId/${cleanId} for instant zero-refresh delivery
  const inboxRef = ref(rtdb, `inboxByNumericId/${cleanId}`);
  const inboxListener = (snap: any) => {
    if (snap.exists() && snap.val()) {
      const val = snap.val();
      if (typeof val === 'object') {
        for (const [key, rawEntry] of Object.entries(val)) {
          if (!rawEntry) continue;
          const rawSpace = (rawEntry as any).space || rawEntry;
          const rawShareId = normalizeShareId(
            (rawEntry as any).shareId || (rawEntry as any).rawShareId || rawSpace?.id || key
          );
          if (!rawShareId) continue;

          if ((rawEntry as any).kicked === true || (rawEntry as any).deleted === true || rawSpace?.deleted === true) {
            masterSpacesMap.delete(rawShareId);
            purgeDeletedShareSpace(rawShareId);
            clearShareNotifiedState(rawShareId, cleanId);
            scheduleEmit();
            continue;
          }

          const slotInvitedAt =
            (rawEntry as any).invitedAt || rawSpace?.invitedAt || rawSpace?.updatedAt || (rawEntry as any).updatedAt || 0;
          if (isShareDismissed(rawShareId, slotInvitedAt)) continue;

          subscribeMasterShare(rawShareId);

          const parsed = normalizeParsedShareFolder(rawSpace, rawShareId);
          if (parsed && isSpaceSharedWithUser(parsed, cleanId)) {
            masterSpacesMap.set(rawShareId, { ...parsed, isCreatedByMe: false, isReceivedShare: true });
            scheduleEmit();
          }
        }
      }
    }
  };
  onValue(inboxRef, inboxListener, () => {});
  cleanups.push(() => off(inboxRef, 'value', inboxListener));

  return () => {
    cleanups.forEach((fn) => fn());
    activeMasterSubs.forEach((unsub) => unsub());
    activeMasterSubs.clear();
  };
}

export const listenToMyNumericIdInbox = subscribeToMyInbox;

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
